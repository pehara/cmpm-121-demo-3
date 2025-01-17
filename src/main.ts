// Importing necessary styles and libraries
import "leaflet/dist/leaflet.css";
import "./style.css";
import leaflet from "leaflet";
import luck from "./luck";
import "./leafletWorkaround";

// Define Null Island as the reference point for part b
const NULL_ISLAND = leaflet.latLng({
    lat: 0,
    lng: 0
});

const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 0.0001; // Adjusted to 0.0001 degrees for the grid
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1; // Changed from PIT_SPAWN_PROBABILITY
const MAX_COINS_PER_CACHE = 10;
const MAX_VISIBLE_DISTANCE = 100; // Adjust the visible distance as needed

// Get the map container element from the DOM
const mapContainer = document.querySelector<HTMLElement>("#map")!;

// Create a Leaflet map instance
const map = leaflet.map(mapContainer, {
    center: NULL_ISLAND,
    zoom: GAMEPLAY_ZOOM_LEVEL,
    minZoom: GAMEPLAY_ZOOM_LEVEL,
    maxZoom: GAMEPLAY_ZOOM_LEVEL,
    zoomControl: false,
    scrollWheelZoom: false
});

// Add OpenStreetMap tile layer to the map
leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; <a href=\"http://www.openstreetmap.org/copyright\">OpenStreetMap</a>"
}).addTo(map);

// Create a player marker on the map with a tooltip
const playerMarker = leaflet.marker(NULL_ISLAND);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

// Center the map on the player's initial position
map.setView(playerMarker.getLatLng(), GAMEPLAY_ZOOM_LEVEL);

// Initialize points and status panel
let points = 0;
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No points yet...";

// Cache state Memento
interface CacheState {
    i: number;
    j: number;
    coinsToCollect: number;
    coinSerial: number;
}

// Array to store cache states
let cacheStates: CacheState[] = [];

// Generate the game world with caches during program startup
generateWorld();
restoreCacheState(); // Call restoreCacheState after generating the world

// Function to create a cache with popup at player's current coordinates
function makeCache(i: number, j: number) {
    // Check if a cache should be spawned based on probability
    if (Math.random() < CACHE_SPAWN_PROBABILITY) {
        const cacheLatLng = leaflet.latLng({
            lat: NULL_ISLAND.lat + i * TILE_DEGREES,
            lng: NULL_ISLAND.lng + j * TILE_DEGREES,
        });

        const cache = leaflet.marker(cacheLatLng);

        // Initial number of coins in the cache
        let coinsToCollect = Math.floor(
            luck([cacheLatLng.lat, cacheLatLng.lng, "initialCoins"].toString()) * MAX_COINS_PER_CACHE
        );

        // Coin serial counter for each cache
        let coinSerial = 0;

        // Bind a popup to the cache with interactive content
        cache.bindPopup(() => {
            const container = document.createElement("div");
            const compactRepresentation = `${cacheLatLng.lat}:${cacheLatLng.lng}#${coinSerial}`;

            container.innerHTML = `
            <div>This is a cache at "${cacheLatLng.lat},${cacheLatLng.lng}". It has ${coinsToCollect} coins available.</div>
            <div>Coin Identity: ${compactRepresentation}</div>
            <button id="collect">Collect Coins</button>
            <button id="deposit">Deposit Coins</button>`;
            const collectButton = container.querySelector<HTMLButtonElement>("#collect")!;
            const depositButton = container.querySelector<HTMLButtonElement>("#deposit")!;

            // Collect coins from the cache
            collectButton.addEventListener("click", () => {
                points += coinsToCollect;
                statusPanel.innerHTML = `${points} points accumulated`;
                cache.closePopup();
                map.removeLayer(cache);
                updateCacheStates();
                saveGameState();
            });

            // Deposit coins into another cache (for demonstration purposes, depositing in the same cache)
            depositButton.addEventListener("click", () => {
                const depositedCoins = Math.floor(
                    luck([cacheLatLng.lat, cacheLatLng.lng, "depositedCoins"].toString()) * MAX_COINS_PER_CACHE
                );
                if (points >= depositedCoins) {
                    points -= depositedCoins;
                    statusPanel.innerHTML = `${points} points accumulated`;
                    coinsToCollect += depositedCoins; // Update the number of coins in the cache
                    coinSerial++;
                    container.querySelector("div")!.innerHTML = `This is a cache at "${cacheLatLng.lat},${cacheLatLng.lng}". It has ${coinsToCollect} coins available.`;
                    container.querySelector("div:last-child")!.innerHTML = `Coin Identity: ${cacheLatLng.lat}:${cacheLatLng.lng}#${coinSerial}`;
                    updateCacheStates();
                } else {
                    alert("Not enough points to deposit!");
                }
            });

            return container;
        });

        // Add the cache to the map
        cache.addTo(map);
        updateCacheStates();
        updateCacheVisibility(); // Update visibility after creating the cahce
    }
}

