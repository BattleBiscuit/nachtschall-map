<template>
  <div
    class="parchment-container"
    :class="[positionClass, { floating, draggable }]"
    :style="computedStyle"
  >
    <!-- Stain overlay for aged parchment effect -->
    <div class="parchment-stain parchment-stain-1"></div>
    <div class="parchment-stain parchment-stain-2"></div>

    <!-- Content area -->
    <div class="parchment-content">
      <slot></slot>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useTornEdges } from '@/composables/useTheme'

const props = defineProps({
  floating: {
    type: Boolean,
    default: false
  },
  draggable: {
    type: Boolean,
    default: false
  },
  position: {
    type: String,
    default: 'center',
    validator: (value) => ['left', 'center', 'right', 'custom'].includes(value)
  },
  width: {
    type: String,
    default: 'auto'
  },
  maxWidth: {
    type: String,
    default: 'none'
  },
  maxHeight: {
    type: String,
    default: 'none'
  },
  padding: {
    type: String,
    default: '2rem'
  }
})

const { clipPath } = useTornEdges()

const positionClass = computed(() => {
  if (props.floating) {
    return `position-${props.position}`
  }
  return ''
})

const computedStyle = computed(() => ({
  width: props.width,
  maxWidth: props.maxWidth,
  maxHeight: props.maxHeight,
  clipPath: clipPath.value,
  cursor: props.draggable ? 'grab' : 'auto'
}))
</script>

<style scoped>
.parchment-container {
  position: relative;
  background: linear-gradient(
    135deg,
    var(--parchment-light) 0%,
    var(--parchment-default) 50%,
    var(--parchment-dark) 100%
  );
  /* Enhanced 2.5D table effect - paper lying on table */
  box-shadow:
    /* Main shadow on table */
    0 8px 24px rgba(0, 0, 0, 0.4),
    /* Soft outer glow */
    0 4px 12px rgba(0, 0, 0, 0.25),
    /* Contact shadow (paper touching table) */
    0 2px 4px rgba(0, 0, 0, 0.5),
    /* Slight lift from edges */
    inset 0 1px 0 rgba(255, 255, 255, 0.2),
    /* Bottom edge depth */
    inset 0 -2px 4px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  /* Paper thickness illusion */
  border-bottom: 1px solid rgba(0, 0, 0, 0.2);
  transform: translateZ(0);
  will-change: transform;
}

.parchment-container:not(.floating) {
  margin: 0 auto;
}

/* Floating containers (absolute positioned overlays) */
.parchment-container.floating {
  position: absolute;
  z-index: 100;
}

.parchment-container.position-left {
  left: 2rem;
  top: 2rem;
}

.parchment-container.position-center {
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
}

.parchment-container.position-right {
  right: 2rem;
  top: 2rem;
}

/* Aged parchment stain overlays */
.parchment-stain {
  position: absolute;
  pointer-events: none;
  border-radius: 50%;
  opacity: 0.15;
}

.parchment-stain-1 {
  top: 10%;
  right: 15%;
  width: 40%;
  height: 30%;
  background: radial-gradient(
    circle,
    rgba(139, 30, 30, 0.2) 0%,
    transparent 70%
  );
}

.parchment-stain-2 {
  bottom: 20%;
  left: 10%;
  width: 35%;
  height: 25%;
  background: radial-gradient(
    circle,
    rgba(26, 20, 16, 0.15) 0%,
    transparent 70%
  );
}

/* Content area */
.parchment-content {
  position: relative;
  z-index: 1;
  padding: v-bind(padding);
  overflow: auto;
  max-height: inherit;
}

/* Custom scrollbar for parchment */
.parchment-content::-webkit-scrollbar {
  width: 8px;
}

.parchment-content::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
}

.parchment-content::-webkit-scrollbar-thumb {
  background: var(--leather-dark);
  border-radius: 4px;
}

.parchment-content::-webkit-scrollbar-thumb:hover {
  background: var(--accent-red);
}

/* Draggable state */
.parchment-container.draggable:active {
  cursor: grabbing;
}

/* Responsive */
@media (max-width: 768px) {
  .parchment-container.floating {
    left: 1rem !important;
    right: 1rem !important;
    top: 1rem !important;
    transform: none !important;
    max-width: calc(100vw - 2rem);
  }

  .parchment-content {
    padding: 1.5rem;
  }
}

@media (max-width: 480px) {
  .parchment-content {
    padding: 1rem;
  }
}
</style>
