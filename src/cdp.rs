use crate::paths::read_port_info;
use crate::ws::{WsClient, WsEvent};
use crate::Result;
use serde::Deserialize;
use serde_json::{json, Value};
use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::time::{Duration, Instant};

#[derive(Debug, Clone, Deserialize)]
pub struct CdpTarget {
    pub id: String,
    #[serde(rename = "type", default)]
    pub target_type: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub url: String,
    #[serde(rename = "webSocketDebuggerUrl", default)]
    pub web_socket_debugger_url: String,
}

#[derive(Debug, Clone)]
pub struct VerifyOutcome {
    pub port: u16,
    pub results: Vec<Value>,
    pub themed_count: usize,
    pub total_count: usize,
    pub has_live_blur: bool,
}

pub const INSPECT_EXPR: &str = r#"(() => {
    const styleEl = document.getElementById('antigravity-custom-theme-active');
    const shellEl = document.querySelector('.agy-shell');
    const mainGrid = document.querySelector('div.flex.h-full.flex-col.overflow-hidden.relative > div.flex.flex-1.flex-row.overflow-hidden.relative');
    const projPill = document.querySelector('[data-testid="project-selector-trigger"]');
    const envPill = document.querySelector('[aria-label="Select Environment"]');
    const scrollers = Array.from(document.querySelectorAll('.overflow-y-auto, [data-main-content-body], [data-side-panel-body]'));
    const liveBlurScrollers = scrollers.filter((el) => /blur\(/i.test(getComputedStyle(el).backdropFilter || ''));
    const shellBackdrop = shellEl ? (getComputedStyle(shellEl).backdropFilter || 'none') : 'none';
    const hasLiveBlurRule = /blur\(/i.test(shellBackdrop) || liveBlurScrollers.length > 0;
    return {
        url: location.href,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        themeActive: Boolean(styleEl),
        activeTheme: localStorage.getItem('agy_theme_v3') || null,
        shellFound: Boolean(shellEl),
        shellBgImagePresent: shellEl ? getComputedStyle(shellEl).backgroundImage !== 'none' : false,
        hasBrowserHole: document.body.dataset.hasBrowserHole || null,
        shellHoleActive: shellEl ? shellEl.getAttribute('data-agy-hole-active') : null,
        mainGridFound: Boolean(mainGrid),
        projectPillBg: projPill ? getComputedStyle(projPill).backgroundColor : null,
        envPillBg: envPill ? getComputedStyle(envPill).backgroundColor : null,
        scrollerCount: scrollers.length,
        liveBlurScrollerCount: liveBlurScrollers.length,
        hasLiveBlurRule,
        settingsTriggerPresent: Boolean(document.getElementById('agy-custom-theme-sidebar-btn')),
        composerPresent: Boolean(document.querySelector('div.relative.flex.flex-col.rounded-lg.border')),
    };
})()"#;

pub const REMOVE_THEME_EXPR: &str =
    "window.__ANTIGRAVITY_REMOVE_CUSTOM_THEME__ && window.__ANTIGRAVITY_REMOVE_CUSTOM_THEME__();";

