<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed } from 'vue'
import { listen } from '@tauri-apps/api/event'
import { useNotesStore, NOTE_COLORS, type NoteColor } from '@/stores/notes'
import { useTauriWindow } from '@/composables/useTauriWindow'
import { useNativeIO } from '@/composables/useNativeIO'
import StickyNote from '@/components/StickyNote.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Plus,
  Search,
  StickyNote as NoteIcon,
  Trash2,
  Clock,
  ExternalLink,
  FolderDown,
  FileUp,
} from '@lucide/vue'

const notesStore = useNotesStore()
const tauriWindow = useTauriWindow()
const nativeIO = useNativeIO()
const selectedColorFilter = ref<NoteColor | 'all'>('all')
const bannerMessage = ref('')

async function handleImportFile() {
  const res = await nativeIO.openNoteFile()
  if (res.success && res.content) {
    const newNote = notesStore.createNote('yellow', res.content)
    tauriWindow.openNoteWindow(newNote.id)
    showBanner('Note imported successfully!')
  }
}

async function handleExportAllToFolder() {
  const folder = await nativeIO.pickFolder()
  if (folder) {
    const count = await nativeIO.exportNotesToFolder(folder, notesStore.notes)
    showBanner(`Exported ${count} notes to folder!`)
  }
}

function showBanner(msg: string) {
  bannerMessage.value = msg
  setTimeout(() => {
    bannerMessage.value = ''
  }, 3000)
}

onMounted(async () => {
  notesStore.loadNotes()

  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    try {
      const unlisten = await listen('tray-new-note', () => {
        handleCreateNote()
      })
      onBeforeUnmount(() => {
        unlisten()
      })
    } catch (err) {
      console.error('Failed to listen to tray event:', err)
    }
  }
})

const availableColors: NoteColor[] = ['yellow', 'green', 'pink', 'purple', 'blue', 'charcoal']

const displayedNotes = computed(() => {
  let list = notesStore.filteredNotes
  if (selectedColorFilter.value !== 'all') {
    list = list.filter((n) => n.color === selectedColorFilter.value)
  }
  return list
})

function handleCreateNote(color?: NoteColor) {
  const note = notesStore.createNote(color || (selectedColorFilter.value !== 'all' ? selectedColorFilter.value : 'yellow'))
  // Spawns as independent desktop window!
  tauriWindow.openNoteWindow(note.id)
}

function selectNote(id: string) {
  notesStore.activeNoteId = id
  notesStore.updateNote(id, { isOpen: true })
}

function openInDesktopWindow(id: string) {
  notesStore.activeNoteId = id
  const n = notesStore.getNote(id)
  tauriWindow.openNoteWindow(
    id,
    n && n.x !== undefined && n.y !== undefined
      ? { x: n.x, y: n.y, width: n.width, height: n.height }
      : undefined
  )
}

function handleCloseNote(id: string) {
  notesStore.updateNote(id, { isOpen: false })
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}
</script>

