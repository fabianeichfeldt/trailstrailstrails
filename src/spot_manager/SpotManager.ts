import '@fortawesome/fontawesome-free/css/all.css';
import './spot_manager.css';
import { Supabase } from '../auth/supabase';
import {
  getMyRole, getManageableSpots, getSpotTrails, getSpotTours,
  uploadGpx, upsertTrail, upsertTour, deleteTrail, deleteTour,
  getSpotDetails, upsertSpotDetails,
  SpotRow, GpxTrailRow, GpxTourRow, SpotDetailsRow, SpotStatus, AccessType, RainPolicy, NightPolicy,
} from './Api';
import {
  processGpx, matchTrailsInTour,
  ProcessedGpx, DIFFICULTIES, DIRECTIONS, DIFF_COLOR,
} from './GpxProcessor';
import { MapView } from './MapView';
import { ImbaColor, TrailDirection } from '../types/MtbTypes';

interface PendingImport {
  key: string;
  filename: string;
  kind: 'trail' | 'tour';
  processed: ProcessedGpx;
  name: string;
  difficulty: ImbaColor;
  direction: TrailDirection;
  trailNames: string[];
  autoDetectedTrailNames: string[];
}

export class SpotManager {
  private root!: HTMLElement;
  private mapView!: MapView;
  private jwt = '';
  private userId = '';
  private role: 'admin' | 'trailcrew' | 'user' = 'user';
  private spots: SpotRow[] = [];
  private spotId = '';
  private spotName = '';
  private trails: GpxTrailRow[] = [];
  private tours:  GpxTourRow[]  = [];
  private spotDetails: SpotDetailsRow | null = null;
  private pending: PendingImport[] = [];
  private importing = false;
  private editingTrail: GpxTrailRow | null = null;
  private editingTour:  GpxTourRow  | null = null;

  constructor(private auth: Supabase) {}

  // ── Bootstrap ──────────────────────────────────────────────────────────────

  async mount(root: HTMLElement) {
    this.root = root;
    this.root.innerHTML = this.shellHTML();
    this.mapView = new MapView(this.root.querySelector('#sm-map')!);

    this.renderSidebar('<div class="sm-spinner"></div><p class="sm-center-msg">Checking access…</p>');

    try {
      const user = await this.auth.getUser();
      if (!user || user.id === '-1') {
        this.renderSidebar('<p class="sm-center-msg sm-error">Bitte erst einloggen.</p>');
        return;
      }
      this.jwt    = user.accessToken;
      this.userId = user.id;
      this.role   = await getMyRole(this.jwt);

      if (this.role === 'user') {
        this.renderSidebar(`<p class="sm-center-msg sm-error">
          Kein Zugriff. Trailcrew- oder Admin-Rolle erforderlich.<br>
          <small style="opacity:.7">Rolle in DB: "${this.role}"</small>
        </p>`);
        return;
      }

      this.spots = await getManageableSpots(this.jwt, this.userId, this.role);
      this.renderSpotSelector();
    } catch (e: any) {
      console.error('[SpotManager]', e);
      this.renderSidebar(`<p class="sm-center-msg sm-error">Fehler: ${e.message}</p>`);
    }
  }

  // ── Spot Selector ──────────────────────────────────────────────────────────

