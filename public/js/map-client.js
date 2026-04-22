// Map configuration
const config = {
    revealRadius: 60,
    minRevealRadius: 20,
    maxRevealRadius: 200,
    initialZoom: 1,
    minZoom: 0.5,
    maxZoom: 8
};

// Active tool state
let activeTool = 'reveal';

// Markers storage
let markers = [];
let markerIdCounter = 0;

// Storage for fog of war reveal shapes
let revealShapes = [];

// Drawing storage
let drawings = [];
let drawingIdCounter = 0;
let currentDrawing = null;
let isDrawing = false;

// Undo/Redo system
let historyStack = [];
let historyIndex = -1;
const MAX_HISTORY = 50;
let isUndoRedoAction = false; // Flag to prevent undo/redo from adding to history

// Color palette for markers
const markerColors = {
    blue: { fill: 'rgba(100, 150, 255, 0.5)', stroke: '#2a5caa' },
    red: { fill: 'rgba(255, 100, 100, 0.5)', stroke: '#aa2a2a' },
    green: { fill: 'rgba(100, 200, 100, 0.5)', stroke: '#2a8a2a' },
    yellow: { fill: 'rgba(255, 220, 100, 0.5)', stroke: '#aa9a2a' },
    purple: { fill: 'rgba(180, 100, 255, 0.5)', stroke: '#6a2aaa' },
    orange: { fill: 'rgba(255, 150, 80, 0.5)', stroke: '#aa6a2a' },
    cyan: { fill: 'rgba(100, 220, 220, 0.5)', stroke: '#2a9aaa' },
    pink: { fill: 'rgba(255, 150, 200, 0.5)', stroke: '#aa5a7a' }
};

let currentMarkerColor = 'blue';

// Initialize containers
const mainContainer = d3.select("#map-container");

// Create a map wrapper that will hold both SVG and fog canvas
let mapWrapper = null;

const svg = mainContainer.append("svg")
    .attr("width", window.innerWidth)
    .attr("height", window.innerHeight);

// Create defs for clip-path (torn paper edges)
const defs = svg.append("defs");

// Create main group for pan/zoom
const g = svg.append("g");

// Map layers
const mapGroup = g.append("g").attr("class", "map-layer");
const markersGroup = g.append("g").attr("class", "markers-layer"); // Layer for player/enemy markers
const drawingGroup = g.append("g").attr("class", "drawing-layer"); // Layer for freehand drawings
const fogGroup = g.append("g").attr("class", "fog-layer");

// Brush size indicator circle
const brushIndicator = g.append("circle")
    .attr("class", "brush-indicator")
    .attr("r", config.revealRadius)
    .attr("fill", "none")
    .attr("stroke", "#fff")
    .attr("stroke-width", 2)
    .attr("stroke-dasharray", "5,5")
    .attr("pointer-events", "none")
    .style("opacity", 0);

// Store map dimensions globally
let mapDimensions = {};

// Map image state
let mapImageDataUrl = null;
let mapAspectRatio = 1;
// Realtime / lobby state
let socket = null;
let currentRoomId = null;
let isOwner = false;
let suppressLocalEvents = false; // when applying remote events
let pendingJoin = false;
// Viewer ping color (defaults to blue)
let viewerPingColor = 'blue';

// Palette forced-open flag so user toggles persist until explicitly changed
let paletteForcedOpen = false;

// Path-based room routing helpers
function getRoomFromURL() {
    // Extract room code from /room/:code path
    const match = window.location.pathname.match(/^\/room\/([A-Z0-9]{6})$/i);
    return match ? match[1].toUpperCase() : null;
}

function redirectToLobby() {
    window.location.href = '/';
}

// Viewer ping uses the existing `#color-palette` UI (same choices as markers).

// Ensure ping styles exist
function injectPingStyles() {
        if (document.getElementById('ping-styles')) return;
        const s = document.createElement('style');
        s.id = 'ping-styles';
        s.textContent = `
        .map-ping {
            position: absolute;
            width: 48px;
            height: 48px;
            margin-left: -24px;
            margin-top: -24px;
            border-radius: 50%;
            pointer-events: none;
            z-index: 9999;
            display: block;
            transform: scale(0.2);
            opacity: 0.9;
            box-shadow: 0 0 0 2px rgba(255,255,255,0.06), 0 4px 18px rgba(0,0,0,0.6);
            animation: pingPulse 1s ease-out infinite;
        }
        @keyframes pingPulse {
            0% { transform: scale(0.2); opacity: 0.9; box-shadow: 0 0 0 0 rgba(255,255,255,0.12); }
            60% { transform: scale(1.4); opacity: 0.6; box-shadow: 0 0 0 14px rgba(255,255,255,0.02); }
            100% { transform: scale(1.8); opacity: 0; box-shadow: 0 0 0 24px rgba(255,255,255,0); }
        }
        `;
        document.head.appendChild(s);
}

// Show a temporary ping at absolute map coordinates (x,y) for 5s
function showPingAt(x, y, meta) {
        injectPingStyles();
        const containerEl = document.getElementById('map-container');
        if (!containerEl) return;
        const el = document.createElement('div');
        el.className = 'map-ping';
        // optional color/meta could be used later
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    // small visual core: use ping color if provided
    const colorKey = (meta && meta.color) ? meta.color : 'blue';
    const colors = markerColors[colorKey] || markerColors['blue'];
    // make a subtle radial core tinted by the marker fill
    el.style.background = `radial-gradient(circle at 50% 40%, ${colors.fill} 0%, rgba(255,255,255,0.08) 10%, rgba(255,255,255,0.02) 20%, rgba(255,255,255,0) 30%)`;
    el.style.border = `2px solid ${colors.stroke}`;
        containerEl.appendChild(el);
        // Let animation run for 5s then remove
        setTimeout(() => {
                try { el.remove(); } catch (e) {}
        }, 5000);
}

// Convenience: show ping from normalized coordinates
function showPingNormalized(nx, ny, meta) {
        const pt = denormalizePoint(nx, ny);
        showPingAt(pt.x, pt.y, meta);
}

// Coordinate helpers: normalize coordinates to the map image space (0..1)
// Coordinates are now relative to map wrapper (0,0) at top-left of map
function normalizePoint(x, y) {
    if (!mapDimensions || !mapDimensions.width || !mapDimensions.height) return { nx: 0, ny: 0 };
    return {
        nx: x / mapDimensions.width,
        ny: y / mapDimensions.height
    };
}

function denormalizePoint(nx, ny) {
    if (!mapDimensions || !mapDimensions.width || !mapDimensions.height) return { x: 0, y: 0 };
    return {
        x: nx * mapDimensions.width,
        y: ny * mapDimensions.height
    };
}

function normalizeRadius(r) {
    if (!mapDimensions || !mapDimensions.width) return r;
    return r / mapDimensions.width;
}

function denormalizeRadius(nr) {
    if (!mapDimensions || !mapDimensions.width) return nr;
    return nr * mapDimensions.width;
}

function canEdit() {
    return ((!currentRoomId && !pendingJoin) || isOwner);
}

