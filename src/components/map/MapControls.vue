<template>
  <ParchmentContainer
    width="240px"
    padding="1rem"
    class="map-controls"
  >
    <!-- Color Palette -->
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

    <!-- Divider -->
    <div class="divider"></div>

    <!-- Brush Size Control -->
    <div class="brush-container">
      <input
        type="range"
        :min="minRevealRadius"
        :max="maxRevealRadius"
        :value="revealRadius"
        class="brush-slider"
        @input="updateRadius"
      />
      <div class="radius-display">{{ revealRadius }}</div>
    </div>
  </ParchmentContainer>
</template>

<script setup>
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'
import ParchmentContainer from '@/components/ui/ParchmentContainer.vue'

const uiStore = useUiStore()

const currentColor = computed(() => uiStore.currentMarkerColor)
const revealRadius = computed(() => uiStore.revealRadius)
const minRevealRadius = computed(() => uiStore.minRevealRadius)
const maxRevealRadius = computed(() => uiStore.maxRevealRadius)

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

function updateRadius(event) {
  uiStore.setRevealRadius(parseInt(event.target.value))
}
</script>

<style scoped>
.map-controls {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.color-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
  justify-items: center;
}

/* Paint splotch style */
.color-button {
  width: 36px;
  height: 36px;
  border: none;
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease-out;
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.15),
    inset 0 1px 3px rgba(255, 255, 255, 0.3),
    inset 0 -1px 4px rgba(0, 0, 0, 0.15);
  filter: saturate(1.1) brightness(1.05);
}

/* Each button gets unique irregular shape */
.color-button:nth-child(1) { border-radius: 52% 48% 47% 53% / 49% 55% 45% 51%; }
.color-button:nth-child(2) { border-radius: 46% 54% 51% 49% / 53% 47% 53% 47%; }
.color-button:nth-child(3) { border-radius: 51% 49% 48% 52% / 47% 52% 48% 53%; }
.color-button:nth-child(4) { border-radius: 49% 51% 54% 46% / 51% 49% 51% 49%; }
.color-button:nth-child(5) { border-radius: 53% 47% 49% 51% / 48% 53% 47% 52%; }
.color-button:nth-child(6) { border-radius: 48% 52% 52% 48% / 54% 46% 54% 46%; }
.color-button:nth-child(7) { border-radius: 50% 50% 46% 54% / 52% 48% 52% 48%; }
.color-button:nth-child(8) { border-radius: 47% 53% 53% 47% / 50% 51% 49% 50%; }

.color-button:hover {
  transform: scale(1.08);
  filter: saturate(1.2) brightness(1.1);
  box-shadow:
    0 3px 12px rgba(0, 0, 0, 0.25),
    inset 0 1px 3px rgba(255, 255, 255, 0.4),
    inset 0 -1px 4px rgba(0, 0, 0, 0.2);
}

.color-button:active {
  transform: scale(1.02);
  filter: saturate(1.3) brightness(0.95);
}

/* Active paint splotch - ink circle drawn around it */
.color-button.active {
  box-shadow:
    0 0 0 3px var(--parchment-default),
    0 0 0 5px var(--ink-black),
    0 3px 12px rgba(0, 0, 0, 0.3),
    inset 0 1px 3px rgba(255, 255, 255, 0.4);
  transform: scale(1.05);
}

.check-mark {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 1.5rem;
  color: white;
  font-weight: bold;
  text-shadow:
    0 1px 2px rgba(0, 0, 0, 0.8),
    0 0 4px rgba(0, 0, 0, 0.5);
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.3));
}

/* Subtle ink separator line */
.divider {
  width: 100%;
  height: 1px;
  background: radial-gradient(
    ellipse at center,
    var(--ink-faded),
    transparent
  );
  margin: 0.5rem 0;
  opacity: 0.3;
}

/* Wooden lever track */
.brush-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem;
}

.brush-slider {
  -webkit-appearance: none;
  appearance: none;
  flex: 1;
  height: 8px;
  background: repeating-linear-gradient(
    90deg,
    #5d4a3a 0px,
    #6b5647 2px,
    #4a3a2d 4px
  );
  border: none;
  border-radius: 4px;
  outline: none;
  cursor: pointer;
  box-shadow:
    inset 0 2px 4px rgba(0, 0, 0, 0.4),
    inset 0 -1px 2px rgba(255, 255, 255, 0.1),
    0 1px 2px rgba(0, 0, 0, 0.2);
  position: relative;
}

/* Wooden lever knob */
.brush-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 32px;
  background: linear-gradient(
    135deg,
    #8b7355 0%,
    #6b5647 30%,
    #5d4a3a 50%,
    #6b5647 70%,
    #8b7355 100%
  );
  border: none;
  border-radius: 3px 3px 2px 2px;
  cursor: grab;
  box-shadow:
    0 3px 8px rgba(0, 0, 0, 0.4),
    inset 1px 0 2px rgba(255, 255, 255, 0.2),
    inset -1px 0 2px rgba(0, 0, 0, 0.3),
    inset 0 -2px 4px rgba(0, 0, 0, 0.3);
  transition: all 0.15s ease-out;
}

.brush-slider::-webkit-slider-thumb:hover {
  transform: translateY(-2px);
  box-shadow:
    0 4px 10px rgba(0, 0, 0, 0.5),
    inset 1px 0 2px rgba(255, 255, 255, 0.2),
    inset -1px 0 2px rgba(0, 0, 0, 0.3),
    inset 0 -2px 4px rgba(0, 0, 0, 0.3);
}

.brush-slider::-webkit-slider-thumb:active {
  transform: translateY(0);
  cursor: grabbing;
  box-shadow:
    0 2px 4px rgba(0, 0, 0, 0.4),
    inset 0 2px 4px rgba(0, 0, 0, 0.4);
}

.brush-slider::-moz-range-thumb {
  width: 20px;
  height: 32px;
  background: linear-gradient(
    135deg,
    #8b7355 0%,
    #6b5647 30%,
    #5d4a3a 50%,
    #6b5647 70%,
    #8b7355 100%
  );
  border: none;
  border-radius: 3px 3px 2px 2px;
  cursor: grab;
  box-shadow:
    0 3px 8px rgba(0, 0, 0, 0.4),
    inset 1px 0 2px rgba(255, 255, 255, 0.2),
    inset -1px 0 2px rgba(0, 0, 0, 0.3),
    inset 0 -2px 4px rgba(0, 0, 0, 0.3);
  transition: all 0.15s ease-out;
}

.brush-slider::-moz-range-thumb:hover {
  transform: translateY(-2px);
  box-shadow:
    0 4px 10px rgba(0, 0, 0, 0.5),
    inset 1px 0 2px rgba(255, 255, 255, 0.2),
    inset -1px 0 2px rgba(0, 0, 0, 0.3),
    inset 0 -2px 4px rgba(0, 0, 0, 0.3);
}

.brush-slider::-moz-range-thumb:active {
  transform: translateY(0);
  cursor: grabbing;
  box-shadow:
    0 2px 4px rgba(0, 0, 0, 0.4),
    inset 0 2px 4px rgba(0, 0, 0, 0.4);
}

/* Hand-written number */
.radius-display {
  font-family: var(--font-heading);
  font-size: 1.25rem;
  color: var(--ink-black);
  font-weight: normal;
  min-width: 36px;
  text-align: center;
  opacity: 0.8;
}
</style>
