<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'

import { useNotesStore, NOTE_COLORS, type Note, type NoteColor } from '@/stores/notes'
import { useTauriWindow } from '@/composables/useTauriWindow'
import { useNativeIO } from '@/composables/useNativeIO'
import { marked } from 'marked'
import {
  Plus,
  Pin,
  PinOff,
  MoreHorizontal,
  X,
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Underline as UnderlineIcon,
  Strikethrough as StrikethroughIcon,
  List as ListIcon,
  ListTodo,
  Image as ImageIcon,
  Trash2,
  Copy,
  Download,
} from '@lucide/vue'

const props = defineProps<{
  note: Note
  standalone?: boolean
}>()

const emit = defineEmits<{
  (e: 'close', id: string): void
  (e: 'new-note'): void
}>()

const notesStore = useNotesStore()
const tauriWindow = useTauriWindow()
const nativeIO = useNativeIO()
const isMenuOpen = ref(false)
const copyStatusText = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)

const currentColorTheme = computed(() => {
  return NOTE_COLORS[props.note.color] || NOTE_COLORS.yellow
})

// TipTap Editor instance
const editor = useEditor({
  content: props.note.content || '',
  extensions: [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3],
      },
      bulletList: {
        keepMarks: true,
      },
    }),
    Underline,
    TaskList,
    TaskItem.configure({
      nested: true,
    }),
    Placeholder.configure({
      placeholder: 'Take a note...',
      emptyEditorClass: 'is-editor-empty',
    }),
    Image.configure({
      inline: false,
      allowBase64: true,
    }),
  ],
  editorProps: {
    attributes: {
      class: 'focus:outline-none min-h-[140px] text-sm leading-relaxed tracking-normal p-3 select-text',
    },
    handlePaste: (_view, event) => {
      const items = event.clipboardData?.items
      if (items) {
        for (const item of items) {
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile()
            if (file) {
              const reader = new FileReader()
              reader.onload = (e) => {
                const src = e.target?.result as string
                if (src) {
                  editor.value?.chain().focus().setImage({ src }).run()
                }
              }
              reader.readAsDataURL(file)
              return true
            }
          }
        }
      }
      return false
    },
    handleDrop: (_view, event) => {
      const files = event.dataTransfer?.files
      if (files && files.length > 0) {
        const file = files[0]
        if (file.type.startsWith('image/')) {
          const reader = new FileReader()
          reader.onload = (e) => {
            const src = e.target?.result as string
            if (src) {
              editor.value?.chain().focus().setImage({ src }).run()
            }
          }
          reader.readAsDataURL(file)
          return true
        } else if (file.name.endsWith('.md') || file.name.endsWith('.txt') || file.name.endsWith('.html')) {
          const reader = new FileReader()
          reader.onload = (e) => {
            const raw = e.target?.result as string
            if (raw) {
              try {
                const parsed = marked.parse(raw, { async: false, breaks: true }) as string
                editor.value?.commands.insertContent(parsed)
              } catch (_) {
                editor.value?.commands.insertContent(raw)
              }
            }
          }
          reader.readAsText(file)
          return true
        }
      }
      return false
    },
    handleDOMEvents: {
      blur: () => {
        notesStore.flushPendingSave(props.note.id)
        return false
      },
    },
  },
  onUpdate: ({ editor }) => {
    const html = editor.getHTML()
    notesStore.updateNote(props.note.id, { content: html })
  },
})

// Update editor content only if changed externally and editor is not currently focused
watch(
  () => props.note.content,
  (newContent) => {
    if (editor.value && !editor.value.isFocused && editor.value.getHTML() !== newContent) {
      editor.value.commands.setContent(newContent, { emitUpdate: false })
    }
  }
)

onBeforeUnmount(() => {
  notesStore.flushPendingSave(props.note.id)
  editor.value?.destroy()
})

const availableColors: NoteColor[] = ['yellow', 'green', 'pink', 'purple', 'blue', 'charcoal']

