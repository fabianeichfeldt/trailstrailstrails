import { ref, nextTick, watch, onUnmounted, type Ref, type ShallowRef } from 'vue';
import { processGpx, processSegment, DIFF_COLOR } from '../../src/spot_manager/GpxProcessor';
import type { ProcessedGpx } from '../../src/spot_manager/GpxProcessor';
import { uploadGpx, upsertTrail, upsertTour } from '../../src/spot_manager/Api';
import type { GpxTrailRow, GpxTourRow } from '../../src/spot_manager/Api';
import type { MapViewLike } from '../../src/spot_manager/MapView';
import {
  drawScrubberCanvas,
  computeSmoothedAlts,
  handleXPosition,
  indexAtCanvasX,
} from '../../src/spot_manager/ScrubberCanvas';
import type { ImbaColor } from '../../src/types/MtbTypes';

export interface PendingSegment {
  key: string;
  name: string;
  difficulty: ImbaColor;
  direction: string;
  startIdx: number;
  endIdx: number;
  distance_km: number;
}

interface Options {
  mapView: ShallowRef<MapViewLike | null>;
  spotId: Ref<string>;
  trails: Ref<GpxTrailRow[]>;
  tours: Ref<GpxTourRow[]>;
  getToken: () => Promise<string>;
  onSegmentFileLoaded: () => void;   // called when GPX parsed → component transitions to editor view
  onSegmentsSaved: () => void;       // called after save → component returns to list view
}

