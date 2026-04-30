# Nachtschall Map - Development Guide for Claude

This document provides everything needed to understand and work on the Nachtschall Map project in future sessions.

---

## 🔄 IMPORTANT: Keeping This Document Updated

**When working on this project in future sessions, you MUST update this file when:**

1. **Architecture Changes**
   - New stores, composables, or services added
   - State management patterns change
   - Real-time sync patterns modified
   - New layers or rendering systems added

2. **New Features**
   - Add to "Future Feature Ideas" → Move to implemented sections
   - Update component list in Directory Structure
   - Add new action types to Quick Reference
   - Document new composables/services with usage examples

3. **API/Pattern Changes**
   - Socket action format changes
   - Store structure modifications
   - Component prop interfaces change
   - New styling patterns or CSS variables

4. **Common Issues Discovered**
   - Add to "Common Gotchas" with solutions
   - Update troubleshooting section
   - Document workarounds for browser-specific issues

5. **Performance Optimizations**
   - New throttling strategies
   - Rendering optimizations
   - Bundle size improvements

6. **Breaking Changes**
   - Dependencies upgraded with breaking changes
   - Removal of deprecated features
   - File/directory reorganization

**How to Update:**
- Add new sections where relevant
- Keep examples current (update code snippets if patterns change)
- Mark deprecated patterns clearly
- Add date stamps for major architectural changes
- Keep "Quick Reference" section up-to-date

**Before ending a session where you made significant changes:**
1. Review this file
2. Update relevant sections
3. Add any new gotchas discovered
4. Update code examples if patterns changed

This ensures future sessions have accurate, current information! 📝

---

## Project Overview

**Nachtschall Map** is a real-time collaborative tabletop RPG mapping tool with fog-of-war, markers, drawings, and initiative tracking. Built with Vue 3, it provides a medieval-themed interface for game masters and players.

**Tech Stack:**
- **Frontend**: Vue 3 (Composition API), Pinia, Vue Router, Vite
- **Real-time**: Socket.IO (WebSocket)
- **Visualization**: D3.js v7 (pan/zoom), SVG (map + fog rendering)
- **Backend**: Node.js, Express, Socket.IO Server, Redis
- **Deployment**: Docker, docker-compose

---

## Architecture Overview

### High-Level Structure

```
Frontend (Vue SPA)
├── Lobby (room creation/joining)
└── Map View (collaborative mapping)
    ├── Map Canvas (SVG + Canvas layers)
    ├── Left Panel (room info, controls)
    ├── Tool Overlay (bottom toolbar)
    └── Floating Overlays (color palette, brush control, initiative tracker)

Backend (Node.js)
├── Express HTTP server
├── Socket.IO WebSocket server
└── Redis (room persistence)
```

### State Management

**Pinia Stores:**
1. **room.js** - Room state (markers, fog, drawings, initiative)
2. **socket.js** - WebSocket connection management
3. **ui.js** - UI state (active tool, colors, overlays)

**Persistence Strategy:**
- **localStorage**: Client-side cache (fast restore)
- **Redis**: Server-side persistence (source of truth)
- **Hash Validation**: Detects stale localStorage, auto-reloads

### Real-time Sync

**Action Format:**
```javascript
{
  type: 'markerAdd' | 'markerUpdate' | 'markerRemove' | 'drawingAdd' | 'reveal' | 'fog' | 'initiativeUpdate' | 'reset',
  data: { /* action-specific payload */ }
}
```

**Flow:**
1. Owner performs action → Updates local Pinia store
2. Emits action via Socket.IO → `socketStore.emitAction(roomId, action)`
3. Server broadcasts to room → All clients receive
4. Clients apply action → `roomStore.applyAction(action)`

**Important:** Actions use `action.data` structure. Always access payload via `action.data`, not directly on `action`.

---

## Directory Structure

