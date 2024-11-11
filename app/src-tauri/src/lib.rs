use std::process::Command;
use std::env;
use std::sync::Mutex;
use once_cell::sync::Lazy;
use serde::{Serialize, Deserialize};
use tauri::Manager;
use dotenv::dotenv;

//file imports
mod launch_podman;
use launch_podman::podman_setup;

mod websocket;
pub use websocket::{ start_websocket_server, AGENT_CONNECTIONS, ConnectionInfo };


mod helpers;
pub use helpers::{save_messages, get_containers_file, save_containers, get_recent_agent_messages, get_available_ports, is_port_in_use, start_all_containers, get_messages_file, load_messages, load_containers};

// Long Term Storage
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
pub static MESSAGES: Lazy<Mutex<std::collections::HashMap<String, serde_json::Value>>> = Lazy::new(|| {
    Mutex::new(std::collections::HashMap::new())
});

//Container metadata
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Container {
    pub id: String,
    pub vnc_port: u16,
    pub number: i32,
    pub agent_type: String,
    pub message_ids: Vec<String>,
    pub agent_id: String,
}

//Containers
pub static CONTAINERS: Lazy<Mutex<Vec<Container>>> = Lazy::new(|| {
    Mutex::new(Vec::new())
});

// Add this near your other static variables
static APP_HANDLE: Lazy<Mutex<Option<tauri::AppHandle>>> = Lazy::new(|| Mutex::new(None));

// Add this helper function
pub fn get_app_handle() -> Option<tauri::AppHandle> {
    APP_HANDLE.lock().unwrap().clone()
}


#[tauri::command]
async fn get_prompt_running(agent_id: String) -> String {
    AGENT_CONNECTIONS.lock().await.get(&agent_id).map(|conn| conn.prompt_running.clone()).unwrap_or("na".to_string())
}

#[tauri::command]
async fn create_agent_container(app_handle: tauri::AppHandle, agent_id: String, agent_type: String, number: i32, message_ids: Vec<String>) -> Result<Container, String> {
    println!("Creating agent with id: {}, type: {}, number: {}, message_ids: {:?}", agent_id, agent_type, number, message_ids);
    let ports = get_available_ports()?;
    let vnc_port = ports[0];
    let novnc_port = ports[1];

    // Check if Podman daemon is running
    let podman_check = Command::new("podman")
        .args(&["info"])
        .output()
        .map_err(|e| format!("Failed to check Podman status: {}. Is Podman running?", e))?;

    if !podman_check.status.success() {
        let stderr = String::from_utf8_lossy(&podman_check.stderr);
        println!("Podman check failed: {}", stderr);
        return Err("Podman daemon is not running. Please start Podman first.".to_string());
    }
    // Check for existing container with same name and remove it
    let container_name = format!("agent-{}", agent_id);
    println!("Checking for existing container: {}", container_name);
    
    let existing = Command::new("podman")
        .args(&["ps", "-a", "--filter", &format!("name={}", container_name)])
        .output()
        .map_err(|e| format!("Failed to check existing containers: {}", e))?;

    if !String::from_utf8_lossy(&existing.stdout).trim().is_empty() {
        println!("Found existing container, removing it...");
        let _ = Command::new("podman")
            .args(&["rm", "-f", &container_name])
            .output()
            .map_err(|e| format!("Failed to remove existing container: {}", e))?;
        println!("Removed existing container");
    }

    // Build the Podman image
    println!("Build context: {}", env!("CARGO_MANIFEST_DIR"));
    
    let build_output = Command::new("podman")
        .args(&[
            "build",
            "-t",
            "minimal-vnc-desktop",
            env!("CARGO_MANIFEST_DIR"),
        ])
        .output()
        .map_err(|e| format!("Failed to execute podman build command: {}", e))?;

    // Always print build output regardless of success/failure
    let stderr = String::from_utf8_lossy(&build_output.stderr);
    let stdout = String::from_utf8_lossy(&build_output.stdout);
    println!("Build stdout:\n{}", stdout);
    println!("Build stderr:\n{}", stderr);

    if !build_output.status.success() {
        return Err(format!("Podman build failed.\nStderr: {}\nStdout: {}", stderr, stdout));
    }
    // Run the Podman container
    println!("Starting container...");
    
    // Create the formatted strings first
    let container_id_env = format!("CONTAINER_ID={}", agent_id);
    let api_key_env = format!("ANTHROPIC_API_KEY={}", env::var("ANTHROPIC_API_KEY").unwrap());
    let vnc_port_mapping = format!("{}:5900", vnc_port);
    let novnc_port_mapping = format!("{}:6080", novnc_port);
    let container_name = format!("agent-{}", agent_id);

    let run_args = vec![
        "run",
        "-d",  // Run in detached mode
        "--network", "bridge",  // Explicitly use bridge networking
        "-e", "DISPLAY=:0",
        "-e", &container_id_env,
        "-e", &api_key_env,
        "-e", "GEOMETRY=1920x1080",
        "-e", "HOST_IP=host.containers.internal",
        "-p", &vnc_port_mapping,
        "-p", &novnc_port_mapping,
        "--name", &container_name,
        // Remove the problematic --add-host flag and use DNS instead
        "minimal-vnc-desktop",
    ];
    println!("Running podman with args: {:?}", run_args);

    let run_output = Command::new("podman")
        .args(&run_args)
        .output()
        .map_err(|e| e.to_string())?;

    let run_stderr = String::from_utf8_lossy(&run_output.stderr);
    let run_stdout = String::from_utf8_lossy(&run_output.stdout);

    if !run_output.status.success() {
        return Err(format!("Failed to start container.\nStderr: {}\nStdout: {}", run_stderr, run_stdout));
    }

    let container_id = run_stdout.trim().to_string();
    println!("Container started successfully with ID: {}", container_id);

    let container = Container { id: container_id, vnc_port: novnc_port, agent_id, agent_type, number, message_ids: message_ids };

    let mut containers = CONTAINERS.lock().unwrap();
    containers.push(container.clone());
    
    save_containers(&app_handle, &containers)?;
    println!("Container metadata saved");

    Ok(container)
}

