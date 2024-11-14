use std::process::Command;
use std::env;
use std::sync::Mutex;
use once_cell::sync::Lazy;
use serde::{Serialize, Deserialize};
use tauri::Manager;
use dotenv::dotenv;
use tauri::utils::assets::{resource_relpath, EmbeddedAssets};
use std::path::PathBuf;
use tauri::Wry;
use tauri::Runtime;
use tauri::Emitter;

use log::{info, error};

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
    pub agent_name: String,
    pub message_ids: Vec<String>,
    pub agent_id: String,
    pub system_prompt: String,
}

//Containers
pub static CONTAINERS: Lazy<Mutex<Vec<Container>>> = Lazy::new(|| {
    Mutex::new(Vec::new())
});

// Add this near your other static variables
static APP_HANDLE: Lazy<Mutex<Option<tauri::AppHandle>>> = Lazy::new(|| Mutex::new(None));

// Add this near your other static variables
static SETUP_COMPLETE: Lazy<Mutex<bool>> = Lazy::new(|| Mutex::new(false));

// Add this command to check setup status
#[tauri::command]
fn is_setup_complete() -> bool {
    *SETUP_COMPLETE.lock().unwrap()
}

// Add this helper function
pub fn get_app_handle() -> Option<tauri::AppHandle> {
    APP_HANDLE.lock().unwrap().clone()
}


#[tauri::command]
async fn get_prompt_running(agent_id: String) -> String {
    AGENT_CONNECTIONS.lock().await.get(&agent_id).map(|conn| conn.prompt_running.clone()).unwrap_or("na".to_string())
}

fn get_resource_path(app_handle: &tauri::AppHandle, resource: &str) -> PathBuf {
    app_handle.path().resource_dir()
        .expect("Failed to get resource dir")
        .join(resource)
}