<template>
  <div class="h-screen w-screen flex bg-slate-100 dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 overflow-hidden font-sans">
    <!-- LEFT SIDEBAR: Notes Hub (Microsoft Notes List) -->
    <aside class="w-80 border-r border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col h-full shadow-sm z-10 flex-shrink-0">
      <!-- Hub Header with Search & New Note -->
      <div class="p-3.5 border-b border-slate-200 dark:border-zinc-800 space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2.5">
            <img
              src="/app-icon.png"
              alt="Sticklet"
              class="w-8 h-8 rounded-lg shadow-sm object-contain"
            />
            <div>
              <h1 class="text-sm font-bold tracking-tight text-slate-900 dark:text-zinc-50">Sticklet</h1>
              <span class="text-[11px] text-slate-400 dark:text-zinc-500">
                {{ notesStore.notes.length }} {{ notesStore.notes.length === 1 ? 'note' : 'notes' }}
              </span>
            </div>
          </div>

          <div class="flex items-center space-x-1">
            <!-- Native Open File -->
            <button
              type="button"
              class="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400 transition-colors"
              title="Open / Import Note File (.md, .txt, .html)"
              @click="handleImportFile"
            >
              <FileUp class="w-4 h-4" />
            </button>

            <!-- Export to Folder -->
            <button
              type="button"
              class="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400 transition-colors"
              title="Backup / Export All Notes to Local Folder"
              @click="handleExportAllToFolder"
            >
              <FolderDown class="w-4 h-4" />
            </button>

            <!-- New Note -->
            <Button
              size="sm"
              class="bg-amber-400 hover:bg-amber-500 text-amber-950 font-medium h-8 px-2.5 gap-1.5 shadow-sm ml-1"
              title="Create and open new sticky note"
              @click="() => handleCreateNote()"
            >
              <Plus class="w-4 h-4" />
              <span>New</span>
            </Button>
          </div>
        </div>

        <div
          v-if="bannerMessage"
          class="px-2.5 py-1 text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-900/50 rounded animate-in fade-in"
        >
          {{ bannerMessage }}
        </div>

        <!-- Search Bar -->
        <div class="relative">
          <Search class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <Input
            v-model="notesStore.searchQuery"
            placeholder="Search notes..."
            class="pl-8 h-8 text-xs bg-slate-50 dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-700/60 focus-visible:ring-1"
          />
        </div>

        <!-- Color Filter Chips -->
        <div class="flex items-center space-x-1 overflow-x-auto pt-0.5 pb-0.5 no-scrollbar">
          <button
            type="button"
            class="px-2 py-0.5 text-[11px] rounded-full border transition-colors flex-shrink-0"
            :class="selectedColorFilter === 'all'
              ? 'bg-slate-800 text-white dark:bg-white dark:text-black border-transparent font-medium'
              : 'bg-transparent text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800'"
            @click="selectedColorFilter = 'all'"
          >
            All
          </button>
          <button
            v-for="c in availableColors"
            :key="c"
            type="button"
            class="w-4 h-4 rounded-full border transition-all flex-shrink-0"
            :style="{
              backgroundColor: NOTE_COLORS[c].bg,
              borderColor: NOTE_COLORS[c].border,
            }"
            :class="selectedColorFilter === c ? 'ring-2 ring-slate-800 dark:ring-white scale-110' : 'opacity-75 hover:opacity-100'"
            :title="NOTE_COLORS[c].name"
            @click="selectedColorFilter = c"
          />
        </div>
      </div>

      <!-- Notes List -->
      <div class="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800/60 p-1.5 space-y-1">
        <div
          v-if="displayedNotes.length === 0"
          class="p-6 text-center text-xs text-slate-400 dark:text-zinc-500 space-y-2"
        >
          <NoteIcon class="w-8 h-8 mx-auto opacity-30" />
          <p>No notes found</p>
        </div>

        <div
          v-for="note in displayedNotes"
          :key="note.id"
          class="p-2.5 rounded-lg cursor-pointer transition-all border group relative flex flex-col justify-between"
          :style="{
            backgroundColor: note.id === notesStore.activeNoteId ? NOTE_COLORS[note.color].bg : undefined,
            borderColor: note.id === notesStore.activeNoteId ? NOTE_COLORS[note.color].border : 'transparent',
            color: note.id === notesStore.activeNoteId ? NOTE_COLORS[note.color].text : undefined,
          }"
          :class="{
            'shadow-sm': note.id === notesStore.activeNoteId,
            'hover:bg-slate-50 dark:hover:bg-zinc-800/50': note.id !== notesStore.activeNoteId,
          }"
          @click="selectNote(note.id)"
          @dblclick="openInDesktopWindow(note.id)"
        >
          <div class="flex items-start justify-between gap-2">
            <h3 class="text-xs font-semibold truncate leading-snug flex-1">
              {{ note.title || 'Untitled note' }}
            </h3>
            <div class="flex items-center space-x-1.5">
              <!-- Color indicator dot -->
              <div
                class="w-2.5 h-2.5 rounded-full flex-shrink-0 border"
                :style="{
                  backgroundColor: NOTE_COLORS[note.color].dotColor,
                  borderColor: NOTE_COLORS[note.color].border,
                }"
              />
            </div>
          </div>

          <p class="text-[11px] opacity-70 line-clamp-2 mt-1 leading-normal">
            {{ stripHtml(note.content) || 'Empty note...' }}
          </p>

          <div class="flex items-center justify-between mt-2 pt-1 text-[10px] opacity-50 border-t border-black/5 dark:border-white/5">
            <span class="flex items-center gap-1">
              <Clock class="w-3 h-3" />
              {{ new Date(note.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) }}
            </span>
            <div class="flex items-center space-x-1">
              <!-- Pop-out button -->
              <button
                type="button"
                class="opacity-0 group-hover:opacity-100 hover:text-amber-600 transition-opacity p-0.5"
                title="Pop out to floating desktop window"
                @click.stop="openInDesktopWindow(note.id)"
              >
                <ExternalLink class="w-3 h-3" />
              </button>
              <!-- Delete button -->
              <button
                type="button"
                class="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity p-0.5"
                title="Delete note"
                @click.stop="notesStore.deleteNote(note.id)"
              >
                <Trash2 class="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>

    <!-- RIGHT WORKSPACE: Active Note & Pop-Out Controls -->
    <main class="flex-1 h-full p-6 bg-slate-100 dark:bg-zinc-950 flex flex-col items-center justify-center overflow-auto relative">
      <div v-if="notesStore.activeNote" class="w-full max-w-md flex flex-col items-center space-y-3">
        <!-- Floating Window Action Header -->
        <div class="w-full flex items-center justify-between px-1">
          <span class="text-xs text-slate-500 dark:text-zinc-400 font-medium">Preview</span>
          <Button
            size="sm"
            variant="outline"
            class="h-7 text-xs gap-1.5 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:bg-slate-50 shadow-sm"
            @click="() => openInDesktopWindow(notesStore.activeNote!.id)"
          >
            <ExternalLink class="w-3.5 h-3.5 text-amber-500" />
            <span>Pop Out to Desktop</span>
          </Button>
        </div>

        <div class="w-full h-[460px] animate-in fade-in zoom-in-95 duration-200">
          <StickyNote
            :note="notesStore.activeNote"
            @close="handleCloseNote"
            @new-note="() => handleCreateNote()"
          />
        </div>
      </div>

      <div
        v-else
        class="text-center p-8 max-w-sm rounded-xl border border-dashed border-slate-300 dark:border-zinc-800 text-slate-400 dark:text-zinc-500 space-y-3"
      >
        <NoteIcon class="w-12 h-12 mx-auto text-amber-400/80" />
        <h2 class="text-sm font-semibold text-slate-700 dark:text-zinc-300">No Note Selected</h2>
        <p class="text-xs">Create a new sticky note or pick one from the list on the left to start writing.</p>
        <Button
          class="bg-amber-400 hover:bg-amber-500 text-amber-950 font-medium text-xs mt-2"
          @click="() => handleCreateNote()"
        >
          <Plus class="w-4 h-4 mr-1" />
          Create Note
        </Button>
      </div>
    </main>
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
