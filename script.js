// API Configuration
const API_BASE_URL = 'https://dev-task.elancoapps.com';
let sightings = [];
let currentSelectedLocation = null;

const severityColors = {
    "Low": "#43A047",
    "Med": "#FFB300",
    "High": "#E53935",
    "Older": "#7E57C2",
    "Recent": "#656a71"
};

// Compute severity based on date
function computeSeverity(dateString) {
    const d = new Date(dateString);
    const now = new Date();
    const days = (now - d) / (1000 * 60 * 60 * 24);
    if (days <= 30) return "Recent";
    if (days <= 180) return "High";
    if (days <= 365) return "Medium";
    if (days <= 1825) return "Low";
    return "Older";
}

// Initialize map
const map = L.map('map').setView([54.5, -3.0], 6);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

let markers = [];
let selectedMarker = null;

// Fetch sightings from API
async function fetchSightings() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    loadingIndicator.classList.remove('hidden');
    
    try {
        const response = await fetch(`${API_BASE_URL}/sightings`);
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }
        const data = await response.json();
        
        // Check if data is an array
        if (Array.isArray(data)) {
            sightings = data;
            console.log(`Loaded ${sightings.length} sightings from API`);
        } else if (data.sightings && Array.isArray(data.sightings)) {
            sightings = data.sightings;
            console.log(`Loaded ${sightings.length} sightings from API`);
        } else {
            throw new Error('Invalid data format from API');
        }
        
        // Populate species filter
        populateSpeciesFilter();
        
        // Add markers and update results
        addMarkers(sightings);
        updateResults(sightings);
    } catch (error) {
        console.error('Error fetching sightings:', error);
        console.log('Attempting to load from API with alternative endpoint...');
        console.log('Attempting to load from API with alternative endpoint...');
        
        // Try alternative endpoints or methods
        try {
            const altResponse = await fetch(`${API_BASE_URL}/api/sightings`);
            if (altResponse.ok) {
                const altData = await altResponse.json();
                sightings = Array.isArray(altData) ? altData : altData.sightings || [];
                console.log(`Loaded ${sightings.length} sightings from alternative endpoint`);
                populateSpeciesFilter();
                addMarkers(sightings);
                updateResults(sightings);
                loadingIndicator.classList.add('hidden');
                return;
            }
        } catch (altError) {
            console.error('Alternative endpoint also failed:', altError);
        }
        
        // Use fallback data only if API completely fails
        console.log('Using fallback sample data...');
        sightings = [
            // London area
            { id: "01", date: "2024-11-15T14:30:00", location: "London", species: "Fox/badger tick", latinName: "Ixodes canisuga", lat: 51.5074, lng: -0.1278 },
            { id: "02", date: "2024-11-10T09:15:00", location: "London", species: "Southern rodent tick", latinName: "Ixodes acuminatus", lat: 51.5155, lng: -0.0922 },
            { id: "03", date: "2024-10-28T16:45:00", location: "London", species: "Marsh tick", latinName: "Ixodes apronophorus", lat: 51.4893, lng: -0.1440 },
            { id: "51", date: "2024-11-16T10:30:00", location: "London", species: "Tree-hole tick", latinName: "Ixodes arboricola", lat: 51.5200, lng: -0.1500 },
            
            // Manchester area
            { id: "04", date: "2024-11-12T11:20:00", location: "Manchester", species: "Marsh tick", latinName: "Ixodes apronophorus", lat: 53.4808, lng: -2.2426 },
            { id: "05", date: "2024-10-05T13:00:00", location: "Manchester", species: "Fox/badger tick", latinName: "Ixodes canisuga", lat: 53.4630, lng: -2.2910 },
            { id: "06", date: "2024-09-18T10:30:00", location: "Manchester", species: "Passerine tick", latinName: "Dermacentor frontalis", lat: 53.5070, lng: -2.2280 },
            { id: "52", date: "2024-10-20T14:15:00", location: "Manchester", species: "Tree-hole tick", latinName: "Ixodes arboricola", lat: 53.4900, lng: -2.2500 },
            
            // Glasgow area
            { id: "07", date: "2024-11-08T08:45:00", location: "Glasgow", species: "Passerine tick", latinName: "Dermacentor frontalis", lat: 55.8642, lng: -4.2518 },
            { id: "08", date: "2024-10-22T15:00:00", location: "Glasgow", species: "Marsh tick", latinName: "Ixodes apronophorus", lat: 55.8555, lng: -4.2407 },
            { id: "09", date: "2024-09-30T12:15:00", location: "Glasgow", species: "Southern rodent tick", latinName: "Ixodes acuminatus", lat: 55.8730, lng: -4.2620 },
            { id: "53", date: "2024-09-22T11:45:00", location: "Glasgow", species: "Tree-hole tick", latinName: "Ixodes arboricola", lat: 55.8700, lng: -4.2600 },
            
            // Birmingham area
            { id: "10", date: "2024-11-14T10:00:00", location: "Birmingham", species: "Fox/badger tick", latinName: "Ixodes canisuga", lat: 52.4862, lng: -1.8904 },
            { id: "11", date: "2024-10-19T14:30:00", location: "Birmingham", species: "Southern rodent tick", latinName: "Ixodes acuminatus", lat: 52.4800, lng: -1.9025 },
            { id: "12", date: "2024-09-25T09:45:00", location: "Birmingham", species: "Marsh tick", latinName: "Ixodes apronophorus", lat: 52.4920, lng: -1.8790 },
            
            // Liverpool area
            { id: "13", date: "2024-11-11T13:20:00", location: "Liverpool", species: "Southern rodent tick", latinName: "Ixodes acuminatus", lat: 53.4084, lng: -2.9916 },
            { id: "14", date: "2024-10-16T11:00:00", location: "Liverpool", species: "Passerine tick", latinName: "Dermacentor frontalis", lat: 53.4150, lng: -2.9770 },
            { id: "15", date: "2024-09-12T16:30:00", location: "Liverpool", species: "Fox/badger tick", latinName: "Ixodes canisuga", lat: 53.4020, lng: -3.0050 },
            
            // Edinburgh area
            { id: "16", date: "2024-11-13T10:45:00", location: "Edinburgh", species: "Marsh tick", latinName: "Ixodes apronophorus", lat: 55.9533, lng: -3.1883 },
            { id: "17", date: "2024-10-20T15:15:00", location: "Edinburgh", species: "Fox/badger tick", latinName: "Ixodes canisuga", lat: 55.9480, lng: -3.2000 },
            { id: "18", date: "2024-09-08T12:00:00", location: "Edinburgh", species: "Southern rodent tick", latinName: "Ixodes acuminatus", lat: 55.9600, lng: -3.1750 },
            { id: "54", date: "2024-08-15T13:30:00", location: "Edinburgh", species: "Tree-hole tick", latinName: "Ixodes arboricola", lat: 55.9550, lng: -3.1900 },
            
            // Leeds area
            { id: "19", date: "2024-11-09T09:30:00", location: "Leeds", species: "Passerine tick", latinName: "Dermacentor frontalis", lat: 53.8008, lng: -1.5491 },
            { id: "20", date: "2024-10-14T14:00:00", location: "Leeds", species: "Marsh tick", latinName: "Ixodes apronophorus", lat: 53.7950, lng: -1.5600 },
            { id: "21", date: "2024-09-20T11:45:00", location: "Leeds", species: "Fox/badger tick", latinName: "Ixodes canisuga", lat: 53.8070, lng: -1.5380 },
            
            // Bristol area
            { id: "22", date: "2024-11-07T12:30:00", location: "Bristol", species: "Southern rodent tick", latinName: "Ixodes acuminatus", lat: 51.4545, lng: -2.5879 },
            { id: "23", date: "2024-10-11T10:15:00", location: "Bristol", species: "Fox/badger tick", latinName: "Ixodes canisuga", lat: 51.4600, lng: -2.5950 },
            { id: "24", date: "2024-09-17T15:00:00", location: "Bristol", species: "Marsh tick", latinName: "Ixodes apronophorus", lat: 51.4490, lng: -2.5800 },
            { id: "55", date: "2024-07-10T16:00:00", location: "Bristol", species: "Tree-hole tick", latinName: "Ixodes arboricola", lat: 51.4520, lng: -2.5900 },
            
            // Sheffield area
            { id: "25", date: "2024-11-06T11:00:00", location: "Sheffield", species: "Fox/badger tick", latinName: "Ixodes canisuga", lat: 53.3811, lng: -1.4701 },
            { id: "26", date: "2024-10-10T13:45:00", location: "Sheffield", species: "Marsh tick", latinName: "Ixodes apronophorus", lat: 53.3750, lng: -1.4850 },
            { id: "27", date: "2024-09-15T09:00:00", location: "Sheffield", species: "Passerine tick", latinName: "Dermacentor frontalis", lat: 53.3880, lng: -1.4550 },
            
            // Newcastle area
            { id: "28", date: "2024-11-05T14:20:00", location: "Newcastle", species: "Marsh tick", latinName: "Ixodes apronophorus", lat: 54.9783, lng: -1.6178 },
            { id: "29", date: "2024-10-09T12:00:00", location: "Newcastle", species: "Southern rodent tick", latinName: "Ixodes acuminatus", lat: 54.9720, lng: -1.6300 },
            { id: "30", date: "2024-09-14T10:30:00", location: "Newcastle", species: "Fox/badger tick", latinName: "Ixodes canisuga", lat: 54.9850, lng: -1.6050 },
            
            // Cardiff area
            { id: "31", date: "2024-11-04T15:30:00", location: "Cardiff", species: "Passerine tick", latinName: "Dermacentor frontalis", lat: 51.4816, lng: -3.1791 },
            { id: "32", date: "2024-10-08T11:30:00", location: "Cardiff", species: "Marsh tick", latinName: "Ixodes apronophorus", lat: 51.4750, lng: -3.1900 },
            { id: "33", date: "2024-09-13T14:15:00", location: "Cardiff", species: "Fox/badger tick", latinName: "Ixodes canisuga", lat: 51.4880, lng: -3.1680 },
            
            // Nottingham area
            { id: "34", date: "2024-11-03T10:15:00", location: "Nottingham", species: "Southern rodent tick", latinName: "Ixodes acuminatus", lat: 52.9548, lng: -1.1581 },
            { id: "35", date: "2024-10-07T13:00:00", location: "Nottingham", species: "Fox/badger tick", latinName: "Ixodes canisuga", lat: 52.9600, lng: -1.1700 },
            { id: "36", date: "2024-09-11T11:30:00", location: "Nottingham", species: "Marsh tick", latinName: "Ixodes apronophorus", lat: 52.9490, lng: -1.1460 },
            
            // Southampton area
            { id: "37", date: "2024-11-02T12:45:00", location: "Southampton", species: "Marsh tick", latinName: "Ixodes apronophorus", lat: 50.9097, lng: -1.4044 },
            { id: "38", date: "2024-10-06T09:30:00", location: "Southampton", species: "Passerine tick", latinName: "Dermacentor frontalis", lat: 50.9150, lng: -1.4150 },
            { id: "39", date: "2024-09-10T15:45:00", location: "Southampton", species: "Southern rodent tick", latinName: "Ixodes acuminatus", lat: 50.9040, lng: -1.3930 },
            
            // Leicester area
            { id: "40", date: "2024-11-01T11:15:00", location: "Leicester", species: "Fox/badger tick", latinName: "Ixodes canisuga", lat: 52.6369, lng: -1.1398 },
            { id: "41", date: "2024-10-05T14:45:00", location: "Leicester", species: "Marsh tick", latinName: "Ixodes apronophorus", lat: 52.6420, lng: -1.1500 },
            { id: "42", date: "2024-09-09T10:00:00", location: "Leicester", species: "Southern rodent tick", latinName: "Ixodes acuminatus", lat: 52.6310, lng: -1.1290 },
            
            // Older sightings for historical data
            { id: "43", date: "2023-06-15T12:00:00", location: "Oxford", species: "Marsh tick", latinName: "Ixodes apronophorus", lat: 51.7520, lng: -1.2577 },
            { id: "44", date: "2023-07-20T14:30:00", location: "Cambridge", species: "Passerine tick", latinName: "Dermacentor frontalis", lat: 52.2053, lng: 0.1218 },
            { id: "45", date: "2022-08-10T11:15:00", location: "Brighton", species: "Southern rodent tick", latinName: "Ixodes acuminatus", lat: 50.8225, lng: -0.1372 },
            { id: "46", date: "2022-09-05T13:45:00", location: "Plymouth", species: "Fox/badger tick", latinName: "Ixodes canisuga", lat: 50.3755, lng: -4.1427 },
            { id: "47", date: "2021-05-22T10:30:00", location: "Aberdeen", species: "Marsh tick", latinName: "Ixodes apronophorus", lat: 57.1497, lng: -2.0943 },
            { id: "48", date: "2021-06-18T15:00:00", location: "Inverness", species: "Fox/badger tick", latinName: "Ixodes canisuga", lat: 57.4778, lng: -4.2247 },
            { id: "49", date: "2020-07-12T12:30:00", location: "York", species: "Southern rodent tick", latinName: "Ixodes acuminatus", lat: 53.9591, lng: -1.0815 },
            { id: "50", date: "2020-08-25T14:00:00", location: "Bath", species: "Passerine tick", latinName: "Dermacentor frontalis", lat: 51.3758, lng: -2.3599 }
        ];
        populateSpeciesFilter();
        addMarkers(sightings);
        updateResults(sightings);
    } finally {
        loadingIndicator.classList.add('hidden');
        
        // Always try to load local sightings as well
        loadFromLocalStorage();
    }
}