// Set up map and fog layers from the stored image data URL
function setupMapLayers() {
    if (!mapImageDataUrl) return;

    // Map padding: leave space for UI elements (120px left/right, 100px top/bottom)
    const mapPadding = { left: 120, right: 120, top: 100, bottom: 100 };

    const viewWidth = window.innerWidth;
    const viewHeight = window.innerHeight;

    // Calculate available space for map
    const availableWidth = viewWidth - mapPadding.left - mapPadding.right;
    const availableHeight = viewHeight - mapPadding.top - mapPadding.bottom;

    // Size map to fit available space while maintaining aspect ratio
    let imgWidth, imgHeight;
    const targetAspectRatio = mapAspectRatio;
    const availableAspectRatio = availableWidth / availableHeight;

    if (availableAspectRatio > targetAspectRatio) {
        // Available space is wider - fit to height
        imgHeight = availableHeight;
        imgWidth = imgHeight * targetAspectRatio;
    } else {
        // Available space is taller - fit to width
        imgWidth = availableWidth;
        imgHeight = imgWidth / targetAspectRatio;
    }

    // Center the map in available space
    const imgX = mapPadding.left + (availableWidth - imgWidth) / 2;
    const imgY = mapPadding.top + (availableHeight - imgHeight) / 2;

    mapDimensions = { x: imgX, y: imgY, width: imgWidth, height: imgHeight };

    // Create/update map wrapper container
    if (mapWrapper) {
        mapWrapper.remove();
    }
    mapWrapper = document.createElement('div');
    mapWrapper.id = 'map-wrapper';
    mapWrapper.style.cssText = `position:fixed;left:${imgX}px;top:${imgY}px;width:${imgWidth}px;height:${imgHeight}px;pointer-events:none;overflow:hidden;`;
    document.getElementById('map-container').appendChild(mapWrapper);

    // Position SVG within wrapper
    svg.attr("width", imgWidth)
        .attr("height", imgHeight)
        .style("position", "absolute")
        .style("left", "0")
        .style("top", "0")
        .style("pointer-events", "all");

    // Move SVG into wrapper
    mapWrapper.appendChild(svg.node());

    // Update zoom translateExtent to match map size
    zoom.translateExtent([
        [0, 0],
        [imgWidth, imgHeight]
    ]);

    mapGroup.selectAll("*").remove();
    mapGroup.append("image")
        .attr("href", mapImageDataUrl)
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", imgWidth)
        .attr("height", imgHeight)
        .attr("preserveAspectRatio", "xMidYMid meet");

    setupFogSystem();
}



// ── Fog canvas system ────────────────────────────────────────────────────────
// Replaces the heavy SVG filter chain (feTurbulence + feDisplacementMap +
// feGaussianBlur) and the growing list of SVG mask paths.
// Instead we keep two offscreen canvases:
//   fogTextureCanvas – the map image pre-blurred once with ctx.filter
//   maskCanvas       – grayscale mask in map-space (white=fogged, alpha-out=revealed)
// and one visible canvas (fogCanvas) that composites them each frame.

let fogCanvas = null;        // visible, fixed, full-viewport
let maskCanvas = null;       // offscreen, map-space coordinates
let fogTextureCanvas = null; // offscreen, pre-blurred fog texture
let fogTextureDims = null;   // { x, y, w, h } in map-space
let currentZoomTransform = d3.zoomIdentity;

function setupFogSystem() {
    // (Re-)create the visible fog canvas - sized and positioned to match map bounds
    const existing = document.getElementById('fog-canvas');
    if (existing) existing.remove();
    fogCanvas = document.createElement('canvas');
    fogCanvas.id = 'fog-canvas';

    // Size canvas to match map dimensions
    fogCanvas.width = Math.ceil(mapDimensions.width);
    fogCanvas.height = Math.ceil(mapDimensions.height);

    // Position canvas inside the map wrapper at (0,0) - same coordinate system as SVG
    fogCanvas.style.cssText = `position:absolute;left:0;top:0;width:${mapDimensions.width}px;height:${mapDimensions.height}px;pointer-events:none;z-index:10;`;
    mapWrapper.appendChild(fogCanvas);

    // Pre-render the blurred fog texture (also creates maskCanvas at the same size)
    preRenderFogTexture();
}

function preRenderFogTexture() {
    const fogPadding = 0.3;
    const fW = Math.ceil(mapDimensions.width  * (1 + fogPadding * 2));
    const fH = Math.ceil(mapDimensions.height * (1 + fogPadding * 2));

    fogTextureCanvas = document.createElement('canvas');
    fogTextureCanvas.width  = fW;
    fogTextureCanvas.height = fH;
    fogTextureDims = {
        x: -mapDimensions.width  * fogPadding,
        y: -mapDimensions.height * fogPadding,
        w: fW,
        h: fH
    };

    // Mask is the same size as the fog texture so the blur fades naturally at the edges
    maskCanvas = document.createElement('canvas');
    maskCanvas.width  = fW;
    maskCanvas.height = fH;

    const img = new Image();
    img.onload = function () {
        const ctx = fogTextureCanvas.getContext('2d');
        // Stretch the image to fill the entire fog texture canvas so the
        // visible map area sits deep inside the image. The blur kernel then
        // samples from real pixels on all sides — no fade-to-transparent at edges.
        // Use a blur amount relative to the map width so appearance is consistent across devices
        const blurPx = Math.max(40, Math.round(mapDimensions.width * 0.08));
        ctx.filter = `blur(${blurPx}px)`;
        ctx.drawImage(img, 0, 0, fW, fH);
        // Rebuild mask from any already-loaded revealShapes (covers resize + restore)
        rebuildMaskCanvas();
    };
    img.src = mapImageDataUrl;
}

function renderFogCanvas() {
    if (!fogCanvas || !fogTextureCanvas || !maskCanvas) return;
    const ctx = fogCanvas.getContext('2d');
    const t   = currentZoomTransform;

    ctx.clearRect(0, 0, fogCanvas.width, fogCanvas.height);
    ctx.save();

    // Apply zoom transform directly (SVG and canvas now share the same coordinate system)
    ctx.translate(t.x, t.y);
    ctx.scale(t.k, t.k);

    // Draw pre-blurred fog texture
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(fogTextureCanvas, fogTextureDims.x, fogTextureDims.y, fogTextureDims.w, fogTextureDims.h);

    // Keep fog only where maskCanvas is opaque — drawn at fog texture coords so blur fades at edges
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(maskCanvas, fogTextureDims.x, fogTextureDims.y, fogTextureDims.w, fogTextureDims.h);

    ctx.restore();
}

// Paint a soft irregular reveal hole into the mask (destination-out removes opacity)
function drawRevealOnMask(x, y, radius) {
    const maskCtx = maskCanvas.getContext('2d');
    // fogTextureDims.x/y is mapDimensions.x/y minus the padding offset,
    // so this maps SVG map-space coords into fog-texture canvas coords
    const mx = x - fogTextureDims.x;
    const my = y - fogTextureDims.y;
    maskCtx.globalCompositeOperation = 'destination-out';

    // Create torn paper edge effect
    const numPoints = 20 + Math.floor(Math.random() * 10);
    maskCtx.beginPath();

    for (let i = 0; i <= numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;
        // Vary radius to create jagged edges
        const variance = 0.3 + Math.random() * 0.4;
        const r = radius * variance;
        // Add some irregularity to the angle
        const angleOffset = (Math.random() - 0.5) * 0.3;
        const finalAngle = angle + angleOffset;

        const px = mx + Math.cos(finalAngle) * r;
        const py = my + Math.sin(finalAngle) * r;

        if (i === 0) {
            maskCtx.moveTo(px, py);
        } else {
            maskCtx.lineTo(px, py);
        }
    }

    maskCtx.closePath();
    maskCtx.fillStyle = 'rgba(0,0,0,1)';
    maskCtx.fill();

    // Add slight shadow/feathering on edges for depth
    maskCtx.shadowColor = 'rgba(0,0,0,0.5)';
    maskCtx.shadowBlur = 3;
    maskCtx.fill();
    maskCtx.shadowBlur = 0;

    maskCtx.globalCompositeOperation = 'source-over';
}

// Paint soft irregular fog back into the mask (source-over adds white opacity)
function drawFogOnMask(x, y, radius) {
    const maskCtx = maskCanvas.getContext('2d');
    const mx = x - fogTextureDims.x;
    const my = y - fogTextureDims.y;
    const numBlobs = 4 + Math.floor(Math.random() * 4);

    maskCtx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < numBlobs; i++) {
        const angle = (i / numBlobs) * Math.PI * 2 + Math.random();
        const dist  = radius * 0.15 * Math.random();
        const bx    = mx + Math.cos(angle) * dist;
        const by    = my + Math.sin(angle) * dist;
        const br    = radius * (0.75 + Math.random() * 0.3);
        const g     = maskCtx.createRadialGradient(bx, by, 0, bx, by, br);
        g.addColorStop(0,    'rgba(255,255,255,1)');
        g.addColorStop(0.4,  'rgba(255,255,255,0.9)');
        g.addColorStop(0.7,  'rgba(255,255,255,0.6)');
        g.addColorStop(0.85, 'rgba(255,255,255,0.3)');
        g.addColorStop(1,    'rgba(255,255,255,0)');
        maskCtx.fillStyle = g;
        maskCtx.beginPath();
        maskCtx.arc(bx, by, br, 0, Math.PI * 2);
        maskCtx.fill();
    }
}

