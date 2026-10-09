import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { invoke } from '@tauri-apps/api/core'

export type NoteColor = 'yellow' | 'green' | 'pink' | 'purple' | 'blue' | 'charcoal'

export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface Note {
  id: string
  title: string
  content: string // HTML formatted content
  color: NoteColor
  isPinned: boolean
  isOpen: boolean
  x?: number
  y?: number
  width?: number
  height?: number
  createdAt: number
  updatedAt: number
}

export const NOTE_COLORS: Record<NoteColor, {
  name: string
  bg: string
  header: string
  border: string
  text: string
  toolbar: string
  dotColor: string
}> = {
  yellow: {
    name: 'Yellow',
    bg: '#fff7d1',
    header: '#faea8d',
    border: '#ecd76b',
    text: '#2d2d2d',
    toolbar: '#faea8d',
    dotColor: '#e0cc52',
  },
  green: {
    name: 'Green',
    bg: '#e4f9e0',
    header: '#c4eec0',
    border: '#a4db9f',
    text: '#223620',
    toolbar: '#c4eec0',
    dotColor: '#7bc774',
  },
  pink: {
    name: 'Pink',
    bg: '#ffe4ec',
    header: '#f7bfd2',
    border: '#e79bb6',
    text: '#3b222a',
    toolbar: '#f7bfd2',
    dotColor: '#d6678c',
  },
  purple: {
    name: 'Purple',
    bg: '#f2e7fe',
    header: '#dbc5fb',
    border: '#c3a2f3',
    text: '#2a1e38',
    toolbar: '#dbc5fb',
    dotColor: '#9d67e6',
  },
  blue: {
    name: 'Blue',
    bg: '#e2f2ff',
    header: '#b9ddff',
    border: '#90c5f7',
    text: '#1a2e40',
    toolbar: '#b9ddff',
    dotColor: '#589de6',
  },
  charcoal: {
    name: 'Charcoal',
    bg: '#2b2b2b',
    header: '#212121',
    border: '#3a3a3a',
    text: '#f3f3f3',
    toolbar: '#212121',
    dotColor: '#555555',
  },
}

const STORAGE_KEY = 'st_notes_data_v1'

function generateId(): string {
  return 'note_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7)
}

function extractTitleFromContent(htmlContent: string): string {
  // Strip HTML tags to find the first line of text
  const tmp = htmlContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  if (!tmp) return 'Empty note'
  return tmp.length > 40 ? tmp.substring(0, 40) + '...' : tmp
}

