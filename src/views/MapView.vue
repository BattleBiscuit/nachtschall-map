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

// Simple hash function for snapshot validation
function simpleHash(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return hash.toString(36)
}

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

    // Try loading from IndexedDB cache first
    await roomStore.loadFromIndexedDB(props.code)

    // Join the room via WebSocket
    const response = await joinRoom(props.code)

    // Check if we have cached data for this room
    const isRejoining = roomStore.roomId === props.code && roomStore.mapUrl

    if (isRejoining && response.snapshotHash) {
      // Validate localStorage against server hash
      const localSnapshot = {
        mapUrl: roomStore.mapUrl,
        mapAspectRatio: roomStore.mapAspectRatio,
        markers: roomStore.markers,
        revealShapes: roomStore.revealShapes,
        drawings: roomStore.drawings,
        initiativeRounds: roomStore.initiativeRounds,
        initiativeAssignments: roomStore.markerRoundAssignments
      }
      const localHash = simpleHash(JSON.stringify(localSnapshot))

      if (localHash !== response.snapshotHash) {
        console.log('[MapView] localStorage stale, reloading from server')
        // Stale data - reload from server
        roomStore.setRoomSnapshot(response.snapshot)
      } else {
        console.log('[MapView] localStorage valid, using cached data')
      }
    } else if (!isRejoining) {
      // First time joining this room - load from server
      roomStore.roomId = props.code
      roomStore.setRoomSnapshot(response.snapshot)
    }

    // Update role (might have changed)
    roomStore.isOwner = response.role === 'owner'
  } catch (error) {
    console.error('[MapView] Failed to join room:', error)

    // Provide user-friendly error messages
    let errorMessage = 'Failed to join room'
    if (error.message.includes('not found')) {
      errorMessage = 'Room not found. It may have been deleted or the code is incorrect.'
    } else if (error.message.includes('timeout')) {
      errorMessage = 'Connection timeout. Please check your internet connection.'
    } else if (error.message.includes('not connected')) {
      errorMessage = 'Could not connect to server. Please try again.'
    } else {
      errorMessage = error.message
    }

    alert(errorMessage)
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
  align-self: stretch; /* Fill vertical space */
  justify-self: stretch; /* Fill horizontal space */
  width: 100%;
  height: 100%; /* Fill grid cell */
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
