import { invoke } from '@tauri-apps/api/core'
import type { Note, WindowBounds } from '@/stores/notes'

export interface FileSaveResult {
  success: boolean
  path: string | null
}

export interface FileOpenResult {
  success: boolean
  path: string | null
  content: string | null
}

export function useNativeIO() {
  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

  // Save current note or text as local file (shows native file dialog)
  async function saveNoteToFile(
    content: string,
    defaultName = 'note.md',
    title = 'Save Note As'
  ): Promise<FileSaveResult> {
    if (isTauri) {
      try {
        return await invoke<FileSaveResult>('save_text_file', {
          defaultName,
          title,
          content,
          filterExt: 'md',
        })
      } catch (err) {
        console.error('Failed to save file via Tauri dialog:', err)
        return { success: false, path: null }
      }
    } else {
      // Browser fallback: triggers download
      const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = defaultName
      a.click()
      URL.revokeObjectURL(url)
      return { success: true, path: defaultName }
    }
  }

  // Open a file using native file picker dialog
  async function openNoteFile(): Promise<FileOpenResult> {
    if (isTauri) {
      try {
        return await invoke<FileOpenResult>('open_text_file')
      } catch (err) {
        console.error('Failed to open file via Tauri dialog:', err)
        return { success: false, path: null, content: null }
      }
    }
    return { success: false, path: null, content: null }
  }

  // Pick a local folder for bulk backup / export
  async function pickFolder(): Promise<string | null> {
    if (isTauri) {
      try {
        return await invoke<string | null>('pick_folder')
      } catch (err) {
        console.error('Failed to pick folder via Tauri dialog:', err)
      }
    }
    return null
  }

  // Export all notes into markdown files in selected folder
  async function exportNotesToFolder(folderPath: string, notes: Note[]): Promise<number> {
    if (isTauri) {
      try {
        return await invoke<number>('export_all_notes_to_folder', {
          folderPath,
          notes,
        })
      } catch (err) {
        console.error('Failed to export notes to folder:', err)
      }
    }
    return 0
  }

  // Copy text to OS system clipboard
  async function copyToClipboard(text: string): Promise<boolean> {
    if (isTauri) {
      try {
        await invoke('clipboard_write_text', { text })
        return true
      } catch (err) {
        console.error('Failed to write clipboard via Tauri:', err)
      }
    }
    // Web fallback
    if (navigator?.clipboard) {
      try {
        await navigator.clipboard.writeText(text)
        return true
      } catch (err) {
        console.error('Failed to copy to clipboard via Web API:', err)
      }
    }
    return false
  }

  // Read text from OS system clipboard
  async function readFromClipboard(): Promise<string | null> {
    if (isTauri) {
      try {
        return await invoke<string>('clipboard_read_text')
      } catch (err) {
        console.error('Failed to read clipboard via Tauri:', err)
      }
    }
    if (navigator?.clipboard) {
      try {
        return await navigator.clipboard.readText()
      } catch (err) {
        console.error('Failed to read clipboard via Web API:', err)
      }
    }
    return null
  }

  return {
    isTauri,
    saveNoteToFile,
    openNoteFile,
    pickFolder,
    exportNotesToFolder,
    copyToClipboard,
    readFromClipboard,
  }
}
