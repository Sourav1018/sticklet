<script setup lang="ts">
import '@/assets/css/tailwind.css'
import { ref, onMounted } from 'vue'
import { useTheme } from '@/composables/useTheme'
import { detectFloatingNoteId } from '@/composables/useFloatingWindow'
import FloatingNoteWindow from '@/components/FloatingNoteWindow.vue'

useTheme()

// Detect synchronously on component setup so the Notes Hub router NEVER renders in floating windows
const floatingNoteId = ref<string | null>(detectFloatingNoteId())

onMounted(() => {
  if (!floatingNoteId.value) {
    const detected = detectFloatingNoteId()
    if (detected) {
      floatingNoteId.value = detected
    }
  }
})
</script>

<template>
  <div v-if="floatingNoteId" class="w-screen h-screen overflow-hidden select-none">
    <FloatingNoteWindow :note-id="floatingNoteId" />
  </div>
  <div v-else class="w-full h-full">
    <NuxtPage />
  </div>
</template>

<style>
/* Global reset for Sticky Notes */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  background-color: transparent;
  user-select: none;
  overflow: hidden;
}
</style>
