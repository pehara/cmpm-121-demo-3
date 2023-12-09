// Importing necessary styles and libraries
import "leaflet/dist/leaflet.css";
import "./style.css";
import leaflet from "leaflet";
import luck from "./luck";
import "./leafletWorkaround";

// Define constants for game parameters
const MERRILL_CLASSROOM = leaflet.latLng({
    lat: 36.9995,
    lng: -122.0533
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
    center: MERRILL_CLASSROOM,
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
const playerMarker = leaflet.marker(MERRILL_CLASSROOM);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

// Initialize points and status panel
let points = 0;
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No points yet...";

// Function to create a cache with popup at given coordinates
function makeCache(i: number, j: number) {
    const cacheLatLng = leaflet.latLng({
        lat: MERRILL_CLASSROOM.lat + i * TILE_DEGREES,
        lng: MERRILL_CLASSROOM.lng + j * TILE_DEGREES,
    });

    const cache = leaflet.marker(cacheLatLng);

    // Initial number of coins in the cache
    let coinsToCollect = Math.floor(luck([i, j, "initialCoins"].toString()) * MAX_COINS_PER_CACHE);

    // Bind a popup to the cache with interactive content
    cache.bindPopup(() => {
        const container = document.createElement("div");
        container.innerHTML = `
            <div>This is a cache at "${i},${j}". It has ${coinsToCollect} coins available.</div>
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
        });

        // Deposit coins into another cache (for demonstration purposes, depositing in the same cache)
        depositButton.addEventListener("click", () => {
            const depositedCoins = Math.floor(luck([i, j, "depositedCoins"].toString()) * MAX_COINS_PER_CACHE);
            if (points >= depositedCoins) {
                points -= depositedCoins;
                statusPanel.innerHTML = `${points} points accumulated`;
                coinsToCollect += depositedCoins; // Update the number of coins in the cache
                container.querySelector("div")!.innerHTML = `This is a cache at "${i},${j}". It has ${coinsToCollect} coins available.`;
            } else {
                alert("Not enough points to deposit!");
            }
        });

        return container;
    });

    // Add the cache to the map
    cache.addTo(map);
}

// Function to generate the game world with caches
function generateWorld() {
    const playerLocation = {
        lat: MERRILL_CLASSROOM.lat,
        lng: MERRILL_CLASSROOM.lng,
    };

    for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
        for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
            const cacheLocation = {
                lat: MERRILL_CLASSROOM.lat + i * TILE_DEGREES,
                lng: MERRILL_CLASSROOM.lng + j * TILE_DEGREES,
            };

            // Calculate distance between player and cache locations
            const distance = Math.sqrt(
                Math.pow(playerLocation.lat - cacheLocation.lat, 2) +
                Math.pow(playerLocation.lng - cacheLocation.lng, 2)
            );

            // Check if the distance is within 8 cell-steps and spawn a cache with probability
            if (distance <= TILE_DEGREES * 8 && luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
                makeCache(i, j);
            }
        }
    }
}

// Initial generation of the world
generateWorld();