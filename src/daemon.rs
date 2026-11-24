use crate::builder::{build_payload, BuildOptions, DEFAULT_MAX_DIM};
use crate::cdp::{connect_ws, fetch_targets, filter_antigravity_pages, CdpTarget};
use crate::config::{append_log, read_config, save_config_merge};
use crate::paths::{read_port_info, resolve_port_file, AppPaths};
use crate::sys::{is_pid_alive, register_shutdown_flag, trim_working_set};
use crate::ws::{WsClient, WsEvent};
use crate::Result;
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Receiver, Sender, TryRecvError};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant, SystemTime};

static SHUTDOWN: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Clone)]
pub struct DaemonOptions {
    pub paths: AppPaths,
    pub echo_stdout: bool,
    pub watch_themes: bool,
}

enum SessionCmd {
    Reinject,
    SyncConfig(String),
    Close,
}

type SessionMap = Arc<Mutex<HashMap<String, Sender<SessionCmd>>>>;

struct PidGuard {
    pid_file: std::path::PathBuf,
    pid: u32,
}

impl Drop for PidGuard {
    fn drop(&mut self) {
        if let Ok(raw) = fs::read_to_string(&self.pid_file) {
            if raw.trim().parse::<u32>().ok() == Some(self.pid) {
                let _ = fs::remove_file(&self.pid_file);
            }
        }
    }
}

fn acquire_pid_lock(paths: &AppPaths, echo_stdout: bool) -> Result<Option<PidGuard>> {
    let my_pid = std::process::id();
    if let Ok(raw) = fs::read_to_string(&paths.pid_file) {
        if let Ok(existing_pid) = raw.trim().parse::<u32>() {
            if existing_pid != 0 && existing_pid != my_pid && is_pid_alive(existing_pid) {
                append_log(
                    &paths.log_file,
                    &format!(
                        "Another daemon instance is already running (PID {existing_pid}). Exiting."
                    ),
                    echo_stdout,
                );
                return Ok(None);
            }
        }
    }
    fs::write(&paths.pid_file, my_pid.to_string())?;
    Ok(Some(PidGuard {
        pid_file: paths.pid_file.clone(),
        pid: my_pid,
    }))
}

fn file_stamp(path: &Path) -> Option<(SystemTime, u64)> {
    let meta = fs::metadata(path).ok()?;
    let modified = meta.modified().ok()?;
    Some((modified, meta.len()))
}

/// Reads config + dist/theme_payload.js on-demand so large wallpaper strings are never held in idle RAM.
fn build_injected_source(paths: &AppPaths, missing_logged: &AtomicBool, echo_stdout: bool) -> Option<String> {
    if !paths.payload_js.is_file() {
        if !missing_logged.swap(true, Ordering::Relaxed) {
            append_log(
                &paths.log_file,
                &format!(
                    "Payload not built yet ({}). Run: agy-theme build",
                    paths.payload_js.display()
                ),
                echo_stdout,
            );
        }
        return None;
    }
    missing_logged.store(false, Ordering::Relaxed);

    let cfg = read_config(&paths.config_json);
    let cfg_json = serde_json::to_string(&Value::Object(cfg)).unwrap_or_else(|_| "{}".into());
    let payload_code = match fs::read_to_string(&paths.payload_js) {
        Ok(s) => s,
        Err(e) => {
            append_log(
                &paths.log_file,
                &format!("Failed reading payload: {e}"),
                echo_stdout,
            );
            return None;
        }
    };

    let mut out = String::with_capacity(cfg_json.len() + payload_code.len() + 40);
    out.push_str("window.__AGY_INITIAL_CONFIG__ = ");
    out.push_str(&cfg_json);
    out.push_str(";\n");
    out.push_str(&payload_code);
    Some(out)
}

fn spawn_session(
    target: CdpTarget,
    paths: Arc<AppPaths>,
    sessions: SessionMap,
    missing_logged: Arc<AtomicBool>,
    echo_stdout: bool,
) {
    let (tx, rx) = mpsc::channel::<SessionCmd>();
    let target_id = target.id.clone();

    {
        let mut map = sessions.lock().unwrap();
        if map.contains_key(&target_id) {
            return;
        }
        map.insert(target_id.clone(), tx);
    }

    let thread_name = format!("cdp-{}", &target_id[..target_id.len().min(8)]);
    let builder = thread::Builder::new()
        .name(thread_name)
        .stack_size(256 * 1024);

    let sessions_cleanup = Arc::clone(&sessions);
    let id_cleanup = target_id.clone();
    let res = builder.spawn(move || {
        run_session_loop(target, rx, &paths, &sessions, &missing_logged, echo_stdout);
        sessions.lock().unwrap().remove(&target_id);
        trim_working_set();
    });

    if res.is_err() {
        sessions_cleanup.lock().unwrap().remove(&id_cleanup);
    }
}

