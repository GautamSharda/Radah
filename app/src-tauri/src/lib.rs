use std::process::Command;
use std::env;
use std::sync::Mutex;
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use once_cell::sync::Lazy;
use serde::{Serialize, Deserialize};
use tauri::Manager;
use tauri::Runtime;
use uuid;

// Add these imports for WebSocket functionality
use warp::Filter;
use futures::{StreamExt};
use tokio::sync::Mutex as AsyncMutex;
use futures::SinkExt; // Add this line


//Long Term Storage
#[derive(Serialize, Deserialize, Clone, Debug)]
struct User {
    //boolean value to hide or show computer controls
    show_controls: bool,
}
//Metadata for the user
static USER: Lazy<Mutex<User>> = Lazy::new(|| Mutex::new(User { show_controls: true }));

//Occupied ports
static OCCUPIED_PORTS: Lazy<Mutex<Vec<u16>>> = Lazy::new(|| Mutex::new(Vec::new()));

//Messages from agents
static MESSAGES: Lazy<Mutex<std::collections::HashMap<String, serde_json::Value>>> = Lazy::new(|| {
    Mutex::new(std::collections::HashMap::new())
});

//Docker container metadata
#[derive(Serialize, Deserialize, Clone, Debug)]
struct DockerContainer {
    id: String,
    vnc_port: u16,
    number: i32,
    agent_type: String, // Either "jim" or "pam"
    message_ids: Vec<String>,
    agent_id: String,
}

//Docker containers
static DOCKER_CONTAINERS: Lazy<Mutex<Vec<DockerContainer>>> = Lazy::new(|| {
    Mutex::new(Vec::new())
});


//Websocket server
static CLIENT_CONNECTION: Lazy<Arc<AsyncMutex<Option<Arc<AsyncMutex<futures::stream::SplitSink<warp::ws::WebSocket, warp::ws::Message>>>>>>> = 
    Lazy::new(|| Arc::new(AsyncMutex::new(None)));


#[derive(Debug)]
struct ConnectionInfo {
    tx: Arc<AsyncMutex<futures::stream::SplitSink<warp::ws::WebSocket, warp::ws::Message>>>,
    prompt_running: String, //"running", "stopped", "loading"
}

// Global connection maps using Arc<AsyncMutex>
static AGENT_CONNECTIONS: Lazy<Arc<AsyncMutex<std::collections::HashMap<String, ConnectionInfo>>>> = 
    Lazy::new(|| Arc::new(AsyncMutex::new(std::collections::HashMap::new())));

//Connection ID to Agent ID
static ID_BY_CONNECTION: Lazy<Arc<AsyncMutex<std::collections::HashMap<String, String>>>> =
    Lazy::new(|| Arc::new(AsyncMutex::new(std::collections::HashMap::new())));

// Add this near your other static variables
static APP_HANDLE: Lazy<Mutex<Option<tauri::AppHandle>>> = Lazy::new(|| Mutex::new(None));

// Add this helper function
fn get_app_handle() -> Option<tauri::AppHandle> {
    APP_HANDLE.lock().unwrap().clone()
}

async fn start_websocket_server() {
    let app_handle = get_app_handle().expect("Failed to get app handle");
    let app_handle = warp::any().map(move || app_handle.clone());

    let routes = warp::path("ws")
        .and(warp::ws())
        .and(app_handle)
        .map(|ws: warp::ws::Ws, handle| {
            ws.on_upgrade(move |socket| handle_websocket(socket, handle))
        });

    println!("WebSocket server starting on ws://127.0.0.1:3030/ws");
    warp::serve(routes).run(([127, 0, 0, 1], 3030)).await;
}

