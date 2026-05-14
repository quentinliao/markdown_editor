use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePool};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

pub type DbPool = SqlitePool;

pub async fn init_db(app: &AppHandle) -> Result<DbPool, Box<dyn std::error::Error>> {
    let app_dir = app.path().app_data_dir()?;
    fs::create_dir_all(&app_dir).ok();
    let db_path: PathBuf = app_dir.join("markdown_preview.db");

    let options = SqliteConnectOptions::new()
        .filename(&db_path)
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal);

    let pool = SqlitePool::connect_with(options).await?;
    sqlx::query(include_str!("schema.sql"))
        .execute(&pool)
        .await?;
    Ok(pool)
}
