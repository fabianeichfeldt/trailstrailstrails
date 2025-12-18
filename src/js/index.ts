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
import {generateNews} from "../news/news";
import {hideAddButton, initMap} from "../map/map";

//@ts-expect-error
window.toggleLegend = function () {
  document.querySelector('.map-legend')?.classList.toggle('collapsed');
}

let openSpecificTrail: string | undefined = undefined;

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

async function getInitialLocation(): Promise<Coord> {
  const path = window.location.pathname;
  const match = path.match(/^\/trails\/([^/]+)/);
  if (match && match[1] && match[1].length > 0) {
    const trailPath = match[1].toLowerCase();
    const predefinedRegion = locations.find(l => (l.name.toLowerCase() === trailPath));
    if (trailPath !== "nearby" && predefinedRegion)
      return predefinedRegion;
    else {
      openSpecificTrail = match[1].toLowerCase();
      return await getApproxLocation();
    }
  }
  return await getApproxLocation();
}

async function init() {
  const el = document.getElementById("mapid");
  if (!el) {
    console.error("Map div not found!");
    return;
  }

  initBurgerBtn();

  const [trails, bikeparks, dirtparks] = await Promise.all([
    getTrails(),
    getParks(),
    getDirtParks()
  ]);
  const location = await getInitialLocation();
  await initMap(el, location, undefined, trails, bikeparks, dirtparks);

  if (!openSpecificTrail)
    generateJsonLD(trails);

  generateNews(trails);

  // for (let i = 1; i <= 6; i++)
  //   document.getElementById(`show-last-${i}`)?.addEventListener("click", () => {
  //     const newsMarker = trailMarkers.at(-i);
  //     if(!newsMarker)
  //       return;
  //     clusterGroup.zoomToShowLayer(newsMarker, () => {
  //       newsMarker.openPopup();
  //     });
  //   });
  //
  document.addEventListener('click', (e) => {
    hideAddButton();
  });

  document.getElementById("communityBtn")?.addEventListener("click", () => {
    const section = document.getElementById("community");
    if (section) {
      section.scrollIntoView({ behavior: "smooth" });
    }
  });
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

pageCounter();
await init();