// Rebuild the mask from scratch using the revealShapes array (used for undo/redo and resize)
function rebuildMaskCanvas() {
    if (!maskCanvas) return;
    const maskCtx = maskCanvas.getContext('2d');
    maskCtx.globalCompositeOperation = 'source-over';
    maskCtx.fillStyle = 'white';
    maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
    revealShapes.forEach(shape => {
        if (shape.isFog) {
            drawFogOnMask(shape.x, shape.y, shape.radius);
        } else {
            drawRevealOnMask(shape.x, shape.y, shape.radius);
        }
    });
    renderFogCanvas();
}
// ─────────────────────────────────────────────────────────────────────────────

// Function to reveal area at position with wonky fading effect
function revealArea(x, y) {
    if (!canEdit() && !suppressLocalEvents) return;

    // Apply locally in absolute map coordinates
    drawRevealOnMask(x, y, config.revealRadius);
    renderFogCanvas();

    const shapeId = `shape-${Date.now()}-${Math.random()}`;
    const revealDataLocal = { x, y, radius: config.revealRadius, isFog: false, shapeId };
    revealShapes.push(revealDataLocal);

    addToHistory({ type: 'reveal', action: 'add', data: revealDataLocal });
    saveToLocalStorage();

    // Batch and emit normalized coordinates to server
    if (socket && currentRoomId && isOwner && !suppressLocalEvents) {
        const p = normalizePoint(x, y);
        const nr = normalizeRadius(config.revealRadius);
        queueAction({ type: 'reveal', data: { nx: p.nx, ny: p.ny, nradius: nr, isFog: false, shapeId } });
    }
}

// Function to add fog back at position with wonky fading effect
function addFog(x, y) {
    if (!canEdit() && !suppressLocalEvents) return;

    drawFogOnMask(x, y, config.revealRadius);
    renderFogCanvas();

    const shapeId = `shape-${Date.now()}-${Math.random()}`;
    const fogDataLocal = { x, y, radius: config.revealRadius, isFog: true, shapeId };
    revealShapes.push(fogDataLocal);

    addToHistory({ type: 'fog', action: 'add', data: fogDataLocal });
    saveToLocalStorage();

    if (socket && currentRoomId && isOwner && !suppressLocalEvents) {
        const p = normalizePoint(x, y);
        const nr = normalizeRadius(config.revealRadius);
        queueAction({ type: 'fog', data: { nx: p.nx, ny: p.ny, nradius: nr, isFog: true, shapeId } });
    }
}

// Function to add a marker (player/enemy circle)
function addMarker(x, y, color = null, providedId = null) {
    if (!canEdit() && !suppressLocalEvents) return;
    let markerId;
    if (providedId) {
        markerId = providedId;
        // try to keep markerIdCounter ahead of any numeric ids to avoid collisions
        const m = /marker-(\d+)/.exec(providedId);
        if (m) markerIdCounter = Math.max(markerIdCounter, parseInt(m[1], 10) + 1);
    } else {
        markerId = `marker-${markerIdCounter++}`;
    }
    const markerRadius = Math.min(mapDimensions.width, mapDimensions.height) / 50; // Scale to map size (smaller)
    const markerColor = color || currentMarkerColor;
    const colors = markerColors[markerColor];

    // Create marker circle
    const markerCircle = markersGroup.append("circle")
        .attr("id", markerId)
        .attr("cx", x)
        .attr("cy", y)
        .attr("r", 0)
        .attr("fill", colors.fill)
        .attr("stroke", colors.stroke)
        .attr("stroke-width", 3)
        .attr("class", "marker")
        .attr("data-color", markerColor)
        .style("cursor", "inherit")
        .style("pointer-events", "auto");

    // Animate marker appearance
    markerCircle.transition()
        .duration(200)
        .attr("r", markerRadius);

    // Create text label for marker name
    const markerText = markersGroup.append("text")
        .attr("id", `${markerId}-text`)
        .attr("x", x)
        .attr("y", y + markerRadius + 15)
        .attr("text-anchor", "middle")
        .attr("class", "marker-label")
        .attr("fill", "#fff")
        .attr("font-size", "12px")
        .attr("font-family", "sans-serif")
        .attr("font-weight", "bold")
        .attr("stroke", "#000")
        .attr("stroke-width", "3")
        .attr("paint-order", "stroke")
        .style("cursor", "inherit")
        .style("pointer-events", "none")
        .style("user-select", "none")
        .text("");

    // Store marker data
    const markerData = { id: markerId, x, y, color: markerColor, name: "", element: markerCircle, textElement: markerText };
    markers.push(markerData);

    // Add drag behavior to marker (only active in marker mode)
    const drag = d3.drag()
        .filter(function(event) {
            // Only allow drag when in marker mode and when editing is allowed
            return activeTool === 'tool2' && canEdit();
        })
        .on("start", function(event) {
            if (activeTool === 'tool2') {
                d3.select(this).style("cursor", "grabbing");
                markerData.isDragging = true;
            }
        })
        .on("drag", function(event) {
            if (activeTool === 'tool2') {
                const [newX, newY] = d3.pointer(event, g.node());
                d3.select(this)
                    .attr("cx", newX)
                    .attr("cy", newY);
                // Update text position
                markerData.textElement
                    .attr("x", newX)
                    .attr("y", newY + markerRadius + 15);
                markerData.x = newX;
                markerData.y = newY;
            }
        })
        .on("end", function(event) {
            if (activeTool === 'tool2') {
                d3.select(this).style("cursor", "grab");
                // Save state after dragging
                saveToLocalStorage();
                // Delay clearing isDragging flag to prevent click event
                setTimeout(() => {
                    markerData.isDragging = false;
                }, 50);
            }
        });

    markerCircle.call(drag);

    // Add double-click event to edit marker name and color
    markerCircle.on("dblclick", function(event) {
        if (activeTool === 'tool2' && canEdit()) {
            event.stopPropagation();

            // Create a custom dialog for editing marker
            const dialogHTML = `
                <div style="font-family: sans-serif;">
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: bold; color: #aaa; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Name:</label>
                        <input type="text" id="marker-name-input" value="${markerData.name || ""}"
                               style="width: 100%; padding: 10px; border: 1px solid rgba(255, 255, 255, 0.2);
                                      border-radius: 6px; font-size: 14px; background: rgba(0, 0, 0, 0.3);
                                      color: #fff; outline: none; transition: all 0.2s;"
                               onfocus="this.style.borderColor='rgba(100, 150, 255, 0.5)'; this.style.background='rgba(0, 0, 0, 0.5)';"
                               onblur="this.style.borderColor='rgba(255, 255, 255, 0.2)'; this.style.background='rgba(0, 0, 0, 0.3)';">
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: bold; color: #aaa; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Color:</label>
                        <div id="color-options" style="display: flex; gap: 8px; flex-wrap: wrap;">
                            ${Object.keys(markerColors).map(colorKey => `
                                <button class="color-option" data-color="${colorKey}"
                                        style="width: 40px; height: 40px; border-radius: 50%;
                                               border: 3px solid ${colorKey === markerData.color ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.2)'};
                                               background-color: ${markerColors[colorKey].fill};
                                               cursor: pointer; transition: all 0.2s;
                                               box-shadow: ${colorKey === markerData.color ? '0 0 12px rgba(255, 255, 255, 0.4)' : '0 2px 4px rgba(0, 0, 0, 0.5)'};"
                                        onmouseover="this.style.transform='scale(1.1)'; this.style.boxShadow='0 4px 8px rgba(0, 0, 0, 0.6)';"
                                        onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='${colorKey === markerData.color ? '0 0 12px rgba(255, 255, 255, 0.4)' : '0 2px 4px rgba(0, 0, 0, 0.5)'}';"
                                        onclick="document.querySelectorAll('.color-option').forEach(b => { b.style.border='3px solid rgba(255, 255, 255, 0.2)'; b.style.boxShadow='0 2px 4px rgba(0, 0, 0, 0.5)'; }); this.style.border='3px solid rgba(255, 255, 255, 0.9)'; this.style.boxShadow='0 0 12px rgba(255, 255, 255, 0.4)';">
                                </button>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;

            // Create modal overlay
            const overlay = document.createElement('div');
            overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.85); z-index: 10000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px);';

            const modal = document.createElement('div');
            modal.style.cssText = 'background: linear-gradient(145deg, #2a2a2a, #1f1f1f); padding: 25px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.05); max-width: 400px; width: 90%; border: 1px solid rgba(255, 255, 255, 0.1);';
            modal.innerHTML = dialogHTML;

            const buttons = document.createElement('div');
            buttons.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;';

            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Cancel';
            cancelBtn.style.cssText = 'padding: 10px 18px; border: 1px solid rgba(255, 255, 255, 0.2); background: linear-gradient(145deg, #333, #282828); color: #aaa; border-radius: 6px; cursor: pointer; font-size: 14px; transition: all 0.2s; font-weight: bold;';
            cancelBtn.onmouseover = () => { cancelBtn.style.background = 'linear-gradient(145deg, #3a3a3a, #2f2f2f)'; cancelBtn.style.color = '#ddd'; };
            cancelBtn.onmouseout = () => { cancelBtn.style.background = 'linear-gradient(145deg, #333, #282828)'; cancelBtn.style.color = '#aaa'; };
            cancelBtn.onclick = () => document.body.removeChild(overlay);

            const saveBtn = document.createElement('button');
            saveBtn.textContent = 'Save';
            saveBtn.style.cssText = 'padding: 10px 18px; border: none; background: linear-gradient(145deg, #3a5a7a, #2a4560); color: white; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: bold; transition: all 0.2s; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);';
            saveBtn.onmouseover = () => { saveBtn.style.background = 'linear-gradient(145deg, #4a6a8a, #3a5570)'; saveBtn.style.boxShadow = '0 3px 8px rgba(0, 0, 0, 0.6)'; };
            saveBtn.onmouseout = () => { saveBtn.style.background = 'linear-gradient(145deg, #3a5a7a, #2a4560)'; saveBtn.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.5)'; };
            saveBtn.onclick = () => {
                const newName = modal.querySelector('#marker-name-input').value;
                const selectedColor = modal.querySelector('.color-option[style*="border: 3px solid rgb(0, 0, 0)"]')?.dataset.color || markerData.color;

                markerData.name = newName;
                markerData.textElement.text(newName);

                if (selectedColor !== markerData.color) {
                    markerData.color = selectedColor;
                    const colors = markerColors[selectedColor];
                    markerData.element
                        .attr("fill", colors.fill)
                        .attr("stroke", colors.stroke)
                        .attr("data-color", selectedColor);
                }

                saveToLocalStorage();
                document.body.removeChild(overlay);
            };

            buttons.appendChild(cancelBtn);
            buttons.appendChild(saveBtn);
            modal.appendChild(buttons);
            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            // Focus on name input
            setTimeout(() => modal.querySelector('#marker-name-input').focus(), 100);

            // Allow Enter key to save
            modal.querySelector('#marker-name-input').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') saveBtn.click();
            });
        }
    });

    // Save state after adding marker (but only if not loading from storage)
    if (!markerData.isLoading) {
        // Add to history
        addToHistory({
            type: 'marker',
            action: 'add',
            data: { id: markerId, x, y, color: markerColor, name: "" }
        });

        saveToLocalStorage();
        if (socket && currentRoomId && isOwner && !suppressLocalEvents) {
            const p = normalizePoint(x, y);
            socket.emit('action', currentRoomId, { type: 'markerAdd', data: { id: markerId, nx: p.nx, ny: p.ny, color: markerColor, name: "" } });
        }
    }

    return markerData;
}