export function useSegmentEditor(opts: Options) {
  const { mapView, spotId, trails, tours, getToken, onSegmentFileLoaded, onSegmentsSaved } = opts;

  // ── State exposed to template ──────────────────────────────────────────────
  const segmentSource    = ref<ProcessedGpx | null>(null);
  const segmentStartIndex = ref(0);
  const segmentEndIndex   = ref(0);
  const segmentName       = ref('');
  const segmentDifficulty = ref<ImbaColor>('blue');
  const segmentDirection  = ref('one-way-down');
  const pendingSegments   = ref<PendingSegment[]>([]);
  const saveAsTour        = ref(false);
  const tourName          = ref('');
  const tourDirection     = ref<'cw' | 'ccw'>('cw');
  const uploadDragOver    = ref(false);
  const scrubberCanvas    = ref<HTMLCanvasElement | null>(null);
  const busy              = ref(false);

  // ── Internal scrubber state ────────────────────────────────────────────────
  const distances    = ref<number[]>([]);
  const totalDistance = ref(0);
  let smoothedAlts: number[] = [];
  let altMin  = 0;
  let altRange = 1;
  let dragging: 'start' | 'end' | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let rafId: number | null = null;

  // ── File loading ───────────────────────────────────────────────────────────

  function startUpload() {
    segmentSource.value  = null;
    pendingSegments.value = [];
    uploadDragOver.value  = false;
  }

  async function onFileDrop(e: DragEvent) {
    uploadDragOver.value = false;
    const file = e.dataTransfer?.files?.[0];
    if (file) await loadFile(file);
  }

  async function onFileInput(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) await loadFile(file);
  }

  async function loadFile(file: File) {
    const content = await file.text();
    const processed = processGpx(content);
    if (!processed) { alert('Ungültige GPX-Datei.'); return; }

    segmentSource.value    = processed;
    segmentStartIndex.value = 0;
    segmentEndIndex.value   = Math.round((processed.rawPoints.length - 1) / 3);
    segmentName.value       = '';
    segmentDifficulty.value = 'blue';
    segmentDirection.value  = 'one-way-down';
    pendingSegments.value   = [];
    saveAsTour.value        = false;
    tourName.value          = processed.suggestedName || '';
    tourDirection.value     = 'cw';

    computeDistances(processed);
    computeAltProfile();
    mapView.value?.showSourceTrack(processed.rawPoints);
    onSegmentFileLoaded();
  }

  // ── Altitude + distance computation ───────────────────────────────────────

  function computeDistances(src: ProcessedGpx) {
    const points = src.rawPoints;
    let total = 0;
    const dists: number[] = [0];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      const dLat = (b.lat - a.lat) * 111000;
      const dLng = (b.lng - a.lng) * 111000 * Math.cos(a.lat * Math.PI / 180);
      total += Math.hypot(dLat, dLng);
      dists.push(total);
    }
    distances.value    = dists;
    totalDistance.value = total;
  }

  function computeAltProfile() {
    if (!segmentSource.value) return;
    const result = computeSmoothedAlts(segmentSource.value.rawPoints, distances.value);
    smoothedAlts = result.smoothedAlts;
    altMin       = result.altMin;
    altRange     = result.altRange;
  }

  // ── Canvas setup and drawing ───────────────────────────────────────────────

  function setupCanvas() {
    const canvas = scrubberCanvas.value;
    if (!canvas) return;
    resizeObserver?.disconnect();
    resizeObserver = new ResizeObserver(() => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        canvas.width  = rect.width;
        canvas.height = rect.height;
        redraw();
      }
    });
    resizeObserver.observe(canvas);
    const rect = canvas.getBoundingClientRect();
    if (rect.width > 0) {
      canvas.width  = rect.width;
      canvas.height = rect.height;
    }
  }

  function redraw() {
    const canvas = scrubberCanvas.value;
    const source = segmentSource.value;
    if (!canvas || !source || distances.value.length === 0) return;

    drawScrubberCanvas({
      canvas,
      points:            source.rawPoints,
      distances:         distances.value,
      totalDistance:     totalDistance.value,
      smoothedAlts,
      altMin,
      altRange,
      startIndex:        segmentStartIndex.value,
      endIndex:          segmentEndIndex.value,
      selectionColor:    DIFF_COLOR[segmentDifficulty.value],
      committedSegments: pendingSegments.value.map(s => ({
        startIdx: s.startIdx,
        endIdx:   s.endIdx,
        color:    DIFF_COLOR[s.difficulty],
      })),
    });
  }

  function scheduleRedraw() {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      redraw();
      syncLiveSlice();
    });
  }

  // ── Map live slice ─────────────────────────────────────────────────────────

  function syncLiveSlice() {
    if (!segmentSource.value) return;
    const slice = segmentSource.value.rawPoints.slice(
      segmentStartIndex.value,
      segmentEndIndex.value + 1,
    );
    mapView.value?.updateLiveSlice(slice, DIFF_COLOR[segmentDifficulty.value]);
  }

  // ── Pointer handling ───────────────────────────────────────────────────────

  function scrubberPointerDown(e: PointerEvent) {
    const canvas = scrubberCanvas.value;
    if (!canvas || !segmentSource.value || distances.value.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const x    = (e.clientX - rect.left) * (canvas.width / rect.width);
    const startX = handleXPosition(distances.value[segmentStartIndex.value], totalDistance.value, canvas.width);
    const endX   = handleXPosition(distances.value[segmentEndIndex.value],   totalDistance.value, canvas.width);
    dragging = Math.abs(x - startX) <= Math.abs(x - endX) ? 'start' : 'end';
    canvas.style.cursor = 'grabbing';
    canvas.setPointerCapture(e.pointerId);
  }

  function scrubberPointerMove(e: PointerEvent) {
    const canvas = scrubberCanvas.value;
    if (!canvas || !segmentSource.value || distances.value.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const rawX = (e.clientX - rect.left) * (canvas.width / rect.width);

    if (!dragging) {
      const startX = handleXPosition(distances.value[segmentStartIndex.value], totalDistance.value, canvas.width);
      const endX   = handleXPosition(distances.value[segmentEndIndex.value],   totalDistance.value, canvas.width);
      canvas.style.cursor = (Math.abs(rawX - startX) <= 16 || Math.abs(rawX - endX) <= 16) ? 'grab' : 'ew-resize';
      return;
    }

    const nearestIndex = indexAtCanvasX(rawX, canvas.width, distances.value, totalDistance.value);
    if (dragging === 'start') {
      segmentStartIndex.value = Math.min(nearestIndex, segmentEndIndex.value - 1);
    } else {
      segmentEndIndex.value = Math.max(nearestIndex, segmentStartIndex.value + 1);
    }
    scheduleRedraw();
  }

  function scrubberPointerUp() {
    dragging = null;
    if (scrubberCanvas.value) scrubberCanvas.value.style.cursor = 'ew-resize';
  }

  function scrubberPointerLeave() {
    if (!dragging && scrubberCanvas.value) scrubberCanvas.value.style.cursor = 'ew-resize';
  }

  // ── Segment actions ────────────────────────────────────────────────────────

  function addSegment() {
    if (!segmentSource.value) return;
    const name = segmentName.value.trim();
    if (!name) { alert('Name eingeben.'); return; }

    const key = `seg-${crypto.randomUUID()}`;
    const distKm = Math.round(
      (distances.value[segmentEndIndex.value] - distances.value[segmentStartIndex.value]) / 100,
    ) / 10;

    pendingSegments.value.push({
      key, name,
      difficulty: segmentDifficulty.value,
      direction:  segmentDirection.value,
      startIdx:   segmentStartIndex.value,
      endIdx:     segmentEndIndex.value,
      distance_km: distKm,
    });

    const slice = segmentSource.value.rawPoints.slice(segmentStartIndex.value, segmentEndIndex.value + 1);
    mapView.value?.addSegmentPolyline(key, slice, DIFF_COLOR[segmentDifficulty.value]);

    // Next segment starts where this one ended
    segmentStartIndex.value = segmentEndIndex.value;
    segmentEndIndex.value   = segmentSource.value.rawPoints.length - 1;
    segmentName.value       = '';
    syncLiveSlice();
  }

  function removeSegment(index: number) {
    const seg = pendingSegments.value[index];
    mapView.value?.removeLayer(seg.key);
    pendingSegments.value.splice(index, 1);
  }

  async function applySegments() {
    if (!segmentSource.value) return;
    if (!pendingSegments.value.length && !saveAsTour.value) return;
    busy.value = true;
    const errors: string[] = [];
    const jwt  = await getToken();
    const savedTrailNames: string[] = [];

    for (const seg of pendingSegments.value) {
      try {
        const result = processSegment(segmentSource.value.rawPoints, seg.startIdx, seg.endIdx);
        if (!result) continue;
        const gpxUrl = await uploadGpx(spotId.value, 'trails', `${seg.name}.gpx`, result.gpxContent, jwt);
        const newTrail = await upsertTrail({
          spot_id: spotId.value, name: seg.name,
          difficulty: seg.difficulty, direction: seg.direction,
          distance_km: result.distance_km, elevation_gain: result.elevation_gain,
          elevation_loss: result.elevation_loss, gpx_points: result.gpxPoints,
          gpx_url: gpxUrl, sort_order: trails.value.length,
        }, jwt);
        trails.value.push(newTrail);
        mapView.value?.removeLayer(seg.key);
        mapView.value?.addTrailPolyline(newTrail);
        savedTrailNames.push(seg.name);
      } catch (e: any) {
        errors.push(`${seg.name}: ${e.message}`);
      }
    }

    if (saveAsTour.value) {
      try {
        const resolvedTourName = tourName.value.trim() || segmentSource.value.suggestedName || 'Tour';
        const gpxUrl = await uploadGpx(
          spotId.value, 'tours', `${resolvedTourName}.gpx`,
          segmentSource.value.gpxContent, jwt,
        );
        const newTour = await upsertTour({
          spot_id: spotId.value, name: resolvedTourName, direction: tourDirection.value,
          duration_minutes: segmentSource.value.duration_minutes ?? 0,
          trail_names: savedTrailNames,
          distance_km: segmentSource.value.distance_km,
          elevation_gain: segmentSource.value.elevation_gain,
          elevation_loss: segmentSource.value.elevation_loss,
          gpx_points: segmentSource.value.gpxPoints,
          gpx_url: gpxUrl, sort_order: tours.value.length,
        }, jwt);
        tours.value.push(newTour);
        mapView.value?.addTourPolyline(newTour);
      } catch (e: any) {
        errors.push(`Tour: ${e.message}`);
      }
    }

    busy.value = false;
    if (errors.length) alert(`Fehler:\n${errors.join('\n')}`);
    cancel();
    onSegmentsSaved();
  }

  function cancel() {
    for (const seg of pendingSegments.value) mapView.value?.removeLayer(seg.key);
    mapView.value?.clearLiveSlice();
    mapView.value?.clearSourceTrack();
    segmentSource.value    = null;
    pendingSegments.value  = [];
    segmentStartIndex.value = 0;
    segmentEndIndex.value   = 0;
    segmentName.value       = '';
    saveAsTour.value        = false;
    tourName.value          = '';
  }

  // ── Lifecycle hooks called by parent component ─────────────────────────────

  async function onEnterEditorView() {
    await nextTick();
    setupCanvas();
    redraw();
    syncLiveSlice();
    mapView.value?.invalidate();
  }

  function onLeaveEditorView() {
    resizeObserver?.disconnect();
    resizeObserver = null;
    mapView.value?.invalidate();
  }

  // ── Watchers ───────────────────────────────────────────────────────────────

  watch(segmentDifficulty, () => {
    syncLiveSlice();
    redraw();
  });

  watch(pendingSegments, () => nextTick(() => redraw()), { deep: true });

  onUnmounted(() => {
    resizeObserver?.disconnect();
    if (rafId !== null) cancelAnimationFrame(rafId);
  });

  return {
    // State
    segmentSource,
    segmentStartIndex,
    segmentEndIndex,
    segmentName,
    segmentDifficulty,
    segmentDirection,
    pendingSegments,
    saveAsTour,
    tourName,
    tourDirection,
    uploadDragOver,
    scrubberCanvas,
    busy,

    // File input handlers
    onFileDrop,
    onFileInput,

    // Canvas pointer handlers
    scrubberPointerDown,
    scrubberPointerMove,
    scrubberPointerUp,
    scrubberPointerLeave,

    // Segment actions
    addSegment,
    removeSegment,
    applySegments,
    cancel,
    startUpload,

    // Parent lifecycle hooks
    onEnterEditorView,
    onLeaveEditorView,
  };
}
