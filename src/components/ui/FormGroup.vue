<template>
  <div class="form-group" :class="{ error: !!error, disabled }">
    <label v-if="label" :for="inputId" class="form-label">
      {{ label }}
      <span v-if="required" class="required-mark">*</span>
    </label>

    <!-- Text Input -->
    <input
      v-if="type === 'text' || type === 'password'"
      :id="inputId"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :maxlength="maxlength"
      class="form-input"
      @input="handleInput"
      @blur="handleBlur"
      @focus="handleFocus"
    />

    <!-- Select Dropdown -->
    <select
      v-else-if="type === 'select'"
      :id="inputId"
      :value="modelValue"
      :disabled="disabled"
      class="form-select"
      @change="handleChange"
      @blur="handleBlur"
      @focus="handleFocus"
    >
      <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
      <option
        v-for="option in options"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </option>
    </select>

    <!-- Checkbox -->
    <label
      v-else-if="type === 'checkbox'"
      class="form-checkbox-label"
    >
      <input
        :id="inputId"
        type="checkbox"
        :checked="modelValue"
        :disabled="disabled"
        class="form-checkbox"
        @change="handleCheckboxChange"
      />
      <span class="checkbox-text">{{ checkboxLabel }}</span>
    </label>

    <!-- Error message -->
    <span v-if="error" class="error-message">{{ error }}</span>

    <!-- Helper text -->
    <span v-else-if="helperText" class="helper-text">{{ helperText }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: {
    type: [String, Boolean, Number],
    default: ''
  },
  type: {
    type: String,
    default: 'text',
    validator: (value) => ['text', 'password', 'select', 'checkbox'].includes(value)
  },
  label: {
    type: String,
    default: ''
  },
  checkboxLabel: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: ''
  },
  error: {
    type: String,
    default: ''
  },
  helperText: {
    type: String,
    default: ''
  },
  disabled: {
    type: Boolean,
    default: false
  },
  required: {
    type: Boolean,
    default: false
  },
  maxlength: {
    type: Number,
    default: null
  },
  options: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:modelValue', 'blur', 'focus'])

const inputId = computed(() => `form-input-${Math.random().toString(36).slice(2, 9)}`)

function handleInput(event) {
  emit('update:modelValue', event.target.value)
}

function handleChange(event) {
  emit('update:modelValue', event.target.value)
}

function handleCheckboxChange(event) {
  emit('update:modelValue', event.target.checked)
}

function handleBlur(event) {
  emit('blur', event)
}

function handleFocus(event) {
  emit('focus', event)
}
</script>

<style scoped>
.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.form-label {
  font-family: var(--font-heading);
  font-size: 0.875rem;
  color: var(--ink-black);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
}

.required-mark {
  color: var(--accent-red);
  margin-left: 0.25rem;
}

.form-input,
.form-select {
  padding: 0.75rem 1rem;
  background: var(--parchment-light);
  border: 2px solid var(--parchment-dark);
  border-radius: 4px;
  font-family: var(--font-body);
  font-size: 1rem;
  color: var(--ink-black);
  transition: all 0.2s ease;
  /* 2.5D inset effect - input pressed into parchment */
  box-shadow:
    inset 0 2px 4px rgba(0, 0, 0, 0.15),
    inset 0 -1px 2px rgba(255, 255, 255, 0.3),
    0 1px 2px rgba(255, 255, 255, 0.5);
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: var(--accent-gold);
  /* Enhanced depth on focus */
  box-shadow:
    inset 0 2px 6px rgba(0, 0, 0, 0.2),
    inset 0 -1px 2px rgba(255, 255, 255, 0.3),
    0 0 0 3px rgba(201, 169, 97, 0.3),
    0 2px 8px rgba(201, 169, 97, 0.4);
  transform: translateY(-1px);
}

.form-input::placeholder {
  color: var(--ink-faded);
  opacity: 0.6;
}

.form-select {
  cursor: pointer;
}

/* Checkbox styling */
.form-checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  user-select: none;
}

.form-checkbox {
  width: 1.25rem;
  height: 1.25rem;
  cursor: pointer;
  accent-color: var(--accent-red);
}

.checkbox-text {
  font-family: var(--font-body);
  color: var(--ink-black);
}

/* Error state */
.form-group.error .form-input,
.form-group.error .form-select {
  border-color: var(--accent-red);
}

.error-message {
  font-family: var(--font-body);
  font-size: 0.875rem;
  color: var(--accent-red);
  font-style: italic;
}

/* Helper text */
.helper-text {
  font-family: var(--font-body);
  font-size: 0.875rem;
  color: var(--ink-faded);
  font-style: italic;
}

/* Disabled state */
.form-group.disabled .form-input,
.form-group.disabled .form-select,
.form-group.disabled .form-checkbox-label {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Responsive */
@media (max-width: 480px) {
  .form-input,
  .form-select {
    padding: 0.625rem 0.875rem;
    font-size: 0.9375rem;
  }
}
</style>
