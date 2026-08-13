import L from 'leaflet';
import { createApp, h, reactive, watch, type App } from 'vue';
import '@fortawesome/fontawesome-free/css/all.css';
import { MtbTour, MtbTrail, SpotMtbData } from '../../types/MtbTypes';
import { Trail } from '../../types/Trail';
import { Auth } from '../../auth/auth';
import { getTrailDetails, likeTrail, dislikeTrail, type SpotParkingLot } from '../../communication/trails';
import { share } from '../../communication/share';
import { copyToClipboard } from '../../utils/clipboard';
import { shareTrail } from './spotPanelShare';
import { TrailDetails } from '../../types/TrailDetails';
import { Comment } from '../../types/Comment';
import { renderTrailDetails } from '../detail_popup/detailsPopup';
import { bindPopupEvents, startPhotoCarousel } from '../detail_popup/logic';
import { setupYT2Click } from '../detail_popup/yt';
import { bindPhotoLightbox } from '../lightbox';
import { IMBA } from './elevationSvg';
import { initDragHandle } from './dragHandle';
import { drawTrailPolylines, addSegmentLabel } from './spotPanelPolylines';
import SpotPanelParkingTab from '../../components/map/SpotPanelParkingTab.vue';
import SpotPanelComments from '../../components/map/SpotPanelComments.vue';
import SpotPanelToursTab from '../../components/map/SpotPanelToursTab.vue';
import SpotPanelTrailsTab from '../../components/map/SpotPanelTrailsTab.vue';
import SpotPanelElevation from '../../components/map/SpotPanelElevation.vue';

/**
 * Minimal duck-typed shape of the Parking slice of `useSpotPanelStore`
 * (src/stores/spotPanel.ts), declared locally instead of importing the real
 * store type. src/map/ must never import from src/stores/ (see
 * `map-no-stores` in .dependency-cruiser.cjs) — the real Pinia store
 * instance is created in the composable layer (useTrailMap.ts) and handed
 * in here via constructor injection, same pattern already used for `Auth`.
 */
export interface SpotPanelParkingState {
  currentItem: Trail | null;
  isOpen: boolean;
  parkingLots: SpotParkingLot[];
  highlightedParkingLotId: string | null;
  parkingTabForceVisible: boolean;
  loadParking(spotId: string): Promise<void>;
}

/**
 * Minimal duck-typed shape of the Comments slice of `useSpotPanelStore`
 * (src/stores/spotPanel.ts), injected the same way as SpotPanelParkingState
 * above (Phase 2 of the migration spec). Unlike Parking, the *rendering* and
 * *interaction handling* (post/delete/reply/toggle/load-more) live entirely
 * in SpotPanelComments.vue now, which reads/writes the real store directly
 * (it's under src/components/, not src/map/, so map-no-stores doesn't apply
 * to it) — this class only needs enough to decide whether a fetch is
 * necessary before mounting the island.
 */
export interface SpotPanelCommentsState {
  comments: Comment[];
  commentsExpanded: boolean;
  commentsHasMore: boolean;
  commentsLoaded: boolean;
  loadComments(spotId: string, authInfo: { userId: string; isAdmin: boolean; isTrailcrew: boolean }): Promise<void>;
}

/**
 * Minimal duck-typed shape of the Tours+Trails+Elevation slice of
 * `useSpotPanelStore` (src/stores/spotPanel.ts), injected the same way as
 * SpotPanelParkingState/SpotPanelCommentsState above (Phase 3 of the
 * migration spec). `data` and `selectedItemId`/`selectedItemKind` are read
 * by this class to drive the Leaflet-side polyline restyling and
 * tour-segment layers (selectTrail()/selectTour()/clearTourLayers() below —
 * unchanged Leaflet logic, only its trigger moved to the watchers set up in
 * the constructor). The Tours/Trails tab rendering itself and the elevation
 * panel's content read/write the real store directly from
 * SpotPanelToursTab.vue/SpotPanelTrailsTab.vue/SpotPanelElevation.vue (they're
 * under src/components/, so map-no-stores doesn't apply to them) — this
 * class only mounts those islands and reacts to selection changes.
 */
export interface SpotPanelToursTrailsState {
  data: SpotMtbData | null;
  selectedItemId: string | null;
  selectedItemKind: 'tour' | 'trail' | null;
  loadSpotData(spotId: string): Promise<void>;
}

