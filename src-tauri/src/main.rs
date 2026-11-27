#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    env,
    os::windows::process::CommandExt,
    path::PathBuf,
    process::Command,
    sync::Mutex,
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{
    menu::MenuBuilder,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, PhysicalPosition, State, WebviewWindow, WindowEvent,
};

const TEN_MINUTES: u64 = 600_000;
const MAX_DELAY: u64 = 365 * 24 * 60 * 60 * 1000;
#[derive(Default)]
struct Timer {
    end: Option<u64>,
    notice: String,
    pass_through: bool,
}
type Shared = Mutex<Timer>;
type Reply<T = ()> = Result<T, String>;
fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}
fn window(app: &AppHandle, name: &str) -> WebviewWindow {
    app.get_webview_window(name).unwrap()
}
fn open_main(app: &AppHandle) {
    let w = window(app, "main");
    let _ = w.show();
    let _ = w.unminimize();
    let _ = w.set_focus();
}
fn home_pet(app: &AppHandle) -> Reply {
    let main = window(app, "main");
    let pet = window(app, "pet");
    let monitor = main
        .current_monitor()
        .map_err(|e| e.to_string())?
        .ok_or("monitor")?;
    let area = monitor.work_area();
    let size = pet.outer_size().map_err(|e| e.to_string())?;
    let right = area.position.x + area.size.width as i32;
    let bottom = area.position.y + area.size.height as i32;
    pet.set_position(PhysicalPosition::new(
        right - size.width as i32 - 8,
        bottom - size.height as i32,
    ))
    .map_err(|e| e.to_string())
}
#[tauri::command]
fn status(timer: State<Shared>) -> (Option<u64>, String) {
    let t = timer.lock().unwrap();
    (t.end, t.notice.clone())
}
#[tauri::command]
fn start(app: AppHandle, deadline: u64, timer: State<Shared>) -> Reply {
    let mut t = timer.lock().unwrap();
    if t.end.is_some() {
        return Err("active".into());
    }
    let delta = deadline.saturating_sub(now());
    if delta == 0 || delta > MAX_DELAY {
        return Err("invalid".into());
    }
    let pet = window(&app, "pet");
    home_pet(&app)?;
    pet.set_ignore_cursor_events(false)
        .map_err(|e| e.to_string())?;
    pet.show().map_err(|e| e.to_string())?;
    if let Err(e) = window(&app, "main").hide() {
        let _ = pet.hide();
        return Err(e.to_string());
    }
    t.end = Some(deadline);
    t.notice.clear();
    t.pass_through = false;
    Ok(())
}
#[tauri::command]
fn extend(timer: State<Shared>) -> Reply {
    let mut t = timer.lock().unwrap();
    let end = t.end.filter(|end| *end > now()).ok_or("expired")?;
    t.end = Some(end + TEN_MINUTES);
    Ok(())
}
#[tauri::command]
fn cancel(app: AppHandle, timer: State<Shared>) {
    let mut t = timer.lock().unwrap();
    if t.end.take().is_some() {
        t.notice.clear();
    }
    let _ = window(&app, "pet").hide();
    open_main(&app);
}
#[tauri::command]
fn drag(window: WebviewWindow) {
    let _ = window.start_dragging();
}
#[tauri::command]
fn minimize(app: AppHandle) {
    let _ = window(&app, "main").minimize();
}
#[tauri::command]
fn close_main(app: AppHandle) {
    let _ = window(&app, "main").close();
}

#[tauri::command]
fn preview_mode(preview: State<bool>) -> bool {
    *preview
}

#[tauri::command]
fn shape_pet(window: WebviewWindow, rects: Vec<[i32; 4]>) -> Reply {
    use windows_sys::Win32::Graphics::Gdi::{
        CombineRgn, CreateRectRgn, DeleteObject, SetRectRgn, SetWindowRgn, RGN_OR,
    };
    if window.label() != "pet" || rects.len() > 8192 {
        return Err("Invalid pet region".into());
    }
    let hwnd = window.hwnd().map_err(|e| e.to_string())?.0;
    // Windows uses this region for both composition and cross-process mouse hit testing.
    unsafe {
        let region = CreateRectRgn(0, 0, 0, 0);
        let part = CreateRectRgn(0, 0, 0, 0);
        let mut ok = !region.is_null() && !part.is_null();
        if ok {
            for [left, top, right, bottom] in rects {
                if SetRectRgn(part, left, top, right, bottom) == 0 ||
                    CombineRgn(region, region, part, RGN_OR) == 0 {
                    ok = false;
                    break;
                }
            }
        }
        if !part.is_null() { DeleteObject(part); }
        if ok && SetWindowRgn(hwnd, region, 1) != 0 {
            // On success the system owns the region.
            Ok(())
        } else {
            if !region.is_null() { DeleteObject(region); }
            Err("Unable to shape pet window".into())
        }
    }
}

