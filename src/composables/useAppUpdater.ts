import { ref, onMounted } from 'vue'
import { check, type Update } from '@tauri-apps/plugin-updater'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'up-to-date'
  | 'downloading'
  | 'ready-to-restart'
  | 'error'

export interface UpdateInfo {
  version: string
  currentVersion: string
  date?: string
  body?: string
}

const status = ref<UpdateStatus>('idle')
const updateInfo = ref<UpdateInfo | null>(null)
const downloadProgress = ref<number>(0)
const errorMessage = ref<string>('')
let activeUpdate: Update | null = null
let listenerRegistered = false

export function useAppUpdater() {
  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

  async function checkForUpdates(silent = false): Promise<boolean> {
    if (!isTauri) {
      if (!silent) {
        status.value = 'up-to-date'
        setTimeout(() => {
          status.value = 'idle'
        }, 3000)
      }
      return false
    }

    if (status.value === 'checking' || status.value === 'downloading') {
      return false
    }

    status.value = 'checking'
    errorMessage.value = ''

    try {
      const update = await check()
      if (update && update.available) {
        activeUpdate = update
        updateInfo.value = {
          version: update.version,
          currentVersion: update.currentVersion,
          date: update.date,
          body: update.body,
        }
        status.value = 'available'
        return true
      } else {
        activeUpdate = null
        status.value = 'up-to-date'
        if (silent) {
          setTimeout(() => {
            if (status.value === 'up-to-date') status.value = 'idle'
          }, 3000)
        } else {
          setTimeout(() => {
            if (status.value === 'up-to-date') status.value = 'idle'
          }, 4000)
        }
        return false
      }
    } catch (err: any) {
      console.warn('Update check failed:', err)
      errorMessage.value = err?.message || 'Could not connect to update server'
      status.value = 'error'
      setTimeout(() => {
        if (status.value === 'error') status.value = 'idle'
      }, 5000)
      return false
    }
  }

  async function downloadAndInstall(): Promise<void> {
    if (!activeUpdate || !isTauri) return

    status.value = 'downloading'
    downloadProgress.value = 0
    errorMessage.value = ''

    try {
      let downloaded = 0
      let contentLength = 0

      await activeUpdate.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength || 0
            break
          case 'Progress':
            downloaded += event.data.chunkLength
            if (contentLength > 0) {
              downloadProgress.value = Math.min(
                100,
                Math.round((downloaded / contentLength) * 100)
              )
            }
            break
          case 'Finished':
            downloadProgress.value = 100
            break
        }
      })

      status.value = 'ready-to-restart'
    } catch (err: any) {
      console.error('Failed to download and install update:', err)
      errorMessage.value = err?.message || 'Download failed. Please try again later.'
      status.value = 'error'
    }
  }

  async function restartApp(): Promise<void> {
    if (!isTauri) return
    try {
      await invoke('restart_app')
    } catch (err) {
      console.error('Failed to restart app:', err)
    }
  }

  function dismissModal() {
    if (status.value !== 'downloading') {
      status.value = 'idle'
    }
  }

  onMounted(() => {
    if (isTauri && !listenerRegistered) {
      listenerRegistered = true
      listen('check-for-updates', () => {
        checkForUpdates(false)
      })

      // Auto-check in background 4 seconds after app starts up
      setTimeout(() => {
        checkForUpdates(true)
      }, 4000)
    }
  })

  return {
    status,
    updateInfo,
    downloadProgress,
    errorMessage,
    checkForUpdates,
    downloadAndInstall,
    restartApp,
    dismissModal,
  }
}
