import * as L from "leaflet";
import { bikeparks } from "./data/bikeparks.js";
import { trails } from "./data/trails.js";
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

  for (const park of bikeparks)
    L.marker(park.coords, { icon: Bikepark }).addTo(mymap).bindPopup("<a href='" + park.url + "'>" + park.name + "</a>");


  for (const trail of trails)
    L.marker(trail.coords).addTo(mymap).bindPopup("<a href='" + trail.url + "'>" + trail.name + "</a>");
}