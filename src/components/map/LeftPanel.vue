<template>
  <ParchmentContainer
    width="240px"
    padding="1rem"
    class="left-panel"
  >
    <div v-if="isOwner" class="button-group">
      <WaxSealButton
        :active="activeTool === 'draw'"
        icon="✎"
        color="red"
        size="medium"
        @click="toggleDrawTool"
      />
      <WaxSealButton
        icon="⚔"
        color="green"
        size="medium"
        @click="toggleInitiativeTracker"
      />
      <WaxSealButton
        icon="↻"
        color="red"
        size="medium"
        @click="handleReset"
      />
    </div>

    <!-- Help Text -->
    <div v-if="isOwner" class="help-text">
      <span v-if="activeTool === 'draw'" class="help-line">Drag: Draw Path</span>
      <template v-else>
        <span class="help-line">Click: Reveal Fog</span>
        <span class="help-line">Double-Click: Add Marker</span>
        <span class="help-line">Right-Click: Add Fog</span>
      </template>
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

const isOwner = computed(() => roomStore.isOwner)
const activeTool = computed(() => uiStore.activeTool)

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
