//! Minimal, zero-dependency RFC 6455 WebSocket client over local `TcpStream`.
//!
//! Designed specifically for ultra-low RAM CDP connections (`ws://127.0.0.1:<port>/...`):
//! - Zero external crypto/HTTP/RNG crates (tiny binary, instant compile, no `dlltool` raw-dylib issues).
//! - Streaming masked chunked writes (only 8 KiB stack scratch buffer even for multi-MB payloads).
//! - Timeout-safe framing: `read_event()` only times out cleanly between frames; once a frame
//!   starts, it reads to completion with a generous I/O timeout so the stream never desynchronizes.

use crate::Result;
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use std::io::{self, Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const WS_GUID: &str = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const MAX_MESSAGE_BYTES: usize = 32 * 1024 * 1024;
const FRAME_IO_TIMEOUT: Duration = Duration::from_secs(5);

static PRNG_COUNTER: AtomicU64 = AtomicU64::new(0x9E37_79B9_7F4A_7C15);

#[derive(Debug)]
pub enum WsEvent {
    Text(String),
    Binary(Vec<u8>),
    Ping(Vec<u8>),
    Pong(Vec<u8>),
    Close,
    Timeout,
}

pub struct WsClient {
    stream: TcpStream,
    /// Leftover bytes read beyond the HTTP 101 handshake header boundary.
    leftover: Vec<u8>,
    leftover_pos: usize,
    idle_read_timeout: Duration,
}

fn next_u64() -> u64 {
    let t = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos() as u64;
    let c = PRNG_COUNTER.fetch_add(0x9E37_79B9_7F4A_7C15, Ordering::Relaxed);
    let mut x = t ^ c ^ ((std::process::id() as u64).rotate_left(17));
    x ^= x >> 12;
    x ^= x << 25;
    x ^= x >> 27;
    x.wrapping_mul(0x2545_F491_4F6C_DD1D)
}

fn random_mask() -> [u8; 4] {
    (next_u64() as u32).to_be_bytes()
}

/// Pure-Rust SHA-1 (RFC 3174) for RFC 6455 `Sec-WebSocket-Accept` verification.
pub fn sha1(input: &[u8]) -> [u8; 20] {
    let mut h0: u32 = 0x6745_2301;
    let mut h1: u32 = 0xEFCD_AB89;
    let mut h2: u32 = 0x98BA_DCFE;
    let mut h3: u32 = 0x1032_5476;
    let mut h4: u32 = 0xC3D2_E1F0;

    let bit_len = (input.len() as u64) * 8;
    let mut msg = Vec::with_capacity(((input.len() + 9 + 63) / 64) * 64);
    msg.extend_from_slice(input);
    msg.push(0x80);
    while (msg.len() % 64) != 56 {
        msg.push(0);
    }
    msg.extend_from_slice(&bit_len.to_be_bytes());

    for chunk in msg.chunks_exact(64) {
        let mut w = [0u32; 80];
        for i in 0..16 {
            w[i] = u32::from_be_bytes([
                chunk[i * 4],
                chunk[i * 4 + 1],
                chunk[i * 4 + 2],
                chunk[i * 4 + 3],
            ]);
        }
        for i in 16..80 {
            w[i] = (w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16]).rotate_left(1);
        }

        let (mut a, mut b, mut c, mut d, mut e) = (h0, h1, h2, h3, h4);
        for (i, &wi) in w.iter().enumerate() {
            let (f, k) = match i {
                0..=19 => ((b & c) | ((!b) & d), 0x5A82_7999u32),
                20..=39 => (b ^ c ^ d, 0x6ED9_EBA1u32),
                40..=59 => ((b & c) | (b & d) | (c & d), 0x8F1B_BCDC),
                _ => (b ^ c ^ d, 0xCA62_C1D6),
            };
            let temp = a
                .rotate_left(5)
                .wrapping_add(f)
                .wrapping_add(e)
                .wrapping_add(k)
                .wrapping_add(wi);
            e = d;
            d = c;
            c = b.rotate_left(30);
            b = a;
            a = temp;
        }

        h0 = h0.wrapping_add(a);
        h1 = h1.wrapping_add(b);
        h2 = h2.wrapping_add(c);
        h3 = h3.wrapping_add(d);
        h4 = h4.wrapping_add(e);
    }

    let mut out = [0u8; 20];
    out[0..4].copy_from_slice(&h0.to_be_bytes());
    out[4..8].copy_from_slice(&h1.to_be_bytes());
    out[8..12].copy_from_slice(&h2.to_be_bytes());
    out[12..16].copy_from_slice(&h3.to_be_bytes());
    out[16..20].copy_from_slice(&h4.to_be_bytes());
    out
}

pub fn compute_accept_key(sec_ws_key: &str) -> String {
    let mut buf = String::with_capacity(sec_ws_key.len() + WS_GUID.len());
    buf.push_str(sec_ws_key.trim());
    buf.push_str(WS_GUID);
    BASE64.encode(sha1(buf.as_bytes()))
}

