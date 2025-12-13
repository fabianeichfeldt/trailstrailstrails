import { getParks } from "./data/bikeparks.js";
import { getDirtParks } from "./data/dirt_parks.js";
import { getTrails, createCustomIcon } from "./data/trails.js";
import { showToast } from "./toast.js";
import { getApproxLocation, locations } from "./locations.js";
import { upVote, downVote } from './feedback.js';
import { giveTrailNearBy, askNearbyConflict, reportAbort } from "./near_by_trails.js";
import { generateJsonLD } from "./json_ld.js";
import { getTrailDetailsHTML, startPhotoCarousel, setupYT2Click } from "./detailsPopup.js";
import { anon } from "./anon.js";
import { formatDate } from "./formatDate.js";

window.downVote = async function (trailID, el) {
  await downVote(trailID, el);
  showToast("Danke für dein Feedback! 🙏", "success");
};
window.upVote = async function (trailID, el) {
  await upVote(trailID, el);
  showToast("Danke für dein Feedback! 🙏", "success");
};

window.toggleLegend = function () {
  document.querySelector('.map-legend').classList.toggle('collapsed');
}

const popupSizing = { width: "95vw", maxWidth: "450px" }

let addMode = undefined;
let addBtn;
let openSpecificTrail = undefined;

const types = {
  trail: "Trail",
  bikepark: "Bike Park",
  dirtpark: "Dirtpark/Pumptrack"
}

function generateNews(trails) {
  const container = document.getElementById("news");
  if (!container) return;

  try {
    const news = [];
    for (let i = 1; i < 7; i++) {
      const newsItem = trails.at(-i);
      news.push({
        title: "Neue Trails!",
        date: newsItem.created_at,
        text: `<strong>${newsItem.name}</strong> wurde neu aufgenommen in die Übersicht: <a id='show-last-${i}' href='#'>Link</a>`,
      });
    }
    container.innerHTML = "<h2>Neuigkeiten</h2>";

    for (const item of news) {
      const el = document.createElement("div");
      el.className = "news-item";
      el.innerHTML = `
        <time datetime="${item.date}">${formatDate(item.date)}</time>
        <p>${item.text}</p>
      `;
      container.appendChild(el);
    }
  } catch (err) {
    console.error("Error loading news:", err);
    container.innerHTML =
      "<p>⚠️ Neuigkeiten konnten nicht geladen werden.</p>";
  }
}

function pageCounter() {
  return fetch("https://ixafegmxkadbzhxmepsd.supabase.co/functions/v1/add-visit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4YWZlZ214a2FkYnpoeG1lcHNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2Mjc1MzAsImV4cCI6MjA3NjIwMzUzMH0.BRbdccgrW7aZpvB_S4_qKn_BRcfPMyWjQAVuVuy2wyQ",
      "referrer": document.referrer,
    },
  });
}

function resetAddMode(map) {
  addMode = undefined;
  addBtn.textContent = "+";
  addBtn.classList.remove("hidden", "active");
  map._container.classList.remove("crosshair-cursor");
}

