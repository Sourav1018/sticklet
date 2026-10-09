use rusqlite::{params, Connection};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

use crate::WindowBounds;

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DbNote {
    pub id: String,
    pub title: String,
    pub content: String,
    pub color: String,
    pub is_pinned: bool,
    pub is_open: bool,
    pub x: Option<f64>,
    pub y: Option<f64>,
    pub width: Option<f64>,
    pub height: Option<f64>,
    pub created_at: i64,
    pub updated_at: i64,
}

pub struct DbState {
    pub conn: Mutex<Connection>,
}

fn get_db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app_data_dir: {}", e))?;

    if !app_dir.exists() {
        fs::create_dir_all(&app_dir)
            .map_err(|e| format!("Failed to create app data directory: {}", e))?;
    }

    Ok(app_dir.join("notes.sqlite3"))
}

pub fn init_db(app: &AppHandle) -> Result<DbState, String> {
    let path = get_db_path(app)?;
    let conn = Connection::open(&path).map_err(|e| format!("Failed to open sqlite db at {:?}: {}", path, e))?;

    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            color TEXT NOT NULL,
            is_pinned INTEGER NOT NULL DEFAULT 0,
            is_open INTEGER NOT NULL DEFAULT 1,
            x REAL,
            y REAL,
            width REAL,
            height REAL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at DESC);
        ",
    )
    .map_err(|e| format!("Failed to execute db schema migrations: {}", e))?;

    Ok(DbState {
        conn: Mutex::new(conn),
    })
}

#[tauri::command]
pub fn db_get_all_notes(state: tauri::State<DbState>) -> Result<Vec<DbNote>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, title, content, color, is_pinned, is_open, x, y, width, height, created_at, updated_at
             FROM notes
             ORDER BY updated_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let note_iter = stmt
        .query_map([], |row| {
            let is_pinned_int: i32 = row.get(4)?;
            let is_open_int: i32 = row.get(5)?;
            Ok(DbNote {
                id: row.get(0)?,
                title: row.get(1)?,
                content: row.get(2)?,
                color: row.get(3)?,
                is_pinned: is_pinned_int != 0,
                is_open: is_open_int != 0,
                x: row.get(6)?,
                y: row.get(7)?,
                width: row.get(8)?,
                height: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut notes = Vec::new();
    for note in note_iter {
        notes.push(note.map_err(|e| e.to_string())?);
    }
    Ok(notes)
}

#[tauri::command]
pub fn db_upsert_note(state: tauri::State<DbState>, note: DbNote) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO notes (id, title, content, color, is_pinned, is_open, x, y, width, height, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
         ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            content = excluded.content,
            color = excluded.color,
            is_pinned = excluded.is_pinned,
            is_open = excluded.is_open,
            x = excluded.x,
            y = excluded.y,
            width = excluded.width,
            height = excluded.height,
            updated_at = excluded.updated_at",
        params![
            note.id,
            note.title,
            note.content,
            note.color,
            if note.is_pinned { 1 } else { 0 },
            if note.is_open { 1 } else { 0 },
            note.x,
            note.y,
            note.width,
            note.height,
            note.created_at,
            note.updated_at,
        ],
    )
    .map_err(|e| format!("Failed to upsert note {}: {}", note.id, e))?;

    Ok(())
}

#[tauri::command]
pub fn db_update_note_bounds(
    state: tauri::State<DbState>,
    note_id: String,
    bounds: WindowBounds,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE notes SET x = ?1, y = ?2, width = ?3, height = ?4 WHERE id = ?5",
        params![bounds.x, bounds.y, bounds.width, bounds.height, note_id],
    )
    .map_err(|e| format!("Failed to update bounds for {}: {}", note_id, e))?;

    Ok(())
}

#[tauri::command]
pub fn db_delete_note(state: tauri::State<DbState>, note_id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM notes WHERE id = ?1", params![note_id])
        .map_err(|e| format!("Failed to delete note {}: {}", note_id, e))?;
    Ok(())
}
