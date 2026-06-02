use std::fs;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};
// Tray + menu are desktop-only; imported inside the `#[cfg(desktop)]` setup block.

// ── Double-click detection ────────────────────────────────────────────────────
fn last_click() -> &'static Mutex<Option<Instant>> {
    static CELL: OnceLock<Mutex<Option<Instant>>> = OnceLock::new();
    CELL.get_or_init(|| Mutex::new(None))
}

fn is_double_click() -> bool {
    let mut guard = last_click().lock().unwrap();
    let now = Instant::now();
    let double = guard.map_or(false, |t| now.duration_since(t) < Duration::from_millis(450));
    *guard = Some(now);
    double
}

// ── Commands ──────────────────────────────────────────────────────────────────
#[tauri::command]
fn sync_data(app: AppHandle, data: serde_json::Value) -> Result<(), String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(&data).map_err(|e| e.to_string())?;
    fs::write(dir.join("mcp-data.json"), json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn read_commands(app: AppHandle) -> Result<String, String> {
    let path = app.path().app_data_dir().map_err(|e| e.to_string())?.join("mcp-commands.json");
    if !path.exists() {
        return Ok("[]".to_string());
    }
    fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn clear_commands(app: AppHandle) -> Result<(), String> {
    let path = app.path().app_data_dir().map_err(|e| e.to_string())?.join("mcp-commands.json");
    fs::write(path, "[]").map_err(|e| e.to_string())
}

#[tauri::command]
fn get_data_dir(app: AppHandle) -> Result<String, String> {
    app.path().app_data_dir()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[allow(unused_variables)]
fn hide_to_tray(app: AppHandle) {
    #[cfg(desktop)]
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

/// Update the tray bar display.
/// `title`      – timer text, e.g. "01:23 اسم المهمة"
/// `is_running` – true → green indicator, false → red indicator
#[tauri::command]
#[allow(unused_variables)]
fn update_tray_state(app: AppHandle, title: String, is_running: bool) {
    #[cfg(desktop)]
    if let Some(tray) = app.tray_by_id("heed-tray") {
        let indicator = if is_running { "🟢" } else { "🔴" };
        let label = if title.is_empty() {
            "⏱".to_string()
        } else {
            format!("{} {}", indicator, title)
        };
        let _ = tray.set_title(Some(&label));
    }
}

/// Legacy – kept so existing callers don't break during transition.
#[tauri::command]
#[allow(unused_variables)]
fn update_tray_title(app: AppHandle, title: String) {
    #[cfg(desktop)]
    if let Some(tray) = app.tray_by_id("heed-tray") {
        let _ = tray.set_title(Some(&title));
    }
}

// ── Google OAuth callback listener ───────────────────────────────────────────

fn is_oauth_listening() -> &'static AtomicBool {
    static CELL: OnceLock<AtomicBool> = OnceLock::new();
    CELL.get_or_init(|| AtomicBool::new(false))
}

fn url_decode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let bytes = s.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let (Ok(hi), Ok(lo)) = (
                std::str::from_utf8(&bytes[i + 1..i + 2]),
                std::str::from_utf8(&bytes[i + 2..i + 3]),
            ) {
                if let Ok(byte) = u8::from_str_radix(&format!("{}{}", hi, lo), 16) {
                    out.push(byte as char);
                    i += 3;
                    continue;
                }
            }
        } else if bytes[i] == b'+' {
            out.push(' ');
        } else {
            out.push(bytes[i] as char);
        }
        i += 1;
    }
    out
}

