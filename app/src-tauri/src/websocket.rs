use std::sync::Arc;
use warp::Filter;
use futures::{StreamExt, SinkExt};
use tokio::sync::Mutex as AsyncMutex;
use serde_json;
use uuid;
use once_cell::sync::Lazy;


use crate::{MESSAGES, CONTAINERS, save_messages, get_app_handle};

//import save_containers and get_recent_agent_messages from helpers
use crate::helpers::{save_containers, get_recent_agent_messages};



//Websocket server
static CLIENT_CONNECTION: Lazy<Arc<AsyncMutex<Option<Arc<AsyncMutex<futures::stream::SplitSink<warp::ws::WebSocket, warp::ws::Message>>>>>>> = 
    Lazy::new(|| Arc::new(AsyncMutex::new(None)));


#[derive(Debug)]
pub struct ConnectionInfo {
    pub tx: Arc<AsyncMutex<futures::stream::SplitSink<warp::ws::WebSocket, warp::ws::Message>>>,
    pub prompt_running: String, //"running", "stopped", "loading", "na"
}


// Global connection maps using Arc<AsyncMutex>
pub static AGENT_CONNECTIONS: Lazy<Arc<AsyncMutex<std::collections::HashMap<String, ConnectionInfo>>>> = 
    Lazy::new(|| Arc::new(AsyncMutex::new(std::collections::HashMap::new())));


//Connection ID to Agent ID
static ID_BY_CONNECTION: Lazy<Arc<AsyncMutex<std::collections::HashMap<String, String>>>> =
    Lazy::new(|| Arc::new(AsyncMutex::new(std::collections::HashMap::new())));




pub async fn start_websocket_server() {
    let app_handle = get_app_handle().expect("Failed to get app handle");
    let app_handle = warp::any().map(move || app_handle.clone());

    // WebSocket route
    let ws_route = warp::path("ws")
        .and(warp::ws())
        .and(app_handle.clone())
        .map(|ws: warp::ws::Ws, handle| {
            ws.on_upgrade(move |socket| handle_websocket(socket, handle))
        });
    println!("Server starting on http://0.0.0.0:3030");
    println!("WebSocket endpoint: ws://0.0.0.0:3030/ws");

    warp::serve(ws_route).run(([0, 0, 0, 0], 3030)).await;
}

async fn handle_websocket(websocket: warp::ws::WebSocket, app_handle: tauri::AppHandle) {
    let (ws_tx, mut rx) = websocket.split();
    let tx = Arc::new(AsyncMutex::new(ws_tx));
    let conn_id = uuid::Uuid::new_v4().to_string();

    while let Some(Ok(message)) = rx.next().await {
        if let Ok(text) = message.to_str() {
            let truncated_text = text.chars().take(250).collect::<String>();
            println!("[INFO] Received message: {}", truncated_text);
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(text) {
                if let Some("init") = json.get("message-type").and_then(|v| v.as_str()) {
                    handle_init_message(&conn_id, &tx, &json).await;
                } else if let Some("message") = json.get("message-type").and_then(|v| v.as_str()) {
                    handle_agent_message(&conn_id, &tx, json, app_handle.clone()).await;
                } else if let Some("prompt") = json.get("message-type").and_then(|v| v.as_str()) {
                    handle_client_message(&conn_id, &tx, json, app_handle.clone(), true).await;
                } else if let Some("stop") = json.get("message-type").and_then(|v| v.as_str()) {
                    handle_client_message(&conn_id, &tx, json, app_handle.clone(), false).await;
                }
            }
        }
    }

    handle_disconnection(&conn_id).await;
}

async fn handle_disconnection(conn_id: &str) {
    let mut agent_conns = AGENT_CONNECTIONS.lock().await;
    let id_conns = ID_BY_CONNECTION.lock().await;

    if let Some(agent_id) = id_conns.get(conn_id) {
        let tx = if let Some(conn_info) = agent_conns.get(agent_id) {
            conn_info.tx.clone()
        } else {
            return;
        };

        agent_conns.insert(agent_id.to_string(), ConnectionInfo {
            tx,
            prompt_running: "na".to_string(),
        });

        if let Some(client_conn) = CLIENT_CONNECTION.lock().await.as_ref() {
            let message = serde_json::json!({
                "agent_id": agent_id,
                "prompt_running": "na"
            });
            let json_string = serde_json::to_string(&message).unwrap();
            if let Err(e) = client_conn.lock().await.send(warp::ws::Message::text(json_string)).await {
                eprintln!("Error sending disconnect message to client: {}", e);
            }
        }
    }
}

async fn handle_init_message(
    conn_id: &str,
    tx: &Arc<AsyncMutex<futures::stream::SplitSink<warp::ws::WebSocket, warp::ws::Message>>>,
    json: &serde_json::Value,
) {
    if let Some(conn_type) = json.get("connection-type").and_then(|v| v.as_str()) {
        match conn_type {
            "agent" => {
                if let Some(agent_id) = json.get("container_id").and_then(|v| v.as_str()) {
                    let mut agent_conns = AGENT_CONNECTIONS.lock().await;
                    let mut id_conns = ID_BY_CONNECTION.lock().await;

                    let prompt_running = json.get("prompt_running").and_then(|v| v.as_str()).unwrap_or("stopped").to_string();
                    
                    agent_conns.insert(agent_id.to_string(), ConnectionInfo {
                        tx: tx.clone(),
                        prompt_running: prompt_running,
                    });
                    
                    id_conns.insert(conn_id.to_string(), agent_id.to_string());
                    if let Some(client_conn) = CLIENT_CONNECTION.lock().await.as_ref() {
                        let json_string = serde_json::to_string(&json).unwrap();
                        client_conn.lock().await.send(warp::ws::Message::text(json_string)).await.unwrap();
                    }
                }
            },
            "client" => {
                let mut client_conn = CLIENT_CONNECTION.lock().await;
                *client_conn = Some(tx.clone());
            },
            _ => println!("Unknown connection type: {}", conn_type)
        }
    }
}

