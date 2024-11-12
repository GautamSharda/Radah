use std::process::Command;
use log::{info, error};

//global string variable for podman name
pub static PODMAN_NAME: &str = "radah-podman-machine-name";

// Add this function to check for podman
pub async fn podman_setup() -> Result<(), String> {
    info!("Checking if podman is installed...");
    let output = Command::new("/opt/homebrew/bin/podman")
        .args(&["--version"])
        .output();
    
    match output {
        Ok(_output) => {
            info!("Podman is already installed, proceeding with configuration");
            configure_podman().await
        },
        Err(e) => {
            if e.kind() == std::io::ErrorKind::NotFound {
                info!("Podman not found, starting installation process");
                install_podman().await?;
                configure_podman().await
            } else {
                let err_msg = format!("Error checking podman: {}", e);
                error!("{}", err_msg);
                Err(err_msg)
            }
        }
    }
}


#[cfg(target_os = "macos")]
async fn install_podman() -> Result<(), String> {
    info!("Starting podman installation process");
    
    // Check if brew is installed
    info!("Checking if Homebrew is installed");



    let brew_check = std::path::Path::new("/opt/homebrew/bin/brew").exists() || std::path::Path::new("/usr/local/bin/").exists();

    info!("brew_check 2.1: {}", brew_check);

    if !brew_check {
        let err_msg = "Failed to check for brew: Homebrew not found".to_string();
        info!("Homebrew not found, installing it first");
        install_homebrew().await?;
    }

        
    // info!("Verifying Homebrew installation");
    // let brew_recheck = Command::new("sudo")
    //     .arg("which")
    //     .arg("brew")
    //     .output()
    //     .map_err(|e| {
    //         let err_msg = format!("Failed to check for brew after installation: {}", e);
    //         error!("{}", err_msg);
    //         err_msg
    //     })?;
    // if !brew_recheck.status.success() {
    //     let err_msg = "Failed to install Homebrew properly".to_string();
    //     error!("{}", err_msg);
    //     return Err(err_msg);
    // }

    info!("We have homebrew");

    info!("Installing podman via Homebrew");
    let install_output = Command::new("/opt/homebrew/bin/brew")
        .args(&["install", "podman"])
        .output()
        .map_err(|e| {
            let err_msg = format!("Failed to install podman: {}", e);
            error!("{}", err_msg);
            err_msg
        })?;

    if !install_output.status.success() {
        let error = String::from_utf8_lossy(&install_output.stderr);
        let err_msg = format!("Failed to install podman: {}", error);
        error!("{}", err_msg);
        return Err(err_msg);
    }

    info!("Podman installation completed successfully");
    Ok(())
}



async fn configure_podman() -> Result<(), String> {
    info!("Starting podman configuration");
    
    let machine_exists = Command::new("/opt/homebrew/bin/podman")
        .args(&["machine", "inspect", PODMAN_NAME])
        .output()
        .map_err(|e| {
            let err_msg = format!("Failed to check if podman machine exists: {}", e);
            error!("{}", err_msg);
            err_msg
        })?;

    info!("Machine exists status: {}", machine_exists.status);
    if !machine_exists.status.success() {
        info!("Initializing new podman machine: {}", PODMAN_NAME);
        let init_output = Command::new("/opt/homebrew/bin/podman")
            .args(&["machine", "init", PODMAN_NAME])
            .output()
            .map_err(|e| {
                let err_msg = format!("Failed to initialize podman machine: {}", e);
                error!("{}", err_msg);
                err_msg
            })?;

        if !init_output.status.success() {
            let error = String::from_utf8_lossy(&init_output.stderr);
            let err_msg = format!("Failed to initialize podman machine: {}", error);
            error!("{}", err_msg);
            return Err(err_msg);
        }
        info!("Podman machine initialized successfully");
    }

    info!("Checking podman machine state");
    let inspect_output = Command::new("/opt/homebrew/bin/podman")
        .args(&["machine", "inspect", PODMAN_NAME])
        .output()
        .map_err(|e| {
            let err_msg = format!("Failed to inspect podman machine: {}", e);
            error!("{}", err_msg);
            err_msg
        })?;

    if inspect_output.status.success() {
        let inspect_str = String::from_utf8_lossy(&inspect_output.stdout);
        let inspect_json: serde_json::Value = serde_json::from_str(&inspect_str)
            .map_err(|e| {
                let err_msg = format!("Failed to parse machine inspect output: {}", e);
                error!("{}", err_msg);
                err_msg
            })?;
        
        if let Some(state) = inspect_json[0]["State"].as_str() {
            info!("Current podman machine state: {}", state);
            if state != "running" {
                info!("Starting podman machine: {}", PODMAN_NAME);
                let start_output = Command::new("/opt/homebrew/bin/podman")
                    .args(&["machine", "start", PODMAN_NAME])
                    .output()
                    .map_err(|e| {
                        let err_msg = format!("Failed to start podman machine: {}", e);
                        error!("{}", err_msg);
                        err_msg
                    })?;

                if !start_output.status.success() {
                    let error = String::from_utf8_lossy(&start_output.stderr);
                    let err_msg = format!("Failed to start podman machine: {}", error);
                    error!("{}", err_msg);
                    return Err(err_msg);
                }
                info!("Podman machine started successfully");
            }
        }
    }
    info!("Podman configuration completed successfully");
    Ok(())
}


#[cfg(target_os = "macos")]
async fn install_homebrew() -> Result<(), String> {
    info!("Starting Homebrew installation");
    
    let install_cmd = "/bin/bash -c \"$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"";
    
    let output = Command::new("bash")
        .arg("-c")
        .arg(install_cmd)
        .output()
        .map_err(|e| {
            let err_msg = format!("Failed to execute Homebrew installation: {}", e);
            error!("{}", err_msg);
            err_msg
        })?;

    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        let err_msg = format!("Failed to install Homebrew: {}", error);
        error!("{}", err_msg);
        return Err(err_msg);
    }

    info!("Homebrew installed successfully");
    Ok(())
}
