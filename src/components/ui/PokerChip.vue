<template>
  <div
    class="poker-chip"
    :class="[sizeClass, colorClass, { worn }]"
    :style="chipStyle"
  >
    <!-- Outer ring with edge spots (worn effect) -->
    <svg class="chip-edge" viewBox="0 0 100 100">
      <circle
        cx="50"
        cy="50"
        r="48"
        fill="none"
        :stroke="edgeColor"
        stroke-width="4"
        stroke-dasharray="8 4"
        opacity="0.8"
      />
    </svg>

    <!-- Inner face with worn texture -->
    <div class="chip-face">
      <!-- Scuff marks and wear -->
      <div class="wear-overlay"></div>

      <!-- Center ring -->
      <div class="center-ring">
        <slot name="icon">
          <span v-if="label" class="chip-label">{{ label }}</span>
        </slot>
      </div>

      <!-- Edge notches (poker chip style) -->
      <div class="notch notch-1"></div>
      <div class="notch notch-2"></div>
      <div class="notch notch-3"></div>
      <div class="notch notch-4"></div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useMarkerColors } from '@/composables/useTheme'

const props = defineProps({
  color: {
    type: String,
    default: 'blue',
    validator: (value) => ['blue', 'red', 'green', 'yellow', 'purple', 'orange', 'cyan', 'pink'].includes(value)
  },
  size: {
    type: String,
    default: 'medium',
    validator: (value) => ['small', 'medium', 'large'].includes(value)
  },
  label: {
    type: String,
    default: ''
  },
  worn: {
    type: Boolean,
    default: true
  }
})

const colors = useMarkerColors()
const sizeClass = computed(() => `size-${props.size}`)
const colorClass = computed(() => `color-${props.color}`)
const edgeColor = computed(() => colors[props.color].border)

const chipStyle = computed(() => ({
  '--chip-fill': colors[props.color].fill,
  '--chip-border': colors[props.color].border,
  '--chip-stroke': colors[props.color].stroke,
  '--chip-ornament': colors[props.color].ornament
}))
</script>

<style scoped>
.poker-chip {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  /* Slightly irregular shape for worn effect */
  border-radius: 48% 52% 49% 51% / 51% 49% 51% 49%;
}

.chip-edge {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  pointer-events: none;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
  /* Faded edge spots from wear */
  opacity: 0.6;
}

.chip-face {
  position: relative;
  width: 100%;
  height: 100%;
  background: radial-gradient(
    circle at 35% 35%,
    var(--chip-ornament),
    var(--chip-fill) 40%,
    var(--chip-border)
  );
  border-radius: inherit;
  /* Enhanced 2.5D chip on table effect */
  box-shadow:
    /* Chip depth (inset bevels) */
    inset 0 2px 8px rgba(0, 0, 0, 0.4),
    inset 0 -2px 6px rgba(255, 255, 255, 0.15),
    inset 2px 2px 4px rgba(0, 0, 0, 0.3),
    inset -2px -2px 4px rgba(0, 0, 0, 0.2),
    /* Drop shadow on table */
    0 4px 12px rgba(0, 0, 0, 0.4),
    0 2px 6px rgba(0, 0, 0, 0.3),
    /* Contact shadow */
    0 1px 2px rgba(0, 0, 0, 0.5);
  border: 2px solid var(--chip-stroke);
  /* Overall darkening for used look */
  filter: brightness(0.85) contrast(1.1);
  transition: box-shadow 0.2s ease;
}

/* Worn texture overlay - heavy use and damage */
.wear-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: inherit;
  background:
    /* Large scuff on top-left */
    radial-gradient(ellipse at 20% 25%, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.2) 30%, transparent 55%),
    /* Scratch on right side */
    linear-gradient(85deg, transparent 65%, rgba(0, 0, 0, 0.25) 70%, transparent 75%),
    /* Bottom wear from table contact */
    radial-gradient(ellipse at 50% 85%, rgba(0, 0, 0, 0.35) 0%, rgba(0, 0, 0, 0.15) 40%, transparent 60%),
    /* Edge damage top-right */
    radial-gradient(circle at 80% 15%, rgba(0, 0, 0, 0.3) 0%, transparent 35%),
    /* Faded spot center-left */
    radial-gradient(circle at 30% 50%, rgba(255, 255, 255, 0.15) 0%, transparent 40%),
    /* General dirt and grime */
    radial-gradient(circle at 60% 40%, rgba(0, 0, 0, 0.08) 0%, transparent 70%),
    radial-gradient(circle at 15% 70%, rgba(0, 0, 0, 0.12) 0%, transparent 50%),
    /* Highlight wear on top edge */
    radial-gradient(ellipse at 45% 10%, rgba(255, 255, 255, 0.2) 0%, transparent 45%);
  pointer-events: none;
  mix-blend-mode: multiply;
}

