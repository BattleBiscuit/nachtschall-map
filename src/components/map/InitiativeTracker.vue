<template>
  <Teleport to="body">
    <Transition name="fade">
      <ParchmentContainer
        v-if="visible"
        floating
        class="initiative-tracker"
        width="600px"
        padding="1.5rem"
      >
        <div class="tracker-header">
          <h3 class="tracker-title">Initiative Tracker</h3>
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
              class="round-column"
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
                >
                  <PokerChip
                    :color="marker.color"
                    :label="marker.name ? marker.name.charAt(0).toUpperCase() : ''"
                    size="small"
                  />
                  <span v-if="marker.name" class="marker-name">{{ marker.name }}</span>
                </div>
              </div>
            </div>

            <!-- Unassigned markers -->
            <div
              class="round-column unassigned"
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
                >
                  <PokerChip
                    :color="marker.color"
                    :label="marker.name ? marker.name.charAt(0).toUpperCase() : ''"
                    size="small"
                  />
                  <span v-if="marker.name" class="marker-name">{{ marker.name }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="tracker-actions">
          <WaxSealButton @click="addRound" color="green" size="small">
            Add Round
          </WaxSealButton>
          <WaxSealButton @click="removeRound" color="gray" size="small" :disabled="rounds.length <= 1">
            Remove Round
          </WaxSealButton>
          <WaxSealButton @click="resetRounds" color="red" size="small">
            Reset All
          </WaxSealButton>
        </div>
      </ParchmentContainer>
    </Transition>
  </Teleport>
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
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 900;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.tracker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.tracker-title {
  font-family: var(--font-heading);
  font-size: 1.5rem;
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
  margin-bottom: 1rem;
  min-height: 200px;
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
  gap: 1rem;
  overflow-x: auto;
  padding-bottom: 0.5rem;
}

.round-column {
  min-width: 120px;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.3);
  border: 2px solid var(--parchment-dark);
  border-radius: 8px;
  padding: 0.75rem;
}

.round-column.unassigned {
  background: rgba(201, 183, 156, 0.2);
}

.round-header {
  font-family: var(--font-heading);
  font-size: 0.875rem;
  color: var(--ink-black);
  text-align: center;
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--parchment-dark);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.round-slots {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-height: 60px;
}

.marker-token {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 6px;
  cursor: move;
  transition: all 0.2s;
}

.marker-token:hover {
  background: rgba(255, 255, 255, 0.8);
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.marker-name {
  font-family: var(--font-body);
  font-size: 0.75rem;
  color: var(--ink-black);
  text-align: center;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tracker-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  padding-top: 1rem;
  border-top: 2px solid var(--parchment-dark);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Scrollbar styling */
.rounds-container::-webkit-scrollbar {
  height: 8px;
}

.rounds-container::-webkit-scrollbar-track {
  background: var(--parchment-light);
  border-radius: 4px;
}

.rounds-container::-webkit-scrollbar-thumb {
  background: var(--parchment-dark);
  border-radius: 4px;
}

.rounds-container::-webkit-scrollbar-thumb:hover {
  background: var(--leather-dark);
}
</style>
