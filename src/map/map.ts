import L from "leaflet";
import "leaflet.markercluster";
import "leaflet-gesture-handling";
import "../js/fullscreen";

import "/src/css/fullscreen.css";
import "/src/css/marker.css";
import "leaflet-gesture-handling/dist/leaflet-gesture-handling.css";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import {anyTrailType, BikePark, DirtPark, isAnyTrailType, SingleTrail, Trail} from "../js/types/Trail";
import {askNearbyConflict, giveTrailNearBy, reportAbort} from "../js/near_by_trails";
import {openCreateTrailPopup} from "./create_trail/popup";
import {createCustomIcon, getTrailDetails} from "../js/data/trails";
import {getTrailPopup, renderTrailDetails} from "../detail_popup/detailsPopup";
import {bindPopupEvents, setupYT2Click, startPhotoCarousel} from "../detail_popup/logic";
import {Coord} from "../js/locations";

let addMode: anyTrailType | undefined = undefined;
let addBtn : HTMLButtonElement | null = null;
let fabMenu: HTMLElement | null = null;
const popupSizing = { minWidth: "95vw", maxWidth: "450px" }

function resetAddMode(map: L.Map) {
    addMode = undefined;
    if(!addBtn) return;
    addBtn.textContent = "+";
    addBtn.classList.remove("hidden", "active");
    // map_container.classList.remove("crosshair-cursor");
}
function renderMarkers(targetGroup: L.MarkerClusterGroup | L.LayerGroup, trails: SingleTrail[], parks: BikePark[], dirtParks: DirtPark[]) {
    targetGroup.clearLayers();

    getMarkers(targetGroup, parks);
    getMarkers(targetGroup, dirtParks);

    return getMarkers(targetGroup, trails);
}

export async function initMap(el: HTMLElement, location: Coord, openSpecificTrail: string | undefined, trails: SingleTrail[], bikeparks: BikePark[], dirtparks: DirtPark[]) {
    L.Map.addInitHook("addHandler", "gestureHandling", (L as any).GestureHandling);
    let mymap = L.map(el, {
        //@ts-expect-error
        gestureHandling: true,
        gestureHandlingOptions: {
            text: {
                touch: "Benutze 2 Finger um die Karte zu bewegen",
                scroll: "Benutze ctrl + scroll um die Karte zu zoomen",
                scrollMac: "Benutze \u2318 + scroll um die Karte zu zoomen"
            }
        },
        zoomControl: false,
    });

    mymap.setMaxZoom(19);


    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png?ts=20251021', {
        maxZoom: 19,
        // zoomControl: false,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',

    }).addTo(mymap);

    L.control.zoom({
        position: 'bottomright',
    }).addTo(mymap);

    L.control
        //@ts-expect-error
        .fullscreen({
            position: 'bottomright',
            forceSeparateButton: false,
        })
        .addTo(mymap);

    mymap.setView(location, 9)

    const clusterGroup = new L.MarkerClusterGroup();
    const markerGroup = new L.LayerGroup();
    const trailMarkers = renderMarkers(clusterGroup, trails, bikeparks, dirtparks);
    mymap.addLayer(clusterGroup);

    initFilterAndClustering(mymap, markerGroup, clusterGroup, trails, bikeparks, dirtparks);

    //@ts-expect-error
    const specificTrailMarker = trailMarkers.find(m => m.options.internal_id === openSpecificTrail);
    if (specificTrailMarker) {
        console.log("Opening specific location popup for", openSpecificTrail);
        specificTrailMarker.openPopup();
    }

    addMode = undefined;

    addBtn = document.getElementById('add-btn') as HTMLButtonElement | null;
    fabMenu = document.getElementById('fab-menu');

    addBtn?.addEventListener('click', () => {
        fabMenu?.classList.toggle('hidden');
        addBtn?.classList.toggle('active');
        if (!!addMode)
            resetAddMode(mymap);
    });

    fabMenu?.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if(!target)
            return;
        if (!target.classList.contains('fab-item'))
            return
        if (!addBtn)
            return;

        const type = target.dataset.type;
        fabMenu?.classList.add('hidden');

        if(!type || !isAnyTrailType(type))
            return;
        addMode = type;
        if (!!addMode) {
            addBtn.textContent = 'Klick auf Karte, um Trail zu setzen';
            addBtn.classList.add('active');
            mymap.getContainer().classList.add('crosshair-cursor');
        } else {
            addBtn.textContent = '+';
            addBtn.style.background = '#2b6cb0';
            mymap.getContainer().classList.remove('crosshair-cursor');
        }
    });

    mymap.on('click', (e) => {
        if (!addMode) return;
        const nearByTrail = giveTrailNearBy(e.latlng.lat, e.latlng.lng, trails);
        if (nearByTrail)
            askNearbyConflict(nearByTrail, () => {
                openCreateTrailPopup(mymap, e.latlng.lat, e.latlng.lng, addMode!)
                resetAddMode(mymap);
            }, () => reportAbort());
        else {
            openCreateTrailPopup(mymap, e.latlng.lat, e.latlng.lng, addMode);
            resetAddMode(mymap);
        }
    });
}