async fn handle_agent_message(
    conn_id: &str,
    _tx: &Arc<AsyncMutex<futures::stream::SplitSink<warp::ws::WebSocket, warp::ws::Message>>>,
    mut json_message: serde_json::Value,
    app_handle: tauri::AppHandle,
) {
    if let Some(agent_id) = ID_BY_CONNECTION.lock().await.get(conn_id).cloned() {
        let message_id = uuid::Uuid::new_v4().to_string();

        if let serde_json::Value::Object(ref mut map) = json_message {
            map.insert("agent_id".to_string(), serde_json::Value::String(agent_id.clone()));
            map.insert("message_id".to_string(), serde_json::Value::String(message_id.clone()));
            if let Some(prompt_running) = map.get("prompt_running").and_then(|v| v.as_str()) {
                if let Some(agent_conn) = AGENT_CONNECTIONS.lock().await.get_mut(&agent_id) {
                    agent_conn.prompt_running = prompt_running.to_string();
                }
            }
        }
        process_message(message_id, json_message, &agent_id, &app_handle).await;
    }
}

async fn handle_client_message(
    _conn_id: &str,
    _tx: &Arc<AsyncMutex<futures::stream::SplitSink<warp::ws::WebSocket, warp::ws::Message>>>,
    mut json: serde_json::Value,
    app_handle: tauri::AppHandle,
    is_prompt: bool,
) {
    let agent_id = json.get("agent_id")
        .and_then(|v| v.as_str())
        .map(String::from);

    if let Some(agent_id_value) = agent_id {
        let mut agent_conns = AGENT_CONNECTIONS.lock().await;
        if let Some(conn_info) = agent_conns.get_mut(&agent_id_value) {
            conn_info.prompt_running = "running".to_string();
            
            let mut json_with_history = json.clone();
            if is_prompt {
                if let serde_json::Value::Object(ref mut map) = json_with_history {
                    let recent_messages = get_recent_agent_messages(agent_id_value.clone(), 5);
                    map.insert("recent-messages".to_string(), serde_json::Value::Array(recent_messages));

                    // Get system prompt from CONTAINERS
                    let containers = CONTAINERS.lock().unwrap();
                    if let Some(container) = containers.iter().find(|c| c.agent_id == agent_id_value) {
                        map.insert(
                            "additional_system_prompt".to_string(), 
                            serde_json::Value::String(container.system_prompt.clone())
                        );
                        println!("System prompt: {}", container.system_prompt);
                    }
                }
            }

            let message_id = uuid::Uuid::new_v4().to_string();
            if let serde_json::Value::Object(ref mut map) = json_with_history {
                map.insert("message_id".to_string(), serde_json::Value::String(message_id.clone()));
            }

            // Send complete message (including files) to agent
            let json_string = serde_json::to_string(&json_with_history).unwrap();
            let chunk_size = 1024;
            let total_chunks = (json_string.len() + chunk_size - 1) / chunk_size;

            for (i, chunk) in json_string.as_bytes().chunks(chunk_size).enumerate() {
                let chunk_message = serde_json::json!({
                    "message_id": message_id,
                    "chunk": i,
                    "total_chunks": total_chunks,
                    "data": String::from_utf8_lossy(chunk),
                });

                if let Err(e) = conn_info.tx.lock().await.send(warp::ws::Message::text(serde_json::to_string(&chunk_message).unwrap())).await {
                    eprintln!("Error forwarding chunk to agent {}: {}", agent_id_value, e);
                }
            }
        }
        
        let message_id = uuid::Uuid::new_v4().to_string();

        // Create a version of the message for storage without the files field
        let storage_json = if let serde_json::Value::Object(mut map) = json {
            map.remove("files"); // Remove files field before storage
            map.insert("message_id".to_string(), serde_json::Value::String(message_id.clone()));
            serde_json::Value::Object(map)
        } else {
            json
        };

        process_message(message_id, storage_json, &agent_id_value, &app_handle).await;
    }
} 

async fn process_message(
    message_id: String,
    json_message: serde_json::Value,
    agent_id: &str,
    app_handle: &tauri::AppHandle,
) {
    if let Some(client_conn) = CLIENT_CONNECTION.lock().await.as_ref() {
        let json_string = serde_json::to_string(&json_message).unwrap();
        client_conn.lock().await.send(warp::ws::Message::text(json_string)).await.unwrap();
    }

    let mut messages = MESSAGES.lock().unwrap();
    messages.insert(message_id.clone(), json_message);
    save_messages(&app_handle, &messages).unwrap();

    let mut containers = CONTAINERS.lock().unwrap();
    if let Some(container) = containers.iter_mut().find(|c| c.agent_id == agent_id) {
        container.message_ids.push(message_id);
        save_containers(&app_handle, &containers).unwrap();
    }
}