```
nachtschall-map/
├── src/
│   ├── main.js                    # Vue app entry, Pinia setup
│   ├── App.vue                    # Root component with router-view
│   │
│   ├── router/
│   │   └── index.js               # Routes: / (lobby), /room/:code (map)
│   │
│   ├── stores/                    # Pinia stores
│   │   ├── room.js                # Room state with localStorage persistence
│   │   ├── socket.js              # Socket.IO connection & events
│   │   └── ui.js                  # UI state (tools, colors, overlays)
│   │
│   ├── composables/               # Reusable logic
│   │   ├── useSocket.js           # Socket integration with room store
│   │   ├── useD3Map.js            # D3 pan/zoom setup
│   │   └── useTheme.js            # Medieval theme (torn edges, colors)
│   │   # ⚠️ REMOVED: useCoordinates.js, useFogCanvas.js (2026-04-30)
│   │
│   ├── services/                  # Business logic (pure JS, no Vue)
│   │   # ⚠️ REMOVED: fog-renderer.js, coordinate-system.js (2026-04-30)
│   │   # Fog is now pure SVG in MapCanvas.vue
│   │   # Coordinates are viewBox-native (no conversion needed)
│   │
│   ├── views/                     # Page components
│   │   ├── LobbyView.vue          # Room creation/joining
│   │   └── MapView.vue            # Main map interface
│   │
│   ├── components/
│   │   ├── ui/                    # Reusable UI elements
│   │   │   ├── WaxSealButton.vue      # Medieval button (20+ instances)
│   │   │   ├── ParchmentContainer.vue # Torn paper container
│   │   │   ├── ParchmentDialog.vue    # Modal dialogs
│   │   │   ├── FormGroup.vue          # Input with label
│   │   │   ├── ColorButton.vue        # Color picker button
│   │   │   ├── PokerChip.vue          # Marker token design
│   │   │   └── RotatedSlider.vue      # Vertical slider (future)
│   │   │
│   │   │   # Note: No lobby/ subdirectory - lobby is a single component
│   │   │   # (LobbyView.vue contains all lobby UI inline)
│   │   │
│   │   └── map/
│   │       ├── MapCanvas.vue          # Main canvas (SVG + fog)
│   │       ├── MapMarker.vue          # Individual marker component
│   │       ├── MarkerNameDialog.vue   # Marker name editor
│   │       ├── LeftPanel.vue          # Room info + reset button
│   │       ├── ToolOverlay.vue        # Bottom toolbar
│   │       ├── ColorPalette.vue       # Color picker overlay
│   │       ├── BrushControl.vue       # Brush size slider
│   │       └── InitiativeTracker.vue  # Combat turn tracker
│   │
│   ├── assets/
│   │   ├── fonts/                     # MedievalSharp, Cinzel, IM Fell
│   │   └── maps/
│   │       ├── maps.json              # Preset maps
│   │       └── *.png                  # Default maps
│   │
│   └── styles/
│       ├── variables.css              # Theme colors, fonts
│       └── global.css                 # Reset + base styles
│
├── server/
│   └── server.js                  # Express + Socket.IO server
│
├── public/
│   └── index.html                 # SPA entry point
│
├── TESTING.md                     # Comprehensive test checklist
├── FEATURES.md                    # Feature documentation
├── CLAUDE.md                      # This file
├── package.json
├── vite.config.js
├── Dockerfile
└── docker-compose.yml
```

---

## Key Concepts

### 1. Coordinate System ⚠️ UPDATED 2026-04-30

**Fixed SVG viewBox Coordinates:**
- **SVG viewBox**: Dynamic based on aspect ratio: `0 0 1000 ${1000/aspectRatio}`
  - Width always 1000
  - Height calculated from map aspect ratio (e.g., 16:9 map = height ~562)
- **All positions stored as viewBox coordinates** (`x`, `y` in 0-1000 range for width)
- **No normalization needed** - coordinates are viewport-independent by design
- **D3 transforms the entire SVG group** - fog, markers, drawings all move together

**How it works:**
```javascript
// Get mouse position in viewBox space (already transformed by D3)
const [x, y] = d3.pointer(event, svgElement.value)

// Use directly - no conversion needed
const marker = { id, x, y, color, name }
roomStore.addMarker(marker)
```

**Image rendering:**
```vue
<!-- Image maintains aspect ratio within viewBox -->
<image
  :href="mapImageDataUrl"
  x="0"
  y="0"
  :width="1000"
  :height="1000 / mapAspectRatio"
  preserveAspectRatio="xMidYMid meet"
/>
```