// ── SpotPanel ────────────────────────────────────────────────────────────────

export class SpotPanel {
  private panel!: HTMLElement;
  private overlayLayer: L.LayerGroup;       // individual trail polylines (always visible)
  private tourLayers: L.Layer[] = [];       // tour route layers — cleared when tour deselected
  private polylineMap = new Map<string, L.Polyline>(); // trailId → polyline
  private hoverMarker: L.CircleMarker | null = null;
  private activeId: string | null = null;
  private currentItem: Trail | null = null;
  private infoLoaded = false;
  private onClose: () => void;
  private auth: Auth;

  // Parking tab — Vue island (see SpotPanelParkingTab.vue). State itself
  // lives in the injected store; this class only owns the Vue app instance
  // and the reactive props object it's driven by.
  private parkingApp: App | null = null;
  private parkingProps = reactive<{ lots: SpotParkingLot[]; highlightId: string | undefined }>({
    lots: [],
    highlightId: undefined,
  });

  // Comments tab — Vue island (see SpotPanelComments.vue). Unlike Parking,
  // the component reads useSpotPanelStore() itself, so this class only owns
  // the mounted Vue app instance — no props to sync.
  private commentsApp: App | null = null;

  // Tours/Trails tabs + Elevation panel — Vue islands (see
  // SpotPanelToursTab.vue/SpotPanelTrailsTab.vue/SpotPanelElevation.vue).
  // Same "reads useSpotPanelStore() directly, no props to sync" shape as
  // Comments — Elevation only takes the Leaflet-bound hover/close callbacks
  // as static props (bound once at mount, see renderElevation() below).
  private toursApp: App | null = null;
  private trailsApp: App | null = null;
  private elevationApp: App | null = null;

