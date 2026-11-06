use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{Emitter, Manager};
use uuid::Uuid;

const MCP_PORT: u16 = 47832;
const MAX_BODY_BYTES: usize = 2 * 1024 * 1024;
const MAX_EVENTS: usize = 500;
pub const CALENDAR_IMPORT_EVENT: &str = "notesmith-calendar-import-request";
pub const SEARCH_EVENT: &str = "notesmith-search-request";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarImportMcpReady {
    endpoint_url: String,
    host: String,
    port: u16,
    tool_name: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct CalendarImportEvent {
    external_id: String,
    #[serde(default)]
    i_cal_uid: String,
    title: String,
    start_date_time: String,
    end_date_time: String,
    #[serde(default)]
    attendee_names: Vec<String>,
    #[serde(default)]
    location: String,
    #[serde(default)]
    is_private: bool,
    #[serde(default)]
    is_cancelled: bool,
    #[serde(default)]
    last_modified_date_time: String,
    #[serde(default)]
    web_link: String,
    #[serde(default)]
    online_meeting_url: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CalendarImportToolArgs {
    events: Vec<CalendarImportEvent>,
    complete_snapshot: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CalendarImportRequest {
    request_id: String,
    events: Vec<CalendarImportEvent>,
    complete_snapshot: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SearchRequest {
    request_id: String,
    tool_name: String,
    arguments: Value,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarImportResult {
    created: u64,
    updated: u64,
    removed: u64,
    unchanged: u64,
    skipped: u64,
}

struct CalendarImportServer {
    ready: CalendarImportMcpReady,
    shutdown: Arc<AtomicBool>,
}

#[derive(Default)]
pub struct CalendarImportMcpState {
    server: Mutex<Option<CalendarImportServer>>,
    pending: Arc<Mutex<HashMap<String, mpsc::Sender<Result<CalendarImportResult, String>>>>>,
    search_pending: Arc<Mutex<HashMap<String, mpsc::Sender<Result<Value, String>>>>>,
}

impl CalendarImportMcpState {
    fn stop(&self) {
        if let Ok(mut guard) = self.server.lock() {
            if let Some(server) = guard.take() {
                server.shutdown.store(true, Ordering::SeqCst);
                let _ = TcpStream::connect((server.ready.host.as_str(), server.ready.port));
            }
        }
    }
}

impl Drop for CalendarImportMcpState {
    fn drop(&mut self) {
        self.stop();
    }
}

fn token_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let directory = app.path().app_local_data_dir().map_err(|error| error.to_string())?;
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    Ok(directory.join("calendar-import-mcp-token"))
}

fn load_or_create_token(app: &tauri::AppHandle) -> Result<String, String> {
    let path = token_path(app)?;
    if let Ok(value) = fs::read_to_string(&path) {
        let token = value.trim();
        if token.len() >= 32 && token.chars().all(|character| character.is_ascii_hexdigit()) {
            return Ok(token.to_string());
        }
    }
    let token = Uuid::new_v4().simple().to_string();
    fs::write(path, &token).map_err(|error| format!("Could not save the local MCP token: {error}"))?;
    Ok(token)
}

fn write_response(stream: &mut TcpStream, status: &str, content_type: &str, body: &str) {
    let response = format!(
        "HTTP/1.1 {status}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nConnection: close\r\nCache-Control: no-store\r\n\r\n{body}",
        body.as_bytes().len()
    );
    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();
}

fn rpc_error(id: Value, code: i64, message: impl Into<String>) -> Value {
    json!({ "jsonrpc": "2.0", "id": id, "error": { "code": code, "message": message.into() } })
}

fn tool_descriptor() -> Value {
    json!({
        "name": "notesmith_reconcile_outlook_calendar",
        "description": "Import a complete Outlook calendar snapshot into the locally running NoteSmith desktop app. Use the Outlook Calendar connector to retrieve events starting today through six days later (seven calendar days total), then call this tool once with the complete snapshot. Do not include past events or events outside that window. Repeated calls are idempotent; NoteSmith reconciles additions, changes, and removals by external event id while preserving local NoteSmith notes, sessions, classifications, and timelogs.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "events": {
                    "type": "array",
                    "maxItems": MAX_EVENTS,
                    "description": "Every Outlook event in the seven-day window. Supply an empty array when the calendar has no events.",
                    "items": {
                        "type": "object",
                        "properties": {
                            "externalId": { "type": "string", "description": "Stable Outlook event id." },
                            "iCalUId": { "type": "string", "description": "Outlook iCalUId when available." },
                            "title": { "type": "string" },
                            "startDateTime": { "type": "string", "description": "Local event date and time in ISO format." },
                            "endDateTime": { "type": "string", "description": "Local event date and time in ISO format." },
                            "attendeeNames": { "type": "array", "items": { "type": "string" } },
                            "location": { "type": "string" },
                            "isPrivate": { "type": "boolean" },
                            "isCancelled": { "type": "boolean" },
                            "lastModifiedDateTime": { "type": "string" },
                            "webLink": { "type": "string" },
                            "onlineMeetingUrl": { "type": "string" }
                        },
                        "required": ["externalId", "title", "startDateTime", "endDateTime"],
                        "additionalProperties": false
                    }
                },
                "completeSnapshot": {
                    "type": "boolean",
                    "const": true,
                    "description": "Must be true. Missing previously imported events are removed only for a complete snapshot."
                }
            },
            "required": ["events", "completeSnapshot"],
            "additionalProperties": false
        },
        "annotations": {
            "title": "Import Outlook calendar into NoteSmith",
            "readOnlyHint": false,
            "destructiveHint": false,
            "idempotentHint": true,
            "openWorldHint": false
        }
    })
}

fn search_schema(description: &str) -> Value {
    json!({
        "type": "object",
        "properties": {
            "query": { "type": "string", "description": description, "maxLength": 500 },
            "includePrivate": { "type": "boolean", "default": false, "description": "Set to true only when the user explicitly asks to search private NoteSmith records." },
            "limit": { "type": "integer", "minimum": 1, "maximum": 30, "default": 8 }
        },
        "required": ["query"],
        "additionalProperties": false
    })
}

fn id_schema(description: &str) -> Value {
    json!({
        "type": "object",
        "properties": {
            "id": { "type": "string", "description": description, "maxLength": 200 },
            "includePrivate": { "type": "boolean", "default": false, "description": "Set to true only when the user explicitly asks to retrieve private NoteSmith records." }
        },
        "required": ["id"],
        "additionalProperties": false
    })
}

fn date_range_schema(description: &str) -> Value {
    json!({
        "type": "object",
        "properties": {
            "fromDate": { "type": "string", "description": format!("{description} Start date in YYYY-MM-DD format.") },
            "toDate": { "type": "string", "description": format!("{description} End date in YYYY-MM-DD format.") },
            "includePrivate": { "type": "boolean", "default": false, "description": "Set to true only when the user explicitly asks to include private NoteSmith records." },
            "limit": { "type": "integer", "minimum": 1, "maximum": 30, "default": 12 }
        },
        "required": ["fromDate", "toDate"],
        "additionalProperties": false
    })
}

fn read_tool(name: &str, description: &str, input_schema: Value) -> Value {
    json!({
        "name": name,
        "description": format!("{description} Private records are excluded by default and may be included only when the user explicitly requests them."),
        "inputSchema": input_schema,
        "annotations": {
            "title": description,
            "readOnlyHint": true,
            "destructiveHint": false,
            "idempotentHint": true,
            "openWorldHint": false
        }
    })
}

fn read_tool_descriptors() -> Vec<Value> {
    vec![
        read_tool("notesmith_search_sessions", "Search NoteSmith sessions, meeting notes, transcripts, outputs, participants, domains, and projects.", search_schema("Search text for sessions and meeting notes.")),
        read_tool("notesmith_get_session", "Retrieve one NoteSmith session and its linked context by id.", id_schema("The NoteSmith session id.")),
        read_tool("notesmith_search_calendar", "Search NoteSmith calendar items and linked titles.", search_schema("Search text for calendar items.")),
        read_tool("notesmith_search_todos", "Search NoteSmith todos and their details, classification, and dates.", search_schema("Search text for todos.")),
        read_tool("notesmith_search_activities", "Search NoteSmith activities and meetings.", search_schema("Search text for activities and meetings.")),
        read_tool("notesmith_search_timelogs", "Search NoteSmith timelogs and linked work items.", search_schema("Search text for timelogs.")),
        read_tool("notesmith_get_calendar_by_date_range", "Retrieve NoteSmith calendar items for a date range.", date_range_schema("Calendar lookup.")),
        read_tool("notesmith_get_timelogs_by_date_range", "Retrieve NoteSmith timelogs and grouped totals for a date range.", date_range_schema("Timelog lookup.")),
        read_tool("notesmith_get_linked_context", "Retrieve linked context for a NoteSmith session or activity.", id_schema("A NoteSmith session or activity id.")),
        read_tool("notesmith_summarize_workspace", "Summarize visible NoteSmith workspace record counts.", json!({
            "type": "object",
            "properties": {
                "includePrivate": { "type": "boolean", "default": false, "description": "Set to true only when the user explicitly asks to include private NoteSmith records." }
            },
            "additionalProperties": false
        })),
    ]
}

fn is_read_tool(name: &str) -> bool {
    read_tool_descriptors().iter().any(|tool| tool["name"] == name)
}

fn validate_args(args: CalendarImportToolArgs) -> Result<CalendarImportToolArgs, String> {
    if !args.complete_snapshot {
        return Err("completeSnapshot must be true so NoteSmith can safely reconcile removals.".to_string());
    }
    if args.events.len() > MAX_EVENTS {
        return Err(format!("The seven-day import is limited to {MAX_EVENTS} events."));
    }
    for event in &args.events {
        if event.external_id.trim().is_empty() || event.external_id.len() > 512 {
            return Err("Every event needs a valid externalId.".to_string());
        }
        if event.title.len() > 1_000 || event.start_date_time.len() > 80 || event.end_date_time.len() > 80 {
            return Err("An event title or date-time value exceeds the supported size.".to_string());
        }
        if event.attendee_names.len() > 200 || event.attendee_names.iter().any(|name| name.len() > 320) {
            return Err("An event contains too many attendees or an oversized attendee name.".to_string());
        }
    }
    Ok(args)
}

fn handle_rpc(
    app: &tauri::AppHandle,
    pending: &Arc<Mutex<HashMap<String, mpsc::Sender<Result<CalendarImportResult, String>>>>>,
    search_pending: &Arc<Mutex<HashMap<String, mpsc::Sender<Result<Value, String>>>>>,
    request: Value,
) -> Option<Value> {
    let id = request.get("id").cloned().unwrap_or(Value::Null);
    let method = request.get("method").and_then(Value::as_str).unwrap_or_default();
    if request.get("id").is_none() {
        return None;
    }
    match method {
        "initialize" => Some(json!({
            "jsonrpc": "2.0",
            "id": id,
            "result": {
                "protocolVersion": "2025-03-26",
                "capabilities": { "tools": {} },
                "serverInfo": { "name": "notesmith-local", "version": "1.1.0" },
                "instructions": "This local server exposes read-only NoteSmith search tools that always exclude private records, plus one separate Outlook calendar import action. It cannot communicate with Outlook itself and never exposes raw SQL."
            }
        })),
        "ping" => Some(json!({ "jsonrpc": "2.0", "id": id, "result": {} })),
        "tools/list" => {
            let mut tools = read_tool_descriptors();
            tools.push(tool_descriptor());
            Some(json!({
                "jsonrpc": "2.0",
                "id": id,
                "result": { "tools": tools }
            }))
        }
        "tools/call" => {
            let params = request.get("params").cloned().unwrap_or_else(|| json!({}));
            let tool_name = params.get("name").and_then(Value::as_str).unwrap_or_default();
            if is_read_tool(tool_name) {
                let arguments = params.get("arguments").cloned().unwrap_or_else(|| json!({}));
                let request_id = Uuid::new_v4().to_string();
                let (sender, receiver) = mpsc::channel();
                if let Ok(mut guard) = search_pending.lock() {
                    guard.insert(request_id.clone(), sender);
                } else {
                    return Some(rpc_error(id, -32603, "The NoteSmith search queue is unavailable."));
                }
                let payload = SearchRequest { request_id: request_id.clone(), tool_name: tool_name.to_string(), arguments };
                if let Err(error) = app.emit(SEARCH_EVENT, payload) {
                    if let Ok(mut guard) = search_pending.lock() { guard.remove(&request_id); }
                    return Some(rpc_error(id, -32603, format!("Could not reach the NoteSmith window: {error}")));
                }
                return match receiver.recv_timeout(Duration::from_secs(30)) {
                    Ok(Ok(result)) => Some(json!({
                        "jsonrpc": "2.0", "id": id,
                        "result": { "content": [{ "type": "text", "text": result.to_string() }], "structuredContent": result, "isError": false }
                    })),
                    Ok(Err(error)) => Some(json!({
                        "jsonrpc": "2.0", "id": id,
                        "result": { "content": [{ "type": "text", "text": error }], "isError": true }
                    })),
                    Err(_) => {
                        if let Ok(mut guard) = search_pending.lock() { guard.remove(&request_id); }
                        Some(rpc_error(id, -32603, "NoteSmith did not complete the search within 30 seconds."))
                    }
                };
            }
            if tool_name != "notesmith_reconcile_outlook_calendar" {
                return Some(rpc_error(id, -32602, "Unknown NoteSmith MCP tool."));
            }
            let raw_args = params.get("arguments").cloned().unwrap_or_else(|| json!({}));
            let args: CalendarImportToolArgs = match serde_json::from_value(raw_args) {
                Ok(value) => value,
                Err(error) => return Some(rpc_error(id, -32602, format!("Invalid calendar import: {error}"))),
            };
            let args = match validate_args(args) {
                Ok(value) => value,
                Err(error) => return Some(rpc_error(id, -32602, error)),
            };
            let request_id = Uuid::new_v4().to_string();
            let (sender, receiver) = mpsc::channel();
            if let Ok(mut guard) = pending.lock() {
                guard.insert(request_id.clone(), sender);
            } else {
                return Some(rpc_error(id, -32603, "The NoteSmith import queue is unavailable."));
            }
            let payload = CalendarImportRequest {
                request_id: request_id.clone(),
                events: args.events,
                complete_snapshot: args.complete_snapshot,
            };
            if let Err(error) = app.emit(CALENDAR_IMPORT_EVENT, payload) {
                if let Ok(mut guard) = pending.lock() {
                    guard.remove(&request_id);
                }
                return Some(rpc_error(id, -32603, format!("Could not reach the NoteSmith window: {error}")));
            }
            match receiver.recv_timeout(Duration::from_secs(60)) {
                Ok(Ok(result)) => {
                    let text = format!(
                        "NoteSmith calendar updated: {} added, {} updated, {} removed, {} unchanged, {} skipped.",
                        result.created, result.updated, result.removed, result.unchanged, result.skipped
                    );
                    Some(json!({
                        "jsonrpc": "2.0",
                        "id": id,
                        "result": {
                            "content": [{ "type": "text", "text": text }],
                            "structuredContent": result,
                            "isError": false
                        }
                    }))
                }
                Ok(Err(error)) => Some(json!({
                    "jsonrpc": "2.0",
                    "id": id,
                    "result": { "content": [{ "type": "text", "text": error }], "isError": true }
                })),
                Err(_) => {
                    if let Ok(mut guard) = pending.lock() {
                        guard.remove(&request_id);
                    }
                    Some(rpc_error(id, -32603, "NoteSmith did not complete the import within 60 seconds."))
                }
            }
        }
        _ => Some(rpc_error(id, -32601, "Method not found.")),
    }
}

fn handle_connection(
    mut stream: TcpStream,
    app: tauri::AppHandle,
    pending: Arc<Mutex<HashMap<String, mpsc::Sender<Result<CalendarImportResult, String>>>>>,
    search_pending: Arc<Mutex<HashMap<String, mpsc::Sender<Result<Value, String>>>>>,
    expected_path: String,
) {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(10)));
    let reader_stream = match stream.try_clone() {
        Ok(value) => value,
        Err(_) => return,
    };
    let mut reader = BufReader::new(reader_stream);
    let mut request_line = String::new();
    if reader.read_line(&mut request_line).is_err() {
        return;
    }
    let mut parts = request_line.split_whitespace();
    let method = parts.next().unwrap_or_default();
    let path = parts.next().unwrap_or_default();
    let mut content_length = 0usize;
    loop {
        let mut line = String::new();
        if reader.read_line(&mut line).is_err() || line == "\r\n" || line.is_empty() {
            break;
        }
        if let Some(value) = line.strip_prefix("Content-Length:").or_else(|| line.strip_prefix("content-length:")) {
            content_length = value.trim().parse().unwrap_or(0);
        }
    }
    if path != expected_path {
        write_response(&mut stream, "404 Not Found", "text/plain", "Not found");
        return;
    }
    if method != "POST" {
        write_response(&mut stream, "405 Method Not Allowed", "text/plain", "POST required");
        return;
    }
    if content_length == 0 || content_length > MAX_BODY_BYTES {
        write_response(&mut stream, "413 Payload Too Large", "text/plain", "Invalid request size");
        return;
    }
    let mut body = vec![0u8; content_length];
    if reader.read_exact(&mut body).is_err() {
        write_response(&mut stream, "400 Bad Request", "text/plain", "Incomplete request");
        return;
    }
    let request: Value = match serde_json::from_slice(&body) {
        Ok(value) => value,
        Err(_) => {
            write_response(&mut stream, "400 Bad Request", "application/json", &rpc_error(Value::Null, -32700, "Parse error.").to_string());
            return;
        }
    };
    match handle_rpc(&app, &pending, &search_pending, request) {
        Some(response) => write_response(&mut stream, "200 OK", "application/json", &response.to_string()),
        None => write_response(&mut stream, "202 Accepted", "text/plain", ""),
    }
}

