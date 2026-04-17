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

// Initialize SVG and dimensions
const container = d3.select("#map-container");
const width = window.innerWidth;
const height = window.innerHeight;

const svg = container.append("svg")
    .attr("width", width)
    .attr("height", height);

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

// Set up map and fog layers from the stored image data URL
function setupMapLayers() {
    if (!mapImageDataUrl) return;

    const viewWidth = window.innerWidth;
    const viewHeight = window.innerHeight;
    const imgWidth = viewWidth;
    const imgHeight = imgWidth / mapAspectRatio;
    const imgX = 0;
    const imgY = viewHeight / 2 - imgHeight / 2;

    mapDimensions = { x: imgX, y: imgY, width: imgWidth, height: imgHeight };

    mapGroup.selectAll("*").remove();
    mapGroup.append("image")
        .attr("href", mapImageDataUrl)
        .attr("x", imgX)
        .attr("y", imgY)
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
    // (Re-)create the visible fog canvas
    const existing = document.getElementById('fog-canvas');
    if (existing) existing.remove();
    fogCanvas = document.createElement('canvas');
    fogCanvas.id = 'fog-canvas';
    fogCanvas.width = window.innerWidth;
    fogCanvas.height = window.innerHeight;
    fogCanvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:10;';
    document.getElementById('map-container').appendChild(fogCanvas);

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
        x: mapDimensions.x - mapDimensions.width  * fogPadding,
        y: mapDimensions.y - mapDimensions.height * fogPadding,
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
        ctx.filter = `blur(80px)`;
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
    const numBlobs = 4 + Math.floor(Math.random() * 4);

    maskCtx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < numBlobs; i++) {
        const angle = (i / numBlobs) * Math.PI * 2 + Math.random();
        const dist  = radius * 0.15 * Math.random();
        const bx    = mx + Math.cos(angle) * dist;
        const by    = my + Math.sin(angle) * dist;
        const br    = radius * (0.75 + Math.random() * 0.3);
        const g     = maskCtx.createRadialGradient(bx, by, 0, bx, by, br);
        g.addColorStop(0,    'rgba(0,0,0,1)');
        g.addColorStop(0.4,  'rgba(0,0,0,0.9)');
        g.addColorStop(0.7,  'rgba(0,0,0,0.6)');
        g.addColorStop(0.85, 'rgba(0,0,0,0.3)');
        g.addColorStop(1,    'rgba(0,0,0,0)');
        maskCtx.fillStyle = g;
        maskCtx.beginPath();
        maskCtx.arc(bx, by, br, 0, Math.PI * 2);
        maskCtx.fill();
    }
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
    drawRevealOnMask(x, y, config.revealRadius);
    renderFogCanvas();

    const shapeId = `shape-${Date.now()}-${Math.random()}`;
    const revealData = { x, y, radius: config.revealRadius, isFog: false, shapeId };
    revealShapes.push(revealData);

    addToHistory({ type: 'reveal', action: 'add', data: revealData });
    saveToLocalStorage();
}

// Function to add fog back at position with wonky fading effect
function addFog(x, y) {
    drawFogOnMask(x, y, config.revealRadius);
    renderFogCanvas();

    const shapeId = `shape-${Date.now()}-${Math.random()}`;
    const fogData = { x, y, radius: config.revealRadius, isFog: true, shapeId };
    revealShapes.push(fogData);

    addToHistory({ type: 'fog', action: 'add', data: fogData });
    saveToLocalStorage();
}

// Function to add a marker (player/enemy circle)
function addMarker(x, y, color = null) {
    const markerId = `marker-${markerIdCounter++}`;
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
            // Only allow drag when in marker mode
            return activeTool === 'tool2';
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
        if (activeTool === 'tool2') {
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
    });

    // Save state after removal
    if (markersToRemove.length > 0) {
        saveToLocalStorage();
    }
}