function populateSpeciesFilter() {
    const uniqueSpecies = [...new Set(sightings.map(s => s.species))];
    const speciesSelect = document.getElementById('speciesFilter');
    speciesSelect.innerHTML = '<option value="">All species</option>';
    uniqueSpecies.forEach(sp => {
        const option = document.createElement('option');
        option.value = sp;
        option.textContent = sp;
        speciesSelect.appendChild(option);
    });
}

function addMarkers(data) {
    // Remove existing markers
    markers.forEach(m => map.removeLayer(m.marker));
    markers = [];

    // Add new markers
    data.forEach(s => {
        // Handle both lat/lng and latitude/longitude field names
        const latitude = s.lat || s.latitude;
        const longitude = s.lng || s.longitude;
        
        if (!latitude || !longitude) {
            console.warn('Skipping sighting without coordinates:', s.id);
            return;
        }
        
        // Use API severity if available, otherwise compute from date
        const severity = s.severity || computeSeverity(s.date);
        const color = severityColors[severity];
        
        const marker = L.circleMarker([latitude, longitude], {
            radius: 8,
            color: "#000",
            fillColor: color,
            fillOpacity: 0.9,
            weight: 2
        }).addTo(map);

        marker.on("click", () => selectSighting(s, marker));
        markers.push({ marker, data: s });
    });
    
    console.log(`Added ${markers.length} markers to the map`);
}

