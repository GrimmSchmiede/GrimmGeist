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
        // uses on Linux to serve assets, causing "could not connect to localhost" - the same
        // root cause we already worked around for the Flatpak build via its manifest.
        std::env::set_var("WEBKIT_FORCE_SANDBOX", "0");
    }

    novatree_lib::run()
}