//Handle websocket connections
async fn handle_websocket(websocket: warp::ws::WebSocket, app_handle: tauri::AppHandle) {
    let (ws_tx, mut rx) = websocket.split();
    let tx = Arc::new(AsyncMutex::new(ws_tx));
    let conn_id = uuid::Uuid::new_v4().to_string();

    while let Some(Ok(message)) = rx.next().await {
        if let Ok(text) = message.to_str() {
            //truncate
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

    // Handle disconnection
    handle_disconnection(&conn_id).await;
}

// Handle disconnection logic
async fn handle_disconnection(conn_id: &str) {
    let mut agent_conns = AGENT_CONNECTIONS.lock().await;
    let mut id_conns = ID_BY_CONNECTION.lock().await;

    if let Some(agent_id) = id_conns.get(conn_id) {
        // First, get the tx value we need
        let tx = if let Some(conn_info) = agent_conns.get(agent_id) {
            conn_info.tx.clone()
        } else {
            return;
        };

        // Now we can safely update the connection info
        agent_conns.insert(agent_id.to_string(), ConnectionInfo {
            tx,
            prompt_running: "loading".to_string(),
        });


        // Send updated prompt running status to the client
        if let Some(client_conn) = CLIENT_CONNECTION.lock().await.as_ref() {
            let message = serde_json::json!({
                "agent_id": agent_id,
                "prompt_running": "loading"
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
                    // Forward this message to the client
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
            _ => println!("Unknown connection type: {}", conn_type)  // Add catch-all case
        }
    }
}

//Generate a random ID
fn generate_random_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

// Helper function to handle common message processing logic
async fn process_message(
    message_id: String,
    json_message: serde_json::Value,
    agent_id: &str,
    app_handle: &tauri::AppHandle,
) {
    // Send to client connection
    if let Some(client_conn) = CLIENT_CONNECTION.lock().await.as_ref() {
        let json_string = serde_json::to_string(&json_message).unwrap();
        client_conn.lock().await.send(warp::ws::Message::text(json_string)).await.unwrap();
    }

    // Store message
    let mut messages = MESSAGES.lock().unwrap();
    messages.insert(message_id.clone(), json_message);
    save_messages(&app_handle, &messages).unwrap();

    // Update container message IDs
    let mut containers = DOCKER_CONTAINERS.lock().unwrap();
    if let Some(container) = containers.iter_mut().find(|c| c.agent_id == agent_id) {
        container.message_ids.push(message_id);
        save_containers(&app_handle, &containers).unwrap();
    }
}

//Handle messages from agents
async fn handle_agent_message(
    conn_id: &str,
    _tx: &Arc<AsyncMutex<futures::stream::SplitSink<warp::ws::WebSocket, warp::ws::Message>>>,
    mut json_message: serde_json::Value,
    app_handle: tauri::AppHandle,
) {
    if let Some(agent_id) = ID_BY_CONNECTION.lock().await.get(conn_id).cloned() {
        let message_id = generate_random_id();

        // Add agent_id to the JSON object
        if let serde_json::Value::Object(ref mut map) = json_message {
            map.insert("agent_id".to_string(), serde_json::Value::String(agent_id.clone()));
            map.insert("message_id".to_string(), serde_json::Value::String(message_id.clone()));
            // Update prompt_running if present in message
            if let Some(prompt_running) = map.get("prompt_running").and_then(|v| v.as_str()) {
                if let Some(agent_conn) = AGENT_CONNECTIONS.lock().await.get_mut(&agent_id) {
                    agent_conn.prompt_running = prompt_running.to_string();
                }
            }
        }
        process_message(message_id, json_message, &agent_id, &app_handle).await;
    }
}


async fn handle_client_message(_conn_id: &str, _tx: &Arc<AsyncMutex<futures::stream::SplitSink<warp::ws::WebSocket, warp::ws::Message>>>, mut json: serde_json::Value, app_handle: tauri::AppHandle, get_recents_messages: bool) {
    // Extract values early before modifying json
    let agent_id = json.get("agent_id")
        .and_then(|v| v.as_str())
        .map(String::from);

    if let Some(agent_id_value) = agent_id {
        let mut agent_conns = AGENT_CONNECTIONS.lock().await;
        if let Some(conn_info) = agent_conns.get_mut(&agent_id_value) {
            // Set prompt running to "running"
            conn_info.prompt_running = "running".to_string();
            
            // Create a copy of the JSON object
            let mut json_with_history = json.clone();
            // Get recent messages and add them to the copy if requested
            if get_recents_messages {
                if let serde_json::Value::Object(ref mut map) = json_with_history {
                    let recent_messages = get_recent_agent_messages(agent_id_value.clone(), 5);
                    map.insert("recent-messages".to_string(), serde_json::Value::Array(recent_messages));
                }
            }

            // Send the copy with history over websocket
            if let Err(e) = conn_info.tx.lock().await.send(warp::ws::Message::text(serde_json::to_string(&json_with_history).unwrap())).await {
                eprintln!("Error forwarding prompt to agent {}: {}", agent_id_value, e);
            }
        }
        
        let message_id = generate_random_id();

        // Add message_id to JSON
        if let serde_json::Value::Object(ref mut map) = json {
            map.insert("message_id".to_string(), serde_json::Value::String(message_id.clone()));
            //add recent agent messages
        }

        process_message(message_id, json, &agent_id_value, &app_handle).await;
    }
}

#[tauri::command]
async fn get_prompt_running(agent_id: String) -> String {
    AGENT_CONNECTIONS.lock().await.get(&agent_id).map(|conn| conn.prompt_running.clone()).unwrap_or("loading".to_string())
}

#[tauri::command]
fn get_recent_agent_messages(agent_id: String, n: usize) -> Vec<serde_json::Value> {
    let containers = DOCKER_CONTAINERS.lock().unwrap();
    let messages = MESSAGES.lock().unwrap();
    let mut result = Vec::new();

    if let Some(container) = containers.iter().find(|c| c.agent_id == agent_id) {
        // Iterate through message IDs in reverse order (most recent first)
        for message_id in container.message_ids.iter().rev() {
            if let Some(json_value) = messages.get(message_id) {
                // Only include messages that have agent-message key
                if json_value.get("agent-message").is_some() {
                    result.push(json_value.clone());
                    if result.len() >= n {
                        break;
                    }
                }
            }
        }
    }
    result.into_iter().rev().collect()
}



#[cfg(target_os = "macos")]
fn is_port_in_use(port: u16) -> bool {
    let output = Command::new("lsof")
        .arg("-i")
        .arg(format!(":{}", port))
        .output()
        .expect("Failed to execute lsof command");

    !output.stdout.is_empty()
}

#[cfg(target_os = "linux")]
fn is_port_in_use(port: u16) -> bool {
    let output = Command::new("ss")
        .arg("-ln")
        .arg("sport")
        .arg(format!("= :{}", port))
        .output()
        .expect("Failed to execute ss command");

    !output.stdout.is_empty()
}

#[cfg(target_os = "windows")]
fn is_port_in_use(port: u16) -> bool {
    let output = Command::new("netstat")
        .arg("-ano")
        .arg("|")
        .arg("findstr")
        .arg(format!(":{}", port))
        .output()
        .expect("Failed to execute netstat command");

    !output.stdout.is_empty()
}

fn get_containers_file<R: Runtime>(app: &tauri::AppHandle<R>) -> PathBuf {
    app.path().app_data_dir()
        .expect("Failed to get app data dir")
        .join("containers.json")
}

fn save_messages<R: Runtime>(app: &tauri::AppHandle<R>, messages: &std::collections::HashMap<String, serde_json::Value>) -> Result<(), String> {
    let file_path = app.path().app_data_dir()
        .expect("Failed to get app data dir")
        .join("messages.json");
    
    // Ensure directory exists
    if let Some(dir) = file_path.parent() {
        fs::create_dir_all(dir)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    fs::write(
        &file_path,
        serde_json::to_string_pretty(messages)
            .map_err(|e| format!("Failed to serialize messages: {}", e))?
    )
    .map_err(|e| format!("Failed to write messages file: {}", e))?;

    Ok(())
}

fn save_containers<R: Runtime>(app: &tauri::AppHandle<R>, containers: &[DockerContainer]) -> Result<(), String> {
    let file_path = get_containers_file(app);
    
    // Ensure directory exists
    if let Some(dir) = file_path.parent() {
        fs::create_dir_all(dir)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    fs::write(
        &file_path,
        serde_json::to_string_pretty(containers)
            .map_err(|e| format!("Failed to serialize containers: {}", e))?
    )
    .map_err(|e| format!("Failed to write containers file: {}", e))?;

    Ok(())
}

fn load_containers<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<Vec<DockerContainer>, String> {
    let file_path = get_containers_file(app);
    
    if !file_path.exists() {
        return Ok(Vec::new());
    }

    let contents = fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read containers file: {}", e))?;

    serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse containers file: {}", e))
}

#[tauri::command]
async fn create_agent_container(app_handle: tauri::AppHandle, agent_id: String, agent_type: String, number: i32, message_ids: Vec<String>) -> Result<DockerContainer, String> {
    println!("Creating agent with id: {}, type: {}, number: {}, message_ids: {:?}", agent_id, agent_type, number, message_ids);
    let ports = get_available_ports()?;
    let vnc_port = ports[0];
    let novnc_port = ports[1];

    // Check if Docker daemon is running
    let docker_check = Command::new("docker")
        .args(&["info"])
        .output()
        .map_err(|e| format!("Failed to check Docker status: {}. Is Docker running?", e))?;

    if !docker_check.status.success() {
        return Err("Docker daemon is not running. Please start Docker first.".to_string());
    }

    // Build the Docker image
    let build_output = Command::new("docker")
        .args(&[
            "build",
            "-t",
            "minimal-vnc-desktop",
            env!("CARGO_MANIFEST_DIR"),
        ])
        .output()
        .map_err(|e| format!("Failed to execute docker build command: {}", e))?;

    if !build_output.status.success() {
        let stderr = String::from_utf8_lossy(&build_output.stderr);
        let stdout = String::from_utf8_lossy(&build_output.stdout);
        println!("Docker build failed with stderr: {}", stderr);
        println!("Docker build stdout: {}", stdout);
        return Err(format!("Docker build failed.\nStderr: {}\nStdout: {}", stderr, stdout));
    }

    // Run the Docker container
    let run_output = Command::new("docker")
        .args(&[
            "run",
            "-d",  // Run in detached mode
            "-e", "DISPLAY=:0",
            "-e", &format!("CONTAINER_ID={}", agent_id),
            "-e", "GEOMETRY=1920x1080",
            "-e", "HOST_IP=host.docker.internal",
            "-p", &format!("{}:5900", vnc_port),
            "-p", &format!("{}:6080", novnc_port),
            "--name", &format!("agent-{}", agent_id),
            "--add-host=host.docker.internal:host-gateway",
            "minimal-vnc-desktop",
        ])
        .output()
        .map_err(|e| e.to_string())?;

    if !run_output.status.success() {
        let error = String::from_utf8_lossy(&run_output.stderr);
        return Err(format!("Failed to start container: {}", error));
    }

    let container_id = String::from_utf8_lossy(&run_output.stdout)
        .trim()
        .to_string();

    let container = DockerContainer {
        id: container_id,
        vnc_port: novnc_port,
        agent_id,
        agent_type,
        number,
        message_ids: message_ids,
    };

    let mut containers = DOCKER_CONTAINERS.lock().unwrap();
    containers.push(container.clone());
    
    save_containers(&app_handle, &containers)?;

    Ok(container)
}

#[tauri::command]
fn get_agent_container(agent_id: String) -> Option<DockerContainer> {
    let containers = DOCKER_CONTAINERS.lock().unwrap();
    containers.iter().find(|c| c.agent_id == agent_id).cloned()
}

#[tauri::command]
fn get_occupied_ports() -> Vec<u16> {
    OCCUPIED_PORTS.lock().unwrap().clone()
}

#[tauri::command]
async fn cleanup_agent_container(app_handle: tauri::AppHandle, agent_id: String) -> Result<(), String> {
    let mut containers = DOCKER_CONTAINERS.lock().unwrap();
    if let Some(pos) = containers.iter().position(|c| c.agent_id == agent_id) {
        let container = containers.remove(pos);
        
        Command::new("docker")
            .args(&["rm", "-f", &container.id])
            .output()
            .map_err(|e| e.to_string())?;
            
        save_containers(&app_handle, &containers)?;
    }
    Ok(())
}

#[tauri::command]
fn get_all_containers() -> Vec<DockerContainer> {
    let containers = DOCKER_CONTAINERS.lock().unwrap();
    containers.clone()
}

fn get_available_ports() -> Result<Vec<u16>, String> {
    let mut available_ports = Vec::new();
    
    // Check VNC ports starting at 5900
    for offset in 0..100 {  // Increased range to check more ports
        let port = 5900 + offset;
        if !is_port_in_use(port) {
            available_ports.push(port);
            // Don't break - keep looking for more ports
            if available_ports.len() == 1 {
                // Found VNC port, now look for noVNC port
                for novnc_offset in 0..100 {  // Increased range for noVNC ports too
                    let novnc_port = 6080 + novnc_offset;
                    if !is_port_in_use(novnc_port) {
                        available_ports.push(novnc_port);
                        return Ok(available_ports);  // Found both ports, return them
                    }
                }
            }
        }
    }

    Err("Not enough available ports".to_string())
}


//Helper function to pretty print everything stored in storage
#[tauri::command]
fn print_all_storage() {
    println!("User data: {:?}", USER.lock().unwrap());
    println!("Occupied ports: {:?}", OCCUPIED_PORTS.lock().unwrap());
    println!("Messages: {:?}", MESSAGES.lock().unwrap());
    println!("Docker containers: {:?}", DOCKER_CONTAINERS.lock().unwrap());
}


//Clear all storage (only used for testing)
#[tauri::command]
fn clear_all_storage() {
    // Clear user data
    let mut user = USER.lock().unwrap();
    user.show_controls = true; // Reset to default

    // Clear occupied ports
    let mut ports = OCCUPIED_PORTS.lock().unwrap();
    ports.clear();

    // Clear messages
    let mut messages = MESSAGES.lock().unwrap();
    messages.clear();

    // Clear docker containers
    let mut containers = DOCKER_CONTAINERS.lock().unwrap();
    containers.clear();
}

// Clear all messages and message IDs in the containers
#[tauri::command]
fn clear_all_messages(app_handle: tauri::AppHandle) {
    // Clear message IDs from containers
    let mut containers = DOCKER_CONTAINERS.lock().unwrap();
    for container in containers.iter_mut() {
        container.message_ids.clear();
    }

    // Save updated containers to disk
    let containers_file = app_handle.path().app_data_dir()
        .expect("Failed to get app data dir")
        .join("containers.json");
    
    if let Ok(json) = serde_json::to_string(&*containers) {
        if let Err(e) = std::fs::write(&containers_file, json) {
            eprintln!("Failed to save containers file: {}", e);
        }
    }

    // Clear messages from memory
    let mut messages = MESSAGES.lock().unwrap();
    messages.clear();

    // Clear messages from disk
    let messages_file = get_messages_file(&app_handle);
    if messages_file.exists() {
        if let Err(e) = std::fs::remove_file(&messages_file) {
            eprintln!("Failed to delete messages file: {}", e);
        }
    }
}

//read all user data
#[tauri::command]
fn get_user_data() -> User {
    let user = USER.lock().unwrap();
    user.clone()
}

//update user data
#[tauri::command]
fn update_user_data(show_controls: bool) {
    let mut user = USER.lock().unwrap();
    user.show_controls = show_controls;
}

#[tauri::command]
fn get_agent_messages(agent_id: String) -> Vec<serde_json::Value> {
    let containers = DOCKER_CONTAINERS.lock().unwrap();
    let mut messages_array = Vec::new();
    
    if let Some(container) = containers.iter().find(|c| c.agent_id == agent_id) {
        let messages = MESSAGES.lock().unwrap();
        
        for message_id in container.message_ids.iter() {
            if let Some(json_value) = messages.get(message_id) {
                let mut json_value = json_value.clone();
                if let serde_json::Value::Object(ref mut map) = json_value {
                    map.insert("message_id".to_string(), serde_json::Value::String(message_id.clone()));
                }
                messages_array.push(json_value);
            }
        }
    }
    messages_array
}

// Add this helper function to get messages file path
fn get_messages_file<R: Runtime>(app: &tauri::AppHandle<R>) -> PathBuf {
    app.path().app_data_dir()
        .expect("Failed to get app data dir")
        .join("messages.json")
}

// Add this function to load messages
fn load_messages<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<std::collections::HashMap<String, serde_json::Value>, String> {
    let file_path = get_messages_file(app);
    
    if !file_path.exists() {
        return Ok(std::collections::HashMap::new());
    }

    let contents = fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read messages file: {}", e))?;

    serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse messages file: {}", e))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Store the app handle globally
            *APP_HANDLE.lock().unwrap() = Some(app.handle().clone());

            // Load containers on startup
            if let Ok(containers) = load_containers(&app.handle()) {
                let mut stored_containers = DOCKER_CONTAINERS.lock().unwrap();
                *stored_containers = containers;
            }

            // Add this: Load messages on startup
            if let Ok(messages) = load_messages(&app.handle()) {
                let mut stored_messages = MESSAGES.lock().unwrap();
                *stored_messages = messages;
            }

            // Start the WebSocket server in an async task
            tauri::async_runtime::spawn(async move {
                start_websocket_server().await;
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_occupied_ports,
            create_agent_container,
            get_agent_container,
            cleanup_agent_container,
            get_all_containers,
            get_user_data,
            update_user_data,
            print_all_storage,
            clear_all_storage,
            get_agent_messages,
            clear_all_messages,
            get_prompt_running
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}



// fn check_ports() -> Vec<u16> {
//     let ports_to_check = [5900, 8501, 6080, 8080];
//     let mut occupied = Vec::new();

//     for &port in &ports_to_check {
//         if is_port_in_use(port) {
//             occupied.push(port);
//         }
//     }

//     let mut global_occupied = OCCUPIED_PORTS.lock().unwrap();
//     *global_occupied = occupied.clone();

//     occupied
// }

// fn build_and_run_docker() -> Result<(), String> {
//     println!("Checking if required ports are available...");

//     let occupied_ports = check_ports();

//     if !occupied_ports.is_empty() {
//         println!("Some required ports are already in use: {:?}. Skipping Docker container launch.", occupied_ports);
//         return Ok(());
//     }

//     println!("All required ports are available. Starting a new Docker container...");

//     // Get the ANTHROPIC_API_KEY from environment variable
//     let api_key = env::var("ANTHROPIC_API_KEY").map_err(|_| "ANTHROPIC_API_KEY not set")?;

//     // Get the user's home directory
//     let home_dir = env::var("HOME").map_err(|_| "HOME directory not found")?;

//     println!("Attempting to run Docker container...");

//     // Run the Docker container
//     let run_output = Command::new("docker")
//         .args(&[
//             "run",
//             "-d",  // Run in detached mode
//             "-e", &format!("ANTHROPIC_API_KEY={}", api_key),
//             "-v", &format!("{}/.anthropic:/home/computeruse/.anthropic", home_dir),
//             "-p", "5900:5900",
//             "-p", "8501:8501",
//             "-p", "6080:6080",
//             "-p", "8080:8080",
//             "-it",  // Add interactive and TTY flags
//             "ghcr.io/anthropics/anthropic-quickstarts:computer-use-demo-latest",
//         ])
//         .output()
//         .map_err(|e| e.to_string())?;

//     if !run_output.status.success() {
//         let error = String::from_utf8_lossy(&run_output.stderr);
//         if error.contains("port is already allocated") {
//             println!("Docker run failed due to ports being allocated. Proceeding as if container is already running.");
//             return Ok(());
//         } else {
//             return Err(format!("Docker run failed. Error: {}", error));
//         }
//     }

//     println!("Docker container started successfully.");
//     Ok(())
// }