  private renderSpotSelector() {
    this.setTopbar('Spot Manager');
    if (this.spots.length === 0) {
      this.renderSidebar(`<p class="sm-center-msg">
        Keine Spots gefunden.<br>
        <small style="opacity:.7">Rolle: ${this.role} · Tabelle: trails</small>
      </p>`);
      return;
    }
    const items = this.spots.map(s => `
      <button class="sm-spot-btn" data-id="${s.id}" data-name="${this.esc(s.name)}">
        <span class="sm-spot-name">${this.esc(s.name)}</span>
        <span class="sm-spot-id">${s.id.slice(0, 8)}…</span>
      </button>`).join('');
    this.renderSidebar(`<div class="sm-spot-list">${items}</div>`);
    this.root.querySelectorAll('.sm-spot-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id   = (btn as HTMLElement).dataset.id!;
        const name = (btn as HTMLElement).dataset.name!;
        this.openSpot(id, name);
      });
    });
  }

  // ── Spot Editor ────────────────────────────────────────────────────────────

  private async openSpot(id: string, name: string) {
    this.spotId   = id;
    this.spotName = name;
    this.pending  = [];
    this.importing = false;
    this.editingTrail = null;
    this.editingTour  = null;
    this.mapView.clear();

    this.setTopbar(name, true);
    this.renderSidebar('<div class="sm-spinner"></div>');

    try {
      [this.trails, this.tours, this.spotDetails] = await Promise.all([
        getSpotTrails(id, this.jwt),
        getSpotTours(id, this.jwt),
        getSpotDetails(id, this.jwt),
      ]);
      this.mapView.showTrails(this.trails);
      this.tours.forEach(t => this.mapView.addTourPolyline(t));
      this.mapView.setClickHandler(itemId => this.focusItem(itemId));
      this.renderList();
    } catch (e: any) {
      this.renderSidebar(`<p class="sm-center-msg sm-error">Fehler: ${e.message}</p>`);
    }
  }

  // ── List view ──────────────────────────────────────────────────────────────

  private renderList() {
    this.importing = false;
    this.editingTrail = null;
    this.editingTour  = null;
    this.closeElevation();

    const trailItems = this.trails.map(t => `
      <div class="sm-item" data-id="${t.id}">
        <div class="sm-item-dot" style="background:${DIFF_COLOR[t.difficulty as ImbaColor] ?? '#888'}"></div>
        <div class="sm-item-info">
          <strong>${this.esc(t.name)}</strong>
          <span class="sm-item-sub">${t.distance_km} km · ↑${t.elevation_gain}m ↓${t.elevation_loss}m</span>
        </div>
        <div class="sm-item-actions">
          <button class="sm-btn-icon" data-action="edit-trail" data-id="${t.id}" title="Bearbeiten"><i class="fas fa-pen"></i></button>
          <button class="sm-btn-icon sm-btn-danger" data-action="del-trail" data-id="${t.id}" title="Löschen"><i class="fas fa-trash"></i></button>
        </div>
      </div>`).join('');

    const tourItems = this.tours.map(t => `
      <div class="sm-item" data-id="${t.id}">
        <div class="sm-item-dot sm-item-dot-tour"></div>
        <div class="sm-item-info">
          <strong>${this.esc(t.name)}</strong>
          <span class="sm-item-sub">${t.distance_km} km · ${t.duration_minutes} min</span>
        </div>
        <div class="sm-item-actions">
          <button class="sm-btn-icon" data-action="edit-tour" data-id="${t.id}" title="Bearbeiten"><i class="fas fa-pen"></i></button>
          <button class="sm-btn-icon sm-btn-danger" data-action="del-tour" data-id="${t.id}" title="Löschen"><i class="fas fa-trash"></i></button>
        </div>
      </div>`).join('');

    const trailHint = this.trails.length === 0
      ? '<p class="sm-section-hint">Lade zuerst alle Trails hoch. Bei mehreren Schwierigkeiten einen Trail in Abschnitte aufteilen.</p>'
      : '';
    const tourHint = this.tours.length === 0 && this.trails.length > 0
      ? '<p class="sm-section-hint">Trails sind bereit – jetzt Touren hochladen und die enthaltenen Trails zuordnen.</p>'
      : this.tours.length === 0
      ? '<p class="sm-section-hint">Touren erst hochladen, nachdem alle Trails angelegt sind.</p>'
      : '';

    const status = this.spotDetails?.status ?? 'open';
    const statusMeta: Record<string, { icon: string; label: string; cls: string }> = {
      open:    { icon: 'fa-circle-check',         label: 'Offen',         cls: 'status-open' },
      limited: { icon: 'fa-triangle-exclamation', label: 'Eingeschränkt', cls: 'status-limited' },
      closed:  { icon: 'fa-ban',                  label: 'Gesperrt',      cls: 'status-closed' },
      unknown: { icon: 'fa-circle-question',      label: 'Unbekannt',     cls: 'status-unknown' },
    };
    const sm = statusMeta[status] ?? statusMeta.open;
    const untilDate = this.spotDetails?.status_until
      ? new Date(this.spotDetails.status_until + 'T00:00:00')
          .toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : null;
    const bannerSub = [
      sm.label,
      untilDate ? `bis ${untilDate}` : null,
      this.spotDetails?.status_hint || null,
    ].filter(Boolean).join(' · ');

    this.renderSidebar(`
      <div class="sm-list-view">

        <button class="sm-details-banner" id="btn-open-details">
          <div class="sm-details-banner-left">
            <span class="sm-details-status-dot ${sm.cls}"><i class="fas ${sm.icon}"></i></span>
            <div>
              <span class="sm-details-banner-title">Spot-Details</span>
              <span class="sm-details-banner-sub">${this.esc(bannerSub)}</span>
            </div>
          </div>
          <i class="fas fa-chevron-right sm-details-arrow"></i>
        </button>

        <div class="sm-section">
          <div class="sm-section-header">
            <h3>Trails <span class="sm-count">${this.trails.length}</span></h3>
            <button class="sm-btn-add" id="btn-add-trail"><i class="fas fa-plus"></i> Trail</button>
          </div>
          ${trailHint}
          <div class="sm-items">${trailItems || '<p class="sm-empty">Keine Trails</p>'}</div>
        </div>
        <div class="sm-section">
          <div class="sm-section-header">
            <h3>Touren <span class="sm-count">${this.tours.length}</span></h3>
            <button class="sm-btn-add" id="btn-add-tour"><i class="fas fa-plus"></i> Tour</button>
          </div>
          ${tourHint}
          <div class="sm-items">${tourItems || '<p class="sm-empty">Keine Touren</p>'}</div>
        </div>
      </div>
    `);

    this.root.querySelector('#btn-open-details')!.addEventListener('click', () => this.openDetailsEditor());
    this.root.querySelector('#btn-add-trail')!.addEventListener('click', () => this.openImport('trail'));
    this.root.querySelector('#btn-add-tour')!.addEventListener('click', () => this.openImport('tour'));

    this.root.querySelectorAll('[data-action]').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        const action = (el as HTMLElement).dataset.action!;
        const id     = (el as HTMLElement).dataset.id!;
        if (action === 'edit-trail')    this.openEditTrail(id);
        if (action === 'edit-tour')     this.openEditTour(id);
        if (action === 'del-trail')     this.confirmDelete(id, 'trail');
        if (action === 'del-tour')      this.confirmDelete(id, 'tour');
      });
    });

    this.root.querySelectorAll('.sm-item').forEach(el => {
      el.addEventListener('mouseenter', () => this.mapView.highlight((el as HTMLElement).dataset.id!));
      el.addEventListener('mouseleave', () => this.mapView.resetHighlights());
    });
  }

  private focusItem(id: string) {
    this.mapView.highlight(id);
    this.mapView.fitTo(id);
  }

  // ── Edit existing ─────────────────────────────────────────────────────────

  private openEditTrail(id: string) {
    const t = this.trails.find(x => x.id === id)!;
    this.editingTrail = t;
    this.mapView.highlight(id);
    this.mapView.fitTo(id);

    const diffOpts = DIFFICULTIES.map(d =>
      `<option value="${d.value}" ${t.difficulty === d.value ? 'selected' : ''}>${d.label}</option>`
    ).join('');
    const dirOpts = DIRECTIONS.map(d =>
      `<option value="${d.value}" ${t.direction === d.value ? 'selected' : ''}>${d.label}</option>`
    ).join('');

    this.renderSidebar(`
      <div class="sm-edit-form">
        <div class="sm-form-header">
          <button class="sm-btn-back" id="edit-cancel"><i class="fas fa-arrow-left"></i></button>
          <h3>Trail bearbeiten</h3>
        </div>
        <label>Name<input id="ef-name" type="text" value="${this.esc(t.name)}" /></label>
        <label>Schwierigkeit<select id="ef-diff">${diffOpts}</select></label>
        <label>Richtung<select id="ef-dir">${dirOpts}</select></label>
        <label class="sm-file-label">
          GPX ersetzen (optional)
          <input type="file" id="ef-gpx" accept=".gpx" />
        </label>
        <div id="ef-gpx-info" class="sm-gpx-info hidden"></div>
        <div class="sm-form-actions">
          <button class="sm-btn-secondary" id="edit-cancel2">Abbrechen</button>
          <button class="sm-btn-primary" id="edit-save"><i class="fas fa-save"></i> Speichern</button>
        </div>
      </div>
    `);

    this.root.querySelectorAll('#edit-cancel, #edit-cancel2').forEach(b =>
      b.addEventListener('click', () => { this.editingTrail = null; this.renderList(); })
    );

    let newProcessed: ProcessedGpx | null = null;
    this.root.querySelector<HTMLInputElement>('#ef-gpx')!.addEventListener('change', async e => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const content = await file.text();
      newProcessed = processGpx(content);
      if (newProcessed) {
        const info = this.root.querySelector('#ef-gpx-info')!;
        info.textContent = `✓ ${newProcessed.rawCount} → ${newProcessed.thinnedCount} Punkte · ${newProcessed.distance_km} km`;
        info.classList.remove('hidden');
        this.mapView.addPendingPolyline('edit-preview', newProcessed.gpxPoints, DIFF_COLOR[t.difficulty as ImbaColor] ?? '#888');
        this.mapView.fitTo('edit-preview');
      }
    });

    this.root.querySelector('#edit-save')!.addEventListener('click', async () => {
      await this.saveTrailEdit(t.id, newProcessed);
    });
  }

  private async saveTrailEdit(id: string, newGpx: ProcessedGpx | null) {
    const name  = (this.root.querySelector<HTMLInputElement>('#ef-name')!).value.trim();
    const diff  = (this.root.querySelector<HTMLSelectElement>('#ef-diff')!).value as ImbaColor;
    const dir   = (this.root.querySelector<HTMLSelectElement>('#ef-dir')!).value as TrailDirection;

    if (!name) { alert('Name darf nicht leer sein.'); return; }

    this.setBusy(true);
    try {
      let gpx_url = this.editingTrail!.gpx_url;
      let gpxPoints = this.editingTrail!.gpx_points;
      let stats: Pick<GpxTrailRow, 'distance_km' | 'elevation_gain' | 'elevation_loss'> = {
        distance_km: this.editingTrail!.distance_km,
        elevation_gain: this.editingTrail!.elevation_gain,
        elevation_loss: this.editingTrail!.elevation_loss,
      };

      if (newGpx) {
        gpx_url = await uploadGpx(this.spotId, 'trails', `${name}.gpx`, newGpx.gpxContent, this.jwt);
        gpxPoints = newGpx.gpxPoints;
        stats = { distance_km: newGpx.distance_km, elevation_gain: newGpx.elevation_gain, elevation_loss: newGpx.elevation_loss };
      }

      const updated = await upsertTrail({
        id, spot_id: this.spotId, name, difficulty: diff, direction: dir,
        gpx_points: gpxPoints, gpx_url, ...stats,
      }, this.jwt);

      this.trails = this.trails.map(t => t.id === id ? updated : t);
      this.mapView.removeLayer('edit-preview');
      this.mapView.addTrailPolyline(updated);
      this.editingTrail = null;
      this.renderList();
    } catch (e: any) {
      alert(`Fehler: ${e.message}`);
    } finally {
      this.setBusy(false);
    }
  }

  private openEditTour(id: string) {
    const t = this.tours.find(x => x.id === id)!;
    this.editingTour = t;
    this.mapView.highlight(id);
    this.mapView.fitTo(id);

    const dirOpts = [
      { value: 'cw',  label: '↻ Uhrzeigersinn' },
      { value: 'ccw', label: '↺ Gegen Uhrzeiger' },
    ].map(d => `<option value="${d.value}" ${t.direction === d.value ? 'selected' : ''}>${d.label}</option>`).join('');

    const trailChecks = this.trails.map(tr => `
      <label class="sm-check-label">
        <input type="checkbox" value="${this.esc(tr.name)}" ${(t.trail_names ?? []).includes(tr.name) ? 'checked' : ''} />
        ${this.esc(tr.name)}
      </label>`).join('');

    this.renderSidebar(`
      <div class="sm-edit-form">
        <div class="sm-form-header">
          <button class="sm-btn-back" id="edit-cancel"><i class="fas fa-arrow-left"></i></button>
          <h3>Tour bearbeiten</h3>
        </div>
        <label>Name<input id="ef-name" type="text" value="${this.esc(t.name)}" /></label>
        <label>Richtung<select id="ef-dir">${dirOpts}</select></label>
        <label>Dauer (min)<input id="ef-dur" type="number" min="1" value="${t.duration_minutes ?? ''}" /></label>
        <div class="sm-trail-checks">
          <span class="sm-label">Enthaltene Trails</span>
          ${trailChecks || '<span class="sm-muted">Keine Trails für diesen Spot</span>'}
        </div>
        <label class="sm-file-label">
          GPX ersetzen (optional)
          <input type="file" id="ef-gpx" accept=".gpx" />
        </label>
        <div id="ef-gpx-info" class="sm-gpx-info hidden"></div>
        <div class="sm-form-actions">
          <button class="sm-btn-secondary" id="edit-cancel2">Abbrechen</button>
          <button class="sm-btn-primary" id="edit-save"><i class="fas fa-save"></i> Speichern</button>
        </div>
      </div>
    `);

    this.root.querySelectorAll('#edit-cancel, #edit-cancel2').forEach(b =>
      b.addEventListener('click', () => { this.editingTour = null; this.renderList(); })
    );

    let newProcessed: ProcessedGpx | null = null;
    this.root.querySelector<HTMLInputElement>('#ef-gpx')!.addEventListener('change', async e => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const content = await file.text();
      newProcessed = processGpx(content);
      if (newProcessed) {
        const info = this.root.querySelector('#ef-gpx-info')!;
        info.textContent = `✓ ${newProcessed.rawCount} → ${newProcessed.thinnedCount} Punkte · ${newProcessed.distance_km} km`;
        info.classList.remove('hidden');
        this.mapView.addPendingPolyline('edit-preview', newProcessed.gpxPoints, '#333');
        this.mapView.fitTo('edit-preview');
        // Auto-detect trails
        const detected = matchTrailsInTour(newProcessed.rawPoints, this.trails.map(t => ({ name: t.name, rawPoints: [] })));
        detected.forEach(name => {
          const cb = this.root.querySelector<HTMLInputElement>(`input[value="${CSS.escape(name)}"]`);
          if (cb) cb.checked = true;
        });
      }
    });

    this.root.querySelector('#edit-save')!.addEventListener('click', async () => {
      await this.saveTourEdit(t.id, newProcessed);
    });
  }

  private async saveTourEdit(id: string, newGpx: ProcessedGpx | null) {
    const name     = (this.root.querySelector<HTMLInputElement>('#ef-name')!).value.trim();
    const dir      = (this.root.querySelector<HTMLSelectElement>('#ef-dir')!).value;
    const dur      = parseInt((this.root.querySelector<HTMLInputElement>('#ef-dur')!).value) || 0;
    const trailNames = Array.from(this.root.querySelectorAll<HTMLInputElement>('.sm-trail-checks input:checked'))
      .map(cb => cb.value);

    if (!name) { alert('Name darf nicht leer sein.'); return; }

    this.setBusy(true);
    try {
      let gpx_url  = this.editingTour!.gpx_url;
      let gpxPoints = this.editingTour!.gpx_points;
      let stats: Pick<GpxTourRow, 'distance_km' | 'elevation_gain' | 'elevation_loss'> = {
        distance_km: this.editingTour!.distance_km,
        elevation_gain: this.editingTour!.elevation_gain,
        elevation_loss: this.editingTour!.elevation_loss,
      };

      if (newGpx) {
        gpx_url   = await uploadGpx(this.spotId, 'tours', `${name}.gpx`, newGpx.gpxContent, this.jwt);
        gpxPoints = newGpx.gpxPoints;
        stats = { distance_km: newGpx.distance_km, elevation_gain: newGpx.elevation_gain, elevation_loss: newGpx.elevation_loss };
      }

      const updated = await upsertTour({
        id, spot_id: this.spotId, name, direction: dir, duration_minutes: dur,
        trail_names: trailNames, gpx_points: gpxPoints, gpx_url, ...stats,
      }, this.jwt);

      this.tours = this.tours.map(t => t.id === id ? updated : t);
      this.mapView.removeLayer('edit-preview');
      this.mapView.addTourPolyline(updated);
      this.editingTour = null;
      this.renderList();
    } catch (e: any) {
      alert(`Fehler: ${e.message}`);
    } finally {
      this.setBusy(false);
    }
  }

  // ── Spot Details Editor ───────────────────────────────────────────────────

  private openDetailsEditor() {
    const d: SpotDetailsRow = this.spotDetails ?? {
      trail_id: this.spotId,
      status: 'open',
      status_hint: '',
      affected_trail_ids: [],
      access_type: 'free',
      rules: [],
      trail_description: '',
      rain_policy: 'none',
      night_policy: 'none',
    };

    const statusOptions: Array<{ value: SpotStatus; icon: string; label: string; color: string }> = [
      { value: 'open',    icon: 'fa-circle-check',         label: 'Offen',         color: '#2e7d32' },
      { value: 'limited', icon: 'fa-triangle-exclamation', label: 'Eingeschränkt', color: '#e65100' },
      { value: 'closed',  icon: 'fa-ban',                  label: 'Gesperrt',      color: '#c62828' },
      { value: 'unknown', icon: 'fa-circle-question',      label: 'Unbekannt',     color: '#777777' },
    ];

    const statusCards = statusOptions.map(s => `
      <button class="sd-status-card ${d.status === s.value ? 'active' : ''}" data-status="${s.value}" style="--status-color:${s.color}">
        <i class="fas ${s.icon} sd-status-icon"></i>
        <span>${s.label}</span>
      </button>`).join('');

    const notOpen        = d.status !== 'open';
    const hasUntil       = !!d.status_until;
    const statusUntilVal = d.status_until ?? '';
    const affectedIds    = d.affected_trail_ids ?? [];
    const trailChecks    = this.trails.map(t => `
      <label class="sd-check-label">
        <input type="checkbox" class="sd-trail-check" value="${t.id}" ${affectedIds.includes(t.id) ? 'checked' : ''} />
        <span class="sd-trail-check-dot" style="background:${(DIFF_COLOR as Record<string,string>)[t.difficulty] ?? '#888'}"></span>
        ${this.esc(t.name)}
      </label>`).join('');

    const rulesHTML = (d.rules ?? []).map((r, i) => `
      <div class="sd-rule-item" data-rule="${i}">
        <i class="fas fa-grip-vertical sd-rule-grip"></i>
        <textarea class="sd-rule-input" rows="1" placeholder="Regel eingeben…">${this.esc(r)}</textarea>
        <button class="sd-rule-del" data-rule="${i}" title="Entfernen"><i class="fas fa-times"></i></button>
      </div>`).join('');

    const descLen = (d.trail_description ?? '').length;

    this.renderSidebar(`
      <div class="sd-editor">
        <div class="sm-form-header">
          <button class="sm-btn-back" id="sd-cancel"><i class="fas fa-arrow-left"></i></button>
          <h3>Spot-Details</h3>
        </div>

        <div class="sd-section">
          <div class="sd-section-label"><i class="fas fa-circle-half-stroke"></i> Status</div>
          <div class="sd-status-grid sd-status-grid-3" id="sd-status-grid">
            ${statusCards}
          </div>
          <div class="sd-status-sub" id="sd-status-sub" ${notOpen ? '' : 'style="display:none"'}>
            <div id="sd-affected-trails-wrap" ${d.status === 'limited' && this.trails.length > 0 ? '' : 'style="display:none"'}>
              <div class="sd-sub-label"><i class="fas fa-route"></i> Betroffene Trails</div>
              <div class="sd-trail-check-list">
                ${trailChecks || '<span class="sm-muted">Keine Trails vorhanden</span>'}
              </div>
            </div>
            <div class="sd-sub-divider" id="sd-sub-divider" ${d.status === 'limited' && this.trails.length > 0 ? '' : 'style="display:none"'}></div>
            <label class="sd-radio-label">
              <input type="radio" name="status-limit" value="unlimited" ${!hasUntil ? 'checked' : ''} />
              <span>Unbegrenzt</span>
            </label>
            <label class="sd-radio-label">
              <input type="radio" name="status-limit" value="until" ${hasUntil ? 'checked' : ''} />
              <span>Automatisch öffnen am</span>
            </label>
            <input type="date" id="sd-status-until" class="sd-input sd-status-until-input"
              value="${statusUntilVal}" ${hasUntil ? '' : 'style="display:none"'} />
          </div>
        </div>

        <div class="sd-section" id="sd-hint-section" ${notOpen ? '' : 'style="display:none"'}>
          <div class="sd-section-label"><i class="fas fa-comment-dots"></i> Status-Hinweis</div>
          <input id="sd-hint" class="sd-input" type="text" maxlength="120"
            value="${this.esc(d.status_hint ?? '')}"
            placeholder="z.B. Gesperrt bis Ende März wegen Forstarbeiten" />
          <div class="sd-char-hint" id="sd-hint-chars">${(d.status_hint ?? '').length}/120</div>
        </div>

        ${this.accessHTML(d)}

        ${this.closureRulesHTML(d)}

        <div class="sd-section">
          <div class="sd-section-label"><i class="fas fa-list-check"></i> Nutzungsregeln</div>
          <div id="sd-rules-list">${rulesHTML}</div>
          <button class="sd-add-rule-btn" id="sd-add-rule">
            <i class="fas fa-plus"></i> Regel hinzufügen
          </button>
        </div>

        <div class="sd-section">
          <div class="sd-section-label"><i class="fas fa-align-left"></i> Beschreibung</div>
          <textarea id="sd-desc" class="sd-textarea" placeholder="Allgemeine Infos zum Spot…" maxlength="2000">${this.esc(d.trail_description ?? '')}</textarea>
          <div class="sd-char-hint" id="sd-desc-chars">${descLen}/2000</div>
        </div>

        <div class="sd-save-row">
          <button class="sm-btn-secondary" id="sd-cancel2">Abbrechen</button>
          <button class="sm-btn-primary" id="sd-save"><i class="fas fa-save"></i> Speichern</button>
        </div>
      </div>
    `);

    // Back / cancel
    this.root.querySelectorAll('#sd-cancel, #sd-cancel2').forEach(b =>
      b.addEventListener('click', () => this.renderList())
    );

    // Status card toggle
    let currentStatus: SpotStatus = d.status;
    const hintSection  = this.root.querySelector<HTMLElement>('#sd-hint-section')!;
    const statusSub    = this.root.querySelector<HTMLElement>('#sd-status-sub')!;
    const statusUntilInput = this.root.querySelector<HTMLInputElement>('#sd-status-until')!;
    this.root.querySelectorAll<HTMLElement>('.sd-status-card').forEach(card => {
      card.addEventListener('click', () => {
        this.root.querySelectorAll('.sd-status-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        currentStatus = card.dataset.status as SpotStatus;
        const open    = currentStatus === 'open';
        const limited = currentStatus === 'limited';
        hintSection.style.display  = open ? 'none' : '';
        statusSub.style.display    = open ? 'none' : '';
        const affWrap   = this.root.querySelector<HTMLElement>('#sd-affected-trails-wrap');
        const subDivider = this.root.querySelector<HTMLElement>('#sd-sub-divider');
        const hasTrails = this.trails.length > 0;
        if (affWrap)   affWrap.style.display    = limited && hasTrails ? '' : 'none';
        if (subDivider) subDivider.style.display = limited && hasTrails ? '' : 'none';
        if (open) {
          (this.root.querySelector<HTMLInputElement>('[name="status-limit"][value="unlimited"]')!).checked = true;
          statusUntilInput.style.display = 'none';
        }
      });
    });

    // Status-limit radio — show/hide date picker
    this.root.querySelectorAll<HTMLInputElement>('[name="status-limit"]').forEach(r =>
      r.addEventListener('change', () => {
        const isUntil = this.root.querySelector<HTMLInputElement>('[name="status-limit"]:checked')?.value === 'until';
        statusUntilInput.style.display = isUntil ? '' : 'none';
      })
    );

    // Status-hint char count
    const hintInput = this.root.querySelector<HTMLInputElement>('#sd-hint')!;
    const hintChars = this.root.querySelector('#sd-hint-chars')!;
    hintInput.addEventListener('input', () => {
      hintChars.textContent = `${hintInput.value.length}/120`;
    });

    // Description char count
    const descArea = this.root.querySelector<HTMLTextAreaElement>('#sd-desc')!;
    const descChars = this.root.querySelector('#sd-desc-chars')!;
    descArea.addEventListener('input', () => {
      descChars.textContent = `${descArea.value.length}/2000`;
    });

    // Rules — add
    this.root.querySelector('#sd-add-rule')!.addEventListener('click', () => {
      const list = this.root.querySelector('#sd-rules-list')!;
      const idx = list.querySelectorAll('.sd-rule-item').length;
      const div = document.createElement('div');
      div.className = 'sd-rule-item';
      div.dataset.rule = String(idx);
      div.innerHTML = `
        <i class="fas fa-grip-vertical sd-rule-grip"></i>
        <textarea class="sd-rule-input" rows="1" placeholder="Regel eingeben…"></textarea>
        <button class="sd-rule-del" data-rule="${idx}" title="Entfernen"><i class="fas fa-times"></i></button>
      `;
      list.appendChild(div);
      const ta = div.querySelector<HTMLTextAreaElement>('.sd-rule-input')!;
      this.autoGrow(ta);
      ta.focus();
      div.querySelector('.sd-rule-del')!.addEventListener('click', () => div.remove());
    });

    // Auto-grow existing rule textareas
    this.root.querySelectorAll<HTMLTextAreaElement>('.sd-rule-input').forEach(ta => this.autoGrow(ta));

    // Rules — delete existing
    this.root.querySelectorAll('.sd-rule-del').forEach(btn =>
      btn.addEventListener('click', () => (btn.closest('.sd-rule-item') as HTMLElement).remove())
    );

    // Access card toggle
    let currentAccess: AccessType = d.access_type;
    const donationWrap = this.root.querySelector<HTMLElement>('#sd-donation-wrap')!;
    this.root.querySelectorAll<HTMLElement>('.sd-access-card').forEach(card => {
      card.addEventListener('click', () => {
        this.root.querySelectorAll('.sd-access-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        currentAccess = card.dataset.access as AccessType;
        donationWrap.style.display = currentAccess === 'free' ? '' : 'none';
      });
    });

    // Closure rules interactive bindings
    this.bindClosureEvents();

    // Save
    this.root.querySelector('#sd-save')!.addEventListener('click', async () => {
      const rules = Array.from(this.root.querySelectorAll<HTMLTextAreaElement>('.sd-rule-input'))
        .map(i => i.value.trim()).filter(Boolean);
      const limitVal  = this.root.querySelector<HTMLInputElement>('[name="status-limit"]:checked')?.value;
      const status_until = currentStatus !== 'open' && limitVal === 'until'
        ? statusUntilInput.value || undefined
        : undefined;
      const affected_trail_ids = currentStatus === 'limited'
        ? Array.from(this.root.querySelectorAll<HTMLInputElement>('.sd-trail-check:checked')).map(c => c.value)
        : [];
      const donation_url = currentAccess === 'donation'
        ? (this.root.querySelector<HTMLInputElement>('#sd-donation-url')?.value.trim() || undefined)
        : undefined;
      const row: SpotDetailsRow = {
        trail_id: this.spotId,
        status: currentStatus,
        status_until,
        status_hint: hintInput.value.trim(),
        affected_trail_ids,
        access_type: currentAccess,
        donation_url,
        rules,
        trail_description: descArea.value.trim(),
        ...this.readClosureFields(),
      };
      this.setBusy(true);
      try {
        this.spotDetails = await upsertSpotDetails(row, this.jwt);
        this.renderList();
      } catch (e: any) {
        alert(`Fehler: ${e.message}`);
      } finally {
        this.setBusy(false);
      }
    });
  }

  private accessHTML(d: SpotDetailsRow): string {
    const options: Array<{ value: AccessType; icon: string; label: string; desc: string; color: string }> = [
      { value: 'free',       icon: 'fa-unlock',          label: 'Kostenlos',       desc: 'Freier Zugang, Spende freiwillig', color: '#2e7d32' },
      { value: 'paid',       icon: 'fa-money-bill-wave', label: 'Kostenpflichtig', desc: 'Gebühr vor Ort',                  color: '#e65100' },
      { value: 'membership', icon: 'fa-id-card',         label: 'Mitgliedschaft',  desc: 'Vereinsmitgliedschaft erforderlich', color: '#6a1b9a' },
    ];

    const cards = options.map(o => `
      <button class="sd-access-card ${d.access_type === o.value ? 'active' : ''}"
        data-access="${o.value}" style="--access-color:${o.color}" title="${o.desc}">
        <i class="fas ${o.icon} sd-access-icon"></i>
        <span class="sd-access-label">${o.label}</span>
        <span class="sd-access-desc">${o.desc}</span>
      </button>`).join('');

    return `
      <div class="sd-section">
        <div class="sd-section-label"><i class="fas fa-ticket"></i> Zugang & Kosten</div>
        <div class="sd-access-grid sd-access-grid-3">${cards}</div>
        <div id="sd-donation-wrap" ${d.access_type === 'free' ? '' : 'style="display:none"'}>
          <label class="sd-date-label" style="margin-top:6px">Spendenlink (optional)
            <input type="url" id="sd-donation-url" class="sd-input"
              placeholder="https://…"
              value="${this.esc(d.donation_url ?? '')}" />
          </label>
        </div>
      </div>
    `;
  }

  private closureRulesHTML(d: SpotDetailsRow): string {
    const c = d;
    const hasSeasonal = !!(c.seasonal_from || c.seasonal_to);
    const rainAfter   = c.rain_policy === 'after';
    const hasWindow   = !!(c.rain_window_from || c.rain_window_to);
    const nightOffset = c.night_policy === 'offset';

    const radio = (name: string, val: string, cur: string, label: string) =>
      `<label class="sd-radio-label">
        <input type="radio" name="${name}" value="${val}" ${cur === val ? 'checked' : ''} />
        <span>${label}</span>
      </label>`;

    return `
      <div class="sd-section">
        <div class="sd-section-label"><i class="fas fa-leaf"></i> Jährliche Saisonsperre</div>
        <label class="sd-toggle-row">
          <input type="checkbox" id="sd-has-seasonal" ${hasSeasonal ? 'checked' : ''} />
          <span>Jedes Jahr in diesem Zeitraum gesperrt</span>
        </label>
        <div class="sd-sub-block" id="sd-seasonal-dates" ${hasSeasonal ? '' : 'style="display:none"'}>
          <p class="sd-field-hint">Format TT.MM — wiederholt sich automatisch jedes Jahr</p>
          <div class="sd-date-row">
            <label class="sd-date-label">Von
              <input type="text" id="sd-seasonal-from" class="sd-input" maxlength="5"
                placeholder="01.11" value="${this.mmddToDdmm(c.seasonal_from)}" />
            </label>
            <label class="sd-date-label">Bis
              <input type="text" id="sd-seasonal-to" class="sd-input" maxlength="5"
                placeholder="31.03" value="${this.mmddToDdmm(c.seasonal_to)}" />
            </label>
          </div>
        </div>
      </div>

      <div class="sd-section">
        <div class="sd-section-label"><i class="fas fa-cloud-rain"></i> Regensperre</div>
        <div class="sd-radio-group">
          ${radio('rain', 'none',   c.rain_policy, 'Keine Einschränkung')}
          ${radio('rain', 'during', c.rain_policy, 'Gesperrt bei Regen')}
          <label class="sd-radio-label sd-radio-inline">
            <input type="radio" name="rain" value="after" ${rainAfter ? 'checked' : ''} />
            <span>Gesperrt</span>
            <input type="number" id="sd-rain-hours" class="sd-inline-num" min="1" max="96"
              value="${c.rain_closed_hours ?? 24}" ${rainAfter ? '' : 'disabled'} />
            <span>Stunden nach Regen</span>
          </label>
        </div>
        <div class="sd-sub-block" id="sd-rain-window-wrap" ${rainAfter ? '' : 'style="display:none"'}>
          <label class="sd-toggle-row">
            <input type="checkbox" id="sd-has-window" ${hasWindow ? 'checked' : ''} />
            <span>Nur in bestimmtem Jahres&shy;zeitraum (z.B. Frühjahrs&shy;tauwetter)</span>
          </label>
          <div class="sd-sub-block sd-window-dates" id="sd-window-dates" ${hasWindow ? '' : 'style="display:none"'}>
            <p class="sd-field-hint">Format TT.MM — z.B. 01.03 bis 15.04</p>
            <div class="sd-date-row">
              <label class="sd-date-label">Von
                <input type="text" id="sd-rain-from" class="sd-input" maxlength="5"
                  placeholder="01.03" value="${this.mmddToDdmm(c.rain_window_from)}" />
              </label>
              <label class="sd-date-label">Bis
                <input type="text" id="sd-rain-to" class="sd-input" maxlength="5"
                  placeholder="15.04" value="${this.mmddToDdmm(c.rain_window_to)}" />
              </label>
            </div>
          </div>
        </div>
      </div>

      <div class="sd-section">
        <div class="sd-section-label"><i class="fas fa-moon"></i> Nachtsperrung</div>
        <div class="sd-radio-group">
          ${radio('night', 'none',         c.night_policy, 'Keine')}
          ${radio('night', 'dusk_to_dawn', c.night_policy, 'Gesperrt Sonnenuntergang bis Sonnenaufgang')}
          ${radio('night', 'offset',       c.night_policy, 'Mit Versatz')}
        </div>
        <div class="sd-sub-block sd-offset-grid" id="sd-night-offset" ${nightOffset ? '' : 'style="display:none"'}>
          <label class="sd-date-label">Minuten vor Sonnenuntergang
            <input type="number" id="sd-before-dusk" class="sd-input" min="0" max="180"
              value="${c.night_before_dusk_min ?? 60}" />
          </label>
          <label class="sd-date-label">Minuten nach Sonnenaufgang
            <input type="number" id="sd-after-dawn" class="sd-input" min="0" max="180"
              value="${c.night_after_dawn_min ?? 60}" />
          </label>
        </div>
      </div>
    `;
  }

  private bindClosureEvents() {
    const q = <T extends HTMLElement>(sel: string) => this.root.querySelector<T>(sel)!;
    const show = (el: HTMLElement | null, visible: boolean) => { if (el) el.style.display = visible ? '' : 'none'; };

    // Seasonal toggle
    const hasSeasonal = q<HTMLInputElement>('#sd-has-seasonal');
    hasSeasonal.addEventListener('change', () => show(q('#sd-seasonal-dates'), hasSeasonal.checked));

    // Rain policy radios
    const rainRadios = this.root.querySelectorAll<HTMLInputElement>('[name="rain"]');
    const rainHoursInput = q<HTMLInputElement>('#sd-rain-hours');
    const rainWindowWrap = q<HTMLElement>('#sd-rain-window-wrap');
    rainRadios.forEach(r => r.addEventListener('change', () => {
      const isAfter = (this.root.querySelector<HTMLInputElement>('[name="rain"]:checked')?.value === 'after');
      rainHoursInput.disabled = !isAfter;
      show(rainWindowWrap, isAfter);
      if (!isAfter) {
        q<HTMLInputElement>('#sd-has-window').checked = false;
        show(q('#sd-window-dates'), false);
      }
    }));

    // Sensitive window toggle
    const hasWindow = q<HTMLInputElement>('#sd-has-window');
    hasWindow.addEventListener('change', () => show(q('#sd-window-dates'), hasWindow.checked));

    // Night policy radios
    const nightRadios = this.root.querySelectorAll<HTMLInputElement>('[name="night"]');
    nightRadios.forEach(r => r.addEventListener('change', () => {
      const val = this.root.querySelector<HTMLInputElement>('[name="night"]:checked')?.value;
      show(q('#sd-night-offset'), val === 'offset');
    }));
  }

  private readClosureFields(): Partial<SpotDetailsRow> {
    const q = <T extends HTMLInputElement>(sel: string) => this.root.querySelector<T>(sel);
    const val = (sel: string) => q(sel)?.value.trim() ?? '';
    const checked = (sel: string) => (q(sel)?.checked ?? false);
    const rainPolicy  = (this.root.querySelector<HTMLInputElement>('[name="rain"]:checked')?.value  ?? 'none') as RainPolicy;
    const nightPolicy = (this.root.querySelector<HTMLInputElement>('[name="night"]:checked')?.value ?? 'none') as NightPolicy;

    return {
      seasonal_from:         checked('#sd-has-seasonal') ? this.ddmmToMmdd(val('#sd-seasonal-from')) : undefined,
      seasonal_to:           checked('#sd-has-seasonal') ? this.ddmmToMmdd(val('#sd-seasonal-to'))   : undefined,
      rain_policy:           rainPolicy,
      rain_closed_hours:     rainPolicy === 'after' ? parseInt(val('#sd-rain-hours')) || 24 : undefined,
      rain_window_from:      rainPolicy === 'after' && checked('#sd-has-window') ? this.ddmmToMmdd(val('#sd-rain-from')) : undefined,
      rain_window_to:        rainPolicy === 'after' && checked('#sd-has-window') ? this.ddmmToMmdd(val('#sd-rain-to'))   : undefined,
      night_policy:          nightPolicy,
      night_before_dusk_min: nightPolicy === 'offset' ? parseInt(val('#sd-before-dusk')) || 60 : undefined,
      night_after_dawn_min:  nightPolicy === 'offset' ? parseInt(val('#sd-after-dawn'))  || 60 : undefined,
    };
  }

  // "03-01" → "01.03"
  private mmddToDdmm(mmdd?: string): string {
    if (!mmdd) return '';
    const [mm, dd] = mmdd.split('-');
    return dd && mm ? `${dd}.${mm}` : '';
  }

  // "01.03" → "03-01"
  private ddmmToMmdd(ddmm: string): string | undefined {
    const m = ddmm.match(/^(\d{1,2})\.(\d{1,2})$/);
    if (!m) return undefined;
    return `${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  private async confirmDelete(id: string, kind: 'trail' | 'tour') {
    const item = kind === 'trail' ? this.trails.find(t => t.id === id) : this.tours.find(t => t.id === id);
    if (!item) return;
    if (!confirm(`"${item.name}" wirklich löschen?`)) return;
    this.setBusy(true);
    try {
      if (kind === 'trail') {
        await deleteTrail(id, this.jwt);
        this.trails = this.trails.filter(t => t.id !== id);
      } else {
        await deleteTour(id, this.jwt);
        this.tours = this.tours.filter(t => t.id !== id);
      }
      this.mapView.removeLayer(id);
      this.closeElevation();
      this.renderList();
    } catch (e: any) {
      alert(`Fehler: ${e.message}`);
    } finally {
      this.setBusy(false);
    }
  }

  // ── Import flow ───────────────────────────────────────────────────────────

  private openImport(defaultKind: 'trail' | 'tour') {
    this.importing = true;
    this.pending = [];
    this.renderImportZone(defaultKind);
  }

  private renderImportZone(defaultKind: 'trail' | 'tour') {
    this.renderSidebar(`
      <div class="sm-import-view" id="import-view">
        <div class="sm-form-header">
          <button class="sm-btn-back" id="import-cancel"><i class="fas fa-arrow-left"></i></button>
          <h3>GPX importieren</h3>
        </div>

        <div class="sm-dropzone" id="sm-dropzone">
          <i class="fas fa-cloud-upload-alt sm-drop-icon"></i>
          <p>GPX-Dateien hier ablegen</p>
          <label class="sm-btn-secondary sm-drop-browse">
            <i class="fas fa-folder-open"></i> Durchsuchen
            <input type="file" id="sm-file-input" accept=".gpx" multiple hidden />
          </label>
        </div>

        <div id="sm-pending-cards"></div>

        <div class="sm-import-footer hidden" id="import-footer">
          <button class="sm-btn-secondary" id="import-cancel2">Abbrechen</button>
          <button class="sm-btn-primary" id="import-apply">
            <i class="fas fa-check"></i> <span id="apply-label">Übernehmen</span>
          </button>
        </div>
      </div>
    `);

    const drop = this.root.querySelector<HTMLElement>('#sm-dropzone')!;
    const fileInput = this.root.querySelector<HTMLInputElement>('#sm-file-input')!;

    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag-over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('drag-over'));
    drop.addEventListener('drop', e => {
      e.preventDefault();
      drop.classList.remove('drag-over');
      this.handleFiles(Array.from(e.dataTransfer?.files ?? []), defaultKind);
    });
    fileInput.addEventListener('change', () => {
      this.handleFiles(Array.from(fileInput.files ?? []), defaultKind);
      fileInput.value = '';
    });

    this.root.querySelectorAll('#import-cancel, #import-cancel2').forEach(b =>
      b.addEventListener('click', () => { this.pending.forEach(p => this.mapView.removeLayer(p.key)); this.renderList(); })
    );
    this.root.querySelector('#import-apply')!.addEventListener('click', () => this.applyImports());
  }

  private async handleFiles(files: File[], defaultKind: 'trail' | 'tour') {
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith('.gpx')) continue;
      const content = await file.text();
      const processed = processGpx(content);
      if (!processed) continue;

      const key = `pending-${crypto.randomUUID()}`;
      const pending: PendingImport = {
        key,
        filename: file.name,
        kind:     defaultKind,
        processed,
        name:     processed.suggestedName || file.name.replace(/\.gpx$/i, ''),
        difficulty: 'blue',
        direction:  defaultKind === 'trail' ? 'one-way-down' : 'cw',
        trailNames: [],
        autoDetectedTrailNames: [],
      };

      // Auto-detect direction from filename hints
      if (file.name.toLowerCase().includes('tour') || file.name.toLowerCase().includes('runde')) {
        pending.kind = 'tour';
        pending.direction = 'cw';
      }

      // Auto-match trails in tour
      if (pending.kind === 'tour' && this.trails.length > 0) {
        pending.autoDetectedTrailNames = matchTrailsInTour(
          processed.rawPoints,
          this.trails.map(t => ({ name: t.name, rawPoints: [] }))
        );
        pending.trailNames = [...pending.autoDetectedTrailNames];
      }

      this.pending.push(pending);
      const color = pending.kind === 'tour' ? '#333' : DIFF_COLOR[pending.difficulty];
      this.mapView.addPendingPolyline(key, processed.gpxPoints, color);
    }

    this.renderPendingCards();
    if (this.pending.length > 0) this.mapView.fitAll();
  }

  private renderPendingCards() {
    const container = this.root.querySelector('#sm-pending-cards')!;
    container.innerHTML = this.pending.map((p, i) => this.pendingCardHTML(p, i)).join('');

    this.pending.forEach((p, i) => {
      const card = this.root.querySelector<HTMLElement>(`[data-pending="${i}"]`)!;

      card.querySelector<HTMLInputElement>(`#pk-name-${i}`)!.addEventListener('input', e => {
        p.name = (e.target as HTMLInputElement).value;
      });

      const kindBtns = card.querySelectorAll<HTMLElement>('.pk-kind-btn');
      kindBtns.forEach(btn => btn.addEventListener('click', () => {
        p.kind = btn.dataset.kind as 'trail' | 'tour';
        btn.classList.add('active');
        kindBtns.forEach(b => { if (b !== btn) b.classList.remove('active'); });
        // Re-render card to show/hide difficulty field
        const newCard = document.createElement('div');
        newCard.innerHTML = this.pendingCardHTML(p, i);
        card.replaceWith(newCard.firstElementChild!);
        this.bindPendingCardEvents(i);
        const color = p.kind === 'tour' ? '#333' : DIFF_COLOR[p.difficulty];
        this.mapView.updatePendingColor(p.key, color);
      }));

      this.bindPendingCardEvents(i);

      card.querySelector(`[data-action="remove-pending"]`)?.addEventListener('click', () => {
        this.mapView.removeLayer(p.key);
        this.pending.splice(i, 1);
        this.renderPendingCards();
      });
    });

    const footer = this.root.querySelector<HTMLElement>('#import-footer')!;
    const label  = this.root.querySelector<HTMLElement>('#apply-label')!;
    if (this.pending.length > 0) {
      footer.classList.remove('hidden');
      label.textContent = `Übernehmen (${this.pending.length})`;
    } else {
      footer.classList.add('hidden');
    }
  }

  private pendingCardHTML(p: PendingImport, i: number): string {
    const diffOpts = DIFFICULTIES.map(d =>
      `<option value="${d.value}" ${p.difficulty === d.value ? 'selected' : ''}>${d.label}</option>`
    ).join('');

    const trailDirOpts = DIRECTIONS.filter(d => d.value !== 'cw' && d.value !== 'ccw').map(d =>
      `<option value="${d.value}" ${p.direction === d.value ? 'selected' : ''}>${d.label}</option>`
    ).join('');

    const tourDirOpts = [
      { value: 'cw',  label: '↻ Uhrzeigersinn' },
      { value: 'ccw', label: '↺ Gegen Uhrzeiger' },
    ].map(d => `<option value="${d.value}" ${p.direction === d.value ? 'selected' : ''}>${d.label}</option>`).join('');

    const trailChecks = this.trails.map(t => `
      <label class="sm-check-label">
        <input type="checkbox" class="pk-trail-check" value="${this.esc(t.name)}"
          ${p.trailNames.includes(t.name) ? 'checked' : ''}
          ${p.autoDetectedTrailNames.includes(t.name) ? 'data-auto="true"' : ''} />
        ${this.esc(t.name)}${p.autoDetectedTrailNames.includes(t.name) ? ' <span class="sm-badge-auto">auto</span>' : ''}
      </label>`).join('');

    return `
      <div class="sm-pending-card" data-pending="${i}">
        <div class="sm-card-header">
          <span class="sm-card-filename">${this.esc(p.filename)}</span>
          <span class="sm-card-stats">${p.processed.rawCount} → ${p.processed.thinnedCount} Punkte</span>
        </div>

        <div class="pk-kind-toggle">
          <button class="pk-kind-btn ${p.kind === 'trail' ? 'active' : ''}" data-kind="trail">Trail</button>
          <button class="pk-kind-btn ${p.kind === 'tour' ? 'active' : ''}" data-kind="tour">Tour</button>
        </div>

        <label>Name<input id="pk-name-${i}" type="text" value="${this.esc(p.name)}" /></label>

        ${p.kind === 'trail' ? `
          <label>Schwierigkeit<select id="pk-diff-${i}">${diffOpts}</select></label>
          <label>Richtung<select id="pk-dir-${i}">${trailDirOpts}</select></label>
        ` : `
          <label>Richtung<select id="pk-dir-${i}">${tourDirOpts}</select></label>
          ${this.trails.length > 0 ? `
            <div class="sm-trail-checks">
              <span class="sm-label">Enthaltene Trails</span>
              ${trailChecks}
            </div>
          ` : ''}
        `}

        <div class="sm-card-stats-row">
          <span>📍 ${p.processed.distance_km} km</span>
          <span>↑${p.processed.elevation_gain} m</span>
          <span>↓${p.processed.elevation_loss} m</span>
          ${p.processed.duration_minutes ? `<span>⏱ ${p.processed.duration_minutes} min</span>` : ''}
        </div>

        <div class="sm-card-footer">
          <button class="sm-btn-icon sm-btn-danger" data-action="remove-pending"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    `;
  }

  private bindPendingCardEvents(i: number) {
    const p = this.pending[i];
    if (!p) return;
    const card = this.root.querySelector<HTMLElement>(`[data-pending="${i}"]`)!;
    if (!card) return;

    const diffSel = card.querySelector<HTMLSelectElement>(`#pk-diff-${i}`);
    if (diffSel) {
      diffSel.addEventListener('change', () => {
        p.difficulty = diffSel.value as ImbaColor;
        this.mapView.updatePendingColor(p.key, DIFF_COLOR[p.difficulty]);
      });
    }

    const dirSel = card.querySelector<HTMLSelectElement>(`#pk-dir-${i}`);
    if (dirSel) dirSel.addEventListener('change', () => { p.direction = dirSel.value as TrailDirection; });

    card.querySelectorAll<HTMLInputElement>('.pk-trail-check').forEach(cb => {
      cb.addEventListener('change', () => {
        p.trailNames = Array.from(card.querySelectorAll<HTMLInputElement>('.pk-trail-check:checked')).map(c => c.value);
      });
    });
  }

  private async applyImports() {
    if (this.pending.length === 0) return;
    this.setBusy(true);

    const errors: string[] = [];
    for (const p of this.pending) {
      try {
        const name = p.name.trim() || p.filename.replace(/\.gpx$/i, '');
        const gpx_url = await uploadGpx(this.spotId, `${p.kind}s` as 'trails' | 'tours', `${name}.gpx`, p.processed.gpxContent, this.jwt);

        if (p.kind === 'trail') {
          const row = await upsertTrail({
            spot_id: this.spotId, name,
            difficulty: p.difficulty, direction: p.direction,
            distance_km: p.processed.distance_km,
            elevation_gain: p.processed.elevation_gain,
            elevation_loss: p.processed.elevation_loss,
            gpx_points: p.processed.gpxPoints, gpx_url,
          }, this.jwt);
          this.trails.push(row);
          this.mapView.removeLayer(p.key);
          this.mapView.addTrailPolyline(row);
        } else {
          const row = await upsertTour({
            spot_id: this.spotId, name,
            direction: p.direction,
            duration_minutes: p.processed.duration_minutes ?? 0,
            trail_names: p.trailNames,
            distance_km: p.processed.distance_km,
            elevation_gain: p.processed.elevation_gain,
            elevation_loss: p.processed.elevation_loss,
            gpx_points: p.processed.gpxPoints, gpx_url,
          }, this.jwt);
          this.tours.push(row);
          this.mapView.removeLayer(p.key);
          this.mapView.addTourPolyline(row);
        }
      } catch (e: any) {
        errors.push(`${p.name}: ${e.message}`);
      }
    }

    this.setBusy(false);
    this.pending = [];

    if (errors.length) alert(`Fehler bei:\n${errors.join('\n')}`);
    this.renderList();
  }

  // ── Elevation panel ───────────────────────────────────────────────────────

  private closeElevation() {
    this.mapView.resetHighlights();
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  private renderSidebar(html: string) {
    this.root.querySelector('#sm-sidebar')!.innerHTML = html;
  }

  private setTopbar(title: string, backBtn = false) {
    const bar = this.root.querySelector('#sm-topbar')!;
    bar.innerHTML = `
      <a href="/" class="sm-topbar-home" title="Zurück zur Karte">
        <img src="/assets/logo.webp" class="sm-topbar-logo-img" alt="Trailradar" />
      </a>
      <div class="sm-topbar-divider"></div>
      ${backBtn ? '<button class="sm-back-btn" id="sm-back"><i class="fas fa-arrow-left"></i></button>' : ''}
      ${backBtn ? '<button class="sm-help-btn" id="sm-help" title="Hilfe"><i class="fas fa-question-circle"></i></button>' : ''}
      <span class="sm-topbar-title">${this.esc(title)}</span>
      <span class="sm-role-badge">${this.role}</span>
    `;
    if (backBtn) {
      this.root.querySelector('#sm-back')!.addEventListener('click', () => {
        this.mapView.clear();
        this.closeElevation();
        this.renderSpotSelector();
        this.setTopbar('Spot Manager');
      });
      this.root.querySelector('#sm-help')!.addEventListener('click', () => this.openHelpModal());
    }
  }

  private openHelpModal() {
    const overlay = document.createElement('div');
    overlay.className = 'sm-modal-overlay';
    overlay.innerHTML = `
      <div class="sm-modal">
        <div class="sm-modal-header">
          <h2><i class="fas fa-question-circle"></i> Anleitung – Spot Manager</h2>
          <button class="sm-modal-close" id="sm-modal-close"><i class="fas fa-times"></i></button>
        </div>
        <div class="sm-modal-body">
          <div class="sm-help-step">
            <div class="sm-help-step-num">1</div>
            <div class="sm-help-step-content">
              <h3>Trails hochladen</h3>
              <p>Lade zuerst alle Trails des Spots als GPX-Dateien hoch. Klicke auf <strong>+ Trail</strong> und ziehe die Dateien in die Upload-Zone oder wähle sie über den Browser-Dialog aus. Trails und Touren können dabei auch gemischt in einem Schritt importiert werden.</p>
              <div class="sm-help-tip">
                <i class="fas fa-lightbulb"></i>
                <span>Hat ein Trail unterschiedliche Schwierigkeitsgrade auf verschiedenen Abschnitten? Teile die GPX-Datei in mehrere Abschnitte auf. Jeder Abschnitt wird als eigener Trail hochgeladen und bekommt seine eigene Schwierigkeit (grün / blau / rot / schwarz).</span>
              </div>
            </div>
          </div>

          <div class="sm-help-step">
            <div class="sm-help-step-num">2</div>
            <div class="sm-help-step-content">
              <h3>Touren hochladen</h3>
              <p>Sind alle Trails angelegt, können die Touren importiert werden. Klicke auf <strong>+ Tour</strong>. Eine Tour beschreibt eine vollständige Runde oder Strecke und kann mehrere Trails umfassen.</p>
            </div>
          </div>

          <div class="sm-help-step">
            <div class="sm-help-step-num">3</div>
            <div class="sm-help-step-content">
              <h3>Trails einer Tour zuordnen</h3>
              <p>Dieser Schritt ist manuell: Beim Importieren oder Bearbeiten einer Tour kannst du festlegen, welche Trails sie enthält. Die App versucht enthaltene Trails automatisch zu erkennen (erkannte Trails sind mit <span class="sm-badge-auto">auto</span> markiert), die Zuordnung sollte aber immer überprüft und ggf. korrigiert werden.</p>
            </div>
          </div>

          <div class="sm-help-step">
            <div class="sm-help-step-num">✎</div>
            <div class="sm-help-step-content">
              <h3>Umbenennen</h3>
              <p>Trails und Touren können jederzeit über den <i class="fas fa-pen"></i>-Button bearbeitet und umbenannt werden. Beim Bearbeiten lässt sich auch die GPX-Datei ersetzen, ohne den Eintrag neu anlegen zu müssen.</p>
            </div>
          </div>
        </div>
      </div>
    `;
    this.root.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('#sm-modal-close')!.addEventListener('click', () => overlay.remove());
  }

  private setBusy(busy: boolean) {
    ['#import-apply', '#edit-save', '#sd-save'].forEach(sel => {
      const btn = this.root.querySelector<HTMLButtonElement>(sel);
      if (btn) btn.disabled = busy;
    });
  }

  private autoGrow(ta: HTMLTextAreaElement) {
    const resize = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
    ta.addEventListener('input', resize);
    resize();
  }

  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  private shellHTML(): string {
    return `
      <div class="sm-shell">
        <div class="sm-topbar" id="sm-topbar"></div>
        <div class="sm-body">
          <aside class="sm-sidebar" id="sm-sidebar"></aside>
          <div class="sm-map-pane">
            <div id="sm-map"></div>
          </div>
        </div>
      </div>
    `;
  }
}

