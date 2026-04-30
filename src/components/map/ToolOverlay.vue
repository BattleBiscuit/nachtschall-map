<template>
  <ParchmentContainer
    width="auto"
    padding="1rem 1.5rem"
    class="toolbar"
  >
      <div class="tool-buttons">
        <!-- Drawing Tool Toggle -->
        <WaxSealButton
          :active="activeTool === 'draw'"
          icon="✎"
          label="Draw"
          color="red"
          size="medium"
          @click="toggleDrawTool"
        />

        <div class="divider"></div>

        <!-- Initiative Tracker -->
        <WaxSealButton
          icon="⚔"
          label="Initiative"
          color="green"
          size="medium"
          @click="toggleInitiativeTracker"
        />

        <div class="divider"></div>

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
  </ParchmentContainer>
</template>

<script setup>
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'
import ParchmentContainer from '@/components/ui/ParchmentContainer.vue'
import WaxSealButton from '@/components/ui/WaxSealButton.vue'

const uiStore = useUiStore()

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
</script>

<style scoped>
.toolbar {
  box-sizing: border-box;
}

.tool-buttons {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: stretch;
}

.divider {
  width: 100%;
  height: 2px;
  background: var(--parchment-dark);
  margin: 0.25rem 0;
}

.help-text {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.5rem;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
}

.help-line {
  font-family: var(--font-body);
  font-size: 0.75rem;
  color: var(--ink-faded);
  white-space: nowrap;
}

@media (max-width: 768px) {
  .tool-overlay {
    bottom: 1rem;
    left: 1rem;
    right: 1rem;
    transform: none;
  }

  .toolbar {
    width: 100%;
    padding: 1rem;
  }

  .tool-buttons {
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem;
  }

  .divider {
    display: none;
  }
}
</style>
