// API configuration
const API_BASE_URL = 'https://dev-task.elancoapps.com'; //where tick sighting data is stored
let sightings = []; // array to store all tick sightings loaded from api or local storage
let currentSelectedLocation = null; // keeps track of which location the user has currently selected on the map

const severityColors = { // colour codes for different severity levels, used to colour map markers
    "Low": "#43A047",
    "Med": "#FFB300",
    "High": "#E53935",
    "Older": "#7E57C2",
    "Recent": "#656a71"
};

// compute severity based on date
// newer sightings are more severe because ticks might still be active there
function computeSeverity(dateString) { 
    const d = new Date(dateString); // convert the date string into a javascript date object
    const now = new Date(); // get the current date and time
    const days = (now - d) / (1000 * 60 * 60 * 24); // calculate how many days ago the sighting occurred
    // (difference in milliseconds / milliseconds per day)

    // severity based on age of sighting
    if (days <= 30) return "Recent";      // within last month - most urgent
    if (days <= 180) return "High";       // within last 6 months - high priority
    if (days <= 365) return "Medium";     // within last year - medium priority
    if (days <= 1825) return "Low";       // within last 5 years - low priority
    return "Older";                        // older than 5 years - least urgent
}

// initialise map
const map = L.map('map').setView([54.5, -3.0], 6); // create the leaflet map, centered on uk (lat: 54.5, lng: -3.0) with zoom level 6
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { //display actual map graphics from openstreetmap
    maxZoom: 18, // maximum zoom level allowed
    attribution: '© OpenStreetMap contributors' // credit to openstreetmap
}).addTo(map);

let markers = []; // array to store all marker objects placed on the map
let selectedMarker = null; // keeps track of which marker is currently selected by the user

