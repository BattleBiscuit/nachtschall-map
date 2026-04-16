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

// Initialize SVG and dimensions
const container = d3.select("#map-container");
const width = window.innerWidth;
const height = window.innerHeight;

const svg = container.append("svg")
    .attr("width", width)
    .attr("height", height);

// Create main group for pan/zoom
const g = svg.append("g");

// Store revealed circles
const revealedAreas = [];

// Create defs for mask
const defs = svg.append("defs");

// Create mask for fog of war
const mask = defs.append("mask")
    .attr("id", "fog-mask");

// White background for mask (visible areas will be black circles that block)
mask.append("rect")
    .attr("x", -10000)
    .attr("y", -10000)
    .attr("width", 20000)
    .attr("height", 20000)
    .attr("fill", "white");

// Group for revealed areas in mask (will be black to hide fog)
const revealGroup = mask.append("g")
    .attr("class", "reveal-group");

// Map layers
const mapGroup = g.append("g").attr("class", "map-layer");
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

// Create Gefängnis von Rabenfels - Using reference image
function createRabenfelsMap() {
    const cx = width / 2;
    const cy = height / 2;

    // Calculate image dimensions to fit screen while maintaining aspect ratio
    const imgAspectRatio = 598 / 337; // width / height of reference image
    const screenAspectRatio = width / height;

    let imgWidth, imgHeight;
    if (screenAspectRatio > imgAspectRatio) {
        // Screen is wider, fit to height
        imgHeight = height * 0.9;
        imgWidth = imgHeight * imgAspectRatio;
    } else {
        // Screen is taller, fit to width
        imgWidth = width * 0.9;
        imgHeight = imgWidth / imgAspectRatio;
    }

    const imgX = cx - imgWidth / 2;
    const imgY = cy - imgHeight / 2;

    // Store dimensions for fog overlay
    mapDimensions = {
        x: imgX,
        y: imgY,
        width: imgWidth,
        height: imgHeight
    };

    // Add the reference map image
    mapGroup.append("image")
        .attr("href", "rabenfels-map.png")
        .attr("x", imgX)
        .attr("y", imgY)
        .attr("width", imgWidth)
        .attr("height", imgHeight)
        .attr("preserveAspectRatio", "xMidYMid meet");
}

createRabenfelsMap();

// Create fog overlay using custom image with same dimensions as map
fogGroup.append("image")
    .attr("href", "fog_of_war.png")
    .attr("x", mapDimensions.x)
    .attr("y", mapDimensions.y)
    .attr("width", mapDimensions.width)
    .attr("height", mapDimensions.height)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .attr("class", "fog-overlay")
    .attr("mask", "url(#fog-mask)");


// Function to reveal area at position with wonky fading effect
function revealArea(x, y) {
    // Create radial gradient for fading effect
    const gradientId = `reveal-gradient-${Date.now()}-${Math.random()}`;
    const gradient = defs.append("radialGradient")
        .attr("id", gradientId);

    // Create multiple stops for a softer, irregular fade
    gradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "black")
        .attr("stop-opacity", 1);

    gradient.append("stop")
        .attr("offset", "40%")
        .attr("stop-color", "black")
        .attr("stop-opacity", 0.9);

    gradient.append("stop")
        .attr("offset", "70%")
        .attr("stop-color", "black")
        .attr("stop-opacity", 0.6);

    gradient.append("stop")
        .attr("offset", "85%")
        .attr("stop-color", "black")
        .attr("stop-opacity", 0.3);

    gradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "black")
        .attr("stop-opacity", 0);

    // Create wonky shape instead of perfect circle
    const numPoints = 12 + Math.floor(Math.random() * 8); // 12-20 points
    const baseRadius = config.revealRadius;

    let pathData = "";
    for (let i = 0; i <= numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;
        // Add randomness to radius for wonky effect
        const radiusVariation = 0.7 + Math.random() * 0.6; // 70% to 130% of base
        const r = baseRadius * radiusVariation;
        const px = x + Math.cos(angle) * r;
        const py = y + Math.sin(angle) * r;

        if (i === 0) {
            pathData = `M ${px},${py}`;
        } else {
            // Use quadratic curves for smoother, organic edges
            const prevAngle = ((i - 1) / numPoints) * Math.PI * 2;
            const prevR = baseRadius * (0.7 + Math.random() * 0.6);
            const cpx = x + Math.cos((angle + prevAngle) / 2) * ((r + prevR) / 2);
            const cpy = y + Math.sin((angle + prevAngle) / 2) * ((r + prevR) / 2);
            pathData += ` Q ${cpx},${cpy} ${px},${py}`;
        }
    }
    pathData += " Z";

    const shape = revealGroup.append("path")
        .attr("d", pathData)
        .attr("fill", `url(#${gradientId})`)
        .attr("opacity", 0);

    shape.transition()
        .duration(300)
        .attr("opacity", 1);

    revealedAreas.push({ x, y, radius: config.revealRadius });
}

