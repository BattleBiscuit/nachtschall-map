// Canvas 2D filter support detection (ctx.filter not available in Safari < 18)
const supportsCanvasFilter = (() => {
    try {
        const ctx = document.createElement('canvas').getContext('2d');
        ctx.filter = 'blur(1px)';
        return ctx.filter === 'blur(1px)';
    } catch (e) {
        return false;
    }
})();

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
    blue:   { fill: '#2e5fa3', border: '#111e3a', stroke: '#4a88cc', ornament: '#c9a961' },
    red:    { fill: '#8b1e1e', border: '#3a0808', stroke: '#cc3333', ornament: '#c9a961' },
    green:  { fill: '#1e6b2e', border: '#092e14', stroke: '#2eaa44', ornament: '#c9a961' },
    yellow: { fill: '#9a7c12', border: '#3d3008', stroke: '#c9a920', ornament: '#1a1410' },
    purple: { fill: '#6b1e8b', border: '#280b38', stroke: '#9933cc', ornament: '#c9a961' },
    orange: { fill: '#9a4a12', border: '#3d1c08', stroke: '#cc6622', ornament: '#c9a961' },
    cyan:   { fill: '#1e7a8b', border: '#083038', stroke: '#2aaacc', ornament: '#c9a961' },
    pink:   { fill: '#8b1e55', border: '#380822', stroke: '#cc3377', ornament: '#c9a961' }
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

// Map layers (below fog)
const mapGroup = g.append("g").attr("class", "map-layer");
const fogGroup = g.append("g").attr("class", "fog-layer");

// Separate SVG that sits above the fog canvas (z-index > fog)
const overlaySvg = mainContainer.append("svg")
    .attr("width", window.innerWidth)
    .attr("height", window.innerHeight)
    .style("pointer-events", "none");

// Shared gradient/filter definitions for 3D chip marker appearance
const overlayDefs = overlaySvg.append("defs");

// Helpers: mix hex color toward white (lighten) or black (darken)
function lightenHex(hex, t) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `#${Math.min(255,Math.round(r+(255-r)*t)).toString(16).padStart(2,'0')}${Math.min(255,Math.round(g+(255-g)*t)).toString(16).padStart(2,'0')}${Math.min(255,Math.round(b+(255-b)*t)).toString(16).padStart(2,'0')}`;
}
function darkenHex(hex, t) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `#${Math.max(0,Math.round(r*(1-t))).toString(16).padStart(2,'0')}${Math.max(0,Math.round(g*(1-t))).toString(16).padStart(2,'0')}${Math.max(0,Math.round(b*(1-t))).toString(16).padStart(2,'0')}`;
}

// Drop shadow filter — softer and more diffuse than a wax seal (chips sit flat)
const _shadowFilter = overlayDefs.append("filter")
    .attr("id", "marker-shadow")
    .attr("x", "-60%").attr("y", "-60%")
    .attr("width", "220%").attr("height", "220%");
_shadowFilter.append("feDropShadow")
    .attr("dx", "0").attr("dy", "4")
    .attr("stdDeviation", "4")
    .attr("flood-color", "rgba(0,0,0,0.6)");

// Per-color gradients for the chip face and beveled edge
Object.entries(markerColors).forEach(([name, c]) => {
    // Face: linear top→bottom, subtle — chips are flat, not spherical
    const faceGrad = overlayDefs.append("linearGradient")
        .attr("id", `marker-face-${name}`)
        .attr("x1", "0").attr("y1", "0").attr("x2", "0").attr("y2", "1");
    faceGrad.append("stop").attr("offset", "0%")
        .attr("stop-color", lightenHex(c.fill, 0.10));
    faceGrad.append("stop").attr("offset", "55%")
        .attr("stop-color", c.fill);
    faceGrad.append("stop").attr("offset", "100%")
        .attr("stop-color", darkenHex(c.fill, 0.12));

    // Rim bevel: linear top→bottom — lighter top catching light, darker bottom in shadow
    const rimGrad = overlayDefs.append("linearGradient")
        .attr("id", `marker-rim-${name}`)
        .attr("x1", "0").attr("y1", "0").attr("x2", "0").attr("y2", "1");
    rimGrad.append("stop").attr("offset", "0%")
        .attr("stop-color", lightenHex(c.border, 0.35));
    rimGrad.append("stop").attr("offset", "40%")
        .attr("stop-color", c.border);
    rimGrad.append("stop").attr("offset", "100%")
        .attr("stop-color", darkenHex(c.border, 0.3));
});

const overlayG = overlaySvg.append("g");

// Map layers (above fog)
const markersGroup = overlayG.append("g").attr("class", "markers-layer");
const drawingGroup = overlayG.append("g").attr("class", "drawing-layer");

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

