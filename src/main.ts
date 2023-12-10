// Importing necessary styles and libraries
import "leaflet/dist/leaflet.css";
import "./style.css";
import leaflet from "leaflet";
import luck from "./luck";
import "./leafletWorkaround";

// Define Null Island as the reference point for part b(0°N 0°E)
const NULL_ISLAND = leaflet.latLng({
    lat: 0,
    lng: 0
});

const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 0.0001; // Adjusted to 0.0001 degrees for the grid
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1; // Changed from PIT_SPAWN_PROBABILITY
const MAX_COINS_PER_CACHE = 10;

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
restoreCacheState();  // Call restoreCacheState after generating the world

// Function to create a cache with popup at given coordinates
function makeCache(i: number, j: number) {
    const cacheLatLng = leaflet.latLng({
        lat: NULL_ISLAND.lat + i * TILE_DEGREES,
        lng: NULL_ISLAND.lng + j * TILE_DEGREES,
    });

    const cache = leaflet.marker(cacheLatLng);

    // Initial number of coins in the cache
    let coinsToCollect = Math.floor(luck([i, j, "initialCoins"].toString()) * MAX_COINS_PER_CACHE);

    // Coin serial counter for each cache
    let coinSerial = 0;

    // Bind a popup to the cache with interactive content
    cache.bindPopup(() => {
        const container = document.createElement("div");
        const compactRepresentation = `${i}:${j}#${coinSerial}`;

        container.innerHTML = `
            <div>This is a cache at "${i},${j}". It has ${coinsToCollect} coins available.</div>
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
        });

        // Deposit coins into another cache (for demonstration purposes, depositing in the same cache)
        depositButton.addEventListener("click", () => {
            const depositedCoins = Math.floor(luck([i, j, "depositedCoins"].toString()) * MAX_COINS_PER_CACHE);
            if (points >= depositedCoins) {
                points -= depositedCoins;
                statusPanel.innerHTML = `${points} points accumulated`;
                coinsToCollect += depositedCoins; // Update the number of coins in the cache
                coinSerial++;
                container.querySelector("div")!.innerHTML = `This is a cache at "${i},${j}". It has ${coinsToCollect} coins available.`;
                container.querySelector("div:last-child")!.innerHTML = `Coin Identity: ${i}:${j}#${coinSerial}`;
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


// Function to generate the game world with caches
function generateWorld() {
    for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
        for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
            const cacheLocation = {
                lat: NULL_ISLAND.lat + i * TILE_DEGREES,
                lng: NULL_ISLAND.lng + j * TILE_DEGREES,
            };

            // Calculate distance between player and cache locations
            const distance = Math.sqrt(
                Math.pow(playerMarker.getLatLng().lat - cacheLocation.lat, 2) +
                Math.pow(playerMarker.getLatLng().lng - cacheLocation.lng, 2)
            );

            // Check if the distance is within 8 cell-steps and spawn a cache with probability
            if (distance <= TILE_DEGREES * 8 && luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
                makeCache(i, j);
            }
        }
    }
}

// Function to handle player movement
function movePlayer(direction: string) {
    const stepSize = TILE_DEGREES;

    switch (direction) {
        case "north":
            playerMarker.setLatLng({
                lat: playerMarker.getLatLng().lat + stepSize,
                lng: playerMarker.getLatLng().lng
            });
            break;
        case "south":
            playerMarker.setLatLng({
                lat: playerMarker.getLatLng().lat - stepSize,
                lng: playerMarker.getLatLng().lng
            });
            break;
        case "east":
            playerMarker.setLatLng({
                lat: playerMarker.getLatLng().lat,
                lng: playerMarker.getLatLng().lng + stepSize
            });
            break;
        case "west":
            playerMarker.setLatLng({
                lat: playerMarker.getLatLng().lat,
                lng: playerMarker.getLatLng().lng - stepSize
            });
            break;
        default:
            break;
    }

    // Remove existing caches from the map
    map.eachLayer((layer) => {
        if (layer instanceof leaflet.Marker && layer !== playerMarker) {
            map.removeLayer(layer);
        }
    });

    // Create a new player marker instance
    const newPlayerMarker = leaflet.marker(playerMarker.getLatLng());
    newPlayerMarker.bindTooltip("That's you!");
    newPlayerMarker.addTo(map);

    // Update the player marker reference
    playerMarker.setLatLng(newPlayerMarker.getLatLng());

    // Generate new caches around the player's new position
    setTimeout(() => {
        generateWorld();
        updateCacheStates();
    }, 0);
}

// Add event listeners for player movement and cache restoration
document.getElementById("moveNorth")?.addEventListener("click", () => movePlayer("north"));
document.getElementById("moveSouth")?.addEventListener("click", () => movePlayer("south"));
document.getElementById("moveEast")?.addEventListener("click", () => movePlayer("east"));
document.getElementById("moveWest")?.addEventListener("click", () => movePlayer("west"));
document.getElementById("restoreCaches")?.addEventListener("click", () => restoreCacheState());