// Drawing functions
function startDrawing(x, y) {
    if (activeTool !== 'draw') return;

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
    .scaleExtent([config.initialZoom, config.maxZoom])
    .translateExtent([
        [0, 0],
        [width, height]
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

// Save state to localStorage
function saveToLocalStorage() {
    const state = {
        revealShapes: revealShapes,
        markers: markers.map(m => ({ x: m.x, y: m.y, id: m.id, color: m.color, name: m.name || "" })),
        drawings: drawings,
        brushSize: config.revealRadius,
        mapAspectRatio: mapAspectRatio
    };
    localStorage.setItem('mapState', JSON.stringify(state));
    if (mapImageDataUrl) {
        localStorage.setItem('mapImage', mapImageDataUrl);
    }
}

// Load state from localStorage
function loadFromLocalStorage() {
    const savedState = localStorage.getItem('mapState');
    if (!savedState) return;

    try {
        const state = JSON.parse(savedState);

        // Restore brush size
        if (state.brushSize) {
            config.revealRadius = state.brushSize;
            brushSlider.value = state.brushSize;
            updateBrushSize(state.brushSize);
        }

        // Restore reveal shapes — migrate old format (gradientId/pathData) to new {x,y,radius,isFog,shapeId}
        if (state.revealShapes) {
            revealShapes = state.revealShapes.map(s => ({
                x:       s.x,
                y:       s.y,
                radius:  s.radius,
                isFog:   s.isFog || false,
                shapeId: s.shapeId || s.gradientId || `shape-${Date.now()}-${Math.random()}`
            }));
            rebuildMaskCanvas();
        }

        // Restore markers
        if (state.markers) {
            state.markers.forEach(markerData => {
                const marker = addMarker(markerData.x, markerData.y, markerData.color || 'blue');
                marker.isLoading = true; // Mark as loading to prevent saving during restore
                // Restore marker name
                if (markerData.name) {
                    marker.name = markerData.name;
                    marker.textElement.text(markerData.name);
                }
            });
        }

        // Restore drawings
        if (state.drawings) {
            state.drawings.forEach(drawingData => {
                drawingGroup.append("path")
                    .attr("id", drawingData.id)
                    .attr("d", drawingData.pathData)
                    .attr("fill", "none")
                    .attr("stroke", markerColors[drawingData.color].stroke)
                    .attr("stroke-width", drawingData.strokeWidth)
                    .attr("stroke-linecap", "round")
                    .attr("stroke-linejoin", "round")
                    .attr("class", "drawing-path");

                drawings.push(drawingData);
                drawingIdCounter = Math.max(drawingIdCounter, parseInt(drawingData.id.split('-')[1]) + 1);
            });
        }
    } catch (e) {
        console.error('Failed to load map state:', e);
    }
}

// Initialize: load saved map image or show upload overlay
const savedMapImage = localStorage.getItem('mapImage');
if (savedMapImage) {
    mapImageDataUrl = savedMapImage;
    const savedStateStr = localStorage.getItem('mapState');
    if (savedStateStr) {
        try { mapAspectRatio = JSON.parse(savedStateStr).mapAspectRatio || 1; } catch(e) {}
    }
    setupMapLayers();
    hideUploadOverlay();
    setTimeout(() => loadFromLocalStorage(), 100);
}

// If there is no saved map, but the project ships a single map in maps.json,
// auto-load it for convenience. This works for static setups (no Node required).
if (!savedMapImage) {
    // Try relative path first (works with static hosting and subpaths),
    // then fall back to absolute root.
    const fetchMapsJson = () => fetch('maps.json').then(r => { if (!r.ok) throw r; return r.json(); })
        .catch(() => fetch('/maps.json').then(r => { if (!r.ok) throw r; return r.json(); }));

    fetchMapsJson()
        .then(list => {
            if (Array.isArray(list) && list.length === 1) {
                const item = list[0];
                const img = new Image();
                img.onload = function() {
                    mapImageDataUrl = item.file;
                    mapAspectRatio = img.naturalWidth / img.naturalHeight || 1;
                    setupMapLayers();
                    hideUploadOverlay();
                    // No saved state to restore, but keep consistent behavior
                    saveToLocalStorage();
                };
                img.onerror = function() {
                    console.warn('Auto-load map failed for', item.file);
                };
                // Use the file path as provided in maps.json
                img.src = item.file;
            }
        })
        .catch((err) => {
            console.warn('Could not load maps.json for auto-load:', err);
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
                const restored = addMarker(action.data.x, action.data.y, action.data.color);
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
                const restored = addMarker(action.data.x, action.data.y, action.data.color);
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

// Upload overlay
function showUploadOverlay() {
    const overlay = document.getElementById('upload-overlay');
    overlay.classList.remove('hidden');

    // Populate map chooser from server-side JSON list
    const select = document.getElementById('map-select');
    const preview = document.getElementById('map-preview');
    const loadBtn = document.getElementById('map-load-button');

    // Clear previous options (keep the placeholder)
    select.querySelectorAll('option:not([value=""])').forEach(o => o.remove());

    fetch('/maps.json')
        .then(r => r.json())
        .then(list => {
            list.forEach(item => {
                const opt = document.createElement('option');
                opt.value = item.file;
                opt.textContent = item.name || item.file;
                if (item.preview) opt.dataset.preview = item.preview;
                select.appendChild(opt);
            });
            // If there's only one map available, auto-select it for convenience
            if (list.length === 1) {
                select.value = list[0].file;
                // Trigger onchange to show preview
                select.onchange();
            }
        })
        .catch(() => {
            // If maps.json not available, silently fail — chooser stays empty
        });

    select.onchange = () => {
        const val = select.value;
        if (!val) {
            preview.style.display = 'none';
            preview.src = '';
            return;
        }
        // Show preview if available
        const opt = select.selectedOptions[0];
        const previewSrc = opt.dataset.preview || val;
        preview.src = previewSrc;
        preview.style.display = 'block';
    };

    loadBtn.onclick = (e) => {
        e.stopPropagation();
        const val = select.value;
        if (!val) return;
        // Load map by setting mapImageDataUrl to the selected file path
        const img = new Image();
        img.onload = function() {
            mapImageDataUrl = val;
            mapAspectRatio = img.naturalWidth / img.naturalHeight;
            setupMapLayers();
            hideUploadOverlay();
            saveToLocalStorage();
        };
        img.onerror = function() {
            alert('Failed to load selected map.');
        };
        img.src = val;
    };
}

function hideUploadOverlay() {
    document.getElementById('upload-overlay').classList.add('hidden');
}

function handleImageFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const dataUrl = e.target.result;
        const img = new Image();
        img.onload = function() {
            mapImageDataUrl = dataUrl;
            mapAspectRatio = img.naturalWidth / img.naturalHeight;
            setupMapLayers();
            hideUploadOverlay();
            saveToLocalStorage();
        };
        img.src = dataUrl;
    };
    reader.readAsDataURL(file);
}


const mapFileInput = document.getElementById('map-file-input');
const uploadDropZone = document.getElementById('upload-drop-zone');

// File input (Upload) handling — label triggers file dialog
mapFileInput.addEventListener('change', (e) => {
    handleImageFile(e.target.files[0]);
    mapFileInput.value = '';
});

// Drag & drop support for raw upload area
uploadDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadDropZone.classList.add('dragover');
});

uploadDropZone.addEventListener('dragleave', () => {
    uploadDropZone.classList.remove('dragover');
});

uploadDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadDropZone.classList.remove('dragover');
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
        handleImageFile(e.dataTransfer.files[0]);
    }
});

document.getElementById('load-map-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    showUploadOverlay();
});

// Allow dismissing the overlay by clicking the backdrop (only when a map is already loaded)
document.getElementById('upload-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('upload-overlay') && mapImageDataUrl) {
        hideUploadOverlay();
    }
});
