<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useNotesStore, NOTE_COLORS } from '@/stores/notes'
import { useTauriWindow } from '@/composables/useTauriWindow'
import StickyNote from '@/components/StickyNote.vue'

const route = useRoute()
const notesStore = useNotesStore()
const tauriWindow = useTauriWindow()
const isReady = ref(false)

const noteId = computed(() => {
  const id = route.params.id
  if (Array.isArray(id) && id[0]) return id[0]
  if (typeof id === 'string' && id) return id

  // Fallback 1: global set by Rust initialization script
  if (typeof window !== 'undefined' && (window as any).__STICKLET_NOTE_ID__) {
    return (window as any).__STICKLET_NOTE_ID__
  }

  // Fallback 2: Tauri window label
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    try {
      const meta = (window as any).__TAURI_INTERNALS__?.metadata?.currentWebview
      if (meta?.label?.startsWith('note-')) {
        return meta.label.slice(5)
      }
    } catch (_) {}
  }

  return ''
})

const note = computed(() => {
  return notesStore.getNote(noteId.value)
})

async function saveCurrentBounds() {
  const bounds = await tauriWindow.getWindowBounds()
  if (bounds && noteId.value) {
    notesStore.updateNote(noteId.value, {
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

    // Capture position/size whenever user finishes dragging or resizing
    window.addEventListener('mouseup', debouncedSaveBounds)
    window.addEventListener('resize', debouncedSaveBounds)

    onBeforeUnmount(() => {
      window.removeEventListener('mouseup', debouncedSaveBounds)
      window.removeEventListener('resize', debouncedSaveBounds)
    })
  }
})

async function handleClose() {
  await saveCurrentBounds()
  tauriWindow.closeNoteWindow(noteId.value)
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
      class="h-full w-full flex items-center justify-center bg-amber-50 text-amber-900 text-xs p-4 text-center font-sans"
    >
      Loading note...
    </div>
    <div
      v-else
      class="h-full w-full flex flex-col items-center justify-center bg-amber-50 text-amber-900 text-xs p-4 text-center font-sans space-y-2"
    >
      <p>Note not found or deleted.</p>
      <button
        class="px-3 py-1 bg-amber-200 hover:bg-amber-300 rounded text-amber-950 font-medium"
        @click="handleClose"
      >
        Close
      </button>
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
