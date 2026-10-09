<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { detectFloatingNoteId } from '@/composables/useFloatingWindow'
import FloatingNoteWindow from '@/components/FloatingNoteWindow.vue'

const route = useRoute()

const noteId = computed(() => {
  const id = route.params.id
  if (Array.isArray(id) && id[0]) return id[0]
  if (typeof id === 'string' && id) return id
  return detectFloatingNoteId() || ''
})
</script>

<template>
  <FloatingNoteWindow v-if="noteId" :note-id="noteId" />
  <div v-else class="h-screen w-screen flex items-center justify-center bg-amber-50 text-amber-900 text-xs">
    No note selected.
  </div>
</template>