**Why:** 
- Single coordinate space for everything (SVG viewBox)
- No viewport-dependent pixel conversions
- Automatic multi-client sync (same viewBox coords = same visual position)
- D3 zoom/pan transforms everything together

**⚠️ DEPRECATED:** `coordinate-system.js` and `useCoordinates.js` were removed. No longer use `nx`/`ny` or `normalize()`/`denormalize()`.

---

### 2. Fog-of-War System ⚠️ COMPLETELY REWRITTEN 2026-04-30

**NEW Architecture (SVG-based, not Canvas):**
- **Single SVG `<path>` element** with holes cut out for reveals
- **`fill-rule="evenodd"`** makes circles subtract from rectangle
- **Inside transformed `<g>` group** - moves perfectly with D3 zoom/pan
- **No manual transform synchronization** needed

**How it works:**
```vue
<!-- Computed fog path with holes -->
<path
  :d="fogPath"
  fill="#e8d7b8"
  fill-rule="evenodd"
  opacity="0.95"
/>
```

```javascript
// Build path: outer rectangle + circle holes
const fogPath = computed(() => {
  let path = 'M 0 0 L 1000 0 L 1000 1000 L 0 1000 Z'  // Outer rect
  
  revealShapes.value.forEach(shape => {
    if (shape.type === 'reveal') {
      // Add circle as hole using arc commands
      const { x, y, radius } = shape
      path += ` M ${x + radius} ${y}`
      path += ` A ${radius} ${radius} 0 1 0 ${x - radius} ${y}`
      path += ` A ${radius} ${radius} 0 1 0 ${x + radius} ${y} Z`
    }
  })
  
  return path
})
```

**Critical Pattern:**
```javascript
// Add shape to store (triggers fogPath recomputation)
function drawReveal(x, y, isDragging = false) {
  const shape = { type: 'reveal', x, y, radius: revealRadius.value }
  roomStore.addRevealShape(shape)
  
  if (!isDragging) {
    // Emit to server on mouse up
    socketStore.emitAction(roomId, {
      type: 'reveal',
      data: shape
    })
  }
}
```

**Performance Benefits:**
- **One DOM element** instead of thousands of circles in a mask
- **Reactive path update** - Vue only updates `d` attribute
- **Automatic D3 transform** - no manual canvas synchronization
- **Min 40px distance** between shapes (reduced shape count)

**Why the change:**
- Canvas fog required complex transform synchronization with D3
- SVG fog automatically moves with pan/zoom (inside transformed group)
- Simpler code, fewer edge cases
- Still performant with thousands of shapes (single path element)

**⚠️ DEPRECATED:** `fog-renderer.js` and `useFogCanvas.js` removed. Fog is now pure SVG in MapCanvas.vue.

---

### 3. D3.js Pan/Zoom Integration

**Composable: `useD3Map.js`**
```javascript
export function useD3Map(svgRef, mapGroupRef) {
  function initD3Zoom() {
    const svg = d3.select(svgRef.value)
    const mapGroup = d3.select(mapGroupRef.value)
    
    const zoom = d3.zoom()
      .scaleExtent([0.1, 10])
      .on('zoom', (event) => {
        mapGroup.attr('transform', event.transform)
        uiStore.setZoomTransform(event.transform)
      })
    
    svg.call(zoom)
  }
  
  return { initD3Zoom }
}
```

**Coordinate Transforms:**
- Use `d3.pointer(event, mapGroup)` to get transform-aware coordinates
- Canvas fog layer uses same transform via `ctx.translate()` and `ctx.scale()`

**Important:** Middle mouse drag for pan, scroll wheel for zoom (D3 defaults).

---

### 4. Marker System

**Component: `MapMarker.vue`**
- Renders as SVG `<foreignObject>` containing PokerChip component
- Drag handling: native mouse events (not D3.drag)
- Visual feedback: `tempPosition` ref for drag preview
- Emits `update` only on mouse release (not during drag)

**Drag Performance:**
```javascript
// Temp position for visual feedback
const tempPosition = ref(null)

// During drag: update temp position (reactively updates x/y computed)
tempPosition.value = { nx, ny }

// On mouse up: emit actual update
emit('update', { id, nx, ny })
tempPosition.value = null
```