/// Zero-dependency HTTP/1.1 GET for local CDP endpoints (`http://127.0.0.1:<port>/json`).
/// Reads exact `Content-Length` (or chunked terminator) immediately because Chromium's
/// DevTools HTTP server ignores `Connection: close` and keeps sockets alive.
pub fn fetch_targets(port: u16, timeout: Duration) -> Result<Vec<CdpTarget>> {
    let addr: SocketAddr = ([127, 0, 0, 1], port).into();
    let mut stream = TcpStream::connect_timeout(&addr, timeout)?;
    stream.set_read_timeout(Some(timeout))?;
    stream.set_write_timeout(Some(timeout))?;
    let _ = stream.set_nodelay(true);

    let req = format!(
        "GET /json HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nAccept: application/json\r\nConnection: close\r\n\r\n"
    );
    stream.write_all(req.as_bytes())?;

    let mut raw = Vec::with_capacity(4096);
    let mut tmp = [0u8; 4096];
    let header_end = loop {
        let n = stream.read(&mut tmp)?;
        if n == 0 {
            return Err("CDP /json closed before HTTP headers completed".into());
        }
        raw.extend_from_slice(&tmp[..n]);
        if let Some(pos) = raw.windows(4).position(|w| w == b"\r\n\r\n") {
            break pos;
        }
        if raw.len() > 64 * 1024 {
            return Err("CDP /json HTTP response headers too large".into());
        }
    };

    let headers = String::from_utf8_lossy(&raw[..header_end]).into_owned();
    let status_line = headers.lines().next().unwrap_or("");
    if !status_line.contains(" 200") {
        return Err(format!("CDP /json returned non-200 status: {status_line}").into());
    }

    let content_length: Option<usize> = headers.lines().find_map(|line| {
        let (k, v) = line.split_once(':')?;
        if k.trim().eq_ignore_ascii_case("content-length") {
            v.trim().parse::<usize>().ok()
        } else {
            None
        }
    });

    let is_chunked = headers.lines().any(|line| {
        let lower = line.to_ascii_lowercase();
        lower.starts_with("transfer-encoding:") && lower.contains("chunked")
    });

    let body_start = header_end + 4;
    let body_bytes = if let Some(expected_len) = content_length {
        let mut body = Vec::with_capacity(expected_len);
        let already = &raw[body_start..];
        let take = already.len().min(expected_len);
        body.extend_from_slice(&already[..take]);
        if body.len() < expected_len {
            let cur = body.len();
            body.resize(expected_len, 0);
            stream.read_exact(&mut body[cur..])?;
        }
        body
    } else if is_chunked {
        let mut chunk_buf = raw[body_start..].to_vec();
        while !chunk_buf.windows(5).any(|w| w == b"0\r\n\r\n") {
            let n = stream.read(&mut tmp)?;
            if n == 0 {
                break;
            }
            chunk_buf.extend_from_slice(&tmp[..n]);
        }
        decode_chunked(&chunk_buf)?
    } else {
        let mut body = raw[body_start..].to_vec();
        let _ = stream.read_to_end(&mut body);
        body
    };

    let targets: Vec<CdpTarget> = serde_json::from_slice(&body_bytes)?;
    Ok(targets)
}

fn decode_chunked(mut data: &[u8]) -> Result<Vec<u8>> {
    let mut out = Vec::with_capacity(data.len());
    loop {
        let crlf = data
            .windows(2)
            .position(|w| w == b"\r\n")
            .ok_or("Invalid chunked encoding: missing chunk size CRLF")?;
        let size_str = std::str::from_utf8(&data[..crlf])?
            .split(';')
            .next()
            .unwrap_or("")
            .trim();
        let chunk_len = usize::from_str_radix(size_str, 16)?;
        data = &data[crlf + 2..];
        if chunk_len == 0 {
            break;
        }
        if data.len() < chunk_len + 2 {
            return Err("Invalid chunked encoding: truncated chunk".into());
        }
        out.extend_from_slice(&data[..chunk_len]);
        data = &data[chunk_len + 2..];
    }
    Ok(out)
}

pub fn filter_antigravity_pages(targets: Vec<CdpTarget>) -> Vec<CdpTarget> {
    targets
        .into_iter()
        .filter(|t| {
            if t.target_type != "page" || t.web_socket_debugger_url.is_empty() {
                return false;
            }
            if t.url.starts_with("devtools://") || t.url.starts_with("chrome-extension://") {
                return false;
            }
            t.url.contains("127.0.0.1")
                || t.url.contains("workbench")
                || t.url.contains("launchpad")
        })
        .collect()
}

pub fn connect_ws(ws_url: &str, read_timeout: Duration) -> Result<WsClient> {
    WsClient::connect(ws_url, read_timeout)
}

