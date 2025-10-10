import * as L from "leaflet";
import { bikeparks } from "./data/bikeparks.js";
import { trails } from "./data/trails.js";

function generateNews(){
  const container = document.getElementById("news");
  if (!container) return;

  try {
    const news = [];
    news.push({
      title: "Neue Trails!",
      date: "2025-10-10",
      text: `Neuer Trail hinzugefügt: <a id='show-last'>${trails.at(-1).name}</a>`,
    });
    news.push({
      title: "Bikepark Arber",
      date: "2025-10-09",
      text: `Neu bei uns in der Karte - Bikepark Arber!: <a id='show-last-park'>${bikeparks.at(-1).name}</a>`,
    });
    news.push({
      title: "Jetzt auch auf Instagram",
      date: "2025-10-09",
      text: `Trailradar ist jetzt auch auf Instagram zu finden: <a href="https://www.instagram.com/trailradar.germany">@trailradar.germany</a>`,
    });
    news.push({
      title: "Website redesign",
      date: "2025-10-08",
      text: "Neues Design und neue Funktionen.",
    });
    container.innerHTML = "<h2>Neuigkeiten</h2>";

    for (const item of news) {
      const el = document.createElement("div");
      el.className = "news-item";
      el.innerHTML = `
        <strong>${item.title}</strong>
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

export function init() {
  console.log("init map");
  const el = document.getElementById("mapid");
  if (!el) {
    console.error("Map div not found!");
    return;
  }
  var mymap = L.map(el).setView([49.505, 11.09], 9);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(mymap);

  var Bikepark = L.icon({
    iconUrl: 'bikepark.png',
    iconSize: [35, 22]
  });

  const parkMarkers = [];
  for (const park of bikeparks)
    parkMarkers.push(L.marker(park.coords, { icon: Bikepark }).addTo(mymap).bindPopup("<a href='" + park.url + "' target=blank>" + park.name + "</a>"));


  const trailMarkers = [];
  for (const trail of trails)
    trailMarkers.push(L.marker(trail.coords).addTo(mymap).bindPopup("<a href='" + trail.url + "' target=blank>" + trail.name + "</a>"));

  generateNews();

  document.getElementById("show-last").addEventListener("click", () => {
    trailMarkers.at(-1).openPopup();
  });

  document.getElementById("show-last-park").addEventListener("click", () => {
    parkMarkers.at(-1).openPopup();
  });
}