// fetch sightings from API
async function fetchSightings() { // main function to load all tick sighting data from the api server
    const loadingIndicator = document.getElementById('loadingIndicator'); // get the loading spinner element from the page
    loadingIndicator.classList.remove('hidden'); // show the loading spinner while data is being fetched
    
    try {
        const response = await fetch(`${API_BASE_URL}/sightings`);  // make http request to get sightings data from api
        if (!response.ok) { // if response status is not ok, throw an error
            throw new Error(`API Error: ${response.status}`);
        }
        const data = await response.json(); // convert the response from json format into javascript object/array
        
        // data is an array check
        if (Array.isArray(data)) {
            sightings = data;
            console.log(`Loaded ${sightings.length} sightings from API`);

        } else if (data.sightings && Array.isArray(data.sightings)) { // or if data is an object with a 'sightings' property that's an array
            sightings = data.sightings;
            console.log(`Loaded ${sightings.length} sightings from API`);

        } else { // if neither format matches, the api returned unexpected data
            throw new Error('Invalid data format from API');
        }
        
        // call populate species filer function (populate the species dropdown filter with unique species from data)
        populateSpeciesFilter();
        
        // call add markers and update results functions (add map markers for all sightings and display sightings in the results list panel)
        addMarkers(sightings);
        updateResults(sightings);
    } catch (error) {  // if primary api endpoint fails, log the error
        console.error('Error fetching sightings:', error);
        console.log('Attempting to load from API with alternative endpoint...');
        console.log('Attempting to load from API with alternative endpoint...');
        
        // try alternative 
        try {  // attempt to use a backup api endpoint
            const altResponse = await fetch(`${API_BASE_URL}/api/sightings`);  // try fetching from alternative url path
            if (altResponse.ok) { // if alternative endpoint works
                const altData = await altResponse.json(); // handle data whether it's array or nested in object
                sightings = Array.isArray(altData) ? altData : altData.sightings || [];
                console.log(`Loaded ${sightings.length} sightings from alternative endpoint`);

                populateSpeciesFilter(); // populate interface with alternative data
                addMarkers(sightings);
                updateResults(sightings);
                loadingIndicator.classList.add('hidden'); // hide loading spinner and exit function
                return;
            }
        } catch (altError) {
            console.error('Alternative endpoint also failed:', altError); // if alternative endpoint also fails, log it
        }
        
        // just in case data if api doesnt work
        console.log('Using fallback sample data...');
        sightings = [
            // london
            { id: "01", date: "2024-11-15T14:30:00", location: "London", species: "Fox/badger tick", latinName: "Ixodes canisuga", lat: 51.5074, lng: -0.1278 },
            { id: "02", date: "2024-11-10T09:15:00", location: "London", species: "Southern rodent tick", latinName: "Ixodes acuminatus", lat: 51.5155, lng: -0.0922 },
            { id: "03", date: "2024-10-28T16:45:00", location: "London", species: "Marsh tick", latinName: "Ixodes apronophorus", lat: 51.4893, lng: -0.1440 },
            { id: "51", date: "2024-11-16T10:30:00", location: "London", species: "Tree-hole tick", latinName: "Ixodes arboricola", lat: 51.5200, lng: -0.1500 },
            
            // manchester
            { id: "04", date: "2024-11-12T11:20:00", location: "Manchester", species: "Marsh tick", latinName: "Ixodes apronophorus", lat: 53.4808, lng: -2.2426 },
            { id: "05", date: "2024-10-05T13:00:00", location: "Manchester", species: "Fox/badger tick", latinName: "Ixodes canisuga", lat: 53.4630, lng: -2.2910 },
            { id: "06", date: "2024-09-18T10:30:00", location: "Manchester", species: "Passerine tick", latinName: "Dermacentor frontalis", lat: 53.5070, lng: -2.2280 },
            { id: "52", date: "2024-10-20T14:15:00", location: "Manchester", species: "Tree-hole tick", latinName: "Ixodes arboricola", lat: 53.4900, lng: -2.2500 },
            
            // glasgow
            { id: "07", date: "2024-11-08T08:45:00", location: "Glasgow", species: "Passerine tick", latinName: "Dermacentor frontalis", lat: 55.8642, lng: -4.2518 },
            { id: "08", date: "2024-10-22T15:00:00", location: "Glasgow", species: "Marsh tick", latinName: "Ixodes apronophorus", lat: 55.8555, lng: -4.2407 },
            { id: "09", date: "2024-09-30T12:15:00", location: "Glasgow", species: "Southern rodent tick", latinName: "Ixodes acuminatus", lat: 55.8730, lng: -4.2620 },
            { id: "53", date: "2024-09-22T11:45:00", location: "Glasgow", species: "Tree-hole tick", latinName: "Ixodes arboricola", lat: 55.8700, lng: -4.2600 },
            
            // birmingham
            { id: "10", date: "2024-11-14T10:00:00", location: "Birmingham", species: "Fox/badger tick", latinName: "Ixodes canisuga", lat: 52.4862, lng: -1.8904 },
            { id: "11", date: "2024-10-19T14:30:00", location: "Birmingham", species: "Southern rodent tick", latinName: "Ixodes acuminatus", lat: 52.4800, lng: -1.9025 },
            { id: "12", date: "2024-09-25T09:45:00", location: "Birmingham", species: "Marsh tick", latinName: "Ixodes apronophorus", lat: 52.4920, lng: -1.8790 },
            
            // liverpool
            { id: "13", date: "2024-11-11T13:20:00", location: "Liverpool", species: "Southern rodent tick", latinName: "Ixodes acuminatus", lat: 53.4084, lng: -2.9916 },
            { id: "14", date: "2024-10-16T11:00:00", location: "Liverpool", species: "Passerine tick", latinName: "Dermacentor frontalis", lat: 53.4150, lng: -2.9770 },
            { id: "15", date: "2024-09-12T16:30:00", location: "Liverpool", species: "Fox/badger tick", latinName: "Ixodes canisuga", lat: 53.4020, lng: -3.0050 },
            
            // edinburgh
            { id: "16", date: "2024-11-13T10:45:00", location: "Edinburgh", species: "Marsh tick", latinName: "Ixodes apronophorus", lat: 55.9533, lng: -3.1883 },
            { id: "17", date: "2024-10-20T15:15:00", location: "Edinburgh", species: "Fox/badger tick", latinName: "Ixodes canisuga", lat: 55.9480, lng: -3.2000 },
            { id: "18", date: "2024-09-08T12:00:00", location: "Edinburgh", species: "Southern rodent tick", latinName: "Ixodes acuminatus", lat: 55.9600, lng: -3.1750 },
            { id: "54", date: "2024-08-15T13:30:00", location: "Edinburgh", species: "Tree-hole tick", latinName: "Ixodes arboricola", lat: 55.9550, lng: -3.1900 },
            
            // leeds
            { id: "19", date: "2024-11-09T09:30:00", location: "Leeds", species: "Passerine tick", latinName: "Dermacentor frontalis", lat: 53.8008, lng: -1.5491 },
            { id: "20", date: "2024-10-14T14:00:00", location: "Leeds", species: "Marsh tick", latinName: "Ixodes apronophorus", lat: 53.7950, lng: -1.5600 },
            { id: "21", date: "2024-09-20T11:45:00", location: "Leeds", species: "Fox/badger tick", latinName: "Ixodes canisuga", lat: 53.8070, lng: -1.5380 },
            
            // bristol
            { id: "22", date: "2024-11-07T12:30:00", location: "Bristol", species: "Southern rodent tick", latinName: "Ixodes acuminatus", lat: 51.4545, lng: -2.5879 },
            { id: "23", date: "2024-10-11T10:15:00", location: "Bristol", species: "Fox/badger tick", latinName: "Ixodes canisuga", lat: 51.4600, lng: -2.5950 },
            { id: "24", date: "2024-09-17T15:00:00", location: "Bristol", species: "Marsh tick", latinName: "Ixodes apronophorus", lat: 51.4490, lng: -2.5800 },
            { id: "55", date: "2024-07-10T16:00:00", location: "Bristol", species: "Tree-hole tick", latinName: "Ixodes arboricola", lat: 51.4520, lng: -2.5900 },
            
            // sheffield
            { id: "25", date: "2024-11-06T11:00:00", location: "Sheffield", species: "Fox/badger tick", latinName: "Ixodes canisuga", lat: 53.3811, lng: -1.4701 },
            { id: "26", date: "2024-10-10T13:45:00", location: "Sheffield", species: "Marsh tick", latinName: "Ixodes apronophorus", lat: 53.3750, lng: -1.4850 },
            { id: "27", date: "2024-09-15T09:00:00", location: "Sheffield", species: "Passerine tick", latinName: "Dermacentor frontalis", lat: 53.3880, lng: -1.4550 },
            
            // newcastle
            { id: "28", date: "2024-11-05T14:20:00", location: "Newcastle", species: "Marsh tick", latinName: "Ixodes apronophorus", lat: 54.9783, lng: -1.6178 },
            { id: "29", date: "2024-10-09T12:00:00", location: "Newcastle", species: "Southern rodent tick", latinName: "Ixodes acuminatus", lat: 54.9720, lng: -1.6300 },
            { id: "30", date: "2024-09-14T10:30:00", location: "Newcastle", species: "Fox/badger tick", latinName: "Ixodes canisuga", lat: 54.9850, lng: -1.6050 },
            
            // cardiff
            { id: "31", date: "2024-11-04T15:30:00", location: "Cardiff", species: "Passerine tick", latinName: "Dermacentor frontalis", lat: 51.4816, lng: -3.1791 },
            { id: "32", date: "2024-10-08T11:30:00", location: "Cardiff", species: "Marsh tick", latinName: "Ixodes apronophorus", lat: 51.4750, lng: -3.1900 },
            { id: "33", date: "2024-09-13T14:15:00", location: "Cardiff", species: "Fox/badger tick", latinName: "Ixodes canisuga", lat: 51.4880, lng: -3.1680 },
            
            // nottingham
            { id: "34", date: "2024-11-03T10:15:00", location: "Nottingham", species: "Southern rodent tick", latinName: "Ixodes acuminatus", lat: 52.9548, lng: -1.1581 },
            { id: "35", date: "2024-10-07T13:00:00", location: "Nottingham", species: "Fox/badger tick", latinName: "Ixodes canisuga", lat: 52.9600, lng: -1.1700 },
            { id: "36", date: "2024-09-11T11:30:00", location: "Nottingham", species: "Marsh tick", latinName: "Ixodes apronophorus", lat: 52.9490, lng: -1.1460 },
            
            // southampton
            { id: "37", date: "2024-11-02T12:45:00", location: "Southampton", species: "Marsh tick", latinName: "Ixodes apronophorus", lat: 50.9097, lng: -1.4044 },
            { id: "38", date: "2024-10-06T09:30:00", location: "Southampton", species: "Passerine tick", latinName: "Dermacentor frontalis", lat: 50.9150, lng: -1.4150 },
            { id: "39", date: "2024-09-10T15:45:00", location: "Southampton", species: "Southern rodent tick", latinName: "Ixodes acuminatus", lat: 50.9040, lng: -1.3930 },
            
            // leicester
            { id: "40", date: "2024-11-01T11:15:00", location: "Leicester", species: "Fox/badger tick", latinName: "Ixodes canisuga", lat: 52.6369, lng: -1.1398 },
            { id: "41", date: "2024-10-05T14:45:00", location: "Leicester", species: "Marsh tick", latinName: "Ixodes apronophorus", lat: 52.6420, lng: -1.1500 },
            { id: "42", date: "2024-09-09T10:00:00", location: "Leicester", species: "Southern rodent tick", latinName: "Ixodes acuminatus", lat: 52.6310, lng: -1.1290 },
            
            // older sightings for historical data
            { id: "43", date: "2023-06-15T12:00:00", location: "Oxford", species: "Marsh tick", latinName: "Ixodes apronophorus", lat: 51.7520, lng: -1.2577 },
            { id: "44", date: "2023-07-20T14:30:00", location: "Cambridge", species: "Passerine tick", latinName: "Dermacentor frontalis", lat: 52.2053, lng: 0.1218 },
            { id: "45", date: "2022-08-10T11:15:00", location: "Brighton", species: "Southern rodent tick", latinName: "Ixodes acuminatus", lat: 50.8225, lng: -0.1372 },
            { id: "46", date: "2022-09-05T13:45:00", location: "Plymouth", species: "Fox/badger tick", latinName: "Ixodes canisuga", lat: 50.3755, lng: -4.1427 },
            { id: "47", date: "2021-05-22T10:30:00", location: "Aberdeen", species: "Marsh tick", latinName: "Ixodes apronophorus", lat: 57.1497, lng: -2.0943 },
            { id: "48", date: "2021-06-18T15:00:00", location: "Inverness", species: "Fox/badger tick", latinName: "Ixodes canisuga", lat: 57.4778, lng: -4.2247 },
            { id: "49", date: "2020-07-12T12:30:00", location: "York", species: "Southern rodent tick", latinName: "Ixodes acuminatus", lat: 53.9591, lng: -1.0815 },
            { id: "50", date: "2020-08-25T14:00:00", location: "Bath", species: "Passerine tick", latinName: "Dermacentor frontalis", lat: 51.3758, lng: -2.3599 }
        ];
        populateSpeciesFilter();  // fill the species dropdown with available species
        addMarkers(sightings);  // place markers on map for each sighting
        updateResults(sightings);  // display sightings in the results panel
    } finally {
        loadingIndicator.classList.add('hidden');  // hide loading spinner no matter what
        loadFromLocalStorage();  // load any sightings saved locally in browser
    }
}