// Function to check if clicking on an existing marker
function findMarkerAtPosition(x, y) {
    const markerRadius = Math.min(mapDimensions.width, mapDimensions.height) / 50;
    const clickRadius = markerRadius * 1.2; // Hit area

    // Find markers within click radius
    const foundMarker = markers.find(marker => {
        const dx = marker.x - x;
        const dy = marker.y - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance <= clickRadius;
    });

    return foundMarker;
}

// Function to remove marker at position
function removeMarker(x, y) {
    if (!canEdit() && !suppressLocalEvents) return;
    const markerRadius = Math.min(mapDimensions.width, mapDimensions.height) / 50;
    const clickRadius = markerRadius * 1.5; // Slightly larger hit area

    // Find markers within click radius
    const markersToRemove = markers.filter(marker => {
        const dx = marker.x - x;
        const dy = marker.y - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance <= clickRadius;
    });

    // Remove found markers
    markersToRemove.forEach(marker => {
        // Add to history before removing
        addToHistory({
            type: 'marker',
            action: 'remove',
            data: { id: marker.id, x: marker.x, y: marker.y, color: marker.color, name: marker.name || "" }
        });

        // Animate marker removal
        marker.element.transition()
            .duration(200)
            .attr("r", 0)
            .style("opacity", 0)
            .remove();

        // Remove text label
        marker.textElement.remove();

        // Remove from markers array
        markers = markers.filter(m => m.id !== marker.id);
        // Emit removal to server if owner
        if (socket && currentRoomId && isOwner && !suppressLocalEvents) {
            socket.emit('action', currentRoomId, { type: 'markerRemove', data: { id: marker.id } });
        }
    });

    // Save state after removal
    if (markersToRemove.length > 0) {
        saveToLocalStorage();
    }
}

function removeMarkerById(id) {
    if (!id) return;
    const marker = markers.find(m => m.id === id);
    if (!marker) return;

    // Add to history before removing
    addToHistory({
        type: 'marker',
        action: 'remove',
        data: { id: marker.id, x: marker.x, y: marker.y, color: marker.color, name: marker.name || "" }
    });

    // Animate marker removal
    marker.element.transition()
        .duration(200)
        .attr("r", 0)
        .style("opacity", 0)
        .remove();

    // Remove text label
    marker.textElement.remove();

    // Remove from markers array
    markers = markers.filter(m => m.id !== marker.id);

    saveToLocalStorage();
}

// Drawing functions
function startDrawing(x, y) {
    if (activeTool !== 'draw') return;
    if (!canEdit() && !suppressLocalEvents) return;

    isDrawing = true;
    const drawingId = `drawing-${drawingIdCounter++}`;

    currentDrawing = {
        id: drawingId,
        points: [[x, y]],
        color: currentMarkerColor, // Reuse marker color picker
        strokeWidth: 3,
        path: null
    };
}

function continueDrawing(x, y) {
    if (!isDrawing || activeTool !== 'draw' || !currentDrawing) return;
    if (!canEdit() && !suppressLocalEvents) return;

    currentDrawing.points.push([x, y]);

    // Generate smooth path from points
    const pathData = generateSmoothPath(currentDrawing.points);

    // Update or create path element
    if (!currentDrawing.path) {
        currentDrawing.path = drawingGroup.append("path")
            .attr("id", currentDrawing.id)
            .attr("fill", "none")
            .attr("stroke", markerColors[currentDrawing.color].stroke)
            .attr("stroke-width", currentDrawing.strokeWidth)
            .attr("stroke-linecap", "round")
            .attr("stroke-linejoin", "round")
            .attr("class", "drawing-path");
    }

    currentDrawing.path.attr("d", pathData);
}

