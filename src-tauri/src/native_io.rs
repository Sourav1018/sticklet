use arboard::Clipboard;
use rfd::FileDialog;
use std::fs;
use std::path::Path;

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FileSaveResult {
    pub success: bool,
    pub path: Option<String>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FileOpenResult {
    pub success: bool,
    pub path: Option<String>,
    pub content: Option<String>,
}

#[tauri::command]
pub fn save_text_file(
    default_name: Option<String>,
    title: Option<String>,
    content: String,
    filter_ext: Option<String>,
) -> Result<FileSaveResult, String> {
    let mut dialog = FileDialog::new();
    if let Some(t) = title {
        dialog = dialog.set_title(t);
    }
    if let Some(name) = default_name {
        dialog = dialog.set_file_name(name);
    }

    let ext = filter_ext.unwrap_or_else(|| "md".to_string());
    dialog = dialog.add_filter("Text & Markdown", &[&ext, "txt", "html"]);

    if let Some(file_path) = dialog.save_file() {
        fs::write(&file_path, content).map_err(|e| format!("Failed to write file: {}", e))?;
        return Ok(FileSaveResult {
            success: true,
            path: Some(file_path.to_string_lossy().to_string()),
        });
    }

    Ok(FileSaveResult {
        success: false,
        path: None,
    })
}

#[tauri::command]
pub fn open_text_file() -> Result<FileOpenResult, String> {
    let dialog = FileDialog::new()
        .set_title("Open Note File")
        .add_filter("Note files (*.md, *.txt, *.html)", &["md", "txt", "html", "json"]);

    if let Some(file_path) = dialog.pick_file() {
        let content = fs::read_to_string(&file_path)
            .map_err(|e| format!("Failed to read file: {}", e))?;
        return Ok(FileOpenResult {
            success: true,
            path: Some(file_path.to_string_lossy().to_string()),
            content: Some(content),
        });
    }

    Ok(FileOpenResult {
        success: false,
        path: None,
        content: None,
    })
}

#[tauri::command]
pub fn pick_folder() -> Result<Option<String>, String> {
    let dialog = FileDialog::new().set_title("Select Notes Folder");
    if let Some(folder_path) = dialog.pick_folder() {
        return Ok(Some(folder_path.to_string_lossy().to_string()));
    }
    Ok(None)
}

#[tauri::command]
pub fn export_all_notes_to_folder(
    folder_path: String,
    notes: Vec<crate::db::DbNote>,
) -> Result<usize, String> {
    let path = Path::new(&folder_path);
    if !path.exists() {
        fs::create_dir_all(path).map_err(|e| format!("Failed to create folder: {}", e))?;
    }

    let mut count = 0;
    for note in notes {
        // Sanitize title for filename
        let safe_title: String = note
            .title
            .chars()
            .map(|c| if c.is_alphanumeric() || c == ' ' || c == '-' || c == '_' { c } else { '_' })
            .collect();
        let safe_title = safe_title.trim();
        let file_name = if safe_title.is_empty() {
            format!("{}.md", note.id)
        } else {
            format!("{}_{}.md", safe_title, &note.id[..note.id.len().min(8)])
        };

        let file_path = path.join(file_name);
        let markdown_header = format!(
            "---\ntitle: {}\ncolor: {}\ncreated: {}\n---\n\n",
            note.title, note.color, note.created_at
        );
        let full_text = format!("{}{}", markdown_header, note.content);
        if fs::write(file_path, full_text).is_ok() {
            count += 1;
        }
    }

    Ok(count)
}

#[tauri::command]
pub fn clipboard_write_text(text: String) -> Result<(), String> {
    let mut clipboard = Clipboard::new().map_err(|e| format!("Clipboard error: {}", e))?;
    clipboard.set_text(text).map_err(|e| format!("Clipboard write error: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn clipboard_read_text() -> Result<String, String> {
    let mut clipboard = Clipboard::new().map_err(|e| format!("Clipboard error: {}", e))?;
    clipboard.get_text().map_err(|e| format!("Clipboard read error: {}", e))
}