function initFilterAndClustering(mymap: L.Map, markerGroup : L.LayerGroup, clusterGroup : L.MarkerClusterGroup, trails: SingleTrail[], bikeparks: BikePark[], dirtparks: DirtPark[]) {
    const clusterToggle = document.getElementById("clusterToggle") as HTMLFormElement;
    const filterParks = document.querySelector('input[data-filter="bikepark"]') as HTMLFormElement;
    const filterTrails = document.querySelector('input[data-filter="trailcenter"]') as HTMLFormElement;
    const filterDirtParks = document.querySelector('input[data-filter="dirtpark"]') as HTMLFormElement;
    const filterPumptracks = document.querySelector('input[data-filter="pumptrack"]') as HTMLFormElement;
    const filterUnverified = document.querySelector('input[data-filter="unverified"]') as HTMLFormElement;

    function updateFilters() {
        const useCluster = clusterToggle.checked;
        const showTrails = filterTrails.checked;
        const showParks = filterParks.checked;
        const showDirtParks = filterDirtParks.checked;
        const showPumptracks = filterPumptracks.checked;
        const showUnverified = filterUnverified.checked;

        mymap.removeLayer(useCluster ? markerGroup : clusterGroup);
        mymap.addLayer(useCluster ? clusterGroup : markerGroup);

        const filteredTrails = trails.filter(t => showTrails && (showUnverified ? true : t.approved));
        const filteredParks = bikeparks.filter(p => showParks && (showUnverified ? true : p.approved));
        const filteredDirtParks = dirtparks.filter(dp => {
            if (showDirtParks && showPumptracks && (showUnverified ? true : dp.approved)) return true;
            if (showDirtParks && dp.dirtpark && (showUnverified ? true : dp.approved)) return true;
            if (showPumptracks && dp.pumptrack && (showUnverified ? true : dp.approved)) return true;
            return false;
        });

        clusterGroup.clearLayers();
        markerGroup.clearLayers();

        if (useCluster && clusterGroup.getLayers().length === 0) {
            renderMarkers(clusterGroup, filteredTrails, filteredParks, filteredDirtParks);
        } else if (!useCluster && markerGroup.getLayers().length === 0) {
            renderMarkers(markerGroup, filteredTrails, filteredParks, filteredDirtParks);
        }
    }
    clusterToggle?.addEventListener("change", updateFilters);
    filterParks?.addEventListener("change", updateFilters);
    filterTrails?.addEventListener("change", updateFilters);
    filterDirtParks?.addEventListener("change", updateFilters);
    filterPumptracks?.addEventListener("change", updateFilters);

}

export function hideAddButton() {

    const inWrapper = document.getElementsByClassName('add-btn-wrapper');
    if (!inWrapper) {
        fabMenu?.classList.add('hidden');
    }
}

function getMarkers(cluster: L.MarkerClusterGroup | L.LayerGroup, trails: Trail[]) {
    const trailMarkers : L.Marker[] = [];

    for (const trail of trails) {
        const marker = L.marker([trail.latitude, trail.longitude], {
            icon: L.icon(createCustomIcon(trail)),
            // @ts-expect-error
            internal_id: trail.id
        })
            .addTo(cluster)
            //@ts-expect-error
            .bindPopup(getTrailPopup(trail), popupSizing);

        marker.on("popupclose", () => document.getElementById("top-map-buttons")!.style.display = "block");
        marker.on("popupopen", async (e) => {
            document.getElementById("top-map-buttons")!.style.display = "none";
            const popup = e.popup.getElement();
            if(!popup)
                return;
            try {
                const details = await getTrailDetails(trail);
                const detailsHTML = await renderTrailDetails(trail, details);
                const container = popup.querySelector('.popup-section.loading');
                if (container) {
                    container.outerHTML = detailsHTML;
                    await bindPopupEvents(popup);
                    startPhotoCarousel(popup);
                    setupYT2Click(popup);
                }
            } catch (err) {
                console.error("Fehler beim Laden der Details:", err);
                const container = popup.querySelector('.popup-section.loading');
                if (container) container.outerHTML = `<div class="popup-section"><p>⚠️ Details derzeit nicht verfügbar.</p></div>`;
            }
        });
        trailMarkers.push(marker);
    }

    return trailMarkers;
}