function endDrawing() {
    if (!isDrawing || !currentDrawing) return;
    if (!canEdit() && !suppressLocalEvents) return;

    isDrawing = false;

    if (currentDrawing.points.length > 1) {
        // Save the drawing
        drawings.push({
            id: currentDrawing.id,
            points: currentDrawing.points,
            color: currentDrawing.color,
            strokeWidth: currentDrawing.strokeWidth,
            pathData: generateSmoothPath(currentDrawing.points)
        });

        // Add to history
        addToHistory({
            type: 'drawing',
            action: 'add',
            data: drawings[drawings.length - 1]
        });

        saveToLocalStorage();
        if (socket && currentRoomId && isOwner && !suppressLocalEvents) {
            // Send normalized points instead of absolute pathData
            const latest = drawings[drawings.length - 1];
            const normPoints = latest.points.map(p => normalizePoint(p[0], p[1]));
            const normStroke = latest.strokeWidth / (mapDimensions.width || 1);
            socket.emit('action', currentRoomId, { type: 'drawingAdd', data: { id: latest.id, points: normPoints, color: latest.color, strokeWidthNorm: normStroke } });
        }
    } else {
        // Remove if too short
        if (currentDrawing.path) {
            currentDrawing.path.remove();
        }
    }

    currentDrawing = null;
}

function generateSmoothPath(points) {
    if (points.length < 2) return "";

    let path = `M ${points[0][0]},${points[0][1]}`;

    if (points.length === 2) {
        path += ` L ${points[1][0]},${points[1][1]}`;
    } else {
        // Use quadratic curves for smoothing
        for (let i = 1; i < points.length - 1; i++) {
            const xc = (points[i][0] + points[i + 1][0]) / 2;
            const yc = (points[i][1] + points[i + 1][1]) / 2;
            path += ` Q ${points[i][0]},${points[i][1]} ${xc},${yc}`;
        }
        // Add final point
        const last = points[points.length - 1];
        const secondLast = points[points.length - 2];
        path += ` Q ${secondLast[0]},${secondLast[1]} ${last[0]},${last[1]}`;
    }

    return path;
}

// Track middle mouse button state for panning
let isMiddleMouseDown = false;

// Zoom behavior - now supports middle mouse button panning
const zoom = d3.zoom()
    .scaleExtent([config.minZoom, config.maxZoom])
    .translateExtent([
        [0, 0],
        [10000, 10000]  // Large extent, will be updated when map loads
    ])
    .filter((event) => {
        // Allow wheel zoom normally
        if (event.type === 'wheel') return true;
        // Allow pan with middle mouse button (button 1)
        if (event.type === 'mousedown' || event.type === 'mousemove') {
            return event.button === 1 || isMiddleMouseDown;
        }
        return false;
    })
    .on("zoom", (event) => {
        g.attr("transform", event.transform);
        currentZoomTransform = event.transform;
        renderFogCanvas();
    });

svg.call(zoom);

// Mouse/touch interaction for revealing
let isMouseDown = false;
let isRightMouseDown = false;
let isDragging = false;
let lastRevealTime = 0;
const revealThrottle = 50; // milliseconds

// Batch reveal/fog actions for better network performance
let pendingActions = [];
let actionBatchTimeout = null;
const ACTION_BATCH_DELAY = 100; // Send batched actions every 100ms

function sendBatchedActions() {
    if (pendingActions.length === 0) return;

    if (socket && currentRoomId && isOwner) {
        // Send all pending actions at once
        pendingActions.forEach(action => {
            socket.emit('action', currentRoomId, action);
        });
    }

    pendingActions = [];
    actionBatchTimeout = null;
}

function queueAction(action) {
    pendingActions.push(action);

    // Set timer to send batch if not already set
    if (!actionBatchTimeout) {
        actionBatchTimeout = setTimeout(sendBatchedActions, ACTION_BATCH_DELAY);
    }
}

// Handle right-click (contextmenu) separately
svg.on("contextmenu", function(event) {
    event.preventDefault();

    // Only act if not in panning mode
    if (!event.ctrlKey) {
        const [x, y] = d3.pointer(event, g.node());

        if (activeTool === 'reveal') {
            // Right click - add fog
            addFog(x, y);
        } else if (activeTool === 'tool2') {
            // Right click - remove marker
            removeMarker(x, y);
        }
    }
});

svg.on("mousedown touchstart", function(event) {
    if (event.button === 1) {
        // Middle mouse button - for panning
        event.preventDefault();
        isMiddleMouseDown = true;
        container.node().classList.add('panning');
    } else {
        // Left or right mouse button
        // Block editing interactions for viewers (allow middle mouse panning above)
        if (!canEdit()) return;
        if (event.button === 2) {
            // Right mouse button
            isRightMouseDown = true;
        } else if (event.button === 0) {
            // Left mouse button
            isMouseDown = true;

            // Start drawing if in draw mode
            if (activeTool === 'draw') {
                const [x, y] = d3.pointer(event, g.node());
                startDrawing(x, y);
            }
        }
        isDragging = false;
    }
});

svg.on("mouseup touchend", function(event) {
    if (event.button === 1) {
        // Middle mouse button released
        isMiddleMouseDown = false;
        container.node().classList.remove('panning');
    }

    // End drawing if in draw mode
    if (activeTool === 'draw' && isDrawing) {
        endDrawing();
    }

    isMouseDown = false;
    isRightMouseDown = false;
});

svg.on("mousemove touchmove", function(event) {
    const [x, y] = d3.pointer(event, g.node());

    // Update brush indicator position and show it when reveal tool is active
    if (activeTool === 'reveal' && !isMiddleMouseDown) {
        brushIndicator
            .attr("cx", x)
            .attr("cy", y)
            .style("opacity", 0.6);
    } else {
        brushIndicator.style("opacity", 0);
    }

    // Continue drawing if in draw mode
    if (activeTool === 'draw' && isDrawing) {
        continueDrawing(x, y);
        return;
    }

    // Only reveal/fog if mouse is down and Ctrl is not pressed (not panning)
    if ((isMouseDown || isRightMouseDown) && !event.ctrlKey) {
        isDragging = true;

        if (!canEdit()) return;

        if (activeTool === 'reveal') {
            const now = Date.now();
            if (now - lastRevealTime < revealThrottle) return;
            lastRevealTime = now;

            if (isRightMouseDown) {
                // Right mouse - add fog
                addFog(x, y);
            } else {
                // Left mouse - reveal
                revealArea(x, y);
            }
        }
        // Tool 2 doesn't do anything on drag, only on click
    }
});

