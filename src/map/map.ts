import L from "leaflet";
import "leaflet.markercluster";
import "leaflet-gesture-handling";
import "../fullscreen";

import "/src/css/fullscreen.css";
import "/src/css/marker.css";
import "leaflet-gesture-handling/dist/leaflet-gesture-handling.css";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import {anyTrailType, BikePark, DirtPark, isAnyTrailType, SingleTrail} from "../types/Trail";
import {askNearbyConflict, giveTrailNearBy, reportAbort} from "../near_by_trails";
import {openCreateTrailPopup} from "./create_trail/popup";
import {createCustomIcon, getTrailDetails} from "../data/trails";
import {getTrailPopup, renderTrailDetails} from "./detail_popup/detailsPopup";
import {bindPopupEvents, setupYT2Click, startPhotoCarousel} from "./detail_popup/logic";
import {Coord} from "../locations";
import {TrailFilter} from "./trailFilter";

const popupSizing = { minWidth: "95vw", maxWidth: "450px" }
export class TrailMap {
  private clusterGroup!: L.MarkerClusterGroup;
  private markerGroup!: L.LayerGroup;
  private addMode: anyTrailType | undefined;

  private trails: SingleTrail[] = [];
  private bikeparks: BikePark[] = [];
  private dirtparks: DirtPark[] = [];
  private filterSettings: TrailFilter = new TrailFilter();
  private markersById = new Map<string, L.Marker>();
  private mymap!: L.Map;

  private get currentMarkerLayer() : L.MarkerClusterGroup | L.LayerGroup {
    return this.filterSettings.useCluster ? this.clusterGroup : this.markerGroup;
  }
  private get filteredTrails(): SingleTrail[] {
    return this.trails.filter(() => this.filterSettings.showTrails);
  }
  private get filteredBikeparks(): BikePark[] {
    return this.bikeparks.filter(() => this.filterSettings.showBikeparks);
  }
  private get filteredDirtparks(): DirtPark[] {
    return this.dirtparks.filter(dp => {
      if (this.filterSettings.showDirtparks && this.filterSettings.showPumptracks) return true;
      if (this.filterSettings.showDirtparks && dp.dirtpark) return true;

      return this.filterSettings.showPumptracks && dp.pumptrack;
    });
  }

  constructor(private readonly container: HTMLElement) {
    L.Map.addInitHook("addHandler", "gestureHandling", (L as any).GestureHandling);
    this.mymap = L.map(this.container, {
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
  }

  public async init() {
    this.mymap.setMaxZoom(19);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png?ts=20251021', {
      maxZoom: 19,
      // zoomControl: false,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',

    }).addTo(this.mymap);

    L.control.zoom({
      position: 'bottomright',
    }).addTo(this.mymap);

    L.control
      //@ts-expect-error
      .fullscreen({
        position: 'bottomright',
        forceSeparateButton: false,
      })
      .addTo(this.mymap);


    this.clusterGroup = new L.MarkerClusterGroup();
    this.markerGroup = new L.LayerGroup();
    this.mymap.addLayer(this.clusterGroup);

    this.initAddButton();
  }

  public setView(location: Coord) {
    this.mymap.setView(location, 9)
  }

  public openTrail(trailID: string) {
    console.log("open trail", trailID)
    const specificTrailMarker = this.markersById.get(trailID);
    console.log(specificTrailMarker)
    if (specificTrailMarker) {
      this.clusterGroup.zoomToShowLayer(specificTrailMarker, () => {
        specificTrailMarker.openPopup();
      });
    }
  }

  public setData(trails: SingleTrail[], bikeparks: BikePark[], dirtparks: DirtPark[]) {
    this.trails = trails;
    this.bikeparks = bikeparks;
    this.dirtparks = dirtparks;

    this.renderMarkers();
  }

