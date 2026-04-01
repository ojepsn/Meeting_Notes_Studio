export const APP_SCHEMA_VERSION = 2;

export const sqliteBootstrapStatements = [
  `CREATE TABLE IF NOT EXISTS settings_local (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    payload_json TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    template_id TEXT NOT NULL,
    title TEXT NOT NULL,
    participant_text TEXT NOT NULL,
    session_date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    quick_highlights TEXT NOT NULL,
    detail_level INTEGER NOT NULL DEFAULT 3,
    manual_notes TEXT NOT NULL,
    live_transcript TEXT NOT NULL,
    uploaded_transcript TEXT NOT NULL,
    custom_field_values TEXT NOT NULL DEFAULT '{}',
    excluded_section_ids TEXT NOT NULL DEFAULT '[]',
    output_text TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS todos (
    id TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    is_done INTEGER NOT NULL,
    comments TEXT NOT NULL,
    created_at TEXT NOT NULL,
    payload_json TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_path TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );`
];
