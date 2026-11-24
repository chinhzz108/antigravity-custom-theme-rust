#![cfg_attr(windows, windows_subsystem = "windows")]

use agy_theme::daemon::{run, DaemonOptions};
use agy_theme::paths::AppPaths;
use std::env;
use std::path::PathBuf;

fn main() {
    let args: Vec<String> = env::args().skip(1).collect();
    let mut explicit_root: Option<PathBuf> = None;
    let mut watch_themes = false;
    let mut i = 0;
    while i < args.len() {
        match args[i].as_str() {
            "--root" => {
                if let Some(v) = args.get(i + 1) {
                    explicit_root = Some(PathBuf::from(v));
                    i += 1;
                }
            }
            "--watch-themes" => watch_themes = true,
            _ => {}
        }
        i += 1;
    }

    let paths = AppPaths::discover(explicit_root.as_deref());
    let echo_stdout = env::var("AGY_DAEMON_STDOUT").as_deref() == Ok("1");
    let _ = run(DaemonOptions {
        paths,
        echo_stdout,
        watch_themes,
    });
}