function populateSpeciesFilter() {
    const uniqueSpecies = [...new Set(sightings.map(s => s.species))];  // get unique species names, removes duplicates
    const speciesSelect = document.getElementById('speciesFilter');  // get the species dropdown element
    speciesSelect.innerHTML = '<option value="">All species</option>';  // reset dropdown with default "all" option
    uniqueSpecies.forEach(sp => {  // loop through each unique species
        const option = document.createElement('option');  // create new option element
        option.value = sp;  // set the value attribute
        option.textContent = sp;  // set the displayed text
        speciesSelect.appendChild(option);  // add option to dropdown
    });
}

function addMarkers(data) {
    markers.forEach(m => map.removeLayer(m.marker));  // remove all existing markers from map
    markers = [];  // clear the markers array

    data.forEach(s => {  // loop through each sighting in the data
        const latitude = s.lat || s.latitude;  // get latitude (handles different property names)
        const longitude = s.lng || s.longitude;  // get longitude (handles different property names)
        
        if (!latitude || !longitude) {  // if coordinates are missing
            console.warn('Skipping sighting without coordinates:', s.id);  // log warning
            return;  // skip this sighting
        }
        
        const severity = s.severity || computeSeverity(s.date);  // use api severity or calculate from date
        const colour = severityColors[severity];  // get colour based on severity level
        
        const marker = L.circleMarker([latitude, longitude], {  // create circular marker at coordinates
            radius: 8,  // marker size in pixels
            color: "#000",  // black border
            fillColor: colour,  // fill colour based on severity
            fillOpacity: 0.9,  // almost fully opaque
            weight: 2  // border thickness
        }).addTo(map);  // add marker to the map

        marker.on("click", () => selectSighting(s, marker));  // when marker clicked, select this sighting
        markers.push({ marker, data: s });  // store marker and its data in array
    });
    
    console.log(`Added ${markers.length} markers to the map`);  // log how many markers were added
}

