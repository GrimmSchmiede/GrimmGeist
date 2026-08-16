//! GrimmGeist CLI - "ask" mode only (v1): streams a one-shot prompt's reply from Gemini to stdout.
//!
//! Deliberately does NOT touch the workspace/file-action side of GrimmGeist. That machinery
//! (precise edits, backups, approval flows, diff review, undo, conflict detection) is deeply
//! tied to the GUI (Monaco editor, DOM confirmation dialogs) - reimplementing an equivalent
//! safety experience in a terminal is a separate, larger effort, not a v1 add-on. This binary
//! reuses only what's genuinely shared: reading the same API key from the OS keychain that the
//! GUI app stores (see `grimmgeist_lib::load_api_key`), so there's no separate credential setup.
//!
//! Usage: grimmgeist-cli [-m|--model <name>] "<prompt>"

use futures_util::StreamExt;
use grimmgeist_lib::read_stored_api_key;
use serde_json::{json, Value};
use std::io::Write;

const DEFAULT_MODEL: &str = "gemini-flash-latest";
const SAFETY_CATEGORIES: &[&str] = &[
    "HARM_CATEGORY_HARASSMENT",
    "HARM_CATEGORY_HATE_SPEECH",
    "HARM_CATEGORY_SEXUALLY_EXPLICIT",
    "HARM_CATEGORY_DANGEROUS_CONTENT",
];

fn print_usage() {
    eprintln!("Usage: grimmgeist-cli [-m|--model <name>] \"<prompt>\"");
    eprintln!();
    eprintln!("Sends a one-shot prompt to Gemini using the API key already stored by the");
    eprintln!("GrimmGeist desktop app (Settings -> API key) and streams the reply to stdout.");
    eprintln!("Ask-mode only - no workspace/file access from the CLI.");
}

fn parse_args() -> Result<(String, String), String> {
    let mut model = DEFAULT_MODEL.to_string();
    let mut prompt: Option<String> = None;
    let mut args = std::env::args().skip(1);

    while let Some(arg) = args.next() {
        match arg.as_str() {
            "-m" | "--model" => {
                model = args.next().ok_or("--model braucht einen Wert (z. B. gemini-3.1-flash-lite).")?;
            }
            "-h" | "--help" => {
                print_usage();
                std::process::exit(0);
            }
            other => {
                if prompt.is_some() {
                    return Err("Nur ein Prompt-Argument erlaubt - bei mehreren Wörtern in Anführungszeichen setzen.".into());
                }
                prompt = Some(other.to_string());
            }
        }
    }

    let prompt = prompt.ok_or("Kein Prompt angegeben.")?;
    Ok((model, prompt))
}

#[tokio::main]
async fn main() {
    let (model, prompt) = match parse_args() {
        Ok(v) => v,
        Err(e) => {
            eprintln!("Fehler: {e}\n");
            print_usage();
            std::process::exit(1);
        }
    };

    let api_key = match read_stored_api_key() {
        Ok(Some(key)) => key,
        Ok(None) => {
            eprintln!("Kein API-Schlüssel gefunden. Trag ihn zuerst in der GrimmGeist-App unter Einstellungen ein.");
            std::process::exit(1);
        }
        Err(e) => {
            eprintln!("API-Schlüssel konnte nicht aus dem Schlüsselbund gelesen werden: {e}");
            std::process::exit(1);
        }
    };

    if let Err(e) = ask_gemini_streaming(&api_key, &model, &prompt).await {
        eprintln!("Fehler: {e}");
        std::process::exit(1);
    }
    println!();
}

/// Streams the reply via Gemini's `alt=sse` endpoint, which frames each chunk as a proper
/// Server-Sent Event (`data: <json>\n\n`) - unlike the default streaming format, event
/// boundaries here are unambiguous regardless of how the underlying HTTP chunks arrive, so this
/// can be parsed reliably by buffering until a full `\n\n`-terminated event is seen.
async fn ask_gemini_streaming(api_key: &str, model: &str, prompt: &str) -> Result<(), String> {
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse&key={api_key}"
    );

    let safety_settings: Vec<Value> = SAFETY_CATEGORIES
        .iter()
        .map(|category| json!({ "category": category, "threshold": "BLOCK_MEDIUM_AND_ABOVE" }))
        .collect();

    let body = json!({
        "contents": [{ "role": "user", "parts": [{ "text": prompt }] }],
        "safetySettings": safety_settings,
    });

    let client = reqwest::Client::new();
    let res = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Netzwerkfehler: {e}"))?;

    let status = res.status();
    if !status.is_success() {
        let data: Value = res.json().await.unwrap_or(Value::Null);
        let message = data["error"]["message"].as_str().unwrap_or("Unbekannter Fehler");
        return Err(format!("HTTP {status}: {message}"));
    }

    let mut stream = res.bytes_stream();
    let mut buffer = String::new();
    let mut stdout = std::io::stdout();
    let mut got_any_text = false;
    let mut block_reason: Option<String> = None;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Verbindungsfehler beim Streamen: {e}"))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        // Google's SSE stream separates events with CRLFCRLF, not a bare "\n\n".
        while let Some(pos) = buffer.find("\r\n\r\n") {
            let event = buffer[..pos].to_string();
            buffer.drain(..pos + 4);

            let Some(data) = event.strip_prefix("data: ").or_else(|| event.strip_prefix("data:")) else {
                continue;
            };
            let Ok(json_val) = serde_json::from_str::<Value>(data.trim()) else {
                continue;
            };

            if let Some(reason) = json_val["promptFeedback"]["blockReason"].as_str() {
                block_reason = Some(reason.to_string());
                continue;
            }

            if let Some(parts) = json_val["candidates"][0]["content"]["parts"].as_array() {
                for part in parts {
                    if let Some(text) = part["text"].as_str() {
                        print!("{text}");
                        got_any_text = true;
                    }
                }
                let _ = stdout.flush();
            }
        }
    }

    if !got_any_text {
        if let Some(reason) = block_reason {
            return Err(format!("Von Google blockiert: {reason}"));
        }
        return Err("Keine Antwort erhalten.".into());
    }
    Ok(())
}
