use sqlx::SqlitePool;
use serde::Serialize;
use sqlx::FromRow;
use tauri::{command, State};
use std::fs;

#[derive(Serialize, FromRow)]
pub struct SearchResult {
    pub id: i64,
    pub path: String,
    pub title: String,
    pub snippet: String,
}

#[command]
pub async fn index_document(
    pool: State<'_, SqlitePool>,
    library_id: i64,
    path: String,
) -> Result<(), String> {
    let content = fs::read_to_string(&path).unwrap_or_default();
    let title = content
        .lines()
        .find(|l| l.starts_with('#'))
        .map(|l| l.trim_start_matches('#').trim().to_string())
        .unwrap_or_else(|| {
            path.split('/')
                .last()
                .unwrap_or("")
                .replace(".md", "")
        });
    let word_count = content.chars().count() as i64;

    sqlx::query(
        "INSERT OR REPLACE INTO documents (library_id, path, title, word_count) VALUES (?, ?, ?, ?)",
    )
    .bind(library_id)
    .bind(&path)
    .bind(&title)
    .bind(word_count)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT OR REPLACE INTO documents_fts (rowid, title, content) \
         SELECT id, title, ? FROM documents WHERE path = ?",
    )
    .bind(&content)
    .bind(&path)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[command]
pub async fn search_documents(
    pool: State<'_, SqlitePool>,
    query: String,
) -> Result<Vec<SearchResult>, String> {
    let results = sqlx::query_as::<_, SearchResult>(
        "SELECT d.id, d.path, d.title, snippet(documents_fts, 1, '<mark>', '</mark>', '...', 20) AS snippet \
         FROM documents_fts f JOIN documents d ON f.rowid = d.id \
         WHERE documents_fts MATCH ? ORDER BY rank LIMIT 50",
    )
    .bind(&query)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;
    Ok(results)
}
