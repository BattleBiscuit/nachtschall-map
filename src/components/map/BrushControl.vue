<template>
  <Transition name="fade">
    <div v-if="visible" class="brush-control-overlay">
      <ParchmentContainer
        floating
        width="120px"
        padding="1rem"
        class="brush-control"
      >
        <div class="brush-header">
          <h3 class="brush-title">Brush</h3>
        </div>

        <div class="slider-container">
          <input
            type="range"
            :min="minRevealRadius"
            :max="maxRevealRadius"
            :value="revealRadius"
            class="brush-slider"
            orient="vertical"
            @input="updateRadius"
          />
          <div class="radius-display">{{ revealRadius }}px</div>
        </div>
      </ParchmentContainer>
    </div>
  </Transition>
</template>

<script setup>
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'
import ParchmentContainer from '@/components/ui/ParchmentContainer.vue'

const uiStore = useUiStore()

const visible = computed(() => uiStore.showBrushControl)
const revealRadius = computed(() => uiStore.revealRadius)
const minRevealRadius = computed(() => uiStore.minRevealRadius)
const maxRevealRadius = computed(() => uiStore.maxRevealRadius)

function updateRadius(event) {
  uiStore.setRevealRadius(parseInt(event.target.value))
}
</script>

<style scoped>
.brush-control-overlay {
  position: fixed;
  bottom: 10rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 200;
}

.brush-control {
  box-sizing: border-box;
}

.brush-header {
  text-align: center;
  margin-bottom: 1rem;
}

.brush-title {
  font-family: var(--font-heading);
  font-size: 1rem;
  color: var(--ink-black);
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.slider-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.brush-slider {
  -webkit-appearance: slider-vertical;
  writing-mode: bt-lr;
  width: 8px;
  height: 180px;
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
  font-size: 1rem;
  color: var(--ink-black);
  font-weight: bold;
  text-align: center;
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
  .brush-control-overlay {
    bottom: auto;
    top: 50%;
    right: 2rem;
    left: auto;
    transform: translateY(-50%);
  }

  .brush-slider {
    height: 150px;
  }
}
</style>
