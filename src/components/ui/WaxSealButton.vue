<template>
  <button
    class="wax-seal-button"
    :class="[sizeClass, colorClass, { active, disabled }]"
    :disabled="disabled"
    @click="handleClick"
  >
    <span class="seal-face">
      <span class="seal-ring"></span>
      <span class="seal-icon">
        <slot name="icon">{{ icon }}</slot>
      </span>
    </span>
    <span v-if="label" class="seal-label">{{ label }}</span>
  </button>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  icon: {
    type: String,
    default: ''
  },
  label: {
    type: String,
    default: ''
  },
  active: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  },
  size: {
    type: String,
    default: 'medium',
    validator: (value) => ['small', 'medium', 'large'].includes(value)
  },
  color: {
    type: String,
    default: 'red',
    validator: (value) => ['red', 'green', 'blue', 'gold', 'gray'].includes(value)
  }
})

const emit = defineEmits(['click'])

const sizeClass = computed(() => `size-${props.size}`)
const colorClass = computed(() => `color-${props.color}`)

// Generate random irregular border-radius for each button instance
function generateRandomBorderRadius() {
  // Random values for horizontal radii (40-58%)
  const tl = Math.floor(Math.random() * 18) + 40 // 40-58%
  const tr = 100 - tl + Math.floor(Math.random() * 12) - 6 // Opposite + variance
  const br = Math.floor(Math.random() * 18) + 40 // 40-58%
  const bl = 100 - br + Math.floor(Math.random() * 12) - 6 // Opposite + variance

  // Random values for vertical radii (42-58%)
  const tlv = Math.floor(Math.random() * 16) + 42 // 42-58%
  const trv = 100 - tlv + Math.floor(Math.random() * 10) - 5 // Opposite + variance
  const brv = Math.floor(Math.random() * 16) + 42 // 42-58%
  const blv = 100 - brv + Math.floor(Math.random() * 10) - 5 // Opposite + variance

  return `${tl}% ${tr}% ${br}% ${bl}% / ${tlv}% ${trv}% ${brv}% ${blv}%`
}

const randomBorderRadius = computed(() => generateRandomBorderRadius())

function handleClick(event) {
  if (!props.disabled) {
    emit('click', event)
  }
}
</script>

<style scoped>
.wax-seal-button {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  background: none;
  border: none;
  padding: 0;
  transition: transform 0.2s ease, filter 0.15s ease, box-shadow 0.2s ease;
  transform: translateZ(0);
  will-change: transform;
}

.wax-seal-button:not(:disabled):hover {
  /* Lift off table on hover */
  transform: translateY(-3px) scale(1.02);
  filter: brightness(1.1);
}

.wax-seal-button:not(:disabled):hover .seal-face {
  /* Enhanced shadow when lifted */
  box-shadow:
    /* Stronger drop shadow when elevated */
    0 8px 20px rgba(0, 0, 0, 0.5),
    0 4px 10px rgba(0, 0, 0, 0.3),
    /* Wax depth */
    inset 0 -2px 8px rgba(0, 0, 0, 0.3),
    inset 2px 2px 6px rgba(255, 255, 255, 0.15),
    inset -2px -3px 8px rgba(0, 0, 0, 0.2);
}

.wax-seal-button:not(:disabled):active {
  /* Press into table */
  transform: translateY(1px) scale(0.98);
}

.wax-seal-button:not(:disabled):active .seal-face {
  /* Reduced shadow when pressed */
  box-shadow:
    0 2px 6px rgba(0, 0, 0, 0.4),
    inset 0 -2px 8px rgba(0, 0, 0, 0.4),
    inset 2px 2px 6px rgba(255, 255, 255, 0.15),
    inset -2px -3px 8px rgba(0, 0, 0, 0.2);
}

.wax-seal-button.active .seal-face {
  /* Golden glow for active state */
  box-shadow:
    0 0 0 3px var(--accent-gold),
    0 0 20px rgba(201, 169, 97, 0.6),
    0 6px 16px rgba(0, 0, 0, 0.45),
    0 3px 8px rgba(0, 0, 0, 0.3),
    0 1px 3px rgba(0, 0, 0, 0.5);
}