// Generate CSS polygon for torn paper edges
function generateTornEdgePolygon(width, height) {
    const tearSize = 12; // Maximum depth of tears in pixels
    const tearFreq = 25; // Approximate distance between tears in pixels

    const points = [];

    // Top edge (left to right)
    for (let x = 0; x <= width; x += tearFreq) {
        const actualX = Math.min(x, width);
        const tear = Math.random() * tearSize - tearSize / 2;
        points.push(`${actualX}px ${Math.max(0, tear)}px`);
    }

    // Right edge (top to bottom)
    for (let y = tearFreq; y <= height; y += tearFreq) {
        const actualY = Math.min(y, height);
        const tear = Math.random() * tearSize - tearSize / 2;
        points.push(`${Math.min(width, width + tear)}px ${actualY}px`);
    }

    // Bottom edge (right to left)
    for (let x = width - tearFreq; x >= 0; x -= tearFreq) {
        const actualX = Math.max(x, 0);
        const tear = Math.random() * tearSize - tearSize / 2;
        points.push(`${actualX}px ${Math.min(height, height + tear)}px`);
    }

    // Left edge (bottom to top)
    for (let y = height - tearFreq; y > 0; y -= tearFreq) {
        const actualY = Math.max(y, 0);
        const tear = Math.random() * tearSize - tearSize / 2;
        points.push(`${Math.max(0, tear)}px ${actualY}px`);
    }

    return `polygon(${points.join(', ')})`;
}

// Set up map and fog layers from the stored image data URL
function setupMapLayers() {
    if (!mapImageDataUrl) return;

    // Map padding: leave space for UI elements - responsive based on viewport
    const isMobile = window.innerWidth <= 768;
    const isSmallMobile = window.innerWidth <= 480;

    let mapPadding;
    if (isSmallMobile) {
        // Mobile portrait: corners (home top-left, reset top-right, undo/redo bottom)
        // Room info top center, tools bottom center
        mapPadding = { left: 10, right: 10, top: 70, bottom: 145 };
    } else if (isMobile) {
        // Tablet: same corner layout with slightly more space
        mapPadding = { left: 15, right: 15, top: 75, bottom: 155 };
    } else {
        // Desktop: left panel (~185px wide) holds sidebar controls; bottom has tool overlay (~110px)
        mapPadding = { left: 185, right: 40, top: 40, bottom: 110 };
    }

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

    // Generate torn paper edge polygon
    const tornEdge = generateTornEdgePolygon(imgWidth, imgHeight);

    mapWrapper.style.cssText = `position:fixed;left:${imgX}px;top:${imgY}px;width:${imgWidth}px;height:${imgHeight}px;pointer-events:none;overflow:visible;clip-path:${tornEdge};`;
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

    // Place overlay SVG (markers + drawings) above fog canvas
    overlaySvg.attr("width", imgWidth)
        .attr("height", imgHeight)
        .style("position", "absolute")
        .style("left", "0")
        .style("top", "0")
        .style("z-index", "20");
    mapWrapper.appendChild(overlaySvg.node());
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

// Add paper grain texture overlay to fog
function addPaperTexture(ctx, width, height) {
    // Create subtle paper grain using random noise
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        // Add subtle random noise to create paper grain (±3% variation)
        const noise = (Math.random() - 0.5) * 15;
        data[i] = Math.min(255, Math.max(0, data[i] + noise));     // R
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise)); // G
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise)); // B
    }

    ctx.putImageData(imageData, 0, 0);

    // Add parchment color tint overlay
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgba(232, 215, 184, 0.3)'; // Warm parchment tint
    ctx.fillRect(0, 0, width, height);

    // Add subtle vignette darkening at edges
    ctx.globalCompositeOperation = 'source-over';
    const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) / 1.5);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(0.7, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, 'rgba(58, 47, 31, 0.15)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.globalCompositeOperation = 'source-over';
}