#[tauri::command]
async fn create_agent_container(
    app_handle: tauri::AppHandle,
    agent_id: String,
    agent_type: String,
    agent_name: String,
    number: i32,
    message_ids: Vec<String>,
    system_prompt: String
) -> Result<Container, String> {
    println!("Creating agent container!");
    let ports = get_available_ports().map_err(|e| e.to_string())?;
    let container_name = format!("agent-{}", agent_id);

    // Check and remove existing container
    if !String::from_utf8_lossy(&Command::new("/opt/homebrew/bin/podman").args(&["ps", "-a", "--filter", &format!("name={}", container_name)]).output().map_err(|e| e.to_string())?.stdout,).trim().is_empty(){
        Command::new("/opt/homebrew/bin/podman").args(&["rm", "-f", &container_name]).output().map_err(|e| e.to_string())?;
    }

    let dockerfile_path = get_resource_path(&app_handle, "Dockerfile");

    let build_output = Command::new("/opt/homebrew/bin/podman")
        .args(&[
            "build",
            "-t",
            "localhost/minimal-vnc-desktop:latest",
            "-f",
            &dockerfile_path.to_string_lossy(),
            "."
        ])
        .current_dir(dockerfile_path.parent().unwrap())
        .output()
        .map_err(|e| format!("Build failed: {}", e.to_string()))?;

    if !build_output.status.success() {
        let error_message = String::from_utf8_lossy(&build_output.stderr).to_string();
        error!("Failed to build image: {}", error_message);
        return Err(error_message);
    }

    // Run container with the locally built image
    let run_output = Command::new("/opt/homebrew/bin/podman")
        .args(&["run", 
        "-d", "--network", "bridge", 
        "-e", "DISPLAY=:0", 
        "-e", &format!("CONTAINER_ID={}", agent_id), 
        "-e", &format!("ANTHROPIC_API_KEY={}", ""),
        "-e", "GEOMETRY=1920x1080", 
        "-e", "HOST_IP=host.containers.internal", 
        "-p", &format!("{}:5900", ports[0]), 
        "-p", &format!("{}:6080", ports[1]), 
        "--name", &container_name, 
        "localhost/minimal-vnc-desktop:latest"])  // Use the locally built image
        .output()
        .map_err(|e| e.to_string())?;

    if !run_output.status.success() {
        let error_message = String::from_utf8_lossy(&run_output.stderr).to_string();
        error!("Failed to start container: {}", error_message);
        return Err(error_message);
    }

    let container = Container {
        id: String::from_utf8_lossy(&run_output.stdout).trim().to_string(),
        vnc_port: ports[1],
        agent_id,
        agent_type,
        agent_name,
        number,
        message_ids,
        system_prompt
    };

    let mut containers = CONTAINERS.lock().unwrap();
    containers.push(container.clone());
    save_containers(&app_handle, &containers).map_err(|e| e.to_string())?;

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
    tokio::process::Command::new("/opt/homebrew/bin/podman")
        .args(&["start", &container_id])
        .output()
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn update_agent_system_prompt(agent_id: String, system_prompt: String) -> Result<(), String> {
    let app_handle = get_app_handle().ok_or("Failed to get app handle")?;
    let mut containers = CONTAINERS.lock().unwrap();
    let container = containers.iter_mut().find(|c| c.agent_id == agent_id).ok_or("Container not found")?;
    container.system_prompt = system_prompt;
    save_containers(&app_handle, &containers).map_err(|e| e.to_string())?;
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
    let _ = serde_json::to_string(&*containers).map(|json| std::fs::write(&containers_file, json));
    
    let messages_file = get_messages_file(&app_handle);
    let _ = serde_json::to_string(&*messages).map(|json| std::fs::write(&messages_file, json));
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
    
    let _ = serde_json::to_string(&*containers)
        .map(|json| std::fs::write(&containers_file, json));

    // Clear messages from memory and disk
    let mut messages = MESSAGES.lock().unwrap();
    messages.clear();
    let _ = std::fs::remove_file(get_messages_file(&app_handle));
}

//read all user data
#[tauri::command]
fn get_user_data() -> User {
    log::info!("Tauri is awesome!");
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


async fn setup_app(app: tauri::AppHandle) -> Result<(), String> {
    // Get windows before spawning
    let splashscreen = app.get_webview_window("splashscreen");
    let main = app.get_webview_window("main");

    // Store the app handle globally
    {
        let mut handle = APP_HANDLE.lock().unwrap();
        *handle = Some(app.clone());
    }
    // Check for podman and install if needed
    podman_setup().await;  // Changed: remove block_on
    
    // Load containers on startup
    if let Ok(containers) = load_containers(&app) {
        {
            let mut stored_containers = CONTAINERS.lock().unwrap();
            *stored_containers = containers.clone();
        }
        // Start all containers using the helper function
        start_all_containers(containers).await;  // Changed: remove block_on
    }

    // Add this: Load messages on startup
    if let Ok(messages) = load_messages(&app) {
        let mut stored_messages = MESSAGES.lock().unwrap();
        *stored_messages = messages;
    }

    // Start the WebSocket server in an async task
    tauri::async_runtime::spawn(async move {
        println!("Starting WebSocket server!");
        start_websocket_server().await;
    });

    // Mark setup as complete before handling windows
    {
        let mut setup_complete = SETUP_COMPLETE.lock().unwrap();
        *setup_complete = true;
    }

    // Emit an event to notify frontend
    app.emit("setup-complete", ()).map_err(|e| e.to_string())?;

    // Handle windows at the end
    if let Some(splashscreen_window) = splashscreen {
        splashscreen_window.close().unwrap();
    }
    if let Some(main_window) = main {
        main_window.show().unwrap();
    }

    Ok(())
}


pub fn run() {
    dotenv().ok();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let splashscreen_window = app.get_webview_window("splashscreen").unwrap();
            let main_window = app.get_webview_window("main").unwrap();

            info!("Setting up app here - run 4!");
            // Store the app handle globally
            *APP_HANDLE.lock().unwrap() = Some(app.handle().clone());

            info!("Setting up app here 2!");
            println!("Setting up app here 2!");
            // Check for podman and install if needed
            let _ = tauri::async_runtime::block_on(podman_setup());
            println!("Podman setup complete!");
            // Load containers on startup
            if let Ok(containers) = load_containers(&app.handle()) {
                let mut stored_containers = CONTAINERS.lock().unwrap();
                *stored_containers = containers.clone();
                // Start all containers using the helper function
                tauri::async_runtime::block_on(start_all_containers(containers));
            }
            info!("Setting up app here 3!");
            println!("Setting up app here 3!");

            // Add this: Load messages on startup
            if let Ok(messages) = load_messages(&app.handle()) {
                let mut stored_messages = MESSAGES.lock().unwrap();
                *stored_messages = messages;
            }
            info!("Setting up app here 4!");
            println!("Setting up app here 4!");

            // Start the WebSocket server in an async task
            tauri::async_runtime::spawn(async move {
                println!("Starting WebSocket server!");
                start_websocket_server().await;
            });

            splashscreen_window.close().unwrap();
            main_window.show().unwrap();

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
            get_prompt_running,
            update_agent_system_prompt,
            is_setup_complete
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}