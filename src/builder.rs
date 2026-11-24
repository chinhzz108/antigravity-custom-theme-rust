use crate::config::atomic_write;
use crate::Result;
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use image::codecs::jpeg::JpegEncoder;
use image::imageops::FilterType;
use image::{DynamicImage, ImageDecoder, ImageFormat, ImageReader};
use serde_json::{Map, Value};
use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::time::Instant;

pub const ASSET_KEYS: [&str; 5] = [
    "wallpaper",
    "sticker",
    "cornerSvg",
    "userAvatar",
    "agentAvatar",
];
pub const AVATAR_KEYS: [&str; 2] = ["userAvatar", "agentAvatar"];
pub const AVATAR_MAX_DIM: u32 = 256;
pub const DEFAULT_MAX_DIM: u32 = 2560;
pub const PLACEHOLDER: &str = "/*__THEMES_PLACEHOLDER__*/{}";
const WEBP_PASSTHROUGH_MAX_BYTES: usize = 1_200_000;
const JPEG_QUALITY: u8 = 88;

#[derive(Debug, Clone)]
pub struct BuildOptions {
    pub themes_path: PathBuf,
    pub engine_path: PathBuf,
    pub out_path: PathBuf,
    pub max_dim: u32,
}

#[derive(Debug, Clone)]
pub struct BuildReport {
    pub out_path: PathBuf,
    pub size_bytes: usize,
    pub theme_names: Vec<String>,
    pub elapsed_ms: u128,
}

#[derive(Debug, Clone)]
pub struct ThemeSummary {
    pub name: String,
    pub concept: String,
    pub is_light: bool,
    pub has_wallpaper: bool,
    pub has_sticker: bool,
}

/// Percent-encodes UTF-8 SVG text matching Python `urllib.parse.quote` (`A-Za-z0-9_.-~/`).
pub fn percent_encode_svg(svg: &str) -> String {
    const HEX: &[u8; 16] = b"0123456789ABCDEF";
    let mut out = String::with_capacity(svg.len() + svg.len() / 2);
    out.push_str("data:image/svg+xml,");
    for &b in svg.as_bytes() {
        let is_safe = b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.' | b'~' | b'/');
        if is_safe {
            out.push(b as char);
        } else {
            out.push('%');
            out.push(HEX[(b >> 4) as usize] as char);
            out.push(HEX[(b & 0x0F) as usize] as char);
        }
    }
    out
}

fn encode_raster(img_path: &Path, max_dim: u32) -> Result<String> {
    let raw_bytes = fs::read(img_path)?;
    let ext = img_path
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| s.to_ascii_lowercase())
        .unwrap_or_default();

    let reader = ImageReader::new(Cursor::new(&raw_bytes)).with_guessed_format()?;
    let mut decoder = reader.into_decoder()?;
    let orientation = decoder.orientation().ok();
    let (raw_w, raw_h) = decoder.dimensions();
    let longest_raw = raw_w.max(raw_h);

    // Preserve already-compressed WebP files untouched when within dimension & byte budget.
    if ext == "webp"
        && (max_dim == 0 || longest_raw <= max_dim)
        && raw_bytes.len() <= WEBP_PASSTHROUGH_MAX_BYTES
    {
        return Ok(format!(
            "data:image/webp;base64,{}",
            BASE64.encode(&raw_bytes)
        ));
    }

    let mut img = DynamicImage::from_decoder(decoder)?;
    if let Some(orient) = orientation {
        img.apply_orientation(orient);
    }

    let (w, h) = (img.width(), img.height());
    let longest = w.max(h);
    if max_dim > 0 && longest > max_dim {
        let scale = (max_dim as f64) / (longest as f64);
        let nw = ((w as f64) * scale).round().max(1.0) as u32;
        let nh = ((h as f64) * scale).round().max(1.0) as u32;
        img = img.resize_exact(nw, nh, FilterType::Lanczos3);
    }

    let has_alpha = img.color().has_alpha();
    if has_alpha {
        // Encode alpha assets as pure-Rust lossless WebP (fall back to PNG if smaller).
        let mut webp_buf = Cursor::new(Vec::new());
        let webp_ok = img.write_to(&mut webp_buf, ImageFormat::WebP).is_ok();
        let webp_bytes = webp_buf.into_inner();

        let mut png_buf = Cursor::new(Vec::new());
        img.write_to(&mut png_buf, ImageFormat::Png)?;
        let png_bytes = png_buf.into_inner();

        if webp_ok && !webp_bytes.is_empty() && webp_bytes.len() <= png_bytes.len() {
            Ok(format!(
                "data:image/webp;base64,{}",
                BASE64.encode(&webp_bytes)
            ))
        } else {
            Ok(format!(
                "data:image/png;base64,{}",
                BASE64.encode(&png_bytes)
            ))
        }
    } else {
        // Opaque wallpapers/avatars: compact quality-88 JPEG keeps 2K images ~200-400 KB in pure Rust.
        let rgb = img.to_rgb8();
        let mut jpeg_buf = Vec::with_capacity(64 * 1024);
        let mut enc = JpegEncoder::new_with_quality(&mut jpeg_buf, JPEG_QUALITY);
        enc.encode_image(&rgb)?;

        // If the original file wasn't resized and was already smaller (e.g. an optimized JPEG/WebP), keep it.
        if (max_dim == 0 || longest <= max_dim) && raw_bytes.len() < jpeg_buf.len() {
            let mime = match ext.as_str() {
                "webp" => "image/webp",
                "jpg" | "jpeg" => "image/jpeg",
                "png" => "image/png",
                "gif" => "image/gif",
                _ => "image/jpeg",
            };
            return Ok(format!("data:{mime};base64,{}", BASE64.encode(&raw_bytes)));
        }

        Ok(format!(
            "data:image/jpeg;base64,{}",
            BASE64.encode(&jpeg_buf)
        ))
    }
}

