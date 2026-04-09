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
            write_backup_snapshot,
            delete_persisted_file,
            open_path_in_file_manager,
            load_update_manifest
        ])
        .run(tauri::generate_context!())
        .expect("error while running NoteSmith desktop");
}
