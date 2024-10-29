use std::process::Command;
use std::env;
use std::sync::Mutex;
use once_cell::sync::Lazy;

static OCCUPIED_PORTS: Lazy<Mutex<Vec<u16>>> = Lazy::new(|| Mutex::new(Vec::new()));

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

fn check_ports() -> Vec<u16> {
    let ports_to_check = [5900, 8501, 6080, 8080];
    let mut occupied = Vec::new();

    for &port in &ports_to_check {
        if is_port_in_use(port) {
            occupied.push(port);
        }
    }

    let mut global_occupied = OCCUPIED_PORTS.lock().unwrap();
    *global_occupied = occupied.clone();

    occupied
}

fn build_and_run_docker() -> Result<(), String> {
    println!("Checking if required ports are available...");

    let occupied_ports = check_ports();

    if !occupied_ports.is_empty() {
        println!("Some required ports are already in use: {:?}. Skipping Docker container launch.", occupied_ports);
        return Ok(());
    }

    println!("All required ports are available. Starting a new Docker container...");

    // Get the ANTHROPIC_API_KEY from environment variable
    let api_key = env::var("ANTHROPIC_API_KEY").map_err(|_| "ANTHROPIC_API_KEY not set")?;

    // Get the user's home directory
    let home_dir = env::var("HOME").map_err(|_| "HOME directory not found")?;

    println!("Attempting to run Docker container...");

    // Run the Docker container
    let run_output = Command::new("docker")
        .args(&[
            "run",
            "-d",  // Run in detached mode
            "-e", &format!("ANTHROPIC_API_KEY={}", api_key),
            "-v", &format!("{}/.anthropic:/home/computeruse/.anthropic", home_dir),
            "-p", "5900:5900",
            "-p", "8501:8501",
            "-p", "6080:6080",
            "-p", "8080:8080",
            "-it",  // Add interactive and TTY flags
            "ghcr.io/anthropics/anthropic-quickstarts:computer-use-demo-latest",
        ])
        .output()
        .map_err(|e| e.to_string())?;

    if !run_output.status.success() {
        let error = String::from_utf8_lossy(&run_output.stderr);
        if error.contains("port is already allocated") {
            println!("Docker run failed due to ports being allocated. Proceeding as if container is already running.");
            return Ok(());
        } else {
            return Err(format!("Docker run failed. Error: {}", error));
        }
    }

    println!("Docker container started successfully.");
    Ok(())
}

#[derive(serde::Serialize, Clone)]
struct DockerContainer {
    id: String,
    vnc_port: u16,
    agent_id: String,
}

static DOCKER_CONTAINERS: Lazy<Mutex<Vec<DockerContainer>>> = Lazy::new(|| Mutex::new(Vec::new()));

fn get_available_ports(num_ports: u16) -> Result<Vec<u16>, String> {
    let mut available_ports = Vec::new();
    
    // Check VNC ports starting at 5900
    for offset in 0..num_ports {
        let port = 5900 + offset;
        if !is_port_in_use(port) {
            available_ports.push(port);
            break;
        }
    }
    
    // Check noVNC ports starting at 6080
    for offset in 0..num_ports {
        let port = 6080 + offset;
        if !is_port_in_use(port) {
            available_ports.push(port);
            break;
        }
    }

    if available_ports.len() < 2 {
        return Err("Not enough available ports".to_string());
    }

    Ok(available_ports)
}

#[tauri::command]
async fn create_agent_container(agent_id: String) -> Result<DockerContainer, String> {
    let ports = get_available_ports(2)?;
    let vnc_port = ports[0];
    let novnc_port = ports[1];

    println!("Building Docker image...");
    
    // Build the Docker image
    let build_output = Command::new("docker")
        .args(&[
            "build",
            "-t",
            "minimal-vnc-desktop",
            env!("CARGO_MANIFEST_DIR"),  // This gets the directory containing Cargo.toml
        ])
        .output()
        .map_err(|e| format!("Failed to build Docker image: {}", e))?;

    if !build_output.status.success() {
        let error = String::from_utf8_lossy(&build_output.stderr);
        return Err(format!("Failed to build Docker image: {}", error));
    }

    println!("Starting Docker container for agent {} with VNC port {} and noVNC port {}", 
             agent_id, vnc_port, novnc_port);

    // Run the Docker container
    let run_output = Command::new("docker")
        .args(&[
            "run",
            "-d",  // Run in detached mode
            "-e", "DISPLAY=:0",
            "-e", "GEOMETRY=1920x1080",
            "-p", &format!("{}:5900", vnc_port),
            "-p", &format!("{}:6080", novnc_port),
            "--name", &format!("agent-{}", agent_id),
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
    };

    let mut containers = DOCKER_CONTAINERS.lock().unwrap();
    containers.push(container.clone());

    Ok(container)
}

#[tauri::command]
fn get_agent_container(agent_id: String) -> Option<DockerContainer> {
    let containers = DOCKER_CONTAINERS.lock().unwrap();
    containers.iter().find(|c| c.agent_id == agent_id).cloned()
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn get_occupied_ports() -> Vec<u16> {
    OCCUPIED_PORTS.lock().unwrap().clone()
}

#[tauri::command]
async fn cleanup_agent_container(agent_id: String) -> Result<(), String> {
    let mut containers = DOCKER_CONTAINERS.lock().unwrap();
    if let Some(pos) = containers.iter().position(|c| c.agent_id == agent_id) {
        let container = containers.remove(pos);
        
        // Stop and remove the container
        Command::new("docker")
            .args(&["rm", "-f", &container.id])
            .output()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            get_occupied_ports,
            create_agent_container,
            get_agent_container,
            cleanup_agent_container
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