function selectSighting(s, marker) {
    if (selectedMarker) {  // if there's a previously selected marker
        selectedMarker.setStyle({ radius: 8, weight: 2 });  // reset it to normal size
    }
    
    marker.setStyle({ radius: 12, weight: 3 });  // make selected marker larger and bolder
    selectedMarker = marker;  // store this as the currently selected marker
    currentSelectedLocation = s.location;  // store the location name

   const severity = s.severity || computeSeverity(s.date);  // use api severity or calculate from date
    const detailsBox = document.getElementById("detailsBox");  // get the details panel element
    const formattedDate = new Date(s.date).toLocaleDateString();  // format date for display
    const formattedTime = s.time || new Date(s.date).toLocaleTimeString();  // use time field or extract from date
    
    detailsBox.innerHTML = `  // populate details panel with sighting information
        <p><strong>Date:</strong> ${formattedDate}</p>
        <p><strong>Time:</strong> ${formattedTime}</p>
        <p><strong>ID:</strong> ${s.id}</p>
        <p><strong>City:</strong> ${s.location}</p>
        <p><strong>Species:</strong> ${s.species}</p>
        <p><strong>Latin Name:</strong> ${s.latinName || 'N/A'}</p>
        <p><strong>Severity:</strong> ${severity}</p>
        ${s.notes ? `<p><strong>Notes:</strong> ${s.notes}</p>` : ''}  // only show notes if they exist
    `;
    
    document.getElementById("directionsBtn").disabled = false;  // enable directions button
    document.getElementById("shareBtn").disabled = false;  // enable share button
    
    showTimeline(s.location);  // display timeline of sightings for this location
    
    document.querySelectorAll('.result-card').forEach(card => {  // loop through all result cards
        card.classList.remove('active');  // remove highlight from all cards
        if (card.dataset.id === s.id) {  // if this card matches selected sighting
            card.classList.add('active');  // highlight this card
        }
    });
}

