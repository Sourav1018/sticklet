import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import type { WindowBounds } from '@/stores/notes'

export function useTauriWindow() {
  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

  async function openNoteWindow(noteId: string, bounds?: Partial<WindowBounds>, bgColor?: string) {
    if (isTauri) {
      try {
        await invoke('open_note_window', {
          noteId,
          x: bounds?.x ?? null,
          y: bounds?.y ?? null,
          width: bounds?.width ?? null,
          height: bounds?.height ?? null,
          bgColor: bgColor ?? null,
        })
      } catch (err) {
        console.error('Failed to open note window via Tauri:', err)
      }
    } else {
      window.open(`/#/note/${noteId}`, `note-${noteId}`, 'width=340,height=400')
    }
  }

  async function getWindowBounds(): Promise<WindowBounds | null> {
    if (isTauri) {
      try {
        return await invoke<WindowBounds>('get_window_bounds')
      } catch (err) {
        console.error('Failed to get window bounds via Tauri:', err)
      }
    }
    return null
  }

  function startDragging(e: MouseEvent) {
    if (isTauri && e.button === 0) {
      // Don't drag if user clicked on a button or interactive child element
      const target = e.target as HTMLElement | null
      if (target?.closest('button, input, select, textarea, [role="button"], [role="menu"]')) {
        return
      }

      // 1. Primary: trigger native OS drag synchronously using Tauri v2 window API
      try {
        const currentWin = getCurrentWindow()
        if (currentWin && typeof currentWin.startDragging === 'function') {
          currentWin.startDragging()
          return
        }
      } catch (_) {}

      // 2. Fallback: invoke Rust start_drag command
      invoke('start_drag').catch((err) => {
        console.error('Failed to start dragging via Tauri:', err)
      })
    }
  }

  async function toggleAlwaysOnTop(noteId: string, isPinned: boolean) {
    if (isTauri) {
      try {
        await invoke('toggle_always_on_top', { noteId, isPinned })
      } catch (err) {
        console.error('Failed to toggle always on top via Tauri:', err)
      }
    }
  }

  async function closeNoteWindow(noteId: string) {
    if (isTauri) {
      try {
        await invoke('close_note_window', { noteId })
      } catch (err) {
        console.error('Failed to close note window via Tauri:', err)
      }
    } else {
      window.close()
    }
  }

  return {
    isTauri,
    openNoteWindow,
    getWindowBounds,
    startDragging,
    toggleAlwaysOnTop,
    closeNoteWindow,
  }
}