function selectSighting(s, marker) {
    // Reset previous selection
    if (selectedMarker) {
        selectedMarker.setStyle({ radius: 8, weight: 2 });
    }
    
    // Highlight new selection
    marker.setStyle({ radius: 12, weight: 3 });
    selectedMarker = marker;
    currentSelectedLocation = s.location;

    // Update details box - use API severity if available
    const severity = s.severity || computeSeverity(s.date);
    const detailsBox = document.getElementById("detailsBox");
    const formattedDate = new Date(s.date).toLocaleDateString();
    const formattedTime = s.time || new Date(s.date).toLocaleTimeString();
    
    detailsBox.innerHTML = `
        <p><strong>Date:</strong> ${formattedDate}</p>
        <p><strong>Time:</strong> ${formattedTime}</p>
        <p><strong>ID:</strong> ${s.id}</p>
        <p><strong>City:</strong> ${s.location}</p>
        <p><strong>Species:</strong> ${s.species}</p>
        <p><strong>Latin Name:</strong> ${s.latinName || 'N/A'}</p>
        <p><strong>Severity:</strong> ${severity}</p>
        ${s.notes ? `<p><strong>Notes:</strong> ${s.notes}</p>` : ''}
    `;
    
    // Enable buttons
    document.getElementById("directionsBtn").disabled = false;
    document.getElementById("shareBtn").disabled = false;

    // Show timeline for this location
    showTimeline(s.location);

    // Highlight in results list
    document.querySelectorAll('.result-card').forEach(card => {
        card.classList.remove('active');
        if (card.dataset.id === s.id) {
            card.classList.add('active');
        }
    });
}

