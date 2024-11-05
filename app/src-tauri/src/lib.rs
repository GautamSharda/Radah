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
static MESSAGES: Lazy<Mutex<std::collections::HashMap<String, String>>> = Lazy::new(|| {
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
    connection_type: String,
    status: String,
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

//Handle websocket connections
async fn handle_websocket(websocket: warp::ws::WebSocket, app_handle: tauri::AppHandle) {
    let (ws_tx, mut rx) = websocket.split();
    let tx = Arc::new(AsyncMutex::new(ws_tx));
    let conn_id = uuid::Uuid::new_v4().to_string();

    while let Some(Ok(message)) = rx.next().await {
        if let Ok(text) = message.to_str() {
            println!("Received message: {}", text);
            
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(text) {
                if let Some("init") = json.get("message-type").and_then(|v| v.as_str()) {                    
                    if let Some(conn_type) = json.get("connection-type").and_then(|v| v.as_str()) {
                        match conn_type {
                            "agent" => {
                                if let Some(agent_id) = json.get("container_id").and_then(|v| v.as_str()) {
                                    let mut agent_conns = AGENT_CONNECTIONS.lock().await;
                                    let mut id_conns = ID_BY_CONNECTION.lock().await;
                                    
                                    agent_conns.insert(agent_id.to_string(), ConnectionInfo {
                                        tx: tx.clone(),
                                        connection_type: "agent".to_string(),
                                        status: "connected".to_string()
                                    });
                                    
                                    id_conns.insert(conn_id.clone(), agent_id.to_string());
                                    println!("Agent {} connection initialized", agent_id);
                                }
                            },
                            "client" => {
                                let mut client_conn = CLIENT_CONNECTION.lock().await;
                                *client_conn = Some(tx.clone());
                                println!("Client connection initialized");
                            },
                            _ => println!("Unknown connection type: {}", conn_type)  // Add catch-all case
                        }
                    }
                } else if let Some("message") = json.get("message-type").and_then(|v| v.as_str()) {
                    handle_agent_message(&conn_id, &tx, text, app_handle.clone()).await;
                } else if let Some("prompt") = json.get("message-type").and_then(|v| v.as_str()) {
                    if let (Some(agent_id), Some(_prompt)) = (
                        json.get("agent_id").and_then(|v| v.as_str()),
                        json.get("text").and_then(|v| v.as_str())
                    ) {
                        // Handle as agent message first
                        println!("[INFO] Sending prompt to agent {}", agent_id);
                        handle_agent_message(&conn_id, &tx, text, app_handle.clone()).await;
                        
                        let agent_conns = AGENT_CONNECTIONS.lock().await;
                        if let Some(conn_info) = agent_conns.get(agent_id) {
                            if let Err(e) = conn_info.tx.lock().await.send(warp::ws::Message::text(text)).await {
                                eprintln!("Error forwarding prompt to agent {}: {}", agent_id, e);
                            }
                        }
                    }
                }
            }
        }
    }
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

//Generate a random ID
fn generate_random_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

//Handle messages from agents
async fn handle_agent_message(
    conn_id: &str,
    tx: &Arc<AsyncMutex<futures::stream::SplitSink<warp::ws::WebSocket, warp::ws::Message>>>,
    text: &str,
    app_handle: tauri::AppHandle,
) {
    println!("[INFO] Handling agent message");
    if let Some(agent_id) = ID_BY_CONNECTION.lock().await.get(conn_id).cloned() {
        println!("[INFO] Received message from agent {}", agent_id);

        let message_id = generate_random_id();

        // Parse the text into a JSON Value
        if let Ok(mut json_message) = serde_json::from_str::<serde_json::Value>(text) {
            // Add agent_id to the JSON object
            if let serde_json::Value::Object(ref mut map) = json_message {
                map.insert("agent_id".to_string(), serde_json::Value::String(agent_id.clone()));
                map.insert("message_id".to_string(), serde_json::Value::String(message_id.clone()));
            }

            //send the JSON object to the client
            if let Some(client_conn) = CLIENT_CONNECTION.lock().await.as_ref() {
                println!("[INFO] Sending message to client");
                let json_string = serde_json::to_string(&json_message).unwrap();
                client_conn.lock().await.send(warp::ws::Message::text(json_string)).await.unwrap();
            }

            let mut messages = MESSAGES.lock().unwrap();
            messages.insert(message_id.clone(), text.to_string());

            save_messages(&app_handle, &messages).unwrap();

            let mut containers = DOCKER_CONTAINERS.lock().unwrap();
            if let Some(container) = containers.iter_mut().find(|c| c.agent_id == agent_id) {
                container.message_ids.push(message_id);
                save_containers(&app_handle, &containers).unwrap();
            }
        }
    }
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

fn save_messages<R: Runtime>(app: &tauri::AppHandle<R>, messages: &std::collections::HashMap<String, String>) -> Result<(), String> {
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
fn clear_all_messages() {
    let mut containers = DOCKER_CONTAINERS.lock().unwrap();
    for container in containers.iter_mut() {
        container.message_ids.clear();
    }

    let mut messages = MESSAGES.lock().unwrap();
    messages.clear();
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
            if let Some(message) = messages.get(message_id) {
                // Parse the JSON string into a Value
                if let Ok(mut json_value) = serde_json::from_str::<serde_json::Value>(message) {
                    json_value["message_id"] = serde_json::Value::String(message_id.clone());
                    messages_array.push(json_value);
                }
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
fn load_messages<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<std::collections::HashMap<String, String>, String> {
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