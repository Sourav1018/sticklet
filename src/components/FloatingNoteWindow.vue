<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useNotesStore, NOTE_COLORS } from '@/stores/notes'
import { useTauriWindow } from '@/composables/useTauriWindow'
import { useFloatingWindow } from '@/composables/useFloatingWindow'
import StickyNote from '@/components/StickyNote.vue'

const props = defineProps<{
  noteId: string
}>()

const notesStore = useNotesStore()
const tauriWindow = useTauriWindow()
const floatingWindow = useFloatingWindow()

const isReady = ref(false)
const localNoteId = computed(() => props.noteId || floatingWindow.noteId.value || '')

const note = computed(() => {
  if (!localNoteId.value) return undefined
  return notesStore.getNote(localNoteId.value)
})

async function saveCurrentBounds() {
  if (!localNoteId.value) return
  const bounds = await floatingWindow.getBounds()
  if (bounds) {
    await notesStore.updateNoteBounds(localNoteId.value, {
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      width: Math.round(bounds.width),
      height: Math.round(bounds.height),
    })
  }
}

async function handleClose() {
  if (localNoteId.value) {
    await notesStore.flushPendingSave(localNoteId.value)
    await saveCurrentBounds()
    await floatingWindow.closeWindow(localNoteId.value)
  }
}

async function handleNewNote() {
  const newNote = notesStore.createNote()
  await notesStore.persistNoteToDb(newNote)
  const current = note.value
  const bounds = current?.x !== undefined && current?.y !== undefined
    ? {
        x: (current.x || 100) + 30,
        y: (current.y || 100) + 30,
        width: current.width || 340,
        height: current.height || 400,
      }
    : undefined
  await tauriWindow.openNoteWindow(newNote.id, bounds, NOTE_COLORS[newNote.color]?.bg || '#fff7d1')
}

onMounted(async () => {
  if (localNoteId.value) {
    await notesStore.fetchNote(localNoteId.value)
  }
  isReady.value = true

  if (typeof window !== 'undefined') {
    let timer: any = null
    const debouncedSaveBounds = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        saveCurrentBounds()
      }, 250)
    }

    const flushBeforeExit = () => {
      if (localNoteId.value) {
        notesStore.flushPendingSave(localNoteId.value)
      }
    }

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
</script>

<template>
  <div
    class="floating-note-container h-screen w-screen overflow-hidden select-none flex flex-col"
    :style="{ backgroundColor: note ? (NOTE_COLORS[note.color]?.bg || '#fff7d1') : '#fff7d1' }"
  >
    <!-- Render active sticky note -->
    <StickyNote
      v-if="note"
      :note="note"
      standalone
      @close="handleClose"
      @new-note="handleNewNote"
    />

    <!-- Fallback 1: Loading state -->
    <div
      v-else-if="!isReady"
      class="h-full w-full flex flex-col bg-amber-50 text-amber-900 font-sans"
    >
      <header
        class="flex items-center justify-between px-3 py-2 bg-amber-100 border-b border-amber-200 cursor-move select-none"
        data-tauri-drag-region="deep"
      >
        <span class="text-xs font-semibold opacity-75">Sticklet</span>
        <button
          type="button"
          data-tauri-drag-region="false"
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

    <!-- Fallback 2: Not found state -->
    <div
      v-else
      class="h-full w-full flex flex-col bg-amber-50 text-amber-900 font-sans"
    >
      <header
        class="flex items-center justify-between px-3 py-2 bg-amber-100 border-b border-amber-200 cursor-move select-none"
        data-tauri-drag-region="deep"
      >
        <span class="text-xs font-semibold opacity-75">Sticklet</span>
        <button
          type="button"
          data-tauri-drag-region="false"
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
          type="button"
          data-tauri-drag-region="false"
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
