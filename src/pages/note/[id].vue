<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { useNotesStore, NOTE_COLORS } from '@/stores/notes'
import { useTauriWindow } from '@/composables/useTauriWindow'
import StickyNote from '@/components/StickyNote.vue'

const route = useRoute()
const notesStore = useNotesStore()
const tauriWindow = useTauriWindow()

const noteId = computed(() => {
  const id = route.params.id
  return Array.isArray(id) ? id[0] : id
})

async function saveCurrentBounds() {
  const bounds = await tauriWindow.getWindowBounds()
  if (bounds) {
    notesStore.updateNote(noteId.value, {
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      width: Math.round(bounds.width),
      height: Math.round(bounds.height),
    })
  }
}

onMounted(() => {
  notesStore.loadNotes()

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

const note = computed(() => {
  return notesStore.getNote(noteId.value)
})

async function handleClose() {
  await saveCurrentBounds()
  tauriWindow.closeNoteWindow(noteId.value)
}

function handleNewNote() {
  const newNote = notesStore.createNote()
  const current = note.value
  const bounds = current && current.x !== undefined && current.y !== undefined
    ? {
        x: current.x + 35,
        y: current.y + 35,
        width: current.width || 340,
        height: current.height || 400,
      }
    : undefined
  tauriWindow.openNoteWindow(newNote.id, bounds)
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
      v-else
      class="h-full w-full flex items-center justify-center bg-amber-50 text-amber-900 text-xs p-4 text-center font-sans"
    >
      Loading note...
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
