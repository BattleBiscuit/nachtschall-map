<template>
  <div class="lobby-view">
    <ParchmentContainer width="600px" max-width="90vw" padding="3rem">
      <h1 class="title">Nachtschall Map</h1>
      <p class="subtitle">Fog of War - Tabletop RPG Map Viewer</p>

      <!-- Tab Selector -->
      <div class="tabs">
        <WaxSealButton
          :active="activeTab === 'join'"
          icon="🚪"
          label="Join Room"
          color="blue"
          size="medium"
          @click="activeTab = 'join'"
        />
        <WaxSealButton
          :active="activeTab === 'create'"
          icon="🗺"
          label="Create Room"
          color="red"
          size="medium"
          @click="activeTab = 'create'"
        />
      </div>

      <!-- Join Room Tab -->
      <div v-if="activeTab === 'join'" class="tab-content">
        <form @submit.prevent="handleJoinRoom">
          <FormGroup
            v-model="joinRoomCode"
            label="Room Code"
            placeholder="Enter 6-character code"
            :maxlength="6"
            :error="joinError"
            helper-text="Example: AB3X9K"
            @input="joinRoomCode = joinRoomCode.toUpperCase()"
          />

          <div class="form-actions">
            <WaxSealButton
              type="submit"
              icon="→"
              label="Enter Room"
              color="green"
              size="large"
              :disabled="!isValidRoomCode || isJoining"
            />
          </div>
        </form>
      </div>

      <!-- Create Room Tab -->
      <div v-else class="tab-content">
        <form @submit.prevent="handleCreateRoom">
          <FormGroup
            v-model="selectedMap"
            type="select"
            label="Select Map Preset"
            placeholder="Choose a map..."
            :options="mapOptions"
          />

          <div class="or-divider">
            <span>or</span>
          </div>

          <div class="file-upload">
            <label for="map-file-input" class="file-upload-label">
              <WaxSealButton
                icon="📁"
                label="Upload Custom Map"
                color="gold"
                size="medium"
              />
            </label>
            <input
              id="map-file-input"
              type="file"
              accept="image/*"
              class="file-input"
              @change="handleFileUpload"
            />
            <span v-if="uploadedFileName" class="file-name">{{ uploadedFileName }}</span>
          </div>

          <FormGroup
            v-model="showPreview"
            type="checkbox"
            checkbox-label="Show map preview"
          />

          <div v-if="showPreview && mapPreview" class="map-preview">
            <img :src="mapPreview" alt="Map preview" />
          </div>

          <div v-if="createError" class="error-message">
            {{ createError }}
          </div>

          <div class="form-actions">
            <WaxSealButton
              type="submit"
              icon="✓"
              label="Create Room"
              color="green"
              size="large"
              :disabled="!hasMap || isCreating"
            />
          </div>
        </form>
      </div>

      <!-- Connection Status -->
      <div class="connection-status" :class="{ connected: isConnected }">
        <span class="status-dot"></span>
        {{ isConnected ? 'Connected' : 'Connecting...' }}
      </div>
    </ParchmentContainer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import ParchmentContainer from '@/components/ui/ParchmentContainer.vue'
import WaxSealButton from '@/components/ui/WaxSealButton.vue'
import FormGroup from '@/components/ui/FormGroup.vue'
import { useSocket } from '@/composables/useSocket'

const router = useRouter()
const { isConnected, createRoom, joinRoom } = useSocket()

// Tab state
const activeTab = ref('join')

// Join form state
const joinRoomCode = ref('')
const joinError = ref('')
const isJoining = ref(false)

// Create form state
const selectedMap = ref('')
const uploadedFileName = ref('')
const uploadedFile = ref(null)
const showPreview = ref(false)
const createError = ref('')
const isCreating = ref(false)

// Map options (will load from assets/maps.json)
const mapOptions = ref([
  { value: 'rabenfels', label: 'Rabenfels Castle' },
  { value: 'dungeon', label: 'Ancient Dungeon' },
  { value: 'forest', label: 'Dark Forest' }
])

// Computed
const isValidRoomCode = computed(() => {
  return /^[A-Z0-9]{6}$/.test(joinRoomCode.value)
})

const hasMap = computed(() => {
  return selectedMap.value || uploadedFile.value
})

const mapPreview = computed(() => {
  if (uploadedFile.value) {
    return URL.createObjectURL(uploadedFile.value)
  }
  if (selectedMap.value) {
    return `/assets/${selectedMap.value}-map.png`
  }
  return null
})

// Methods
function handleFileUpload(event) {
  const file = event.target.files[0]
  if (file) {
    if (!file.type.startsWith('image/')) {
      createError.value = 'Please select an image file'
      return
    }
    uploadedFile.value = file
    uploadedFileName.value = file.name
    selectedMap.value = '' // Clear preset selection
    createError.value = ''
  }
}

async function handleJoinRoom() {
  if (!isValidRoomCode.value || isJoining.value) return

  joinError.value = ''
  isJoining.value = true

  try {
    await joinRoom(joinRoomCode.value)
    // Navigate to map view
    router.push(`/room/${joinRoomCode.value}`)
  } catch (error) {
    joinError.value = error.message || 'Failed to join room'
  } finally {
    isJoining.value = false
  }
}