fn run_session_loop(
    target: CdpTarget,
    rx: Receiver<SessionCmd>,
    paths: &AppPaths,
    sessions: &SessionMap,
    missing_logged: &AtomicBool,
    echo_stdout: bool,
) {
    let mut ws = match connect_ws(&target.web_socket_debugger_url, Duration::from_millis(200)) {
        Ok(ws) => ws,
        Err(e) => {
            append_log(
                &paths.log_file,
                &format!("Attach error for {}: {e}", target.id),
                echo_stdout,
            );
            return;
        }
    };

    let mut next_id: u64 = 1;
    let mut doc_script_id: Option<String> = None;
    let mut pending_doc_script_call_id: Option<u64> = None;

    let send_cdp = |ws: &mut WsClient,
                    next_id: &mut u64,
                    method: &str,
                    params: Value|
     -> Result<u64> {
        let id = *next_id;
        *next_id += 1;
        let msg = json!({ "id": id, "method": method, "params": params }).to_string();
        ws.send_text(&msg)?;
        Ok(id)
    };

    let inject_full = |ws: &mut WsClient,
                       next_id: &mut u64,
                       doc_script_id: &mut Option<String>,
                       pending_doc_script_call_id: &mut Option<u64>|
     -> Result<()> {
        let Some(src) = build_injected_source(paths, missing_logged, echo_stdout) else {
            return Ok(());
        };
        if let Some(old_id) = doc_script_id.take() {
            let _ = send_cdp(
                ws,
                next_id,
                "Page.removeScriptToEvaluateOnNewDocument",
                json!({ "identifier": old_id }),
            );
        }
        let reg_id = send_cdp(
            ws,
            next_id,
            "Page.addScriptToEvaluateOnNewDocument",
            json!({ "source": &src }),
        )?;
        *pending_doc_script_call_id = Some(reg_id);

        send_cdp(
            ws,
            next_id,
            "Runtime.evaluate",
            json!({ "expression": &src, "awaitPromise": false }),
        )?;
        drop(src);
        trim_working_set();
        Ok(())
    };

    if send_cdp(&mut ws, &mut next_id, "Page.enable", json!({})).is_err()
        || send_cdp(&mut ws, &mut next_id, "Runtime.enable", json!({})).is_err()
    {
        return;
    }
    let _ = send_cdp(
        &mut ws,
        &mut next_id,
        "Runtime.addBinding",
        json!({ "name": "agySaveThemeConfig" }),
    );
    if let Err(e) = inject_full(
        &mut ws,
        &mut next_id,
        &mut doc_script_id,
        &mut pending_doc_script_call_id,
    ) {
        append_log(
            &paths.log_file,
            &format!("Initial inject error for {}: {e}", target.id),
            echo_stdout,
        );
        return;
    }

    append_log(
        &paths.log_file,
        &format!("Attached target {} ({})", target.id, target.url),
        echo_stdout,
    );

    while !SHUTDOWN.load(Ordering::Relaxed) {
        loop {
            match rx.try_recv() {
                Ok(SessionCmd::Reinject) => {
                    if inject_full(
                        &mut ws,
                        &mut next_id,
                        &mut doc_script_id,
                        &mut pending_doc_script_call_id,
                    )
                    .is_err()
                    {
                        return;
                    }
                }
                Ok(SessionCmd::SyncConfig(cfg_json)) => {
                    // Lightweight cross-window delta sync (avoids re-sending full wallpaper payload!).
                    let expr = format!(
                        "window.__AGY_INITIAL_CONFIG__ = {cfg_json}; if (window.__ANTIGRAVITY_APPLY_CUSTOM_THEME__) {{ window.__ANTIGRAVITY_APPLY_CUSTOM_THEME__({cfg_json}, {{ skipSave: true }}); }}"
                    );
                    if send_cdp(
                        &mut ws,
                        &mut next_id,
                        "Runtime.evaluate",
                        json!({ "expression": expr, "awaitPromise": false }),
                    )
                    .is_err()
                    {
                        return;
                    }
                }
                Ok(SessionCmd::Close) | Err(TryRecvError::Disconnected) => {
                    ws.close();
                    return;
                }
                Err(TryRecvError::Empty) => break,
            }
        }

        match ws.read_event() {
            Ok(WsEvent::Text(txt)) => {
                let Ok(msg) = serde_json::from_str::<Value>(&txt) else {
                    continue;
                };

                if let Some(id) = msg.get("id").and_then(Value::as_u64) {
                    if pending_doc_script_call_id == Some(id) {
                        pending_doc_script_call_id = None;
                        if let Some(ident) = msg.pointer("/result/identifier").and_then(Value::as_str)
                        {
                            doc_script_id = Some(ident.to_string());
                        }
                    }
                    continue;
                }

                let method = msg.get("method").and_then(Value::as_str).unwrap_or("");
                if method == "Runtime.bindingCalled"
                    && msg.pointer("/params/name").and_then(Value::as_str)
                        == Some("agySaveThemeConfig")
                {
                    let raw_payload = msg
                        .pointer("/params/payload")
                        .and_then(Value::as_str)
                        .unwrap_or("{}");
                    match serde_json::from_str::<Value>(raw_payload) {
                        Ok(Value::Object(incoming)) => {
                            match save_config_merge(&paths.config_json, &incoming) {
                                Ok(merged) => {
                                    if let Ok(cfg_json) =
                                        serde_json::to_string(&Value::Object(merged))
                                    {
                                        let map = sessions.lock().unwrap();
                                        for (other_id, other_tx) in map.iter() {
                                            if other_id != &target.id {
                                                let _ = other_tx
                                                    .send(SessionCmd::SyncConfig(cfg_json.clone()));
                                            }
                                        }
                                    }
                                    trim_working_set();
                                }
                                Err(e) => append_log(
                                    &paths.log_file,
                                    &format!("Failed saving theme_config.json: {e}"),
                                    echo_stdout,
                                ),
                            }
                        }
                        Ok(_) => {}
                        Err(e) => append_log(
                            &paths.log_file,
                            &format!("Config binding JSON error: {e}"),
                            echo_stdout,
                        ),
                    }
                } else if method == "Page.frameNavigated" {
                    let is_top_frame = msg.pointer("/params/frame").is_some()
                        && msg
                            .pointer("/params/frame/parentId")
                            .map(Value::is_null)
                            .unwrap_or(true);
                    if is_top_frame {
                        if inject_full(
                            &mut ws,
                            &mut next_id,
                            &mut doc_script_id,
                            &mut pending_doc_script_call_id,
                        )
                        .is_err()
                        {
                            return;
                        }
                    }
                }
            }
            Ok(WsEvent::Ping(data)) => {
                if ws.send_pong(&data).is_err() {
                    return;
                }
            }
            Ok(WsEvent::Close) => return,
            Ok(WsEvent::Timeout | WsEvent::Binary(_) | WsEvent::Pong(_)) => continue,
            Err(_) => return,
        }
    }

    ws.close();
}

