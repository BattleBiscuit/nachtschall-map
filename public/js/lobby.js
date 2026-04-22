// Lobby logic for room creation and joining

let socket = null;
let selectedMapFile = null;
let selectedMapAspectRatio = 1;

// Tab switching
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        const tabId = button.dataset.tab;

        // Update button states
        tabButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        // Update content visibility
        tabContents.forEach(content => content.classList.remove('active'));
        document.getElementById(`${tabId}-tab`).classList.add('active');
    });
});

// Connect to socket
function connectSocket(callback) {
    if (socket && socket.connected) {
        if (callback) callback();
        return;
    }

    socket = io();
    socket.on('connect', () => {
        console.log('[socket] connected:', socket.id);
        if (callback) callback();
    });

    socket.on('connect_error', (err) => {
        console.error('[socket] connection error:', err);
        showError('Failed to connect to server. Please try again.');
    });
}

// Show error message
function showError(message) {
    const errorEl = document.getElementById('error-message');
    errorEl.textContent = message;
    errorEl.style.display = 'block';

    setTimeout(() => {
        errorEl.style.display = 'none';
    }, 5000);
}

// Join room
document.getElementById('join-btn').addEventListener('click', () => {
    const roomId = document.getElementById('join-room-id').value.trim().toUpperCase();

    if (!roomId) {
        showError('Please enter a room code');
        return;
    }

    if (roomId.length !== 6) {
        showError('Room code must be 6 characters');
        return;
    }

    // Navigate to room page
    window.location.href = `/room/${roomId}`;
});

// Allow Enter key in join input
document.getElementById('join-room-id').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('join-btn').click();
    }
});

// Create room
document.getElementById('create-btn').addEventListener('click', () => {
    if (!selectedMapFile) {
        showError('Please select or upload a map first');
        return;
    }

    connectSocket(() => {
        socket.emit('createRoom', {
            snapshot: {
                mapFile: selectedMapFile,
                mapAspectRatio: selectedMapAspectRatio,
                revealShapes: [],
                markers: [],
                drawings: []
            }
        }, (res) => {
            if (res && res.ok) {
                // Disconnect socket before navigating to avoid socket ID mismatch
                if (socket) {
                    socket.disconnect();
                }
                // Small delay to ensure disconnect completes
                setTimeout(() => {
                    window.location.href = `/room/${res.roomId}`;
                }, 100);
            } else {
                showError('Failed to create room: ' + (res?.error || 'Unknown error'));
            }
        });
    });
});

// Populate map chooser from maps.json
const mapSelect = document.getElementById('map-select');
const mapPreview = document.getElementById('map-preview');
const showPreviewCheckbox = document.getElementById('show-preview-checkbox');

fetch('/assets/maps.json')
    .then(r => r.json())
    .then(list => {
        list.forEach(item => {
            const option = document.createElement('option');
            option.value = item.file;
            option.textContent = item.name || item.file;
            option.dataset.preview = item.preview || item.file;
            mapSelect.appendChild(option);
        });

        // If only one map, pre-select it
        if (list.length === 1) {
            mapSelect.value = list[0].file;
            mapSelect.dispatchEvent(new Event('change'));
        }
    })
    .catch(() => {
        console.warn('Could not load maps.json');
    });

// Map select change handler
mapSelect.addEventListener('change', () => {
    const value = mapSelect.value;

    if (!value) {
        mapPreview.style.display = 'none';
        mapPreview.src = '';
        selectedMapFile = null;
        return;
    }

    const option = mapSelect.selectedOptions[0];
    const previewSrc = option.dataset.preview || value;

    // Load the selected map and convert to data URL
    const img = new Image();
    img.onload = function() {
        selectedMapAspectRatio = img.naturalWidth / img.naturalHeight;

        // Convert to data URL so it works regardless of the page path
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        selectedMapFile = canvas.toDataURL('image/png');

        // Show preview if checkbox is checked
        if (showPreviewCheckbox.checked) {
            mapPreview.src = previewSrc;
            mapPreview.style.display = 'block';
        }
    };
    img.onerror = function() {
        showError('Failed to load selected map');
        selectedMapFile = null;
    };
    img.src = value;
});

// Preview checkbox handler
showPreviewCheckbox.addEventListener('change', () => {
    if (showPreviewCheckbox.checked && mapSelect.value) {
        const option = mapSelect.selectedOptions[0];
        const previewSrc = option.dataset.preview || mapSelect.value;
        mapPreview.src = previewSrc;
        mapPreview.style.display = 'block';
    } else {
        mapPreview.style.display = 'none';
    }
});

// File upload handler
const mapFileInput = document.getElementById('map-file-input');

mapFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('image/')) {
        showError('Please select a valid image file');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
        const dataUrl = event.target.result;
        const img = new Image();

        img.onload = function() {
            selectedMapFile = dataUrl;
            selectedMapAspectRatio = img.naturalWidth / img.naturalHeight;

            // Clear map select
            mapSelect.value = '';

            // Show preview if checkbox is checked
            if (showPreviewCheckbox.checked) {
                mapPreview.src = dataUrl;
                mapPreview.style.display = 'block';
            }
        };

        img.src = dataUrl;
    };

    reader.readAsDataURL(file);
    mapFileInput.value = '';
});