function showTimeline(location) {
    const locationSightings = sightings  // get all sightings for this location
        .filter(s => s.location === location)  // filter by matching location
        .sort((a, b) => new Date(b.date) - new Date(a.date))  // sort newest first
        .slice(0, 5);  // take only the 5 most recent
    
    if (locationSightings.length > 1) {  // only show timeline if multiple sightings exist
        const timelineSection = document.getElementById('timelineSection');  // get timeline container
        const timelineContent = document.getElementById('timelineContent');  // get timeline content area
        
        timelineContent.innerHTML = locationSightings.map(s => `  // create html for each sighting
            <div class="timeline-item">
                <div class="timeline-date">${new Date(s.date).toLocaleDateString()}</div>
                <div class="timeline-text">${s.species} reported</div>
            </div>
        `).join('');  // combine all items into single html string
        
        timelineSection.style.display = 'block';  // show the timeline section
    } else {
        document.getElementById('timelineSection').style.display = 'none';  // hide timeline if only one sighting
    }
}

function updateResults(data) {
    const resultsList = document.getElementById("resultsList");  // get results list container
    
    if (data.length === 0) {  // if no sightings to display
        resultsList.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">No results found</p>';  // show no results message
        return;  // exit function
    }
    
    resultsList.innerHTML = data.map(s => {  // create html card for each sighting
        const severity = s.severity || computeSeverity(s.date);  // get or calculate severity
        const formattedDate = new Date(s.date).toLocaleDateString();  // format date for display
        
        return `
            <div class="result-card" data-id="${s.id}">
                <p style="margin-bottom: 8px;"><strong>${s.species}</strong></p>
                <p style="font-size: 12px; color: #666;">${s.location} • ${formattedDate}</p>
                <p style="font-size: 12px; color: #666;">Severity: ${severity}</p>
            </div>
        `;
    }).join('');  // combine all cards into single html string
    
    document.querySelectorAll('.result-card').forEach(card => {  // add click handlers to each result card
        card.addEventListener('click', () => {  // when card is clicked
            const id = card.dataset.id;  // get sighting id from card
            const sighting = data.find(s => s.id == id);  // find matching sighting (== handles string/number)
            const markerObj = markers.find(m => m.data.id == id);  // find matching marker
            if (sighting && markerObj) {  // if both found
                const lat = sighting.lat || sighting.latitude;  // get latitude
                const lng = sighting.lng || sighting.longitude;  // get longitude
                selectSighting(sighting, markerObj.marker);  // select this sighting
                map.setView([lat, lng], 9);  // centre map on this location
            }
        });
    });
}

function applyFilters() {
    const dateFilter = document.getElementById('dateFilter').value;  // get selected date from filter
    const speciesFilter = document.getElementById('speciesFilter').value;  // get selected species from filter
    const severityFilter = document.getElementById('severityFilter').value;  // get selected severity from filter
    
    let filtered = sightings.filter(s => {  // filter sightings based on selected criteria
        if (dateFilter && !s.date.startsWith(dateFilter)) return false;  // exclude if date doesn't match
        if (speciesFilter && s.species !== speciesFilter) return false;  // exclude if species doesn't match
        
        if (severityFilter) {  // if severity filter is selected
            const sightingSeverity = s.severity || computeSeverity(s.date);  // get or calculate severity
            const normalisedSeverity = sightingSeverity === "Med" ? "Medium" : sightingSeverity;  // convert "Med" to "Medium"
            const normalisedFilter = severityFilter === "Med" ? "Medium" : severityFilter;  // convert filter value too
            if (normalisedSeverity !== normalisedFilter) return false;  // exclude if severity doesn't match
        }
        
        return true;  // include this sighting if it passes all filters
    });
    
    addMarkers(filtered);  // update map markers with filtered data
    updateResults(filtered);  // update results list with filtered data
}

document.getElementById('dateFilter').addEventListener('change', applyFilters);  // apply filters when date changes
document.getElementById('speciesFilter').addEventListener('change', applyFilters);  // apply filters when species changes
document.getElementById('severityFilter').addEventListener('change', applyFilters);  // apply filters when severity changes

