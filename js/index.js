import { bikeparks } from "./data/bikeparks.js";
import { getTrails } from "./data/trails.js";

function generateNews(trails) {
  const container = document.getElementById("news");
  if (!container) return;

  try {
    const news = [];
    for (let i = 1; i < 7; i++) {
      const newsItem = trails.at(-i);
      news.push({
        title: "Neue Trails!",
        date: newsItem.date,
        text: `<strong>${newsItem.name}</strong> wurde neu aufgenommen in die Übersicht: <a id='show-last-${i}'>Link</a>`,
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
  const el = document.getElementById("mapid");
  if (!el) {
    console.error("Map div not found!");
    return;
  }
  var mymap = L.map(el).setView([49.505, 11.09], 9);
  mymap._layersMaxZoom = 19;

  var markers = L.markerClusterGroup();

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(markers);

  var Bikepark = L.icon({
    iconUrl: './assets/bikepark.png',
    iconSize: [35, 22]
  });

  const parkMarkers = [];
  for (const park of bikeparks)
    parkMarkers.push(L.marker(park.coords, { icon: Bikepark }).addTo(markers).bindPopup("<div class=\"popup-content\"><a href='" + park.url + "' target=blank>" + park.name + "<i class=\"fa-solid fa-arrow-up-right-from-square\"></i></a></div>"));


  const trails = await getTrails();
  const trailMarkers = getTrailMarkers(markers, trails);
  mymap.addLayer(markers);
  generateNews(trails);

  document.getElementById("show-last-1").addEventListener("click", () => {
    trailMarkers.at(-1).openPopup();
  });

  document.getElementById("show-last-2").addEventListener("click", () => {
    trailMarkers.at(-2).openPopup();
  });
  document.getElementById("show-last-3").addEventListener("click", () => {
    trailMarkers.at(-3).openPopup();
  });
  document.getElementById("show-last-4").addEventListener("click", () => {
    trailMarkers.at(-4).openPopup();
  });
  document.getElementById("show-last-5").addEventListener("click", () => {
    trailMarkers.at(-4).openPopup();
  });
  document.getElementById("show-last-6").addEventListener("click", () => {
    trailMarkers.at(-4).openPopup();
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
          <span>Ersteller / Nickname etc.</span><span class="optional"> (optional)</span>
          <input type="text" id="trailCreator" placeholder="Dein Name oder Nick, Instagram etc.">
        </label>
        <div class="popup-actions">
          <button id="saveTrailBtn" class="save">Speichern</button>
          <button id="cancelTrailBtn" class="cancel">Abbrechen</button>
        </div>
      </div>
    `;
      marker.bindPopup(popupContent).openPopup();

      addMode = false;
      addBtn.textContent = '+ Trail hinzufügen';
      addBtn.style.background = '#2b6cb0';
      mymap.getContainer().classList.remove('crosshair-cursor');
    });
}

function getTrailMarkers(mymap, trails) {
  const trailMarkers = [];

  for (const trail of trails) {
    let popupHtml = `
    <div class="popup-content">
      <a href="${trail.url}" target="_blank">
        ${trail.name}
        <i class=\"fa-solid fa-arrow-up-right-from-square\"></i>
      </a>
  `;

    if (trail.instagram && trail.instagram.trim() !== "") {
      popupHtml += `
      <div class="popup-instagram" style="margin-top: 6px;">
        <a href="https://instagram.com/${trail.instagram}" target="_blank">
          <i class="fab fa-instagram" style="margin-right: 6px; font-size: 16px;"></i>
          <span>${trail.instagram}</span>
        </a>
      </div>
    `;
    }

    // Add optional news block if available
    if (trail.news) {
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
    }

    popupHtml += "</div>";

    const marker = L.marker([trail.latitude, trail.longitude])
      .addTo(mymap)
      .bindPopup(popupHtml);

    trailMarkers.push(marker);
  }

  return trailMarkers;
}

pageCounter();
await init();