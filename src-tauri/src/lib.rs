use std::sync::atomic::{AtomicBool, Ordering};

mod db;
mod native_io;

use db::{
    db_delete_note, db_get_all_notes, db_get_note, db_update_note_bounds, db_upsert_note, init_db,
};
use native_io::{
    clipboard_read_text, clipboard_write_text, export_all_notes_to_folder, open_text_file,
    pick_folder, save_text_file,
};

static IS_QUITTING: AtomicBool = AtomicBool::new(false);

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
};

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct WindowBounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[tauri::command]
fn open_note_window(
    app: AppHandle,
    note_id: String,
    x: Option<f64>,
    y: Option<f64>,
    width: Option<f64>,
    height: Option<f64>,
) -> Result<(), String> {
    let window_label = format!("note-{}", note_id);

    // If window is already open, bring it to the foreground and focus it
    if let Some(window) = app.get_webview_window(&window_label) {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
        return Ok(());
    }

    let w = width.unwrap_or(340.0).max(240.0);
    let h = height.unwrap_or(400.0).max(200.0);

    let mut builder = WebviewWindowBuilder::new(&app, &window_label, WebviewUrl::App("index.html".into()))
        .title("Sticklet")
        .inner_size(w, h)
        .min_inner_size(240.0, 200.0)
        .decorations(false) // Frameless: custom colored header acts as title bar
        .transparent(false)
        .background_color(tauri::window::Color(255, 247, 209, 255))
        .resizable(true)
        .shadow(true);

    if let (Some(px), Some(py)) = (x, y) {
        builder = builder.position(px, py);
    }

    let window = builder.build().map_err(|e| e.to_string())?;
    let _ = window.set_focus();
    Ok(())
}

#[tauri::command]
fn get_window_bounds(window: WebviewWindow) -> Result<WindowBounds, String> {
    let pos = window.outer_position().map_err(|e| e.to_string())?;
    let size = window.inner_size().map_err(|e| e.to_string())?;
    let scale = window.scale_factor().map_err(|e| e.to_string())?;

    let logical_pos = pos.to_logical::<f64>(scale);
    let logical_size = size.to_logical::<f64>(scale);

    Ok(WindowBounds {
        x: logical_pos.x,
        y: logical_pos.y,
        width: logical_size.width,
        height: logical_size.height,
    })
}

#[tauri::command]
fn start_drag(window: WebviewWindow) -> Result<(), String> {
    window.start_dragging().map_err(|e| e.to_string())
}

#[tauri::command]
fn toggle_always_on_top(app: AppHandle, note_id: String, is_pinned: bool) -> Result<(), String> {
    let window_label = format!("note-{}", note_id);
    if let Some(window) = app.get_webview_window(&window_label) {
        let _ = window.set_always_on_top(is_pinned);
    }
    Ok(())
}

#[tauri::command]
fn close_note_window(app: AppHandle, note_id: String) -> Result<Option<WindowBounds>, String> {
    let window_label = format!("note-{}", note_id);
    if let Some(window) = app.get_webview_window(&window_label) {
        let bounds = get_window_bounds(window.clone()).ok();
        let _ = window.close();
        return Ok(bounds);
    }
    Ok(None)
}

#[tauri::command]
fn restart_app(app: AppHandle) {
    app.restart();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Initialize SQLite DB and register state
            let db_state = init_db(app.handle())?;
            app.manage(db_state);

            // Register Updater Plugin
            let _ = app.handle().plugin(tauri_plugin_updater::Builder::new().build());

            // Build Tray Context Menu
            let new_note_item = MenuItem::with_id(app, "new_note", "➕ New Note", true, None::<&str>)?;
            let show_hub_item = MenuItem::with_id(app, "show_hub", "📝 Notes Hub", true, None::<&str>)?;
            let check_updates_item = MenuItem::with_id(app, "check_updates", "🔄 Check for Updates", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "❌ Quit", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[
                &new_note_item,
                &show_hub_item,
                &check_updates_item,
                &quit_item,
            ])?;

            // Register Global Shortcuts: Ctrl+Alt+N and Super+Shift+N to create a note from anywhere
            let _ = app.handle().plugin(
                tauri_plugin_global_shortcut::Builder::new()
                    .with_shortcuts(["ctrl+alt+n", "super+shift+n"])?
                    .with_handler(|app, _shortcut, event| {
                        if event.state() == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                            let _ = app.emit("tray-new-note", ());
                        }
                    })
                    .build(),
            );

            // Build Tray Icon using the app default window icon
            if let Some(icon) = app.default_window_icon().cloned() {
                let _tray = TrayIconBuilder::new()
                    .icon(icon)
                    .tooltip("Sticklet")
                    .menu(&menu)
                    .show_menu_on_left_click(false)
                    .on_menu_event(|app, event| {
                        match event.id.as_ref() {
                            "new_note" => {
                                let _ = app.emit("tray-new-note", ());
                            }
                            "show_hub" => {
                                if let Some(main) = app.get_webview_window("main") {
                                    let _ = main.show();
                                    let _ = main.unminimize();
                                    let _ = main.set_focus();
                                }
                            }
                            "check_updates" => {
                                if let Some(main) = app.get_webview_window("main") {
                                    let _ = main.show();
                                    let _ = main.unminimize();
                                    let _ = main.set_focus();
                                }
                                let _ = app.emit("check-for-updates", ());
                            }
                            "quit" => {
                                IS_QUITTING.store(true, Ordering::SeqCst);
                                app.exit(0);
                                std::process::exit(0);
                            }
                            _ => {}
                        }
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } = event {
                            let app = tray.app_handle();
                            if let Some(main) = app.get_webview_window("main") {
                                if main.is_visible().unwrap_or(false) && !main.is_minimized().unwrap_or(false) {
                                    let _ = main.hide();
                                } else {
                                    let _ = main.show();
                                    let _ = main.unminimize();
                                    let _ = main.set_focus();
                                }
                            }
                        }
                    })
                    .build(app)?;
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            // Intercept closing the main Notes Hub window so the app stays running in tray,
            // unless an explicit quit was requested.
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" && !IS_QUITTING.load(Ordering::SeqCst) {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            open_note_window,
            get_window_bounds,
            start_drag,
            toggle_always_on_top,
            close_note_window,
            db_get_all_notes,
            db_get_note,
            db_upsert_note,
            db_update_note_bounds,
            db_delete_note,
            save_text_file,
            open_text_file,
            pick_folder,
            export_all_notes_to_folder,
            clipboard_write_text,
            clipboard_read_text,
            restart_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