function setupFogSystem() {
    // (Re-)create the visible fog canvas - sized and positioned to match map bounds
    const existing = document.getElementById('fog-canvas');
    if (existing) existing.remove();
    fogCanvas = document.createElement('canvas');
    fogCanvas.id = 'fog-canvas';

    // Size canvas to match map dimensions
    fogCanvas.width = Math.ceil(mapDimensions.width);
    fogCanvas.height = Math.ceil(mapDimensions.height);

    // Position canvas inside the map wrapper at (0,0) - same coordinate system as SVG.
    // On Safari < 18 (no ctx.filter support), apply a CSS desaturate/darken filter as
    // a visual fallback so fog is still clearly distinguishable from the revealed map.
    const cssFallbackFilter = !supportsCanvasFilter ? 'saturate(0.5) brightness(0.75)' : 'none';
    fogCanvas.style.cssText = `position:absolute;left:0;top:0;width:${mapDimensions.width}px;height:${mapDimensions.height}px;pointer-events:none;z-index:10;filter:${cssFallbackFilter};`;
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
        // Blur amount relative to map width for consistent appearance across devices.
        // ctx.filter is not supported in Safari < 18; we fall back to CSS filter on the
        // visible fogCanvas (applied in setupFogSystem).
        const blurPx = Math.max(40, Math.round(mapDimensions.width * 0.08));
        if (supportsCanvasFilter) {
            ctx.filter = `blur(${blurPx}px)`;
        }
        ctx.drawImage(img, 0, 0, fW, fH);
        if (supportsCanvasFilter) {
            ctx.filter = 'none';
        }

        // Add paper texture overlay for aged parchment look
        addPaperTexture(ctx, fW, fH);

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
    const mx = x - fogTextureDims.x;
    const my = y - fogTextureDims.y;
    maskCtx.globalCompositeOperation = 'destination-out';

    // Create irregular polygon with smoother variations (like torn paper, not spiky)
    const numPoints = 30 + Math.floor(Math.random() * 10); // More points = smoother
    maskCtx.beginPath();

    for (let i = 0; i <= numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;
        // Bigger variance for more pronounced torn edges (0.65-1.0 range)
        const variance = 0.65 + Math.random() * 0.35;
        const r = radius * variance;
        // Moderate angle offset for natural curves without spikes
        const angleOffset = (Math.random() - 0.5) * 0.15;
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

    // Add soft feathering on edges for natural look
    maskCtx.shadowColor = 'rgba(0,0,0,0.4)';
    maskCtx.shadowBlur = 5;
    maskCtx.fill();
    maskCtx.shadowBlur = 0;

    maskCtx.globalCompositeOperation = 'source-over';
}

// Paint fog back into the mask with the same torn edge style as reveal
function drawFogOnMask(x, y, radius) {
    const maskCtx = maskCanvas.getContext('2d');
    const mx = x - fogTextureDims.x;
    const my = y - fogTextureDims.y;
    maskCtx.globalCompositeOperation = 'source-over';

    // Create irregular polygon with same style as reveal (torn paper edges)
    const numPoints = 30 + Math.floor(Math.random() * 10); // Same as reveal
    maskCtx.beginPath();

    for (let i = 0; i <= numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;
        // Same variance as reveal (0.65-1.0 range)
        const variance = 0.65 + Math.random() * 0.35;
        const r = radius * variance;
        // Same angle offset for natural curves
        const angleOffset = (Math.random() - 0.5) * 0.15;
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
    maskCtx.fillStyle = 'rgba(255,255,255,1)';
    maskCtx.fill();

    // Add soft feathering on edges to match reveal
    maskCtx.shadowColor = 'rgba(255,255,255,0.4)';
    maskCtx.shadowBlur = 5;
    maskCtx.fill();
    maskCtx.shadowBlur = 0;

    maskCtx.globalCompositeOperation = 'source-over';
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

// Function to add a marker (medieval wax-seal token)
function addMarker(x, y, color = null, providedId = null) {
    if (!canEdit() && !suppressLocalEvents) return;
    let markerId;
    if (providedId) {
        markerId = providedId;
        const m = /marker-(\d+)/.exec(providedId);
        if (m) markerIdCounter = Math.max(markerIdCounter, parseInt(m[1], 10) + 1);
    } else {
        markerId = `marker-${markerIdCounter++}`;
    }
    const R = Math.min(mapDimensions.width, mapDimensions.height) / 50;
    const markerColor = color || currentMarkerColor;
    const colors = markerColors[markerColor];
    const gold = '#c9a961';
    const outerR = R * 1.28;
    const innerR = R * 0.68;
    const d = R * 0.3;

    // Marker group — positioned via SVG transform so all children move together
    const markerGroup = markersGroup.append("g")
        .attr("id", markerId)
        .attr("class", "marker")
        .attr("transform", `translate(${x}, ${y}) scale(0)`)
        .attr("data-color", markerColor)
        .attr("filter", "url(#marker-shadow)")
        .style("cursor", "inherit")
        .style("pointer-events", "auto");

    const sideH = Math.max(3, R * 0.2); // visible chip thickness

    // Chip thickness — same disc offset downward to show the side edge
    markerGroup.append("circle")
        .attr("r", outerR)
        .attr("cy", sideH)
        .attr("fill", colors.border);

    // Beveled outer rim (lighter top, darker bottom — the rim of the disc)
    markerGroup.append("circle")
        .attr("r", outerR)
        .attr("fill", `url(#marker-rim-${markerColor})`)
        .attr("class", "marker-outer");

    // Chip face — flat linear gradient (slightly lighter top, slightly darker bottom)
    markerGroup.append("circle")
        .attr("r", R)
        .attr("fill", `url(#marker-face-${markerColor})`)
        .attr("class", "marker-body");

    // Inner gold inlay ring (like the decorative stripe on a casino chip)
    markerGroup.append("circle")
        .attr("r", innerR)
        .attr("fill", "none")
        .attr("stroke", gold)
        .attr("stroke-width", Math.max(1.5, R * 0.09))
        .attr("class", "marker-ring")
        .attr("pointer-events", "none");

    // Center diamond ornament
    markerGroup.append("path")
        .attr("d", `M 0,${-d} L ${d},0 L 0,${d} L ${-d},0 Z`)
        .attr("fill", colors.ornament)
        .attr("class", "marker-ornament")
        .attr("pointer-events", "none");

    // Sheen band — broad horizontal highlight across upper face (resin/plastic chip look)
    markerGroup.append("ellipse")
        .attr("cx", 0).attr("cy", -R * 0.32)
        .attr("rx", R * 0.62).attr("ry", R * 0.2)
        .attr("fill", "rgba(255,255,255,0.10)")
        .attr("pointer-events", "none");

    // Text label (inside group, so it moves with the token)
    const markerText = markerGroup.append("text")
        .attr("x", 0)
        .attr("y", outerR + Math.max(12, R * 0.7))
        .attr("text-anchor", "middle")
        .attr("class", "marker-label")
        .attr("fill", "#f4e8d0")
        .attr("font-size", `${Math.max(10, R * 0.6)}px`)
        .attr("font-family", "Cinzel, serif")
        .attr("font-weight", "600")
        .attr("stroke", "#1a1410")
        .attr("stroke-width", "3")
        .attr("paint-order", "stroke")
        .style("pointer-events", "none")
        .style("user-select", "none")
        .text("");

    // Animate appearance (scale from 0 to 1)
    markerGroup.transition()
        .duration(200)
        .attr("transform", `translate(${x}, ${y})`);

    const markerData = { id: markerId, x, y, color: markerColor, name: "", element: markerGroup, textElement: markerText };
    markers.push(markerData);

    // Drag behavior (active only in marker mode)
    const drag = d3.drag()
        .filter(function(event) {
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
                const [newX, newY] = d3.pointer(event, overlayG.node());
                d3.select(this).attr("transform", `translate(${newX}, ${newY})`);
                markerData.x = newX;
                markerData.y = newY;
            }
        })
        .on("end", function(event) {
            if (activeTool === 'tool2') {
                d3.select(this).style("cursor", "grab");
                saveToLocalStorage();
                setTimeout(() => { markerData.isDragging = false; }, 50);
            }
        });

    markerGroup.call(drag);

    // Double-click to edit name and color
    markerGroup.on("dblclick", function(event) {
        if (activeTool === 'tool2' && canEdit()) {
            event.stopPropagation();

            let selectedDialogColor = markerData.color;

            const overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:10000;display:flex;align-items:center;justify-content:center;-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);';

            const modal = document.createElement('div');
            modal.style.cssText = 'background:linear-gradient(to right,#c9b79c 0%,#e8d7b8 5%,#f4e8d0 50%,#e8d7b8 95%,#c9b79c 100%);padding:32px;border-radius:8px;border:3px solid #3d2f1f;box-shadow:0 12px 40px rgba(0,0,0,0.7),inset 0 0 40px rgba(139,30,30,0.06);max-width:360px;width:90%;box-sizing:border-box;';

            const title = document.createElement('h3');
            title.textContent = 'Edit Token';
            title.style.cssText = 'font-family:"Cinzel",serif;font-weight:700;color:#1a1410;margin:0 0 24px;text-align:center;font-size:15px;letter-spacing:2px;text-transform:uppercase;border-bottom:2px solid #3d2f1f;padding-bottom:14px;';
            modal.appendChild(title);

            const nameLabel = document.createElement('label');
            nameLabel.textContent = 'Name';
            nameLabel.style.cssText = 'display:block;margin-bottom:8px;font-weight:600;color:#1a1410;font-size:11px;font-family:"Cinzel",serif;text-transform:uppercase;letter-spacing:1px;';
            modal.appendChild(nameLabel);

            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.id = 'marker-name-input';
            nameInput.value = markerData.name || '';
            nameInput.style.cssText = 'width:100%;padding:10px 14px;border:2px solid #3d2f1f;border-radius:4px;font-size:14px;font-family:"IM Fell English",serif;background:rgba(244,232,208,0.8);color:#1a1410;outline:none;box-shadow:inset 0 2px 4px rgba(0,0,0,0.1);margin-bottom:20px;box-sizing:border-box;';
            nameInput.onfocus = () => { nameInput.style.borderColor = '#8b1e1e'; nameInput.style.background = '#f4e8d0'; };
            nameInput.onblur  = () => { nameInput.style.borderColor = '#3d2f1f'; nameInput.style.background = 'rgba(244,232,208,0.8)'; };
            modal.appendChild(nameInput);

            const colorLabel = document.createElement('label');
            colorLabel.textContent = 'Seal Color';
            colorLabel.style.cssText = 'display:block;margin-bottom:10px;font-weight:600;color:#1a1410;font-size:11px;font-family:"Cinzel",serif;text-transform:uppercase;letter-spacing:1px;';
            modal.appendChild(colorLabel);

            const colorGrid = document.createElement('div');
            colorGrid.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px;';
            Object.keys(markerColors).forEach(colorKey => {
                const swatch = document.createElement('button');
                swatch.dataset.color = colorKey;
                swatch.className = 'color-option';
                const sel = colorKey === selectedDialogColor;
                swatch.style.cssText = `width:34px;height:34px;border-radius:50%;border:3px solid ${sel ? gold : '#3d2f1f'};background:${markerColors[colorKey].fill};cursor:pointer;box-shadow:${sel ? `0 0 10px rgba(201,169,97,0.6),0 2px 4px rgba(0,0,0,0.5)` : '0 2px 4px rgba(0,0,0,0.5)'};transition:all 0.15s;`;
                swatch.onclick = () => {
                    selectedDialogColor = colorKey;
                    colorGrid.querySelectorAll('.color-option').forEach(b => {
                        const active = b.dataset.color === selectedDialogColor;
                        b.style.border = `3px solid ${active ? gold : '#3d2f1f'}`;
                        b.style.boxShadow = active ? '0 0 10px rgba(201,169,97,0.6),0 2px 4px rgba(0,0,0,0.5)' : '0 2px 4px rgba(0,0,0,0.5)';
                    });
                };
                colorGrid.appendChild(swatch);
            });
            modal.appendChild(colorGrid);

            const buttons = document.createElement('div');
            buttons.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;';

            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Cancel';
            cancelBtn.style.cssText = 'padding:10px 20px;border:2px solid #2a1f15;background:linear-gradient(145deg,#4a3829,#3d2f1f);color:#f4e8d0;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;font-family:"Cinzel",serif;text-transform:uppercase;letter-spacing:0.5px;box-shadow:0 3px 6px rgba(0,0,0,0.4);';
            cancelBtn.onclick = () => document.body.removeChild(overlay);

            const saveBtn = document.createElement('button');
            saveBtn.textContent = 'Save';
            saveBtn.style.cssText = 'padding:10px 20px;border:2px solid #5a1416;background:linear-gradient(145deg,#9b2226,#7a1b1e);color:#f4e8d0;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;font-family:"Cinzel",serif;text-transform:uppercase;letter-spacing:0.5px;box-shadow:0 3px 6px rgba(0,0,0,0.4);';
            saveBtn.onclick = () => {
                markerData.name = nameInput.value;
                markerData.textElement.text(markerData.name);

                if (selectedDialogColor !== markerData.color) {
                    markerData.color = selectedDialogColor;
                    const newColors = markerColors[selectedDialogColor];
                    markerData.element.attr("data-color", selectedDialogColor);
                    markerData.element.select('.marker-outer').attr("fill", `url(#marker-rim-${selectedDialogColor})`);
                    markerData.element.select('.marker-body').attr("fill", `url(#marker-face-${selectedDialogColor})`);
                    markerData.element.select('.marker-ornament').attr("fill", newColors.ornament);
                }

                saveToLocalStorage();
                document.body.removeChild(overlay);
            };

            buttons.appendChild(cancelBtn);
            buttons.appendChild(saveBtn);
            modal.appendChild(buttons);
            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            overlay.addEventListener('click', (e) => { if (e.target === overlay) document.body.removeChild(overlay); });
            setTimeout(() => nameInput.focus(), 100);
            nameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') saveBtn.click(); });
        }
    });

    if (!markerData.isLoading) {
        addToHistory({ type: 'marker', action: 'add', data: { id: markerId, x, y, color: markerColor, name: "" } });
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
            .attr("transform", `translate(${marker.x}, ${marker.y}) scale(0)`)
            .style("opacity", 0)
            .remove();

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
        .attr("transform", `translate(${marker.x}, ${marker.y}) scale(0)`)
        .style("opacity", 0)
        .remove();

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
        // Allow wheel zoom
        if (event.type === 'wheel') return true;

        // Allow touch gestures (pinch-to-zoom, two-finger pan)
        if (event.type === 'touchstart' || event.type === 'touchmove' || event.type === 'touchend') {
            // Only allow zoom/pan gestures with 2+ fingers
            // Single finger is reserved for drawing/revealing
            return event.touches && event.touches.length >= 2;
        }

        // Allow pan with middle mouse button (desktop)
        if (event.type === 'mousedown' || event.type === 'mousemove') {
            return event.button === 1 || isMiddleMouseDown;
        }

        return false;
    })
    .on("zoom", (event) => {
        g.attr("transform", event.transform);
        overlayG.attr("transform", event.transform);
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
    const isTouch = event.type === 'touchstart';

    // Prevent default touch behavior to avoid scrolling during draw/reveal
    if (isTouch && canEdit()) {
        event.preventDefault();
    }

    if (!isTouch && event.button === 1) {
        // Middle mouse button - for panning
        event.preventDefault();
        isMiddleMouseDown = true;
        mainContainer.node().classList.add('panning');
    } else {
        // Touch or left/right mouse button
        // Block editing interactions for viewers (allow middle mouse panning above)
        if (!canEdit()) return;

        if (!isTouch && event.button === 2) {
            // Right mouse button (desktop only)
            isRightMouseDown = true;
        } else if (isTouch || event.button === 0) {
            // Touch or left mouse button
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
        mainContainer.node().classList.remove('panning');
    }

    // End drawing if in draw mode
    if (activeTool === 'draw' && isDrawing) {
        endDrawing();
    }

    isMouseDown = false;
    isRightMouseDown = false;
});

svg.on("mousemove touchmove", function(event) {
    const isTouch = event.type === 'touchmove';

    // Prevent scrolling during touch interactions when editing
    if (isTouch && canEdit() && (isMouseDown || isDrawing)) {
        event.preventDefault();
    }

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
                // Right mouse - add fog (desktop only)
                addFog(x, y);
            } else {
                // Left mouse or touch - reveal
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
    // Recalculate map layout for new viewport size
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
        positionControlAboveButton(brushControl, revealToolBtn);
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
        positionControlAboveButton(colorPalette, tool2Btn);
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
        positionControlAboveButton(colorPalette, drawToolBtn);
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

// Position control next to a button.
// Left-panel buttons on desktop: opens to the right.
// Bottom-toolbar buttons or mobile: opens above, centered.
function positionControlAboveButton(control, button) {
    const buttonRect = button.getBoundingClientRect();
    const inLeftPanel = !!button.closest('#left-panel');

    if (window.innerWidth > 768 && inLeftPanel) {
        const left = buttonRect.right + 12;
        const top = buttonRect.top + buttonRect.height / 2;
        control.style.left = `${left}px`;
        control.style.top = `${top}px`;
        control.style.bottom = '';
        control.style.transform = 'translateY(-50%)';
    } else {
        const left = buttonRect.left + buttonRect.width / 2;
        const bottom = window.innerHeight - buttonRect.top + 10;
        control.style.left = `${left}px`;
        control.style.bottom = `${bottom}px`;
        control.style.top = '';
        control.style.transform = 'translateX(-50%)';
    }
}

revealToolBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (activeTool === 'reveal') {
        // Toggle brush control visibility
        const brushControl = document.getElementById('brush-control');
        if (brushControl.classList.contains('visible')) {
            brushControl.classList.remove('visible');
        } else {
            positionControlAboveButton(brushControl, revealToolBtn);
            brushControl.classList.add('visible');
        }
    } else {
        setActiveTool('reveal');
    }
});

tool2Btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (activeTool === 'tool2') {
        // Toggle color palette visibility
        const colorPalette = document.getElementById('color-palette');
        if (colorPalette.classList.contains('visible')) {
            colorPalette.classList.remove('visible');
        } else {
            positionControlAboveButton(colorPalette, tool2Btn);
            colorPalette.classList.add('visible');
        }
    } else {
        setActiveTool('tool2');
    }
});

drawToolBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (activeTool === 'draw') {
        // Toggle color palette visibility
        const colorPalette = document.getElementById('color-palette');
        if (colorPalette.classList.contains('visible')) {
            colorPalette.classList.remove('visible');
        } else {
            positionControlAboveButton(colorPalette, drawToolBtn);
            colorPalette.classList.add('visible');
        }
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
    // Update room info display - show for everyone in a room
    const roomInfo = document.getElementById('room-info');
    const roomIdDisplay = document.getElementById('room-id-display');
    console.log('[updateUIForRole] currentRoomId:', currentRoomId, 'roomInfo:', !!roomInfo, 'roomIdDisplay:', !!roomIdDisplay);
    if (currentRoomId) {
        if (roomInfo) {
            roomInfo.style.display = 'block';
            console.log('[updateUIForRole] Showing room info');
        }
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

// === Initiative Tracker ===
const initiativeSheet = document.getElementById('initiative-sheet');
const initiativeBtn = document.getElementById('initiative-btn');
const initiativeTBody = document.getElementById('initiative-tbody');
const initiativeEmpty = document.getElementById('initiative-empty');

let isDraggingInitiative = false;
let initiativeOffset = { x: 0, y: 0 };
let draggedMarkerToken = null;
let initiativeRounds = 3; // Start with 3 rounds
let markerRoundAssignments = {}; // { markerId: roundIndex }

// Toggle initiative overlay
initiativeBtn.addEventListener('click', () => {
    const isVisible = initiativeSheet.style.display === 'block';
    initiativeSheet.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) {
        updateInitiativeTable();
    }
});


// Make initiative sheet draggable
initiativeSheet.addEventListener('mousedown', (e) => {
    if (e.target.closest('button') || e.target.closest('.initiative-marker-token')) {
        return;
    }
    isDraggingInitiative = true;
    const rect = initiativeSheet.getBoundingClientRect();
    initiativeOffset.x = e.clientX - rect.left;
    initiativeOffset.y = e.clientY - rect.top;
    e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
    if (!isDraggingInitiative) return;

    const newLeft = e.clientX - initiativeOffset.x;
    const newTop = e.clientY - initiativeOffset.y;

    const maxLeft = window.innerWidth - initiativeSheet.offsetWidth;
    const maxTop = window.innerHeight - initiativeSheet.offsetHeight;

    initiativeSheet.style.left = Math.max(0, Math.min(newLeft, maxLeft)) + 'px';
    initiativeSheet.style.top = Math.max(0, Math.min(newTop, maxTop)) + 'px';
    initiativeSheet.style.bottom = 'auto';
    initiativeSheet.style.right = 'auto';
});

document.addEventListener('mouseup', () => {
    isDraggingInitiative = false;
});

// Touch support for dragging sheet
initiativeSheet.addEventListener('touchstart', (e) => {
    if (e.target.closest('button') || e.target.closest('.initiative-marker-token')) {
        return;
    }
    const touch = e.touches[0];
    const rect = initiativeSheet.getBoundingClientRect();

    isDraggingInitiative = true;
    initiativeOffset.x = touch.clientX - rect.left;
    initiativeOffset.y = touch.clientY - rect.top;
    e.preventDefault();
});

document.addEventListener('touchmove', (e) => {
    if (!isDraggingInitiative) return;

    const touch = e.touches[0];
    const newLeft = touch.clientX - initiativeOffset.x;
    const newTop = touch.clientY - initiativeOffset.y;

    const maxLeft = window.innerWidth - initiativeSheet.offsetWidth;
    const maxTop = window.innerHeight - initiativeSheet.offsetHeight;

    initiativeSheet.style.left = Math.max(0, Math.min(newLeft, maxLeft)) + 'px';
    initiativeSheet.style.top = Math.max(0, Math.min(newTop, maxTop)) + 'px';
    initiativeSheet.style.bottom = 'auto';
    initiativeSheet.style.right = 'auto';
});

document.addEventListener('touchend', () => {
    isDraggingInitiative = false;
});

// Update initiative table with current markers
function updateInitiativeTable() {
    // Clear tbody
    initiativeTBody.innerHTML = '';

    if (markers.length === 0) {
        initiativeEmpty.style.display = 'block';
        document.getElementById('initiative-table').style.display = 'none';
        return;
    }

    initiativeEmpty.style.display = 'none';
    document.getElementById('initiative-table').style.display = 'table';

    // Create a row for each round (vertical layout)
    for (let roundIdx = 0; roundIdx < initiativeRounds; roundIdx++) {
        const row = document.createElement('tr');

        // Round number header cell
        const headerCell = document.createElement('th');
        headerCell.textContent = `${roundIdx + 1}`;
        row.appendChild(headerCell);

        // Markers cell
        const roundCell = document.createElement('td');
        roundCell.className = 'initiative-round-cell';
        roundCell.dataset.round = roundIdx;

        // Add markers assigned to this round
        markers.forEach(marker => {
            if (markerRoundAssignments[marker.id] === roundIdx) {
                const token = createMarkerToken(marker);
                roundCell.appendChild(token);
            }
        });

        // Make cell a drop zone
        roundCell.addEventListener('dragover', handleRoundDragOver);
        roundCell.addEventListener('drop', handleRoundDrop);

        row.appendChild(roundCell);
        initiativeTBody.appendChild(row);
    }

    // Add + Round button row
    const addRoundRow = document.createElement('tr');
    const addRoundCell = document.createElement('td');
    addRoundCell.setAttribute('colspan', '2');
    addRoundCell.style.textAlign = 'center';
    addRoundCell.style.padding = '8px';
    addRoundCell.innerHTML = '<button class="add-round-btn" onclick="addInitiativeRound()">+</button>';
    addRoundRow.appendChild(addRoundCell);
    initiativeTBody.appendChild(addRoundRow);

    // Add unassigned markers to round 0 if they don't have an assignment
    markers.forEach(marker => {
        if (markerRoundAssignments[marker.id] === undefined) {
            markerRoundAssignments[marker.id] = 0;
            const firstRoundCell = initiativeTBody.querySelector('td[data-round="0"]');
            if (firstRoundCell) {
                const token = createMarkerToken(marker);
                firstRoundCell.appendChild(token);
            }
        }
    });
}

function createMarkerToken(marker) {
    const token = document.createElement('div');
    token.className = 'initiative-marker-token';
    token.draggable = true;
    token.dataset.markerId = marker.id;

    const colors = markerColors[marker.color];
    const gold = '#c9a961';
    const R = 16; // Base radius for initiative tracker
    const outerR = R * 1.28;
    const innerR = R * 0.68;
    const d = R * 0.3;
    const sideH = Math.max(3, R * 0.2);

    // Create SVG element
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', outerR * 2.5);
    svg.setAttribute('height', outerR * 2.5);
    svg.setAttribute('viewBox', `${-outerR * 1.25} ${-outerR * 1.25} ${outerR * 2.5} ${outerR * 2.5}`);

    // Create gradient definitions
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

    // Rim gradient
    const rimGrad = document.createElementNS('http://www.w3.org/2000/svg', 'radialGradient');
    rimGrad.setAttribute('id', `token-rim-${marker.id}`);
    rimGrad.innerHTML = `
        <stop offset="75%" stop-color="${colors.stroke}" />
        <stop offset="95%" stop-color="${colors.border}" />
    `;
    defs.appendChild(rimGrad);

    // Face gradient
    const faceGrad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    faceGrad.setAttribute('id', `token-face-${marker.id}`);
    faceGrad.setAttribute('x1', '0%');
    faceGrad.setAttribute('y1', '0%');
    faceGrad.setAttribute('x2', '0%');
    faceGrad.setAttribute('y2', '100%');
    faceGrad.innerHTML = `
        <stop offset="0%" stop-color="${colors.fill}" stop-opacity="1.15" />
        <stop offset="100%" stop-color="${colors.fill}" stop-opacity="0.85" />
    `;
    defs.appendChild(faceGrad);

    svg.appendChild(defs);

    // Chip thickness
    const sideCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    sideCircle.setAttribute('r', outerR);
    sideCircle.setAttribute('cy', sideH);
    sideCircle.setAttribute('fill', colors.border);
    svg.appendChild(sideCircle);

    // Outer rim
    const outerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    outerCircle.setAttribute('r', outerR);
    outerCircle.setAttribute('fill', `url(#token-rim-${marker.id})`);
    svg.appendChild(outerCircle);

    // Chip face
    const faceCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    faceCircle.setAttribute('r', R);
    faceCircle.setAttribute('fill', `url(#token-face-${marker.id})`);
    svg.appendChild(faceCircle);

    // Inner gold ring
    const goldRing = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    goldRing.setAttribute('r', innerR);
    goldRing.setAttribute('fill', 'none');
    goldRing.setAttribute('stroke', gold);
    goldRing.setAttribute('stroke-width', Math.max(1.5, R * 0.09));
    svg.appendChild(goldRing);

    // Center diamond
    const diamond = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    diamond.setAttribute('d', `M 0,${-d} L ${d},0 L 0,${d} L ${-d},0 Z`);
    diamond.setAttribute('fill', colors.ornament);
    svg.appendChild(diamond);

    // Sheen
    const sheen = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    sheen.setAttribute('cx', 0);
    sheen.setAttribute('cy', -R * 0.32);
    sheen.setAttribute('rx', R * 0.62);
    sheen.setAttribute('ry', R * 0.2);
    sheen.setAttribute('fill', 'rgba(255,255,255,0.10)');
    svg.appendChild(sheen);

    token.appendChild(svg);

    // Drag handlers
    token.addEventListener('dragstart', handleMarkerDragStart);
    token.addEventListener('dragend', handleMarkerDragEnd);

    // Touch drag handlers
    token.addEventListener('touchstart', handleMarkerTouchStart);
    token.addEventListener('touchmove', handleMarkerTouchMove);
    token.addEventListener('touchend', handleMarkerTouchEnd);

    return token;
}

function handleMarkerDragStart(e) {
    draggedMarkerToken = e.target;
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.innerHTML);
}