#[tauri::command]
pub fn start_calendar_import_mcp(
    app: tauri::AppHandle,
    state: tauri::State<CalendarImportMcpState>,
) -> Result<CalendarImportMcpReady, String> {
    let mut guard = state.server.lock().map_err(|_| "The MCP server state is unavailable.".to_string())?;
    if let Some(server) = guard.as_ref() {
        return Ok(server.ready.clone());
    }
    let token = load_or_create_token(&app)?;
    let expected_path = format!("/mcp/{token}");
    let listener = TcpListener::bind(("127.0.0.1", MCP_PORT)).map_err(|error| {
        format!("Could not start the local NoteSmith MCP endpoint on port {MCP_PORT}: {error}")
    })?;
    listener.set_nonblocking(true).map_err(|error| error.to_string())?;
    let ready = CalendarImportMcpReady {
        endpoint_url: format!("http://127.0.0.1:{MCP_PORT}{expected_path}"),
        host: "127.0.0.1".to_string(),
        port: MCP_PORT,
        tool_name: "notesmith_reconcile_outlook_calendar".to_string(),
    };
    let shutdown = Arc::new(AtomicBool::new(false));
    let thread_shutdown = Arc::clone(&shutdown);
    let pending = Arc::clone(&state.pending);
    let search_pending = Arc::clone(&state.search_pending);
    thread::spawn(move || {
        while !thread_shutdown.load(Ordering::SeqCst) {
            match listener.accept() {
                Ok((stream, _)) => {
                    let request_app = app.clone();
                    let request_pending = Arc::clone(&pending);
                    let request_search_pending = Arc::clone(&search_pending);
                    let request_path = expected_path.clone();
                    thread::spawn(move || handle_connection(stream, request_app, request_pending, request_search_pending, request_path));
                }
                Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                    thread::sleep(Duration::from_millis(50));
                }
                Err(_) => break,
            }
        }
    });
    *guard = Some(CalendarImportServer { ready: ready.clone(), shutdown });
    Ok(ready)
}