  public setFilter(useCluster: boolean, showBikeparks: boolean, showDirtparks: boolean, showPumptracks: boolean, showTrails: boolean) {
    this.filterSettings.showDirtparks = showDirtparks;
    this.filterSettings.showBikeparks = showBikeparks;
    this.filterSettings.showPumptracks = showPumptracks;
    this.filterSettings.showTrails = showTrails;

    this.filterSettings.useCluster = useCluster;
    this.renderMarkers();
  }

  private renderMarkers() {
    this.mymap.removeLayer(this.currentMarkerLayer);
    this.mymap.addLayer(this.currentMarkerLayer);
    this.clusterGroup.clearLayers();
    this.markerGroup.clearLayers();

    let allTrails: (SingleTrail | BikePark | DirtPark)[] = this.filteredDirtparks
    allTrails = allTrails.concat(this.filteredTrails).concat(this.filteredBikeparks);
    this.createMarkers(this.currentMarkerLayer, allTrails);
  }

  private createMarkers(cluster: L.MarkerClusterGroup | L.LayerGroup, trails: (SingleTrail | BikePark | DirtPark)[]) {
    this.markersById.clear();
    for (const trail of trails) {
      const marker = L.marker([trail.latitude, trail.longitude], {
        icon: L.icon(createCustomIcon(trail)),
      })
        .addTo(cluster)
        //@ts-expect-error
        .bindPopup(getTrailPopup(trail), popupSizing);

      this.markersById.set(trail.id, marker);
      marker.on("popupclose", () => document.getElementById("top-map-buttons")!.style.display = "block");
      marker.on("popupopen", async (e) => {
        const shareBtn = document.getElementById("share-button");
        shareBtn?.addEventListener("click", async () => {
          console.log("Share button clicked", navigator.canShare())
            await navigator.share({
              title: `Offizieller MTB Trail '${trail.name}' auf Trailradar`,
              url: `https://trailradar.org/trails/${trail.id}`
            });
        });

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
    }
  }

  private initAddButton() {
    const addBtn = document.getElementById('add-btn') as HTMLButtonElement | null;
    const fabMenu = document.getElementById('fab-menu');

    addBtn?.addEventListener('click', () => {
      fabMenu?.classList.toggle('hidden');
      addBtn?.classList.toggle('active');
      if (!!this.addMode)
        this.resetAddMode(addBtn);
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
      this.addMode = type;
      if (!!this.addMode) {
        addBtn.textContent = 'Klick auf Karte, um Trail zu setzen';
        addBtn.classList.add('active');
        this.mymap.getContainer().classList.add('crosshair-cursor');
      } else {
        addBtn.textContent = '+';
        addBtn.style.background = '#2b6cb0';
        this.mymap.getContainer().classList.remove('crosshair-cursor');
      }
    });

    this.mymap.on('click', (e) => {
      if (!this.addMode) return;
      const nearByTrail = giveTrailNearBy(e.latlng.lat, e.latlng.lng, this.trails);
      if (nearByTrail)
        askNearbyConflict(nearByTrail, () => {
          openCreateTrailPopup(this.mymap, e.latlng.lat, e.latlng.lng, this.addMode!)
          this.resetAddMode(addBtn);
        }, () => reportAbort());
      else {
        openCreateTrailPopup(this.mymap, e.latlng.lat, e.latlng.lng, this.addMode);
        this.resetAddMode(addBtn);
      }
    });
  }

  private resetAddMode(addBtn: HTMLButtonElement | null) {
    this.addMode = undefined;
    if(!addBtn) return;
    addBtn.textContent = "+";
    addBtn.classList.remove("hidden", "active");
    // map_container.classList.remove("crosshair-cursor");
  }

  public hideAddButton() {
    const inWrapper = document.getElementsByClassName('add-btn-wrapper');
    if (!inWrapper) {
      const fabMenu = document.getElementById('fab-menu');
      fabMenu?.classList.add('hidden');
    }
  }
}
