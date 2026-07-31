// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Works around a well-known WebKitGTK bug on Linux where the window renders completely
    // white/black (seen on VMs, some Mesa/GPU driver combos and Wayland setups) unless the
    // compositing/DMA-BUF renderer is disabled. Must be set before WebKitGTK initializes.
    #[cfg(target_os = "linux")]
    {
        std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        // WebKitGTK's own internal (bubblewrap) sandbox can block the local HTTP server Tauri
        // uses on Linux to serve assets, causing "could not connect to localhost" - or, on
        // systems where unprivileged user namespaces are disabled at the kernel level (a common
        // Arch/CachyOS hardening default that breaks bubblewrap outright), WebKitGTK refuses to
        // start at all with a "sandbox could not be disabled" error unless this exact,
        // intentionally scary-named variable is set (WEBKIT_FORCE_SANDBOX is not a real
        // WebKitGTK variable and does nothing - this is the actual documented one).
        std::env::set_var("WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS", "1");

        // Tauri's AppImage bundler (linuxdeploy-plugin-gtk) unconditionally forces
        // GDK_BACKEND=x11 in its startup hook, regardless of what's actually set - this routes
        // WebKitGTK's rendering through XWayland even on native Wayland sessions, which is a
        // known cause of a blank/white window on some Wayland/Mesa combinations (confirmed
        // upstream: https://github.com/tauri-apps/tauri/issues/15781). Only override it back to
        // Wayland when we can tell we're actually in a Wayland session, so this doesn't affect
        // genuine X11 systems or the native/Flatpak builds (which aren't hit by that hook).
        if std::env::var("WAYLAND_DISPLAY").is_ok() {
            std::env::set_var("GDK_BACKEND", "wayland");
        }
    }

    novatree_lib::run()
}
