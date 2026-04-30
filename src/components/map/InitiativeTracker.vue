<template>
  <Transition name="slide">
    <ParchmentContainer
      v-if="visible"
      class="initiative-tracker"
      width="200px"
      padding="1rem"
    >
      <div class="tracker-header">
        <h3 class="tracker-title">Initiative</h3>
        <button class="close-button" @click="close">✕</button>
      </div>

        <div class="tracker-body">
          <div v-if="markers.length === 0" class="empty-state">
            <p>No markers on the map yet.</p>
            <p>Double-click the map to add markers.</p>
          </div>

          <div v-else class="rounds-container">
            <div
              v-for="round in rounds"
              :key="round"
              class="round-section"
              @drop="handleDrop($event, round)"
              @dragover.prevent
            >
              <div class="round-header">Round {{ round }}</div>
              <div class="round-slots">
                <div
                  v-for="marker in getMarkersInRound(round)"
                  :key="marker.id"
                  class="marker-token"
                  draggable="true"
                  @dragstart="handleDragStart($event, marker)"
                  :title="marker.name || 'Unnamed marker'"
                >
                  <PokerChip
                    :color="marker.color"
                    :label="marker.name ? marker.name.charAt(0).toUpperCase() : ''"
                    size="small"
                  />
                </div>
              </div>
            </div>

            <!-- Unassigned markers -->
            <div
              class="round-section unassigned"
              @drop="handleDrop($event, null)"
              @dragover.prevent
            >
              <div class="round-header">Unassigned</div>
              <div class="round-slots">
                <div
                  v-for="marker in unassignedMarkers"
                  :key="marker.id"
                  class="marker-token"
                  draggable="true"
                  @dragstart="handleDragStart($event, marker)"
                  :title="marker.name || 'Unnamed marker'"
                >
                  <PokerChip
                    :color="marker.color"
                    :label="marker.name ? marker.name.charAt(0).toUpperCase() : ''"
                    size="small"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="tracker-actions">
          <WaxSealButton @click="addRound" color="green" size="small" icon="+">
            Round
          </WaxSealButton>
          <WaxSealButton @click="removeRound" color="gray" size="small" icon="-" :disabled="rounds.length <= 1">
            Round
          </WaxSealButton>
          <WaxSealButton @click="resetRounds" color="red" size="small" icon="↻">
            Reset
          </WaxSealButton>
        </div>
      </ParchmentContainer>
    </Transition>
</template>

<script setup>
import { computed } from 'vue'
import { useRoomStore } from '@/stores/room'
import { useUiStore } from '@/stores/ui'
import { useSocketStore } from '@/stores/socket'
import ParchmentContainer from '@/components/ui/ParchmentContainer.vue'
import WaxSealButton from '@/components/ui/WaxSealButton.vue'
import PokerChip from '@/components/ui/PokerChip.vue'

const roomStore = useRoomStore()
const uiStore = useUiStore()
const socketStore = useSocketStore()

const visible = computed(() => uiStore.showInitiativeTracker)
const markers = computed(() => roomStore.markers || [])
const rounds = computed(() => {
  const roundsArray = []
  for (let i = 1; i <= roomStore.initiativeRounds; i++) {
    roundsArray.push(i)
  }
  return roundsArray
})

function getMarkersInRound(round) {
  return markers.value.filter(m =>
    roomStore.markerRoundAssignments[m.id] === round
  )
}

const unassignedMarkers = computed(() => {
  return markers.value.filter(m =>
    !roomStore.markerRoundAssignments[m.id]
  )
})

function handleDragStart(event, marker) {
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('markerId', marker.id)
}