**Double-click to edit name:**
```javascript
// Delay before resetting isDragging prevents double-click from firing during drag
setTimeout(() => { isDragging.value = false }, 100)
```

---

### 5. Real-time Sync Patterns

**Reactivity Issue:** Array mutations don't trigger watchers properly.

**Solution:** Use trigger properties for fog shapes
```javascript
// room.js state
lastReceivedFogShape: null,    // Triggers on each new shape
fogRebuildTrigger: 0,          // Increments to force rebuild

// When receiving fog from server
this.revealShapes.push(action.data)
this.lastReceivedFogShape = { ...action.data, timestamp: Date.now() }

// useFogCanvas watcher
watch(() => roomStore.lastReceivedFogShape, (shape) => {
  if (!shape) return
  if (shape.type === 'reveal') {
    renderer.addRevealShape(shape.x, shape.y, shape.radius)
  }
  renderer.render()
})
```

**Why:** Changing `lastReceivedFogShape` object triggers watcher even though array length is same.

---

## Component Patterns

### Medieval UI Components

**WaxSealButton.vue** - Most used component (~20 instances)
```vue
<WaxSealButton
  icon="✎"           <!-- Single character or emoji -->
  label="Draw"       <!-- Button text -->
  color="red"        <!-- red|green|blue|gold|gray -->
  size="medium"      <!-- small|medium|large -->
  :active="isActive" <!-- Golden glow when true -->
  :disabled="false"
  @click="handleClick"
/>
```

**Props:**
- Random border-radius per instance (no two buttons identical)
- 2.5D effects: lifts on hover, presses on click
- Deep shadows for table-top feel

**ParchmentContainer.vue** - Layout wrapper
```vue
<ParchmentContainer
  floating           <!-- Absolute positioned overlay -->
  draggable          <!-- Enable drag (future) -->
  position="center"  <!-- left|center|right -->
  width="400px"
  padding="1.5rem"
>
  <slot></slot>
</ParchmentContainer>
```

**Features:**
- Torn edges via `useTornEdges()` composable (random polygon clip-path)
- Parchment gradient + paper texture overlay
- Drop shadow for elevation

**PokerChip.vue** - Marker tokens
```vue
<PokerChip
  :color="marker.color"    <!-- red|blue|green|yellow|purple|orange|gray|pink -->
  :label="marker.name.charAt(0).toUpperCase()"
  size="small"             <!-- small|medium|large -->
  :worn="true"             <!-- Show wear/tear effects -->
/>
```

**Design:**
- Casino-style poker chip with edge spots (dashed ring)
- Center ring with label character
- 4 edge notches (top/bottom/left/right)
- Heavy wear effects (scratches, scuffs)

---

## Store Patterns

### Room Store (room.js)

**State Structure:**
```javascript
{
  // Room metadata
  roomId: string | null,
  isOwner: boolean,
  mapImageDataUrl: string | null,
  mapAspectRatio: number,
  
  // Map state (persisted to localStorage)
  markers: [{ id, x, y, color, name }],  // ⚠️ CHANGED: x, y (not nx, ny)
  markerIdCounter: number,
  revealShapes: [{ type, x, y, radius }],
  drawings: [{ id, pathData, color, strokeWidth }],  // ⚠️ CHANGED: removed points array
  drawingIdCounter: number,
  
  // Initiative
  initiativeRounds: number,
  markerRoundAssignments: { markerId: roundNumber },
  
  // Reactivity triggers (not persisted)
  lastReceivedFogShape: { type, x, y, radius, timestamp } | null,
  fogRebuildTrigger: number,
  
  // History (disabled but kept for future)
  historyStack: [],
  historyIndex: -1
}
```

**Key Actions:**
```javascript
// Markers
addMarker(marker)              // Adds with auto-generated ID
updateMarker(id, updates)      // Partial update
removeMarker(id)

// Fog (don't call directly, use useFogCanvas)
addRevealShape(shape)          // Adds to array, triggers lastReceivedFogShape

// Drawings
addDrawing(drawing)

// Initiative
updateInitiative({ rounds, assignments })

// Room management
setRoomSnapshot(snapshot)      // On join/refresh
reset()                        // Clear all, trigger fogRebuildTrigger
applyAction(action)            // Apply incoming action from server
```

