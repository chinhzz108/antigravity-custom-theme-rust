---
name: antigravity-custom-theme
description: Use when the user wants to design, customize, install, update, or troubleshoot an Antigravity IDE or Manager visual theme from a wallpaper image, color palette, aesthetic mood, or preset using the ultra-fast Rust theme engine.
---

# Antigravity Custom Theme Skill (Rust Edition)

Creates and applies custom glassmorphic themes (wallpapers, cohesive palettes, custom composer ornaments, pre-baked glass panels, and split-browser-safe overlays) to Antigravity without modifying Electron app binaries — powered by a pure-Rust CLI & background daemon (~1.5 MB RAM idle, zero Node.js, zero Python).

## Repository Layout

- `themes/themes.json` — Theme presets (colors, wallpaper path, SVG ornaments, glass alpha/saturation defaults). Key order is preserved; the first entry is the default fallback.
- `themes/assets/` — Raster wallpapers (`.webp`/`.png`/`.jpg`) and SVG stickers/corner flourishes.
- `engine/core.js` — Optimized standalone DOM + CSS injection engine (Zero Live Blur, LRU-capped pre-baked canvas glass, debounced persistence, split-browser hole cutout, live theme settings modal).
- `src/` — Pure-Rust workspace compiling two compact native binaries:
  - `target/release/agy-theme` — CLI (`build`, `daemon`, `start`, `stop`, `status`, `install`, `uninstall`, `verify`, `themes`).
  - `target/release/agy-theme-daemon` — Silent background CDP daemon (`windows_subsystem = "windows"` on Windows — zero console window, zero `.vbs`/`wscript.exe`).
- `references/theme-schema.md` — Exact `themes.json` schema, contrast rules, and Antigravity selector notes.

## Workflow

1. **Gather aesthetic & inspect image**
   - Ask briefly for any missing intent only if ambiguous (mood: cozy warm, cyberpunk neon, anime cel, cosmic gold, minimalist pure-CSS gradient, light/dark glass, etc.).
   - If the user provides an image with an unwanted corner watermark/signature, clean/crop it cleanly before staging.
2. **Design cohesive tokens (Dark or Light Glass)**
   - Read `references/theme-schema.md` for every `themes.json` key.
   - Extract dominant & accent colors from the image to populate `primary`, `secondary`, `overlayRgb`, `bg`, `frameBg`, `sidebarBg`, `aiCardBg`, `headerBg`, `inputCardBg`, and `modalBg` with crisp readable contrast.
   - For bright/daytime/pastel wallpapers, set `"isLight": true` with high-contrast dark ink (`uiTextColor`, `pillTextColor`) and light frosted `aiCardBg`/`overlayRgb`.
   - Optionally craft square `userAvatar` & `agentAvatar` assets and custom `sticker`/`cornerSvg` flourishes under `themes/assets/`.
3. **Stage assets & edit `themes/themes.json`**
   - Save wallpaper under `themes/assets/<slug>.webp` (or `.png`/`.jpg`) and optional SVGs/avatars under `themes/assets/`.
   - Add a new entry in `themes/themes.json` referencing `"assets/<filename>"`.
   - Never hardcode personal OS paths (`C:\Users\...`, `/Users/...`, `/home/...`) in JSON, JS, or scripts.
4. **Compile payload (Native Rust — ~4 ms)**
   - If binaries aren't built yet: `cargo build --release`
   - Compile payload: `./target/release/agy-theme build` (Windows: `.\target\release\agy-theme.exe build`)
   - List & validate themes: `./target/release/agy-theme themes`
5. **Run / hot-reload daemon**
   - **Install + auto-start:** `.\target\release\agy-theme.exe install` (or `.\scripts\install-win.ps1` / `bash scripts/install-unix.sh`)
   - **Session only (no startup registration):** `.\target\release\agy-theme.exe install --no-startup` (or `agy-theme start`)
   - **Live theme authoring mode:** pass `--watch-themes` so editing `themes/themes.json` auto-rebuilds `dist/theme_payload.js` and hot-reloads Antigravity automatically.
   - If the daemon is already running, rebuilding `dist/theme_payload.js` triggers automatic hot-reload within ~150 ms.
6. **Verify live via CDP**
   - Run `.\target\release\agy-theme.exe verify` while Antigravity is open.
   - Confirm `themeActive: true`, `hasLiveBlurRule: false`, valid `.agy-shell` background, and readable composer pills before reporting success.
   - Check daemon health & RAM: `.\target\release\agy-theme.exe status`

## Non-Negotiable Architecture Rules

- **Zero Live Blur:** Never add CSS `backdrop-filter: blur(...)` to `.agy-shell`, `.agy-chat-frame`, or scrollable panes — Electron scrolling drops frames badly under live blur. `engine/core.js` pre-bakes blurred canvas textures (`syncPrebakedGlass`) instead.
- **Data-Only Theme Authoring:** Add themes in `themes/themes.json` + `themes/assets/`. Leave `engine/core.js` untouched unless Antigravity changes its upstream DOM selectors.
- **Split Browser Cutout:** Never paint opaque overlays over the right-side browser pane; keep `data-has-browser-hole` + `evenodd` `clip-path` behavior intact so embedded Chromium views stay sharp.
- **No Personal Data Leakage:** Check modified files for absolute user paths or personal `theme_config.json` state before committing.

## Troubleshooting: Theme Disappeared After Antigravity Update

Antigravity v2.33.0+ no longer opens `DevToolsActivePort` by default when launched without `--remote-debugging-port=0`, and its auto-updater relaunches `Antigravity.exe --updated` directly (which can also reset shortcuts).

- **Windows:**
  1. Re-run `.\target\release\agy-theme.exe install` — it automatically patches `--remote-debugging-port=0` onto `Antigravity.lnk` shortcuts (Desktop, Start Menu, Startup, Taskbar).
  2. **Quit Antigravity completely** (System Tray -> Quit, not just closing the window) and reopen from **Start Menu**.
  3. If you launch from a **Taskbar pin**, unpin the old icon and re-pin it from the Start Menu `Antigravity` shortcut.
- **macOS / Linux:**
  - Launch Antigravity with `--remote-debugging-port=0` (`open -a Antigravity --args --remote-debugging-port=0` on macOS, or append `--remote-debugging-port=0` to `Exec=` in your `.desktop` launcher on Linux).