function showTimeline(location) {
    const locationSightings = sightings
        .filter(s => s.location === location)
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5);
    
    if (locationSightings.length > 1) {
        const timelineSection = document.getElementById('timelineSection');
        const timelineContent = document.getElementById('timelineContent');
        
        timelineContent.innerHTML = locationSightings.map(s => `
            <div class="timeline-item">
                <div class="timeline-date">${new Date(s.date).toLocaleDateString()}</div>
                <div class="timeline-text">${s.species} reported</div>
            </div>
        `).join('');
        
        timelineSection.style.display = 'block';
    } else {
        document.getElementById('timelineSection').style.display = 'none';
    }
}

function updateResults(data) {
    const resultsList = document.getElementById("resultsList");
    
    if (data.length === 0) {
        resultsList.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">No results found</p>';
        return;
    }
    
    resultsList.innerHTML = data.map(s => {
        const severity = s.severity || computeSeverity(s.date);
        const formattedDate = new Date(s.date).toLocaleDateString();
        
        return `
            <div class="result-card" data-id="${s.id}">
                <p style="margin-bottom: 8px;"><strong>${s.species}</strong></p>
                <p style="font-size: 12px; color: #666;">${s.location} • ${formattedDate}</p>
                <p style="font-size: 12px; color: #666;">Severity: ${severity}</p>
            </div>
        `;
    }).join('');

    // Add click handlers to result cards
    document.querySelectorAll('.result-card').forEach(card => {
        card.addEventListener('click', () => {
            const id = card.dataset.id;
            const sighting = data.find(s => s.id == id); // Use == to handle string/number comparison
            const markerObj = markers.find(m => m.data.id == id);
            if (sighting && markerObj) {
                const lat = sighting.lat || sighting.latitude;
                const lng = sighting.lng || sighting.longitude;
                selectSighting(sighting, markerObj.marker);
                map.setView([lat, lng], 9);
            }
        });
    });
}

