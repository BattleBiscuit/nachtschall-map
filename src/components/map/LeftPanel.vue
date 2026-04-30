<template>
  <ParchmentContainer
    width="240px"
    padding="1.5rem"
    class="left-panel"
  >
    <!-- Room Info -->
    <div class="room-info">
      <h2 class="room-title">Room</h2>
      <div class="room-code">{{ roomId }}</div>
      <div class="role-badge" :class="roleClass">
        {{ isOwner ? '👑 Owner' : '👁 Viewer' }}
      </div>
    </div>

    <!-- Owner Controls -->
    <div v-if="isOwner" class="owner-controls">
      <div class="control-section">
        <h3 class="section-title">Actions</h3>
        <div class="button-group">
          <WaxSealButton
            :active="activeTool === 'draw'"
            icon="✎"
            label="Draw"
            color="red"
            size="medium"
            @click="toggleDrawTool"
          />
          <WaxSealButton
            icon="⚔"
            label="Initiative"
            color="green"
            size="medium"
            @click="toggleInitiativeTracker"
          />
          <WaxSealButton
            icon="↻"
            label="Reset All"
            color="red"
            size="medium"
            @click="handleReset"
          />
        </div>

        <!-- Help Text -->
        <div class="help-text">
          <span v-if="activeTool === 'draw'" class="help-line">Drag: Draw Path</span>
          <template v-else>
            <span class="help-line">Click: Reveal Fog</span>
            <span class="help-line">Double-Click: Add Marker</span>
            <span class="help-line">Right-Click: Add Fog</span>
          </template>
        </div>
      </div>
    </div>

    <!-- Connection Status -->
    <div class="connection-status" :class="{ connected: isConnected }">
      <span class="status-dot"></span>
      {{ isConnected ? 'Connected' : 'Disconnected' }}
    </div>
  </ParchmentContainer>
</template>

<script setup>
import { computed } from 'vue'
import { useRoomStore } from '@/stores/room'
import { useSocketStore } from '@/stores/socket'
import { useUiStore } from '@/stores/ui'
import ParchmentContainer from '@/components/ui/ParchmentContainer.vue'
import WaxSealButton from '@/components/ui/WaxSealButton.vue'

const roomStore = useRoomStore()
const socketStore = useSocketStore()
const uiStore = useUiStore()

const roomId = computed(() => roomStore.roomId)
const isOwner = computed(() => roomStore.isOwner)
const isConnected = computed(() => socketStore.isConnected)
const activeTool = computed(() => uiStore.activeTool)

const roleClass = computed(() => isOwner.value ? 'role-owner' : 'role-viewer')

function toggleDrawTool() {
  if (activeTool.value === 'draw') {
    uiStore.setActiveTool(null)
  } else {
    uiStore.setActiveTool('draw')
  }
}

function toggleInitiativeTracker() {
  uiStore.toggleInitiativeTracker()
}

function handleReset() {
  if (confirm('Reset all markers, fog, and drawings? This cannot be undone.')) {
    roomStore.reset()
    socketStore.emitAction(roomStore.roomId, {
      type: 'reset',
      data: {}
    })
  }
}
</script>

<style scoped>
.left-panel {
  max-height: 100%;
  overflow-y: auto;
}

.room-info {
  margin-bottom: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 2px solid var(--parchment-dark);
}

.room-title {
  font-family: var(--font-display);
  font-size: 1.5rem;
  color: var(--accent-red);
  margin: 0 0 0.5rem 0;
  text-align: center;
}

.room-code {
  font-family: var(--font-heading);
  font-size: 1.25rem;
  color: var(--ink-black);
  text-align: center;
  letter-spacing: 0.15em;
  font-weight: bold;
  padding: 0.5rem;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
  margin-bottom: 0.75rem;
}

.role-badge {
  font-family: var(--font-body);
  font-size: 0.875rem;
  text-align: center;
  padding: 0.5rem;
  border-radius: 4px;
  font-weight: bold;
}

.role-owner {
  background: rgba(201, 169, 97, 0.2);
  color: var(--accent-gold);
  border: 1px solid var(--accent-gold);
}

.role-viewer {
  background: rgba(90, 85, 82, 0.2);
  color: var(--accent-gray);
  border: 1px solid var(--accent-gray);
}

.owner-controls {
  margin-bottom: 1.5rem;
}

.control-section {
  margin-bottom: 1.5rem;
}

.section-title {
  font-family: var(--font-heading);
  font-size: 1rem;
  color: var(--ink-black);
  margin: 0 0 0.75rem 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.button-group {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.help-text {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.75rem;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
}

.help-line {
  font-family: var(--font-body);
  font-size: 0.75rem;
  color: var(--ink-faded);
}

.connection-status {
  padding-top: 1rem;
  border-top: 2px solid var(--parchment-dark);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-family: var(--font-body);
  font-size: 0.875rem;
  color: var(--ink-faded);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent-red);
  animation: pulse 2s ease-in-out infinite;
}

.connection-status.connected .status-dot {
  background: #27ae60;
  animation: none;
}

@keyframes pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}

@media (max-width: 768px) {
  .left-panel {
    width: 240px;
    top: 1rem;
    left: 1rem;
  }

  .button-group {
    flex-direction: column;
  }
}
</style>
