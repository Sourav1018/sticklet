<script setup lang="ts">
import { useAppUpdater } from '@/composables/useAppUpdater'
import {
  Download,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  RotateCw,
} from '@lucide/vue'

const {
  status,
  updateInfo,
  downloadProgress,
  errorMessage,
  downloadAndInstall,
  restartApp,
  dismissModal,
} = useAppUpdater()
</script>

<template>
  <!-- Active Update Modal -->
  <Teleport to="body">
    <div
      v-if="status === 'available' || status === 'downloading' || status === 'ready-to-restart'"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150"
    >
      <div
        class="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-2xl max-w-sm w-full p-5 space-y-4 text-slate-800 dark:text-zinc-100"
      >
        <!-- Modal Header -->
        <div class="flex items-start justify-between">
          <div class="flex items-center space-x-2.5">
            <div
              class="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400"
            >
              <Sparkles v-if="status === 'available'" class="w-5 h-5" />
              <Download v-else-if="status === 'downloading'" class="w-5 h-5 animate-bounce" />
              <CheckCircle2 v-else class="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h2 class="text-sm font-bold leading-tight">
                {{
                  status === 'ready-to-restart'
                    ? 'Update Ready!'
                    : status === 'downloading'
                    ? 'Updating Sticklet...'
                    : 'Update Available!'
                }}
              </h2>
              <p class="text-[11px] text-slate-500 dark:text-zinc-400">
                <span v-if="updateInfo">v{{ updateInfo.version }} is ready to install</span>
                <span v-else>New release available</span>
              </p>
            </div>
          </div>

          <button
            v-if="status !== 'downloading'"
            type="button"
            class="p-1 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
            @click="dismissModal"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Release Notes / Body -->
        <div
          v-if="updateInfo?.body && status === 'available'"
          class="max-h-36 overflow-y-auto text-xs bg-slate-50 dark:bg-zinc-800/50 p-2.5 rounded-lg border border-slate-100 dark:border-zinc-800/80 text-slate-600 dark:text-zinc-300 leading-relaxed font-sans"
        >
          <div class="font-semibold text-slate-700 dark:text-zinc-200 mb-1 text-[11px]">What's New:</div>
          <p class="whitespace-pre-line">{{ updateInfo.body }}</p>
        </div>

        <!-- Download Progress Bar -->
        <div v-if="status === 'downloading'" class="space-y-1.5 pt-1">
          <div class="flex items-center justify-between text-[11px] font-medium text-slate-600 dark:text-zinc-400">
            <span>Downloading update...</span>
            <span>{{ downloadProgress }}%</span>
          </div>
          <div class="w-full h-2 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div
              class="h-full bg-amber-400 transition-all duration-200"
              :style="{ width: `${downloadProgress}%` }"
            />
          </div>
        </div>

        <!-- Error State -->
        <div
          v-if="errorMessage"
          class="flex items-center space-x-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-2 rounded"
        >
          <AlertCircle class="w-4 h-4 flex-shrink-0" />
          <span class="truncate">{{ errorMessage }}</span>
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center justify-end space-x-2 pt-1">
          <button
            v-if="status === 'available'"
            type="button"
            class="px-3 py-1.5 text-xs text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors font-medium"
            @click="dismissModal"
          >
            Remind Me Later
          </button>

          <button
            v-if="status === 'available'"
            type="button"
            class="px-3.5 py-1.5 text-xs bg-amber-400 hover:bg-amber-500 text-amber-950 font-semibold rounded-lg shadow-sm transition-all flex items-center space-x-1.5"
            @click="downloadAndInstall"
          >
            <Download class="w-3.5 h-3.5" />
            <span>Update Now</span>
          </button>

          <button
            v-if="status === 'ready-to-restart'"
            type="button"
            class="w-full py-2 text-xs bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg shadow-sm transition-all flex items-center justify-center space-x-1.5"
            @click="restartApp"
          >
            <RotateCw class="w-3.5 h-3.5" />
            <span>Restart Sticklet to Apply</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