async function init() {
  const el = document.getElementById("mapid");
  if (!el) {
    console.error("Map div not found!");
    return;
  }

  const path = window.location.pathname;
  var mymap = L.map(el, {
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
  
  const match = path.match(/^\/trails\/([^/]+)/);
  if (match && match[1] && match[1].length > 0) {
    const trailPath = match[1].toLowerCase();
    const predefinedRegion = locations.find(l => (l.name.toLowerCase() === trailPath));
    if (trailPath !== "nearby" && predefinedRegion) 
      mymap.setView([predefinedRegion.lat, predefinedRegion.lng], 9);
    else {
      openSpecificTrail = match[1].toLowerCase();
      const loc = await getApproxLocation();
      mymap.setView(loc, 9)
    }
  } else {
    const loc = await getApproxLocation();
    mymap.setView(loc, 9)
  }

  mymap._layersMaxZoom = 19;


  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png?ts=20251021', {
    maxZoom: 19,
    zoomControl: false,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',

  }).addTo(mymap);

  L.control.zoom({
    position: 'bottomright',
  }).addTo(mymap);

  L.control
      .fullscreen({
        position: 'bottomright',
        forceSeparateButton: false,
      })
      .addTo(mymap);

  initBurgerBtn();
  
  const clusterGroup = L.markerClusterGroup();
  const markerGroup = L.layerGroup();
  
  function renderMarkers(targetGroup, trails, parks, dirtParks) {
    targetGroup.clearLayers();
    
    getMarkers(targetGroup, parks, "bikepark");
    getMarkers(targetGroup, dirtParks, "dirtpark");
    
    trailMarkers = getMarkers(targetGroup, trails, "trail");
  }
  
  const [trails, bikeparks, dirtparks] = await Promise.all([
    getTrails(),
    getParks(),
    getDirtParks()
  ]);

  if (!openSpecificTrail)
    generateJsonLD(trails);
  
  let trailMarkers = []
  renderMarkers(clusterGroup, trails, bikeparks, dirtparks);
  mymap.addLayer(clusterGroup);
  
  initFilterAndClustering(mymap, markerGroup, clusterGroup, renderMarkers, trails, bikeparks, dirtparks);
  generateNews(trails);

  const specificTrailMarker = trailMarkers.find(m => m.options.internal_id === openSpecificTrail); 
  if (specificTrailMarker) {
    console.log("Opening specific location popup for", openSpecificTrail);
    specificTrailMarker.openPopup();
  }

  for (let i = 1; i <= 6; i++)
    document.getElementById(`show-last-${i}`).addEventListener("click", () => {
      const newsMarker = trailMarkers.at(-i);
      clusterGroup.zoomToShowLayer(newsMarker, () => {
        newsMarker.openPopup();
      });
    });

  addMode = undefined;

  addBtn = document.getElementById('add-btn');
  const fabMenu = document.getElementById('fab-menu');

  addBtn.addEventListener('click', () => {
    fabMenu.classList.toggle('hidden');
    addBtn.classList.toggle('active');
    if (!!addMode)
      resetAddMode(mymap);
  });

  fabMenu.addEventListener('click', (e) => {
    if (e.target.classList.contains('fab-item')) {
      const type = e.target.dataset.type;
      fabMenu.classList.add('hidden');

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
    }
  });

  document.addEventListener('click', (e) => {
    const inWrapper = e.target.closest('.add-btn-wrapper');
    if (!inWrapper) {
      fabMenu.classList.add('hidden');
    }
  });

  document.getElementById("communityBtn")?.addEventListener("click", () => {
    const section = document.getElementById("community");
    if (section) {
      section.scrollIntoView({ behavior: "smooth" });
    }
  });

  mymap.on('click', (e) => {
    if (!addMode) return;

    const nearByTrail = giveTrailNearBy(e.latlng, trails);
    if (nearByTrail)
      askNearbyConflict(nearByTrail, () => openCreateTrailPopup(mymap, e.latlng, addMode), () => reportAbort());
    else
      openCreateTrailPopup(mymap, e.latlng, addMode);
  });
}

function initFilterAndClustering(mymap, markerGroup, clusterGroup, renderMarkers, trails, bikeparks, dirtparks) {
  const clusterToggle = document.getElementById("clusterToggle");
  const filterParks = document.querySelector('input[data-filter="bikepark"]');
  const filterTrails = document.querySelector('input[data-filter="trailcenter"]');
  const filterDirtParks = document.querySelector('input[data-filter="dirtpark"]');
  const filterPumptracks = document.querySelector('input[data-filter="pumptrack"]');  
  const filterUnverified = document.querySelector('input[data-filter="unverified"]');

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
  clusterToggle.addEventListener("change", updateFilters);
  filterParks.addEventListener("change", updateFilters);
  filterTrails.addEventListener("change", updateFilters);
  filterDirtParks.addEventListener("change", updateFilters);
  filterPumptracks.addEventListener("change", updateFilters);

}