// Function to update cache visibility based on distance to the player
function updateCacheVisibility() {
    map.eachLayer((layer) => {
        if (layer instanceof leaflet.Marker && layer !== playerMarker) {
            const cacheLatLng = layer.getLatLng();
            const distanceToPlayer = playerMarker.getLatLng().distanceTo(cacheLatLng);

            if (distanceToPlayer > MAX_VISIBLE_DISTANCE) {
                // Hide caches that are too far away
                map.removeLayer(layer);
            } else {
                // Show caches within the visible distance
                layer.addTo(map);
            }
        }
    });
}

// Function to generate caches around the player's current position
function generateCachesAroundPlayer() {
    const playerLatLng = playerMarker.getLatLng();

    // Calculate the neighborhood bounds around the player
    const minLat = playerLatLng.lat - TILE_DEGREES * NEIGHBORHOOD_SIZE / 2;
    const maxLat = playerLatLng.lat + TILE_DEGREES * NEIGHBORHOOD_SIZE / 2;
    const minLng = playerLatLng.lng - TILE_DEGREES * NEIGHBORHOOD_SIZE / 2;
    const maxLng = playerLatLng.lng + TILE_DEGREES * NEIGHBORHOOD_SIZE / 2;

    // Spawn caches at random positions within the neighborhood bounds
    for (let i = 0; i < NEIGHBORHOOD_SIZE; i++) {
        for (let j = 0; j < NEIGHBORHOOD_SIZE; j++) {
            // Check if a cache should be spawned based on probability
            if (Math.random() < CACHE_SPAWN_PROBABILITY) {
                const randomLat = minLat + Math.random() * (maxLat - minLat);
                const randomLng = minLng + Math.random() * (maxLng - minLng);

                // Convert random latitude and longitude to grid coordinates
                const gridI = Math.round((randomLat - NULL_ISLAND.lat) / TILE_DEGREES);
                const gridJ = Math.round((randomLng - NULL_ISLAND.lng) / TILE_DEGREES);

                makeCache(gridI, gridJ);
            }
        }
    }

    // Update cache visibility after generating caches around the player
    updateCacheVisibility();
}