async function handleCreateRoom() {
  if (!hasMap.value || isCreating.value) return

  createError.value = ''
  isCreating.value = true

  try {
    // Prepare map data
    let mapUrl = null
    let mapAspectRatio = 1

    if (uploadedFile.value) {
      // Upload file to server
      const mapData = await uploadMapFile(uploadedFile.value)
      mapUrl = mapData.url
      mapAspectRatio = mapData.aspectRatio
    } else if (selectedMap.value) {
      // Use preset map URL
      const presetUrl = `/assets/${selectedMap.value}-map.png`
      const mapData = await getPresetMapData(presetUrl)
      mapUrl = mapData.url
      mapAspectRatio = mapData.aspectRatio
    }

    // Create room with map
    const snapshot = {
      mapUrl,
      mapAspectRatio,
      revealShapes: [],
      markers: [],
      drawings: [],
      initiativeRounds: 3,
      initiativeAssignments: {}
    }

    const roomId = await createRoom(snapshot)

    // Navigate to map view
    router.push(`/room/${roomId}`)
  } catch (error) {
    createError.value = error.message || 'Failed to create room'
  } finally {
    isCreating.value = false
  }
}

// Helper functions
async function uploadMapFile(file) {
  const formData = new FormData()
  formData.append('map', file)

  const response = await fetch('/api/upload-map', {
    method: 'POST',
    body: formData
  })

  if (!response.ok) {
    throw new Error('Upload failed')
  }

  return await response.json()
}

async function getPresetMapData(url) {
  const img = await loadImage(url)
  return {
    url: url,
    aspectRatio: img.naturalWidth / img.naturalHeight
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

// Load map presets on mount
onMounted(async () => {
  try {
    const response = await fetch('/assets/maps.json')
    if (response.ok) {
      const maps = await response.json()
      mapOptions.value = maps.map(m => ({
        value: m.id,
        label: m.name
      }))
    }
  } catch (error) {
    console.warn('Could not load map presets:', error)
  }
})
</script>

<style scoped>
.lobby-view {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  /* Enhanced wooden table surface effect */
  background:
    /* Wood grain texture simulation */
    repeating-linear-gradient(
      90deg,
      var(--leather-darker) 0px,
      var(--leather-dark) 2px,
      var(--leather-darker) 4px
    ),
    /* Subtle horizontal grain variation */
    repeating-linear-gradient(
      0deg,
      transparent 0px,
      rgba(0, 0, 0, 0.02) 1px,
      transparent 2px
    ),
    /* Base wood color with grain gradient */
    linear-gradient(
      135deg,
      #2a1f15 0%,
      #3d2f1f 25%,
      #2a1f15 50%,
      #3d2f1f 75%,
      #2a1f15 100%
    );
  background-size: 100% 100%, 100% 100%, 100% 100%;
  /* Subtle vignette */
  box-shadow: inset 0 0 200px rgba(0, 0, 0, 0.3);
}

.title {
  font-family: var(--font-display);
  font-size: 2.5rem;
  color: var(--accent-red);
  text-align: center;
  margin: 0 0 0.5rem 0;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
}

.subtitle {
  font-family: var(--font-heading);
  font-size: 1rem;
  color: var(--ink-faded);
  text-align: center;
  margin: 0 0 2rem 0;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.tabs {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-bottom: 2rem;
  padding-bottom: 2rem;
  border-bottom: 2px solid var(--parchment-dark);
}

.tab-content {
  margin-top: 2rem;
}

.form-actions {
  margin-top: 2rem;
  display: flex;
  justify-content: center;
}

.or-divider {
  text-align: center;
  margin: 1.5rem 0;
  position: relative;
}

.or-divider::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 1px;
  background: var(--parchment-dark);
}

.or-divider span {
  position: relative;
  background: var(--parchment-default);
  padding: 0 1rem;
  font-family: var(--font-heading);
  color: var(--ink-faded);
  text-transform: uppercase;
  font-size: 0.875rem;
}

.file-upload {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  margin: 1rem 0;
}

.file-upload-label {
  cursor: pointer;
}

.file-input {
  display: none;
}

.file-name {
  font-family: var(--font-body);
  font-size: 0.875rem;
  color: var(--ink-faded);
  font-style: italic;
}

.map-preview {
  margin: 1.5rem 0;
  border: 2px solid var(--parchment-dark);
  border-radius: 4px;
  overflow: hidden;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
}

.map-preview img {
  width: 100%;
  height: auto;
  display: block;
}

.error-message {
  margin: 1rem 0;
  padding: 1rem;
  background: rgba(139, 30, 30, 0.1);
  border: 2px solid var(--accent-red);
  border-radius: 4px;
  color: var(--accent-red);
  font-family: var(--font-body);
  text-align: center;
}

.connection-status {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 2px solid var(--parchment-dark);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-family: var(--font-body);
  font-size: 0.875rem;
  color: var(--ink-faded);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent-gray);
  animation: pulse 2s ease-in-out infinite;
}

.connection-status.connected .status-dot {
  background: #27ae60;
  animation: none;
}

@keyframes pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}

@media (max-width: 768px) {
  .title {
    font-size: 2rem;
  }

  .subtitle {
    font-size: 0.875rem;
  }

  .tabs {
    flex-direction: column;
    align-items: center;
  }
}
</style>