fn close_all_sessions(sessions: &SessionMap) {
    let mut map = sessions.lock().unwrap();
    for (_id, tx) in map.drain() {
        let _ = tx.send(SessionCmd::Close);
    }
}

pub fn run(opts: DaemonOptions) -> Result<()> {
    SHUTDOWN.store(false, Ordering::SeqCst);
    register_shutdown_flag(&SHUTDOWN);

    let Some(_pid_guard) = acquire_pid_lock(&opts.paths, opts.echo_stdout)? else {
        return Ok(());
    };

    let paths = Arc::new(opts.paths);
    let sessions: SessionMap = Arc::new(Mutex::new(HashMap::new()));
    let missing_logged = Arc::new(AtomicBool::new(false));

    append_log(
        &paths.log_file,
        &format!(
            "Rust theme daemon started (PID {}, os={}, portFile={}, watchThemes={}).",
            std::process::id(),
            std::env::consts::OS,
            resolve_port_file().display(),
            opts.watch_themes
        ),
        opts.echo_stdout,
    );

    let mut last_port: Option<u16> = None;
    let mut last_payload_stamp = file_stamp(&paths.payload_js);
    let mut last_themes_stamp = file_stamp(&paths.themes_json);
    let mut last_engine_stamp = file_stamp(&paths.engine_js);
    let mut last_scan = Instant::now() - Duration::from_secs(10);

    // Trim initial startup pages immediately so idle RAM starts minimal.
    trim_working_set();

    while !SHUTDOWN.load(Ordering::Relaxed) {
        // Optional live auto-rebuild when themes/themes.json or engine/core.js changes.
        if opts.watch_themes {
            let cur_themes = file_stamp(&paths.themes_json);
            let cur_engine = file_stamp(&paths.engine_js);
            if cur_themes != last_themes_stamp || cur_engine != last_engine_stamp {
                last_themes_stamp = cur_themes;
                last_engine_stamp = cur_engine;
                thread::sleep(Duration::from_millis(120));
                let build_opts = BuildOptions {
                    themes_path: paths.themes_json.clone(),
                    engine_path: paths.engine_js.clone(),
                    out_path: paths.payload_js.clone(),
                    max_dim: DEFAULT_MAX_DIM,
                };
                match build_payload(&build_opts) {
                    Ok(rep) => append_log(
                        &paths.log_file,
                        &format!(
                            "Auto-rebuilt payload ({:.1} KB in {} ms).",
                            rep.size_bytes as f64 / 1024.0,
                            rep.elapsed_ms
                        ),
                        opts.echo_stdout,
                    ),
                    Err(e) => append_log(
                        &paths.log_file,
                        &format!("Auto-rebuild failed: {e}"),
                        opts.echo_stdout,
                    ),
                }
            }
        }

        // Zero-overhead mtime/size check for dist/theme_payload.js hot-reload.
        let cur_payload = file_stamp(&paths.payload_js);
        if cur_payload.is_some() && cur_payload != last_payload_stamp {
            // Brief settle wait so external writers finish flushing.
            thread::sleep(Duration::from_millis(150));
            last_payload_stamp = file_stamp(&paths.payload_js);
            append_log(
                &paths.log_file,
                "Detected dist/theme_payload.js update; hot-reloading attached pages.",
                opts.echo_stdout,
            );
            let map = sessions.lock().unwrap();
            for tx in map.values() {
                let _ = tx.send(SessionCmd::Reinject);
            }
        }

        // Adaptive scan cadence: 1.5s when Antigravity is reachable, 2.5s when idle/closed.
        let scan_interval = if last_port.is_some() {
            Duration::from_millis(1500)
        } else {
            Duration::from_millis(2500)
        };

        if last_scan.elapsed() >= scan_interval {
            last_scan = Instant::now();
            match read_port_info() {
                Some(info) => {
                    if last_port.is_some() && last_port != Some(info.port) {
                        close_all_sessions(&sessions);
                    }
                    last_port = Some(info.port);

                    if let Ok(targets) = fetch_targets(info.port, Duration::from_millis(1500)) {
                        let pages = filter_antigravity_pages(targets);
                        let live_ids: HashSet<String> =
                            pages.iter().map(|p| p.id.clone()).collect();

                        {
                            let mut map = sessions.lock().unwrap();
                            let stale: Vec<String> = map
                                .keys()
                                .filter(|id| !live_ids.contains(*id))
                                .cloned()
                                .collect();
                            for id in stale {
                                if let Some(tx) = map.remove(&id) {
                                    let _ = tx.send(SessionCmd::Close);
                                }
                            }
                        }

                        for page in pages {
                            let already = sessions.lock().unwrap().contains_key(&page.id);
                            if !already {
                                spawn_session(
                                    page,
                                    Arc::clone(&paths),
                                    Arc::clone(&sessions),
                                    Arc::clone(&missing_logged),
                                    opts.echo_stdout,
                                );
                            }
                        }
                    }
                }
                None => {
                    if last_port.is_some() {
                        close_all_sessions(&sessions);
                        last_port = None;
                        trim_working_set();
                    }
                }
            }
        }

        thread::sleep(Duration::from_millis(150));
    }

    append_log(&paths.log_file, "Shutting down daemon cleanly.", opts.echo_stdout);
    close_all_sessions(&sessions);
    thread::sleep(Duration::from_millis(120));
    Ok(())
}
