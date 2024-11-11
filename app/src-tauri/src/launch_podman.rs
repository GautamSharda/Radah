use std::process::Command;

//global string variable for podman name
pub static PODMAN_NAME: &str = "radah-podman-machine-name";

// Add this function to check for podman
pub async fn podman_setup() -> Result<(), String> {
    let output = Command::new("podman")
        .args(&["--version"])
        .output();
    
    match output {
        Ok(_output) => {
            println!("Podman is already installed");
            configure_podman().await
        },
        Err(e) => {
            // If command not found, return Ok(false) instead of an error
            if e.kind() == std::io::ErrorKind::NotFound {
                println!("Podman not found, installing...");
                install_podman().await?;
                configure_podman().await
            } else {
                Err(format!("Error checking podman: {}", e))
            }
        }
    }
}


#[cfg(target_os = "macos")]
async fn install_podman() -> Result<(), String> {
    // Check if brew is installed
    let brew_check = Command::new("which")
        .arg("brew")
        .output()
        .map_err(|e| format!("Failed to check for brew: {}", e))?;

    if !brew_check.status.success() {
        println!("Homebrew not found, installing it first...");
        install_homebrew().await?;
        
        // Double check brew is now available
        let brew_recheck = Command::new("which")
            .arg("brew")
            .output()
            .map_err(|e| format!("Failed to check for brew after installation: {}", e))?;
            
        if !brew_recheck.status.success() {
            return Err("Failed to install Homebrew properly".to_string());
        }
    }

    // Install podman using brew
    println!("Installing podman...");
    let install_output = Command::new("brew")
        .args(&["install", "podman"])
        .output()
        .map_err(|e| format!("Failed to install podman: {}", e))?;

    if !install_output.status.success() {
        let error = String::from_utf8_lossy(&install_output.stderr);
        return Err(format!("Failed to install podman: {}", error));
    }

    Ok(())
}



async fn configure_podman() -> Result<(), String> {
    //Check if podman machine already exists
    let machine_exists = Command::new("podman")
        .args(&["machine", "inspect", PODMAN_NAME])
        .output()
        .map_err(|e| format!("Failed to check if podman machine exists: {}", e))?;

    println!("Machine exists status: {}", machine_exists.status);
    if !machine_exists.status.success() {
        println!("Initializing podman machine...");
        let init_output = Command::new("podman")
            .args(&["machine", "init", PODMAN_NAME])
            .output()
            .map_err(|e| format!("Failed to initialize podman machine: {}", e))?;

        if !init_output.status.success() {
            let error = String::from_utf8_lossy(&init_output.stderr);
            return Err(format!("Failed to initialize podman machine: {}", error));
        }
    }

    println!("Podman machine initialized successfully");

    // Check if machine is running
    let inspect_output = Command::new("podman")
        .args(&["machine", "inspect", PODMAN_NAME])
        .output()
        .map_err(|e| format!("Failed to inspect podman machine: {}", e))?;

    if inspect_output.status.success() {
        let inspect_str = String::from_utf8_lossy(&inspect_output.stdout);
        let inspect_json: serde_json::Value = serde_json::from_str(&inspect_str)
            .map_err(|e| format!("Failed to parse machine inspect output: {}", e))?;
        
        if let Some(state) = inspect_json[0]["State"].as_str() {
            if state != "running" {
                println!("Starting podman machine...");
                let start_output = Command::new("podman")
                    .args(&["machine", "start", PODMAN_NAME])
                    .output()
                    .map_err(|e| format!("Failed to start podman machine: {}", e))?;

                if !start_output.status.success() {
                    let error = String::from_utf8_lossy(&start_output.stderr);
                    println!("Failed to start podman machine: {}", error);
                    return Err(format!("Failed to start podman machine: {}", error));
                }
                println!("Podman machine started successfully");
            }
        }
    }
    Ok(())
}


#[cfg(target_os = "macos")]
async fn install_homebrew() -> Result<(), String> {
    println!("Installing Homebrew...");
    
    // The official Homebrew installation command
    let install_cmd = "/bin/bash -c \"$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"";
    
    let output = Command::new("bash")
        .arg("-c")
        .arg(install_cmd)
        .output()
        .map_err(|e| format!("Failed to execute Homebrew installation: {}", e))?;

    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to install Homebrew: {}", error));
    }

    println!("Homebrew installed successfully");
    Ok(())
}
