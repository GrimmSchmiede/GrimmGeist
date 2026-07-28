use keyring::Entry;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

const KEYRING_SERVICE: &str = "com.novatwin.app";
const KEYRING_USER: &str = "gemini_api_key";

#[derive(Serialize, Deserialize)]
struct FileContent {
    path: String,
    name: String,
    content: String,
}

fn keyring_entry() -> Result<Entry, String> {
    Entry::new(KEYRING_SERVICE, KEYRING_USER).map_err(|e| e.to_string())
}

/// Reads a local text file from disk and returns its path, file name and content.
#[tauri::command]
fn read_text_file(path: String) -> Result<FileContent, String> {
    let content = fs::read_to_string(&path).map_err(|e| format!("Datei konnte nicht gelesen werden: {e}"))?;
    let name = Path::new(&path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.clone());
    Ok(FileContent { path, name, content })
}

/// Overwrites a local text file on disk with new content.
#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| format!("Datei konnte nicht geschrieben werden: {e}"))
}

/// Stores the Google Gemini API key in the OS-native secure credential store
/// (Windows Credential Manager / Linux Secret Service / macOS Keychain).
#[tauri::command]
fn save_api_key(key: String) -> Result<(), String> {
    let entry = keyring_entry()?;
    if key.trim().is_empty() {
        entry.delete_credential().ok();
        return Ok(());
    }
    entry.set_password(&key).map_err(|e| e.to_string())
}

/// Loads the Google Gemini API key from the OS-native secure credential store.
#[tauri::command]
fn load_api_key() -> Result<Option<String>, String> {
    let entry = keyring_entry()?;
    match entry.get_password() {
        Ok(pw) => Ok(Some(pw)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Removes the stored Google Gemini API key from the OS-native secure credential store.
#[tauri::command]
fn delete_api_key() -> Result<(), String> {
    let entry = keyring_entry()?;
    match entry.delete_credential() {
        Ok(_) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            write_text_file,
            save_api_key,
            load_api_key,
            delete_api_key
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
