<template>
  <ParchmentContainer
    width="auto"
    padding="0.75rem"
    class="color-palette"
  >
    <div class="color-grid">
      <button
        v-for="color in colors"
        :key="color.value"
        class="color-button"
        :class="{ active: isActive(color.value) }"
        :style="{ backgroundColor: color.hex }"
        :title="color.label"
        @click="selectColor(color.value)"
      >
        <span v-if="isActive(color.value)" class="check-mark">✓</span>
      </button>
    </div>
  </ParchmentContainer>
</template>

<script setup>
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useRoomStore } from '@/stores/room'
import ParchmentContainer from '@/components/ui/ParchmentContainer.vue'

const uiStore = useUiStore()

const activeTool = computed(() => uiStore.activeTool)

const title = computed(() => {
  return activeTool.value === 'draw' ? 'Drawing Color' : 'Marker Color'
})

const currentColor = computed(() => {
  return uiStore.currentMarkerColor
})

const colors = [
  { value: 'red', label: 'Red', hex: '#e74c3c' },
  { value: 'blue', label: 'Blue', hex: '#3498db' },
  { value: 'green', label: 'Green', hex: '#27ae60' },
  { value: 'yellow', label: 'Yellow', hex: '#f39c12' },
  { value: 'purple', label: 'Purple', hex: '#9b59b6' },
  { value: 'orange', label: 'Orange', hex: '#e67e22' },
  { value: 'pink', label: 'Pink', hex: '#ff6b9d' },
  { value: 'cyan', label: 'Cyan', hex: '#1abc9c' }
]

function isActive(colorValue) {
  return currentColor.value === colorValue
}

function selectColor(colorValue) {
  uiStore.setMarkerColor(colorValue)
}
</script>

<style scoped>
.color-palette {
  display: inline-block;
}

.color-palette {
  box-sizing: border-box;
}

.color-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
}

.color-button {
  width: 40px;
  height: 40px;
  border: 2px solid var(--parchment-dark);
  border-radius: 50%;
  cursor: pointer;
  position: relative;
  transition: all 0.2s;
  box-shadow:
    0 2px 4px rgba(0, 0, 0, 0.2),
    inset 0 1px 2px rgba(255, 255, 255, 0.3);
  flex-shrink: 0;
}

.color-button:hover {
  transform: translateY(-2px);
  box-shadow:
    0 4px 8px rgba(0, 0, 0, 0.3),
    inset 0 1px 2px rgba(255, 255, 255, 0.3);
}

.color-button:active {
  transform: translateY(0);
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.2),
    inset 0 1px 2px rgba(0, 0, 0, 0.2);
}

.color-button.active {
  border-color: var(--accent-gold);
  border-width: 4px;
  box-shadow:
    0 0 0 2px var(--parchment-default),
    0 0 0 4px var(--accent-gold),
    0 4px 8px rgba(0, 0, 0, 0.3);
}

.check-mark {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-size: 1.5rem;
  font-weight: bold;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 768px) {
  .color-palette-overlay {
    bottom: auto;
    top: 50%;
    transform: translate(-50%, -50%);
  }

  .color-grid {
    grid-template-columns: repeat(4, 1fr);
    gap: 0.5rem;
  }

  .color-button {
    width: 50px;
    height: 50px;
  }
}
</style>