#[tauri::command]
fn get_agent_container(agent_id: String) -> Option<Container> {
    let containers = CONTAINERS.lock().unwrap();
    containers.iter().find(|c| c.agent_id == agent_id).cloned()
}

// start container takes a container id and starts the container by running docker start
#[tauri::command]
async fn start_container(container_id: String) -> Result<(), String> {
    println!("Starting container: {}", container_id);
    tokio::process::Command::new("podman")
        .args(&["start", &container_id])
        .output()
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_all_containers() -> Vec<Container> {
    let containers = CONTAINERS.lock().unwrap();
    containers.clone()
}

//Helper function to pretty print everything stored in storage
#[tauri::command]
fn print_all_storage() {
    println!("User data: {:?}", USER.lock().unwrap());
    println!("Occupied ports: {:?}", OCCUPIED_PORTS.lock().unwrap());
    println!("Messages: {:?}", MESSAGES.lock().unwrap());
    println!("Containers: {:?}", CONTAINERS.lock().unwrap());
}


//Clear all storage (only used for testing)
#[tauri::command]
fn clear_all_storage(app_handle: tauri::AppHandle) {
    // Clear user data
    let mut user = USER.lock().unwrap();
    user.show_controls = true; // Reset to default

    // Clear occupied ports
    let mut ports = OCCUPIED_PORTS.lock().unwrap();
    ports.clear();

    // Clear messages
    let mut messages = MESSAGES.lock().unwrap();
    messages.clear();

    // Clear containers
    let mut containers = CONTAINERS.lock().unwrap();
    containers.clear();

    // Save updated containers to disk
    let containers_file = app_handle.path().app_data_dir()
        .expect("Failed to get app data dir")
        .join("containers.json");
    
    if let Ok(json) = serde_json::to_string(&*containers) {
        if let Err(e) = std::fs::write(&containers_file, json) {
            eprintln!("Failed to save containers file: {}", e);
        }
    }

    // Save messages to disk
    let messages_file = get_messages_file(&app_handle);
    if let Ok(json) = serde_json::to_string(&*messages) {
        if let Err(e) = std::fs::write(&messages_file, json) {
            eprintln!("Failed to save messages file: {}", e);
        }
    }
}

// Clear all messages and message IDs in the containers
#[tauri::command]
fn clear_all_messages(app_handle: tauri::AppHandle) {
    // Clear message IDs from containers
    let mut containers = CONTAINERS.lock().unwrap();
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
    let containers = CONTAINERS.lock().unwrap();
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    dotenv().ok();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Store the app handle globally
            *APP_HANDLE.lock().unwrap() = Some(app.handle().clone());

            // Check for podman and install if needed
            let _ = tauri::async_runtime::block_on(podman_setup());
            // Load containers on startup
            if let Ok(containers) = load_containers(&app.handle()) {
                let mut stored_containers = CONTAINERS.lock().unwrap();
                *stored_containers = containers.clone();
                // Start all containers using the helper function
                tauri::async_runtime::spawn(start_all_containers(containers));
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
            create_agent_container,
            get_agent_container,
            get_all_containers,
            get_user_data,
            update_user_data,
            print_all_storage,
            clear_all_storage,
            get_agent_messages,
            clear_all_messages,
            start_container,
            get_prompt_running
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}