function setColor(c: NoteColor) {
  notesStore.setNoteColor(props.note.id, c)
  isMenuOpen.value = false
}

function togglePin() {
  notesStore.togglePin(props.note.id)
  tauriWindow.toggleAlwaysOnTop(props.note.id, props.note.isPinned)
}

function deleteNote() {
  notesStore.deleteNote(props.note.id)
  isMenuOpen.value = false
  if (props.standalone) {
    tauriWindow.closeNoteWindow(props.note.id)
  }
}

async function handleCopyContent() {
  const plainText = editor.value?.getText() || ''
  if (!plainText) return
  await nativeIO.copyToClipboard(plainText)
  copyStatusText.value = 'Copied!'
  setTimeout(() => {
    copyStatusText.value = ''
    isMenuOpen.value = false
  }, 1000)
}

async function handleSaveToFile() {
  isMenuOpen.value = false
  // Clean markdown or text content
  const title = props.note.title.replace(/[/\\?%*:|"<>]/g, '').trim() || 'note'
  const defaultFileName = `${title}.md`
  const header = `# ${props.note.title}\n\n`
  const body = editor.value?.getText() || ''
  await nativeIO.saveNoteToFile(header + body, defaultFileName)
}

function triggerImageUpload() {
  fileInputRef.value?.click()
}

function handleFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (file && file.type.startsWith('image/')) {
    const reader = new FileReader()
    reader.onload = (ev) => {
      const src = ev.target?.result as string
      if (src) {
        editor.value?.chain().focus().setImage({ src }).run()
      }
    }
    reader.readAsDataURL(file)
  }
  target.value = ''
}

async function handleClose() {
  if (editor.value) {
    const html = editor.value.getHTML()
    notesStore.updateNote(props.note.id, { content: html }, true)
  }
  await notesStore.flushPendingSave(props.note.id)
  emit('close', props.note.id)
}

function handleNewNote() {
  emit('new-note')
}
</script>

<template>
  <div
    class="sticky-note-card flex flex-col select-none relative group h-full transition-all duration-200"
    :class="standalone ? 'rounded-none border-0 shadow-none w-full' : 'rounded-lg shadow-md border overflow-hidden min-h-[260px]'"
    :style="{
      backgroundColor: currentColorTheme.bg,
      borderColor: currentColorTheme.border,
      color: currentColorTheme.text,
    }"
  >
    <!-- Draggable Header Bar -->
    <header
      class="header-bar flex items-center justify-between px-2.5 py-1.5 transition-colors cursor-move select-none"
      data-tauri-drag-region
      @mousedown="tauriWindow.startDragging"
      :style="{
        backgroundColor: currentColorTheme.header,
        borderBottom: `1px solid ${currentColorTheme.border}`,
      }"
    >
      <!-- Left: New Note Button -->
      <div class="flex items-center space-x-1">
        <button
          type="button"
          class="header-btn p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          title="New note (Ctrl+N)"
          @click="handleNewNote"
        >
          <Plus class="w-4 h-4 opacity-75 hover:opacity-100" />
        </button>
      </div>

      <!-- Middle: Title or drag hint -->
      <div
        class="flex-1 text-center text-xs font-medium opacity-60 truncate px-2 select-none"
        data-tauri-drag-region
      >
        {{ note.title || 'Sticklet' }}
      </div>

      <!-- Right: Actions (Pin, Menu, Close) -->
      <div class="flex items-center space-x-1 relative">
        <!-- Always on Top / Pin Button -->
        <button
          type="button"
          class="header-btn p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          :class="{ 'opacity-100 font-bold': note.isPinned, 'opacity-65': !note.isPinned }"
          :title="note.isPinned ? 'Unpin from top' : 'Always on top'"
          @click="togglePin"
        >
          <Pin v-if="!note.isPinned" class="w-3.5 h-3.5" />
          <PinOff v-else class="w-3.5 h-3.5 fill-current" />
        </button>

        <!-- Color & Options Menu Toggle -->
        <div class="relative">
          <button
            type="button"
            class="header-btn p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors opacity-65 hover:opacity-100"
            title="Menu & Colors"
            @click="isMenuOpen = !isMenuOpen"
          >
            <MoreHorizontal class="w-3.5 h-3.5" />
          </button>

          <!-- Dropdown Menu / Color Palette -->
          <div
            v-if="isMenuOpen"
            class="absolute right-0 top-7 w-48 p-2.5 shadow-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg z-50 text-slate-800 dark:text-zinc-100 animate-in fade-in zoom-in-95 duration-150"
          >
            <div class="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-2 px-1">
              Color
            </div>
            <div class="grid grid-cols-6 gap-1.5 px-1 mb-2">
              <button
                v-for="c in availableColors"
                :key="c"
                type="button"
                class="w-5 h-5 rounded-full border transition-transform hover:scale-115 flex items-center justify-center cursor-pointer"
                :style="{
                  backgroundColor: NOTE_COLORS[c].bg,
                  borderColor: NOTE_COLORS[c].border,
                }"
                :class="{ 'ring-2 ring-slate-800 dark:ring-white scale-110': note.color === c }"
                :title="NOTE_COLORS[c].name"
                @click="setColor(c)"
              />
            </div>

            <div class="border-t border-slate-100 dark:border-zinc-800 my-1.5" />

            <button
              type="button"
              class="w-full text-left px-2 py-1.5 text-xs text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded flex items-center gap-2 cursor-pointer transition-colors"
              @click="handleCopyContent"
            >
              <Copy class="w-3.5 h-3.5" />
              <span>{{ copyStatusText || 'Copy to Clipboard' }}</span>
            </button>

            <button
              type="button"
              class="w-full text-left px-2 py-1.5 text-xs text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded flex items-center gap-2 cursor-pointer transition-colors"
              @click="handleSaveToFile"
            >
              <Download class="w-3.5 h-3.5" />
              <span>Save to File (.md)...</span>
            </button>

            <div class="border-t border-slate-100 dark:border-zinc-800 my-1.5" />

            <button
              type="button"
              class="w-full text-left px-2 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded flex items-center gap-2 cursor-pointer transition-colors"
              @click="deleteNote"
            >
              <Trash2 class="w-3.5 h-3.5" />
              Delete note
            </button>
          </div>
        </div>

        <!-- Close Note Window -->
        <button
          type="button"
          data-tauri-drag-region="false"
          class="header-btn p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors opacity-65 hover:opacity-100 hover:text-red-600"
          title="Close note"
          @click="handleClose"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>
    </header>

    <!-- TipTap Rich Text Area -->
    <div class="flex-1 overflow-y-auto cursor-text px-1 py-1" @click="isMenuOpen = false">
      <EditorContent :editor="editor" class="tiptap-content" />
    </div>

    <!-- Bottom Formatting Toolbar -->
    <footer
      class="toolbar-bar flex items-center justify-between px-2.5 py-1 border-t text-xs select-none transition-colors"
      :style="{
        backgroundColor: currentColorTheme.header,
        borderColor: currentColorTheme.border,
      }"
    >
      <div class="flex items-center space-x-0.5">
        <!-- Bold -->
        <button
          type="button"
          class="toolbar-btn"
          :class="{ 'is-active': editor?.isActive('bold') }"
          title="Bold (Ctrl+B)"
          @click="editor?.chain().focus().toggleBold().run()"
        >
          <BoldIcon class="w-3.5 h-3.5" />
        </button>

        <!-- Italic -->
        <button
          type="button"
          class="toolbar-btn"
          :class="{ 'is-active': editor?.isActive('italic') }"
          title="Italic (Ctrl+I)"
          @click="editor?.chain().focus().toggleItalic().run()"
        >
          <ItalicIcon class="w-3.5 h-3.5" />
        </button>

        <!-- Underline -->
        <button
          type="button"
          class="toolbar-btn"
          :class="{ 'is-active': editor?.isActive('underline') }"
          title="Underline (Ctrl+U)"
          @click="editor?.chain().focus().toggleUnderline().run()"
        >
          <UnderlineIcon class="w-3.5 h-3.5" />
        </button>

        <!-- Strikethrough -->
        <button
          type="button"
          class="toolbar-btn"
          :class="{ 'is-active': editor?.isActive('strike') }"
          title="Strikethrough"
          @click="editor?.chain().focus().toggleStrike().run()"
        >
          <StrikethroughIcon class="w-3.5 h-3.5" />
        </button>

        <!-- Bullet List -->
        <button
          type="button"
          class="toolbar-btn"
          :class="{ 'is-active': editor?.isActive('bulletList') }"
          title="Bullet list"
          @click="editor?.chain().focus().toggleBulletList().run()"
        >
          <ListIcon class="w-3.5 h-3.5" />
        </button>

        <!-- Task / Checklist -->
        <button
          type="button"
          class="toolbar-btn"
          :class="{ 'is-active': editor?.isActive('taskList') }"
          title="Checklist"
          @click="editor?.chain().focus().toggleTaskList().run()"
        >
          <ListTodo class="w-3.5 h-3.5" />
        </button>

        <!-- Insert Image -->
        <button
          type="button"
          class="toolbar-btn"
          title="Insert image (or paste/drag screenshot)"
          @click="triggerImageUpload"
        >
          <ImageIcon class="w-3.5 h-3.5" />
        </button>
        <input
          ref="fileInputRef"
          type="file"
          accept="image/*"
          class="hidden"
          @change="handleFileSelect"
        />
      </div>

      <div class="text-[10px] opacity-40 px-1 font-mono">
        {{ note.updatedAt ? new Date(note.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '' }}
      </div>
    </footer>
  </div>
</template>

<style scoped>
.sticky-note-card:not(.rounded-none) {
  box-shadow: 0 4px 14px -2px rgba(0, 0, 0, 0.12), 0 2px 6px -1px rgba(0, 0, 0, 0.08);
}

.toolbar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.35rem;
  border-radius: 0.25rem;
  opacity: 0.65;
  transition: all 0.15s ease;
}

