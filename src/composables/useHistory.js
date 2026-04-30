/**
 * useHistory Composable
 *
 * Provides undo/redo functionality with keyboard shortcuts
 */

import { onMounted, onUnmounted, computed } from 'vue'
import { useRoomStore } from '@/stores/room'

export function useHistory() {
  const roomStore = useRoomStore()

  const canUndo = computed(() => {
    return roomStore.isOwner && roomStore.historyIndex > 0
  })

  const canRedo = computed(() => {
    return roomStore.isOwner && roomStore.historyIndex < roomStore.historyStack.length - 1
  })

  function undo() {
    if (canUndo.value) {
      roomStore.undo()
    }
  }

  function redo() {
    if (canRedo.value) {
      roomStore.redo()
    }
  }

  function handleKeydown(event) {
    // Check if user is typing in an input
    const isTyping = ['INPUT', 'TEXTAREA'].includes(event.target.tagName)
    if (isTyping) return

    // Ctrl+Z or Cmd+Z for undo
    if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
      event.preventDefault()
      undo()
    }

    // Ctrl+Y or Cmd+Shift+Z for redo
    if (
      ((event.ctrlKey || event.metaKey) && event.key === 'y') ||
      ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'z')
    ) {
      event.preventDefault()
      redo()
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeydown)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown)
  })

  return {
    undo,
    redo,
    canUndo,
    canRedo
  }
}