  constructor(
    private readonly map: L.Map,
    auth: Auth,
    onClose: () => void,
    private readonly parkingStore: SpotPanelParkingState,
    private readonly commentsStore: SpotPanelCommentsState,
    private readonly toursTrailsStore: SpotPanelToursTrailsState,
  ) {
    this.auth = auth;
    this.onClose = onClose;
    this.overlayLayer = L.layerGroup().addTo(map);
    this.buildDOM();

    // Reacts to GPX data arriving for the currently open spot — draws the
    // individual trail polylines. Direct port of the tail end of the
    // vanilla loadSpotData(), just re-triggered off the store instead of
    // running inline after the fetch (see the migration spec's Phase 3
    // notes on the useTrailMap.ts watch() pattern, applied here since
    // src/map/ can't import stores directly — map-no-stores).
    watch(() => this.toursTrailsStore.data, (data) => {
      if (!data) return;
      this.renderLists();
      drawTrailPolylines(data, this.overlayLayer, this.polylineMap);
    });

    // Reacts to a tour/trail row being selected (in SpotPanelToursTab.vue /
    // SpotPanelTrailsTab.vue) — same selectItem() logic the old click
    // handler called directly, now triggered by the store changing instead.
    watch(
      () => [this.toursTrailsStore.selectedItemId, this.toursTrailsStore.selectedItemKind] as const,
      ([id, kind]) => {
        if (id && kind) this.selectItem(id, kind);
      },
    );
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  public open(item: Trail) {
    this.openInternal(item, 'info');
  }

  /**
   * Opens the panel for the spot owning `parkingLot`, jumping straight to the
   * Parking tab with that lot highlighted — instead of defaulting to Info
   * like a normal spot-marker click.
   */
  public openParkingLot(item: Trail, parkingLot: SpotParkingLot) {
    this.parkingStore.highlightedParkingLotId = parkingLot.id;
    this.openInternal(item, 'parking');
  }

  private openInternal(item: Trail, initialTab: 'info' | 'tours' | 'trails' | 'parking') {
    this.currentItem = item;
    this.parkingStore.currentItem = item;
    this.parkingStore.isOpen = true;
    this.infoLoaded = false;
    this.activeId = null;
    this.parkingStore.parkingLots = [];
    this.parkingStore.parkingTabForceVisible = initialTab === 'parking';
    this.commentsStore.comments = [];
    this.commentsStore.commentsExpanded = false;
    this.commentsStore.commentsHasMore = false;
    this.commentsStore.commentsLoaded = false;
    if (initialTab !== 'parking') this.parkingStore.highlightedParkingLotId = null;
    this.panel.querySelector('.spot-panel-title')!.textContent = item.name;
    const orgLink = this.panel.querySelector('.spot-panel-org-link') as HTMLAnchorElement;
    if (item.url) {
      orgLink.href = item.url;
      orgLink.classList.remove('hidden');
    } else {
      orgLink.classList.add('hidden');
    }
    const shareBtn = this.panel.querySelector('.spot-share-btn') as HTMLElement;
    shareBtn.classList.toggle('hidden', !item.approved);
    const likeBtn = this.panel.querySelector('.spot-like-btn') as HTMLElement;
    likeBtn.innerHTML = '<i class="fa-regular fa-star"></i>';
    likeBtn.dataset.liked = 'false';
    likeBtn.classList.add('hidden');
    this.closeElevation();
    this.panel.classList.add('open');
    this.renderParking();
    this.renderElevation();
    this.updateTabsVisibility();
    this.activateTab(initialTab);

    if (item.type === 'trail') {
      // Fire-and-forget, same as before — the store's loadSpotData() sets
      // toursTrailsStore.data when it resolves, which the constructor's
      // watch() picks up to render the lists and draw the polylines.
      this.toursTrailsStore.loadSpotData(item.id);
    }
    this.loadParking(item.id);
  }

  private async loadParking(spotId: string) {
    // Delegates the fetch + "bail out if the panel moved to a different
    // spot while the fetch was in flight" guard to the store — same
    // behavior as the old inline implementation, just relocated.
    await this.parkingStore.loadParking(spotId);
    // The store may have bailed out internally (stale response for an old
    // spot); guard again here so this class doesn't render over data that's
    // already correct for a newer spot.
    if (this.currentItem?.id !== spotId) return;
    this.renderParking();
    this.updateTabsVisibility();
  }

  /**
   * Mounts the Parking tab's Vue island on first use, then just mutates its
   * reactive props on every subsequent call — never remounts. See
   * SpotPanelParkingTab.vue and the migration spec's "island mechanism".
   */
  private renderParking() {
    Object.assign(this.parkingProps, {
      lots: this.parkingStore.parkingLots,
      highlightId: this.parkingStore.highlightedParkingLotId ?? undefined,
    });
    if (this.parkingApp) return;
    const container = this.panel.querySelector('#spot-parking-tab') as HTMLElement | null;
    if (!container) return;
    this.parkingApp = createApp(() => h(SpotPanelParkingTab, this.parkingProps));
    this.parkingApp.mount(container);
  }

  // ── Comments ─────────────────────────────────────────────────────────────
  // Comments aren't part of TrailDetails (unlike photos, which the trail-details
  // edge function embeds server-side) — they're fetched separately, same
  // pattern as loadParking()/renderParking() above. Rendering + interaction
  // (post/delete/reply/toggle/load-more) live in SpotPanelComments.vue now
  // (Phase 2 of the migration spec) — this class only mounts/unmounts the
  // island and decides whether a fetch is needed before doing so.

  /** Called every time the popup's info-tab HTML is (re)rendered — after an
   * upload refresh, `#spot-comments-section` is a fresh DOM node that needs
   * its own island mount; the comments data itself doesn't need refetching
   * if it's already loaded for this spot. */
  private setupComments(spotId: string) {
    this.renderComments();
    if (!this.commentsStore.commentsLoaded) {
      this.loadComments(spotId);
    }
  }

  private async loadComments(spotId: string) {
    const user = await this.auth.authService.getUser();
    // The panel may have moved on to a different spot while getUser() was
    // pending — same guard the store itself applies around its fetch.
    if (this.currentItem?.id !== spotId) return;
    await this.commentsStore.loadComments(spotId, {
      userId: user.id,
      isAdmin: !!user.isAdmin,
      isTrailcrew: !!user.isTrailcrew,
    });
  }

  /**
   * Mounts the Comments island fresh on every call rather than mutating
   * props in place (contrast with renderParking()): the container is a
   * brand-new DOM node each time setupComments() runs (see its doc comment
   * above), so any previously mounted app instance is already orphaned —
   * unmounting it here just releases its reactivity subscriptions instead
   * of leaking them. The new instance reads useSpotPanelStore() directly,
   * so no props need to be passed or synced.
   */
  private renderComments() {
    const container = this.panel.querySelector('#spot-comments-section') as HTMLElement | null;
    if (!container) return;
    this.commentsApp?.unmount();
    this.commentsApp = createApp(() => h(SpotPanelComments));
    this.commentsApp.mount(container);
  }

  public close() {
    this.panel.classList.remove('open');
    this.overlayLayer.clearLayers();
    this.clearTourLayers();
    this.polylineMap.clear();
    this.activeId = null;
    this.toursTrailsStore.data = null;
    this.currentItem = null;
    this.parkingStore.currentItem = null;
    this.parkingStore.isOpen = false;
    this.infoLoaded = false;
    this.parkingStore.parkingLots = [];
    this.parkingStore.highlightedParkingLotId = null;
    this.parkingStore.parkingTabForceVisible = false;
    this.commentsStore.comments = [];
    this.commentsStore.commentsExpanded = false;
    this.commentsStore.commentsHasMore = false;
    this.commentsStore.commentsLoaded = false;
    // Tear down the parking/comments/tours/trails/elevation islands rather
    // than leaving them mounted (and subscribed to reactivity) for a panel
    // that's now hidden — they're re-mounted lazily by the next
    // renderParking()/renderComments()/renderLists()/renderElevation() call.
    this.parkingApp?.unmount();
    this.parkingApp = null;
    this.commentsApp?.unmount();
    this.commentsApp = null;
    this.toursApp?.unmount();
    this.toursApp = null;
    this.trailsApp?.unmount();
    this.trailsApp = null;
    this.elevationApp?.unmount();
    this.elevationApp = null;
    this.closeElevation();
    this.onClose();
  }

  public get isOpen() { return this.panel.classList.contains('open'); }

  // ── DOM construction ───────────────────────────────────────────────────────

  private buildDOM() {
    this.panel = document.createElement('div');
    this.panel.className = 'spot-panel';
    this.panel.innerHTML = `
      <div class="spot-panel-handle" role="presentation"></div>
      <div class="spot-panel-header">
        <div class="spot-panel-title-row">
          <div class="spot-panel-title"></div>
          <button class="spot-panel-close" aria-label="Schließen">✕</button>
        </div>
        <div class="spot-panel-meta-row">
          <a class="spot-panel-org-link hidden" target="_blank" rel="noopener noreferrer">
            <i class="fas fa-external-link-alt"></i> Zur Trailcrew
          </a>
          <div class="spot-panel-actions">
            <button class="spot-action-btn spot-like-btn hidden" aria-label="Favorit">
              <i class="fa-regular fa-star"></i>
            </button>
            <button class="spot-action-btn spot-share-btn hidden" aria-label="Teilen">
              <i class="fas fa-share-alt"></i>
            </button>
          </div>
        </div>
      </div>
      <div class="spot-panel-tabs">
        <button class="spot-tab active" data-tab="info">Spot-Info</button>
        <button class="spot-tab" data-tab="tours">Touren</button>
        <button class="spot-tab" data-tab="trails">Trails</button>
        <button class="spot-tab" data-tab="parking">Parkplätze</button>
      </div>
      <div class="spot-panel-body">
        <div class="spot-tab-content" id="spot-info-tab">
          <div class="spot-info-loading"><p>Lade Details …</p></div>
        </div>
        <div class="spot-tab-content hidden" id="spot-tours-tab"></div>
        <div class="spot-tab-content hidden" id="spot-trails-tab"></div>
        <div class="spot-tab-content hidden" id="spot-parking-tab"></div>
      </div>
      <div class="spot-elevation-panel hidden">
        <div id="spot-elevation-content"></div>
      </div>
    `;

    // Must be inside the map container so it layers correctly
    this.map.getContainer().appendChild(this.panel);

    // Stop map interactions from firing through the panel
    L.DomEvent.disableClickPropagation(this.panel);
    L.DomEvent.disableScrollPropagation(this.panel);

    this.panel.querySelector('.spot-panel-close')!
      .addEventListener('click', () => this.close());
    // .spot-elevation-close now lives inside the SpotPanelElevation.vue
    // island (see renderElevation() below) — it calls closeElevation() via
    // its onClose prop instead of a raw DOM listener bound here.
    this.panel.querySelector('.spot-like-btn')!
      .addEventListener('click', () => this.handleLike());
    this.panel.querySelector('.spot-share-btn')!
      .addEventListener('click', () => this.handleShare());
    this.panel.querySelectorAll('.spot-tab').forEach(btn =>
      btn.addEventListener('click', e => {
        const tab = (e.currentTarget as HTMLElement).dataset.tab as 'tours' | 'trails' | 'info' | 'parking';
        this.activateTab(tab);
      })
    );

    initDragHandle(this.panel);
  }

  // ── Tabs & rendering ───────────────────────────────────────────────────────

  private activateTab(tab: 'tours' | 'trails' | 'info' | 'parking') {
    this.panel.querySelectorAll('.spot-tab').forEach(b => b.classList.remove('active'));
    this.panel.querySelector(`[data-tab="${tab}"]`)!.classList.add('active');
    this.panel.querySelectorAll('.spot-tab-content').forEach(c => c.classList.add('hidden'));
    this.panel.querySelector(`#spot-${tab}-tab`)!.classList.remove('hidden');
    this.closeElevation();
    if (tab === 'info' && !this.infoLoaded) this.loadInfo();
  }

  private updateTabsVisibility() {
    // Tours/Trails stay trail-only. Parking is available for any spot type
    // (trail/bikepark/dirtpark), but hidden until we know the spot has at
    // least one lot — unless we're jumping straight there via openParkingLot.
    const isTrail = this.currentItem && this.currentItem.type === 'trail';
    const toursTab = this.panel.querySelector('[data-tab="tours"]') as HTMLElement;
    const trailsTab = this.panel.querySelector('[data-tab="trails"]') as HTMLElement;
    const parkingTab = this.panel.querySelector('[data-tab="parking"]') as HTMLElement;

    toursTab.style.display = isTrail ? 'block' : 'none';
    trailsTab.style.display = isTrail ? 'block' : 'none';
    parkingTab.style.display = (this.parkingStore.parkingTabForceVisible || this.parkingStore.parkingLots.length > 0) ? 'block' : 'none';
  }

  private async loadInfo() {
    if (!this.currentItem) return;
    const item = this.currentItem;
    const container = this.panel.querySelector('#spot-info-tab')!;

    // Show loading spinner
    container.innerHTML = `
      <div class="spot-info-loading">
        <div class="loading-spinner"></div>
        <p>Lade Details …</p>
      </div>
    `;

    try {
      const details = await getTrailDetails(item);
      await this.updateLikeButton(details);
      const html = renderTrailDetails(item, details, this.auth);
      container.innerHTML = `<div class="spot-info-content">${html}</div>`;
      const content = container.querySelector('.spot-info-content') as HTMLElement;
      await bindPopupEvents(content, this.auth, async () => {
        const freshDetails = await getTrailDetails(item);
        content.innerHTML = renderTrailDetails(item, freshDetails, this.auth);
        startPhotoCarousel(content);
        bindPhotoLightbox(content);
        setupYT2Click(content);
        this.setupComments(item.id);
      });
      startPhotoCarousel(content);
      bindPhotoLightbox(content);
      setupYT2Click(content);
      this.setupComments(item.id);
      this.infoLoaded = true;
    } catch (e) {
      console.error('Failed to fetch trail details:', e);
      container.innerHTML = '<p class="spot-info-error">⚠️ Details derzeit nicht verfügbar.</p>';
    }
  }

  private async updateLikeButton(details: TrailDetails) {
    const likeBtn = this.panel.querySelector('.spot-like-btn') as HTMLElement;
    try {
      const user = await this.auth.authService.getUser();
      const isLiked = user != null && !!details.likes?.find(l => l.user_id === user.id);
      likeBtn.innerHTML = isLiked ? '⭐' : '<i class="fa-regular fa-star"></i>';
      likeBtn.dataset.liked = String(isLiked);
    } catch {
      likeBtn.innerHTML = '<i class="fa-regular fa-star"></i>';
      likeBtn.dataset.liked = 'false';
    }
    likeBtn.classList.remove('hidden');
  }

  private async handleLike() {
    if (!this.currentItem) return;
    if (!this.auth.authService.loggedIn) {
      await this.auth.openSignInModal();
      return;
    }
    const likeBtn = this.panel.querySelector('.spot-like-btn') as HTMLElement;
    const isLiked = likeBtn.dataset.liked === 'true';
    if (isLiked) {
      await dislikeTrail(this.currentItem.id, this.auth.authService);
      likeBtn.innerHTML = '<i class="fa-regular fa-star"></i>';
      likeBtn.dataset.liked = 'false';
    } else {
      await likeTrail(this.currentItem.id, this.auth.authService);
      likeBtn.innerHTML = '⭐';
      likeBtn.dataset.liked = 'true';
    }
  }

  private async handleShare() {
    if (!this.currentItem) return;
    await shareTrail(this.currentItem, {
      hasNativeShare: typeof navigator.share === 'function',
      nativeShare: data => navigator.share(data),
      copyToClipboard,
      showToast: (message, type) => this.showShareToast(message, type),
      reportShare: share,
    });
  }

  // Anchored under the share button rather than the app-wide bottom-center
  // toast — this only fires for the clipboard fallback (Firefox desktop,
  // where navigator.share doesn't exist), right next to the button the
  // user just pressed, so it's easy to notice.
  private showShareToast(message: string, type = 'success') {
    const actions = this.panel.querySelector('.spot-panel-actions') as HTMLElement;
    let toast = actions.querySelector('.spot-share-toast') as HTMLElement | null;
    if (!toast) {
      toast = document.createElement('div');
      actions.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = `spot-share-toast ${type}`;
    requestAnimationFrame(() => toast!.classList.add('show'));
    window.setTimeout(() => toast!.classList.remove('show'), 2200);
  }

  /**
   * Mounts the Tours/Trails tabs' Vue islands on first use — never remounts
   * (same "mount once, reads the store reactively" shape as renderParking()).
   * Row click handling now lives inside SpotPanelToursTab.vue/
   * SpotPanelTrailsTab.vue themselves (they write straight to the store);
   * this replaces the old innerHTML write + bindItemClicks() DOM wiring.
   */
  private renderLists() {
    if (!this.toursApp) {
      const toursContainer = this.panel.querySelector('#spot-tours-tab') as HTMLElement | null;
      if (toursContainer) {
        this.toursApp = createApp(() => h(SpotPanelToursTab));
        this.toursApp.mount(toursContainer);
      }
    }
    if (!this.trailsApp) {
      const trailsContainer = this.panel.querySelector('#spot-trails-tab') as HTMLElement | null;
      if (trailsContainer) {
        this.trailsApp = createApp(() => h(SpotPanelTrailsTab));
        this.trailsApp.mount(trailsContainer);
      }
    }
  }

  /**
   * Mounts the Elevation panel's Vue island on first use. Unlike Parking's
   * reactive props, the only things crossing the src/map/ → Vue boundary here
   * are the Leaflet-bound hover/close callbacks (bound once, at mount) — the
   * selected item itself is read reactively from the store inside
   * SpotPanelElevation.vue. See the migration spec's Phase 3 notes on why
   * the hover bridge stays a callback prop rather than store state.
   */
  private renderElevation() {
    if (this.elevationApp) return;
    const container = this.panel.querySelector('#spot-elevation-content') as HTMLElement | null;
    if (!container) return;
    this.elevationApp = createApp(() => h(SpotPanelElevation, {
      onHover: this.handleElevationHover.bind(this),
      onHoverEnd: this.handleElevationHoverEnd.bind(this),
      onClose: () => this.closeElevation(),
    }));
    this.elevationApp.mount(container);
  }

  private handleElevationHover(latlng: [number, number], color: string) {
    if (!this.hoverMarker) {
      this.hoverMarker = L.circleMarker(latlng, {
        radius: 7, color, weight: 2.5,
        fillColor: '#fff', fillOpacity: 1,
        interactive: false,
      }).addTo(this.overlayLayer);
    } else {
      this.hoverMarker.setLatLng(latlng);
      this.hoverMarker.setStyle({ color });
    }
  }

  private handleElevationHoverEnd() {
    this.removeHoverMarker();
  }

  // ── Item selection ─────────────────────────────────────────────────────────

  /**
   * Triggered by the constructor's watch() on
   * toursTrailsStore.selectedItemId/selectedItemKind (set by
   * SpotPanelToursTab.vue/SpotPanelTrailsTab.vue on row click) — used to run
   * directly off a DOM click listener (see bindItemClicks(), now removed).
   * Body unchanged from before the migration: still reads the tours/trails
   * list from the injected store instead of a local field.
   */
  private selectItem(id: string, kind: 'tour' | 'trail') {
    const data = this.toursTrailsStore.data;
    if (!data) return;
    if (kind === 'tour') {
      const tour = data.tours.find(t => t.id === id);
      if (tour) this.selectTour(tour);
    } else {
      const trail = data.trails.find(t => t.id === id);
      if (trail) this.selectTrail(trail);
    }
    this.activeId = id;
  }

  private selectTrail(trail: MtbTrail) {
    // Restore individual trail view, highlight selected
    this.clearTourLayers();
    this.polylineMap.forEach((pl, id) => {
      pl.setStyle(id === trail.id
        ? { weight: 6, opacity: 1}
        : { weight: 2, opacity: 0.7}
      );
    });
    const pl = this.polylineMap.get(trail.id);
    if (pl) this.map.fitBounds(pl.getBounds(), { padding: [60, 60], maxZoom: 15, animate: true });
    this.showElevation();
  }

  private clearTourLayers() {
    this.tourLayers.forEach(l => this.map.removeLayer(l));
    this.tourLayers = [];
  }

  private selectTour(tour: MtbTour) {
    this.clearTourLayers();

    // Collect trail IDs that are part of this tour
    const tourTrailIds = new Set(tour.segments
      .filter(s => s.type === 'trail' && s.trailId)
      .map(s => s.trailId!));

    // Set trail visibility: highlight tour trails, fade/dash others
    this.polylineMap.forEach((pl, trailId) => {
      if (tourTrailIds.has(trailId)) {
        // Trail is part of this tour — keep normal style
        pl.setStyle({ weight: 3, opacity: 0.65});
      } else {
        pl.setStyle({ weight: 2, opacity: 0.65});
      }
    });

    const fullRoute = tour.gpxPoints.map(p => [p[0], p[1]] as [number, number]);

    // 1. Full route as single dark gray base line (added first = renders below)
    if (fullRoute.length) {
      const base = L.polyline(fullRoute, { color: '#333', weight: 5, opacity: 0.85 }).addTo(this.map);
      this.tourLayers.push(base);
    }

    // 2. Trail segments in IMBA colors on top (added after = renders above)
    for (const seg of tour.segments) {
      if (seg.type !== 'trail' || !seg.difficulty) continue;
      const latlngs = seg.gpxPoints.map(p => [p[0], p[1]] as [number, number]);
      const pl = L.polyline(latlngs, { color: IMBA[seg.difficulty].hex, weight: 5, opacity: 1 }).addTo(this.map);
      this.tourLayers.push(pl);
      addSegmentLabel(seg, latlngs, this.map, this.tourLayers);
    }

    if (fullRoute.length)
      this.map.fitBounds(L.latLngBounds(fullRoute), { padding: [50, 50], maxZoom: 14, animate: true });

    this.showElevation();
  }

  // ── Elevation profile ──────────────────────────────────────────────────────
  // Rendering (name/chart/stats/status/GPX link) and the hover-bind-on-DOM-
  // update dance now live in SpotPanelElevation.vue, which reads the
  // selected item reactively straight off the store — the same
  // selectedItemId/selectedItemKind this class just set via selectItem()
  // above. showElevation()/closeElevation() are left owning only the
  // Leaflet-adjacent bits that don't belong in a Vue component: the hover
  // marker lifecycle and the panel's hidden/visible toggle.

  private showElevation() {
    this.removeHoverMarker();
    this.panel.querySelector('.spot-elevation-panel')!.classList.remove('hidden');
  }

  private closeElevation() {
    this.removeHoverMarker();
    this.panel.querySelector('.spot-elevation-panel')!.classList.add('hidden');
    if (this.activeId) {
      // Restore individual trail polylines and remove tour segments
      this.clearTourLayers();
      this.polylineMap.forEach(pl => pl.setStyle({ weight: 3, opacity: 0.65 }));
      this.activeId = null;
    }
    // Clears the selection reactively — SpotPanelToursTab.vue/
    // SpotPanelTrailsTab.vue's `active` row class and SpotPanelElevation.vue's
    // content both derive from these, so this replaces the old raw
    // `.spot-item` classList.remove('active') DOM sweep (which predates the
    // Tours/Trails tabs being Vue-rendered and would now just fight the
    // framework's own re-render instead of reliably clearing anything).
    this.toursTrailsStore.selectedItemId = null;
    this.toursTrailsStore.selectedItemKind = null;
  }

  private removeHoverMarker() {
    if (this.hoverMarker) {
      this.overlayLayer.removeLayer(this.hoverMarker);
      this.hoverMarker = null;
    }
  }

}