.toolbar-btn:hover {
  opacity: 1;
  background-color: rgba(0, 0, 0, 0.08);
}

.toolbar-btn.is-active {
  opacity: 1;
  background-color: rgba(0, 0, 0, 0.14);
  font-weight: bold;
}

:deep(.tiptap-content) {
  min-height: 100%;
}

:deep(.tiptap p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  color: currentColor;
  opacity: 0.4;
  pointer-events: none;
  height: 0;
}

/* TipTap Checklist styling */
:deep(ul[data-type="taskList"]) {
  list-style: none;
  padding: 0;
  margin: 0.25rem 0;
}

:deep(ul[data-type="taskList"] li) {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin: 0.2rem 0;
}

:deep(ul[data-type="taskList"] li > label) {
  flex: 0 0 auto;
  user-select: none;
  margin-top: 0.15rem;
  cursor: pointer;
}

:deep(ul[data-type="taskList"] li > label input[type="checkbox"]) {
  cursor: pointer;
  width: 14px;
  height: 14px;
  accent-color: currentColor;
}

:deep(ul[data-type="taskList"] li > div) {
  flex: 1 1 auto;
}

:deep(ul[data-type="taskList"] li[data-checked="true"] > div) {
  text-decoration: line-through;
  opacity: 0.55;
}

/* Bullet list */
:deep(ul:not([data-type="taskList"])) {
  list-style-type: disc;
  padding-left: 1.25rem;
  margin: 0.35rem 0;
}

:deep(ol) {
  list-style-type: decimal;
  padding-left: 1.25rem;
  margin: 0.35rem 0;
}

:deep(.tiptap img) {
  max-width: 100%;
  height: auto;
  border-radius: 0.375rem;
  margin: 0.5rem 0;
  display: block;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}
</style>
