import { ref, computed } from 'vue'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { invoke } from '@tauri-apps/api/core'
import type { WindowBounds } from '@/stores/notes'

/**
 * Synchronously detects if current window is a floating sticky note and returns the note ID.
 */
export function detectFloatingNoteId(): string | null {
  if (typeof window === 'undefined') return null

  // 1. URL query params (?note=<id>) - Available synchronously at instant page evaluation on all OSs
  try {
    const params = new URLSearchParams(window.location.search)
    const noteParam = params.get('note')
    if (noteParam) return noteParam
  } catch (_) {}

  // 2. URL hash (#/note/<id>)
  if (window.location.hash.startsWith('#/note/')) {
    const id = window.location.hash.replace('#/note/', '').split('?')[0]
    if (id) return id
  }

  // 3. Injected directly by Rust WebviewWindowBuilder initialization_script
  if ((window as any).__STICKLET_NOTE_ID__) {
    return (window as any).__STICKLET_NOTE_ID__
  }

  // 4. Tauri internals webview/window label
  if ('__TAURI_INTERNALS__' in window) {
    try {
      const internals = (window as any).__TAURI_INTERNALS__
      const label = internals?.metadata?.currentWebview?.label || internals?.metadata?.currentWindow?.label
      if (typeof label === 'string' && label.startsWith('note-')) {
        return label.slice(5)
      }
    } catch (_) {}
  }

  // 5. WebviewWindow instance label
  try {
    const current = getCurrentWebviewWindow()
    if (current?.label && current.label.startsWith('note-')) {
      return current.label.slice(5)
    }
  } catch (_) {}

  return null
}

export function useFloatingWindow() {
  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
  const isWindows = typeof window !== 'undefined' && navigator.userAgent.includes('Windows')
  const isLinux = typeof window !== 'undefined' && navigator.userAgent.includes('Linux')

  const noteId = ref<string | null>(detectFloatingNoteId())

  async function getBounds(): Promise<WindowBounds | null> {
    if (!isTauri) return null
    try {
      return await invoke<WindowBounds>('get_window_bounds')
    } catch (err) {
      console.warn('Failed to get window bounds:', err)
      return null
    }
  }

  async function setAlwaysOnTop(id: string, pinned: boolean) {
    if (!isTauri) return
    try {
      await invoke('toggle_always_on_top', { noteId: id, isPinned: pinned })
    } catch (err) {
      console.warn('Failed to set always on top:', err)
    }
  }

  async function closeWindow(id: string): Promise<WindowBounds | null> {
    if (isTauri) {
      try {
        const bounds = await invoke<WindowBounds | null>('close_note_window', { noteId: id })
        return bounds
      } catch (err) {
        console.warn('Failed to close note window via Tauri:', err)
      }
    }
    if (typeof window !== 'undefined') {
      window.close()
    }
    return null
  }

  return {
    isTauri,
    isWindows,
    isLinux,
    noteId,
    getBounds,
    setAlwaysOnTop,
    closeWindow,
  }
}