function applyFilters() {
    const dateFilter = document.getElementById('dateFilter').value;
    const speciesFilter = document.getElementById('speciesFilter').value;
    const severityFilter = document.getElementById('severityFilter').value;

    let filtered = sightings.filter(s => {
        if (dateFilter && !s.date.startsWith(dateFilter)) return false;
        if (speciesFilter && s.species !== speciesFilter) return false;
        
        // Handle both API severity and computed severity
        if (severityFilter) {
            const sightingSeverity = s.severity || computeSeverity(s.date);
            // Handle both "Med" and "Medium" for backward compatibility
            const normalizedSeverity = sightingSeverity === "Med" ? "Medium" : sightingSeverity;
            const normalizedFilter = severityFilter === "Med" ? "Medium" : severityFilter;
            if (normalizedSeverity !== normalizedFilter) return false;
        }
        
        return true;
    });

    addMarkers(filtered);
    updateResults(filtered);
}

// Event listeners for filters
document.getElementById('dateFilter').addEventListener('change', applyFilters);
document.getElementById('speciesFilter').addEventListener('change', applyFilters);
document.getElementById('severityFilter').addEventListener('change', applyFilters);

// Reset button
document.getElementById('resetBtn').addEventListener('click', () => {
    document.getElementById('dateFilter').value = '';
    document.getElementById('speciesFilter').value = '';
    document.getElementById('severityFilter').value = '';
    
    document.getElementById("detailsBox").innerHTML = '<p style="color: #999; text-align: center; padding: 40px 0;">Click a marker to view details</p>';
    document.getElementById("directionsBtn").disabled = true;
    document.getElementById("shareBtn").disabled = true;
    document.getElementById('timelineSection').style.display = 'none';
    
    if (selectedMarker) {
        selectedMarker.setStyle({ radius: 8, weight: 2 });
        selectedMarker = null;
    }
    
    applyFilters();
});

// Get Directions button
document.getElementById('directionsBtn').addEventListener('click', () => {
    if (currentSelectedLocation) {
        const url = `https://www.google.com/maps/search/${encodeURIComponent(currentSelectedLocation + ', UK')}`;
        window.open(url, '_blank');
    }
});