#[tauri::command]
pub fn stop_calendar_import_mcp(state: tauri::State<CalendarImportMcpState>) -> Result<(), String> {
    state.stop();
    Ok(())
}

#[tauri::command]
pub fn get_calendar_import_mcp_status(
    state: tauri::State<CalendarImportMcpState>,
) -> Result<Option<CalendarImportMcpReady>, String> {
    let guard = state.server.lock().map_err(|_| "The MCP server state is unavailable.".to_string())?;
    Ok(guard.as_ref().map(|server| server.ready.clone()))
}

#[tauri::command]
pub fn complete_calendar_import_mcp(
    state: tauri::State<CalendarImportMcpState>,
    request_id: String,
    result: Option<CalendarImportResult>,
    error: Option<String>,
) -> Result<(), String> {
    let sender = state
        .pending
        .lock()
        .map_err(|_| "The MCP import queue is unavailable.".to_string())?
        .remove(&request_id)
        .ok_or_else(|| "The MCP import request is no longer pending.".to_string())?;
    let response = match result {
        Some(value) => Ok(value),
        None => Err(error.unwrap_or_else(|| "The NoteSmith calendar import failed.".to_string())),
    };
    sender.send(response).map_err(|_| "The MCP caller is no longer waiting.".to_string())
}

#[tauri::command]
pub fn complete_notesmith_search_mcp(
    state: tauri::State<CalendarImportMcpState>,
    request_id: String,
    result: Option<Value>,
    error: Option<String>,
) -> Result<(), String> {
    let sender = state
        .search_pending
        .lock()
        .map_err(|_| "The NoteSmith search queue is unavailable.".to_string())?
        .remove(&request_id)
        .ok_or_else(|| "The MCP search request is no longer pending.".to_string())?;
    let response = match result {
        Some(value) => Ok(value),
        None => Err(error.unwrap_or_else(|| "The NoteSmith search failed.".to_string())),
    };
    sender.send(response).map_err(|_| "The MCP caller is no longer waiting.".to_string())
}

