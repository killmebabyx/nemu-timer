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
    ignoring_pointer: bool,
    hit_mask: Vec<[i32; 4]>,
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
    pet.set_ignore_cursor_events(true)
        .map_err(|e| e.to_string())?;
    pet.show().map_err(|e| e.to_string())?;
    if let Err(e) = window(&app, "main").hide() {
        let _ = pet.hide();
        return Err(e.to_string());
    }
    t.end = Some(deadline);
    t.notice.clear();
    t.pass_through = false;
    t.ignoring_pointer = true;
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
fn shape_pet(window: WebviewWindow, rects: Vec<[i32; 4]>, timer: State<Shared>) -> Reply {
    if window.label() != "pet" || rects.len() > 8192 {
        return Err("Invalid pet hit mask".into());
    }
    timer.lock().unwrap().hit_mask = rects;
    Ok(())
}

// Keep the WebView surface rectangular so DWM can composite soft edges at any
// focus state. The silhouette is only used to route pointer input.
fn follow_pointer(app: &AppHandle, pet: &WebviewWindow, hwnd: usize) {
    use windows_sys::Win32::{
        Foundation::{POINT, RECT},
        UI::{
            Input::KeyboardAndMouse::{GetAsyncKeyState, VK_LBUTTON},
            WindowsAndMessaging::{GetCursorPos, GetWindowRect},
        },
    };
    let state = app.state::<Shared>();
    let mut t = state.lock().unwrap();
    if t.end.is_none() {
        return;
    }

    let mut pointer = POINT::default();
    let mut bounds = RECT::default();
    unsafe {
        if GetCursorPos(&mut pointer) == 0 || GetWindowRect(hwnd as _, &mut bounds) == 0 {
            return;
        }
        // Preserve the target of a press or native drag until button release.
        if GetAsyncKeyState(VK_LBUTTON as i32) < 0 {
            return;
        }
    }
    let x = pointer.x - bounds.left;
    let y = pointer.y - bounds.top;
    let inside = pointer.x >= bounds.left
        && pointer.x < bounds.right
        && pointer.y >= bounds.top
        && pointer.y < bounds.bottom;
    let ignore = t.pass_through
        || !inside
        || !t
            .hit_mask
            .iter()
            .any(|&[l, top, r, b]| x >= l && x < r && y >= top && y < b);
    if ignore != t.ignoring_pointer {
        t.ignoring_pointer = ignore;
        drop(t);
        let _ = pet.set_ignore_cursor_events(ignore);
    }
}
#[tauri::command]
fn open_dial(app: AppHandle, left: f64, right: f64, center: f64, minutes: u16) -> Reply {
    let main = window(&app, "main");
    let dial = window(&app, "dial");
    if minutes >= 1440 {
        return Err("invalid".into());
    }
    if dial.is_visible().map_err(|e| e.to_string())? {
        return dial
            .eval("window.dispatchEvent(new Event('dialdismiss'))")
            .map_err(|e| e.to_string());
    }
    let pos = main.inner_position().map_err(|e| e.to_string())?;
    let scale = main.scale_factor().map_err(|e| e.to_string())?;
    let monitor = main
        .current_monitor()
        .map_err(|e| e.to_string())?
        .ok_or("monitor")?;
    let area = monitor.work_area();
    let width = (280. * scale).ceil() as i32;
    let height = (436. * scale).ceil() as i32;
    let xmax = (area.position.x + area.size.width as i32 - width).max(area.position.x);
    let ymax = (area.position.y + area.size.height as i32 - height).max(area.position.y);
    let mut x = pos.x + (right * scale).round() as i32;
    let opens_left = x > xmax;
    if opens_left {
        x = pos.x + (left * scale).round() as i32 - width;
    }
    let anchor = pos.y + (center * scale).round() as i32;
    let y = (anchor - height * 62 / 100).clamp(area.position.y, ymax);
    let tip = ((anchor - y) as f64 / scale).clamp(32., 403.);
    let side = if opens_left { "left" } else { "right" };
    dial.set_position(PhysicalPosition::new(x.clamp(area.position.x, xmax), y))
        .map_err(|e| e.to_string())?;
    dial.eval(format!("document.documentElement.dataset.side='{side}';document.documentElement.style.setProperty('--tip','{tip}px')")).map_err(|e|e.to_string())?;
    dial.show()
        .and_then(|_| dial.set_focus())
        .map_err(|e| e.to_string())?;
    dial.eval(format!(
        "window.dispatchEvent(new CustomEvent('dialopen',{{detail:{minutes}}}))"
    ))
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn close_dial(app: AppHandle, minutes: Option<u16>, restore_focus: bool) -> Reply {
    let main = window(&app, "main");
    if let Some(value) = minutes {
        if value >= 1440 {
            return Err("invalid".into());
        }
        main.eval(format!(
            "window.dispatchEvent(new CustomEvent('dialvalue',{{detail:{value}}}))"
        ))
        .map_err(|e| e.to_string())?;
    }
    window(&app, "dial").hide().map_err(|e| e.to_string())?;
    main.eval("document.getElementById('time').setAttribute('aria-expanded','false')")
        .map_err(|e| e.to_string())?;
    if restore_focus {
        main.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
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
    if remaining <= 60_000 {
        t.pass_through = false;
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
        "ja" => [
            "Nemu Timer を開く",
            "クリック透過を切り替え",
            "シャットダウンを取り消す",
        ],
        "zh-CN" => ["打开 Nemu Timer", "切换鼠标穿透", "取消关机"],
        _ => ["เปิด Nemu Timer", "สลับโหมดคลิกทะลุตัวละคร", "ยกเลิกการปิดเครื่อง"],
    };
    let menu = MenuBuilder::new(&app)
        .text("open", labels[0])
        .text("pass", labels[1])
        .text("cancel", labels[2])
        .build()
        .map_err(|e| e.to_string())?;
    app.tray_by_id("nemu")
        .ok_or("Tray unavailable")?
        .set_menu(Some(menu))
        .map_err(|e| e.to_string())
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
            status,
            start,
            extend,
            cancel,
            drag,
            minimize,
            close_main,
            preview_mode,
            tray_language,
            open_dial,
            close_dial,
            shape_pet
        ])
        .on_window_event(|w, event| {
            if w.label() == "dial" {
                match event {
                    WindowEvent::Focused(false) => {
                        let _ = window(w.app_handle(), "dial")
                            .eval("window.dispatchEvent(new Event('dialdismiss'))");
                    }
                    WindowEvent::CloseRequested { api, .. } => {
                        api.prevent_close();
                        let _ = window(w.app_handle(), "dial")
                            .eval("window.dispatchEvent(new Event('dialdismiss'))");
                    }
                    _ => {}
                }
                return;
            }
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
                        if t.end.is_some_and(|end| end > now() + 60_000) {
                            t.pass_through = !t.pass_through;
                        }
                    }
                    _ => {}
                })
                .build(app)?;
            let hover_app = app.handle().clone();
            let pet = window(&hover_app, "pet");
            let hwnd = pet.hwnd()?.0 as usize;
            thread::spawn(move || loop {
                let active = hover_app.state::<Shared>().lock().unwrap().end.is_some();
                if active {
                    follow_pointer(&hover_app, &pet, hwnd);
                }
                thread::sleep(Duration::from_millis(if active { 12 } else { 100 }));
            });
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