// Function to add fog back at position with wonky fading effect
function addFog(x, y) {
    // Create radial gradient for fading effect (reverse of reveal)
    const gradientId = `fog-gradient-${Date.now()}-${Math.random()}`;
    const gradient = defs.append("radialGradient")
        .attr("id", gradientId);

    // Create gradient that goes from transparent to white (opposite of reveal)
    gradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "white")
        .attr("stop-opacity", 1);

    gradient.append("stop")
        .attr("offset", "40%")
        .attr("stop-color", "white")
        .attr("stop-opacity", 0.9);

    gradient.append("stop")
        .attr("offset", "70%")
        .attr("stop-color", "white")
        .attr("stop-opacity", 0.6);

    gradient.append("stop")
        .attr("offset", "85%")
        .attr("stop-color", "white")
        .attr("stop-opacity", 0.3);

    gradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "white")
        .attr("stop-opacity", 0);

    // Create wonky shape
    const numPoints = 12 + Math.floor(Math.random() * 8);
    const baseRadius = config.revealRadius;

    let pathData = "";
    for (let i = 0; i <= numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;
        const radiusVariation = 0.7 + Math.random() * 0.6;
        const r = baseRadius * radiusVariation;
        const px = x + Math.cos(angle) * r;
        const py = y + Math.sin(angle) * r;

        if (i === 0) {
            pathData = `M ${px},${py}`;
        } else {
            const prevAngle = ((i - 1) / numPoints) * Math.PI * 2;
            const prevR = baseRadius * (0.7 + Math.random() * 0.6);
            const cpx = x + Math.cos((angle + prevAngle) / 2) * ((r + prevR) / 2);
            const cpy = y + Math.sin((angle + prevAngle) / 2) * ((r + prevR) / 2);
            pathData += ` Q ${cpx},${cpy} ${px},${py}`;
        }
    }
    pathData += " Z";

    const shape = revealGroup.append("path")
        .attr("d", pathData)
        .attr("fill", `url(#${gradientId})`)
        .attr("opacity", 0);

    shape.transition()
        .duration(300)
        .attr("opacity", 1);
}

// Zoom behavior with filter to only pan on Ctrl+drag
const zoom = d3.zoom()
    .scaleExtent([config.minZoom, config.maxZoom])
    .filter((event) => {
        // Block wheel zoom if Shift is pressed (for brush size adjustment)
        if (event.type === 'wheel' && event.shiftKey) return false;
        // Allow wheel zoom normally
        if (event.type === 'wheel') return true;
        // Allow pan only when Ctrl is pressed
        if (event.type === 'mousedown' || event.type === 'mousemove') {
            return event.ctrlKey;
        }
        return false;
    })
    .on("zoom", (event) => {
        g.attr("transform", event.transform);
    });

svg.call(zoom);