document.getElementById('resetBtn').addEventListener('click', () => {  // when reset button clicked
    document.getElementById('dateFilter').value = '';  // clear date filter
    document.getElementById('speciesFilter').value = '';  // clear species filter
    document.getElementById('severityFilter').value = '';  // clear severity filter
    
    document.getElementById("detailsBox").innerHTML = '<p style="color: #999; text-align: center; padding: 40px 0;">Click a marker to view details</p>';  // reset details panel
    document.getElementById("directionsBtn").disabled = true;  // disable directions button
    document.getElementById("shareBtn").disabled = true;  // disable share button
    document.getElementById('timelineSection').style.display = 'none';  // hide timeline
    
    if (selectedMarker) {  // if a marker is selected
        selectedMarker.setStyle({ radius: 8, weight: 2 });  // reset marker to normal size
        selectedMarker = null;  // clear selection
    }
    
    applyFilters();  // reapply filters (will show all sightings)
});

document.getElementById('directionsBtn').addEventListener('click', () => {  // when directions button clicked
    if (currentSelectedLocation) {  // if a location is selected
        const url = `https://www.google.com/maps/search/${encodeURIComponent(currentSelectedLocation + ', UK')}`;  // create google maps search url
        window.open(url, '_blank');  // open in new tab
    }
});

document.getElementById('shareBtn').addEventListener('click', () => {  // when share button clicked
    const shareText = `Check out this tick sighting in ${currentSelectedLocation}!`;  // create share message
    if (navigator.share) {  // if device supports native sharing
        navigator.share({  // use native share dialog
            title: 'UK Tick Sighting',
            text: shareText,
            url: window.location.href
        });
    } else {  // fallback for devices without native sharing
        navigator.clipboard.writeText(shareText + ' ' + window.location.href);  // copy to clipboard
        alert('Link copied to clipboard!');  // notify user
    }
});

const reportModal = document.getElementById('reportModal');  // get report sighting modal popup
const reportBtn = document.getElementById('reportSightingBtn');  // get report button
const closeModal = document.getElementById('closeModal');  // get close (x) button
const cancelBtn = document.getElementById('cancelBtn');  // get cancel button
const reportForm = document.getElementById('reportForm');  // get the form element

reportBtn.addEventListener('click', () => {  // when report button clicked
    reportModal.classList.add('active');  // show the modal
});

closeModal.addEventListener('click', () => {  // when close (x) button clicked
    reportModal.classList.remove('active');  // hide the modal
    reportForm.reset();  // clear all form fields
    clearFormErrors();  // remove any error messages
});

cancelBtn.addEventListener('click', () => {  // when cancel button clicked
    reportModal.classList.remove('active');  // hide the modal
    reportForm.reset();  // clear all form fields
    clearFormErrors();  // remove any error messages
});

reportModal.addEventListener('click', (e) => {  // when clicking anywhere on modal
    if (e.target === reportModal) {  // if clicked on backdrop (not modal content)
        reportModal.classList.remove('active');  // hide the modal
        reportForm.reset();  // clear all form fields
        clearFormErrors();  // remove any error messages
    }
});

function validateForm() {
    let isValid = true;  // assume form is valid initially
    clearFormErrors();  // clear any previous error messages
    
    const date = document.getElementById('sightingDate');  // get date input field
    const time = document.getElementById('sightingTime');  // get time input field
    const location = document.getElementById('sightingLocation');  // get location input field
    const species = document.getElementById('sightingSpecies');  // get species dropdown
    const severity = document.getElementById('sightingSeverity');  // get severity dropdown
    
    if (!date.value) {  // if date is empty
        showError('dateError', 'Date is required');  // show error message
        date.classList.add('error');  // highlight field in red
        isValid = false;  // mark form as invalid
    }
    
    if (!time.value) {  // if time is empty
        showError('timeError', 'Time is required');  // show error message
        time.classList.add('error');  // highlight field in red
        isValid = false;  // mark form as invalid
    }
    
    if (!location.value) {  // if location is empty
        showError('locationError', 'Location is required');  // show error message
        location.classList.add('error');  // highlight field in red
        isValid = false;  // mark form as invalid
    }
    
    if (!species.value) {  // if no species selected
        showError('speciesError', 'Please select a species');  // show error message
        species.classList.add('error');  // highlight field in red
        isValid = false;  // mark form as invalid
    }
    
    if (!severity.value) {  // if no severity selected
        showError('severityError', 'Please select severity');  // show error message
        severity.classList.add('error');  // highlight field in red
        isValid = false;  // mark form as invalid
    }
    
    const imageFile = document.getElementById('sightingImage').files[0];  // get uploaded image file if any
    if (imageFile && imageFile.size > 5 * 1024 * 1024) {  // if image exists and is larger than 5mb
        showFormMessage('Image size must be less than 5MB', 'warning');  // show warning message
        isValid = false;  // mark form as invalid
    }
    
    return isValid;  // return whether form passed all validation checks
}

