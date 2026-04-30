<template>
  <div class="map-view">
    <!-- Grid Layout -->
    <div class="grid-container">
      <!-- Left Panel -->
      <div class="grid-left">
        <LeftPanel />
      </div>

      <!-- Map Canvas (top-right) -->
      <div class="grid-map">
        <MapCanvas />
      </div>

      <!-- Bottom Toolbar (bottom-right, spans under map) -->
      <div class="grid-bottom">
        <ToolOverlay />
      </div>
    </div>

    <!-- Floating Overlays -->
    <ColorPalette />
    <BrushControl />
    <InitiativeTracker />
  </div>
</template>

<script setup>
import { onMounted, defineProps, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useRoomStore } from '@/stores/room'
import { useSocket } from '@/composables/useSocket'
import MapCanvas from '@/components/map/MapCanvas.vue'
import LeftPanel from '@/components/map/LeftPanel.vue'
import ToolOverlay from '@/components/map/ToolOverlay.vue'
import ColorPalette from '@/components/map/ColorPalette.vue'
import BrushControl from '@/components/map/BrushControl.vue'
import InitiativeTracker from '@/components/map/InitiativeTracker.vue'

const props = defineProps({
  code: {
    type: String,
    required: true
  }
})

const router = useRouter()
const roomStore = useRoomStore()
const { joinRoom, isConnected } = useSocket()

onMounted(async () => {
  try {
    // Wait for socket to connect
    if (!isConnected.value) {
      await new Promise((resolve) => {
        const checkConnection = setInterval(() => {
          if (isConnected.value) {
            clearInterval(checkConnection)
            resolve()
          }
        }, 100)
        // Timeout after 5 seconds
        setTimeout(() => {
          clearInterval(checkConnection)
          resolve()
        }, 5000)
      })
    }

    if (!isConnected.value) {
      throw new Error('Socket connection timeout')
    }

    // Check if we're already in this room (page reload scenario)
    const isRejoining = roomStore.roomId === props.code && roomStore.mapImageDataUrl

    if (isRejoining) {
      // Still need to join the socket room
      const response = await joinRoom(props.code)

      // Update role in case ownership changed
      roomStore.isOwner = response.role === 'owner'

      // If owner, reload history stack from server
      if (response.historyStack) {
        roomStore.setHistoryStack(response.historyStack)
      }
    } else {
      // Join the room via WebSocket
      const response = await joinRoom(props.code)

      // Set room data
      roomStore.roomId = props.code
      roomStore.isOwner = response.role === 'owner'
      roomStore.setRoomSnapshot(response.snapshot)

      // If owner, load history stack
      if (response.historyStack) {
        roomStore.setHistoryStack(response.historyStack)
      }
    }
  } catch (error) {
    console.error('[MapView] Failed to join room:', error)
    alert('Failed to join room: ' + error.message)
    router.push('/')
  }
})
</script>

<style scoped>
.map-view {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background:
    repeating-linear-gradient(
      90deg,
      var(--leather-darker) 0px,
      var(--leather-dark) 2px,
      var(--leather-darker) 4px
    ),
    repeating-linear-gradient(
      0deg,
      transparent 0px,
      rgba(0, 0, 0, 0.02) 1px,
      transparent 2px
    ),
    linear-gradient(
      135deg,
      #2a1f15 0%,
      #3d2f1f 25%,
      #2a1f15 50%,
      #3d2f1f 75%,
      #2a1f15 100%
    );
  box-shadow: inset 0 0 200px rgba(0, 0, 0, 0.3);
  position: relative;
}

.grid-container {
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: calc(100% - 150px) auto; /* Reserve space for toolbar */
  gap: 1rem;
  padding: 2rem;
  box-sizing: border-box;
}

.grid-left {
  grid-column: 1;
  grid-row: 1 / 3;
  display: flex;
  align-items: flex-start;
}

.grid-map {
  grid-column: 2;
  grid-row: 1;
  position: relative;
  overflow: visible; /* Show torn edges */
  align-self: start;
  justify-self: stretch; /* Fill horizontal space */
  width: 100%;
  max-height: 100%; /* Don't overflow grid cell */
}

.grid-bottom {
  grid-column: 2;
  grid-row: 2;
  display: flex;
  justify-content: center;
  align-items: flex-end;
}

@media (max-width: 768px) {
  .grid-container {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr auto;
    padding: 1rem;
  }

  .grid-left {
    grid-column: 1;
    grid-row: 1;
  }

  .grid-map {
    grid-column: 1;
    grid-row: 2;
  }

  .grid-bottom {
    grid-column: 1;
    grid-row: 3;
  }
}

</style>
