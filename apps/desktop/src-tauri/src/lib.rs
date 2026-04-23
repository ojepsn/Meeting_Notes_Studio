use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::Manager;

fn sanitize_filename(filename: &str) -> String {
    filename
        .chars()
        .map(|character| match character {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            _ => character,
        })
        .collect()
}

fn ensure_parent_dir(path: &Path) -> Result<(), String> {
    match path.parent() {
        Some(parent) => fs::create_dir_all(parent).map_err(|error| error.to_string()),
        None => Ok(()),
    }
}

fn copy_file_if_missing(source: &Path, destination: &Path) -> Result<(), String> {
    if destination.exists() || !source.exists() {
        return Ok(());
    }

    ensure_parent_dir(destination)?;
    fs::copy(source, destination).map_err(|error| error.to_string())?;
    Ok(())
}

fn copy_dir_contents_if_missing(source_dir: &Path, destination_dir: &Path) -> Result<(), String> {
    if !source_dir.exists() {
        return Ok(());
    }

    fs::create_dir_all(destination_dir).map_err(|error| error.to_string())?;
    for entry in fs::read_dir(source_dir).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let source_path = entry.path();
        let destination_path = destination_dir.join(entry.file_name());

        if source_path.is_dir() {
            copy_dir_contents_if_missing(&source_path, &destination_path)?;
        } else if !destination_path.exists() {
            ensure_parent_dir(&destination_path)?;
            fs::copy(&source_path, &destination_path).map_err(|error| error.to_string())?;
        }
    }

    Ok(())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopStorageInfo {
    app_config_dir: String,
    app_data_dir: String,
    database_path: String,
    attachments_dir: String,
    backups_dir: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LocalBackupInfo {
    path: String,
    modified_ms: u64,
}

fn candidate_database_paths(app_config_dir: &Path, app_data_dir: &Path) -> Vec<PathBuf> {
    vec![
        app_config_dir.join("notesmith.db"),
        app_data_dir.join("notesmith.db"),
        app_config_dir.join("databases").join("notesmith.db"),
        app_data_dir.join("databases").join("notesmith.db"),
    ]
}

fn candidate_database_sidecar_paths(source: &Path) -> Vec<PathBuf> {
    let source_text = source.to_string_lossy().to_string();
    [".db-wal", ".db-shm", ".sqlite-wal", ".sqlite-shm"]
        .iter()
        .map(|suffix| {
            if source_text.ends_with(".db") {
                PathBuf::from(source_text.replace(".db", suffix))
            } else {
                PathBuf::from(format!("{source_text}{suffix}"))
            }
        })
        .collect()
}

fn prepare_storage(app: &tauri::AppHandle) -> Result<DesktopStorageInfo, String> {
    let app_config_dir = app
        .path()
        .app_config_dir()
        .map_err(|error| error.to_string())?;
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    let local_data_dir = app
        .path()
        .local_data_dir()
        .map_err(|error| error.to_string())?;

    let stable_root_dir = local_data_dir.join("NoteSmith Desktop Data");

    fs::create_dir_all(&app_config_dir).map_err(|error| error.to_string())?;
    fs::create_dir_all(&app_data_dir).map_err(|error| error.to_string())?;
    fs::create_dir_all(&stable_root_dir).map_err(|error| error.to_string())?;

    let database_path = stable_root_dir.join("notesmith.db");
    let attachments_dir = stable_root_dir.join("attachments");
    let backups_dir = stable_root_dir.join("backups");

    fs::create_dir_all(&attachments_dir).map_err(|error| error.to_string())?;
    fs::create_dir_all(&backups_dir).map_err(|error| error.to_string())?;

    for candidate in candidate_database_paths(&app_config_dir, &app_data_dir) {
        if !database_path.exists() {
            copy_file_if_missing(&candidate, &database_path)?;
        }
        for sidecar in candidate_database_sidecar_paths(&candidate) {
            let destination = stable_root_dir.join(
                sidecar
                    .file_name()
                    .map(|name| name.to_string_lossy().to_string())
                    .unwrap_or_default(),
            );
            copy_file_if_missing(&sidecar, &destination)?;
        }
    }

    copy_dir_contents_if_missing(&app_config_dir.join("attachments"), &attachments_dir)?;
    copy_dir_contents_if_missing(&app_data_dir.join("attachments"), &attachments_dir)?;
    copy_dir_contents_if_missing(&app_config_dir.join("backups"), &backups_dir)?;
    copy_dir_contents_if_missing(&app_data_dir.join("backups"), &backups_dir)?;

    Ok(DesktopStorageInfo {
        app_config_dir: stable_root_dir.to_string_lossy().to_string(),
        app_data_dir: stable_root_dir.to_string_lossy().to_string(),
        database_path: database_path.to_string_lossy().to_string(),
        attachments_dir: attachments_dir.to_string_lossy().to_string(),
        backups_dir: backups_dir.to_string_lossy().to_string(),
    })
}

#[tauri::command]
fn read_file_bytes(path: String) -> Result<Vec<u8>, String> {
    fs::read(path).map_err(|error| error.to_string())
}

#[tauri::command]
fn copy_file_into_app_data(
    app: tauri::AppHandle,
    session_id: String,
    source_path: String,
    filename: String,
) -> Result<String, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;

    let extension = Path::new(&filename)
        .extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or("");
    let stem = Path::new(&filename)
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or("attachment");
    let safe_name = sanitize_filename(stem);
    let persisted_name = if extension.is_empty() {
        format!("{}-{}", safe_name, session_id)
    } else {
        format!("{}-{}.{}", safe_name, session_id, extension)
    };

    let destination: PathBuf = app_data_dir
        .join("attachments")
        .join(&session_id)
        .join(persisted_name);

    ensure_parent_dir(&destination)?;
    fs::copy(source_path, &destination).map_err(|error| error.to_string())?;

    Ok(destination.to_string_lossy().to_string())
}