/* Seal face - the main wax seal */
.seal-face {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
  /* Radial gradient - bright highlight in center, darker at edges */
  background: radial-gradient(
    circle at 40% 38%,
    var(--seal-light) 0%,
    var(--seal-light) 15%,
    var(--seal-base) 50%,
    var(--seal-dark) 100%
  );
  /* Drop shadows for table effect + center depression */
  box-shadow:
    /* Drop shadows on table */
    0 6px 16px rgba(0, 0, 0, 0.45),
    0 3px 8px rgba(0, 0, 0, 0.3),
    0 1px 3px rgba(0, 0, 0, 0.5),
    /* Center stamped area - subtle darkening */
    inset 0 0 20px rgba(0, 0, 0, 0.2);

  /* Random irregular border-radius for melted wax effect */
  border-radius: v-bind(randomBorderRadius);
  transition: box-shadow 0.2s ease;
}

/* Stamped inner circle - ring outline only, not filled */
.seal-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  z-index: 2;
  /* Just a ring, no background - shows wax beneath */
  background: transparent;
  /* Create depth with shadows only */
  box-shadow:
    /* Outer edge - darker ring */
    0 0 0 1px rgba(0, 0, 0, 0.4),
    /* Inner shadow - stamped depression */
    inset 0 2px 6px rgba(0, 0, 0, 0.5),
    inset 0 1px 3px rgba(0, 0, 0, 0.6),
    /* Bottom highlight - light catching lip */
    inset 0 -1px 1px rgba(255, 255, 255, 0.15);
}

/* Icon container - embossed into the wax */
.seal-icon {
  position: relative;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  /* Icon color with good contrast */
  color: var(--seal-icon-color);
  /* Stamped/pressed effect - dark shadows */
  text-shadow:
    /* Main depth shadow */
    0 2px 4px rgba(0, 0, 0, 0.7),
    /* Stronger contact shadow */
    0 1px 2px rgba(0, 0, 0, 0.8),
    /* Edge definition */
    1px 1px 1px rgba(0, 0, 0, 0.5),
    /* Slight top highlight */
    0 -1px 0 rgba(255, 255, 255, 0.1);
  font-family: var(--font-display);
  font-weight: bold;
  opacity: 0.95;
}

/* Label below seal */
.seal-label {
  font-family: var(--font-heading);
  font-size: 0.75rem;
  color: var(--parchment-light);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  white-space: nowrap;
}

/* Size variants */
.size-small .seal-face {
  width: 42px;
  height: 38px;
  /* Random border-radius applied via v-bind */
}

.size-small .seal-ring {
  width: 26px;
  height: 26px;
}

.size-small .seal-icon {
  font-size: 0.9rem;
}

.size-small .seal-label {
  font-size: 0.65rem;
}

.size-medium .seal-face {
  width: 64px;
  height: 58px;
  /* Random border-radius applied via v-bind */
}

.size-medium .seal-ring {
  width: 42px;
  height: 42px;
}

.size-medium .seal-icon {
  font-size: 1.4rem;
}

.size-large .seal-face {
  width: 84px;
  height: 76px;
  /* Random border-radius applied via v-bind */
}

.size-large .seal-ring {
  width: 58px;
  height: 58px;
}

.size-large .seal-icon {
  font-size: 1.9rem;
}

/* Color variants */
.color-red {
  --seal-base: #8b1e1e;
  --seal-light: #b84444;
  --seal-dark: #5a1212;
  --seal-icon-color: #f4e8d0;
}

.color-green {
  --seal-base: #2d5016;
  --seal-light: #4a7a2a;
  --seal-dark: #1a3010;
  --seal-icon-color: #f4e8d0;
}

.color-blue {
  --seal-base: #2c4c7e;
  --seal-light: #4a6db0;
  --seal-dark: #1a2d4a;
  --seal-icon-color: #f4e8d0;
}

.color-gold {
  --seal-base: #c9a961;
  --seal-light: #e5c889;
  --seal-dark: #9d7d3d;
  --seal-icon-color: #1a1410;
}

.color-gray {
  --seal-base: #5a5552;
  --seal-light: #7d7772;
  --seal-dark: #3a3532;
  --seal-icon-color: #f4e8d0;
}

/* Disabled state */
.wax-seal-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.wax-seal-button:disabled .seal-face {
  filter: grayscale(0.5);
}
</style>