fn shutdown() -> Reply {
    let root = env::var_os("SystemRoot").ok_or("systemRoot")?;
    let output = Command::new(PathBuf::from(root).join("System32").join("shutdown.exe"))
        .args(["/s", "/t", "0"])
        .creation_flags(0x08000000)
        .output()
        .map_err(|e| e.to_string())?;
    if output.status.success() {
        Ok(())
    } else {
        Err(format!("refused | {}", output.status))
    }
}
fn tick(app: &AppHandle, preview: bool) {
    let shared = app.state::<Shared>();
    let mut t = shared.lock().unwrap();
    let Some(end) = t.end else { return };
    let remaining = end.saturating_sub(now());
    if remaining <= 60_000 && t.pass_through {
        if window(app, "pet").set_ignore_cursor_events(false).is_ok() {
            t.pass_through = false;
        }
    }
    if remaining > 0 {
        return;
    }
    t.end = None;
    t.notice = if preview {
        "finished".into()
    } else {
        shutdown()
            .map(|_| "sent".to_string())
            .unwrap_or_else(|e| format!("failed | {e}"))
    };
    let _ = window(app, "pet").hide();
    open_main(app);
}
#[tauri::command]
fn tray_language(app: AppHandle, language: String) -> Reply {
    let labels = match language.as_str() {
        "en" => ["Open Nemu Timer", "Toggle click-through", "Cancel shutdown"],
        "ja" => ["Nemu Timer を開く", "クリック透過を切り替え", "シャットダウンを取り消す"],
        "zh-CN" => ["打开 Nemu Timer", "切换鼠标穿透", "取消关机"],
        _ => ["เปิด Nemu Timer", "สลับโหมดคลิกทะลุตัวละคร", "ยกเลิกการปิดเครื่อง"],
    };
    let menu = MenuBuilder::new(&app).text("open", labels[0]).text("pass", labels[1])
        .text("cancel", labels[2]).build().map_err(|e|e.to_string())?;
    app.tray_by_id("nemu").ok_or("Tray unavailable")?.set_menu(Some(menu)).map_err(|e|e.to_string())
}
fn main() {
    let preview = env::args().any(|s| s == "--preview");
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            open_main(app)
        }))
        .manage(Shared::default())
        .manage(preview)
        .invoke_handler(tauri::generate_handler![
            status, start, extend, cancel, drag, minimize, close_main, preview_mode, tray_language, shape_pet
        ])
        .on_window_event(|w, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if w.label() == "pet" || w.state::<Shared>().lock().unwrap().end.is_some() {
                    api.prevent_close();
                    if w.label() == "main" {
                        let _ = w.hide();
                    }
                } else {
                    w.app_handle().exit(0);
                }
            }
        })
        .setup(move |app| {
            let menu = MenuBuilder::new(app)
                .text("open", "Open Nemu Timer")
                .text("pass", "Toggle click-through")
                .text("cancel", "Cancel shutdown")
                .build()?;
            TrayIconBuilder::with_id("nemu")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Nemu Timer")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_tray_icon_event(|tray, event| {
                    if matches!(
                        event,
                        TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        }
                    ) {
                        open_main(tray.app_handle());
                    }
                })
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => open_main(app),
                    "cancel" => cancel(app.clone(), app.state()),
                    "pass" => {
                        let state = app.state::<Shared>();
                        let mut t = state.lock().unwrap();
                        if t.end.is_some_and(|end| end > now() + 60_000)
                            && window(app, "pet")
                                .set_ignore_cursor_events(!t.pass_through)
                                .is_ok()
                        {
                            t.pass_through = !t.pass_through;
                        }
                    }
                    _ => {}
                })
                .build(app)?;
            let handle = app.handle().clone();
            thread::spawn(move || loop {
                thread::sleep(Duration::from_millis(250));
                let app = handle.clone();
                let _ = handle.run_on_main_thread(move || tick(&app, preview));
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Nemu Timer startup failed");
}