#[tauri::command]
fn write_bytes_to_path(path: String, bytes: Vec<u8>) -> Result<(), String> {
    let destination = PathBuf::from(path);
    ensure_parent_dir(&destination)?;
    fs::write(destination, bytes).map_err(|error| error.to_string())
}

#[tauri::command]
fn write_text_to_path(path: String, content: String) -> Result<(), String> {
    let destination = PathBuf::from(path);
    ensure_parent_dir(&destination)?;
    fs::write(destination, content).map_err(|error| error.to_string())
}

#[tauri::command]
fn write_backup_snapshot(
    app: tauri::AppHandle,
    filename: String,
    bytes: Vec<u8>,
) -> Result<String, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;

    let destination = app_data_dir.join("backups").join(filename);
    ensure_parent_dir(&destination)?;
    fs::write(&destination, bytes).map_err(|error| error.to_string())?;

    Ok(destination.to_string_lossy().to_string())
}

#[tauri::command]
fn write_backup_snapshot_text(
    app: tauri::AppHandle,
    filename: String,
    content: String,
) -> Result<String, String> {
    let storage = prepare_storage(&app)?;

    let destination = PathBuf::from(storage.backups_dir).join(filename);
    ensure_parent_dir(&destination)?;
    fs::write(&destination, content).map_err(|error| error.to_string())?;

    Ok(destination.to_string_lossy().to_string())
}

#[tauri::command]
fn get_desktop_storage_info(app: tauri::AppHandle) -> Result<DesktopStorageInfo, String> {
    prepare_storage(&app)
}

fn find_latest_local_backup(backups_dir: &Path) -> Result<Option<(std::time::SystemTime, PathBuf)>, String> {
    if !backups_dir.exists() {
        return Ok(None);
    }

    let mut latest_file: Option<(std::time::SystemTime, PathBuf)> = None;
    for entry in fs::read_dir(backups_dir).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        let extension = path.extension().and_then(|ext| ext.to_str()).unwrap_or_default();
        if !path.is_file() || (extension != "json" && extension != "zip") {
            continue;
        }

        let modified = entry
            .metadata()
            .map_err(|error| error.to_string())?
            .modified()
            .unwrap_or(std::time::SystemTime::UNIX_EPOCH);

        match &latest_file {
            Some((current_modified, _)) if modified <= *current_modified => {}
            _ => latest_file = Some((modified, path)),
        }
    }

    Ok(latest_file)
}

#[tauri::command]
fn load_latest_local_backup(app: tauri::AppHandle) -> Result<Option<Vec<u8>>, String> {
    let storage = prepare_storage(&app)?;
    let backups_dir = PathBuf::from(storage.backups_dir);

    match find_latest_local_backup(&backups_dir)? {
        Some((_, path)) => fs::read(path)
            .map(Some)
            .map_err(|error| error.to_string()),
        None => Ok(None),
    }
}

#[tauri::command]
fn get_latest_local_backup_info(app: tauri::AppHandle) -> Result<Option<LocalBackupInfo>, String> {
    let storage = prepare_storage(&app)?;
    let backups_dir = PathBuf::from(storage.backups_dir);

    match find_latest_local_backup(&backups_dir)? {
        Some((modified, path)) => {
            let modified_ms = modified
                .duration_since(std::time::SystemTime::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64;
            Ok(Some(LocalBackupInfo {
                path: path.to_string_lossy().to_string(),
                modified_ms,
            }))
        }
        None => Ok(None),
    }
}

#[tauri::command]
fn open_path_in_file_manager(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(path)
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(path)
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    #[allow(unreachable_code)]
    Err("Opening the data folder is not supported on this platform.".to_string())
}

#[tauri::command]
fn write_bytes_into_app_data(
    app: tauri::AppHandle,
    session_id: String,
    filename: String,
    bytes: Vec<u8>,
) -> Result<String, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;

    let extension = Path::new(&filename)
        .extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or("");
    let stem = Path::new(&filename)
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or("attachment");
    let safe_name = sanitize_filename(stem);
    let persisted_name = if extension.is_empty() {
        format!("{}-{}", safe_name, session_id)
    } else {
        format!("{}-{}.{}", safe_name, session_id, extension)
    };

    let destination: PathBuf = app_data_dir
        .join("attachments")
        .join(&session_id)
        .join(persisted_name);

    ensure_parent_dir(&destination)?;
    fs::write(&destination, bytes).map_err(|error| error.to_string())?;

    Ok(destination.to_string_lossy().to_string())
}

#[tauri::command]
fn delete_persisted_file(path: String) -> Result<(), String> {
    match fs::remove_file(path) {
        Ok(_) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
async fn load_update_manifest(url: String) -> Result<String, String> {
    let response = reqwest::get(url)
        .await
        .map_err(|error| format!("Could not reach update manifest: {error}"))?;

    let status = response.status();
    if !status.is_success() {
        return Err(format!(
            "Could not load the published update manifest ({status})."
        ));
    }

    response
        .text()
        .await
        .map_err(|error| format!("Could not read update manifest body: {error}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            read_file_bytes,
            copy_file_into_app_data,
            write_bytes_into_app_data,
            write_bytes_to_path,
            write_text_to_path,
            write_backup_snapshot,
            write_backup_snapshot_text,
            get_desktop_storage_info,
            load_latest_local_backup,
            get_latest_local_backup_info,
            delete_persisted_file,
            open_path_in_file_manager,
            load_update_manifest
        ])
        .run(tauri::generate_context!())
        .expect("error while running NoteSmith desktop");
}