// Function to update cache states array
function updateCacheStates() {
    cacheStates = [];
    map.eachLayer((layer) => {
        if (layer instanceof leaflet.Marker) {
            const cacheLatLng = layer.getLatLng();
            const i = Math.round((cacheLatLng.lat - NULL_ISLAND.lat) / TILE_DEGREES);
            const j = Math.round((cacheLatLng.lng - NULL_ISLAND.lng) / TILE_DEGREES);

            // Check if popup exists and has content
            const popup = layer.getPopup();
            if (popup) {
                const popupContent = popup.getContent();
                if (popupContent && typeof popupContent === "string") {
                    const coinsToCollectMatch = popupContent.match(/It has (\d+) coins available\./);
                    const coinSerialMatch = popupContent.match(/Coin Identity: \d+:\d+#(\d+)/);

                    // Check if matches are successful
                    if (coinsToCollectMatch && coinSerialMatch) {
                        const coinsToCollect = parseInt(coinsToCollectMatch[1], 10);
                        const coinSerial = parseInt(coinSerialMatch[1], 10);

                        cacheStates.push({
                            i,
                            j,
                            coinsToCollect,
                            coinSerial
                        });
                    }
                }
            }
        }
    });
}

function restoreCacheState() {
    // // Clear existing caches
    // map.eachLayer((layer) => {
    //     if (layer instanceof leaflet.Marker) {
    //         map.removeLayer(layer);
    //     }
    // });

    // Restore caches from saved state with a delay
    setTimeout(() => {
        cacheStates.forEach((cacheState) => {
            const { i, j, coinsToCollect, coinSerial } = cacheState;
            makeCache(i, j);

            // Find the marker associated with the cacheState
            map.eachLayer((layer) => {
                if (layer instanceof leaflet.Marker) {
                    const cacheLatLng = layer.getLatLng();
                    const currentI = Math.round((cacheLatLng.lat - NULL_ISLAND.lat) / TILE_DEGREES);
                    const currentJ = Math.round((cacheLatLng.lng - NULL_ISLAND.lng) / TILE_DEGREES);

                    if (currentI === i && currentJ === j) {
                        // Ensure popup and content are present before updating
                        const popup = layer.getPopup();
                        if (popup) {
                            const popupContent = popup.getContent();
                            if (popupContent) {
                                const updatedContent =
                                    `<div>This is a cache at "${i},${j}". It has ${coinsToCollect} coins available.</div>` +
                                    `<div>Coin Identity: ${i}:${j}#${coinSerial}</div>` +
                                    `<button id="collect">Collect Coins</button>` +
                                    `<button id="deposit">Deposit Coins</button>`;

                                // Update the popup content
                                popup.setContent(updatedContent);
                            }
                        }
                    }
                }
            });
        });
    }, 1000); // Adjust the delay as needed
}

// Update the generateWorld function to use makeCache without parameters
function generateWorld() {
    for (let i = 0; i < NEIGHBORHOOD_SIZE; i++) {
        for (let j = 0; j < NEIGHBORHOOD_SIZE; j++) {
            makeCache(i, j);
        }
    }

    // Update cache visibility after generating the world
    updateCacheVisibility();
}

// Create a Polyline for movement history
const movementHistory = leaflet.polyline([], { color: "blue" }).addTo(map);

// Update the movePlayer function to generate caches around the new position
function movePlayer(direction: string) {
    const stepSize = TILE_DEGREES;

    // Remove the previous player marker
    map.removeLayer(playerMarker);

    switch (direction) {
        case "north":
            playerMarker.setLatLng({
                lat: playerMarker.getLatLng().lat + stepSize,
                lng: playerMarker.getLatLng().lng
            });
            generateCachesAroundPlayer();
            break;
        case "south":
            playerMarker.setLatLng({
                lat: playerMarker.getLatLng().lat - stepSize,
                lng: playerMarker.getLatLng().lng
            });
            generateCachesAroundPlayer();
            break;
        case "east":
            playerMarker.setLatLng({
                lat: playerMarker.getLatLng().lat,
                lng: playerMarker.getLatLng().lng + stepSize
            });
            generateCachesAroundPlayer();
            break;
        case "west":
            playerMarker.setLatLng({
                lat: playerMarker.getLatLng().lat,
                lng: playerMarker.getLatLng().lng - stepSize
            });
            generateCachesAroundPlayer();
            break;
        default:
            break;
    }

    // Add the current position to the movement history
    movementHistory.addLatLng(playerMarker.getLatLng());

    // Update the player marker reference
    playerMarker.addTo(map);

    // Generate new caches around the player's new position
    generateCachesAroundPlayer();
    updateCacheStates();
}


// Add an initial call to generate caches around the player's starting position
generateCachesAroundPlayer();


// Add event listeners for player movement and cache restoration
document.getElementById("moveNorth")?.addEventListener("click", () => movePlayer("north"));
document.getElementById("moveSouth")?.addEventListener("click", () => movePlayer("south"));
document.getElementById("moveEast")?.addEventListener("click", () => movePlayer("east"));
document.getElementById("moveWest")?.addEventListener("click", () => movePlayer("west"));
document.getElementById("restoreCaches")?.addEventListener("click", () => restoreCacheState());

// Add event listener for automatic position updating
document.getElementById("autoUpdate")?.addEventListener("click", toggleAutoUpdate);

// Variable to track the automatic update status
let autoUpdateEnabled = false;

// Function to toggle automatic position updating
function toggleAutoUpdate() {
    autoUpdateEnabled = !autoUpdateEnabled;

    if (autoUpdateEnabled) {
        // Start automatic position updating
        updatePlayerPositionAutomatically();
    } else {
        // Stop automatic position updating
        // (You may want to clear any intervals or watchers here)
    }
}

// Function to update the player's position automatically
function updatePlayerPositionAutomatically() {
    // Check if Geolocation is supported
    if ("geolocation" in navigator) {
        // Use the Geolocation API to get the current position
        navigator.geolocation.watchPosition((position) => {
            const { latitude, longitude } = position.coords;
            const newPosition = leaflet.latLng(latitude, longitude);

            // Update the player's marker position
            playerMarker.setLatLng(newPosition);

            // Center the map on the new position
            map.setView(newPosition, GAMEPLAY_ZOOM_LEVEL);

            // Generate new caches around the player's new position
            generateWorld();
            updateCacheStates();
        }, (error) => {
            console.error("Error getting the current position:", error);
        });
    } else {
        alert("Geolocation is not supported in this browser.");
    }
}

// Function to save game state to localStorage
function saveGameState() {
    localStorage.setItem("gameState", JSON.stringify({ points, cacheStates }));
}

// Function to restore game state from localStorage
function restoreGameState() {
    try {
        const savedGameState = localStorage.getItem("gameState");
        if (savedGameState) {
            const { points: savedPoints, cacheStates: savedCacheStates } = JSON.parse(savedGameState) as {
                points: number;
                cacheStates: CacheState[];
            };
            
            // Use default values if properties are missing
            const restoredPoints: number = savedPoints || 0;
            const restoredCacheStates: CacheState[] = savedCacheStates || [];
            
            points = restoredPoints;
            cacheStates = restoredCacheStates;
            
            updateStatusPanel();
            restoreCacheState();
        }
    } catch (error) {
        console.error("Error restoring game state:", error);
        // Handle the error or provide fallback behavior if needed
    }
}

// Call restoreGameState during program startup
restoreGameState();

// Function to update status panel
function updateStatusPanel() {
    statusPanel.innerHTML = `${points} points accumulated`;
}

// Add event listener for resetting the game state
document.getElementById("resetGame")?.addEventListener("click", resetGame);

// Function to reset the game state
function resetGame() {
    const confirmReset = confirm("Are you sure you want to reset the game state?");
    if (confirmReset) {
        // Clear localStorage
        localStorage.removeItem("gameState");

        // Reset points and cache states
        points = 0;
        cacheStates = [];
        updateStatusPanel();

        // Remove existing caches from the map
        map.eachLayer((layer) => {
            if (layer instanceof leaflet.Marker && layer !== playerMarker) {
                map.removeLayer(layer);
            }
        });

        // Clear movement history
        movementHistory.setLatLngs([]);

        // Generate new caches around the player's initial position
        generateWorld();
        updateCacheStates();
    }
}