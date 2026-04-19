use std::collections::HashMap;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use std::process::Stdio;

pub struct PythonRunner {
    python_path: String,
}

#[derive(Debug, Clone)]
pub struct ExecutionOutput {
    pub stdout: Vec<String>,
    pub stderr: Vec<String>,
    pub exit_code: Option<i32>,
}

impl PythonRunner {
    pub fn new(python_path: Option<String>) -> Self {
        Self {
            python_path: python_path.unwrap_or_else(|| {
                if cfg!(target_os = "windows") {
                    "python".to_string()
                } else {
                    "python3".to_string()
                }
            }),
        }
    }

    pub async fn execute(
        &self,
        script_path: &str,
        args: Vec<String>,
        env_vars: Option<HashMap<String, String>>,
    ) -> Result<ExecutionOutput, String> {
        let mut cmd = Command::new(&self.python_path);
        cmd.arg(script_path)
            .args(&args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        // Set working directory to script's parent directory
        if let Some(parent) = std::path::Path::new(script_path).parent() {
            cmd.current_dir(parent);
        }

        if let Some(env) = env_vars {
            for (key, value) in env {
                cmd.env(key, value);
            }
        }

        let mut child = cmd
            .spawn()
            .map_err(|e| format!("启动 Python 进程失败: {}", e))?;

        let stdout = child
            .stdout
            .take()
            .ok_or("无法捕获 stdout")?;
        let stderr = child
            .stderr
            .take()
            .ok_or("无法捕获 stderr")?;

        let stdout_reader = BufReader::new(stdout);
        let stderr_reader = BufReader::new(stderr);

        let stdout_handle = tokio::spawn(async move {
            let mut lines = stdout_reader.lines();
            let mut result = Vec::new();
            while let Ok(Some(line)) = lines.next_line().await {
                result.push(line);
            }
            result
        });

        let stderr_handle = tokio::spawn(async move {
            let mut lines = stderr_reader.lines();
            let mut result = Vec::new();
            while let Ok(Some(line)) = lines.next_line().await {
                result.push(line);
            }
            result
        });

        let stdout_lines = stdout_handle.await.map_err(|e| format!("读取 stdout 失败: {}", e))?;
        let stderr_lines = stderr_handle.await.map_err(|e| format!("读取 stderr 失败: {}", e))?;

        let status = child
            .wait()
            .await
            .map_err(|e| format!("等待进程结束失败: {}", e))?;

        Ok(ExecutionOutput {
            stdout: stdout_lines,
            stderr: stderr_lines,
            exit_code: status.code(),
        })
    }
}
