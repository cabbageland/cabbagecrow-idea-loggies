use std::{
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
    thread,
    time::Duration,
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
const OVERLAY_POLICY_REFRESH_INTERVAL_MS: u64 = 1_000;
const OVERLAY_WINDOW_LABELS: [&str; 2] = ["main", "dashboard"];

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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum OverlayRefreshReason {
    Startup,
    AppResumed,
    ShortcutOpened,
    WindowFocusChanged,
    WindowGeometryChanged,
    ActiveSpaceRecovery,
    Unrelated,
}

fn overlay_policy_refresh_interval_ms() -> u64 {
    OVERLAY_POLICY_REFRESH_INTERVAL_MS
}

fn should_refresh_overlay_policy(reason: OverlayRefreshReason) -> bool {
    !matches!(reason, OverlayRefreshReason::Unrelated)
}

fn should_order_overlay_window(is_visible: bool) -> bool {
    is_visible
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
    let should_order_front = should_order_overlay_window(window.is_visible().unwrap_or(true));

    unsafe {
        let _: () = msg_send![ns_window, setCollectionBehavior: behavior];
        let _: () = msg_send![ns_window, setLevel: policy.window_level];
        let has_shadow = Bool::new(policy.has_shadow);
        let _: () = msg_send![ns_window, setHasShadow: has_shadow];
        if should_order_front {
            let _: () = msg_send![ns_window, orderFrontRegardless];
        }
    }
}

#[cfg(not(target_os = "macos"))]
fn apply_fullscreen_pet_policy(_window: &tauri::WebviewWindow) {}

fn is_overlay_window_label(label: &str) -> bool {
    OVERLAY_WINDOW_LABELS.contains(&label)
}

fn overlay_refresh_reason_for_window_event(
    label: &str,
    event: &tauri::WindowEvent,
) -> OverlayRefreshReason {
    if !is_overlay_window_label(label) {
        return OverlayRefreshReason::Unrelated;
    }

    match event {
        tauri::WindowEvent::Focused(_) => OverlayRefreshReason::WindowFocusChanged,
        tauri::WindowEvent::Moved(_)
        | tauri::WindowEvent::Resized(_)
        | tauri::WindowEvent::ScaleFactorChanged { .. } => {
            OverlayRefreshReason::WindowGeometryChanged
        }
        _ => OverlayRefreshReason::Unrelated,
    }
}

fn configure_overlay_windows(app: &tauri::App) {
    for label in OVERLAY_WINDOW_LABELS {
        if let Some(window) = app.get_webview_window(label) {
            apply_fullscreen_pet_policy(&window);
        }
    }
}

fn refresh_overlay_windows(app: &tauri::AppHandle) {
    for label in OVERLAY_WINDOW_LABELS {
        if let Some(window) = app.get_webview_window(label) {
            apply_fullscreen_pet_policy(&window);
        }
    }
}

fn refresh_overlay_windows_for_reason(app: &tauri::AppHandle, reason: OverlayRefreshReason) {
    if should_refresh_overlay_policy(reason) {
        refresh_overlay_windows(app);
    }
}

#[cfg(target_os = "macos")]
fn start_overlay_policy_refresh_loop(app: tauri::AppHandle) {
    thread::spawn(move || loop {
        thread::sleep(Duration::from_millis(overlay_policy_refresh_interval_ms()));

        let app_for_main_thread = app.clone();
        if app
            .run_on_main_thread(move || {
                refresh_overlay_windows_for_reason(
                    &app_for_main_thread,
                    OverlayRefreshReason::ActiveSpaceRecovery,
                );
            })
            .is_err()
        {
            break;
        }
    });
}

#[cfg(not(target_os = "macos"))]
fn start_overlay_policy_refresh_loop(_app: tauri::AppHandle) {}

fn main() {
    let app = tauri::Builder::default()
        .manage(ShortcutState::default())
        .setup(|app| {
            apply_fullscreen_app_policy(app)?;
            configure_overlay_windows(app);
            start_overlay_policy_refresh_loop(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            frontend_ready,
            drain_pending_shortcuts
        ])
        .build(tauri::generate_context!())
        .expect("failed to build CabbageCrow");

    app.run(|app_handle, event| match event {
        RunEvent::Ready => {
            refresh_overlay_windows_for_reason(app_handle, OverlayRefreshReason::Startup);
        }
        RunEvent::Resumed => {
            refresh_overlay_windows_for_reason(app_handle, OverlayRefreshReason::AppResumed);
        }
        RunEvent::Opened { urls } => {
            handle_opened_urls(app_handle, urls);
            refresh_overlay_windows_for_reason(app_handle, OverlayRefreshReason::ShortcutOpened);
        }
        RunEvent::WindowEvent { label, event, .. } => {
            refresh_overlay_windows_for_reason(
                app_handle,
                overlay_refresh_reason_for_window_event(&label, &event),
            );
        }
        _ => {}
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

    #[test]
    fn overlay_policy_refresh_reasserts_top_layer_after_switching_spaces() {
        assert!(should_refresh_overlay_policy(OverlayRefreshReason::Startup));
        assert!(should_refresh_overlay_policy(
            OverlayRefreshReason::WindowFocusChanged
        ));
        assert!(should_refresh_overlay_policy(
            OverlayRefreshReason::ActiveSpaceRecovery
        ));
        assert!(!should_refresh_overlay_policy(
            OverlayRefreshReason::Unrelated
        ));
    }

    #[test]
    fn overlay_policy_refresh_loop_is_low_frequency() {
        let interval = overlay_policy_refresh_interval_ms();

        assert!(interval >= 1_000);
        assert!(interval <= 2_000);
    }

    #[test]
    fn overlay_policy_only_orders_visible_windows_front() {
        assert!(should_order_overlay_window(true));
        assert!(!should_order_overlay_window(false));
    }
}