**Persistence Config:**
```javascript
persist: {
  key: 'nachtschall-room',
  storage: localStorage,
  paths: [
    'roomId', 'isOwner', 'mapImageDataUrl', 'mapAspectRatio',
    'markers', 'markerIdCounter',
    'revealShapes', 'drawings', 'drawingIdCounter',
    'initiativeRounds', 'markerRoundAssignments'
  ]
  // Excludes: lastReceivedFogShape, fogRebuildTrigger, historyStack
}
```

---

### UI Store (ui.js)

**State:**
```javascript
{
  // Tool state
  activeTool: 'draw' | null,   // Only 'draw' mode; markers/fog use clicks
  currentMarkerColor: 'blue',  // For markers AND drawings
  viewerPingColor: 'blue',     // Future: viewer ping color
  
  // Overlay visibility
  showColorPalette: boolean,
  showBrushControl: boolean,
  showInitiativeTracker: boolean,
  
  // Fog settings
  revealRadius: 50,            // Current brush size
  minRevealRadius: 20,
  maxRevealRadius: 200,
  
  // Map state (ephemeral)
  currentZoomTransform: { x, y, k },  // D3 transform
  mapDimensions: { x, y, width, height }
}
```

**Persistence:** Only `currentMarkerColor`, `viewerPingColor`, `revealRadius`

---

## Common Tasks

### Adding a New Map Feature

1. **Add state to room store:**
```javascript
// room.js state
myNewFeature: [],
myNewFeatureCounter: 0,

// Add to persist.paths
paths: ['myNewFeature', 'myNewFeatureCounter', ...]
```

2. **Add actions:**
```javascript
addMyFeature(feature) {
  this.myNewFeature.push({
    ...feature,
    id: feature.id || `my-feature-${++this.myNewFeatureCounter}`
  })
}
```

3. **Add to applyAction:**
```javascript
case 'myFeatureAdd':
  this.addMyFeature(action.data)
  break
```

4. **Emit from UI:**
```javascript
// In component
roomStore.addMyFeature(myFeatureData)
socketStore.emitAction(roomStore.roomId, {
  type: 'myFeatureAdd',
  data: myFeatureData
})
```

5. **Render in MapCanvas:**
```vue
<!-- Add to MapCanvas.vue template -->
<g class="my-features-group">
  <MyFeature
    v-for="feature in myFeatures"
    :key="feature.id"
    :feature="feature"
  />
</g>

<script setup>
const myFeatures = computed(() => roomStore.myNewFeature || [])
</script>
```

---

### Adding a New UI Component

1. **Create component in `src/components/ui/`:**
```vue
<template>
  <div class="my-component">
    <!-- Use medieval theme -->
  </div>
</template>

<script setup>
const props = defineProps({
  // Props here
})

const emit = defineEmits(['action'])
</script>

<style scoped>
/* Use CSS variables from variables.css */
.my-component {
  font-family: var(--font-body);
  color: var(--ink-black);
  background: var(--parchment-default);
}

/* Responsive */
@media (max-width: 768px) {
  /* Tablet styles */
}

@media (max-width: 480px) {
  /* Mobile styles */
}
</style>
```

2. **Import and use:**
```vue
<script setup>
import MyComponent from '@/components/ui/MyComponent.vue'
</script>

<template>
  <MyComponent @action="handleAction" />
</template>
```

---

### Debugging Real-time Sync

**Enable debug logs (already in place):**
```javascript
// socket.js
console.log('[socket] Emitting action:', action)

// useSocket.js (currently commented out)
console.log('[useSocket] Received action:', action)

// room.js applyAction (add temporarily)
console.log('[room] Applying action:', action.type, action.data)
```

**Common Issues:**

1. **Action not syncing:**
   - Check `action.data` structure (must have `data` property)
   - Verify `socketStore.emitAction()` is called
   - Check server broadcasts to room

