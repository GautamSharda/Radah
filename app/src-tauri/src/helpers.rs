use std::process::Command;
use std::fs;
use std::path::PathBuf;
use tauri::Runtime;
use serde_json;
use crate::{Container, CONTAINERS, MESSAGES};
use tauri::Manager; // <-- Add this line



#[cfg(target_os = "macos")]
pub fn is_port_in_use(port: u16) -> bool {
    let output = Command::new("lsof")
        .arg("-i")
        .arg(format!(":{}", port))
        .output()
        .expect("Failed to execute lsof command");

    !output.stdout.is_empty()
}

#[cfg(target_os = "linux")]
pub fn is_port_in_use(port: u16) -> bool {
    let output = Command::new("ss")
        .arg("-ln")
        .arg("sport")
        .arg(format!("= :{}", port))
        .output()
        .expect("Failed to execute ss command");

    !output.stdout.is_empty()
}

#[cfg(target_os = "windows")]
pub fn is_port_in_use(port: u16) -> bool {
    let output = Command::new("netstat")
        .arg("-ano")
        .arg("|")
        .arg("findstr")
        .arg(format!(":{}", port))
        .output()
        .expect("Failed to execute netstat command");

    !output.stdout.is_empty()
}

pub fn get_containers_file<R: Runtime>(app: &tauri::AppHandle<R>) -> PathBuf {
    app.path().app_data_dir()
        .expect("Failed to get app data dir")
        .join("containers.json")
}

pub fn save_messages<R: Runtime>(app: &tauri::AppHandle<R>, messages: &std::collections::HashMap<String, serde_json::Value>) -> Result<(), String> {
    let file_path = app.path().app_data_dir()
        .expect("Failed to get app data dir")
        .join("messages.json");
    
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

pub fn save_containers<R: Runtime>(app: &tauri::AppHandle<R>, containers: &[Container]) -> Result<(), String> {
    let file_path = get_containers_file(app);
    
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

pub fn load_containers<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<Vec<Container>, String> {
    let file_path = get_containers_file(app);
    
    if !file_path.exists() {
        return Ok(Vec::new());
    }

    let contents = fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read containers file: {}", e))?;

    serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse containers file: {}", e))
}

pub fn get_messages_file<R: Runtime>(app: &tauri::AppHandle<R>) -> PathBuf {
    app.path().app_data_dir()
        .expect("Failed to get app data dir")
        .join("messages.json")
}

pub fn load_messages<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<std::collections::HashMap<String, serde_json::Value>, String> {
    let file_path = get_messages_file(app);
    
    if !file_path.exists() {
        return Ok(std::collections::HashMap::new());
    }

    let contents = fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read messages file: {}", e))?;

    serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse messages file: {}", e))
}

pub async fn start_all_containers(containers: Vec<Container>) {
    for container in containers {
        let container_id = container.id.clone();
        println!("Starting container: {}", container_id);
        
        tauri::async_runtime::spawn(async move {
            match super::start_container(container_id.clone()).await {
                Ok(_) => println!("Successfully started container {}", container_id),
                Err(e) => eprintln!("Failed to start container {}: {}", container_id, e),
            }
        });
    }
}

pub fn get_available_ports() -> Result<Vec<u16>, String> {
    let mut available_ports = Vec::new();
    let containers = CONTAINERS.lock().unwrap();
    
    let used_ports: Vec<u16> = containers.iter()
        .map(|c| c.vnc_port)
        .collect();
    
    for offset in 0..100 {
        let port = 5900 + offset;
        if !is_port_in_use(port) && !used_ports.contains(&port) {
            available_ports.push(port);
            if available_ports.len() == 1 {
                for novnc_offset in 0..100 {
                    let novnc_port = 6080 + novnc_offset;
                    if !is_port_in_use(novnc_port) && !used_ports.contains(&novnc_port) {
                        available_ports.push(novnc_port);
                        return Ok(available_ports);
                    }
                }
            }
        }
    }

    Err("Not enough available ports".to_string())
}

pub fn get_recent_agent_messages(agent_id: String, n: usize) -> Vec<serde_json::Value> {
    let containers = CONTAINERS.lock().unwrap();
    let messages = MESSAGES.lock().unwrap();
    let mut result = Vec::new();

    if let Some(container) = containers.iter().find(|c| c.agent_id == agent_id) {
        for message_id in container.message_ids.iter().rev() {
            if let Some(json_value) = messages.get(message_id) {
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
