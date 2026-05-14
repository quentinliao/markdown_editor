// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod db;

use commands::file_ops::*;
use commands::library::*;
use commands::search::*;
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let pool = tauri::async_runtime::block_on(db::init_db(app.handle()))?;
            app.manage(pool);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_file,
            write_file,
            file_exists,
            save_image,
            add_library,
            get_libraries,
            remove_library,
            read_directory,
            index_document,
            search_documents,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
