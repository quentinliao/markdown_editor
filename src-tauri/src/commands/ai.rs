use futures_util::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

#[derive(Deserialize)]
#[serde(tag = "format", rename_all = "lowercase")]
pub enum StreamRequest {
    Openai {
        url: String,
        api_key: String,
        model: String,
        messages: Vec<ChatMessage>,
    },
    Anthropic {
        url: String,
        api_key: String,
        model: String,
        system: String,
        messages: Vec<ChatMessage>,
    },
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Serialize, Clone)]
struct ChunkEvent {
    request_id: String,
    chunk: String,
}

#[derive(Serialize, Clone)]
struct DoneEvent {
    request_id: String,
}

#[tauri::command]
pub async fn stream_chat_request(
    app: AppHandle,
    request: StreamRequest,
) -> Result<String, String> {
    let request_id = format!(
        "{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis()
    );

    let client = Client::new();
    let rid = request_id.clone();
    let app_clone = app.clone();

    let result: Result<String, String> = match request {
        StreamRequest::Openai {
            url,
            api_key,
            model,
            messages,
        } => {
            let body = serde_json::json!({
                "model": model,
                "stream": true,
                "messages": messages,
            });

            let resp = client
                .post(&url)
                .header("Content-Type", "application/json")
                .header("Authorization", format!("Bearer {}", api_key))
                .json(&body)
                .send()
                .await
                .map_err(|e| format!("请求失败: {}", e))?;

            if !resp.status().is_success() {
                let status = resp.status();
                let text = resp.text().await.unwrap_or_default();
                return Err(format!("API error: {} {}", status, text));
            }

            stream_sse(resp, &rid, &app_clone).await
        }
        StreamRequest::Anthropic {
            url,
            api_key,
            model,
            system,
            messages,
        } => {
            let body = serde_json::json!({
                "model": model,
                "max_tokens": 4096,
                "stream": true,
                "system": system,
                "messages": messages,
            });

            let resp = client
                .post(&url)
                .header("Content-Type", "application/json")
                .header("x-api-key", &api_key)
                .header("anthropic-version", "2023-06-01")
                .json(&body)
                .send()
                .await
                .map_err(|e| format!("请求失败: {}", e))?;

            if !resp.status().is_success() {
                let status = resp.status();
                let text = resp.text().await.unwrap_or_default();
                return Err(format!("API error: {} {}", status, text));
            }

            stream_sse(resp, &rid, &app_clone).await
        }
    };

    let _ = app_clone.emit("chat:done", DoneEvent { request_id: rid });

    result
}

async fn stream_sse(
    resp: reqwest::Response,
    request_id: &str,
    app: &AppHandle,
) -> Result<String, String> {
    let mut stream = resp.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("读取失败: {}", e))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(pos) = buffer.find('\n') {
            let line = buffer[..pos].trim().to_string();
            buffer = buffer[pos + 1..].to_string();

            if line.is_empty() || !line.starts_with("data: ") {
                continue;
            }

            let data = &line[6..];
            if data == "[DONE]" {
                continue;
            }

            let parsed: serde_json::Value = match serde_json::from_str(data) {
                Ok(v) => v,
                Err(_) => continue,
            };

            let text = if let Some(content) = parsed
                .get("choices")
                .and_then(|c| c.get(0))
                .and_then(|c| c.get("delta"))
                .and_then(|d| d.get("content"))
                .and_then(|c| c.as_str())
            {
                content.to_string()
            } else if parsed.get("type").and_then(|t| t.as_str()) == Some("content_block_delta") {
                parsed
                    .get("delta")
                    .and_then(|d| d.get("text"))
                    .and_then(|t| t.as_str())
                    .unwrap_or("")
                    .to_string()
            } else {
                continue;
            };

            if !text.is_empty() {
                let _ = app.emit(
                    "chat:chunk",
                    ChunkEvent {
                        request_id: request_id.to_string(),
                        chunk: text,
                    },
                );
            }
        }
    }

    Ok(request_id.to_string())
}