#[cfg(test)]
mod tests {
    use super::{read_tool_descriptors, tool_descriptor, validate_args, CalendarImportEvent, CalendarImportToolArgs, MAX_EVENTS};

    #[test]
    fn exposes_only_the_narrow_calendar_import_contract() {
        let descriptor = tool_descriptor();
        assert_eq!(descriptor["name"], "notesmith_reconcile_outlook_calendar");
        assert_eq!(descriptor["annotations"]["readOnlyHint"], false);
        assert_eq!(descriptor["annotations"]["destructiveHint"], false);
        assert_eq!(descriptor["inputSchema"]["properties"]["events"]["maxItems"], MAX_EVENTS);
    }

    #[test]
    fn rejects_partial_snapshots() {
        let result = validate_args(CalendarImportToolArgs { events: vec![], complete_snapshot: false });
        assert!(result.is_err());
    }

    #[test]
    fn accepts_a_minimal_complete_event_snapshot() {
        let result = validate_args(CalendarImportToolArgs {
            complete_snapshot: true,
            events: vec![CalendarImportEvent {
                external_id: "event-1".to_string(),
                i_cal_uid: String::new(),
                title: "Planning".to_string(),
                start_date_time: "2026-10-27T09:00:00".to_string(),
                end_date_time: "2026-10-27T09:30:00".to_string(),
                attendee_names: vec![],
                location: String::new(),
                is_private: false,
                is_cancelled: false,
                last_modified_date_time: String::new(),
                web_link: String::new(),
                online_meeting_url: String::new(),
            }],
        });
        assert!(result.is_ok());
    }

    #[test]
    fn exposes_search_tools_as_read_only() {
        let tools = read_tool_descriptors();
        assert_eq!(tools.len(), 10);
        assert!(tools.iter().all(|tool| tool["annotations"]["readOnlyHint"] == true));
        assert!(tools.iter().all(|tool| tool["annotations"]["destructiveHint"] == false));
        let session_search = tools.iter().find(|tool| tool["name"] == "notesmith_search_sessions").unwrap();
        assert_eq!(session_search["inputSchema"]["properties"]["includePrivate"]["default"], false);
    }
}