function initBurgerBtn() {
  const burgerBtn = document.getElementById('burgerBtn');
  const drawer = document.getElementById('drawer');
  const drawerOverlay = document.getElementById('drawerOverlay');
  const drawerClose = document.getElementById('drawerClose');
  const drawerLinks = drawer.querySelectorAll('a');

  drawerLinks.forEach(link =>link.addEventListener('click', () => closeDrawer()));

  function openDrawer() {
    drawer.classList.add('open');
    drawerOverlay.classList.add('active');
    burgerBtn.classList.add('active');
  }
  function closeDrawer() {
    drawer.classList.remove('open');
    drawerOverlay.classList.remove('active');
    burgerBtn.classList.remove('active');
  }

  burgerBtn.addEventListener('click', openDrawer);
  drawerClose.addEventListener('click', closeDrawer);
  drawerOverlay.addEventListener('click', closeDrawer);
}

function openCreateTrailPopup(mymap, latlng, type) {
  console.log(type);
  const { lat, lng } = latlng;

  const marker = L.marker([lat, lng]).addTo(mymap);
  const popupContent = `
  <div class="popup-form">
    <h3>Neuer Eintrag</h3>
    <p>Bitte ${types[type]} einfügen - einzelne Trails nur bei größeren Transfer (>5km)</p>
    <div class="type-switch">
      <label class="type-option">
        <input type="radio" id="trailTypeSwitch" name="trailType" value="trail" ${type === 'trail' ? 'checked' : ''} disabled>
        <span class="switch-btn">Trail</span>
      </label>

      <label class="type-option">
        <input type="radio" name="trailType" value="bikepark" ${type === 'bikepark' ? 'checked' : ''} disabled>
        <span class="switch-btn">Bike Park</span>
      </label>
      <label class="type-option">
        <input type="radio" id="trailTypeSwitch" name="trailType" value="dirtpark" ${type === 'dirtpark' ? 'checked' : ''} disabled>
        <span class="switch-btn">Dirtpark/Pumptrack</span>
      </label>
    </div>
    <div style="display:${type === 'dirtpark' ? 'block' : 'none'};">
      <label class="checkbox-label-explain">Was findest du hier?</label>
      <div class="multi-select">
        <label class="multi-option">
        <input type="checkbox" id="hasPumprack" name="subType" value="pumptrack">
        <span class="multi-btn">Pumptrack</span>
        </label>
        
        <label class="multi-option">
        <input type="checkbox" name="subType" id="hasDirtpark" value="dirtpark">
        <span class="multi-btn">Dirtpark</span>
        </label>
      </div>
    </div>
    <label>
      <span>Name*</span>
      <input type="text" id="trailName" placeholder="Trailname" required>
    </label>
    <label>
      <span>Website</span>
      <input type="url" id="trailUrl" placeholder="https://...">
    </label>
    <label>
      <span>Instagram vom Verein/Trailbauer</span><span class="optional"> (optional)</span>
      <input type="text" id="trailInsta" placeholder="@username">
    </label>
    <label>
      <span>Eingetragen von... (Nickname etc.)</span><span class="optional"> (optional)</span>
      <input type="text" id="trailCreator" placeholder="Dein Name oder Nick, Instagram etc.">
    </label>
    <div class="popup-actions">
    <button id="cancelTrailBtn" class="cancel">Abbrechen</button>
    <button id="saveTrailBtn" class="save">Speichern</button>
    </div>
  </div>
`;
  marker.bindPopup(popupContent, popupSizing);

  marker.on("popupopen", () => {
    const saveBtn = document.getElementById("saveTrailBtn");
    const cancelBtn = document.getElementById("cancelTrailBtn");

    saveBtn.addEventListener("click", async () => {
      const trail = {
        name: document.getElementById("trailName").value.trim(),
        url: document.getElementById("trailUrl").value.trim(),
        instagram: document.getElementById("trailInsta").value.trim(),
        creator: document.getElementById("trailCreator").value.trim(),
        latitude: lat,
        longitude: lng,
      };

      if (!trail.name) {
        alert("Bitte gib einen Namen ein.");
        return;
      }
      if (addMode === 'dirtpark') {
        trail.dirtpark = document.getElementById("hasDirtpark").checked;
        trail.pumptrack = document.getElementById("hasPumprack").checked;

        if (!trail.pumptrack && !trail.dirtpark) {
          alert("Bitte wähle aus ob Pumptrack oder Dirtpark vorzufinden sind.");
          return;
        }
      }

      saveBtn.classList.add("loading");
      try {
        const endpoint = addMode === 'trail' ? 'add-trail' : (addMode === 'bikepark' ? 'bike-parks' : 'dirt-parks');
        await fetch(`https://ixafegmxkadbzhxmepsd.supabase.co/functions/v1/${endpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${anon}`,
          },
          body: JSON.stringify(trail),
        });

        showToast("Trail erfolgreich gespeichert ✅", "success");
      } catch (err) {
        console.error("Error saving trail:", err);
        showToast("Fehler beim Speichern ❌", "error");
        return;
      } finally {
        saveBtn.classList.remove("loading");
        marker.closePopup();
        marker.bindPopup(getTrailPopup(trail), popupSizing);
        resetAddMode(mymap);
      }
    });

    cancelBtn.addEventListener("click", () => {
      mymap.removeLayer(marker);
      resetAddMode(mymap);
    });
  });

  marker.openPopup();
}

