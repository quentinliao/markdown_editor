use sqlx::SqlitePool;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use tauri::{command, State};
use std::fs;

#[derive(Serialize, Deserialize, Debug, Clone, FromRow)]
pub struct Library {
    pub id: i64,
    pub name: String,
    pub path: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Vec<FileNode>,
}

#[command]
pub async fn add_library(
    pool: State<'_, SqlitePool>,
    name: String,
    path: String,
) -> Result<Library, String> {
    sqlx::query_as::<_, Library>(
        "INSERT INTO libraries (name, path) VALUES (?, ?) RETURNING id, name, path",
    )
    .bind(&name)
    .bind(&path)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())
}

#[command]
pub async fn get_libraries(pool: State<'_, SqlitePool>) -> Result<Vec<Library>, String> {
    sqlx::query_as::<_, Library>("SELECT id, name, path FROM libraries ORDER BY name")
        .fetch_all(pool.inner())
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn remove_library(pool: State<'_, SqlitePool>, id: i64) -> Result<(), String> {
    sqlx::query("DELETE FROM libraries WHERE id = ?")
        .bind(id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
pub fn read_directory(path: String) -> Result<Vec<FileNode>, String> {
    read_dir_recursive(&path, 0).map_err(|e| e.to_string())
}

fn read_dir_recursive(path: &str, depth: u8) -> std::io::Result<Vec<FileNode>> {
    if depth > 5 {
        return Ok(vec![]);
    }
    let mut nodes = vec![];
    for entry in fs::read_dir(path)? {
        let entry = entry?;
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        let entry_path = entry.path().to_string_lossy().to_string();
        let is_dir = entry.file_type()?.is_dir();
        let children = if is_dir {
            read_dir_recursive(&entry_path, depth + 1).unwrap_or_default()
        } else if !name.ends_with(".md") {
            continue;
        } else {
            vec![]
        };
        nodes.push(FileNode {
            name,
            path: entry_path,
            is_dir,
            children,
        });
    }
    nodes.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.cmp(&b.name),
    });
    Ok(nodes)
}
