<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="open" class="dialog-overlay" @click="handleOverlayClick">
        <ParchmentContainer floating width="400px" padding="1.5rem">
          <h3 class="dialog-title">Edit Marker Name</h3>
          <div class="dialog-body">
            <FormGroup
              label="Marker Name"
              v-model="localName"
              type="text"
              placeholder="Enter marker name..."
              :maxlength="20"
              @keyup.enter="handleConfirm"
              @keyup.esc="handleCancel"
            />
          </div>
          <div class="dialog-actions">
            <WaxSealButton @click="handleRemove" color="red" size="small" icon="✕">
              Remove
            </WaxSealButton>
            <div class="spacer"></div>
            <WaxSealButton @click="handleCancel" color="gray" size="small">
              Cancel
            </WaxSealButton>
            <WaxSealButton @click="handleConfirm" color="green" size="small">
              Save
            </WaxSealButton>
          </div>
        </ParchmentContainer>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import ParchmentContainer from '@/components/ui/ParchmentContainer.vue'
import WaxSealButton from '@/components/ui/WaxSealButton.vue'
import FormGroup from '@/components/ui/FormGroup.vue'

const props = defineProps({
  open: Boolean,
  markerName: String
})

const emit = defineEmits(['confirm', 'cancel', 'remove'])

const localName = ref('')

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    localName.value = props.markerName || ''
    nextTick(() => {
      // Focus the input inside FormGroup
      const input = document.querySelector('.dialog-overlay .form-input')
      if (input) {
        input.focus()
        input.select()
      }
    })
  }
})

function handleOverlayClick(e) {
  if (e.target === e.currentTarget) {
    handleCancel()
  }
}

function handleConfirm() {
  emit('confirm', localName.value)
}

function handleCancel() {
  emit('cancel')
}

function handleRemove() {
  if (confirm('Delete this marker?')) {
    emit('remove')
  }
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog-title {
  font-family: var(--font-heading);
  font-size: 1.25rem;
  color: var(--ink-black);
  margin: 0 0 1rem 0;
  text-align: center;
}

.dialog-body {
  margin-bottom: 1.5rem;
}

.name-input {
  width: 100%;
  padding: 0.5rem;
  font-family: var(--font-body);
  font-size: 1rem;
  background: rgba(255, 255, 255, 0.9);
  border: 2px solid var(--parchment-dark);
  border-radius: 4px;
  color: var(--ink-black);
}

.name-input:focus {
  outline: none;
  border-color: var(--accent-gold);
  box-shadow: 0 0 0 2px rgba(201, 169, 97, 0.2);
}

.dialog-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  align-items: center;
}

.spacer {
  flex: 1;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
