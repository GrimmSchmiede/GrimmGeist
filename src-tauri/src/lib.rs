use keyring::Entry;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

const KEYRING_SERVICE: &str = "com.novatree.app";
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

const BACKUP_DIR_NAME: &str = ".novatree-backups";
// Keeps disk usage bounded without needing a separate cleanup UI - oldest snapshots beyond this
// count are pruned automatically every time a new one is taken for the same file.
const MAX_BACKUPS_PER_FILE: usize = 20;

/// Deletes the oldest backup snapshots for one file's backup folder beyond MAX_BACKUPS_PER_FILE.
fn prune_old_backups(backup_dir: &Path) {
    let Ok(entries) = fs::read_dir(backup_dir) else { return };
    let mut timestamps: Vec<u128> = entries
        .flatten()
        .filter_map(|e| e.file_name().to_string_lossy().parse::<u128>().ok())
        .collect();
    if timestamps.len() <= MAX_BACKUPS_PER_FILE {
        return;
    }
    timestamps.sort_unstable_by(|a, b| b.cmp(a)); // newest first
    for old in &timestamps[MAX_BACKUPS_PER_FILE..] {
        let _ = fs::remove_file(backup_dir.join(old.to_string()));
    }
}

/// Copies a workspace file's current content into `.novatree-backups/<relative-path>/<timestamp>`
/// before it gets overwritten or deleted, so a bad AI edit/delete can be recovered - either
/// manually or via the "Undo" button, which restores the exact snapshot path returned here. A
/// no-op (returns None) if the file doesn't exist yet (nothing to back up). The backup folder is
/// dot-prefixed, so `scan_workspace_dir` already skips it and it never reaches Gemini as context.
/// Older snapshots beyond MAX_BACKUPS_PER_FILE are pruned automatically (oldest first).
/// `filename` must already have been validated via `safe_workspace_join` by the caller.
fn backup_before_write(workspace: &str, filename: &str) -> Result<Option<String>, String> {
    let source = Path::new(workspace).join(filename);
    if !source.is_file() {
        return Ok(None);
    }
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let relative_backup = format!("{BACKUP_DIR_NAME}/{filename}/{timestamp}");
    let backup_path = Path::new(workspace).join(&relative_backup);
    let backup_dir = backup_path.parent().unwrap_or(&backup_path).to_path_buf();
    fs::create_dir_all(&backup_dir).map_err(|e| format!("Backup-Ordner konnte nicht erstellt werden: {e}"))?;
    fs::copy(&source, &backup_path).map_err(|e| format!("Backup konnte nicht erstellt werden: {e}"))?;
    prune_old_backups(&backup_dir);
    Ok(Some(relative_backup))
}

/// Restores a file from a specific backup snapshot (as returned by `backup_before_write`),
/// recreating the file if it was deleted. Rejects any path outside `.novatree-backups/` so this
/// can't be abused to copy arbitrary files into the workspace.
#[tauri::command]
fn workspace_restore_backup(workspace: String, filename: String, backup: String) -> Result<(), String> {
    if !backup.starts_with(&format!("{BACKUP_DIR_NAME}/")) {
        return Err("Ungültiger Backup-Pfad.".into());
    }
    let backup_path = safe_workspace_join(&workspace, &backup)?;
    if !backup_path.is_file() {
        return Err("Backup wurde nicht gefunden (evtl. bereits bereinigt).".into());
    }
    let target_path = safe_workspace_join(&workspace, &filename)?;
    if let Some(parent) = target_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Ordner konnte nicht erstellt werden: {e}"))?;
    }
    fs::copy(&backup_path, &target_path).map_err(|e| format!("Wiederherstellung fehlgeschlagen: {e}"))?;
    Ok(())
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

#[derive(Serialize)]
struct WriteResult {
    path: String,
    backup: Option<String>,
}

/// Creates or overwrites a file inside the workspace folder, creating parent directories
/// as needed. Returns the absolute path that was written and, if a prior version existed, the
/// workspace-relative backup path it was saved to (for the "Undo" button).
#[tauri::command]
fn workspace_write_file(workspace: String, filename: String, content: String) -> Result<WriteResult, String> {
    let path = safe_workspace_join(&workspace, &filename)?;
    let backup = backup_before_write(&workspace, &filename)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Ordner konnte nicht erstellt werden: {e}"))?;
    }
    fs::write(&path, content).map_err(|e| format!("Datei konnte nicht geschrieben werden: {e}"))?;
    Ok(WriteResult { path: path.to_string_lossy().to_string(), backup })
}

/// Reads a file inside the workspace folder as UTF-8 text.
#[tauri::command]
fn workspace_read_file(workspace: String, filename: String) -> Result<String, String> {
    let path = safe_workspace_join(&workspace, &filename)?;
    fs::read_to_string(&path).map_err(|e| format!("Datei konnte nicht gelesen werden: {e}"))
}