function handleMarkerDragEnd(e) {
    e.target.classList.remove('dragging');
    draggedMarkerToken = null;
}

function handleRoundDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleRoundDrop(e) {
    e.stopPropagation();
    e.preventDefault();

    if (draggedMarkerToken) {
        const targetRound = parseInt(e.currentTarget.dataset.round, 10);
        const markerId = draggedMarkerToken.dataset.markerId;

        // Update assignment
        markerRoundAssignments[markerId] = targetRound;

        // Move the token
        e.currentTarget.appendChild(draggedMarkerToken);
        draggedMarkerToken.classList.remove('dragging');
    }

    return false;
}

// Touch drag support for markers
let touchDraggedToken = null;
let touchClone = null;
let touchStartPos = { x: 0, y: 0 };

function handleMarkerTouchStart(e) {
    touchDraggedToken = e.currentTarget;
    const touch = e.touches[0];
    touchStartPos = { x: touch.clientX, y: touch.clientY };

    // Create a clone for visual feedback
    touchClone = touchDraggedToken.cloneNode(true);
    touchClone.style.position = 'fixed';
    touchClone.style.pointerEvents = 'none';
    touchClone.style.opacity = '0.8';
    touchClone.style.zIndex = '10000';
    touchClone.style.left = touch.clientX + 'px';
    touchClone.style.top = touch.clientY + 'px';
    document.body.appendChild(touchClone);

    touchDraggedToken.classList.add('dragging');
}

