<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="open" class="dialog-overlay" @click="handleOverlayClick">
        <Transition name="slide-down">
          <ParchmentContainer
            v-if="open"
            floating
            position="center"
            :width="width"
            :max-width="maxWidth"
            class="dialog-container"
          >
            <div class="dialog-header">
              <h3 class="dialog-title">{{ title }}</h3>
              <button
                v-if="closable"
                class="dialog-close"
                @click="handleClose"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div class="dialog-body">
              <slot></slot>
            </div>

            <div v-if="$slots.actions" class="dialog-actions">
              <slot name="actions"></slot>
            </div>
            <div v-else class="dialog-actions">
              <WaxSealButton
                color="gray"
                size="small"
                icon="✕"
                label="Cancel"
                @click="handleCancel"
              />
              <WaxSealButton
                color="green"
                size="small"
                icon="✓"
                label="Confirm"
                @click="handleConfirm"
              />
            </div>
          </ParchmentContainer>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { watch } from 'vue'
import ParchmentContainer from './ParchmentContainer.vue'
import WaxSealButton from './WaxSealButton.vue'

const props = defineProps({
  open: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: ''
  },
  closable: {
    type: Boolean,
    default: true
  },
  closeOnOverlay: {
    type: Boolean,
    default: true
  },
  width: {
    type: String,
    default: '500px'
  },
  maxWidth: {
    type: String,
    default: '90vw'
  }
})

const emit = defineEmits(['confirm', 'cancel', 'close', 'update:open'])

function handleOverlayClick(event) {
  if (event.target === event.currentTarget && props.closeOnOverlay) {
    handleClose()
  }
}

function handleClose() {
  emit('close')
  emit('update:open', false)
}

function handleConfirm() {
  emit('confirm')
  if (props.closable) {
    handleClose()
  }
}

function handleCancel() {
  emit('cancel')
  handleClose()
}

// Prevent body scroll when dialog is open
watch(() => props.open, (isOpen) => {
  if (isOpen) {
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
})
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  /* Darker overlay - table dimming effect */
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  /* Stronger blur - depth of field effect */
  backdrop-filter: blur(4px);
}

.dialog-container {
  max-height: 85vh;
  /* Extra elevation for dialog - floating above table */
  transform: translateY(-20px);
}

.dialog-container :deep(.parchment-container) {
  /* Enhanced shadow for floating dialog */
  box-shadow:
    /* Strong drop shadow (high elevation) */
    0 20px 60px rgba(0, 0, 0, 0.6),
    0 10px 30px rgba(0, 0, 0, 0.4),
    0 5px 15px rgba(0, 0, 0, 0.3),
    /* Paper depth */
    inset 0 1px 0 rgba(255, 255, 255, 0.2),
    inset 0 -2px 4px rgba(0, 0, 0, 0.1);
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid var(--parchment-dark);
}

.dialog-title {
  font-family: var(--font-heading);
  font-size: 1.5rem;
  color: var(--ink-black);
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.dialog-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--ink-faded);
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  line-height: 1;
  transition: color 0.2s, transform 0.2s;
}

.dialog-close:hover {
  color: var(--accent-red);
  transform: scale(1.1);
}

.dialog-body {
  margin-bottom: 1.5rem;
  color: var(--ink-black);
  font-family: var(--font-body);
  line-height: 1.6;
}

.dialog-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  padding-top: 1rem;
  border-top: 2px solid var(--parchment-dark);
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}

.slide-down-enter-from {
  opacity: 0;
  transform: translate(-50%, calc(-50% - 20px));
}

.slide-down-leave-to {
  opacity: 0;
  transform: translate(-50%, calc(-50% + 20px));
}

/* Responsive */
@media (max-width: 768px) {
  .dialog-title {
    font-size: 1.25rem;
  }

  .dialog-actions {
    flex-direction: column;
  }
}
</style>