/// Deletes a file inside the workspace folder, if it exists. Returns the workspace-relative
/// backup path the prior content was saved to (for the "Undo" button), if there was one.
#[tauri::command]
fn workspace_delete_file(workspace: String, filename: String) -> Result<Option<String>, String> {
    let path = safe_workspace_join(&workspace, &filename)?;
    if path.exists() {
        let backup = backup_before_write(&workspace, &filename)?;
        fs::remove_file(&path).map_err(|e| format!("Datei konnte nicht gelöscht werden: {e}"))?;
        return Ok(backup);
    }
    Ok(None)
}

#[derive(Deserialize)]
struct SearchReplace {
    search: String,
    replace: String,
}

#[derive(Serialize)]
struct EditOutcome {
    search: String,
    status: String, // "SUCCESS_PRECISE" | "FUZZY_MATCH_NEEDED" | "NOT_FOUND"
}

#[derive(Serialize)]
struct ApplyEditsResult {
    outcomes: Vec<EditOutcome>,
    backup: Option<String>,
}

/// Applies a sequence of search/replace edits to an existing workspace file (precision editing,
/// as an alternative to overwriting the whole file). Each edit is matched exactly against the
/// current content first; if that fails, a whitespace-insensitive check tells the caller whether
/// the search text exists but only under different whitespace/indentation (FUZZY_MATCH_NEEDED,
/// not auto-applied since the match position would be ambiguous) or not at all (NOT_FOUND).
/// Only edits that matched exactly are written to disk; if any were, the workspace-relative
/// backup path of the pre-edit content is returned too (for the "Undo" button).
#[tauri::command]
fn workspace_apply_edits(
    workspace: String,
    filename: String,
    edits: Vec<SearchReplace>,
) -> Result<ApplyEditsResult, String> {
    let path = safe_workspace_join(&workspace, &filename)?;
    let mut content = fs::read_to_string(&path).map_err(|e| format!("Datei konnte nicht gelesen werden: {e}"))?;
    let mut outcomes = Vec::with_capacity(edits.len());
    let mut changed = false;

    for edit in edits {
        if content.contains(&edit.search) {
            content = content.replacen(&edit.search, &edit.replace, 1);
            changed = true;
            outcomes.push(EditOutcome { search: edit.search, status: "SUCCESS_PRECISE".into() });
        } else {
            let clean_content: String = content.chars().filter(|c| !c.is_whitespace()).collect();
            let clean_search: String = edit.search.chars().filter(|c| !c.is_whitespace()).collect();
            if !clean_search.is_empty() && clean_content.contains(&clean_search) {
                outcomes.push(EditOutcome { search: edit.search, status: "FUZZY_MATCH_NEEDED".into() });
            } else {
                outcomes.push(EditOutcome { search: edit.search, status: "NOT_FOUND".into() });
            }
        }
    }

    let mut backup = None;
    if changed {
        backup = backup_before_write(&workspace, &filename)?;
        fs::write(&path, content).map_err(|e| format!("Datei konnte nicht geschrieben werden: {e}"))?;
    }
    Ok(ApplyEditsResult { outcomes, backup })
}

#[derive(Deserialize)]
struct ProjectFile {
    filename: String,
    content: String,
}

/// Creates a whole new project folder structure ("Architect Mode") inside the workspace: a root
/// subfolder plus an arbitrary set of files within it, creating any needed subdirectories. Reuses
/// safe_workspace_join for every individual file path so the same traversal protection applies as
/// for single-file actions. Returns the list of workspace-relative paths that were created.
#[tauri::command]
fn workspace_create_project(
    workspace: String,
    root_folder: String,
    files: Vec<ProjectFile>,
) -> Result<Vec<String>, String> {
    let mut created = Vec::with_capacity(files.len());
    for file in files {
        let relative = format!("{root_folder}/{}", file.filename);
        let path = safe_workspace_join(&workspace, &relative)?;
        // Architect Mode is a bulk scaffold - individual per-file undo isn't offered for it, but
        // any pre-existing file it happens to overwrite is still backed up for manual recovery.
        backup_before_write(&workspace, &relative)?;
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("Ordner konnte nicht erstellt werden: {e}"))?;
        }
        fs::write(&path, file.content).map_err(|e| format!("Datei konnte nicht geschrieben werden: {e}"))?;
        created.push(relative);
    }
    Ok(created)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            write_text_file,
            save_api_key,
            load_api_key,
            delete_api_key,
            list_workspace_files,
            workspace_read_file,
            workspace_write_file,
            workspace_delete_file,
            workspace_apply_edits,
            workspace_create_project,
            workspace_restore_backup
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
