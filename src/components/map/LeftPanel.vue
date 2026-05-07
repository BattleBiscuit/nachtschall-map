<template>
  <ParchmentContainer
    width="240px"
    padding="1rem"
    class="left-panel"
  >
    <div v-if="hasAnyTools" class="button-group">
      <WaxSealButton
        v-if="canDraw"
        :active="activeTool === 'draw'"
        icon="✎"
        color="red"
        size="medium"
        @click="toggleDrawTool"
      />
      <WaxSealButton
        v-if="canAccessInitiative"
        icon="⚔"
        color="green"
        size="medium"
        @click="toggleInitiativeTracker"
      />
      <WaxSealButton
        v-if="canReset"
        icon="↻"
        color="red"
        size="medium"
        @click="handleReset"
      />
    </div>

    <!-- Help Text -->
    <div v-if="hasAnyTools" class="help-text">
      <span v-if="activeTool === 'draw'" class="help-line">Drag: Draw Path</span>
      <template v-else>
        <span v-if="canRevealFog" class="help-line">Click: Reveal Fog</span>
        <span v-if="canAddMarker" class="help-line">Double-Click: Add Marker</span>
        <span v-if="canAddFog" class="help-line">Right-Click: Add Fog</span>
      </template>
    </div>
  </ParchmentContainer>
</template>

<script setup>
import { computed } from 'vue'
import { useRoomStore } from '@/stores/room'
import { useSocketStore } from '@/stores/socket'
import { useUiStore } from '@/stores/ui'
import { usePermissions } from '@/composables/usePermissions'
import ParchmentContainer from '@/components/ui/ParchmentContainer.vue'
import WaxSealButton from '@/components/ui/WaxSealButton.vue'

const roomStore = useRoomStore()
const socketStore = useSocketStore()
const uiStore = useUiStore()
const { can } = usePermissions()

const isOwner = computed(() => roomStore.isOwner)
const activeTool = computed(() => uiStore.activeTool)

// Permission checks
const canDraw = can('drawings', 'create')
const canAccessInitiative = computed(() =>
  can('initiative', 'assign').value || can('initiative', 'manage').value
)
const canReset = can('mapControls', 'reset')
const canRevealFog = can('fog', 'reveal')
const canAddFog = can('fog', 'add')
const canAddMarker = can('markers', 'add')

// Show panel if any tools are available
const hasAnyTools = computed(() =>
  canDraw.value || canAccessInitiative.value || canReset.value
)

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
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.section-title {
  font-family: var(--font-heading);
  font-size: 0.875rem;
  color: var(--ink-black);
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.button-group {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.help-text {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.5rem;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
}

.help-line {
  font-family: var(--font-body);
  font-size: 0.75rem;
  color: var(--ink-faded);
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
