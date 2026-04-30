<template>
  <ParchmentContainer
    width="auto"
    padding="0.75rem"
    class="brush-control"
  >
    <div class="slider-container">
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

const revealRadius = computed(() => uiStore.revealRadius)
const minRevealRadius = computed(() => uiStore.minRevealRadius)
const maxRevealRadius = computed(() => uiStore.maxRevealRadius)

function updateRadius(event) {
  uiStore.setRevealRadius(parseInt(event.target.value))
}
</script>

<style scoped>
.brush-control {
  display: inline-block;
  box-sizing: border-box;
}

.slider-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.brush-slider {
  -webkit-appearance: slider-vertical;
  writing-mode: bt-lr;
  width: 6px;
  height: 120px;
  background: linear-gradient(
    to bottom,
    var(--parchment-dark),
    var(--parchment-light)
  );
  border: 2px solid var(--parchment-dark);
  border-radius: 4px;
  outline: none;
  cursor: pointer;
}

.brush-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  background: radial-gradient(
    circle at 30% 30%,
    var(--accent-gold),
    color-mix(in srgb, var(--accent-gold) 70%, black)
  );
  border: 2px solid var(--ink-black);
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  transition: transform 0.1s;
}

.brush-slider::-webkit-slider-thumb:hover {
  transform: scale(1.1);
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.4);
}

.brush-slider::-webkit-slider-thumb:active {
  transform: scale(0.95);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.brush-slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  background: radial-gradient(
    circle at 30% 30%,
    var(--accent-gold),
    color-mix(in srgb, var(--accent-gold) 70%, black)
  );
  border: 2px solid var(--ink-black);
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  transition: transform 0.1s;
}

.brush-slider::-moz-range-thumb:hover {
  transform: scale(1.1);
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.4);
}

.brush-slider::-moz-range-thumb:active {
  transform: scale(0.95);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.radius-display {
  font-family: var(--font-heading);
  font-size: 0.875rem;
  color: var(--ink-black);
  font-weight: bold;
  text-align: center;
}
</style>