// Handle mouse wheel for brush size when Shift is held
svg.on("wheel", function(event) {
    if (event.shiftKey) {
        event.preventDefault();

        // Adjust reveal radius based on wheel direction
        const delta = event.deltaY > 0 ? -5 : 5;
        config.revealRadius = Math.max(
            config.minRevealRadius,
            Math.min(config.maxRevealRadius, config.revealRadius + delta)
        );

        // Update brush indicator size
        brushIndicator.attr("r", config.revealRadius);
    }
}, { passive: false });

// Mouse/touch interaction for revealing
let isMouseDown = false;
let isRightMouseDown = false;
let isDragging = false;
let lastRevealTime = 0;
const revealThrottle = 50; // milliseconds

// Prevent context menu on right click
svg.on("contextmenu", function(event) {
    event.preventDefault();
});

svg.on("mousedown touchstart", function(event) {
    // Only track mouse down for reveal tool if Ctrl is not pressed
    if (!event.ctrlKey) {
        if (event.button === 2) {
            // Right mouse button
            isRightMouseDown = true;
        } else {
            // Left mouse button
            isMouseDown = true;
        }
        isDragging = false;
    }
});

svg.on("mouseup touchend", function(event) {
    isMouseDown = false;
    isRightMouseDown = false;
});

svg.on("mousemove touchmove", function(event) {
    const [x, y] = d3.pointer(event, g.node());

    // Update brush indicator position and show it when reveal tool is active
    if (activeTool === 'reveal' && !event.ctrlKey) {
        brushIndicator
            .attr("cx", x)
            .attr("cy", y)
            .style("opacity", 0.6);
    } else {
        brushIndicator.style("opacity", 0);
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
    }
});

svg.on("click", function(event) {
    // Only reveal/fog on click if not dragging and Ctrl is not pressed
    if (!isDragging && !event.ctrlKey) {
        if (activeTool === 'reveal') {
            const [x, y] = d3.pointer(event, g.node());
            if (event.button === 2) {
                // Right click - add fog
                addFog(x, y);
            } else {
                // Left click - reveal
                revealArea(x, y);
            }
        }
        // Tool 2 functionality will go here
    }
});

svg.on("mouseleave", function() {
    brushIndicator.style("opacity", 0);
});

// Handle window resize
window.addEventListener("resize", () => {
    const newWidth = window.innerWidth;
    const newHeight = window.innerHeight;

    svg.attr("width", newWidth)
        .attr("height", newHeight);

    // Redraw the map
    mapGroup.selectAll("*").remove();
    createRabenfelsMap();

    // Redraw fog overlay with new dimensions
    fogGroup.selectAll("image").remove();
    fogGroup.append("image")
        .attr("href", "fog_of_war.png")
        .attr("x", mapDimensions.x)
        .attr("y", mapDimensions.y)
        .attr("width", mapDimensions.width)
        .attr("height", mapDimensions.height)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .attr("class", "fog-overlay")
        .attr("mask", "url(#fog-mask)");
});

// No initial reveal - map starts completely fogged

// Tool button functionality
const revealToolBtn = document.getElementById('reveal-tool');
const tool2Btn = document.getElementById('tool-2');

function setActiveTool(tool) {
    activeTool = tool;

    // Update button states
    revealToolBtn.classList.remove('active');
    tool2Btn.classList.remove('active');

    if (tool === 'reveal') {
        revealToolBtn.classList.add('active');
        revealToolBtn.title = 'Reveal Tool (Active)';
        tool2Btn.title = 'Tool 2';
    } else if (tool === 'tool2') {
        tool2Btn.classList.add('active');
        tool2Btn.title = 'Tool 2 (Active)';
        revealToolBtn.title = 'Reveal Tool';
    }
}

revealToolBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setActiveTool('reveal');
});

tool2Btn.addEventListener('click', (e) => {
    e.stopPropagation();
    setActiveTool('tool2');
});