export const useNotesStore = defineStore('notes', () => {
  const notes = ref<Note[]>([])
  const activeNoteId = ref<string | null>(null)
  const searchQuery = ref<string>('')
  const isLoaded = ref(false)

  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

  // Helper to persist single note to SQLite in background
  async function persistNoteToDb(note: Note) {
    if (isTauri) {
      try {
        await invoke('db_upsert_note', {
          note: {
            id: note.id,
            title: note.title,
            content: note.content,
            color: note.color,
            isPinned: note.isPinned,
            isOpen: note.isOpen,
            x: note.x ?? null,
            y: note.y ?? null,
            width: note.width ?? null,
            height: note.height ?? null,
            createdAt: note.createdAt,
            updatedAt: note.updatedAt,
          },
        })
      } catch (err) {
        console.error('Failed to upsert note in SQLite:', err)
      }
    }
  }

  // Load notes from SQLite if running in Tauri, falling back to localStorage
  async function loadNotes() {
    if (typeof window === 'undefined') return
    try {
      if (isTauri) {
        try {
          const dbNotes = await invoke<Note[]>('db_get_all_notes')
          if (dbNotes && dbNotes.length > 0) {
            notes.value = dbNotes
            isLoaded.value = true
            return
          }
        } catch (sqliteErr) {
          console.warn('SQLite query failed, falling back to localStorage:', sqliteErr)
        }
      }

      // Check localStorage if SQLite is empty or outside Tauri
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        notes.value = JSON.parse(stored)
        // If in Tauri, migrate existing localStorage notes to SQLite!
        if (isTauri && notes.value.length > 0) {
          for (const n of notes.value) {
            await persistNoteToDb(n)
          }
        }
      } else {
        // Create an initial sample note
        const initialNote: Note = {
          id: generateId(),
          title: 'Welcome to Sticklet!',
          content: `
            <h2>Welcome to Sticklet! 📝</h2>
            <p>A fast, clean desktop sticky notes app built for your workflow.</p>
            <ul data-type="taskList">
              <li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked="checked"><span></span></label><div><p>Instant auto-save & offline access</p></div></li>
              <li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked="checked"><span></span></label><div><p>Native Dialogs, Local File Save & Markdown Export</p></div></li>
              <li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked="checked"><span></span></label><div><p>System Clipboard copy & paste</p></div></li>
            </ul>
          `,
          color: 'yellow',
          isPinned: false,
          isOpen: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        notes.value = [initialNote]
        saveNotes()
        await persistNoteToDb(initialNote)
      }
    } catch (err) {
      console.error('Failed to load notes', err)
      notes.value = []
    } finally {
      isLoaded.value = true
    }
  }

  // Save notes to localStorage as backup
  function saveNotes() {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes.value))
    } catch (err) {
      console.error('Failed to save notes to localStorage', err)
    }
  }

  // Create a new note
  function createNote(color: NoteColor = 'yellow', initialContent = ''): Note {
    const newNote: Note = {
      id: generateId(),
      title: initialContent ? extractTitleFromContent(initialContent) : 'New note',
      content: initialContent,
      color,
      isPinned: false,
      isOpen: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    notes.value.unshift(newNote)
    activeNoteId.value = newNote.id
    saveNotes()
    persistNoteToDb(newNote)
    return newNote
  }

  // Update note content or properties
  function updateNote(id: string, updates: Partial<Omit<Note, 'id' | 'createdAt'>>) {
    const note = notes.value.find((n) => n.id === id)
    if (!note) return

    if (updates.content !== undefined) {
      note.content = updates.content
      note.title = extractTitleFromContent(updates.content)
    }
    if (updates.color !== undefined) note.color = updates.color
    if (updates.isPinned !== undefined) note.isPinned = updates.isPinned
    if (updates.isOpen !== undefined) note.isOpen = updates.isOpen
    if (updates.x !== undefined) note.x = updates.x
    if (updates.y !== undefined) note.y = updates.y
    if (updates.width !== undefined) note.width = updates.width
    if (updates.height !== undefined) note.height = updates.height

    note.updatedAt = Date.now()
    saveNotes()
    persistNoteToDb(note)
  }

  // Delete note
  async function deleteNote(id: string) {
    const index = notes.value.findIndex((n) => n.id === id)
    if (index !== -1) {
      notes.value.splice(index, 1)
      if (activeNoteId.value === id) {
        activeNoteId.value = notes.value[0]?.id || null
      }
      saveNotes()
      if (isTauri) {
        try {
          await invoke('db_delete_note', { noteId: id })
        } catch (err) {
          console.error('Failed to delete note from SQLite:', err)
        }
      }
    }
  }

  // Toggle Pin (always on top)
  function togglePin(id: string) {
    const note = notes.value.find((n) => n.id === id)
    if (note) {
      note.isPinned = !note.isPinned
      saveNotes()
      persistNoteToDb(note)
    }
  }

  // Set note color
  function setNoteColor(id: string, color: NoteColor) {
    const note = notes.value.find((n) => n.id === id)
    if (note) {
      note.color = color
      saveNotes()
      persistNoteToDb(note)
    }
  }

  // Update window position and size bounds
  async function updateNoteBounds(id: string, bounds: WindowBounds) {
    const note = notes.value.find((n) => n.id === id)
    if (note) {
      note.x = bounds.x
      note.y = bounds.y
      note.width = bounds.width
      note.height = bounds.height
      saveNotes()
      if (isTauri) {
        try {
          await invoke('db_update_note_bounds', { noteId: id, bounds })
        } catch (err) {
          console.error('Failed to update note bounds in SQLite:', err)
        }
      }
    }
  }

  // Get note by ID
  function getNote(id: string): Note | undefined {
    return notes.value.find((n) => n.id === id)
  }

  // Filtered notes by search query
  const filteredNotes = computed(() => {
    const query = searchQuery.value.trim().toLowerCase()
    if (!query) return notes.value

    return notes.value.filter((n) => {
      const matchTitle = n.title.toLowerCase().includes(query)
      const matchContent = n.content.toLowerCase().includes(query)
      return matchTitle || matchContent
    })
  })

  const activeNote = computed(() => {
    if (!activeNoteId.value) return notes.value[0] || null
    return notes.value.find((n) => n.id === activeNoteId.value) || null
  })

  return {
    notes,
    activeNoteId,
    activeNote,
    searchQuery,
    filteredNotes,
    isLoaded,
    loadNotes,
    saveNotes,
    createNote,
    updateNote,
    updateNoteBounds,
    deleteNote,
    togglePin,
    setNoteColor,
    getNote,
  }
})
