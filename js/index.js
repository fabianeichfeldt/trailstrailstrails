import { bikeparks } from "./data/bikeparks.js";
import { getTrails, createCustomIcon, getTrailDetails } from "./data/trails.js";
import { showToast } from "./toast.js";

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

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function pageCounter() {
  return fetch("https://ixafegmxkadbzhxmepsd.supabase.co/functions/v1/add-visit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4YWZlZ214a2FkYnpoeG1lcHNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2Mjc1MzAsImV4cCI6MjA3NjIwMzUzMH0.BRbdccgrW7aZpvB_S4_qKn_BRcfPMyWjQAVuVuy2wyQ",
    },
  });
}

async function init() {
  function resetAddMode() {
    addMode = false;
    addBtn.textContent = "+ Trail hinzufügen";
    addBtn.style.background = "#2b6cb0";
    mymap._container.classList.remove("crosshair-cursor");
  }

  const el = document.getElementById("mapid");
  if (!el) {
    console.error("Map div not found!");
    return;
  }
  var mymap = L.map(el).setView([49.505, 11.09], 9);
  mymap._layersMaxZoom = 19;

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png?ts=20251020', {
    maxZoom: 19,
    tileSize: 512,
    zoomOffset: -1,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(mymap);

  const clusterToggle = document.getElementById("clusterToggle");

  clusterToggle.addEventListener("change", (e) => {
    const useCluster = e.target.checked;
  
    mymap.removeLayer(useCluster ? markerGroup : clusterGroup);
    mymap.addLayer(useCluster ? clusterGroup : markerGroup);
  
    if (useCluster && clusterGroup.getLayers().length === 0) {
      renderMarkers(clusterGroup, trails, bikeparks);
    } else if (!useCluster && markerGroup.getLayers().length === 0) {
      renderMarkers(markerGroup, trails, bikeparks);
    }
  });

  const clusterGroup = L.markerClusterGroup();
  const markerGroup = L.layerGroup();

  function renderMarkers(targetGroup, trails, parks) {
    targetGroup.clearLayers();
  
    for (const park of parks)
      L.marker(park.coords, { icon: createCustomIcon("bikepark") })
        .addTo(targetGroup)
        .bindPopup(
          `<div class="popup-content">
            <a href="${park.url}" target="_blank">${park.name}
            <i class="fa-solid fa-arrow-up-right-from-square"></i></a>
          </div>`
        );
  
    trailMarkers = getTrailMarkers(targetGroup, trails);
  }

  const trails = await getTrails();
  let trailMarkers = []
  renderMarkers(clusterGroup, trails, bikeparks);
  mymap.addLayer(clusterGroup);
  generateNews(trails);

  for(let i = 1; i <= 6; i++)
    document.getElementById(`show-last-${i}`).addEventListener("click", () => {
      const newsMarker = trailMarkers.at(-i);
      clusterGroup.zoomToShowLayer(newsMarker, () => {
        newsMarker.openPopup();
      });
    });

  let addMode = false;

    const addBtn = document.getElementById('addTrailBtn');

    addBtn.addEventListener('click', () => {
      addMode = !addMode;
      if (addMode) {
        addBtn.textContent = 'Klick auf Karte, um Trail zu setzen';
        addBtn.style.background = '#38a169';
        mymap.getContainer().classList.add('crosshair-cursor');
      } else {
        addBtn.textContent = '+ Trail hinzufügen';
        addBtn.style.background = '#2b6cb0';
        mymap.getContainer().classList.remove('crosshair-cursor');
      }
    });

    mymap.on('click', (e) => {
      if (!addMode) return;

      const { lat, lng } = e.latlng;
      
      const marker = L.marker([lat, lng]).addTo(mymap);
      const popupContent = `
      <div class="popup-form">
        <h3>Neuer Trail</h3>
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
          <button id="saveTrailBtn" class="save">Speichern</button>
          <button id="cancelTrailBtn" class="cancel">Abbrechen</button>
        </div>
      </div>
    `;
      marker.bindPopup(popupContent);

      addMode = false;
      addBtn.textContent = '+ Trail hinzufügen';
      addBtn.style.background = '#2b6cb0';
      mymap.getContainer().classList.remove('crosshair-cursor');

      
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
  
          saveBtn.classList.add("loading");
          try {
            await fetch("https://ixafegmxkadbzhxmepsd.supabase.co/functions/v1/add-trail", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4YWZlZ214a2FkYnpoeG1lcHNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2Mjc1MzAsImV4cCI6MjA3NjIwMzUzMH0.BRbdccgrW7aZpvB_S4_qKn_BRcfPMyWjQAVuVuy2wyQ",
              },
              body: JSON.stringify(trail),
            });

            marker.bindPopup(getTrailPopup(trail));
            showToast("Trail erfolgreich gespeichert ✅", "success");
          } catch (err) {
            console.error("Error saving trail:", err);
            showToast("Fehler beim Speichern ❌", "error");
            return;            
          }finally {
            saveBtn.classList.remove("loading");
            marker.closePopup();
            resetAddMode();
          }          
        });
  
        cancelBtn.addEventListener("click", () => {
          mymap.removeLayer(marker);
          resetAddMode();
        });
      });

      marker.openPopup();
    });
}

function getTrailMarkers(cluster, trails) {
  const trailMarkers = [];

  for (const trail of trails) {
    const popupHtml = getTrailPopup(trail);

    const marker = L.marker([trail.latitude, trail.longitude], { icon: createCustomIcon(trail.approved ? "verified" : "unverified") })
      .addTo(cluster)
      .bindPopup(popupHtml);

    marker.on("popupopen", () => getTrailDetails(trail.id));
    trailMarkers.push(marker);
  }

  return trailMarkers;
}

function getTrailPopup(trail) {
  let popupHtml = `
    <div class="popup-content">
      <a href="${trail.approved ? trail.url : '#'}" class="${!trail.approved ? 'disabled' : ''}" target="_blank">
        ${trail.name}
        <i class=\"fa-solid fa-arrow-up-right-from-square\"></i>
      </a>
  `;

  if (trail.instagram && trail.instagram.trim() !== "") {
    popupHtml += `
      <div class="popup-instagram" style="margin-top: 6px;">
        <a href="https://instagram.com/${trail.approved ? trail.instagram : ''}" target="_blank">
          <i class="fab fa-instagram" style="margin-right: 6px; font-size: 16px;"></i>
          <span>${trail.instagram}</span>
        </a>
      </div>
    `;
  }

  if (trail.news) 
    popupHtml += `
      <div class="popup-news" style="margin-top: 10px; font-size: 13px; background: #f9f9f9; padding: 6px; border-radius: 8px;">
        <strong>News:</strong><br>
        <time datetime="${trail.news.date}">
          <i>${formatDate(trail.news.date)}:</i>
        </time>
        <strong>${trail.news.title}</strong>
        <p style="margin: 4px 0 0;">${trail.news.subtitle}</p>
      </div>
    `;

    if (trail.creator && trail.creator.trim() !== "")
      popupHtml += `
        <div class="popup-creator" style="margin-top: 10px; font-size: 12px; color: #555;">
          <i class="fa-regular fa-user" style="margin-right: 4px;"></i>
          <span>Eingetragen von <strong>${trail.creator}</strong></span>
        </div>
      `;
  

  popupHtml += "</div>";
  return popupHtml;
}

pageCounter();
await init();