2. **Fog not appearing on other clients:**
   - Check `lastReceivedFogShape` watcher fires
   - Verify `renderer.addRevealShape()` is called
   - Check `renderer.render()` is called

3. **Markers show NaN positions:**
   - Map dimensions not set yet (see `useCoordinates` guard)
   - Check `denormalize()` returns valid numbers

---

## Styling Guidelines

### CSS Variables (variables.css)
```css
/* Colors */
--parchment-light: #f4e8d0
--parchment-default: #e8d7b8
--parchment-dark: #c9b79c
--leather-dark: #3d2f1f
--leather-darker: #2a1f15
--ink-black: #1a1410
--ink-faded: #4a3829
--accent-red: #8b1e1e
--accent-gray: #5a5552
--accent-gold: #c9a961

/* Fonts */
--font-display: 'MedievalSharp', cursive     /* Titles */
--font-heading: 'Cinzel', serif              /* Headings, labels */
--font-body: 'IM Fell English', serif        /* Body text */

/* Effects */
--shadow-deep: 0 8px 16px rgba(0,0,0,0.3)
--shadow-embossed: inset 0 2px 4px rgba(0,0,0,0.2)
```

### 2.5D Design Principles

**Elevation Levels:**
- Background (leather): 0px
- Parchment containers: 8px shadow
- Buttons (default): 4px shadow
- Buttons (hover): 6px shadow + translateY(-2px)
- Buttons (active): 2px shadow + translateY(0px)
- Modals/dialogs: 16px shadow

**Hover States:**
```css
.element:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(0,0,0,0.3);
}
```

**Active States:**
```css
.element:active {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}
```

### Responsive Breakpoints

```css
/* Tablet */
@media (max-width: 768px) {
  /* Adjust layout, larger touch targets */
}

/* Mobile */
@media (max-width: 480px) {
  /* Stack vertically, full-width elements */
}
```

---

## Development Commands

```bash
# Install dependencies
npm install

# Development server (Vite)
npm run dev
# → http://localhost:5173

# Production build
npm run build
# → Output in dist/

# Preview production build
npm run preview

# Start backend (separate terminal)
npm run server
# → http://localhost:3000

# Docker (full stack)
docker-compose up --build
```

---

## Testing Checklist

See `TESTING.md` for comprehensive test scenarios.

**Quick smoke test:**
1. Create room in lobby
2. Join room in second browser window
3. On owner: reveal fog, add marker, draw path
4. On viewer: verify all changes appear instantly
5. Refresh both browsers: state persists
6. Click reset: everything clears

**Performance test:**
1. Add 50+ markers
2. Reveal 100+ fog areas
3. Draw 20+ paths
4. Verify no lag or memory leaks

---

## Common Gotchas

### 1. Fog Doesn't Sync
**Problem:** Other clients don't see fog reveals.

**Solution:** Check `lastReceivedFogShape` trigger is being set:
```javascript
// room.js applyAction
case 'reveal':
case 'fog':
  this.revealShapes.push(action.data)
  this.lastReceivedFogShape = { ...action.data, timestamp: Date.now() }
  break
```

### 2. Markers Show "NaN" Positions
**Problem:** `denormalize()` returns NaN for x/y.

**Solution:** Map dimensions not set yet. Add guard:
```javascript
if (width === 0 || height === 0) {
  return { x: 0, y: 0 }
}
```

### 3. Actions Have Wrong Format
**Problem:** Server receives flat object instead of `{ type, data }`.

**Solution:** Always wrap in data property:
```javascript
// ❌ Wrong
socketStore.emitAction(roomId, { type: 'markerAdd', id, nx, ny })

// ✅ Correct
socketStore.emitAction(roomId, {
  type: 'markerAdd',
  data: { id, nx, ny }
})
```

### 4. Buttons Stay Disabled
**Problem:** Computed properties not reactive.

**Solution:** Ensure using Pinia store properties directly:
```javascript
// ✅ Reactive
const canReset = computed(() => roomStore.markers.length > 0)

// ❌ Not reactive
const canReset = roomStore.markers.length > 0
```

### 5. Fog Resets on Every Reveal
**Problem:** Mask rebuilds from scratch on each shape.

