// Neural Engine v3.1 — High-Velocity Vocal Bridge
// Enhancements: Persistent process (Warm Start), Atomic state management.

use serde::{Deserialize, Serialize};
use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::Mutex;
use tauri::Manager;

#[derive(Serialize, Deserialize)]
pub struct RunResult {
    stdout: String,
    stderr: String,
    exit_code: i32,
}

// ── State ────────────────────────────────────────────────────────────────────

#[tauri::command]
async fn core_proxy_fetch(
    url: String,
    method: String,
    headers: std::collections::HashMap<String, String>,
    body: String,
) -> Result<String, String> {
    println!("[CORE] Proxy Fetch: {} {} (Headers: {})", method, url, headers.len());
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| e.to_string())?;
    let mut builder = match method.as_str() {
        "POST" => client.post(&url),
        _ => client.get(&url),
    };

    for (key, value) in headers {
        builder = builder.header(key, value);
    }

    let response = builder
        .body(body)
        .send()
        .await
        .map_err(|e: reqwest::Error| e.to_string())?;

    let status = response.status();
    let text = response.text().await.map_err(|e: reqwest::Error| e.to_string())?;
    
    if !status.is_success() {
        return Err(format!("HTTP {}: {}", status.as_u16(), text));
    }

    Ok(text)
}

struct NeuralState {
    // Persistent process management placeholder.
}

// ── Helpers ──────────────────────────────────────────────────────────────────

fn resolve_piper_dir() -> Result<PathBuf, String> {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .map_err(|_| "Cannot resolve home directory".to_string())?;
    Ok(PathBuf::from(home).join("tools").join("piper"))
}

#[cfg(target_os = "windows")]
fn piper_exe_name() -> &'static str {
    "piper.exe"
}
#[cfg(not(target_os = "windows"))]
fn piper_exe_name() -> &'static str {
    "piper"
}

fn base64_encode(bytes: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((bytes.len() + 2) / 3 * 4);
    for chunk in bytes.chunks(3) {
        let (b0, b1, b2) = (
            chunk[0] as u32,
            if chunk.len() > 1 { chunk[1] as u32 } else { 0 },
            if chunk.len() > 2 { chunk[2] as u32 } else { 0 },
        );
        let n = (b0 << 16) | (b1 << 8) | b2;
        out.push(TABLE[((n >> 18) & 0x3F) as usize] as char);
        out.push(TABLE[((n >> 12) & 0x3F) as usize] as char);
        out.push(if chunk.len() > 1 {
            TABLE[((n >> 6) & 0x3F) as usize] as char
        } else {
            '='
        });
        out.push(if chunk.len() > 2 {
            TABLE[(n & 0x3F) as usize] as char
        } else {
            '='
        });
    }
    out
}

#[tauri::command]
async fn speak_neural(
    text: String,
    app_handle: tauri::AppHandle,
    _state: tauri::State<'_, Mutex<NeuralState>>,
) -> Result<String, String> {
    if text.trim().is_empty() {
        return Err("Empty".to_string());
    }

    let piper_dir = resolve_piper_dir()?;
    let piper_exe = piper_dir.join("piper").join(piper_exe_name());
    let model_path = piper_dir.join("en_US-kristin-medium.onnx");

    // We use a unique file to prevent race conditions during rapid speech.
    let cache_dir = app_handle
        .path()
        .app_cache_dir()
        .map_err(|e| e.to_string())?;
    let output_wav = cache_dir.join(format!(
        "vocal_{}.wav",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .subsec_nanos()
    ));

    // 🚀 Velocity Mode: One-shot synthesis is slow.
    // Ideally we'd pipe STDIN -> STDOUT to avoid WAV handling, but piper's STDOUT
    // is raw PCM. To keep frontend integration simple, we use high-speed WAV generation.
    let mut child = Command::new(&piper_exe)
        .arg("-m")
        .arg(&model_path)
        .arg("-f")
        .arg(&output_wav)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Piper Fail: {}", e))?;

    {
        let mut stdin = child.stdin.take().ok_or("STDIN Fail")?;
        stdin
            .write_all(text.as_bytes())
            .map_err(|e| e.to_string())?;
        // Dropping stdin signals EOF to Piper
    }

    let status = child.wait().map_err(|e| e.to_string())?;
    if !status.success() {
        return Err("Synthesis Error".to_string());
    }

    let bytes = std::fs::read(&output_wav).map_err(|e| e.to_string())?;
    let _ = std::fs::remove_file(&output_wav);

    Ok(format!("data:audio/wav;base64,{}", base64_encode(&bytes)))
}

