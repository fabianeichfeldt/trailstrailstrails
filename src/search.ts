import { Trail, BikePark, DirtPark, SingleTrail } from "./types/Trail";
import { TrailMap } from "./map/map";

interface PlaceResult {
  display_name: string;
  lat: string;
  lon: string;
}

const TYPE_ICON: Record<string, string> = {
  trail: "🚵️",
  bikepark: "🚵",
  dirtpark: "🚵",
};

const TYPE_LABEL: Record<string, string> = {
  trail: "Trail",
  bikepark: "Bikepark",
  dirtpark: "Dirtpark / Pumptrack",
};

function trailScore(trail: Trail, query: string): number {
  const name = trail.name.toLowerCase();
  const q = query.toLowerCase();
  if (name === q) return 100;
  if (name.startsWith(q)) return 80;
  if (name.includes(q)) return 60;
  // word-level match
  if (name.split(/\s+/).some(w => w.startsWith(q))) return 40;
  return 0;
}

async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const base = `https://nominatim.openstreetmap.org/search?format=json&accept-language=de&limit=5&q=${encodeURIComponent(query)}`;
  try {
    const dach: PlaceResult[] = await fetch(`${base}&countrycodes=de,at,ch`).then(r => r.ok ? r.json() : []);
    if (dach.length > 0) return dach;
    return await fetch(base).then(r => r.ok ? r.json() : []);
  } catch {
    return [];
  }
}

function formatPlaceName(display_name: string): { name: string; sub: string } {
  const parts = display_name.split(", ");
  return { name: parts[0], sub: parts.slice(1, 3).join(", ") };
}

export function initSearch(
  trails: SingleTrail[],
  bikeparks: BikePark[],
  dirtparks: DirtPark[],
  map: TrailMap
) {
  const input = document.getElementById("search") as HTMLInputElement;
  const clearBtn = document.getElementById("search-clear") as HTMLButtonElement;
  const resultsEl = document.getElementById("search-results") as HTMLDivElement;
  const wrapper = input.closest<HTMLElement>(".search-wrapper")!;
  const toggleBtn = document.getElementById("search-toggle") as HTMLButtonElement | null;

  if (!input || !resultsEl) return;

  const allTrails: Trail[] = [...trails, ...bikeparks, ...dirtparks];

  let debounceTimer: ReturnType<typeof setTimeout>;
  let currentQuery = "";

  function isMobile() {
    return window.matchMedia("(max-width: 600px)").matches;
  }

  function openSearch() {
    wrapper.classList.add("open");
    input.focus();
  }

  function closeSearch() {
    input.value = "";
    clearBtn.classList.remove("visible");
    hideResults();
    wrapper.classList.remove("open");
  }

  toggleBtn?.addEventListener("click", openSearch);

  function showResults(html: string) {
    resultsEl.innerHTML = html;
    resultsEl.classList.toggle("visible", html.length > 0);
  }

  function hideResults() {
    resultsEl.classList.remove("visible");
    resultsEl.innerHTML = "";
  }

  function trailItem(trail: Trail): string {
    const icon = TYPE_ICON[trail.type] ?? "📍";
    const label = TYPE_LABEL[trail.type] ?? "";
    return `<div class="search-result-item" data-trail-id="${trail.id}">
      <span class="search-result-icon">${icon}</span>
      <div class="search-result-text">
        <div class="search-result-name">${trail.name}</div>
        <div class="search-result-sub">${label}</div>
      </div>
    </div>`;
  }

  function placeItem(place: PlaceResult, idx: number): string {
    const { name, sub } = formatPlaceName(place.display_name);
    return `<div class="search-result-item" data-place-idx="${idx}" data-lat="${place.lat}" data-lon="${place.lon}">
      <span class="search-result-icon">📍</span>
      <div class="search-result-text">
        <div class="search-result-name">${name}</div>
        <div class="search-result-sub">${sub}</div>
      </div>
    </div>`;
  }

  async function runSearch(query: string) {
    currentQuery = query;

    const matched = allTrails
      .map(t => ({ trail: t, score: trailScore(t, query) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(x => x.trail);

    // Show trail results immediately, then append places async
    let html = "";
    if (matched.length > 0) {
      html += `<div class="search-result-separator">Trails & Parks</div>`;
      html += matched.map(trailItem).join("");
    }
    if (html) showResults(html);

    const places = await searchPlaces(query);
    // Abort if query changed while we were waiting
    if (currentQuery !== query) return;

    if (places.length > 0) {
      html += `<div class="search-result-separator">Orte & Regionen</div>`;
      html += places.map(placeItem).join("");
    }

    if (html) showResults(html);
    else showResults(`<div class="search-result-item"><div class="search-result-text"><div class="search-result-name" style="color:#aaa">Keine Ergebnisse</div></div></div>`);
  }

  input.addEventListener("input", () => {
    const q = input.value.trim();
    clearBtn.classList.toggle("visible", q.length > 0);
    clearTimeout(debounceTimer);
    if (q.length < 2) { hideResults(); return; }
    debounceTimer = setTimeout(() => runSearch(q), 250);
  });

  clearBtn.addEventListener("click", () => {
    if (isMobile()) {
      closeSearch();
    } else {
      input.value = "";
      clearBtn.classList.remove("visible");
      hideResults();
      input.focus();
    }
  });

  resultsEl.addEventListener("click", (e) => {
    const item = (e.target as Element).closest<HTMLElement>(".search-result-item");
    if (!item) return;

    if (item.dataset.trailId) {
      map.openTrail(item.dataset.trailId);
    } else if (item.dataset.placeIdx !== undefined) {
      const lat = parseFloat(item.dataset.lat ?? "0");
      const lon = parseFloat(item.dataset.lon ?? "0");
      if (lat && lon) map.flyToPlace(lat, lon);
    }

    input.value = "";
    clearBtn.classList.remove("visible");
    hideResults();
  });

  document.addEventListener("click", (e) => {
    const target = e.target as Element;
    if (target.closest(".search-wrapper") || target.closest("#search-toggle")) return;
    if (isMobile()) closeSearch();
    else hideResults();
  });
}