**Solution:** Only rebuild on specific triggers:
```javascript
// During drag: add to mask directly
renderer.addRevealShape(x, y, radius)

// On reset/undo: rebuild entire mask
watch(() => roomStore.fogRebuildTrigger, () => {
  renderer.setRevealShapes(roomStore.revealShapes)
})
```

### 6. Marker Drag Feels Laggy
**Problem:** Too many store updates during drag.

**Solution:** Use temp position for visual feedback:
```javascript
// During drag: update temp ref (no emit)
tempPosition.value = { nx, ny }

// On mouse up: emit once
emit('update', { id, ...tempPosition.value })
tempPosition.value = null
```

---

## Performance Optimization

### Fog Rendering
- **Throttle renders**: Max 20fps during drag (50ms interval)
- **Shape distance**: Min 20px between shapes
- **Batch commits**: Only save to store on mouse release
- **Canvas reuse**: Never recreate canvases, only resize

### Marker Dragging
- **requestAnimationFrame**: Throttle position updates
- **Temp position**: Visual feedback without store updates
- **Single emit**: Only emit on mouse release

### D3 Transforms
- **Shared transform**: Canvas fog uses same transform as SVG
- **Transform-aware coords**: Use `d3.pointer(event, transformedElement)`

### Real-time Sync
- **Granular actions**: Only send changed data
- **Optimistic updates**: Update local state immediately
- **Batch when possible**: Commit fog shapes on release, not per-shape

---

## Future Feature Ideas

### Not Yet Implemented (Potential Enhancements)

1. **Viewer Pings** - Viewers can click to show temporary indicator
2. **Drawing Eraser** - Remove specific drawing paths
3. **Fog Templates** - Preset room/corridor shapes
4. **Shape Tools** - Rectangle, circle, line tools
5. **Measurement Tool** - Ruler for distances
6. **Image Layers** - Overlay images (tokens, effects)
7. **Text Annotations** - Add text labels to map
8. **User Cursors** - Show where other users are pointing
9. **Chat/Notes** - In-app communication
10. **Dice Roller** - Integrated dice system
11. **Audio Integration** - Ambient sounds, music
12. **Mobile Fog Addition** - Right-click equivalent for touch
13. **Undo/Redo** - Was removed but could be re-added
14. **Export Map** - Save current state as image
15. **Grid Overlay** - Optional square/hex grid

---

## File References

**Key Files to Understand:**

1. **MapCanvas.vue** - Main interaction hub (fog, markers, drawings)
2. **room.js** - Central state management
3. **fog-renderer.js** - Complex fog rendering logic
4. **useSocket.js** - Real-time sync integration
5. **MapMarker.vue** - Marker drag implementation

**Configuration:**
- **vite.config.js** - Build config, dev server proxy
- **package.json** - Dependencies, scripts
- **docker-compose.yml** - Production deployment

**Documentation:**
- **TESTING.md** - Comprehensive test checklist
- **FEATURES.md** - Feature documentation
- **CLAUDE.md** - This file

---

## Quick Reference

### Color Palette (8 colors)
```javascript
['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'cyan']
```

### Action Types
```javascript
'markerAdd', 'markerUpdate', 'markerRemove',
'drawingAdd',
'reveal', 'fog',
'initiativeUpdate',
'reset'
```

### Component Import Paths
```javascript
// UI Components
import WaxSealButton from '@/components/ui/WaxSealButton.vue'
import ParchmentContainer from '@/components/ui/ParchmentContainer.vue'
import PokerChip from '@/components/ui/PokerChip.vue'
import FormGroup from '@/components/ui/FormGroup.vue'

// Map Components
import MapCanvas from '@/components/map/MapCanvas.vue'
import MapMarker from '@/components/map/MapMarker.vue'
import LeftPanel from '@/components/map/LeftPanel.vue'
import ToolOverlay from '@/components/map/ToolOverlay.vue'

// Stores
import { useRoomStore } from '@/stores/room'
import { useSocketStore } from '@/stores/socket'
import { useUiStore } from '@/stores/ui'

// Composables
import { useSocket } from '@/composables/useSocket'
import { useD3Map } from '@/composables/useD3Map'
import { useTornEdges } from '@/composables/useTheme'
// ⚠️ REMOVED 2026-04-30: useCoordinates, useFogCanvas
```

