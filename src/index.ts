import { getParks } from "./data/bikeparks";
import { getDirtParks } from "./data/dirt_parks";
import {getTrails} from "./data/trails";
import {Coord, getApproxLocation, locations} from "./locations";
import { generateJsonLD } from "./json_ld";

import "@fortawesome/fontawesome-free/css/all.css";
import "/src/css/style.css";
import "/src/css/add_btn.css";
import "/src/css/legend.css";
import "/src/css/switch.css";
import "/src/css/community.css";
import "/src/css/side_menu.css";

import "/src/css/new_entry_popup.css";
import {generateNews} from "./news/news";
import { TrailMap } from "./map/map";

//@ts-expect-error
window.toggleLegend = function () {
  document.querySelector('.map-legend')?.classList.toggle('collapsed');
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

async function getInitialLocation(): Promise<Coord | string> {
  const path = window.location.pathname;
  const match = path.match(/^\/trails\/([^/]+)/);
  if (match && match[1] && match[1].length > 0) {
    const trailPath = match[1].toLowerCase();
    const predefinedRegion = locations.find(l => (l.name.toLowerCase() === trailPath));
    if (trailPath !== "nearby" && predefinedRegion)
      return predefinedRegion;
    else
      return match[1].toLowerCase();
  }
  return await getApproxLocation();
}

async function init() {
  const el = document.getElementById("mapid");
  if (!el) {
    console.error("Map div not found!");
    return;
  }
  const map = new TrailMap(el);
  await map.init();

  initBurgerBtn();

  const [trails, bikeparks, dirtparks] = await Promise.all([
    getTrails(),
    getParks(),
    getDirtParks()
  ]);

  map.setData(trails, bikeparks, dirtparks);
  const location = await getInitialLocation();
  if((location as Coord) !== undefined) {
    map.setView(location as Coord);
    generateJsonLD(trails);
  }
  else
    map.openTrail(location as string);

  generateNews(trails);

  for (let i = 1; i <= 6; i++) {
    const newsItem = document.getElementById(`show-last-${i}`)
    newsItem?.getElementsByTagName('a')[0]?.addEventListener("click", () => {
      const trailID = newsItem?.dataset.trailID;
      if (!trailID) return;
      map.openTrail(trailID)
    });
  }

  document.addEventListener('click', () => {
    map.hideAddButton();
  });

  document.getElementById("communityBtn")?.addEventListener("click", () => {
    const section = document.getElementById("community");
    if (section) {
      section.scrollIntoView({ behavior: "smooth" });
    }
  });

  filterHandling(map);
}

function initBurgerBtn() {
  const burgerBtn = document.getElementById('burgerBtn');
  const drawer = document.getElementById('drawer');
  if(!burgerBtn || !drawer) return;

  const drawerOverlay = document.getElementById('drawerOverlay');
  const drawerClose = document.getElementById('drawerClose');
  const drawerLinks = drawer?.querySelectorAll('a');

  drawerLinks?.forEach(link =>link.addEventListener('click', () => closeDrawer()));

  function openDrawer() {
    drawer?.classList.add('open');
    drawerOverlay?.classList.add('active');
    burgerBtn?.classList.add('active');
  }
  function closeDrawer() {
    drawer?.classList.remove('open');
    drawerOverlay?.classList.remove('active');
    burgerBtn?.classList.remove('active');
  }

  burgerBtn.addEventListener('click', openDrawer);
  drawerClose?.addEventListener('click', closeDrawer);
  drawerOverlay?.addEventListener('click', closeDrawer);
}

function filterHandling(map: TrailMap) {
  const clusterToggle = document.getElementById("clusterToggle") as HTMLFormElement;
  const filterParks = document.querySelector('input[data-filter="bikepark"]') as HTMLFormElement;
  const filterTrails = document.querySelector('input[data-filter="trailcenter"]') as HTMLFormElement;
  const filterDirtParks = document.querySelector('input[data-filter="dirtpark"]') as HTMLFormElement;
  const filterPumptracks = document.querySelector('input[data-filter="pumptrack"]') as HTMLFormElement;

  function updateFilters() {
    map.setFilter(clusterToggle.checked, filterParks.checked, filterDirtParks.checked, filterPumptracks.checked, filterTrails.checked);
  }

  clusterToggle?.addEventListener("change", updateFilters);
  filterParks?.addEventListener("change", updateFilters);
  filterTrails?.addEventListener("change", updateFilters);
  filterDirtParks?.addEventListener("change", updateFilters);
  filterPumptracks?.addEventListener("change", updateFilters);
}

pageCounter();
await init();
