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

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn get_occupied_ports() -> Vec<u16> {
    OCCUPIED_PORTS.lock().unwrap().clone()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|_app| {
            if let Err(e) = build_and_run_docker() {
                eprintln!("Failed to build and run Docker container: {}", e);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet, get_occupied_ports])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
