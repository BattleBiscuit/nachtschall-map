import { onMounted, onUnmounted, computed } from 'vue'
import { useSocketStore } from '@/stores/socket'
import { useRoomStore } from '@/stores/room'

export function useSocket() {
  const socketStore = useSocketStore()
  const roomStore = useRoomStore()

  onMounted(() => {
    // Connect socket when component mounts
    socketStore.connect()

    // Register event listeners
    socketStore.onAction((action) => {
      roomStore.applyAction(action)
    })

    socketStore.onOwnerChanged((data) => {
      if (socketStore.socket) {
        roomStore.isOwner = (data.newOwner === socketStore.socket.id)
      }
    })
  })

  onUnmounted(() => {
    // Clean up event listeners
    socketStore.offAction()
    socketStore.offPing()
    socketStore.offOwnerChanged()
    socketStore.offParticipantJoined()
  })

  return {
    // State
    isConnected: computed(() => socketStore.isConnected),
    error: computed(() => socketStore.error),

    // Actions
    createRoom: socketStore.createRoom.bind(socketStore),
    joinRoom: socketStore.joinRoom.bind(socketStore),
    emitAction: socketStore.emitAction.bind(socketStore),
    emitPing: socketStore.emitPing.bind(socketStore),
    disconnect: socketStore.disconnect.bind(socketStore)
  }
}
