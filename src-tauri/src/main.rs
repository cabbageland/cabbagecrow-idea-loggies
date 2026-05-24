use std::sync::{
    atomic::{AtomicBool, Ordering},
    Mutex,
};

use tauri::{Emitter, Manager, RunEvent, State};

const MAC_JOIN_ALL_SPACES: usize = 1 << 0;
const MAC_STATIONARY: usize = 1 << 4;
const MAC_IGNORES_CYCLE: usize = 1 << 6;
const MAC_FULLSCREEN_AUXILIARY: usize = 1 << 8;
const MAC_CAN_JOIN_ALL_APPLICATIONS: usize = 1 << 18;
#[cfg(test)]
const MAC_FLOATING_WINDOW_LEVEL: isize = 3;
const MAC_SCREEN_SAVER_WINDOW_LEVEL: isize = 1000;

#[derive(Debug, Clone, Copy)]
struct MacWindowPolicy {
    collection_behavior_bits: usize,
    window_level: isize,
    has_shadow: bool,
}

#[derive(Debug, Clone, Copy)]
struct MacAppPolicy {
    uses_accessory_activation_policy: bool,
}

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

fn fullscreen_pet_policy() -> MacWindowPolicy {
    MacWindowPolicy {
        collection_behavior_bits: MAC_JOIN_ALL_SPACES
            | MAC_STATIONARY
            | MAC_IGNORES_CYCLE
            | MAC_FULLSCREEN_AUXILIARY
            | MAC_CAN_JOIN_ALL_APPLICATIONS,
        window_level: MAC_SCREEN_SAVER_WINDOW_LEVEL,
        has_shadow: false,
    }
}

fn fullscreen_pet_app_policy() -> MacAppPolicy {
    MacAppPolicy {
        uses_accessory_activation_policy: false,
    }
}

#[cfg(target_os = "macos")]
fn apply_fullscreen_app_policy(app: &tauri::App) -> tauri::Result<()> {
    let activation_policy = if fullscreen_pet_app_policy().uses_accessory_activation_policy {
        tauri::ActivationPolicy::Accessory
    } else {
        tauri::ActivationPolicy::Regular
    };

    app.handle().set_activation_policy(activation_policy)?;

    Ok(())
}

#[cfg(not(target_os = "macos"))]
fn apply_fullscreen_app_policy(_app: &tauri::App) -> tauri::Result<()> {
    Ok(())
}

#[cfg(target_os = "macos")]
fn apply_fullscreen_pet_policy(window: &tauri::WebviewWindow) {
    use objc2::{
        msg_send,
        runtime::{AnyObject, Bool},
    };

    let Ok(ns_window) = window.ns_window() else {
        return;
    };
    let policy = fullscreen_pet_policy();
    let ns_window = unsafe { &*(ns_window.cast::<AnyObject>()) };
    let current_behavior: usize = unsafe { msg_send![ns_window, collectionBehavior] };
    let behavior = current_behavior | policy.collection_behavior_bits;

    unsafe {
        let _: () = msg_send![ns_window, setCollectionBehavior: behavior];
        let _: () = msg_send![ns_window, setLevel: policy.window_level];
        let has_shadow = Bool::new(policy.has_shadow);
        let _: () = msg_send![ns_window, setHasShadow: has_shadow];
        let _: () = msg_send![ns_window, orderFrontRegardless];
    }
}

#[cfg(not(target_os = "macos"))]
fn apply_fullscreen_pet_policy(_window: &tauri::WebviewWindow) {}

fn configure_overlay_windows(app: &tauri::App) {
    for label in ["main", "dashboard"] {
        if let Some(window) = app.get_webview_window(label) {
            apply_fullscreen_pet_policy(&window);
        }
    }
}

fn main() {
    let app = tauri::Builder::default()
        .manage(ShortcutState::default())
        .setup(|app| {
            apply_fullscreen_app_policy(app)?;
            configure_overlay_windows(app);
            Ok(())
        })
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fullscreen_pet_policy_joins_fullscreen_spaces() {
        let policy = fullscreen_pet_policy();

        assert!(policy.collection_behavior_bits & MAC_JOIN_ALL_SPACES != 0);
        assert!(policy.collection_behavior_bits & MAC_CAN_JOIN_ALL_APPLICATIONS != 0);
        assert!(policy.collection_behavior_bits & MAC_FULLSCREEN_AUXILIARY != 0);
        assert!(policy.collection_behavior_bits & MAC_STATIONARY != 0);
        assert!(policy.window_level > MAC_FLOATING_WINDOW_LEVEL);
        assert!(!policy.has_shadow);
    }

    #[test]
    fn fullscreen_pet_app_policy_keeps_dock_icon_visible() {
        assert!(!fullscreen_pet_app_policy().uses_accessory_activation_policy);
    }
}