fn parse_ws_url(ws_url: &str) -> Result<(String, String)> {
    let rest = ws_url
        .strip_prefix("ws://")
        .ok_or_else(|| format!("Only local ws:// URLs are supported, got: {ws_url}"))?;
    let (authority, path) = match rest.find('/') {
        Some(idx) => (&rest[..idx], &rest[idx..]),
        None => (rest, "/"),
    };
    if authority.is_empty() {
        return Err(format!("Missing host in WebSocket URL: {ws_url}").into());
    }
    let host_port = if authority.contains(':') {
        authority.to_string()
    } else {
        format!("{authority}:80")
    };
    Ok((host_port, path.to_string()))
}

impl WsClient {
    pub fn connect(ws_url: &str, idle_read_timeout: Duration) -> Result<Self> {
        let (host_port, path) = parse_ws_url(ws_url)?;
        let mut stream = if let Ok(addr) = host_port.parse::<SocketAddr>() {
            TcpStream::connect_timeout(&addr, Duration::from_secs(3))?
        } else {
            TcpStream::connect(&host_port)?
        };
        stream.set_read_timeout(Some(FRAME_IO_TIMEOUT))?;
        stream.set_write_timeout(Some(FRAME_IO_TIMEOUT))?;
        let _ = stream.set_nodelay(true);

        let mut key_bytes = [0u8; 16];
        key_bytes[0..8].copy_from_slice(&next_u64().to_be_bytes());
        key_bytes[8..16].copy_from_slice(&next_u64().to_be_bytes());
        let ws_key = BASE64.encode(key_bytes);
        let expected_accept = compute_accept_key(&ws_key);

        let handshake = format!(
            "GET {path} HTTP/1.1\r\nHost: {host_port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {ws_key}\r\nSec-WebSocket-Version: 13\r\n\r\n"
        );
        stream.write_all(handshake.as_bytes())?;

        // Read HTTP 101 response header up to \r\n\r\n.
        let mut resp_buf = Vec::with_capacity(512);
        let mut tmp = [0u8; 512];
        let header_end = loop {
            let n = stream.read(&mut tmp)?;
            if n == 0 {
                return Err("WebSocket handshake closed before response headers".into());
            }
            resp_buf.extend_from_slice(&tmp[..n]);
            if let Some(pos) = resp_buf.windows(4).position(|w| w == b"\r\n\r\n") {
                break pos;
            }
            if resp_buf.len() > 16 * 1024 {
                return Err("WebSocket handshake response header too large".into());
            }
        };

        let header_str = String::from_utf8_lossy(&resp_buf[..header_end]);
        let status = header_str.lines().next().unwrap_or("");
        if !status.contains(" 101") {
            return Err(format!("WebSocket handshake rejected: {status}").into());
        }

        let accept_ok = header_str.lines().any(|line| {
            if let Some((k, v)) = line.split_once(':') {
                k.trim().eq_ignore_ascii_case("sec-websocket-accept")
                    && v.trim() == expected_accept
            } else {
                false
            }
        });
        if !accept_ok {
            return Err("WebSocket handshake Sec-WebSocket-Accept mismatch".into());
        }

        let leftover = resp_buf[header_end + 4..].to_vec();
        Ok(Self {
            stream,
            leftover,
            leftover_pos: 0,
            idle_read_timeout,
        })
    }

    pub fn send_text(&mut self, text: &str) -> Result<()> {
        self.write_frame(0x01, text.as_bytes())
    }

    pub fn send_pong(&mut self, payload: &[u8]) -> Result<()> {
        self.write_frame(0x0A, payload)
    }

    pub fn close(&mut self) {
        let _ = self.write_frame(0x08, &[]);
        let _ = self.stream.shutdown(std::net::Shutdown::Both);
    }

    /// Writes a masked RFC 6455 client frame using a fixed 8 KiB stack buffer (zero full-payload copy).
    fn write_frame(&mut self, opcode: u8, payload: &[u8]) -> Result<()> {
        let mask = random_mask();
        let mut header = [0u8; 14];
        header[0] = 0x80 | (opcode & 0x0F);
        let len = payload.len();
        let hdr_len = if len <= 125 {
            header[1] = 0x80 | (len as u8);
            header[2..6].copy_from_slice(&mask);
            6
        } else if len <= 65_535 {
            header[1] = 0x80 | 126;
            header[2..4].copy_from_slice(&(len as u16).to_be_bytes());
            header[4..8].copy_from_slice(&mask);
            8
        } else {
            header[1] = 0x80 | 127;
            header[2..10].copy_from_slice(&(len as u64).to_be_bytes());
            header[10..14].copy_from_slice(&mask);
            14
        };

        self.stream.write_all(&header[..hdr_len])?;

        let mut scratch = [0u8; 8192];
        let mut offset = 0usize;
        while offset < len {
            let chunk_len = (len - offset).min(scratch.len());
            for i in 0..chunk_len {
                scratch[i] = payload[offset + i] ^ mask[(offset + i) & 3];
            }
            self.stream.write_all(&scratch[..chunk_len])?;
            offset += chunk_len;
        }
        Ok(())
    }