#[tauri::command]
fn start_oauth_listener(app: AppHandle) -> Result<(), String> {
    use std::io::{Read, Write};
    use std::net::TcpListener;

    // Prevent double-binding if user clicks Connect twice
    if is_oauth_listening().swap(true, Ordering::SeqCst) {
        return Ok(());
    }

    std::thread::spawn(move || {
        let listener = match TcpListener::bind("127.0.0.1:8899") {
            Ok(l) => l,
            Err(_) => {
                is_oauth_listening().store(false, Ordering::SeqCst);
                return;
            }
        };

        if let Ok((mut stream, _)) = listener.accept() {
            let mut buf = vec![0u8; 8192];
            let n = stream.read(&mut buf).unwrap_or(0);
            let request = String::from_utf8_lossy(&buf[..n]).to_string();

            // Parse "GET /callback?code=XXX&... HTTP/1.1"
            let code = request
                .lines()
                .next()
                .and_then(|line| line.split(' ').nth(1))
                .and_then(|path| path.split('?').nth(1))
                .and_then(|query| {
                    query.split('&').find_map(|pair| {
                        let mut kv = pair.splitn(2, '=');
                        let key = kv.next()?;
                        let val = kv.next()?;
                        if key == "code" { Some(url_decode(val)) } else { None }
                    })
                });

            let html = concat!(
                "<!DOCTYPE html><html dir='rtl'><head><meta charset='utf-8'><title>Heed</title></head>",
                "<body style='font-family:sans-serif;text-align:center;padding:80px;background:#0b0c14;color:#f5f6fa'>",
                "<div style='max-width:400px;margin:0 auto;background:#111220;padding:40px;border-radius:16px;border:1px solid #2a2b3d'>",
                "<h2 style='color:#a78bfa;margin-bottom:12px'>&#x2705; تم الربط بنجاح!</h2>",
                "<p style='color:#8b8ca0;font-size:14px'>يمكنك إغلاق هذه النافذة والعودة إلى Heed</p>",
                "</div></body></html>"
            );
            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                html.len(), html
            );
            let _ = stream.write_all(response.as_bytes());
            drop(stream);

            is_oauth_listening().store(false, Ordering::SeqCst);

            if let Some(code) = code {
                let _ = app.emit("google:oauth:code", code);
            }
        } else {
            is_oauth_listening().store(false, Ordering::SeqCst);
        }
    });

    Ok(())
}

#[tauri::command]
#[allow(unused_variables)]
fn toggle_maximize(app: AppHandle) {
    #[cfg(desktop)]
    if let Some(window) = app.get_webview_window("main") {
        if window.is_maximized().unwrap_or(false) {
            let _ = window.unmaximize();
        } else {
            let _ = window.maximize();
        }
    }
}

// ── App entry ─────────────────────────────────────────────────────────────────
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // Desktop-only: system-tray menu-bar timer. Mobile has no tray.
            #[cfg(desktop)]
            {
            use tauri::menu::{Menu, MenuItem};
            use tauri::tray::{TrayIconBuilder, TrayIconEvent};
            // Tray context menu: Open Heed / Resume / Pause / Stop
            let open_item   = MenuItem::with_id(app, "open_heed", "🪟  فتح Heed", true, None::<&str>)?;
            let resume_item = MenuItem::with_id(app, "timer_resume", "▶  استئناف", true, None::<&str>)?;
            let pause_item  = MenuItem::with_id(app, "timer_pause",  "⏸  إيقاف مؤقت", true, None::<&str>)?;
            let stop_item   = MenuItem::with_id(app, "timer_stop",   "⏹  إيقاف", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open_item, &resume_item, &pause_item, &stop_item])?;

            TrayIconBuilder::with_id("heed-tray")
                // No icon — title-only for a clean menu bar look
                .title("⏱")
                .tooltip("Heed")
                .menu(&menu)
                .show_menu_on_left_click(true) // left or right click → show menu with controls
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { .. } = event {
                        let app = tray.app_handle();
                        if is_double_click() {
                            // Double-click → show + maximize
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.show();
                                let _ = w.maximize();
                                let _ = w.set_focus();
                                let _ = app.emit("tray:show", ());
                            }
                            if let Some(t) = app.tray_by_id("heed-tray") {
                                let _ = t.set_title(Some("⏱"));
                            }
                        }
                    }
                })
                .build(app)?;

            // Forward context-menu events to the frontend
            app.on_menu_event(|app, event| {
                match event.id().as_ref() {
                    "open_heed" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                        let _ = app.emit("tray:show", ());
                        if let Some(t) = app.tray_by_id("heed-tray") {
                            let _ = t.set_title(Some("⏱"));
                        }
                    }
                    "timer_resume" => { let _ = app.emit("timer:resume", ()); }
                    "timer_pause"  => { let _ = app.emit("timer:pause",  ()); }
                    "timer_stop"   => { let _ = app.emit("timer:stop",   ()); }
                    _ => {}
                }
            });
            } // end #[cfg(desktop)]

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            hide_to_tray,
            update_tray_state,
            update_tray_title,
            sync_data,
            read_commands,
            clear_commands,
            get_data_dir,
            start_oauth_listener,
            toggle_maximize,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