.poker-chip.worn .wear-overlay {
  opacity: 1;
}

.poker-chip:not(.worn) .wear-overlay {
  opacity: 0.4;
}

/* Center ring - faded and worn */
.center-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(
    circle,
    rgba(255, 255, 255, 0.2) 0%,
    rgba(255, 255, 255, 0.05) 50%,
    transparent 100%
  );
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.25);
  box-shadow:
    inset 0 1px 3px rgba(255, 255, 255, 0.3),
    inset 0 -1px 3px rgba(0, 0, 0, 0.4),
    /* Scratches on the ring */
    inset 1px 0 0 rgba(0, 0, 0, 0.3),
    inset -1px 0 0 rgba(0, 0, 0, 0.2);
  /* Faded from use */
  opacity: 0.8;
}

.chip-label {
  font-family: var(--font-heading);
  font-weight: bold;
  color: rgba(255, 255, 255, 0.95);
  text-shadow:
    0 1px 2px rgba(0, 0, 0, 0.8),
    0 0 4px rgba(0, 0, 0, 0.5);
  letter-spacing: 0.05em;
}

/* Edge notches (poker chip segments) - chipped and damaged */
.notch {
  position: absolute;
  background: var(--chip-stroke);
  opacity: 0.5;
  box-shadow:
    inset 0 1px 2px rgba(0, 0, 0, 0.5),
    0 1px 1px rgba(255, 255, 255, 0.1);
  /* Chips and damage on edges */
  filter: brightness(0.7);
}

.notch-1 {
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 20%;
  height: 8%;
  border-radius: 0 0 50% 50%;
}

.notch-2 {
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 20%;
  height: 8%;
  border-radius: 50% 50% 0 0;
}

.notch-3 {
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 8%;
  height: 20%;
  border-radius: 0 50% 50% 0;
}

.notch-4 {
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 8%;
  height: 20%;
  border-radius: 50% 0 0 50%;
}

/* Size variants */
.size-small {
  width: 32px;
  height: 32px;
}

.size-small .center-ring {
  width: 18px;
  height: 18px;
}

.size-small .chip-label {
  font-size: 0.65rem;
}

.size-medium {
  width: 48px;
  height: 48px;
}

.size-medium .center-ring {
  width: 28px;
  height: 28px;
}

.size-medium .chip-label {
  font-size: 0.875rem;
}

.size-large {
  width: 64px;
  height: 64px;
}

.size-large .center-ring {
  width: 38px;
  height: 38px;
}

.size-large .chip-label {
  font-size: 1rem;
}

/* Interaction states */
.poker-chip {
  transition: all 0.2s ease;
  transform: translateZ(0);
  will-change: transform;
  cursor: pointer;
}

.poker-chip:hover {
  /* Lift chip off table */
  transform: translateY(-4px) translateZ(0);
  filter: brightness(0.95);
}

.poker-chip:hover .chip-face {
  /* Enhanced shadow when lifted */
  box-shadow:
    inset 0 2px 8px rgba(0, 0, 0, 0.4),
    inset 0 -2px 6px rgba(255, 255, 255, 0.15),
    inset 2px 2px 4px rgba(0, 0, 0, 0.3),
    inset -2px -2px 4px rgba(0, 0, 0, 0.2),
    /* Stronger drop shadow when elevated */
    0 8px 16px rgba(0, 0, 0, 0.5),
    0 4px 8px rgba(0, 0, 0, 0.3);
}

.poker-chip:active {
  /* Press chip into table */
  transform: translateY(-1px) translateZ(0);
  filter: brightness(0.85);
}

.poker-chip:active .chip-face {
  /* Reduced shadow when pressed */
  box-shadow:
    inset 0 2px 8px rgba(0, 0, 0, 0.4),
    inset 0 -2px 6px rgba(255, 255, 255, 0.15),
    inset 2px 2px 4px rgba(0, 0, 0, 0.3),
    inset -2px -2px 4px rgba(0, 0, 0, 0.2),
    0 2px 4px rgba(0, 0, 0, 0.3);
}
</style>