function handleMarkerTouchMove(e) {
    if (!touchDraggedToken || !touchClone) return;

    e.preventDefault();
    const touch = e.touches[0];

    touchClone.style.left = touch.clientX + 'px';
    touchClone.style.top = touch.clientY + 'px';
}

function handleMarkerTouchEnd(e) {
    if (!touchDraggedToken || !touchClone) return;

    const touch = e.changedTouches[0];
    const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
    const roundCell = targetElement?.closest('.initiative-round-cell');

    if (roundCell) {
        const targetRound = parseInt(roundCell.dataset.round, 10);
        const markerId = touchDraggedToken.dataset.markerId;

        markerRoundAssignments[markerId] = targetRound;
        roundCell.appendChild(touchDraggedToken);
    }

    touchDraggedToken.classList.remove('dragging');
    document.body.removeChild(touchClone);

    touchDraggedToken = null;
    touchClone = null;
}

// Add round function (global so button onclick can access it)
window.addInitiativeRound = function() {
    initiativeRounds++;
    updateInitiativeTable();
};

// Update initiative table when markers change
const originalRemoveMarker = removeMarker;
window.removeMarker = function(markerId) {
    delete markerRoundAssignments[markerId];
    const result = originalRemoveMarker(markerId);
    if (initiativeSheet.style.display === 'block') {
        updateInitiativeTable();
    }
    return result;
};
