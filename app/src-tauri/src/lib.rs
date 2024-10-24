use std::process::Command;
use std::path::PathBuf;
use std::env;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

fn build_and_run_docker() -> Result<(), String> {
    println!("Checking if Docker container is already running...");

    // Check if the container is already running
    let check_output = Command::new("docker")
        .args(&["ps", "-q", "-f", "name=computer-use-demo"])
        .output()
        .map_err(|e| e.to_string())?;

    if !check_output.stdout.is_empty() {
        println!("Container is already running. Using existing container.");
        return Ok(());
    }

    println!("Container not found. Starting a new one...");

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

    println!("Docker run command executed. Checking status...");

    if !run_output.status.success() {
        let error = String::from_utf8_lossy(&run_output.stderr);
        println!("Docker run failed. Error: {}", error);
        return Err(error.to_string());
    }

    println!("Docker container started successfully.");
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|_app| {
            // Build and run Docker container when the app starts
            build_and_run_docker().expect("Failed to build and run Docker container");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
