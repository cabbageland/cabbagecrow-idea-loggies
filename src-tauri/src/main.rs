use std::sync::{
    atomic::{AtomicBool, Ordering},
    Mutex,
};

use tauri::{Emitter, Manager, RunEvent, State};

#[derive(Default)]
struct ShortcutState {
    frontend_ready: AtomicBool,
    pending_urls: Mutex<Vec<String>>,
}

#[tauri::command]
fn frontend_ready(state: State<'_, ShortcutState>) {
    state.frontend_ready.store(true, Ordering::SeqCst);
}

#[tauri::command]
fn drain_pending_shortcuts(state: State<'_, ShortcutState>) -> Vec<String> {
    state.pending_urls.lock().unwrap().drain(..).collect()
}

fn handle_opened_urls(app: &tauri::AppHandle, urls: Vec<tauri::Url>) {
    let shortcut_urls: Vec<String> = urls
        .into_iter()
        .filter(|url| url.scheme() == "cabbagecrow")
        .map(|url| url.to_string())
        .collect();

    if shortcut_urls.is_empty() {
        return;
    }

    let state = app.state::<ShortcutState>();
    if state.frontend_ready.load(Ordering::SeqCst) {
        let _ = app.emit("cabbagecrow-shortcut", shortcut_urls);
    } else {
        state.pending_urls.lock().unwrap().extend(shortcut_urls);
    }
}

fn main() {
    let app = tauri::Builder::default()
        .manage(ShortcutState::default())
        .invoke_handler(tauri::generate_handler![
            frontend_ready,
            drain_pending_shortcuts
        ])
        .build(tauri::generate_context!())
        .expect("failed to build CabbageCrow");

    app.run(|app_handle, event| {
        if let RunEvent::Opened { urls } = event {
            handle_opened_urls(app_handle, urls);
        }
    });
}
