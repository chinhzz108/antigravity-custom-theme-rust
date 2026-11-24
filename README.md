# Antigravity Custom Theme Engine — Rust Edition (`agy-theme`)

Bản viết lại hoàn toàn bằng **Rust thuần** từ [antigravity-custom-theme-skill](https://github.com/giakiet22102006/antigravity-custom-theme-skill) nhằm đạt **tốc độ biên dịch tức thì** và **tiết kiệm RAM tối đa** — loại bỏ hoàn toàn yêu cầu cài Node.js >= 22, Python 3.9+, Pillow, và `wscript.exe`/`silent-start.vbs`.

## So sánh hiệu năng & RAM (Đo thực tế trên Windows)

| Hạng mục | Bản gốc (Node.js + Python) | Bản Rust (`agy-theme`) |
| :--- | :--- | :--- |
| **Runtime yêu cầu** | Node.js >= 22 + Python 3.9+ + Pillow + `wscript.exe` | **Không cần runtime** (binary native độc lập) |
| **RAM daemon chạy ngầm (Idle / Active)** | ~45 – 75 MB (V8 heap) | **~1.0 MB Working Set (~0.8 MB Private RAM)** |
| **CPU / GPU daemon** | Cao hơn (V8 GC & event loop) | **0.00% CPU / 0.000% GPU** (3 threads) |
| **Thời gian build payload (5 theme + 2K WebP)** | ~300 – 800 ms (Python startup + Pillow) | **~4 ms** |
| **Kích thước binary release** | Node runtime (~80 MB+) | **`agy-theme-daemon.exe` 1.13 MB** / **`agy-theme.exe` 1.22 MB** |
| **Khởi chạy ngầm Windows** | `wscript.exe` + `silent-start.vbs` | **Windows Task Scheduler (`AntigravityCustomTheme`)** chạy trực tiếp `agy-theme-daemon.exe` (`windows_subsystem = "windows"`, tách biệt khỏi Antigravity, tắt/mở app không mất theme) |
| **Đồng bộ nhiều cửa sổ** | Re-inject lại toàn bộ payload (~700 KB+) | **Delta sync ~150 byte** qua `applyTheme(..., { skipSave: true })` |
| **CSS inject trong Electron** | Trùng chuỗi ảnh nền 2 lần (~1.38 MB) | **Gom biến `--agy-bg-layers` giảm 50% (~705 KB)**, 0 phần tử `backdrop-filter: blur()` live |
| **Quản lý script hot-reload** | Dễ tích tụ document script cũ | Tự dọn `Page.removeScriptToEvaluateOnNewDocument` trước khi nạp bản mới |

## Cải tiến tối ưu RAM & FPS thêm trong `engine/core.js`

Ngoài việc viết lại toàn bộ backend/CLI/daemon bằng Rust, `engine/core.js` (chạy bên trong DOM Electron) cũng đã được tối ưu sâu:

- **LRU Cache tối đa 4 mục + debounce 80ms cho `syncPrebakedGlass`**: Kéo thanh trượt Dim/Blur không còn tạo hàng chục canvas blur tồn đọng trong RAM; giải phóng bộ nhớ canvas ngay sau khi encode.
- **Debounce lưu config (200ms) + cờ `skipSave`**: Tránh spam ghi ổ cứng & gửi hàng chục sự kiện CDP mỗi giây khi kéo slider.
- **Tự động nén ảnh nền custom upload (max 2560px WebP)**: Không còn làm tràn `localStorage` hay phình to `theme_config.json` khi upload ảnh PNG 4K.
- **Cắt reflow layout khi AI đang stream**: `MutationObserver` chỉ tính lại `getBoundingClientRect()` khi kích thước đổi (`ResizeObserver`) hoặc trạng thái browser hole/side panel thay đổi, không ép layout reflow 60 lần/giây khi AI stream chữ.
- **Chống rò rỉ DOM listener**: Gắn listener `keydown` của modal với `AbortController.signal` để dọn sạch hoàn toàn khi hot-reload hoặc uninstall.

## Preset đi kèm sẵn (`themes/themes.json`)

1. **`WLOP Cosmic`** *(mặc định)* — Hình nền 2K starlight + SVG flourish + Unified L-Glass
2. **`Midnight Obsidian`** — Pure-CSS gradient tím/xanh siêu nhẹ (0 ảnh)
3. **`Cyber Neon Pulse`** — Pure-CSS cyberpunk cyan/magenta phát sáng (0 ảnh)
4. **`Ember Crimson`** — Pure-CSS obsidian ấm + cam/đỏ hổ phách (0 ảnh)
5. **`Kyoto Matcha Light`** — Chế độ **Light Glass (`isLight: true`)** ban ngày chữ đậm dễ đọc (0 ảnh)

## Hướng dẫn sử dụng nhanh

### 1. Biên dịch bản Release (chỉ cần chạy 1 lần)

```powershell
cargo build --release
```

Tạo ra 2 file thực thi siêu gọn:
- `target\release\agy-theme.exe` — Công cụ CLI đầy đủ
- `target\release\agy-theme-daemon.exe` — Daemon chạy ngầm không cửa sổ console

### 2. Cài đặt & chạy ngầm tự khởi động cùng Windows

```powershell
.\target\release\agy-theme.exe install
```
*(Hoặc dùng wrapper `powershell -ExecutionPolicy Bypass -File scripts\install-win.ps1`)*

Lệnh `install` sẽ tự động:
1. Build `dist\theme_payload.js` nếu chưa có.
2. Patch cờ `--remote-debugging-port=0` vào các shortcut `Antigravity.lnk` (Desktop, Start Menu, Startup, Taskbar) cho Antigravity v2.33.0+.
3. Đăng ký & khởi chạy ngay **Windows Scheduled Task (`AntigravityCustomTheme`)** chạy trực tiếp `agy-theme-daemon.exe` tách biệt khỏi vòng đời Antigravity (tự fallback sang Startup `.lnk` nếu không có quyền Task Scheduler; dùng `--no-startup` nếu chỉ muốn chạy phiên hiện tại).
4. Xác nhận PID + lượng RAM tiêu thụ của daemon.

> **Lưu ý cho Antigravity v2.33.0+:** Sau lần `install` đầu tiên (hoặc sau khi Antigravity tự cập nhật), hãy **Quit hẳn Antigravity từ System Tray** rồi mở lại từ **Start Menu** để tạo `DevToolsActivePort`. Nếu dùng icon ghim trên Taskbar, hãy Unpin rồi Pin lại từ Start Menu.

### 3. Các lệnh CLI hữu ích

```powershell
# Biên dịch lại payload sau khi sửa themes/themes.json (~4 ms, daemon tự hot-reload)
.\target\release\agy-theme.exe build

# Xem danh sách preset đang có
.\target\release\agy-theme.exe themes

# Kiểm tra trạng thái daemon, RAM thực tế & cổng CDP
.\target\release\agy-theme.exe status

# Kiểm tra trực tiếp trên cửa sổ Antigravity đang mở (Zero Live Blur, themeActive...)
.\target\release\agy-theme.exe verify

# Chạy daemon chế độ dev (tự rebuild + hot-reload mỗi khi sửa themes.json / core.js)
.\target\release\agy-theme.exe daemon --watch-themes

# Bật / tắt nhanh daemon ngầm
.\target\release\agy-theme.exe start
.\target\release\agy-theme.exe stop

# Gỡ cài đặt sạch sẽ & khôi phục giao diện mặc định
.\target\release\agy-theme.exe uninstall
```

### 4. macOS / Linux

```bash
cargo build --release
./target/release/agy-theme install
# hoặc: bash scripts/install-unix.sh
```

Có thể tuỳ chỉnh vị trí `DevToolsActivePort` bất cứ lúc nào bằng biến môi trường `AGY_PORT_FILE=/path/to/DevToolsActivePort`.

## Cấu trúc dự án

```text
custom anti/
├── Cargo.toml                  # Crate thuần Rust (không cần C compiler / MinGW PATH)
├── SKILL.md                    # Định nghĩa Antigravity Agent Skill bản Rust
├── README.md
├── LICENSE                     # MIT
├── references/
│   └── theme-schema.md         # Schema themes.json & ghi chú DOM
├── themes/
│   ├── themes.json             # 5 preset dark + light glass
│   └── assets/                 # Hình nền & SVG ornament
├── engine/
│   └── core.js                 # Engine CSS/DOM Zero Live Blur đã tối ưu RAM/FPS
├── src/
│   ├── lib.rs                  # Khai báo module & UTC timestamp zero-dep
│   ├── main.rs                 # CLI `agy-theme`
│   ├── bin/daemon.rs           # Daemon ẩn console `agy-theme-daemon`
│   ├── ws.rs                   # RFC 6455 WebSocket client thuần Rust (zero-dep, streaming mask 8 KB)
│   ├── cdp.rs                  # Local HTTP/1.1 + CDP evaluate / verify / cleanup
│   ├── builder.rs              # Trình biên dịch payload thuần Rust (EXIF, Lanczos3, WebP/JPEG, SVG)
│   ├── daemon.rs               # CDP daemon tiết kiệm RAM (on-demand read, delta sync, trim working set)
│   ├── installer.rs            # Cài đặt / gỡ bỏ Windows, macOS, Linux + patch shortcut CDP
│   ├── config.rs               # Ghi atomic theme_config.json & xoay vòng daemon.log
│   ├── paths.rs                # Tự nhận diện repo root & DevToolsActivePort đa nền tảng
│   └── sys.rs                  # Win32 / Unix PID, memory stats, detached spawn, working-set trim
├── scripts/
│   ├── install-win.ps1         # Wrapper PowerShell gọi `agy-theme install`
│   └── install-unix.sh         # Wrapper Bash gọi `agy-theme`
├── tests/
│   └── integration_tests.rs    # Unit & integration tests (RFC 6455, builder, raster resize, mock CDP)
└── dist/                       # Output đã biên dịch (`dist/theme_payload.js`, gitignored)
```

## License

MIT