function handleDrop(event, round) {
  event.preventDefault()
  const markerId = event.dataTransfer.getData('markerId')

  if (!markerId) return

  // Update assignment
  const newAssignments = { ...roomStore.markerRoundAssignments }

  if (round === null) {
    // Move to unassigned
    delete newAssignments[markerId]
  } else {
    // Assign to round
    newAssignments[markerId] = round
  }

  // Update store
  roomStore.updateInitiative({
    assignments: newAssignments
  })

  // Emit to server
  socketStore.emitAction(roomStore.roomId, {
    type: 'initiativeUpdate',
    data: {
      rounds: roomStore.initiativeRounds,
      assignments: newAssignments
    }
  })
}

function addRound() {
  const newRounds = roomStore.initiativeRounds + 1

  roomStore.updateInitiative({ rounds: newRounds })

  socketStore.emitAction(roomStore.roomId, {
    type: 'initiativeUpdate',
    data: {
      rounds: newRounds,
      assignments: roomStore.markerRoundAssignments
    }
  })
}

function removeRound() {
  if (roomStore.initiativeRounds <= 1) return

  const newRounds = roomStore.initiativeRounds - 1

  // Remove assignments from the last round
  const newAssignments = { ...roomStore.markerRoundAssignments }
  Object.keys(newAssignments).forEach(markerId => {
    if (newAssignments[markerId] > newRounds) {
      delete newAssignments[markerId]
    }
  })

  roomStore.updateInitiative({
    rounds: newRounds,
    assignments: newAssignments
  })

  socketStore.emitAction(roomStore.roomId, {
    type: 'initiativeUpdate',
    data: {
      rounds: newRounds,
      assignments: newAssignments
    }
  })
}

function resetRounds() {
  roomStore.updateInitiative({
    rounds: 3,
    assignments: {}
  })

  socketStore.emitAction(roomStore.roomId, {
    type: 'initiativeUpdate',
    data: {
      rounds: 3,
      assignments: {}
    }
  })
}

function close() {
  uiStore.toggleInitiativeTracker()
}
</script>

<style scoped>
.initiative-tracker {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.tracker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.tracker-title {
  font-family: var(--font-heading);
  font-size: 1.125rem;
  color: var(--ink-black);
  margin: 0;
}

.close-button {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--ink-faded);
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  transition: color 0.2s;
}

.close-button:hover {
  color: var(--ink-black);
}

.tracker-body {
  flex: 1;
  overflow-y: auto;
  margin-bottom: 0.5rem;
  min-height: 0;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: var(--ink-faded);
  font-family: var(--font-body);
}

.empty-state p {
  margin: 0.5rem 0;
}

.rounds-container {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  overflow-y: auto;
}

.round-section {
  background: rgba(255, 255, 255, 0.3);
  border: 2px solid var(--parchment-dark);
  border-radius: 8px;
  padding: 0.5rem;
}

.round-section.unassigned {
  background: rgba(201, 183, 156, 0.2);
}

.round-header {
  font-family: var(--font-heading);
  font-size: 0.75rem;
  color: var(--ink-black);
  text-align: center;
  margin-bottom: 0.375rem;
  padding-bottom: 0.25rem;
  border-bottom: 1px solid var(--parchment-dark);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.round-slots {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 0.25rem;
  min-height: 30px;
}

.marker-token {
  cursor: move;
  transition: opacity 0.2s;
}

.marker-token:hover {
  opacity: 0.7;
}

.tracker-actions {
  display: flex;
  gap: 0.375rem;
  flex-wrap: wrap;
  padding-top: 0.5rem;
  border-top: 2px solid var(--parchment-dark);
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.slide-enter-from {
  transform: translateX(100%);
  opacity: 0;
}

.slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

/* Scrollbar styling */
.rounds-container::-webkit-scrollbar {
  width: 6px;
}

.rounds-container::-webkit-scrollbar-track {
  background: var(--parchment-light);
  border-radius: 3px;
}

.rounds-container::-webkit-scrollbar-thumb {
  background: var(--parchment-dark);
  border-radius: 3px;
}

.rounds-container::-webkit-scrollbar-thumb:hover {
  background: var(--leather-dark);
}
</style>
