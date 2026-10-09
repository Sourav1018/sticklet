<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useNotesStore, NOTE_COLORS } from '@/stores/notes'
import { useTauriWindow } from '@/composables/useTauriWindow'
import StickyNote from '@/components/StickyNote.vue'

import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'

const route = useRoute()
const notesStore = useNotesStore()
const tauriWindow = useTauriWindow()
const isReady = ref(false)

const noteId = computed(() => {
  const id = route.params.id
  if (Array.isArray(id) && id[0]) return id[0]
  if (typeof id === 'string' && id) return id

  // Fallback 1: Tauri window label from getCurrentWebviewWindow
  if (typeof window !== 'undefined') {
    try {
      const current = getCurrentWebviewWindow()
      if (current?.label?.startsWith('note-')) {
        return current.label.slice(5)
      }
    } catch (_) {}

    // Fallback 2: Tauri internals window label
    if ('__TAURI_INTERNALS__' in window) {
      try {
        const meta = (window as any).__TAURI_INTERNALS__?.metadata?.currentWebview
        if (meta?.label?.startsWith('note-')) {
          return meta.label.slice(5)
        }
      } catch (_) {}
    }
  }

  return ''
})

const note = computed(() => {
  return notesStore.getNote(noteId.value)
})

async function saveCurrentBounds() {
  const bounds = await tauriWindow.getWindowBounds()
  if (bounds && noteId.value) {
    await notesStore.updateNoteBounds(noteId.value, {
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      width: Math.round(bounds.width),
      height: Math.round(bounds.height),
    })
  }
}

onMounted(async () => {
  if (noteId.value) {
    await notesStore.fetchNote(noteId.value)
  }
  isReady.value = true

  if (typeof window !== 'undefined') {
    let timer: any = null
    const debouncedSaveBounds = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        saveCurrentBounds()
      }, 200)
    }

    const flushBeforeExit = () => {
      notesStore.flushPendingSave(noteId.value)
    }

    // Capture position/size whenever user finishes dragging or resizing
    window.addEventListener('mouseup', debouncedSaveBounds)
    window.addEventListener('resize', debouncedSaveBounds)
    window.addEventListener('beforeunload', flushBeforeExit)

    onBeforeUnmount(() => {
      window.removeEventListener('beforeunload', flushBeforeExit)
      window.removeEventListener('mouseup', debouncedSaveBounds)
      window.removeEventListener('resize', debouncedSaveBounds)
    })
  }
})

async function handleClose() {
  await notesStore.flushPendingSave(noteId.value)
  await saveCurrentBounds()
  await tauriWindow.closeNoteWindow(noteId.value)
}

async function handleNewNote() {
  const newNote = notesStore.createNote()
  await notesStore.persistNoteToDb(newNote)
  const current = note.value
  const bounds = current && current.x !== undefined && current.y !== undefined
    ? {
        x: current.x + 35,
        y: current.y + 35,
        width: current.width || 340,
        height: current.height || 400,
      }
    : undefined
  await tauriWindow.openNoteWindow(newNote.id, bounds)
}
</script>

<template>
  <div
    class="h-screen w-screen overflow-hidden select-none"
    :style="{ backgroundColor: note ? NOTE_COLORS[note.color]?.bg : '#fff7d1' }"
  >
    <StickyNote
      v-if="note"
      :note="note"
      standalone
      @close="handleClose"
      @new-note="handleNewNote"
    />
    <div
      v-else-if="!isReady"
      class="h-full w-full flex flex-col bg-amber-50 text-amber-900 font-sans"
    >
      <header
        class="flex items-center justify-between px-3 py-2 bg-amber-100 border-b border-amber-200 cursor-move select-none"
        data-tauri-drag-region
        @mousedown="tauriWindow.startDragging"
      >
        <span class="text-xs font-semibold opacity-75">Sticklet</span>
        <button
          class="text-xs p-1 hover:bg-black/10 rounded transition-colors"
          title="Close"
          @click="handleClose"
        >
          ✕
        </button>
      </header>
      <div class="flex-1 flex items-center justify-center text-xs opacity-75 p-4 text-center">
        Loading note...
      </div>
    </div>
    <div
      v-else
      class="h-full w-full flex flex-col bg-amber-50 text-amber-900 font-sans"
    >
      <header
        class="flex items-center justify-between px-3 py-2 bg-amber-100 border-b border-amber-200 cursor-move select-none"
        data-tauri-drag-region
        @mousedown="tauriWindow.startDragging"
      >
        <span class="text-xs font-semibold opacity-75">Sticklet</span>
        <button
          class="text-xs p-1 hover:bg-black/10 rounded transition-colors"
          title="Close"
          @click="handleClose"
        >
          ✕
        </button>
      </header>
      <div class="flex-1 flex flex-col items-center justify-center text-xs p-4 text-center space-y-3">
        <p>Note not found or deleted.</p>
        <button
          class="px-3 py-1 bg-amber-200 hover:bg-amber-300 rounded text-amber-950 font-medium"
          @click="handleClose"
        >
          Close
        </button>
      </div>
    </div>
  </div>
</template>

<style>
/* Remove window margins for frameless floating window */
html,
body {
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
  background: transparent !important;
}
</style>
