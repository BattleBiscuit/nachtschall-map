<template>
  <ParchmentContainer
    width="240px"
    padding="1rem"
    class="room-info-container"
  >
    <div class="header-section">
      <div class="home-button">
        <WaxSealButton
          icon="⌂"
          label=""
          color="red"
          size="medium"
          @click="handleGoHome"
        />
      </div>

      <div class="header-content">
        <h1 class="page-title">{{ roomId }}</h1>
        <div class="subtitle">{{ isOwner ? 'Owner' : 'Viewer' }}</div>
      </div>
    </div>
  </ParchmentContainer>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useRoomStore } from '@/stores/room'
import { useSocketStore } from '@/stores/socket'
import ParchmentContainer from '@/components/ui/ParchmentContainer.vue'
import WaxSealButton from '@/components/ui/WaxSealButton.vue'

const router = useRouter()
const roomStore = useRoomStore()
const socketStore = useSocketStore()

const roomId = computed(() => roomStore.roomId)
const isOwner = computed(() => roomStore.isOwner)

function handleGoHome() {
  if (confirm('Leave the room and return to lobby?')) {
    router.push('/')
  }
}
</script>

<style scoped>
.room-info-container {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.header-section {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 2px solid var(--ink-black);
}

.home-button {
  flex-shrink: 0;
}

.header-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.page-title {
  font-family: var(--font-display);
  font-size: 1.5rem;
  color: var(--ink-black);
  margin: 0;
  letter-spacing: 0.15em;
  font-weight: bold;
  line-height: 1.2;
}

.subtitle {
  font-family: var(--font-body);
  font-size: 0.875rem;
  color: var(--ink-faded);
  font-style: italic;
  margin: 0;
}
</style>
