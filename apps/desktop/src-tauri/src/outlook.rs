use keyring::Entry;
use reqwest::{Client, StatusCode, Url};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;

const CREDENTIAL_SERVICE: &str = "com.notesmith.desktop.outlook";
const CREDENTIAL_USER: &str = "calendar-sync";
const GRAPH_ROOT: &str = "https://graph.microsoft.com/v1.0";
const OUTLOOK_SCOPES: &str = "openid profile offline_access Calendars.Read";

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutlookConnectionConfig {
    tenant_id: String,
    client_id: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OutlookDeviceLoginChallenge {
    device_code: String,
    user_code: String,
    verification_uri: String,
    expires_in: u64,
    interval: u64,
    message: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OutlookDeviceLoginResult {
    status: String,
    message: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OutlookConnectionStatus {
    connected: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OutlookCalendarSyncResult {
    events: Vec<Value>,
    full_sync: bool,
    range_key: String,
    synced_at: String,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct OutlookCredentialBundle {
    tenant_id: String,
    client_id: String,
    refresh_token: String,
    delta_link: Option<String>,
    delta_range_key: Option<String>,
}

fn validate_config(config: &OutlookConnectionConfig) -> Result<(String, String), String> {
    let tenant_id = config.tenant_id.trim();
    let client_id = config.client_id.trim();
    if tenant_id.is_empty()
        || !tenant_id
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '.' | '_'))
    {
        return Err("Enter a valid Microsoft tenant id, domain, common, or organizations value.".to_string());
    }
    if client_id.is_empty()
        || !client_id
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '-')
    {
        return Err("Enter a valid Microsoft application client id.".to_string());
    }
    Ok((tenant_id.to_string(), client_id.to_string()))
}

fn credential_entry() -> Result<Entry, String> {
    Entry::new(CREDENTIAL_SERVICE, CREDENTIAL_USER)
        .map_err(|error| format!("Could not access the operating-system credential vault: {error}"))
}

fn load_credentials(config: &OutlookConnectionConfig) -> Result<Option<OutlookCredentialBundle>, String> {
    let (tenant_id, client_id) = validate_config(config)?;
    let password = match credential_entry()?.get_password() {
        Ok(value) => value,
        Err(keyring::Error::NoEntry) => return Ok(None),
        Err(error) => return Err(format!("Could not read the Outlook credential: {error}")),
    };
    let bundle: OutlookCredentialBundle = serde_json::from_str(&password)
        .map_err(|error| format!("The saved Outlook credential is invalid: {error}"))?;
    if bundle.tenant_id.eq_ignore_ascii_case(&tenant_id)
        && bundle.client_id.eq_ignore_ascii_case(&client_id)
    {
        Ok(Some(bundle))
    } else {
        Ok(None)
    }
}

fn save_credentials(bundle: &OutlookCredentialBundle) -> Result<(), String> {
    let serialized = serde_json::to_string(bundle)
        .map_err(|error| format!("Could not serialize the Outlook credential: {error}"))?;
    credential_entry()?
        .set_password(&serialized)
        .map_err(|error| format!("Could not save the Outlook credential securely: {error}"))
}

fn token_endpoint(tenant_id: &str) -> String {
    format!("https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token")
}

fn device_code_endpoint(tenant_id: &str) -> String {
    format!("https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/devicecode")
}

fn http_client() -> Result<Client, String> {
    Client::builder()
        .timeout(Duration::from_secs(60))
        .user_agent("NoteSmith Desktop Outlook read-only calendar sync")
        .build()
        .map_err(|error| format!("Could not create the Outlook sync client: {error}"))
}

fn error_description(payload: &Value, fallback: &str) -> String {
    payload
        .get("error_description")
        .and_then(Value::as_str)
        .or_else(|| payload.get("error").and_then(Value::as_str))
        .unwrap_or(fallback)
        .to_string()
}

#[tauri::command]
pub async fn outlook_begin_device_login(
    config: OutlookConnectionConfig,
) -> Result<OutlookDeviceLoginChallenge, String> {
    let (tenant_id, client_id) = validate_config(&config)?;
    let response = http_client()?
        .post(device_code_endpoint(&tenant_id))
        .form(&[("client_id", client_id.as_str()), ("scope", OUTLOOK_SCOPES)])
        .send()
        .await
        .map_err(|error| format!("Could not start Microsoft sign-in: {error}"))?;
    let status = response.status();
    let payload: Value = response
        .json()
        .await
        .map_err(|error| format!("Could not read the Microsoft sign-in response: {error}"))?;
    if !status.is_success() {
        return Err(error_description(&payload, "Microsoft sign-in could not be started."));
    }
    Ok(OutlookDeviceLoginChallenge {
        device_code: payload.get("device_code").and_then(Value::as_str).unwrap_or_default().to_string(),
        user_code: payload.get("user_code").and_then(Value::as_str).unwrap_or_default().to_string(),
        verification_uri: payload
            .get("verification_uri")
            .and_then(Value::as_str)
            .unwrap_or("https://microsoft.com/devicelogin")
            .to_string(),
        expires_in: payload.get("expires_in").and_then(Value::as_u64).unwrap_or(900),
        interval: payload.get("interval").and_then(Value::as_u64).unwrap_or(5),
        message: payload
            .get("message")
            .and_then(Value::as_str)
            .unwrap_or("Complete Microsoft sign-in in your browser.")
            .to_string(),
    })
}

#[tauri::command]
pub async fn outlook_poll_device_login(
    config: OutlookConnectionConfig,
    device_code: String,
) -> Result<OutlookDeviceLoginResult, String> {
    let (tenant_id, client_id) = validate_config(&config)?;
    let response = http_client()?
        .post(token_endpoint(&tenant_id))
        .form(&[
            ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
            ("client_id", client_id.as_str()),
            ("device_code", device_code.as_str()),
        ])
        .send()
        .await
        .map_err(|error| format!("Could not complete Microsoft sign-in: {error}"))?;
    let payload: Value = response
        .json()
        .await
        .map_err(|error| format!("Could not read the Microsoft token response: {error}"))?;
    if let Some(refresh_token) = payload.get("refresh_token").and_then(Value::as_str) {
        save_credentials(&OutlookCredentialBundle {
            tenant_id,
            client_id,
            refresh_token: refresh_token.to_string(),
            delta_link: None,
            delta_range_key: None,
        })?;
        return Ok(OutlookDeviceLoginResult {
            status: "connected".to_string(),
            message: "Outlook calendar connected with read-only access.".to_string(),
        });
    }

    let error = payload.get("error").and_then(Value::as_str).unwrap_or_default();
    let (status, message) = match error {
        "authorization_pending" | "slow_down" => ("pending", "Microsoft sign-in is still waiting for confirmation."),
        "authorization_declined" | "access_denied" => ("declined", "Microsoft sign-in was declined."),
        "expired_token" | "bad_verification_code" => ("expired", "The Microsoft sign-in code has expired. Start again."),
        _ => return Err(error_description(&payload, "Microsoft sign-in failed.")),
    };
    Ok(OutlookDeviceLoginResult { status: status.to_string(), message: message.to_string() })
}

#[tauri::command]
pub fn outlook_connection_status(
    config: OutlookConnectionConfig,
) -> Result<OutlookConnectionStatus, String> {
    Ok(OutlookConnectionStatus { connected: load_credentials(&config)?.is_some() })
}

#[tauri::command]
pub fn outlook_disconnect(config: OutlookConnectionConfig) -> Result<(), String> {
    validate_config(&config)?;
    match credential_entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(format!("Could not remove the Outlook credential: {error}")),
    }
}

async fn refresh_access_token(client: &Client, bundle: &mut OutlookCredentialBundle) -> Result<String, String> {
    let response = client
        .post(token_endpoint(&bundle.tenant_id))
        .form(&[
            ("grant_type", "refresh_token"),
            ("client_id", bundle.client_id.as_str()),
            ("refresh_token", bundle.refresh_token.as_str()),
            ("scope", OUTLOOK_SCOPES),
        ])
        .send()
        .await
        .map_err(|error| format!("Could not refresh Outlook access: {error}"))?;
    let status = response.status();
    let payload: Value = response
        .json()
        .await
        .map_err(|error| format!("Could not read the Outlook access response: {error}"))?;
    if !status.is_success() {
        return Err(error_description(&payload, "The Outlook connection has expired. Reconnect it in Settings."));
    }
    let access_token = payload
        .get("access_token")
        .and_then(Value::as_str)
        .ok_or_else(|| "Microsoft did not return an Outlook access token.".to_string())?
        .to_string();
    if let Some(refresh_token) = payload.get("refresh_token").and_then(Value::as_str) {
        bundle.refresh_token = refresh_token.to_string();
    }
    Ok(access_token)
}

fn initial_delta_url(start_date_time: &str, end_date_time: &str) -> Result<Url, String> {
    let mut url = Url::parse(&format!("{GRAPH_ROOT}/me/calendarView/delta"))
        .map_err(|error| format!("Could not construct the Outlook calendar URL: {error}"))?;
    url.query_pairs_mut()
        .append_pair("startDateTime", start_date_time)
        .append_pair("endDateTime", end_date_time);
    Ok(url)
}

fn validate_graph_url(value: &str) -> Result<Url, String> {
    let url = Url::parse(value).map_err(|error| format!("Microsoft returned an invalid calendar page URL: {error}"))?;
    if url.scheme() != "https" || url.host_str() != Some("graph.microsoft.com") {
        return Err("Microsoft returned an unexpected calendar page URL.".to_string());
    }
    Ok(url)
}

#[tauri::command]
pub async fn outlook_sync_calendar(
    config: OutlookConnectionConfig,
    start_date_time: String,
    end_date_time: String,
    range_key: String,
) -> Result<OutlookCalendarSyncResult, String> {
    validate_config(&config)?;
    let mut bundle = load_credentials(&config)?
        .ok_or_else(|| "Connect Outlook Calendar in Settings before syncing.".to_string())?;
    let client = http_client()?;
    let access_token = refresh_access_token(&client, &mut bundle).await?;
    let initial_url = initial_delta_url(&start_date_time, &end_date_time)?;
    let can_use_delta = bundle.delta_range_key.as_deref() == Some(range_key.as_str()) && bundle.delta_link.is_some();
    let mut full_sync = !can_use_delta;
    let mut next_url = if can_use_delta {
        validate_graph_url(bundle.delta_link.as_deref().unwrap_or_default())?
    } else {
        initial_url.clone()
    };
    let mut events = Vec::new();
    let mut final_delta_link: Option<String> = None;
    let mut restarted_after_expired_delta = false;

    for _ in 0..100 {
        let response = client
            .get(next_url.clone())
            .bearer_auth(&access_token)
            .header("Accept", "application/json")
            .header("Prefer", "IdType=\"ImmutableId\", outlook.timezone=\"Europe/Stockholm\"")
            .send()
            .await
            .map_err(|error| format!("Could not load the Outlook calendar: {error}"))?;

        if response.status() == StatusCode::GONE && !full_sync && !restarted_after_expired_delta {
            restarted_after_expired_delta = true;
            full_sync = true;
            events.clear();
            next_url = initial_url.clone();
            continue;
        }

        let status = response.status();
        let payload: Value = response
            .json()
            .await
            .map_err(|error| format!("Could not read the Outlook calendar response: {error}"))?;
        if !status.is_success() {
            return Err(error_description(&payload, &format!("Outlook calendar returned HTTP {status}.")));
        }
        if let Some(page_events) = payload.get("value").and_then(Value::as_array) {
            events.extend(page_events.iter().cloned());
        }
        if let Some(next_link) = payload.get("@odata.nextLink").and_then(Value::as_str) {
            next_url = validate_graph_url(next_link)?;
            continue;
        }
        final_delta_link = payload
            .get("@odata.deltaLink")
            .and_then(Value::as_str)
            .map(str::to_string);
        break;
    }

    let delta_link = final_delta_link.ok_or_else(|| "Outlook calendar pagination did not complete.".to_string())?;
    validate_graph_url(&delta_link)?;
    bundle.delta_link = Some(delta_link);
    bundle.delta_range_key = Some(range_key.clone());
    save_credentials(&bundle)?;

    let synced_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_default();
    Ok(OutlookCalendarSyncResult { events, full_sync, range_key, synced_at })
}

#[cfg(test)]
mod tests {
    use super::{
        initial_delta_url, validate_config, validate_graph_url, OutlookConnectionConfig,
        OUTLOOK_SCOPES,
    };

    #[test]
    fn requests_read_only_calendar_permission() {
        assert!(OUTLOOK_SCOPES.contains("Calendars.Read"));
        assert!(!OUTLOOK_SCOPES.contains("Calendars.ReadWrite"));
    }

    #[test]
    fn accepts_only_expected_graph_page_urls() {
        assert!(validate_graph_url("https://graph.microsoft.com/v1.0/me/calendarView/delta?$deltatoken=x").is_ok());
        assert!(validate_graph_url("http://graph.microsoft.com/v1.0/me/events").is_err());
        assert!(validate_graph_url("https://example.com/v1.0/me/events").is_err());
    }

    #[test]
    fn validates_identity_configuration() {
        assert!(validate_config(&OutlookConnectionConfig {
            tenant_id: "organizations".to_string(),
            client_id: "00000000-0000-0000-0000-000000000000".to_string(),
        }).is_ok());
        assert!(validate_config(&OutlookConnectionConfig {
            tenant_id: "../bad".to_string(),
            client_id: "client".to_string(),
        }).is_err());
    }

    #[test]
    fn builds_a_read_only_delta_url() {
        let url = initial_delta_url("2026-10-01T00:00:00Z", "2026-12-31T23:59:59Z").unwrap();
        assert_eq!(url.path(), "/v1.0/me/calendarView/delta");
        assert!(url.query().unwrap().contains("startDateTime"));
    }
}