svg.on("click", function(event) {
    // Only act on LEFT click if not dragging and Ctrl is not pressed
    if (!isDragging && !event.ctrlKey) {
        // If we're in a room as a viewer, clicking should send a transient ping (5s)
        if (currentRoomId && !isOwner && !pendingJoin) {
            const [x, y] = d3.pointer(event, g.node());
            // send normalized ping to server; server will broadcast to room
            if (socket) {
                const p = normalizePoint(x, y);
                const pingId = `ping-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
                socket.emit('ping', currentRoomId, { id: pingId, nx: p.nx, ny: p.ny, ttl: 5000, color: viewerPingColor });
            }
            return;
        }
        if (!canEdit()) return;
        const [x, y] = d3.pointer(event, g.node());

        if (activeTool === 'reveal') {
            // Left click - reveal
            revealArea(x, y);
        } else if (activeTool === 'tool2') {
            // Check if clicking on existing marker
            const existingMarker = findMarkerAtPosition(x, y);

            // Only add new marker if not clicking on existing one and not dragging
            if (!existingMarker || (existingMarker && !existingMarker.isDragging)) {
                // Don't add if we just finished dragging a marker
                const anyMarkerDragging = markers.some(m => m.isDragging);
                if (!anyMarkerDragging && !existingMarker) {
                    addMarker(x, y);
                }
            }
        }
    }
});

svg.on("mouseleave", function() {
    brushIndicator.style("opacity", 0);
});

// Handle window resize
window.addEventListener("resize", () => {
    svg.attr("width", window.innerWidth)
        .attr("height", window.innerHeight);
    if (fogCanvas) {
        fogCanvas.width  = window.innerWidth;
        fogCanvas.height = window.innerHeight;
    }
    setupMapLayers(); // recreates fog system + rebuilds mask via preRenderFogTexture
});

// Save state to localStorage (removed - maps come from socket snapshot only)
function saveToLocalStorage() {
    // No longer save map state to localStorage
    // Maps are loaded from server via socket snapshot only
}

// Initialize: check URL for room parameter
const roomFromURL = getRoomFromURL();
if (!roomFromURL) {
    // No room in URL - redirect to lobby
    redirectToLobby();
} else {
    // Auto-connect to socket and join the room
    connectSocket(() => {
        joinRoom(roomFromURL, (res) => {
            if (!res || !res.ok) {
                console.log('Failed to join room:', res?.error || 'Unknown error');
                redirectToLobby();
            } else {
                console.log('Successfully joined room from URL');
            }
        });
    });
}

// Tool button functionality
const revealToolBtn = document.getElementById('reveal-tool');
const tool2Btn = document.getElementById('tool-2');
const drawToolBtn = document.getElementById('draw-tool');
const resetBtn = document.getElementById('reset-btn');
const undoBtn = document.getElementById('undo-btn');
const redoBtn = document.getElementById('redo-btn');

function setActiveTool(tool) {
    activeTool = tool;

    // Update button states
    revealToolBtn.classList.remove('active');
    tool2Btn.classList.remove('active');
    drawToolBtn.classList.remove('active');

    // Show/hide color palette and brush control based on active tool
    const colorPalette = document.getElementById('color-palette');
    const brushControl = document.getElementById('brush-control');

    if (tool === 'reveal') {
        revealToolBtn.classList.add('active');
        revealToolBtn.title = 'Reveal Tool (Active)';
        tool2Btn.title = 'Markers Tool - Add/Remove tokens';
        drawToolBtn.title = 'Drawing Tool - Freehand drawing';
        colorPalette.classList.remove('visible');
        brushControl.classList.add('visible');
        // Make markers non-interactive in reveal mode
        markersGroup.selectAll('.marker')
            .style("cursor", "inherit")
            .style("pointer-events", "none");
    } else if (tool === 'tool2') {
        tool2Btn.classList.add('active');
        tool2Btn.title = 'Markers Tool (Active)';
        revealToolBtn.title = 'Reveal Tool';
        drawToolBtn.title = 'Drawing Tool - Freehand drawing';
        colorPalette.classList.add('visible');
        brushControl.classList.remove('visible');
        // Make markers interactive with grab cursor in marker mode
        markersGroup.selectAll('.marker')
            .style("cursor", "grab")
            .style("pointer-events", "auto");
    } else if (tool === 'draw') {
        drawToolBtn.classList.add('active');
        drawToolBtn.title = 'Drawing Tool (Active)';
        revealToolBtn.title = 'Reveal Tool';
        tool2Btn.title = 'Markers Tool - Add/Remove tokens';
        colorPalette.classList.add('visible');
        brushControl.classList.remove('visible');
        // Make markers non-interactive in draw mode
        markersGroup.selectAll('.marker')
            .style("cursor", "inherit")
            .style("pointer-events", "none");
    }
}

function resetMap() {
    if (confirm('Are you sure you want to reset the map? This will clear all fog reveals, markers, and drawings.')) {
        // Clear localStorage
        localStorage.removeItem('mapState');

        // Clear all reveal/fog shapes and reset mask to fully fogged
        revealShapes = [];
        if (maskCanvas) {
            const maskCtx = maskCanvas.getContext('2d');
            maskCtx.globalCompositeOperation = 'source-over';
            maskCtx.fillStyle = 'white';
            maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
            renderFogCanvas();
        }

        // Clear all markers
        markersGroup.selectAll("*").remove();
        markers = [];
        markerIdCounter = 0;

        // Clear all drawings
        drawingGroup.selectAll("*").remove();
        drawings = [];
        drawingIdCounter = 0;

        // Clear history
        historyStack = [];
        historyIndex = -1;
        updateUndoRedoButtons();

        if (socket && currentRoomId && isOwner) {
            socket.emit('action', currentRoomId, { type: 'reset' });
        }
        alert('Map reset! All fog, markers, and drawings cleared.');
    }
}

revealToolBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (activeTool === 'reveal') {
        // Toggle brush control visibility
        const brushControl = document.getElementById('brush-control');
        brushControl.classList.toggle('visible');
    } else {
        setActiveTool('reveal');
    }
});

tool2Btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (activeTool === 'tool2') {
        // Toggle color palette visibility
        const colorPalette = document.getElementById('color-palette');
        colorPalette.classList.toggle('visible');
    } else {
        setActiveTool('tool2');
    }
});

drawToolBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (activeTool === 'draw') {
        // Toggle color palette visibility
        const colorPalette = document.getElementById('color-palette');
        colorPalette.classList.toggle('visible');
    } else {
        setActiveTool('draw');
    }
});

resetBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    resetMap();
});

// Undo/Redo functionality
function addToHistory(action) {
    // Don't add to history if this is an undo/redo action
    if (isUndoRedoAction) return;

    // Remove any redo history when a new action is performed
    historyStack = historyStack.slice(0, historyIndex + 1);

    // Add new action
    historyStack.push(action);

    // Limit history size
    if (historyStack.length > MAX_HISTORY) {
        historyStack.shift();
    } else {
        historyIndex++;
    }

    updateUndoRedoButtons();
}

function undo() {
    if (historyIndex < 0) return;

    isUndoRedoAction = true;
    const action = historyStack[historyIndex];

    switch (action.type) {
        case 'reveal':
        case 'fog':
            if (action.action === 'add') {
                revealShapes = revealShapes.filter(s => s.shapeId !== action.data.shapeId);
                rebuildMaskCanvas();
            }
            break;

        case 'marker':
            if (action.action === 'add') {
                // Remove the marker
                const marker = markers.find(m => m.id === action.data.id);
                if (marker) {
                    marker.element.remove();
                    marker.textElement.remove();
                    markers = markers.filter(m => m.id !== action.data.id);
                }
            } else if (action.action === 'remove') {
                // Re-add the marker
                const restored = addMarker(action.data.x, action.data.y, action.data.color, action.data.id);
                restored.name = action.data.name;
                restored.textElement.text(action.data.name);
            }
            break;

        case 'drawing':
            if (action.action === 'add') {
                // Remove the drawing
                drawingGroup.select(`#${action.data.id}`).remove();
                drawings = drawings.filter(d => d.id !== action.data.id);
            }
            break;
    }

    historyIndex--;
    isUndoRedoAction = false;
    saveToLocalStorage();
    updateUndoRedoButtons();
}

function redo() {
    if (historyIndex >= historyStack.length - 1) return;

    isUndoRedoAction = true;
    historyIndex++;
    const action = historyStack[historyIndex];

    switch (action.type) {
        case 'reveal':
        case 'fog':
            if (action.action === 'add') {
                revealShapes.push(action.data);
                rebuildMaskCanvas();
            }
            break;

        case 'marker':
            if (action.action === 'add') {
                // Re-add the marker
                const restored = addMarker(action.data.x, action.data.y, action.data.color, action.data.id);
                restored.name = action.data.name;
                restored.textElement.text(action.data.name);
            } else if (action.action === 'remove') {
                // Remove the marker again
                const marker = markers.find(m => m.id === action.data.id);
                if (marker) {
                    marker.element.remove();
                    marker.textElement.remove();
                    markers = markers.filter(m => m.id !== action.data.id);
                }
            }
            break;

        case 'drawing':
            if (action.action === 'add') {
                // Re-add the drawing
                drawingGroup.append("path")
                    .attr("id", action.data.id)
                    .attr("d", action.data.pathData)
                    .attr("fill", "none")
                    .attr("stroke", markerColors[action.data.color].stroke)
                    .attr("stroke-width", action.data.strokeWidth)
                    .attr("stroke-linecap", "round")
                    .attr("stroke-linejoin", "round")
                    .attr("class", "drawing-path");
                drawings.push(action.data);
            }
            break;
    }

    isUndoRedoAction = false;
    saveToLocalStorage();
    updateUndoRedoButtons();
}

function updateUndoRedoButtons() {
    // Check if buttons exist (may not be initialized yet)
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    if (!undoBtn || !redoBtn) return;

    if (historyIndex < 0) {
        undoBtn.style.opacity = '0.5';
        undoBtn.style.cursor = 'not-allowed';
    } else {
        undoBtn.style.opacity = '1';
        undoBtn.style.cursor = 'pointer';
    }

    if (historyIndex >= historyStack.length - 1) {
        redoBtn.style.opacity = '0.5';
        redoBtn.style.cursor = 'not-allowed';
    } else {
        redoBtn.style.opacity = '1';
        redoBtn.style.cursor = 'pointer';
    }
}

undoBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    undo();
});

redoBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    redo();
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            undo();
        } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
            e.preventDefault();
            redo();
        }
    }
});

// Initialize undo/redo buttons
updateUndoRedoButtons();

// Color palette functionality
const colorButtons = document.querySelectorAll('.color-button');
colorButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Remove active class from all buttons
        colorButtons.forEach(b => b.classList.remove('active'));
        // Add active class to clicked button
        btn.classList.add('active');
        // Update current marker color
        currentMarkerColor = btn.dataset.color;
        // Also update viewer ping color so viewers use the same palette
        viewerPingColor = btn.dataset.color;
    });
});

// Brush size slider functionality
const brushSlider = document.getElementById('brush-size-slider');
const brushSizeValue = document.getElementById('brush-size-value');
const brushPreview = document.getElementById('brush-preview');

function updateBrushSize(value) {
    const size = parseInt(value);
    config.revealRadius = size;
    brushIndicator.attr("r", size);
    brushSizeValue.textContent = size + 'px';

    // Update preview circle size (scale to fit in 36px container)
    const previewSize = Math.min(32, (size / 200) * 32);
    brushPreview.style.setProperty('--preview-size', previewSize + 'px');
}

brushSlider.addEventListener('input', (e) => {
    e.stopPropagation();
    updateBrushSize(e.target.value);
});

// Initialize preview circle size
brushPreview.style.setProperty('--preview-size', '10px');

// Initialize brush control visibility (reveal tool is active by default)
document.getElementById('brush-control').classList.add('visible');

// Upload overlay and file handling removed - maps are loaded via socket only

// Lobby button - goes back to home/lobby with confirmation
const lobbyBtn = document.getElementById('lobby-btn');
if (lobbyBtn) {
    lobbyBtn.addEventListener('click', (e) => {
        e.stopPropagation();

        // Show confirmation dialog
        const confirmed = confirm('Leave this room and return to lobby? This will disconnect you from the session.');
        if (!confirmed) return;

        // Disconnect from socket if connected
        if (socket) {
            socket.disconnect();
            socket = null;
        }

        // Redirect to lobby
        redirectToLobby();
    });
}

// Copy room ID button
document.addEventListener('DOMContentLoaded', () => {
    const copyBtn = document.getElementById('copy-room-btn');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const roomId = document.getElementById('room-id-display').textContent;
            const fullURL = window.location.origin + '/room/' + roomId;
            navigator.clipboard.writeText(fullURL).then(() => {
                copyBtn.textContent = 'Copied!';
                setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
            }).catch(() => {
                // Fallback
                copyBtn.textContent = roomId;
                setTimeout(() => { copyBtn.textContent = 'Copy'; }, 3000);
            });
        });
    }
});

// DOMContentLoaded for initialization
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        updateUIForRole();

        // Create palette toggle button in tool overlay (one-off)
        const toolOverlay = document.getElementById('tool-overlay');
        if (toolOverlay && !document.getElementById('palette-toggle-btn')) {
            const palBtn = document.createElement('button');
            palBtn.id = 'palette-toggle-btn';
            palBtn.className = 'tool-button';
            palBtn.title = 'Toggle Color Palette';
            palBtn.style.marginTop = '10px';
            palBtn.innerHTML = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"></circle></svg>`;
            palBtn.onclick = (e) => {
                e.stopPropagation();
                const palette = document.getElementById('color-palette');
                if (!palette) return;
                // toggle and set forced-open flag so updateUIForRole doesn't immediately hide it
                const willOpen = !palette.classList.contains('visible');
                palette.classList.toggle('visible');
                paletteForcedOpen = willOpen;
            };
            toolOverlay.appendChild(palBtn);
        }
    }, 50);
});

// createLobby function removed - room creation happens in lobby page only

function connectSocket(cb) {
    if (socket) return cb && cb();
    try {
        socket = io();
    } catch (e) {
        console.warn('Socket.IO not available');
        return;
    }
    socket.on('connect', () => {
        console.log('[ws] connected', socket.id);
        cb && cb();
    });

    socket.on('action', (action) => {
        // apply remote action (viewers) while suppressing local emits
        suppressLocalEvents = true;
        try {
            switch (action.type) {
                case 'setMap':
                    mapImageDataUrl = action.data.mapFile;
                    mapAspectRatio = action.data.mapAspectRatio || 1;
                    setupMapLayers();
                    break;
                case 'reveal':
                    // action.data contains normalized coordinates { nx, ny, nradius }
                    if (action.data && typeof action.data.nx === 'number') {
                        const pt = denormalizePoint(action.data.nx, action.data.ny);
                        const r = denormalizeRadius(action.data.nradius || 0);
                        const local = { x: pt.x, y: pt.y, radius: r, isFog: false, shapeId: action.data.shapeId };
                        revealShapes.push(local);
                        drawRevealOnMask(local.x, local.y, local.radius);
                        renderFogCanvas();
                    }
                    break;
                case 'fog':
                    if (action.data && typeof action.data.nx === 'number') {
                        const pt = denormalizePoint(action.data.nx, action.data.ny);
                        const r = denormalizeRadius(action.data.nradius || 0);
                        const local = { x: pt.x, y: pt.y, radius: r, isFog: true, shapeId: action.data.shapeId };
                        revealShapes.push(local);
                        drawFogOnMask(local.x, local.y, local.radius);
                        renderFogCanvas();
                    }
                    break;
                case 'markerAdd':
                    if (action.data && typeof action.data.nx === 'number') {
                        const p = denormalizePoint(action.data.nx, action.data.ny);
                        addMarker(p.x, p.y, action.data.color, action.data.id);
                    }
                    break;
                case 'markerRemove':
                    if (action.data && action.data.id) removeMarkerById(action.data.id);
                    break;
                case 'drawingAdd':
                    // recreate drawing path from normalized points
                    if (action.data && Array.isArray(action.data.points)) {
                        const pts = action.data.points.map(p => denormalizePoint(p.nx, p.ny));
                        const pathData = generateSmoothPath(pts.map(p => [p.x, p.y]));
                        drawingGroup.append('path')
                            .attr('id', action.data.id)
                            .attr('d', pathData)
                            .attr('fill', 'none')
                            .attr('stroke', markerColors[action.data.color].stroke)
                            .attr('stroke-width', (action.data.strokeWidthNorm || 0) * (mapDimensions.width || 1))
                            .attr('stroke-linecap', 'round')
                            .attr('stroke-linejoin', 'round')
                            .attr('class', 'drawing-path');
                        drawings.push({ id: action.data.id, points: pts.map(p => [p.x, p.y]), color: action.data.color, strokeWidth: (action.data.strokeWidthNorm || 0) * (mapDimensions.width || 1), pathData });
                    }
                    break;
                case 'reset':
                    // clear everything
                    revealShapes = [];
                    if (maskCanvas) {
                        const maskCtx = maskCanvas.getContext('2d');
                        maskCtx.globalCompositeOperation = 'source-over';
                        maskCtx.fillStyle = 'white';
                        maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
                        renderFogCanvas();
                    }
                    markersGroup.selectAll('*').remove();
                    markers = [];
                    drawingGroup.selectAll('*').remove();
                    drawings = [];
                    break;
            }
        } finally {
            suppressLocalEvents = false;
        }
    });

    socket.on('ping', (data) => {
        try {
            if (data && typeof data.nx === 'number') {
                showPingNormalized(data.nx, data.ny, data);
            }
        } catch (e) {
            console.warn('Failed to show ping', e);
        }
    });


    socket.on('ownerChanged', (data) => {
        if (socket.id === data.newOwner) {
            isOwner = true;
            alert('You are now the owner of the room.');
        } else {
            if (currentRoomId && rooms && rooms[currentRoomId]) {
                isOwner = false;
            }
        }
        updateUIForRole();
    });
}

