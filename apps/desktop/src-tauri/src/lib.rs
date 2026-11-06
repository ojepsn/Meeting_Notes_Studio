use flate2::write::DeflateEncoder;
use flate2::Compression;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;
use tauri::Manager;

mod calendar_import_mcp;

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

fn directory_has_entries(path: &Path) -> Result<bool, String> {
    if !path.exists() {
        return Ok(false);
    }

    Ok(fs::read_dir(path)
        .map_err(|error| error.to_string())?
        .next()
        .transpose()
        .map_err(|error| error.to_string())?
        .is_some())
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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LocalBackupFile {
    path: String,
    modified_ms: u64,
    bytes: Vec<u8>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct NativeHttpRequest {
    url: String,
    method: String,
    headers: HashMap<String, String>,
    body: String,
    timeout_ms: Option<u64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct NativeHttpResponse {
    status: u16,
    body: String,
    content_type: String,
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

    let needs_database_migration = !database_path.exists();
    let needs_attachment_migration = !directory_has_entries(&attachments_dir)?;
    let needs_backup_migration = !directory_has_entries(&backups_dir)?;

    if needs_database_migration {
        for candidate in candidate_database_paths(&app_config_dir, &app_data_dir) {
            copy_file_if_missing(&candidate, &database_path)?;
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
    }

    if needs_attachment_migration {
        copy_dir_contents_if_missing(&app_config_dir.join("attachments"), &attachments_dir)?;
        copy_dir_contents_if_missing(&app_data_dir.join("attachments"), &attachments_dir)?;
    }

    if needs_backup_migration {
        copy_dir_contents_if_missing(&app_config_dir.join("backups"), &backups_dir)?;
        copy_dir_contents_if_missing(&app_data_dir.join("backups"), &backups_dir)?;
    }

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

fn push_u16_le(output: &mut Vec<u8>, value: u16) {
    output.extend_from_slice(&value.to_le_bytes());
}

fn push_u32_le(output: &mut Vec<u8>, value: u32) {
    output.extend_from_slice(&value.to_le_bytes());
}

fn create_backup_zip_bytes(content: &str) -> Result<Vec<u8>, String> {
    const ZIP_BACKUP_JSON_NAME: &str = "notesmith-backup.json";
    let filename_bytes = ZIP_BACKUP_JSON_NAME.as_bytes();
    let original_bytes = content.as_bytes();
    if filename_bytes.len() > u16::MAX as usize {
        return Err("Backup filename is too long for a ZIP archive.".to_string());
    }
    if original_bytes.len() > u32::MAX as usize {
        return Err("Backup is too large for the current ZIP writer.".to_string());
    }

    let mut encoder = DeflateEncoder::new(Vec::new(), Compression::default());
    encoder
        .write_all(original_bytes)
        .map_err(|error| format!("Could not compress backup data: {error}"))?;
    let compressed_bytes = encoder
        .finish()
        .map_err(|error| format!("Could not finish backup compression: {error}"))?;
    if compressed_bytes.len() > u32::MAX as usize {
        return Err("Compressed backup is too large for the current ZIP writer.".to_string());
    }

    let crc = crc32fast::hash(original_bytes);
    let filename_length = filename_bytes.len() as u16;
    let compressed_size = compressed_bytes.len() as u32;
    let uncompressed_size = original_bytes.len() as u32;

    let mut output = Vec::with_capacity(30 + filename_bytes.len() + compressed_bytes.len() + 46 + filename_bytes.len() + 22);
    push_u32_le(&mut output, 0x04034b50);
    push_u16_le(&mut output, 20);
    push_u16_le(&mut output, 0x0800);
    push_u16_le(&mut output, 8);
    push_u16_le(&mut output, 0);
    push_u16_le(&mut output, 0);
    push_u32_le(&mut output, crc);
    push_u32_le(&mut output, compressed_size);
    push_u32_le(&mut output, uncompressed_size);
    push_u16_le(&mut output, filename_length);
    push_u16_le(&mut output, 0);
    output.extend_from_slice(filename_bytes);
    output.extend_from_slice(&compressed_bytes);

    let central_directory_offset = output.len() as u32;
    push_u32_le(&mut output, 0x02014b50);
    push_u16_le(&mut output, 20);
    push_u16_le(&mut output, 20);
    push_u16_le(&mut output, 0x0800);
    push_u16_le(&mut output, 8);
    push_u16_le(&mut output, 0);
    push_u16_le(&mut output, 0);
    push_u32_le(&mut output, crc);
    push_u32_le(&mut output, compressed_size);
    push_u32_le(&mut output, uncompressed_size);
    push_u16_le(&mut output, filename_length);
    push_u16_le(&mut output, 0);
    push_u16_le(&mut output, 0);
    push_u16_le(&mut output, 0);
    push_u16_le(&mut output, 0);
    push_u32_le(&mut output, 0);
    push_u32_le(&mut output, 0);
    output.extend_from_slice(filename_bytes);

    let central_directory_size = output.len() as u32 - central_directory_offset;
    push_u32_le(&mut output, 0x06054b50);
    push_u16_le(&mut output, 0);
    push_u16_le(&mut output, 0);
    push_u16_le(&mut output, 1);
    push_u16_le(&mut output, 1);
    push_u32_le(&mut output, central_directory_size);
    push_u32_le(&mut output, central_directory_offset);
    push_u16_le(&mut output, 0);

    Ok(output)
}

fn write_backup_zip_to_path(destination: &Path, content: &str) -> Result<(), String> {
    ensure_parent_dir(destination)?;
    let bytes = create_backup_zip_bytes(content)?;
    fs::write(destination, bytes).map_err(|error| error.to_string())
}

#[tauri::command]
fn write_backup_zip_to_path_command(path: String, content: String) -> Result<(), String> {
    write_backup_zip_to_path(&PathBuf::from(path), &content)
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
fn write_backup_snapshot_zip(app: tauri::AppHandle, filename: String, content: String) -> Result<String, String> {
    let storage = prepare_storage(&app)?;

    let destination = PathBuf::from(storage.backups_dir).join(filename);
    write_backup_zip_to_path(&destination, &content)?;

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

fn find_recent_local_backups(
    backups_dir: &Path,
    limit: usize,
) -> Result<Vec<(std::time::SystemTime, PathBuf)>, String> {
    if !backups_dir.exists() {
        return Ok(Vec::new());
    }

    let mut files = Vec::new();
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
        files.push((modified, path));
    }

    files.sort_by(|left, right| right.0.cmp(&left.0));
    files.truncate(limit);
    Ok(files)
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
fn load_recent_local_backups(
    app: tauri::AppHandle,
    limit: Option<u32>,
) -> Result<Vec<LocalBackupFile>, String> {
    let storage = prepare_storage(&app)?;
    let backups_dir = PathBuf::from(storage.backups_dir);
    let max_files = limit.unwrap_or(10).clamp(1, 50) as usize;

    find_recent_local_backups(&backups_dir, max_files)?
        .into_iter()
        .map(|(modified, path)| {
            let modified_ms = modified
                .duration_since(std::time::SystemTime::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64;
            let bytes = fs::read(&path).map_err(|error| error.to_string())?;
            Ok(LocalBackupFile {
                path: path.to_string_lossy().to_string(),
                modified_ms,
                bytes,
            })
        })
        .collect()
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
fn reveal_path_in_file_manager(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(format!("/select,{}", path))
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg("-R")
            .arg(path)
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    #[cfg(target_os = "linux")]
    {
        let target = PathBuf::from(path);
        let folder = target
            .parent()
            .unwrap_or_else(|| Path::new("."))
            .to_string_lossy()
            .to_string();
        Command::new("xdg-open")
            .arg(folder)
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    #[allow(unreachable_code)]
    Err("Opening the installer location is not supported on this platform.".to_string())
}

#[tauri::command]
fn open_url_in_default_browser(url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("rundll32")
            .arg("url.dll,FileProtocolHandler")
            .arg(url)
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(url)
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(url)
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    #[allow(unreachable_code)]
    Err("Opening URLs is not supported on this platform.".to_string())
}

#[tauri::command]
fn launch_installer_file(path: String) -> Result<(), String> {
    let installer = PathBuf::from(&path);
    if !installer.is_file() {
        return Err(format!("Installer was not found at {path}."));
    }

    #[cfg(target_os = "windows")]
    {
        Command::new(installer)
            .spawn()
            .map_err(|error| format!("Could not launch installer: {error}"))?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(installer)
            .spawn()
            .map_err(|error| format!("Could not open installer: {error}"))?;
        return Ok(());
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(installer)
            .spawn()
            .map_err(|error| format!("Could not open installer: {error}"))?;
        return Ok(());
    }

    #[allow(unreachable_code)]
    Err("Launching installers is not supported on this platform.".to_string())
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

#[tauri::command]
async fn download_url_to_path(url: String, path: String) -> Result<String, String> {
    let destination = PathBuf::from(path);
    ensure_parent_dir(&destination)?;

    let response = reqwest::get(&url)
        .await
        .map_err(|error| format!("Could not download installer: {error}"))?;
    if !response.status().is_success() {
        return Err(format!(
            "Could not download installer from GitHub ({}).",
            response.status()
        ));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|error| format!("Could not read installer download: {error}"))?;
    fs::write(&destination, bytes).map_err(|error| error.to_string())?;

    Ok(destination.to_string_lossy().to_string())
}

fn validate_openai_model_doc_url(value: &str) -> Result<reqwest::Url, String> {
    let url = reqwest::Url::parse(value)
        .map_err(|error| format!("Invalid OpenAI documentation URL: {error}"))?;
    if url.scheme() != "https"
        || url.host_str() != Some("developers.openai.com")
        || !url.path().starts_with("/api/docs/")
    {
        return Err("Only official OpenAI API documentation URLs are allowed.".to_string());
    }
    Ok(url)
}

#[tauri::command]
async fn load_openai_model_document(url: String) -> Result<String, String> {
    let validated_url = validate_openai_model_doc_url(&url)?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .user_agent("NoteSmith Desktop model catalog refresh")
        .build()
        .map_err(|error| format!("Could not create OpenAI documentation client: {error}"))?;
    let response = client
        .get(validated_url)
        .header("Accept", "text/html,application/xhtml+xml")
        .send()
        .await
        .map_err(|error| format!("Could not load OpenAI model documentation: {error}"))?;

    validate_openai_model_doc_url(response.url().as_str())?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!(
            "OpenAI model documentation returned HTTP {status}."
        ));
    }

    response
        .text()
        .await
        .map_err(|error| format!("Could not read OpenAI model documentation: {error}"))
}

#[tauri::command]
async fn openai_http_request(request: NativeHttpRequest) -> Result<NativeHttpResponse, String> {
    let method = reqwest::Method::from_bytes(request.method.as_bytes())
        .map_err(|error| format!("Unsupported HTTP method: {error}"))?;

    let mut header_map = HeaderMap::new();
    for (key, value) in request.headers {
        let name = HeaderName::from_bytes(key.as_bytes())
            .map_err(|error| format!("Invalid header name '{key}': {error}"))?;
        let header_value = HeaderValue::from_str(&value)
            .map_err(|error| format!("Invalid header value for '{key}': {error}"))?;
        header_map.insert(name, header_value);
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_millis(request.timeout_ms.unwrap_or(45_000)))
        .build()
        .map_err(|error| format!("Could not create HTTP client: {error}"))?;

    let response = client
        .request(method, &request.url)
        .headers(header_map)
        .body(request.body)
        .send()
        .await
        .map_err(|error| format!("Could not reach OpenAI: {error}"))?;

    let status = response.status().as_u16();
    let content_type = response
        .headers()
        .get(CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("application/json")
        .to_string();
    let body = response
        .text()
        .await
        .map_err(|error| format!("Could not read OpenAI response body: {error}"))?;

    Ok(NativeHttpResponse {
        status,
        body,
        content_type,
    })
}


#[cfg(test)]
mod tests {
    use super::validate_openai_model_doc_url;

    #[test]
    fn model_document_urls_are_restricted_to_official_api_docs() {
        assert!(validate_openai_model_doc_url(
            "https://developers.openai.com/api/docs/models/compare"
        )
        .is_ok());
        assert!(validate_openai_model_doc_url("http://developers.openai.com/api/docs/models").is_err());
        assert!(validate_openai_model_doc_url("https://example.com/api/docs/models").is_err());
        assert!(validate_openai_model_doc_url("https://developers.openai.com/other").is_err());
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(calendar_import_mcp::CalendarImportMcpState::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            read_file_bytes,
            copy_file_into_app_data,
            write_bytes_into_app_data,
            write_bytes_to_path,
            write_text_to_path,
            write_backup_zip_to_path_command,
            write_backup_snapshot,
            write_backup_snapshot_text,
            write_backup_snapshot_zip,
            get_desktop_storage_info,
            load_latest_local_backup,
            load_recent_local_backups,
            get_latest_local_backup_info,
            delete_persisted_file,
            open_path_in_file_manager,
            reveal_path_in_file_manager,
            open_url_in_default_browser,
            launch_installer_file,
            load_update_manifest,
            download_url_to_path,
            load_openai_model_document,
            openai_http_request,
            calendar_import_mcp::start_calendar_import_mcp,
            calendar_import_mcp::stop_calendar_import_mcp,
            calendar_import_mcp::get_calendar_import_mcp_status,
            calendar_import_mcp::complete_calendar_import_mcp,
            calendar_import_mcp::complete_notesmith_search_mcp
        ])
        .run(tauri::generate_context!())
        .expect("error while running NoteSmith desktop");
}