// Share button
document.getElementById('shareBtn').addEventListener('click', () => {
    const shareText = `Check out this tick sighting in ${currentSelectedLocation}!`;
    if (navigator.share) {
        navigator.share({
            title: 'UK Tick Sighting',
            text: shareText,
            url: window.location.href
        });
    } else {
        navigator.clipboard.writeText(shareText + ' ' + window.location.href);
        alert('Link copied to clipboard!');
    }
});

// Report Sighting Modal
const reportModal = document.getElementById('reportModal');
const reportBtn = document.getElementById('reportSightingBtn');
const closeModal = document.getElementById('closeModal');
const cancelBtn = document.getElementById('cancelBtn');
const reportForm = document.getElementById('reportForm');

reportBtn.addEventListener('click', () => {
    reportModal.classList.add('active');
});

closeModal.addEventListener('click', () => {
    reportModal.classList.remove('active');
    reportForm.reset();
    clearFormErrors();
});

cancelBtn.addEventListener('click', () => {
    reportModal.classList.remove('active');
    reportForm.reset();
    clearFormErrors();
});

reportModal.addEventListener('click', (e) => {
    if (e.target === reportModal) {
        reportModal.classList.remove('active');
        reportForm.reset();
        clearFormErrors();
    }
});

// Form validation
function validateForm() {
    let isValid = true;
    clearFormErrors();
    
    const date = document.getElementById('sightingDate');
    const time = document.getElementById('sightingTime');
    const location = document.getElementById('sightingLocation');
    const species = document.getElementById('sightingSpecies');
    const severity = document.getElementById('sightingSeverity');
    
    if (!date.value) {
        showError('dateError', 'Date is required');
        date.classList.add('error');
        isValid = false;
    }
    
    if (!time.value) {
        showError('timeError', 'Time is required');
        time.classList.add('error');
        isValid = false;
    }
    
    if (!location.value) {
        showError('locationError', 'Location is required');
        location.classList.add('error');
        isValid = false;
    }
    
    if (!species.value) {
        showError('speciesError', 'Please select a species');
        species.classList.add('error');
        isValid = false;
    }
    
    if (!severity.value) {
        showError('severityError', 'Please select severity');
        severity.classList.add('error');
        isValid = false;
    }
    
    // Validate image size if uploaded
    const imageFile = document.getElementById('sightingImage').files[0];
    if (imageFile && imageFile.size > 5 * 1024 * 1024) {
        showFormMessage('Image size must be less than 5MB', 'warning');
        isValid = false;
    }
    
    return isValid;
}

function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    errorElement.textContent = message;
    errorElement.classList.add('show');
}

function clearFormErrors() {
    document.querySelectorAll('.error-message').forEach(el => {
        el.classList.remove('show');
        el.textContent = '';
    });
    document.querySelectorAll('.error, .success').forEach(el => {
        el.classList.remove('error', 'success');
    });
    const formMessages = document.getElementById('formMessages');
    formMessages.classList.remove('show', 'success', 'error', 'warning');
}

function showFormMessage(message, type) {
    const formMessages = document.getElementById('formMessages');
    formMessages.textContent = message;
    formMessages.className = 'form-messages show ' + type;
}