pub fn evaluate_once(
    ws_url: &str,
    expression: &str,
    return_by_value: bool,
    await_promise: bool,
    timeout: Duration,
) -> Result<Value> {
    let mut ws = connect_ws(ws_url, Duration::from_millis(250))?;
    let payload = json!({
        "id": 1,
        "method": "Runtime.evaluate",
        "params": {
            "expression": expression,
            "returnByValue": return_by_value,
            "awaitPromise": await_promise,
        }
    });
    ws.send_text(&payload.to_string())?;

    let deadline = Instant::now() + timeout;
    while Instant::now() < deadline {
        match ws.read_event()? {
            WsEvent::Text(txt) => {
                if let Ok(msg) = serde_json::from_str::<Value>(&txt) {
                    if msg.get("id").and_then(Value::as_u64) == Some(1) {
                        ws.close();
                        if let Some(err) = msg.get("error") {
                            let err_msg = err
                                .get("message")
                                .and_then(Value::as_str)
                                .unwrap_or("CDP error");
                            return Err(err_msg.into());
                        }
                        if let Some(ex) = msg.pointer("/result/exceptionDetails") {
                            let text = ex
                                .get("text")
                                .and_then(Value::as_str)
                                .unwrap_or("Runtime exception");
                            return Err(text.into());
                        }
                        return Ok(msg
                            .pointer("/result/result/value")
                            .cloned()
                            .unwrap_or(Value::Null));
                    }
                }
            }
            WsEvent::Ping(data) => {
                let _ = ws.send_pong(&data);
            }
            WsEvent::Close => break,
            WsEvent::Timeout | WsEvent::Binary(_) | WsEvent::Pong(_) => continue,
        }
    }

    ws.close();
    Err("CDP evaluation timeout".into())
}

pub fn verify_live() -> Result<VerifyOutcome> {
    let info = read_port_info().ok_or_else(|| {
        format!(
            "DevToolsActivePort not found at: {}",
            crate::paths::resolve_port_file().display()
        )
    })?;

    let targets = fetch_targets(info.port, Duration::from_millis(2500))?;
    let pages = filter_antigravity_pages(targets);
    if pages.is_empty() {
        return Err(format!(
            "No Antigravity CDP page targets found on port {}.",
            info.port
        )
        .into());
    }

    let mut results = Vec::with_capacity(pages.len());
    let mut themed_count = 0usize;
    let mut has_live_blur = false;

    for page in &pages {
        let mut report = evaluate_once(
            &page.web_socket_debugger_url,
            INSPECT_EXPR,
            true,
            true,
            Duration::from_secs(4),
        )?;
        let active = report
            .get("themeActive")
            .and_then(Value::as_bool)
            .unwrap_or(false);
        let live_blur = report
            .get("hasLiveBlurRule")
            .and_then(Value::as_bool)
            .unwrap_or(false);
        if active {
            themed_count += 1;
            if live_blur {
                has_live_blur = true;
            }
        }
        if let Some(obj) = report.as_object_mut() {
            obj.insert("id".into(), Value::String(page.id.clone()));
            obj.insert("title".into(), Value::String(page.title.clone()));
        }
        results.push(report);
    }

    Ok(VerifyOutcome {
        port: info.port,
        total_count: pages.len(),
        themed_count,
        has_live_blur,
        results,
    })
}

pub fn cleanup_open_pages() -> Result<usize> {
    let Some(info) = read_port_info() else {
        return Ok(0);
    };
    let targets = fetch_targets(info.port, Duration::from_millis(2000))?;
    let pages = filter_antigravity_pages(targets);
    let mut cleared = 0usize;
    for page in pages {
        if evaluate_once(
            &page.web_socket_debugger_url,
            REMOVE_THEME_EXPR,
            false,
            false,
            Duration::from_millis(2500),
        )
        .is_ok()
        {
            cleared += 1;
        }
    }
    Ok(cleared)
}