function getMarkers(cluster, trails, type) {
  const trailMarkers = [];

  for (const trail of trails) {
    const popupHtml = getTrailPopup(trail);

    const marker = L.marker([trail.latitude, trail.longitude], { 
      icon: createCustomIcon(trail.approved, type),
      internal_id: trail.id,
      })
      .addTo(cluster)
      .bindPopup(popupHtml, popupSizing);

    marker.on("popupopen", async (e) => {
      const popup = e.popup;
      try {  
        const detailsHTML = await getTrailDetailsHTML(trail, type);
        const container = popup.getElement()?.querySelector('.popup-section.loading');
        if (container) { 
          container.outerHTML = detailsHTML;
          startPhotoCarousel();
          setupYT2Click();
        }
      } catch (err) {
        console.error("Fehler beim Laden der Details:", err);
        const container = popup.getElement()?.querySelector('.popup-section.loading');
        if (container) container.outerHTML = `<div class="popup-section"><p>⚠️ Details derzeit nicht verfügbar.</p></div>`;
      }
    });
    trailMarkers.push(marker);
  }

  return trailMarkers;
}

function getTrailPopup(trail) {
  let popupHtml = `
    <div class="popup-content">
    <div class="popup-header">
      <a href="${trail.approved ? trail.url : '#'}" class="${!trail.approved ? 'disabled' : ''}" target="_blank">
        ${trail.name}
        <i class=\"fa-solid fa-arrow-up-right-from-square\"></i>
      </a>
      </div>
  `;

  if (trail.instagram && trail.instagram.trim() !== "") {
    popupHtml += `
      <div class="popup-instagram">
        <a href="https://instagram.com/${trail.approved ? trail.instagram : ''}" target="_blank">
          <i class="fab fa-instagram" style="margin-right: 6px; font-size: 16px;"></i>
          <span>${trail.instagram}</span>
        </a>
      </div>
    `;
  }

  popupHtml += `
    <div class="popup-section loading">
      <p>Lade Details …</p>
    </div>
  `;

  if (trail.creator && trail.creator.trim() !== "")
    popupHtml += `
        <div class="popup-creator">
          <i class="fa-regular fa-user" style="margin-right: 4px;"></i>
          <span>Eingetragen von <strong>${trail.creator}</strong></span>
        </div>
      `;


  popupHtml += "</div>";
  return popupHtml;
}

pageCounter();
await init();
