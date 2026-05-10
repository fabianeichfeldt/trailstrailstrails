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
import {createCustomIcon} from "../communication/trails";
import {Coord} from "../locations";
import {TrailFilter} from "./trailFilter";
import {IAuthService} from "../auth/auth_service";
import {Auth} from "../auth/auth";
import {setupYT2Click} from "./detail_popup/yt";
import {SpotPanel} from "./spot_panel/spotPanel";

export class TrailMap {
  private clusterGroup!: L.MarkerClusterGroup;
  private markerGroup!: L.LayerGroup;
  private spotPanel!: SpotPanel;
  private addMode: anyTrailType | undefined;

  private trails: SingleTrail[] = [];
  private bikeparks: BikePark[] = [];
  private dirtparks: DirtPark[] = [];
  private filterSettings: TrailFilter = new TrailFilter();
  private markersById = new Map<string, L.Marker>();
  private mymap!: L.Map;
  private auth!: Auth;
  private currentPositionMarker: L.CircleMarker | null = null;
  private geolocationWatchId: number | null = null;
  private directionIndicator: L.Polygon | null = null;
  private currentHeading: number | null = null;

  private get currentMarkerLayer(): L.MarkerClusterGroup | L.LayerGroup {
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

  public async init(auth: Auth) {
    this.auth = auth;
    this.mymap.setMaxZoom(19);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png?ts=20251021', {
      maxZoom: 19,
      // zoomControl: false,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',

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

    this.spotPanel = new SpotPanel(this.mymap, auth, () => {
      document.getElementById("top-map-buttons")!.style.display = "block";
    });

    this.initAddButton(auth.authService);
    this.initGeolocation();
  }

  public setView(location: Coord) {
    this.mymap.setView(location, 9)
  }

  public flyToPlace(lat: number, lon: number) {
    this.mymap.flyTo([lat, lon], 11, { duration: 1.2 });
  }

  public initPopupZIndexHack(elements: HTMLElement[]) {
    this.mymap.on("popupopen", () => elements.forEach(el => el.classList.add("popup-open")));
    this.mymap.on("popupclose", () => elements.forEach(el => el.classList.remove("popup-open")));
  }

  public openTrail(trailID: string) {
    const trail = [...this.trails, ...this.bikeparks, ...this.dirtparks].find(t => t.id === trailID);
    if (trail) {
      document.getElementById("top-map-buttons")!.style.display = "none";
      this.mymap.flyTo([trail.latitude, trail.longitude], 14, { duration: 1.2 });
      this.spotPanel.open(trail);
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
        icon: createCustomIcon(trail),
      }).addTo(cluster);

      this.markersById.set(trail.id, marker);

      marker.on("click", () => {
        document.getElementById("top-map-buttons")!.style.display = "none";
        this.mymap.flyTo([trail.latitude, trail.longitude], 14, { duration: 1.0 });
        this.spotPanel.open(trail);
      });
    }
  }

  private initAddButton(auth: IAuthService) {
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
      if (!this.addMode) {
        if (this.spotPanel.isOpen) this.spotPanel.close();
        return;
      }
      const nearByTrail = giveTrailNearBy(e.latlng.lat, e.latlng.lng, this.trails);
      if (nearByTrail)
        askNearbyConflict(nearByTrail, () => {
          openCreateTrailPopup(this.mymap, e.latlng.lat, e.latlng.lng, this.addMode!, auth)
          this.resetAddMode(addBtn);
        }, () => reportAbort());
      else {
        openCreateTrailPopup(this.mymap, e.latlng.lat, e.latlng.lng, this.addMode, auth);
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

  private initGeolocation() {
    if (!navigator.geolocation) {
      console.warn('Geolocation not supported by this browser');
      return;
    }

    this.startGeolocation();
  }

  private startGeolocation() {
    if (this.geolocationWatchId !== null) return;

    this.geolocationWatchId = navigator.geolocation.watchPosition(
      (position) => {
        this.updateCurrentPosition(
          position.coords.latitude,
          position.coords.longitude,
          position.coords.accuracy,
          position.coords.heading
        );
      },
      (error) => {
        console.warn('Geolocation error:', error);
      },
      {
        enableHighAccuracy: false,
        maximumAge: 0,
        timeout: 10000,
      }
    );

    // Request permission and listen to device orientation for better heading accuracy
    if ('permissions' in navigator && 'query' in navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then(() => {
        this.startDeviceOrientationListener();
      });
    }
  }

  public stopGeolocation() {
    if (this.geolocationWatchId !== null) {
      navigator.geolocation.clearWatch(this.geolocationWatchId);
      this.geolocationWatchId = null;
    }
    if (this.currentPositionMarker) {
      this.mymap.removeLayer(this.currentPositionMarker);
      this.currentPositionMarker = null;
    }
    if (this.directionIndicator) {
      this.mymap.removeLayer(this.directionIndicator);
      this.directionIndicator = null;
    }
    window.removeEventListener('deviceorientationabsolute', this.handleDeviceOrientation.bind(this));
  }

  private updateCurrentPosition(lat: number, lng: number, accuracy: number, heading?: number | null) {
    if (heading !== undefined && heading !== null) {
      this.currentHeading = heading;
    }

    if (!this.currentPositionMarker) {
      this.currentPositionMarker = L.circleMarker([lat, lng], {
        radius: 8,
        fillColor: '#4285F4',
        fillOpacity: 0.9,
        color: '#1e40af',
        weight: 2.5,
        interactive: false,
      }).addTo(this.mymap);

      // Add a subtle pulsing circle around the marker
      const pulseCircle = L.circleMarker([lat, lng], {
        radius: 12,
        fillColor: '#4285F4',
        fillOpacity: 0.1,
        color: '#4285F4',
        weight: 0,
        interactive: false,
      }).addTo(this.mymap);
    } else {
      this.currentPositionMarker.setLatLng([lat, lng]);
      // Update the pulse circle
      const children = this.mymap._layers;
      for (const id in children) {
        const layer = children[id];
        if (layer instanceof L.CircleMarker && (layer as any)._radius === 12) {
          layer.setLatLng([lat, lng]);
          break;
        }
      }
    }

    // Update direction indicator if heading is available
    if (this.currentHeading !== null) {
      this.updateDirectionIndicator(lat, lng);
    }
  }

  private updateDirectionIndicator(lat: number, lng: number) {
    const heading = this.currentHeading;
    if (heading === null) return;

    // Create a cone pointing in the direction of heading
    const coneAngle = 60; // 60 degree cone
    const coneDistance = 0.0015; // ~150 meters at equator

    const leftAngle = (heading - coneAngle / 2) * (Math.PI / 180);
    const rightAngle = (heading + coneAngle / 2) * (Math.PI / 180);
    const forwardAngle = heading * (Math.PI / 180);

    // Calculate cone points
    const forward = L.latLng(
      lat + coneDistance * Math.cos(forwardAngle),
      lng + coneDistance * Math.sin(forwardAngle)
    );
    const left = L.latLng(
      lat + coneDistance * 0.4 * Math.cos(leftAngle),
      lng + coneDistance * 0.4 * Math.sin(leftAngle)
    );
    const right = L.latLng(
      lat + coneDistance * 0.4 * Math.cos(rightAngle),
      lng + coneDistance * 0.4 * Math.sin(rightAngle)
    );

    const conePoints: L.LatLngExpression[] = [
      [lat, lng],
      forward,
      right,
      [lat, lng],
      forward,
      left,
    ];

    if (this.directionIndicator) {
      this.directionIndicator.setLatLngs(conePoints);
    } else {
      this.directionIndicator = L.polygon(conePoints, {
        color: '#4285F4',
        fillColor: '#4285F4',
        fillOpacity: 0.25,
        weight: 2,
        interactive: false,
      }).addTo(this.mymap);
    }
  }

  private startDeviceOrientationListener() {
    window.addEventListener('deviceorientationabsolute', (event: DeviceOrientationEvent) => {
      if (event.absolute && event.alpha !== null) {
        this.currentHeading = (360 - event.alpha) % 360;
        if (this.currentPositionMarker) {
          const latLng = this.currentPositionMarker.getLatLng();
          this.updateDirectionIndicator(latLng.lat, latLng.lng);
        }
      }
    });
  }

  private handleDeviceOrientation(event: DeviceOrientationEvent) {
    if (event.absolute && event.alpha !== null) {
      this.currentHeading = (360 - event.alpha) % 360;
      if (this.currentPositionMarker) {
        const latLng = this.currentPositionMarker.getLatLng();
        this.updateDirectionIndicator(latLng.lat, latLng.lng);
      }
    }
  }
}