    fn read_first_byte_with_idle_timeout(&mut self) -> io::Result<Option<u8>> {
        if self.leftover_pos < self.leftover.len() {
            let b = self.leftover[self.leftover_pos];
            self.leftover_pos += 1;
            if self.leftover_pos == self.leftover.len() {
                self.leftover.clear();
                self.leftover_pos = 0;
            }
            return Ok(Some(b));
        }

        self.stream.set_read_timeout(Some(self.idle_read_timeout))?;
        let mut b = [0u8; 1];
        match self.stream.read(&mut b) {
            Ok(0) => Err(io::Error::new(io::ErrorKind::UnexpectedEof, "WS EOF")),
            Ok(_) => Ok(Some(b[0])),
            Err(ref e)
                if e.kind() == io::ErrorKind::WouldBlock
                    || e.kind() == io::ErrorKind::TimedOut =>
            {
                Ok(None)
            }
            Err(e) => Err(e),
        }
    }

    fn read_exact_frame(&mut self, buf: &mut [u8]) -> io::Result<()> {
        let mut filled = 0;
        if self.leftover_pos < self.leftover.len() {
            let avail = self.leftover.len() - self.leftover_pos;
            let take = avail.min(buf.len());
            buf[..take].copy_from_slice(&self.leftover[self.leftover_pos..self.leftover_pos + take]);
            self.leftover_pos += take;
            if self.leftover_pos == self.leftover.len() {
                self.leftover.clear();
                self.leftover_pos = 0;
            }
            filled = take;
        }
        if filled < buf.len() {
            self.stream.set_read_timeout(Some(FRAME_IO_TIMEOUT))?;
            self.stream.read_exact(&mut buf[filled..])?;
        }
        Ok(())
    }

    /// Reads the next complete WebSocket message (handling fragmentation & control frames).
    pub fn read_event(&mut self) -> Result<WsEvent> {
        let mut fragmented_opcode: Option<u8> = None;
        let mut assembled: Vec<u8> = Vec::new();

        loop {
            let b0 = if fragmented_opcode.is_none() {
                match self.read_first_byte_with_idle_timeout()? {
                    Some(b) => b,
                    None => return Ok(WsEvent::Timeout),
                }
            } else {
                let mut b = [0u8; 1];
                self.read_exact_frame(&mut b)?;
                b[0]
            };

            let mut b1_arr = [0u8; 1];
            self.read_exact_frame(&mut b1_arr)?;
            let b1 = b1_arr[0];

            let fin = (b0 & 0x80) != 0;
            let opcode = b0 & 0x0F;
            let masked = (b1 & 0x80) != 0;
            let len7 = (b1 & 0x7F) as u64;

            let payload_len: usize = match len7 {
                0..=125 => len7 as usize,
                126 => {
                    let mut ext = [0u8; 2];
                    self.read_exact_frame(&mut ext)?;
                    u16::from_be_bytes(ext) as usize
                }
                127 => {
                    let mut ext = [0u8; 8];
                    self.read_exact_frame(&mut ext)?;
                    let raw = u64::from_be_bytes(ext);
                    if raw > MAX_MESSAGE_BYTES as u64 {
                        return Err(format!("WebSocket frame exceeds limit: {raw} bytes").into());
                    }
                    raw as usize
                }
                _ => unreachable!(),
            };

            if assembled.len().saturating_add(payload_len) > MAX_MESSAGE_BYTES {
                return Err("WebSocket message exceeds 32 MiB limit".into());
            }

            let mask_key = if masked {
                let mut m = [0u8; 4];
                self.read_exact_frame(&mut m)?;
                Some(m)
            } else {
                None
            };

            let mut payload = vec![0u8; payload_len];
            if payload_len > 0 {
                self.read_exact_frame(&mut payload)?;
                if let Some(m) = mask_key {
                    for (i, byte) in payload.iter_mut().enumerate() {
                        *byte ^= m[i & 3];
                    }
                }
            }

            // Control frames may be interleaved inside fragmented data messages.
            match opcode {
                0x08 => return Ok(WsEvent::Close),
                0x09 => {
                    if fragmented_opcode.is_none() {
                        return Ok(WsEvent::Ping(payload));
                    }
                    let _ = self.send_pong(&payload);
                    continue;
                }
                0x0A => {
                    if fragmented_opcode.is_none() {
                        return Ok(WsEvent::Pong(payload));
                    }
                    continue;
                }
                0x01 | 0x02 => {
                    if fin {
                        return if opcode == 0x01 {
                            Ok(WsEvent::Text(String::from_utf8(payload)?))
                        } else {
                            Ok(WsEvent::Binary(payload))
                        };
                    }
                    fragmented_opcode = Some(opcode);
                    assembled = payload;
                }
                0x00 => {
                    assembled.extend_from_slice(&payload);
                    if fin {
                        let op = fragmented_opcode.unwrap_or(0x01);
                        return if op == 0x01 {
                            Ok(WsEvent::Text(String::from_utf8(assembled)?))
                        } else {
                            Ok(WsEvent::Binary(assembled))
                        };
                    }
                }
                other => return Err(format!("Unsupported WebSocket opcode: 0x{other:x}").into()),
            }
        }
    }
}