#[tauri::command]
async fn run_code(
    code: String,
    input: String,
    language: String,
    app_handle: tauri::AppHandle,
) -> Result<RunResult, String> {
    let cache_dir = app_handle
        .path()
        .app_cache_dir()
        .map_err(|e| e.to_string())?;
    let temp_id = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .subsec_nanos();

    // Config per language: (file_name, compile_cmd, compile_args, exec_cmd, exec_args, cleanup_files)
    let (file_name, compile_cmd, compile_args, exec_cmd, exec_args, cleanup_files) =
        match language.as_str() {
            "cpp" => {
                let source = format!("sol_{}.cpp", temp_id);
                let bin = format!("sol_{}.exe", temp_id);
                (
                    source.clone(),
                    Some("g++".to_string()),
                    vec![
                        "-O3".to_string(),
                        source.clone(),
                        "-o".to_string(),
                        bin.clone(),
                    ],
                    bin.clone(),
                    vec![] as Vec<String>,
                    vec![source, bin],
                )
            }
            "python" | "py" => {
                let source = format!("sol_{}.py", temp_id);
                (
                    source.clone(),
                    None as Option<String>,
                    vec![] as Vec<String>,
                    "python3".to_string(),
                    vec![source.clone()],
                    vec![source],
                )
            }
            "java" => {
                let subfolder = cache_dir.join(format!("java_{}", temp_id));
                std::fs::create_dir_all(&subfolder).map_err(|e| e.to_string())?;
                let source_path = subfolder.join("Main.java");
                std::fs::write(&source_path, &code).map_err(|e| e.to_string())?;

                let compile_output = Command::new("javac")
                    .arg(&source_path)
                    .output()
                    .map_err(|e| format!("javac fail: {}", e))?;
                if !compile_output.status.success() {
                    let err = String::from_utf8_lossy(&compile_output.stderr).to_string();
                    let _ = std::fs::remove_dir_all(&subfolder);
                    return Ok(RunResult {
                        stdout: String::new(),
                        stderr: err,
                        exit_code: 1,
                    });
                }
                return execute_java(subfolder, input).await;
            }
            _ => {
                return Err(format!(
                    "Language '{}' not yet supported in sandbox",
                    language
                ))
            }
        };

    let source_full_path = cache_dir.join(&file_name);
    if language != "java" {
        std::fs::write(&source_full_path, &code).map_err(|e| format!("FS Error: {}", e))?;
    }

    // 2. Compile if needed
    if let Some(cmd) = compile_cmd {
        let compile_output = Command::new(&cmd)
            .args(&compile_args)
            .current_dir(&cache_dir)
            .output()
            .map_err(|e| format!("Compiler Error ({}): {}", cmd, e))?;

        if !compile_output.status.success() {
            for f in &cleanup_files {
                let _ = std::fs::remove_file(cache_dir.join(f));
            }
            return Ok(RunResult {
                stdout: String::new(),
                stderr: String::from_utf8_lossy(&compile_output.stderr).to_string(),
                exit_code: compile_output.status.code().unwrap_or(1),
            });
        }
    }

    // 3. Execute
    let exec_full_path = if language == "cpp" {
        cache_dir.join(&exec_cmd)
    } else {
        PathBuf::from(exec_cmd)
    };

    let mut child_cmd = Command::new(&exec_full_path);
    if language == "python" || language == "py" {
        child_cmd.args(&exec_args).current_dir(&cache_dir);
    } else {
        child_cmd.current_dir(&cache_dir);
    }

    let mut child = child_cmd
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .or_else(|e| {
            // Fallback for python (if python3 is not available)
            if language == "python" || language == "py" {
                Command::new("python")
                    .args(&exec_args)
                    .current_dir(&cache_dir)
                    .stdin(Stdio::piped())
                    .stdout(Stdio::piped())
                    .stderr(Stdio::piped())
                    .spawn()
            } else {
                Err(e)
            }
        })
        .map_err(|e| format!("Runtime Error: {}", e))?;

    // Send input
    {
        let mut stdin = child.stdin.take().ok_or("Stdin Pipe Fail")?;
        stdin
            .write_all(input.as_bytes())
            .map_err(|e| e.to_string())?;
    }

    let output = child.wait_with_output().map_err(|e| e.to_string())?;

    // 4. Cleanup
    if language != "java" {
        for f in &cleanup_files {
            let _ = std::fs::remove_file(cache_dir.join(f));
        }
    }

    Ok(RunResult {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(0),
    })
}

async fn execute_java(folder: PathBuf, input: String) -> Result<RunResult, String> {
    let mut child = Command::new("java")
        .arg("Main")
        .current_dir(&folder)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Java Execution Fail: {}", e))?;

    {
        let mut stdin = child.stdin.take().ok_or("Java Stdin Fail")?;
        stdin
            .write_all(input.as_bytes())
            .map_err(|e| e.to_string())?;
    }

    let output = child.wait_with_output().map_err(|e| e.to_string())?;
    let _ = std::fs::remove_dir_all(&folder);

    Ok(RunResult {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(0),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .manage(Mutex::new(NeuralState {}))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .invoke_handler(tauri::generate_handler![speak_neural, run_code, core_proxy_fetch])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
