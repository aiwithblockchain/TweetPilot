use serde::{de::DeserializeOwned, Serialize};
use std::fs;
use std::path::PathBuf;

fn tweetpilot_dir() -> Result<PathBuf, String> {
    let home = std::env::var("HOME").map_err(|_| "无法读取 HOME 目录".to_string())?;
    let dir = PathBuf::from(home).join(".tweetpilot");
    fs::create_dir_all(&dir).map_err(|e| format!("创建存储目录失败: {}", e))?;
    Ok(dir)
}

pub fn read_json<T>(file_name: &str, default_value: T) -> Result<T, String>
where
    T: DeserializeOwned,
{
    let path = tweetpilot_dir()?.join(file_name);

    match fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content)
            .map_err(|e| format!("解析文件失败 {}: {}", path.display(), e)),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(default_value),
        Err(err) => Err(format!("读取文件失败 {}: {}", path.display(), err)),
    }
}

pub fn write_json<T>(file_name: &str, value: &T) -> Result<(), String>
where
    T: Serialize,
{
    let path = tweetpilot_dir()?.join(file_name);
    let temp_path = path.with_extension("tmp");

    let content = serde_json::to_string_pretty(value)
        .map_err(|e| format!("序列化数据失败: {}", e))?;

    fs::write(&temp_path, content)
        .map_err(|e| format!("写入临时文件失败 {}: {}", temp_path.display(), e))?;

    fs::rename(&temp_path, &path)
        .map_err(|e| format!("替换目标文件失败 {}: {}", path.display(), e))?;

    Ok(())
}