fn resolve_asset_value(value: &Value, themes_dir: &Path, max_dim: u32) -> Result<Value> {
    let Some(s) = value.as_str() else {
        return Ok(value.clone());
    };
    let trimmed = s.trim();
    if trimmed.is_empty()
        || trimmed.starts_with("data:")
        || trimmed.starts_with("http://")
        || trimmed.starts_with("https://")
    {
        return Ok(Value::String(trimmed.to_string()));
    }

    let raw_path = Path::new(trimmed);
    let asset_path = if raw_path.is_absolute() {
        raw_path.to_path_buf()
    } else {
        themes_dir.join(raw_path)
    };
    if !asset_path.is_file() {
        return Err(format!(
            "Theme asset not found: {} (resolved: {})",
            trimmed,
            asset_path.display()
        )
        .into());
    }

    let ext = asset_path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .unwrap_or_default();

    let encoded = if ext == "svg" {
        let svg_text = fs::read_to_string(&asset_path)?;
        percent_encode_svg(&svg_text)
    } else {
        encode_raster(&asset_path, max_dim)?
    };
    Ok(Value::String(encoded))
}

pub fn build_payload(opts: &BuildOptions) -> Result<BuildReport> {
    let started = Instant::now();

    if !opts.themes_path.is_file() {
        return Err(format!("themes.json not found: {}", opts.themes_path.display()).into());
    }
    if !opts.engine_path.is_file() {
        return Err(format!("core.js not found: {}", opts.engine_path.display()).into());
    }

    let themes_text = fs::read_to_string(&opts.themes_path)?;
    let parsed: Value = serde_json::from_str(&themes_text)?;
    let themes_map = parsed
        .as_object()
        .filter(|m| !m.is_empty())
        .ok_or("themes.json must be a non-empty JSON object keyed by theme name.")?;

    let themes_dir = opts.themes_path.parent().unwrap_or_else(|| Path::new("."));
    let mut resolved_themes = Map::with_capacity(themes_map.len());
    let mut theme_names = Vec::with_capacity(themes_map.len());

    for (name, cfg_val) in themes_map {
        let cfg_obj = cfg_val
            .as_object()
            .ok_or_else(|| format!("Theme '{name}' must be a JSON object."))?;
        let mut copied = cfg_obj.clone();
        for key in ASSET_KEYS {
            if let Some(val) = copied.get(key) {
                let target_dim = if AVATAR_KEYS.contains(&key) {
                    if opts.max_dim == 0 {
                        AVATAR_MAX_DIM
                    } else {
                        opts.max_dim.min(AVATAR_MAX_DIM)
                    }
                } else {
                    opts.max_dim
                };
                let resolved = resolve_asset_value(val, themes_dir, target_dim)?;
                copied.insert(key.to_string(), resolved);
            }
        }
        theme_names.push(name.clone());
        resolved_themes.insert(name.clone(), Value::Object(copied));
    }

    let engine_src = fs::read_to_string(&opts.engine_path)?;
    let matches = engine_src.matches(PLACEHOLDER).count();
    if matches != 1 {
        return Err(format!(
            "Expected exactly 1 '{PLACEHOLDER}' placeholder in {}, found {matches}.",
            opts.engine_path.display()
        )
        .into());
    }

    let themes_json = serde_json::to_string(&Value::Object(resolved_themes))?;
    let compiled = engine_src.replacen(PLACEHOLDER, &themes_json, 1);
    let size_bytes = compiled.len();

    atomic_write(&opts.out_path, compiled.as_bytes())?;

    Ok(BuildReport {
        out_path: opts.out_path.clone(),
        size_bytes,
        theme_names,
        elapsed_ms: started.elapsed().as_millis(),
    })
}

pub fn list_themes(themes_path: &Path) -> Result<Vec<ThemeSummary>> {
    let text = fs::read_to_string(themes_path)?;
    let parsed: Value = serde_json::from_str(&text)?;
    let map = parsed
        .as_object()
        .ok_or("themes.json must be a JSON object.")?;
    let mut out = Vec::with_capacity(map.len());
    for (name, val) in map {
        let obj = val.as_object();
        let concept = obj
            .and_then(|o| o.get("concept"))
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        let is_light = obj
            .and_then(|o| o.get("isLight"))
            .and_then(Value::as_bool)
            .unwrap_or(false);
        let has_wallpaper = obj
            .and_then(|o| o.get("wallpaper"))
            .and_then(Value::as_str)
            .map(|s| !s.trim().is_empty())
            .unwrap_or(false);
        let has_sticker = obj
            .and_then(|o| o.get("sticker"))
            .and_then(Value::as_str)
            .map(|s| !s.trim().is_empty())
            .unwrap_or(false);
        out.push(ThemeSummary {
            name: name.clone(),
            concept,
            is_light,
            has_wallpaper,
            has_sticker,
        });
    }
    Ok(out)
}