// Join a room by id
function joinRoom(roomId, cb) {
    if (!socket) {
        connectSocket(() => joinRoom(roomId, cb));
        return;
    }
    socket.emit('joinRoom', roomId, (res) => {
        if (!res || !res.ok) {
            console.error('[joinRoom] Failed to join room:', res?.error);
            if (cb) cb({ ok: false, error: res && res.error });
            else redirectToLobby();
            return;
        }
        console.log('[joinRoom] Joined successfully, role:', res.role, 'hasSnapshot:', !!res.snapshot);
        currentRoomId = roomId;
        isOwner = (res.role === 'owner');

        // apply snapshot from server (denormalize handled in applyRemoteSnapshot)
        if (res.snapshot) applyRemoteSnapshot(res.snapshot);

        updateUIForRole();
        if (cb) cb({ ok: true, role: res.role });
    });
}

// Update UI depending on whether current client can edit
function updateUIForRole() {
    // Update room info display
    const roomInfo = document.getElementById('room-info');
    const roomIdDisplay = document.getElementById('room-id-display');
    if (currentRoomId && isOwner) {
        if (roomInfo) roomInfo.style.display = 'block';
        if (roomIdDisplay) roomIdDisplay.textContent = currentRoomId;
    } else {
        if (roomInfo) roomInfo.style.display = 'none';
    }

    // Elements to hide for viewers; viewers should only see the lobby and ping UI
    const toHide = [
        'reveal-tool', 'draw-tool',
        'undo-btn', 'redo-btn', 'reset-btn', 'brush-control'
    ];
    toHide.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        if (!canEdit()) {
            el.style.display = 'none';
        } else {
            // restore default display
            el.style.display = '';
        }
    });

    // If viewer, ensure lobby button remains visible
    const lobby = document.getElementById('lobby-btn');
    if (lobby) lobby.style.display = '';

    const viewer = (currentRoomId && !isOwner && !pendingJoin);

    // Palette toggle button visibility
    const paletteToggleBtn = document.getElementById('palette-toggle-btn');

    // If viewer, hide marker menu and show ping/color palette so viewers can ping
    if (viewer) {
        // Force color palette visible for viewers
        paletteForcedOpen = true;
        const colorPaletteEl = document.getElementById('color-palette');
        if (colorPaletteEl) {
            colorPaletteEl.classList.add('visible');
            colorPaletteEl.style.display = '';
        }

        // Show palette toggle for viewers
        if (paletteToggleBtn) paletteToggleBtn.style.display = '';

        // Hide marker tool and related toggle so viewers cannot access marker UI
        const markerBtn = document.getElementById('tool-2');
        if (markerBtn) { markerBtn.style.display = 'none'; }

        // Ensure lobby button remains visible
        const lobby = document.getElementById('lobby-btn');
        if (lobby) { lobby.style.display = ''; }

        return;
    }

    // Owner/non-viewer behavior
    // Hide palette toggle button for owners
    if (paletteToggleBtn) paletteToggleBtn.style.display = 'none';

    // For owners, don't force hide the palette - let the tool switching control it
    const colorPaletteEl = document.getElementById('color-palette');
    if (colorPaletteEl) {
        colorPaletteEl.style.display = '';  // Reset display to allow CSS visibility control
        // Remove visible class initially, but setActiveTool will add it when needed
        if (!paletteForcedOpen) {
            colorPaletteEl.classList.remove('visible');
        }
    }
}

function buildLocalSnapshot() {
    // Normalize all coordinates so snapshots are resolution-independent
    const normReveal = revealShapes.map(s => {
        // if already normalized (has nx), pass through
        if (typeof s.nx === 'number') return s;
        const p = normalizePoint(s.x, s.y);
        return { nx: p.nx, ny: p.ny, nradius: normalizeRadius(s.radius), isFog: s.isFog, shapeId: s.shapeId };
    });

    const normMarkers = markers.map(m => {
        const p = normalizePoint(m.x, m.y);
        return { id: m.id, nx: p.nx, ny: p.ny, color: m.color, name: m.name };
    });

    const normDrawings = drawings.map(d => ({ id: d.id, points: d.points.map(p => normalizePoint(p[0], p[1])), color: d.color, strokeWidthNorm: (d.strokeWidth || 1) / (mapDimensions.width || 1) }));

    return {
        mapFile: mapImageDataUrl,
        mapAspectRatio,
        revealShapes: normReveal,
        markers: normMarkers,
        drawings: normDrawings
    };
}

function applyRemoteSnapshot(snap) {
    if (!snap) return;
    console.log('[applyRemoteSnapshot] Received snapshot:', { hasMapFile: !!snap.mapFile, mapAspectRatio: snap.mapAspectRatio, revealShapesCount: snap.revealShapes?.length || 0, markersCount: snap.markers?.length || 0 });
    suppressLocalEvents = true;
    try {
        if (snap.mapFile) {
            console.log('[applyRemoteSnapshot] Loading map file, length:', snap.mapFile.length);
            mapImageDataUrl = snap.mapFile;
            mapAspectRatio = snap.mapAspectRatio || 1;
            setupMapLayers();
        } else {
            console.warn('[applyRemoteSnapshot] No map file in snapshot!');
        }
        if (snap.revealShapes) {
            // snap may contain normalized shapes (nx,ny,nradius) or absolute (x,y,radius)
            const denorm = snap.revealShapes.map(s => {
                if (typeof s.nx === 'number') {
                    const pt = denormalizePoint(s.nx, s.ny);
                    return { x: pt.x, y: pt.y, radius: denormalizeRadius(s.nradius || 0), isFog: s.isFog, shapeId: s.shapeId };
                } else {
                    return { x: s.x, y: s.y, radius: s.radius, isFog: s.isFog, shapeId: s.shapeId };
                }
            });
            revealShapes = denorm;
            rebuildMaskCanvas();
        }
        if (snap.markers) {
            drawingGroup.selectAll('*');
            markersGroup.selectAll('*').remove();
            markers = [];
            snap.markers.forEach(m => {
                if (typeof m.nx === 'number') {
                    const pt = denormalizePoint(m.nx, m.ny);
                    addMarker(pt.x, pt.y, m.color, m.id);
                } else if (typeof m.x === 'number') {
                    addMarker(m.x, m.y, m.color, m.id);
                }
            });
        }
        if (snap.drawings) {
            drawingGroup.selectAll('*').remove();
            drawings = [];
            snap.drawings.forEach(d => {
                if (Array.isArray(d.points) && d.points.length && typeof d.points[0].nx === 'number') {
                    const pts = d.points.map(p => denormalizePoint(p.nx, p.ny));
                    const pathData = generateSmoothPath(pts.map(p => [p.x, p.y]));
                    const strokeW = (d.strokeWidthNorm || 0) * (mapDimensions.width || 1);
                    drawingGroup.append('path')
                        .attr('id', d.id)
                        .attr('d', pathData)
                        .attr('fill', 'none')
                        .attr('stroke', markerColors[d.color].stroke)
                        .attr('stroke-width', strokeW)
                        .attr('stroke-linecap', 'round')
                        .attr('stroke-linejoin', 'round')
                        .attr('class', 'drawing-path');
                    drawings.push({ id: d.id, points: pts.map(p => [p.x, p.y]), color: d.color, strokeWidth: strokeW, pathData });
                } else if (d.pathData) {
                    drawingGroup.append('path')
                        .attr('id', d.id)
                        .attr('d', d.pathData)
                        .attr('fill', 'none')
                        .attr('stroke', markerColors[d.color].stroke)
                        .attr('stroke-width', d.strokeWidth)
                        .attr('stroke-linecap', 'round')
                        .attr('stroke-linejoin', 'round')
                        .attr('class', 'drawing-path');
                    drawings.push(d);
                }
            });
        }
    } finally {
        suppressLocalEvents = false;
    }
}

// Overlay dismiss functionality removed - no upload overlay on map page
