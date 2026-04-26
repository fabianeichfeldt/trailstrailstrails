import { getParks } from "./communication/bikeparks";
import { getDirtParks } from "./communication/dirt_parks";
import {getLatestPhotos, getTrails} from "./communication/trails";
import {Coord, getApproxLocation, locations} from "./locations";
import { generateJsonLD } from "./json_ld";

import "@fortawesome/fontawesome-free/css/all.css";
import "/src/css/style.css";
import "/src/css/add_btn.css";
import "/src/css/legend.css";
import "/src/css/switch.css";
import "/src/css/community.css";
import "/src/css/side_menu.css";
import "/src/css/search.css";
import "/src/css/new_entry_popup.css";
import "/src/auth/auth_modal.css";
import {generateNews, News} from "./news/news";
import { TrailMap } from "./map/map";
import { Auth } from "./auth/auth";
import {Supabase} from "./auth/supabase";
import {initSearch} from "./search";

//@ts-expect-error
window.toggleLegend = function () {
  document.querySelector('.map-legend')?.classList.toggle('collapsed');
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
  const authService = new Supabase();
  const auth = new Auth(authService);
  await auth.init();
  const map = new TrailMap(el);
  await map.init(auth);

  initBurgerBtn();

  const popupOverElements = [
    document.getElementById("burgerBtn"),
    document.getElementById("search-toggle"),
    document.querySelector(".search-wrapper"),
  ].filter(Boolean) as HTMLElement[];
  map.initPopupZIndexHack(popupOverElements);

  const [trails, bikeparks, dirtparks] = await Promise.all([
    getTrails(),
    getParks(),
    getDirtParks()
  ]);

  map.setData(trails, bikeparks, dirtparks);
  initSearch(trails, bikeparks, dirtparks, map);
  const location = await getInitialLocation();
  const coord = location as Coord;
  if(coord.lat !== undefined && coord.lng !== undefined) {
    map.setView(coord);
    generateJsonLD(trails);
  }
  else
    map.openTrail(location as string);

  let news = trails.slice(-7).map(item => new News(item));
  const latestPhotos = await getLatestPhotos();
  console.log(latestPhotos);
  news = news.concat(latestPhotos.map(item => new News(item))).sort((a, b) => a.created_at > b.created_at ? 1 : -1);
  generateNews(news);

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

function initInstallBanner() {
  const DISMISSED_KEY = "pwa-install-dismissed";
  if (localStorage.getItem(DISMISSED_KEY)) return;

  // Already running as installed PWA — don't show
  if (window.matchMedia("(display-mode: standalone)").matches) return;

  const banner = document.getElementById("install-banner")!;
  const btn = document.getElementById("install-banner-btn")!;
  const dismiss = document.getElementById("install-banner-dismiss")!;
  const hint = document.getElementById("install-banner-hint")!;

  function show() {
    banner.classList.remove("hidden");
  }
  function hide(permanent = true) {
    banner.classList.add("hidden");
    if (permanent) localStorage.setItem(DISMISSED_KEY, "1");
  }

  dismiss.addEventListener("click", () => hide());

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (isIOS) {
    // iOS has no install prompt — show manual instructions after 3 seconds
    hint.textContent = 'Tippe auf "Teilen" → "Zum Home-Bildschirm"';
    btn.textContent = "Verstanden";
    btn.addEventListener("click", () => hide());
    setTimeout(show, 3000);
    return;
  }

  // Android / Chrome: capture the beforeinstallprompt event
  let deferredPrompt: any = null;
  window.addEventListener("beforeinstallprompt", (e: Event) => {
    e.preventDefault();
    deferredPrompt = e;
    setTimeout(show, 3000);
  });

  btn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    hide(outcome === "accepted");
    if (outcome !== "accepted") {
      // User declined — don't show again for this session but don't permanently dismiss
      localStorage.removeItem(DISMISSED_KEY);
    }
  });

  window.addEventListener("appinstalled", () => hide());
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

await init();
initInstallBanner();
