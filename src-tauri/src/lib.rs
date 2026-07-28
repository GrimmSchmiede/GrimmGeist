use keyring::Entry;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Component, Path, PathBuf};

const KEYRING_SERVICE: &str = "com.novatwin.app";
const KEYRING_USER: &str = "gemini_api_key";

// Directories that are skipped when scanning a workspace so build output / dependency
// folders don't flood the file listing sent to Gemini as context.
const WORKSPACE_SKIP_DIRS: &[&str] = &[
    "node_modules",
    ".git",
    "target",
    "dist",
    ".venv",
    "venv",
    "__pycache__",
    ".vscode",
    ".idea",
];
const WORKSPACE_MAX_FILES: usize = 800;

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

/// Joins a workspace-relative filename onto the workspace root, rejecting absolute paths
/// and `..` components so a malformed/untrusted filename can't escape the workspace folder.
fn safe_workspace_join(workspace: &str, filename: &str) -> Result<PathBuf, String> {
    let filename_path = Path::new(filename);
    if filename_path.is_absolute() {
        return Err("Ungültiger Dateiname: absolute Pfade sind nicht erlaubt.".into());
    }
    for component in filename_path.components() {
        if matches!(component, Component::ParentDir) {
            return Err("Ungültiger Dateiname: '..' ist nicht erlaubt.".into());
        }
    }
    Ok(Path::new(workspace).join(filename_path))
}

fn scan_workspace_dir(root: &Path, dir: &Path, out: &mut Vec<String>) {
    let Ok(entries) = fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        if out.len() >= WORKSPACE_MAX_FILES {
            return;
        }
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if path.is_dir() {
            if WORKSPACE_SKIP_DIRS.contains(&name.as_str()) || name.starts_with('.') {
                continue;
            }
            scan_workspace_dir(root, &path, out);
        } else if let Ok(relative) = path.strip_prefix(root) {
            out.push(relative.to_string_lossy().replace('\\', "/"));
        }
    }
}

/// Recursively lists files inside a workspace folder (relative paths, forward slashes),
/// skipping common build/dependency directories and capping the result size.
#[tauri::command]
fn list_workspace_files(workspace: String) -> Result<Vec<String>, String> {
    let root = Path::new(&workspace);
    if !root.is_dir() {
        return Err("Arbeitsordner existiert nicht oder ist kein Verzeichnis.".into());
    }
    let mut out = Vec::new();
    scan_workspace_dir(root, root, &mut out);
    out.sort();
    Ok(out)
}

/// Creates or overwrites a file inside the workspace folder, creating parent directories
/// as needed. Returns the absolute path that was written.
#[tauri::command]
fn workspace_write_file(workspace: String, filename: String, content: String) -> Result<String, String> {
    let path = safe_workspace_join(&workspace, &filename)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Ordner konnte nicht erstellt werden: {e}"))?;
    }
    fs::write(&path, content).map_err(|e| format!("Datei konnte nicht geschrieben werden: {e}"))?;
    Ok(path.to_string_lossy().to_string())
}

/// Deletes a file inside the workspace folder, if it exists.
#[tauri::command]
fn workspace_delete_file(workspace: String, filename: String) -> Result<(), String> {
    let path = safe_workspace_join(&workspace, &filename)?;
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("Datei konnte nicht gelöscht werden: {e}"))?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            write_text_file,
            save_api_key,
            load_api_key,
            delete_api_key,
            list_workspace_files,
            workspace_write_file,
            workspace_delete_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