// Handle form submission
reportForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
        return;
    }
    
    const formData = {
        date: document.getElementById('sightingDate').value + 'T' + document.getElementById('sightingTime').value,
        location: document.getElementById('sightingLocation').value,
        species: document.getElementById('sightingSpecies').value,
        severity: document.getElementById('sightingSeverity').value,
        notes: document.getElementById('sightingNotes').value,
        latinName: getLatinName(document.getElementById('sightingSpecies').value),
        lat: 51.5074, // Default to London - in production, would use geocoding
        lng: -0.1278
    };
    
    try {
        // Try to post to API
        const response = await fetch(`${API_BASE_URL}/sightings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        if (response.ok) {
            showFormMessage('Sighting reported successfully!', 'success');
            setTimeout(() => {
                reportModal.classList.remove('active');
                reportForm.reset();
                clearFormErrors();
                fetchSightings(); // Refresh sightings
            }, 2000);
        } else {
            throw new Error('API submission failed');
        }
    } catch (error) {
        console.error('Error submitting sighting:', error);
        // Fallback to localStorage
        saveToLocalStorage(formData);
        showFormMessage('Sighting saved locally! (API unavailable)', 'success');
        setTimeout(() => {
            reportModal.classList.remove('active');
            reportForm.reset();
            clearFormErrors();
            loadFromLocalStorage();
        }, 2000);
    }
});

function getLatinName(species) {
    const latinNames = {
        "Marsh tick": "Ixodes apronophorus",
        "Southern rodent tick": "Ixodes acuminatus",
        "Passerine tick": "Dermacentor frontalis",
        "Fox/badger tick": "Ixodes canisuga",
        "Tree-hole tick": "Ixodes arboricola"
    };
    return latinNames[species] || "Unknown";
}

// LocalStorage functions
function saveToLocalStorage(sighting) {
    const saved = JSON.parse(localStorage.getItem('tickSightings') || '[]');
    sighting.id = 'local-' + Date.now();
    saved.push(sighting);
    localStorage.setItem('tickSightings', JSON.stringify(saved));
}

function loadFromLocalStorage() {
    const saved = JSON.parse(localStorage.getItem('tickSightings') || '[]');
    if (saved.length > 0) {
        console.log(`Loaded ${saved.length} local sightings from localStorage`);
        // Merge with existing sightings, avoiding duplicates
        const existingIds = new Set(sightings.map(s => s.id));
        const newSightings = saved.filter(s => !existingIds.has(s.id));
        sightings = [...sightings, ...newSightings];
        addMarkers(sightings);
        updateResults(sightings);
    }
}

// Species Guide Modal
const speciesModal = document.getElementById('speciesModal');
const speciesBtn = document.getElementById('speciesGuideBtn');
const closeSpeciesModal = document.getElementById('closeSpeciesModal');

speciesBtn.addEventListener('click', () => {
    speciesModal.classList.add('active');
});

closeSpeciesModal.addEventListener('click', () => {
    speciesModal.classList.remove('active');
});

speciesModal.addEventListener('click', (e) => {
    if (e.target === speciesModal) {
        speciesModal.classList.remove('active');
    }
});

// Seasonal Activity Modal
const seasonalModal = document.getElementById('seasonalModal');
const seasonalBtn = document.getElementById('seasonalActivityBtn');
const closeSeasonalModal = document.getElementById('closeSeasonalModal');
let seasonalChart = null;

seasonalBtn.addEventListener('click', () => {
    seasonalModal.classList.add('active');
    updateSeasonalChart();
});

closeSeasonalModal.addEventListener('click', () => {
    seasonalModal.classList.remove('active');
});

seasonalModal.addEventListener('click', (e) => {
    if (e.target === seasonalModal) {
        seasonalModal.classList.remove('active');
    }
});

document.getElementById('chartCity').addEventListener('change', updateSeasonalChart);
document.getElementById('chartYear').addEventListener('change', updateSeasonalChart);

function updateSeasonalChart() {
    const city = document.getElementById('chartCity').value;
    const year = document.getElementById('chartYear').value;
    
    let filtered = sightings.filter(s => {
        if (city && s.location !== city) return false;
        if (year && !s.date.startsWith(year)) return false;
        return true;
    });
    
    const monthlyCounts = new Array(12).fill(0);
    filtered.forEach(s => {
        const month = new Date(s.date).getMonth();
        monthlyCounts[month]++;
    });
    
    const ctx = document.getElementById('seasonalChart').getContext('2d');
    
    if (seasonalChart) {
        seasonalChart.destroy();
    }
    
    seasonalChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            datasets: [{
                label: 'Tick Sightings',
                data: monthlyCounts,
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                tension: 0.4,
                fill: true,
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                title: {
                    display: true,
                    text: `Seasonal Activity ${city ? '- ' + city : ''} ${year ? '(' + year + ')' : ''}`,
                    font: {
                        size: 16,
                        weight: 'bold'
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    },
                    title: {
                        display: true,
                        text: 'Number of Sightings'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Month'
                    }
                }
            }
        }
    });
}

// Initialize the application
console.log('Initializing UK Tick Sightings Tracker...');
console.log('API Base URL:', API_BASE_URL);
fetchSightings();