function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);  // get error message element
    errorElement.textContent = message;  // set error text
    errorElement.classList.add('show');  // make error visible
}

function clearFormErrors() {
    document.querySelectorAll('.error-message').forEach(el => {  // loop through all error messages
        el.classList.remove('show');  // hide error message
        el.textContent = '';  // clear error text
    });
    document.querySelectorAll('.error, .success').forEach(el => {  // loop through all form fields
        el.classList.remove('error', 'success');  // remove error/success styling
    });
    const formMessages = document.getElementById('formMessages');  // get general form message area
    formMessages.classList.remove('show', 'success', 'error', 'warning');  // hide and clear all message types
}

function showFormMessage(message, type) {
    const formMessages = document.getElementById('formMessages');  // get general form message area
    formMessages.textContent = message;  // set message text
    formMessages.className = 'form-messages show ' + type;  // set message styling (success/error/warning)
}

reportForm.addEventListener('submit', async (e) => {  // when form is submitted
    e.preventDefault();  // prevent default form submission (page reload)
    
    if (!validateForm()) {  // check if form is valid
        return;  // stop if validation failed
    }
    
    const formData = {  // create object with form data
        date: document.getElementById('sightingDate').value + 'T' + document.getElementById('sightingTime').value,  // combine date and time
        location: document.getElementById('sightingLocation').value,  // get location
        species: document.getElementById('sightingSpecies').value,  // get species
        severity: document.getElementById('sightingSeverity').value,  // get severity
        notes: document.getElementById('sightingNotes').value,  // get optional notes
        latinName: getLatinName(document.getElementById('sightingSpecies').value),  // get latin name for species
        lat: 51.5074,  // default to london coordinates (in production would use geocoding)
        lng: -0.1278
    };
    
    try {
        const response = await fetch(`${API_BASE_URL}/sightings`, {  // send data to api
            method: 'POST',  // use post method to create new record
            headers: {
                'Content-Type': 'application/json'  // tell server we're sending json
            },
            body: JSON.stringify(formData)  // convert data object to json string
        });
        
        if (response.ok) {  // if api accepted the submission
            showFormMessage('Sighting reported successfully!', 'success');  // show success message
            setTimeout(() => {  // wait 2 seconds then
                reportModal.classList.remove('active');  // close modal
                reportForm.reset();  // clear form
                clearFormErrors();  // clear any messages
                fetchSightings();  // reload all sightings from api
            }, 2000);
        } else {
            throw new Error('API submission failed');  // trigger error handling
        }
    } catch (error) {
        console.error('Error submitting sighting:', error);  // log error
        saveToLocalStorage(formData);  // save to browser storage as backup
        showFormMessage('Sighting saved locally! (API unavailable)', 'success');  // inform user
        setTimeout(() => {  // wait 2 seconds then
            reportModal.classList.remove('active');  // close modal
            reportForm.reset();  // clear form
            clearFormErrors();  // clear any messages
            loadFromLocalStorage();  // reload sightings including local ones
        }, 2000);
    }
});

function getLatinName(species) {
    const latinNames = {  // lookup table for latin scientific names
        "Marsh tick": "Ixodes apronophorus",
        "Southern rodent tick": "Ixodes acuminatus",
        "Passerine tick": "Dermacentor frontalis",
        "Fox/badger tick": "Ixodes canisuga",
        "Tree-hole tick": "Ixodes arboricola"
    };
    return latinNames[species] || "Unknown";  // return matching latin name or "unknown"
}

function saveToLocalStorage(sighting) {
    const saved = JSON.parse(localStorage.getItem('tickSightings') || '[]');  // get existing saved sightings
    sighting.id = 'local-' + Date.now();  // generate unique id using timestamp
    saved.push(sighting);  // add new sighting to array
    localStorage.setItem('tickSightings', JSON.stringify(saved));  // save back to browser storage
}

function loadFromLocalStorage() {
    const saved = JSON.parse(localStorage.getItem('tickSightings') || '[]');  // get saved sightings from browser storage
    if (saved.length > 0) {  // if there are saved sightings
        console.log(`Loaded ${saved.length} local sightings from localStorage`);  // log how many found
        const existingIds = new Set(sightings.map(s => s.id));  // create set of existing sighting ids
        const newSightings = saved.filter(s => !existingIds.has(s.id));  // filter out duplicates
        sightings = [...sightings, ...newSightings];  // merge local sightings with api sightings
        addMarkers(sightings);  // update map with combined data
        updateResults(sightings);  // update results list with combined data
    }
}