---

## Recent Major Changes (2026-04-30)

### Coordinate System Refactor

**What Changed:**
- Removed normalized coordinate system (`nx`, `ny` in 0-1 range)
- Now use SVG viewBox coordinates directly (`x`, `y` in 0-1000 range for width)
- Deleted `coordinate-system.js` and `useCoordinates.js`
- SVG viewBox is dynamic: `0 0 1000 ${1000/aspectRatio}`

**Why:**
- Eliminates viewport-dependent pixel conversions
- Single coordinate space for all elements (map, markers, fog, drawings)
- Automatic multi-client synchronization (same viewBox = same position)
- D3 zoom transforms everything together (no manual sync needed)

**Impact:**
- All marker positions changed from `{ nx, ny }` to `{ x, y }`
- Mouse events use `d3.pointer(event, svgElement)` for viewBox coords
- No `normalize()`/`denormalize()` calls needed anywhere

### Fog System Rewrite (Canvas → SVG)

**What Changed:**
- Removed canvas-based fog rendering (`fog-renderer.js`, `useFogCanvas.js`)
- Now use single SVG `<path>` element with `fill-rule="evenodd"`
- Fog path computed reactively from `revealShapes` array
- Fog is inside D3-transformed `<g>` group

**Why:**
- Canvas required complex transform synchronization with D3
- SVG fog automatically moves with pan/zoom (same transform as map)
- Simpler code (no manual canvas transforms)
- Still performant (one path element vs thousands of circle elements)

**How it works:**
```vue
<path
  :d="fogPath"
  fill="#e8d7b8"
  fill-rule="evenodd"
  opacity="0.95"
/>
```

```javascript
const fogPath = computed(() => {
  let path = 'M 0 0 L 1000 0 L 1000 1000 L 0 1000 Z'  // Outer rect
  
  revealShapes.value.forEach(shape => {
    if (shape.type === 'reveal') {
      const { x, y, radius } = shape
      // Circle holes using SVG arc commands
      path += ` M ${x + radius} ${y}`
      path += ` A ${radius} ${radius} 0 1 0 ${x - radius} ${y}`
      path += ` A ${radius} ${radius} 0 1 0 ${x + radius} ${y} Z`
    }
  })
  
  return path
})
```

**Impact:**
- Fog rendering is now in `MapCanvas.vue` (not separate service)
- No `initFogCanvas()`, `renderFog()` calls needed
- Fog shapes use viewBox coordinates (same as markers)
- Fog automatically zooms/pans with map (no extra code)

### Container and Layout Improvements

**What Changed:**
- Map container now fills grid cell properly (`height: 100%`)
- SVG uses `preserveAspectRatio="xMidYMid meet"` to fit container
- Map image maintains aspect ratio within dynamic viewBox
- Mouse events captured on container div (not SVG) for full-area interaction

**Why:**
- SVG viewBox was smaller than container (aspect ratio mismatch)
- Clicks outside image area weren't registering
- Map should fill available space while maintaining proportions

**Result:**
- Map fills grid cell height/width appropriately
- Fog reveals work anywhere in container (not just on image)
- Zoom/pan feel natural and responsive

### Drawing System Optimization

**What Changed:**
- Removed redundant `points` array from drawing objects
- Only store `pathData` (SVG path string)

**Why:**
- Points array duplicated data (50% storage reduction)
- Path data is sufficient for rendering and editing

**Impact:**
- Drawings now: `{ id, pathData, color, strokeWidth }`
- No `points` property in server or client

---

## Conclusion

This project is a fully functional real-time collaborative mapping tool. The architecture is clean, performance is optimized, and the codebase is well-organized. 

**When working on this project:**
1. Follow existing patterns (especially real-time sync and fog rendering)
2. Maintain the medieval theme aesthetics
3. Test with multiple clients for sync verification
4. Use localStorage + Redis persistence pattern
5. Keep performance in mind (throttling, batching)

**For questions or issues:**
- Check TESTING.md for test scenarios
- Check FEATURES.md for feature documentation
- Review this file for architecture patterns

Good luck with future development! 🎲🗺️