const speciesModal = document.getElementById('speciesModal');  // get species guide modal popup
const speciesBtn = document.getElementById('speciesGuideBtn');  // get species guide button
const closeSpeciesModal = document.getElementById('closeSpeciesModal');  // get close button for species modal

speciesBtn.addEventListener('click', () => {  // when species guide button clicked
    speciesModal.classList.add('active');  // show the species modal
});

closeSpeciesModal.addEventListener('click', () => {  // when close button clicked
    speciesModal.classList.remove('active');  // hide the species modal
});

speciesModal.addEventListener('click', (e) => {  // when clicking anywhere on modal
    if (e.target === speciesModal) {  // if clicked on backdrop (not modal content)
        speciesModal.classList.remove('active');  // hide the species modal
    }
});

const seasonalModal = document.getElementById('seasonalModal');  // get seasonal activity modal popup
const seasonalBtn = document.getElementById('seasonalActivityBtn');  // get seasonal activity button
const closeSeasonalModal = document.getElementById('closeSeasonalModal');  // get close button for seasonal modal
let seasonalChart = null;  // variable to store chart.js instance

seasonalBtn.addEventListener('click', () => {  // when seasonal activity button clicked
    seasonalModal.classList.add('active');  // show the seasonal modal
    updateSeasonalChart();  // generate/update the chart
});

closeSeasonalModal.addEventListener('click', () => {  // when close button clicked
    seasonalModal.classList.remove('active');  // hide the seasonal modal
});

seasonalModal.addEventListener('click', (e) => {  // when clicking anywhere on modal
    if (e.target === seasonalModal) {  // if clicked on backdrop (not modal content)
        seasonalModal.classList.remove('active');  // hide the seasonal modal
    }
});

document.getElementById('chartCity').addEventListener('change', updateSeasonalChart);  // update chart when city filter changes
document.getElementById('chartYear').addEventListener('change', updateSeasonalChart);  // update chart when year filter changes

function updateSeasonalChart() {
    const city = document.getElementById('chartCity').value;  // get selected city filter
    const year = document.getElementById('chartYear').value;  // get selected year filter
    
    let filtered = sightings.filter(s => {  // filter sightings based on selections
        if (city && s.location !== city) return false;  // exclude if city doesn't match
        if (year && !s.date.startsWith(year)) return false;  // exclude if year doesn't match
        return true;  // include if passes all filters
    });
    
    const monthlyCounts = new Array(12).fill(0);  // create array for 12 months, all starting at 0
    filtered.forEach(s => {  // loop through filtered sightings
        const month = new Date(s.date).getMonth();  // get month number (0-11)
        monthlyCounts[month]++;  // increment count for that month
    });
    
    const ctx = document.getElementById('seasonalChart').getContext('2d');  // get canvas drawing context
    
    if (seasonalChart) {  // if chart already exists
        seasonalChart.destroy();  // destroy old chart before creating new one
    }
    
    seasonalChart = new Chart(ctx, {  // create new chart.js line chart
        type: 'line',  // line chart type
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],  // month labels for x-axis
            datasets: [{
                label: 'Tick Sightings',  // dataset label
                data: monthlyCounts,  // monthly count data for y-axis
                borderColor: '#2563eb',  // blue line colour
                backgroundColor: 'rgba(37, 99, 235, 0.1)',  // light blue fill under line
                tension: 0.4,  // curve the line smoothly
                fill: true,  // fill area under line
                pointRadius: 5,  // size of data point dots
                pointHoverRadius: 7  // size of dots when hovering
            }]
        },
        options: {
            responsive: true,  // resize chart with container
            maintainAspectRatio: true,  // keep chart proportions
            plugins: {
                legend: {
                    display: true,  // show legend
                    position: 'top'  // position at top of chart
                },
                title: {
                    display: true,  // show title
                    text: `Seasonal Activity ${city ? '- ' + city : ''} ${year ? '(' + year + ')' : ''}`,  // dynamic title based on filters
                    font: {
                        size: 16,  // title font size
                        weight: 'bold'  // bold title text
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,  // start y-axis at 0
                    ticks: {
                        stepSize: 1  // increment by whole numbers only
                    },
                    title: {
                        display: true,  // show y-axis label
                        text: 'Number of Sightings'  // y-axis label text
                    }
                },
                x: {
                    title: {
                        display: true,  // show x-axis label
                        text: 'Month'  // x-axis label text
                    }
                }
            }
        }
    });
}

console.log('Initializing UK Tick Sightings Tracker...');  // log app startup message
console.log('API Base URL:', API_BASE_URL);  // log which api server is being used
fetchSightings();  // start the application by loading all sighting data