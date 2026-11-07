import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent, h, markRaw, ref, shallowRef, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { useSegmentEditor } from './useSegmentEditor';
import { DIFF_COLOR } from '../../spot_manager/GpxProcessor';
import { fetchDemElevations } from '../../spot_manager/DemElevation';
import { uploadGpx, upsertTrail, upsertTour } from '../../spot_manager/Api';
import { drawScrubberCanvas } from '../../spot_manager/ScrubberCanvas';
import type { MapViewLike } from '../../spot_manager/MapView';

// Network boundaries only: DEM lookup and the Supabase REST/storage calls.
vi.mock('../../spot_manager/DemElevation', () => ({ fetchDemElevations: vi.fn() }));
vi.mock('../../spot_manager/Api', () => ({
  uploadGpx: vi.fn(),
  upsertTrail: vi.fn(),
  upsertTour: vi.fn(),
}));
vi.mock('../../spot_manager/ScrubberCanvas', async (orig) => ({
  ...(await orig<typeof import('../../spot_manager/ScrubberCanvas')>()),
  drawScrubberCanvas: vi.fn(),
}));

const JWT = 'jwt-1';
const N = 31;
// 31 points walking north, ~111 m apart (lat step 0.001, constant lng) -> total ~3330 m.
const GPX = `<?xml version="1.0"?><gpx><trk><name>Big Loop</name><trkseg>
${Array.from({ length: N }, (_, i) =>
  `<trkpt lat="${(48 + i * 0.001).toFixed(6)}" lon="11.500000"><ele>${500 + (i % 5) * 10}</ele></trkpt>`).join('\n')}
</trkseg></trk></gpx>`;
const NO_NAME_GPX = GPX.replace('<name>Big Loop</name>', '');

const file = (content: string) => ({ text: async () => content }) as unknown as File;

function makeMapView() {
  return {
    showSourceTrack: vi.fn(), clearSourceTrack: vi.fn(),
    updateLiveSlice: vi.fn(), clearLiveSlice: vi.fn(),
    addSegmentPolyline: vi.fn(), removeLayer: vi.fn(),
    addTrailPolyline: vi.fn(), addTourPolyline: vi.fn(),
    invalidate: vi.fn(),
  };
}

// Canvas 400px wide drawn at 800 css px starting at x=20 -> css->canvas scale 0.5.
function makeCanvas() {
  const c: any = {
    width: 400, height: 100,
    style: { cursor: '' },
    getBoundingClientRect: vi.fn(() => ({ left: 20, top: 0, width: 800, height: 200 })),
    setPointerCapture: vi.fn(),
  };
  return markRaw(c);
}
// Canvas x of a handle on point i (PAD.left 38, chart width 344, uniform spacing).
const xOf = (i: number) => 38 + (i / 30) * 344;
// Drag target slightly past index i: the index lookup floors on distance, so exact x is float-fragile.
const at = (i: number) => xOf(i) + 1;
const clientX = (canvasX: number) => 20 + canvasX * 2;
const ptr = (canvasX: number) => ({ clientX: clientX(canvasX), pointerId: 7 }) as PointerEvent;

let rafCbs: Array<() => void>;
let roCb: (() => void) | null;
let roInstances: Array<{ observe: any; disconnect: any }>;

function setup() {
  const mv = makeMapView();
  const mapView = shallowRef<MapViewLike | null>(mv as unknown as MapViewLike);
  const trails = ref<any[]>([{ id: 't0' }]);
  const tours = ref<any[]>([]);
  const onSegmentFileLoaded = vi.fn();
  const onSegmentsSaved = vi.fn();
  const getToken = vi.fn(async () => JWT);
  let api!: ReturnType<typeof useSegmentEditor>;
  const wrapper = mount(defineComponent({
    setup() {
      api = useSegmentEditor({
        mapView, spotId: ref('spot-1'), trails, tours, getToken,
        onSegmentFileLoaded, onSegmentsSaved,
      });
      return () => h('div');
    },
  }));
  return { api, mv, mapView, trails, tours, onSegmentFileLoaded, onSegmentsSaved, getToken, wrapper };
}

async function loaded(content = GPX) {
  const s = setup();
  await s.api.onFileInput({ target: { files: [file(content)] } } as unknown as Event);
  vi.clearAllMocks();
  return s;
}

beforeEach(() => {
  vi.clearAllMocks();
  rafCbs = []; roCb = null; roInstances = [];
  vi.stubGlobal('alert', vi.fn());
  vi.stubGlobal('requestAnimationFrame', vi.fn((cb: () => void) => { rafCbs.push(cb); return rafCbs.length; }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('ResizeObserver', class {
    observe = vi.fn(); disconnect = vi.fn();
    constructor(cb: () => void) { roCb = cb; roInstances.push(this); }
  });
  let uuid = 0;
  vi.spyOn(crypto, 'randomUUID').mockImplementation(() => `u${++uuid}` as any);
  vi.mocked(fetchDemElevations).mockImplementation(async (ll: any) => ll.map((_: any, i: number) => 1000 + i * 2));
  vi.mocked(uploadGpx).mockResolvedValue('https://storage/x.gpx');
  vi.mocked(upsertTrail).mockImplementation(async (row: any) => ({ id: `new-${row.name}`, ...row }) as any);
  vi.mocked(upsertTour).mockImplementation(async (row: any) => ({ id: `tour-${row.name}`, ...row }) as any);
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('initial state', () => {
  it('exposes defaults', () => {
    const { api } = setup();
    expect(api.segmentSource.value).toBeNull();
    expect(api.segmentStartIndex.value).toBe(0);
    expect(api.segmentEndIndex.value).toBe(0);
    expect(api.segmentName.value).toBe('');
    expect(api.segmentDifficulty.value).toBe('blue');
    expect(api.segmentDirection.value).toBe('one-way-down');
    expect(api.pendingSegments.value).toEqual([]);
    expect(api.saveAsTour.value).toBe(false);
    expect(api.tourName.value).toBe('');
    expect(api.tourDirection.value).toBe('cw');
    expect(api.uploadDragOver.value).toBe(false);
    expect(api.scrubberCanvas.value).toBeNull();
    expect(api.busy.value).toBe(false);
    expect(api.processing.value).toBe(false);
  });
});

describe('file loading', () => {
  it('loads a file from the input, sets state and notifies', async () => {
    const s = setup();
    s.api.segmentName.value = 'old';
    s.api.segmentDifficulty.value = 'red';
    s.api.segmentDirection.value = 'both';
    s.api.saveAsTour.value = true;
    s.api.tourDirection.value = 'ccw';
    s.api.pendingSegments.value = [{ key: 'k' } as any];
    await s.api.onFileInput({ target: { files: [file(GPX)] } } as unknown as Event);
    expect(s.getToken).toHaveBeenCalledTimes(1);
    expect(fetchDemElevations).toHaveBeenCalledWith(expect.any(Array), JWT);
    const src = s.api.segmentSource.value!;
    expect(src.suggestedName).toBe('Big Loop');
    expect(src.rawPoints).toHaveLength(N);
    expect(s.api.segmentStartIndex.value).toBe(0);
    expect(s.api.segmentEndIndex.value).toBe(10); // round(30/3)
    expect(s.api.segmentName.value).toBe('');
    expect(s.api.segmentDifficulty.value).toBe('blue');
    expect(s.api.segmentDirection.value).toBe('one-way-down');
    expect(s.api.pendingSegments.value).toEqual([]);
    expect(s.api.saveAsTour.value).toBe(false);
    expect(s.api.tourName.value).toBe('Big Loop');
    expect(s.api.tourDirection.value).toBe('cw');
    expect(s.mv.showSourceTrack).toHaveBeenCalledWith(src.rawPoints);
    expect(s.onSegmentFileLoaded).toHaveBeenCalledTimes(1);
    expect(s.api.busy.value).toBe(false);
    expect(s.api.processing.value).toBe(false);
  });

  it('rounds the default end index', async () => {
    const s = setup();
    // 5 points -> round(4/3) = 1 ; 6 points -> round(5/3) = 2
    const mk = (n: number) => GPX.replace(/<trkpt[\s\S]*<\/trkseg>/, Array.from({ length: n }, (_, i) =>
      `<trkpt lat="${48 + i * 0.001}" lon="11.5"><ele>1</ele></trkpt>`).join('') + '</trkseg>');
    await s.api.onFileInput({ target: { files: [file(mk(5))] } } as unknown as Event);
    expect(s.api.segmentEndIndex.value).toBe(1);
    await s.api.onFileInput({ target: { files: [file(mk(6))] } } as unknown as Event);
    expect(s.api.segmentEndIndex.value).toBe(2);
  });

  it('uses empty tourName when GPX has no name', async () => {
    const s = await loaded(NO_NAME_GPX);
    expect(s.api.segmentSource.value!.suggestedName).toBe('');
    expect(s.api.tourName.value).toBe('');
  });

  it('works without a map view', async () => {
    const s = setup();
    s.mapView.value = null;
    await s.api.onFileInput({ target: { files: [file(GPX)] } } as unknown as Event);
    expect(s.onSegmentFileLoaded).toHaveBeenCalled();
  });

  it('is busy and processing while the DEM lookup runs, flags cleared afterwards', async () => {
    const s = setup();
    let release!: (v: number[]) => void;
    vi.mocked(fetchDemElevations).mockImplementationOnce(() => new Promise(r => { release = r; }));
    const p = s.api.onFileInput({ target: { files: [file(GPX)] } } as unknown as Event);
    await vi.waitFor(() => expect(s.api.busy.value).toBe(true));
    expect(s.api.processing.value).toBe(true);
    release(Array.from({ length: N }, () => 1));
    await p;
    expect(s.api.busy.value).toBe(false);
    expect(s.api.processing.value).toBe(false);
  });

  it('alerts on an invalid GPX and does not transition', async () => {
    const s = setup();
    await s.api.onFileInput({ target: { files: [file('<gpx></gpx>')] } } as unknown as Event);
    expect(alert).toHaveBeenCalledWith('Ungültige GPX-Datei.');
    expect(s.api.segmentSource.value).toBeNull();
    expect(s.onSegmentFileLoaded).not.toHaveBeenCalled();
    expect(s.api.busy.value).toBe(false);
    expect(s.api.processing.value).toBe(false);
  });

  it('clears flags and rethrows when token retrieval fails', async () => {
    const s = setup();
    s.getToken.mockRejectedValueOnce(new Error('no token'));
    await expect(s.api.onFileInput({ target: { files: [file(GPX)] } } as unknown as Event)).rejects.toThrow('no token');
    expect(s.api.busy.value).toBe(false);
    expect(s.api.processing.value).toBe(false);
  });

  it('ignores an input event without a file', async () => {
    const s = setup();
    await s.api.onFileInput({ target: { files: [] } } as unknown as Event);
    await s.api.onFileInput({ target: { files: undefined } } as unknown as Event);
    expect(s.getToken).not.toHaveBeenCalled();
  });

  it('onFileDrop loads the dropped file and clears the drag-over flag', async () => {
    const s = setup();
    s.api.uploadDragOver.value = true;
    await s.api.onFileDrop({ dataTransfer: { files: [file(GPX)] } } as unknown as DragEvent);
    expect(s.api.uploadDragOver.value).toBe(false);
    expect(s.api.segmentSource.value).not.toBeNull();
  });

  it('onFileDrop without files only clears the flag', async () => {
    const s = setup();
    s.api.uploadDragOver.value = true;
    await s.api.onFileDrop({ dataTransfer: { files: [] } } as unknown as DragEvent);
    await s.api.onFileDrop({ dataTransfer: null } as unknown as DragEvent);
    await s.api.onFileDrop({ dataTransfer: {} } as unknown as DragEvent);
    expect(s.api.uploadDragOver.value).toBe(false);
    expect(s.getToken).not.toHaveBeenCalled();
  });

  it('startUpload resets source, pending segments and drag flag', async () => {
    const s = await loaded();
    s.api.pendingSegments.value = [{ key: 'k' } as any];
    s.api.uploadDragOver.value = true;
    s.api.startUpload();
    expect(s.api.segmentSource.value).toBeNull();
    expect(s.api.pendingSegments.value).toEqual([]);
    expect(s.api.uploadDragOver.value).toBe(false);
  });
});

describe('addSegment / removeSegment', () => {
  it('alerts when the name is empty or blank and adds nothing', async () => {
    const s = await loaded();
    s.api.segmentName.value = '   ';
    s.api.addSegment();
    expect(alert).toHaveBeenCalledWith('Name eingeben.');
    expect(s.api.pendingSegments.value).toEqual([]);
    expect(s.mv.addSegmentPolyline).not.toHaveBeenCalled();
  });

  it('does nothing without a source', () => {
    const s = setup();
    s.api.segmentName.value = 'x';
    s.api.addSegment();
    expect(alert).not.toHaveBeenCalled();
    expect(s.api.pendingSegments.value).toEqual([]);
  });

  it('adds a trimmed segment with distance, colors, polyline and advances the selection', async () => {
    const s = await loaded();
    s.api.segmentName.value = '  Flow  ';
    s.api.segmentDifficulty.value = 'red';
    s.api.segmentDirection.value = 'both';
    s.api.segmentStartIndex.value = 2;
    s.api.segmentEndIndex.value = 12;
    vi.clearAllMocks();
    s.api.addSegment();
    const src = s.api.segmentSource.value!;
    // 10 steps * ~111.0 m = ~1110 m -> 1.1 km
    expect(s.api.pendingSegments.value).toEqual([{
      key: 'seg-u1', name: 'Flow', difficulty: 'red', direction: 'both',
      startIdx: 2, endIdx: 12, distance_km: 1.1,
    }]);
    expect(s.mv.addSegmentPolyline).toHaveBeenCalledWith('seg-u1', src.rawPoints.slice(2, 13), DIFF_COLOR.red);
    expect(s.api.segmentStartIndex.value).toBe(12);
    expect(s.api.segmentEndIndex.value).toBe(N - 1);
    expect(s.api.segmentName.value).toBe('');
    expect(s.mv.updateLiveSlice).toHaveBeenCalledWith(src.rawPoints.slice(12, N), DIFF_COLOR.red);
  });

  it('rounds the distance to one decimal', async () => {
    const s = await loaded();
    s.api.segmentName.value = 'a';
    s.api.segmentStartIndex.value = 0;
    s.api.segmentEndIndex.value = 30; // ~3330 m
    s.api.addSegment();
    expect(s.api.pendingSegments.value[0].distance_km).toBe(3.3);
    s.api.segmentName.value = 'b';
    s.api.segmentStartIndex.value = 0;
    s.api.segmentEndIndex.value = 5; // ~555 m -> 0.6
    s.api.addSegment();
    expect(s.api.pendingSegments.value[1].distance_km).toBe(0.6);
  });

  it('works without a map view', async () => {
    const s = await loaded();
    s.mapView.value = null;
    s.api.segmentName.value = 'a';
    s.api.addSegment();
    expect(s.api.pendingSegments.value).toHaveLength(1);
  });

  it('removeSegment drops the layer and the right entry', async () => {
    const s = await loaded();
    for (const n of ['a', 'b', 'c']) { s.api.segmentName.value = n; s.api.addSegment(); }
    s.api.removeSegment(1);
    expect(s.mv.removeLayer).toHaveBeenCalledTimes(1);
    expect(s.mv.removeLayer).toHaveBeenCalledWith('seg-u2');
    expect(s.api.pendingSegments.value.map(x => x.name)).toEqual(['a', 'c']);
  });

  it('removeSegment works without a map view', async () => {
    const s = await loaded();
    s.api.segmentName.value = 'a'; s.api.addSegment();
    s.mapView.value = null;
    s.api.removeSegment(0);
    expect(s.api.pendingSegments.value).toEqual([]);
  });
});

describe('scrubber pointer handling', () => {
  async function withCanvas() {
    const s = await loaded();
    const canvas = makeCanvas();
    s.api.scrubberCanvas.value = canvas;
    s.api.segmentStartIndex.value = 5;
    s.api.segmentEndIndex.value = 20;
    return { s, canvas };
  }

  it('picks the nearest handle on pointer down and captures the pointer', async () => {
    const { s, canvas } = await withCanvas();
    s.api.scrubberPointerDown(ptr(xOf(5) + 3));
    expect(canvas.style.cursor).toBe('grabbing');
    expect(canvas.setPointerCapture).toHaveBeenCalledWith(7);
    // dragging start: move far right -> clamped to end-1
    s.api.scrubberPointerMove(ptr(at(28)));
    expect(s.api.segmentStartIndex.value).toBe(19);
    expect(s.api.segmentEndIndex.value).toBe(20);
  });

  it('drags the end handle and clamps to start+1', async () => {
    const { s } = await withCanvas();
    s.api.scrubberPointerDown(ptr(xOf(20) + 3));
    s.api.scrubberPointerMove(ptr(at(15)));
    expect(s.api.segmentEndIndex.value).toBe(15);
    expect(s.api.segmentStartIndex.value).toBe(5);
    s.api.scrubberPointerMove(ptr(at(1)));
    expect(s.api.segmentEndIndex.value).toBe(6);
  });

  it('start handle follows the pointer to the nearest index', async () => {
    const { s } = await withCanvas();
    s.api.scrubberPointerDown(ptr(xOf(5)));
    s.api.scrubberPointerMove(ptr(at(9)));
    expect(s.api.segmentStartIndex.value).toBe(9);
  });

  it('equidistant press prefers the start handle', async () => {
    const { s } = await withCanvas();
    s.api.scrubberPointerDown(ptr((xOf(5) + xOf(20)) / 2));
    s.api.scrubberPointerMove(ptr(at(8)));
    expect(s.api.segmentStartIndex.value).toBe(8);
    expect(s.api.segmentEndIndex.value).toBe(20);
  });

  it('schedules exactly one redraw frame per burst and syncs the live slice in it', async () => {
    const { s } = await withCanvas();
    s.api.scrubberPointerDown(ptr(xOf(20)));
    s.api.scrubberPointerMove(ptr(at(18)));
    s.api.scrubberPointerMove(ptr(at(17)));
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    vi.mocked(drawScrubberCanvas).mockClear();
    s.mv.updateLiveSlice.mockClear();
    rafCbs.shift()!();
    expect(drawScrubberCanvas).toHaveBeenCalledTimes(1);
    expect(s.mv.updateLiveSlice).toHaveBeenCalledWith(
      s.api.segmentSource.value!.rawPoints.slice(5, 18), DIFF_COLOR.blue);
    // a new frame can be scheduled afterwards
    s.api.scrubberPointerMove(ptr(at(16)));
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
  });

  it('hover sets grab near a handle (<=16px) and ew-resize elsewhere', async () => {
    const { s, canvas } = await withCanvas();
    s.api.scrubberPointerMove(ptr(xOf(5) + 15.5));
    expect(canvas.style.cursor).toBe('grab');
    s.api.scrubberPointerMove(ptr(xOf(5) + 16.5));
    expect(canvas.style.cursor).toBe('ew-resize');
    s.api.scrubberPointerMove(ptr(xOf(20) - 15.5));
    expect(canvas.style.cursor).toBe('grab');
    s.api.scrubberPointerMove(ptr(xOf(20) - 17));
    expect(canvas.style.cursor).toBe('ew-resize');
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(s.api.segmentStartIndex.value).toBe(5);
  });

  it('pointer up ends the drag and resets the cursor', async () => {
    const { s, canvas } = await withCanvas();
    s.api.scrubberPointerDown(ptr(xOf(20)));
    s.api.scrubberPointerUp();
    expect(canvas.style.cursor).toBe('ew-resize');
    s.api.scrubberPointerMove(ptr(at(10)));
    expect(s.api.segmentEndIndex.value).toBe(20);
  });

  it('pointer up without a canvas does not throw', () => {
    const s = setup();
    expect(() => s.api.scrubberPointerUp()).not.toThrow();
  });

  it('pointer leave resets the cursor only when not dragging', async () => {
    const { s, canvas } = await withCanvas();
    canvas.style.cursor = 'grab';
    s.api.scrubberPointerDown(ptr(xOf(20)));
    canvas.style.cursor = 'grabbing';
    s.api.scrubberPointerLeave();
    expect(canvas.style.cursor).toBe('grabbing');
    s.api.scrubberPointerUp();
    canvas.style.cursor = 'grab';
    s.api.scrubberPointerLeave();
    expect(canvas.style.cursor).toBe('ew-resize');
  });

  it('pointer leave without a canvas does not throw', () => {
    const s = setup();
    expect(() => s.api.scrubberPointerLeave()).not.toThrow();
  });

  it('ignores pointer events without canvas, source or distances', async () => {
    const s = setup();
    s.api.scrubberPointerDown(ptr(10)); s.api.scrubberPointerMove(ptr(10));
    const canvas = makeCanvas();
    s.api.scrubberCanvas.value = canvas;
    s.api.scrubberPointerDown(ptr(10)); s.api.scrubberPointerMove(ptr(10));
    expect(canvas.setPointerCapture).not.toHaveBeenCalled();
    expect(canvas.style.cursor).toBe('');
    // source but no distances
    s.api.segmentSource.value = { rawPoints: [] } as any;
    s.api.scrubberPointerDown(ptr(10)); s.api.scrubberPointerMove(ptr(10));
    expect(canvas.setPointerCapture).not.toHaveBeenCalled();
    expect(canvas.style.cursor).toBe('');
  });
});

describe('canvas lifecycle and drawing', () => {
  it('onEnterEditorView sizes the canvas, observes it, draws and syncs the map', async () => {
    const s = await loaded();
    const canvas = makeCanvas();
    canvas.getBoundingClientRect.mockReturnValue({ left: 0, top: 0, width: 640, height: 160 });
    s.api.scrubberCanvas.value = canvas;
    s.api.segmentDifficulty.value = 'black';
    await nextTick();
    vi.clearAllMocks();
    await s.api.onEnterEditorView();
    expect(canvas.width).toBe(640);
    expect(canvas.height).toBe(160);
    expect(roInstances).toHaveLength(1);
    expect(roInstances[0].observe).toHaveBeenCalledWith(canvas);
    const call = vi.mocked(drawScrubberCanvas).mock.calls.at(-1)![0];
    const src = s.api.segmentSource.value!;
    expect(call.canvas).toBe(canvas);
    expect(call.points).toEqual(src.rawPoints);
    expect(call.distances).toHaveLength(N);
    expect(call.distances[0]).toBe(0);
    expect(call.distances[1]).toBeCloseTo(111, 0);
    expect(call.totalDistance).toBeCloseTo(3330, -1);
    expect(call.smoothedAlts).toHaveLength(N);
    expect(call.altMin).toBeGreaterThan(0);
    expect(call.altRange).toBeGreaterThan(0);
    expect(call.startIndex).toBe(0);
    expect(call.endIndex).toBe(10);
    expect(call.selectionColor).toBe(DIFF_COLOR.black);
    expect(call.committedSegments).toEqual([]);
    expect(s.mv.updateLiveSlice).toHaveBeenCalledWith(src.rawPoints.slice(0, 11), DIFF_COLOR.black);
    expect(s.mv.invalidate).toHaveBeenCalledTimes(1);
  });

  it('passes committed segments with their own difficulty colors', async () => {
    const s = await loaded();
    s.api.scrubberCanvas.value = makeCanvas();
    s.api.segmentName.value = 'a';
    s.api.segmentDifficulty.value = 'green';
    s.api.segmentStartIndex.value = 1;
    s.api.segmentEndIndex.value = 4;
    s.api.addSegment();
    s.api.segmentDifficulty.value = 'red';
    await nextTick(); await nextTick();
    const call = vi.mocked(drawScrubberCanvas).mock.calls.at(-1)![0];
    expect(call.committedSegments).toEqual([{ startIdx: 1, endIdx: 4, color: DIFF_COLOR.green }]);
    expect(call.selectionColor).toBe(DIFF_COLOR.red);
  });

  it('onEnterEditorView without a canvas does not observe or draw', async () => {
    const s = await loaded();
    await s.api.onEnterEditorView();
    expect(roInstances).toHaveLength(0);
    expect(drawScrubberCanvas).not.toHaveBeenCalled();
    expect(s.mv.invalidate).toHaveBeenCalled();
  });

  it('does not resize a zero-width canvas', async () => {
    const s = await loaded();
    const canvas = makeCanvas();
    canvas.getBoundingClientRect.mockReturnValue({ left: 0, top: 0, width: 0, height: 50 });
    s.api.scrubberCanvas.value = canvas;
    await s.api.onEnterEditorView();
    expect(canvas.width).toBe(400);
    expect(canvas.height).toBe(100);
  });

  it('re-setup disconnects the previous observer', async () => {
    const s = await loaded();
    s.api.scrubberCanvas.value = makeCanvas();
    await s.api.onEnterEditorView();
    await s.api.onEnterEditorView();
    expect(roInstances).toHaveLength(2);
    expect(roInstances[0].disconnect).toHaveBeenCalledTimes(1);
  });

  it('ResizeObserver callback resizes and redraws only for a non-empty rect', async () => {
    const s = await loaded();
    const canvas = makeCanvas();
    s.api.scrubberCanvas.value = canvas;
    await s.api.onEnterEditorView();
    vi.mocked(drawScrubberCanvas).mockClear();

    canvas.getBoundingClientRect.mockReturnValue({ left: 0, top: 0, width: 300, height: 0 });
    roCb!();
    canvas.getBoundingClientRect.mockReturnValue({ left: 0, top: 0, width: 0, height: 90 });
    roCb!();
    expect(drawScrubberCanvas).not.toHaveBeenCalled();

    canvas.getBoundingClientRect.mockReturnValue({ left: 0, top: 0, width: 300, height: 90 });
    roCb!();
    expect(canvas.width).toBe(300);
    expect(canvas.height).toBe(90);
    expect(drawScrubberCanvas).toHaveBeenCalledTimes(1);
  });

  it('does not draw without a source', () => {
    const s = setup();
    s.api.scrubberCanvas.value = makeCanvas();
    s.api.segmentDifficulty.value = 'red';
    return nextTick().then(() => {
      expect(drawScrubberCanvas).not.toHaveBeenCalled();
      expect(s.mv.updateLiveSlice).not.toHaveBeenCalled();
    });
  });

  it('difficulty change syncs the live slice with the new color', async () => {
    const s = await loaded();
    s.api.segmentDifficulty.value = 'double-black';
    await nextTick();
    expect(s.mv.updateLiveSlice).toHaveBeenCalledWith(
      s.api.segmentSource.value!.rawPoints.slice(0, 11), DIFF_COLOR['double-black']);
  });

  it('onLeaveEditorView disconnects the observer and invalidates the map', async () => {
    const s = await loaded();
    s.api.scrubberCanvas.value = makeCanvas();
    await s.api.onEnterEditorView();
    s.mv.invalidate.mockClear();
    s.api.onLeaveEditorView();
    expect(roInstances[0].disconnect).toHaveBeenCalledTimes(1);
    expect(s.mv.invalidate).toHaveBeenCalledTimes(1);
    // second leave must not disconnect again (observer was nulled)
    s.api.onLeaveEditorView();
    expect(roInstances[0].disconnect).toHaveBeenCalledTimes(1);
  });

  it('unmount disconnects the observer and cancels a pending frame', async () => {
    const s = await loaded();
    const canvas = makeCanvas();
    s.api.scrubberCanvas.value = canvas;
    s.api.segmentStartIndex.value = 5;
    s.api.segmentEndIndex.value = 20;
    await s.api.onEnterEditorView();
    s.api.scrubberPointerDown(ptr(xOf(20)));
    s.api.scrubberPointerMove(ptr(at(18)));
    s.wrapper.unmount();
    expect(roInstances[0].disconnect).toHaveBeenCalled();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
  });

  it('unmount without a pending frame does not cancel', async () => {
    const s = await loaded();
    s.wrapper.unmount();
    expect(cancelAnimationFrame).not.toHaveBeenCalled();
  });
});

describe('cancel', () => {
  it('removes pending layers, clears map overlays and resets state', async () => {
    const s = await loaded();
    for (const n of ['a', 'b']) { s.api.segmentName.value = n; s.api.addSegment(); }
    s.api.segmentName.value = 'draft';
    s.api.saveAsTour.value = true;
    s.api.tourName.value = 'T';
    s.api.cancel();
    expect(s.mv.removeLayer.mock.calls).toEqual([['seg-u1'], ['seg-u2']]);
    expect(s.mv.clearLiveSlice).toHaveBeenCalledTimes(1);
    expect(s.mv.clearSourceTrack).toHaveBeenCalledTimes(1);
    expect(s.api.segmentSource.value).toBeNull();
    expect(s.api.pendingSegments.value).toEqual([]);
    expect(s.api.segmentStartIndex.value).toBe(0);
    expect(s.api.segmentEndIndex.value).toBe(0);
    expect(s.api.segmentName.value).toBe('');
    expect(s.api.saveAsTour.value).toBe(false);
    expect(s.api.tourName.value).toBe('');
  });

  it('works without a map view', async () => {
    const s = await loaded();
    s.mapView.value = null;
    expect(() => s.api.cancel()).not.toThrow();
  });
});

describe('applySegments', () => {
  async function withSegments(n = 2) {
    const s = await loaded();
    const names = ['Alpha', 'Beta', 'Gamma'].slice(0, n);
    const diffs = ['green', 'black', 'red'] as const;
    const idx = [[0, 10], [10, 20], [20, 30]];
    names.forEach((name, i) => {
      s.api.segmentName.value = name;
      s.api.segmentDifficulty.value = diffs[i];
      s.api.segmentDirection.value = i ? 'both' : 'one-way-up';
      s.api.segmentStartIndex.value = idx[i][0];
      s.api.segmentEndIndex.value = idx[i][1];
      s.api.addSegment();
    });
    vi.clearAllMocks();
    return s;
  }

  it('does nothing without source', async () => {
    const s = setup();
    await s.api.applySegments();
    expect(s.getToken).not.toHaveBeenCalled();
    expect(s.onSegmentsSaved).not.toHaveBeenCalled();
  });

  it('does nothing without pending segments and no tour', async () => {
    const s = await loaded();
    await s.api.applySegments();
    expect(s.getToken).not.toHaveBeenCalled();
    expect(uploadGpx).not.toHaveBeenCalled();
    expect(s.onSegmentsSaved).not.toHaveBeenCalled();
    expect(s.api.busy.value).toBe(false);
  });

  it('saves each pending segment as a trail with exact payloads', async () => {
    const s = await withSegments(2);
    const p = s.api.applySegments();
    await vi.waitFor(() => expect(s.api.busy.value).toBe(true));
    await p;

    expect(uploadGpx).toHaveBeenCalledTimes(2);
    const [spot, kind, fname, content, jwt] = vi.mocked(uploadGpx).mock.calls[0];
    expect([spot, kind, fname, jwt]).toEqual(['spot-1', 'trails', 'Alpha.gpx', JWT]);
    expect(content).toContain('<trkpt');
    expect(content).toContain('Alpha');
    expect(vi.mocked(uploadGpx).mock.calls[1].slice(0, 3)).toEqual(['spot-1', 'trails', 'Beta.gpx']);

    expect(upsertTrail).toHaveBeenCalledTimes(2);
    const [row0, jwt0] = vi.mocked(upsertTrail).mock.calls[0];
    expect(jwt0).toBe(JWT);
    expect(row0).toMatchObject({
      spot_id: 'spot-1', name: 'Alpha', difficulty: 'green', direction: 'one-way-up',
      gpx_url: 'https://storage/x.gpx', sort_order: 1,
    });
    expect(row0.distance_km).toBeGreaterThan(0.9);
    expect(row0.distance_km).toBeLessThan(1.3);
    expect(typeof row0.elevation_gain).toBe('number');
    expect(typeof row0.elevation_loss).toBe('number');
    expect(Array.isArray(row0.gpx_points)).toBe(true);
    expect(row0.gpx_points!.length).toBeGreaterThan(1);
    const row1 = vi.mocked(upsertTrail).mock.calls[1][0];
    expect(row1).toMatchObject({ name: 'Beta', difficulty: 'black', direction: 'both', sort_order: 2 });

    expect(s.trails.value.map(t => t.name)).toEqual([undefined, 'Alpha', 'Beta']);
    expect(s.mv.removeLayer.mock.calls.filter(c => c[0].startsWith('seg-')).map(c => c[0]).slice(0, 2))
      .toEqual(['seg-u1', 'seg-u2']);
    expect(s.mv.addTrailPolyline).toHaveBeenCalledTimes(2);
    expect(s.mv.addTrailPolyline).toHaveBeenNthCalledWith(1, expect.objectContaining({ id: 'new-Alpha' }));
    expect(uploadGpx).toHaveBeenCalledTimes(2);
    expect(upsertTour).not.toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
    expect(s.getToken).toHaveBeenCalledTimes(1);

    // finished: busy cleared, editor cancelled, parent notified
    expect(s.api.busy.value).toBe(false);
    expect(s.api.segmentSource.value).toBeNull();
    expect(s.api.pendingSegments.value).toEqual([]);
    expect(s.mv.clearLiveSlice).toHaveBeenCalled();
    expect(s.mv.clearSourceTrack).toHaveBeenCalled();
    expect(s.onSegmentsSaved).toHaveBeenCalledTimes(1);
  });

  it('skips a segment whose processing returns null', async () => {
    const s = await withSegments(1);
    s.api.pendingSegments.value[0].startIdx = 99;
    s.api.pendingSegments.value[0].endIdx = 120;
    await s.api.applySegments();
    expect(uploadGpx).not.toHaveBeenCalled();
    expect(upsertTrail).not.toHaveBeenCalled();
    expect(s.trails.value).toHaveLength(1);
    expect(s.onSegmentsSaved).toHaveBeenCalledTimes(1);
  });

  it('collects per-segment errors, keeps going, and alerts once', async () => {
    const s = await withSegments(3);
    vi.mocked(upsertTrail)
      .mockRejectedValueOnce(new Error('boom'))
      .mockImplementation(async (row: any) => ({ id: `new-${row.name}`, ...row }) as any);
    vi.mocked(uploadGpx).mockRejectedValueOnce(new Error('nope')).mockResolvedValue('u');
    // first: upload fails (nope); second: upsert fails (boom); third succeeds
    await s.api.applySegments();
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenCalledWith('Fehler:\nAlpha: nope\nBeta: boom');
    expect(s.trails.value.map(t => t.name)).toEqual([undefined, 'Gamma']);
    expect(s.mv.addTrailPolyline).toHaveBeenCalledTimes(1);
    expect(s.api.busy.value).toBe(false);
    expect(s.onSegmentsSaved).toHaveBeenCalledTimes(1);
  });

  it('saves as tour with all fields, using the edited tour name', async () => {
    const s = await withSegments(2);
    s.api.saveAsTour.value = true;
    s.api.tourName.value = '  My Tour  ';
    s.api.tourDirection.value = 'ccw';
    const src = s.api.segmentSource.value!;
    s.tours.value.push({ id: 'old' } as any);
    await s.api.applySegments();

    expect(uploadGpx).toHaveBeenCalledTimes(3);
    const [spot, kind, fname, content, jwt] = vi.mocked(uploadGpx).mock.calls[2];
    expect([spot, kind, fname, jwt]).toEqual(['spot-1', 'tours', 'My Tour.gpx', JWT]);
    expect(content).toContain('My Tour');
    expect(content).toContain('<trk');

    const [row, tjwt] = vi.mocked(upsertTour).mock.calls[0];
    expect(tjwt).toBe(JWT);
    expect(row).toEqual({
      spot_id: 'spot-1', name: 'My Tour', direction: 'ccw',
      duration_minutes: 0,
      trail_names: ['Alpha', 'Beta'],
      distance_km: src.distance_km,
      elevation_gain: src.elevation_gain,
      elevation_loss: src.elevation_loss,
      gpx_points: src.gpxPoints,
      gpx_url: 'https://storage/x.gpx',
      sort_order: 1,
    });
    expect(s.tours.value.map(t => t.id)).toEqual(['old', 'tour-My Tour']);
    expect(s.mv.addTourPolyline).toHaveBeenCalledWith(expect.objectContaining({ id: 'tour-My Tour' }));
    expect(s.onSegmentsSaved).toHaveBeenCalledTimes(1);
  });

  it('saves a tour with no pending segments', async () => {
    const s = await loaded();
    s.api.saveAsTour.value = true;
    await s.api.applySegments();
    expect(upsertTrail).not.toHaveBeenCalled();
    expect(vi.mocked(upsertTour).mock.calls[0][0]).toMatchObject({
      name: 'Big Loop', trail_names: [], direction: 'cw', sort_order: 0,
    });
    expect(vi.mocked(uploadGpx).mock.calls[0].slice(0, 3)).toEqual(['spot-1', 'tours', 'Big Loop.gpx']);
  });

  it('falls back to "Tour" when neither tour name nor suggested name exist', async () => {
    const s = await loaded(NO_NAME_GPX);
    s.api.saveAsTour.value = true;
    s.api.tourName.value = '   ';
    await s.api.applySegments();
    expect(vi.mocked(upsertTour).mock.calls[0][0].name).toBe('Tour');
    expect(vi.mocked(uploadGpx).mock.calls[0][2]).toBe('Tour.gpx');
  });

  it('falls back to the suggested name for a blank tour name', async () => {
    const s = await loaded();
    s.api.saveAsTour.value = true;
    s.api.tourName.value = '';
    await s.api.applySegments();
    expect(vi.mocked(upsertTour).mock.calls[0][0].name).toBe('Big Loop');
  });

  it('only lists successfully saved trails in the tour', async () => {
    const s = await withSegments(2);
    s.api.saveAsTour.value = true;
    vi.mocked(upsertTrail).mockRejectedValueOnce(new Error('x'));
    await s.api.applySegments();
    expect(vi.mocked(upsertTour).mock.calls[0][0].trail_names).toEqual(['Beta']);
  });

  it('reports tour errors with a "Tour:" prefix, still resets and notifies', async () => {
    const s = await withSegments(1);
    s.api.saveAsTour.value = true;
    vi.mocked(upsertTour).mockRejectedValueOnce(new Error('tour fail'));
    await s.api.applySegments();
    expect(alert).toHaveBeenCalledWith('Fehler:\nTour: tour fail');
    expect(s.tours.value).toHaveLength(0);
    expect(s.mv.addTourPolyline).not.toHaveBeenCalled();
    expect(s.api.busy.value).toBe(false);
    expect(s.api.segmentSource.value).toBeNull();
    expect(s.onSegmentsSaved).toHaveBeenCalledTimes(1);
  });

  it('works without a map view', async () => {
    const s = await withSegments(1);
    s.api.saveAsTour.value = true;
    s.mapView.value = null;
    await s.api.applySegments();
    expect(s.trails.value).toHaveLength(2);
    expect(s.tours.value).toHaveLength(1);
  });
});

describe('extra mutation guards', () => {
  it('computes distances with longitude scaled by cos(latitude)', async () => {
    // 0.001 deg lon at lat 60 = 111000*0.001*cos(60deg) = 55.5 m; lat step 0.001 = 111 m
    const gpx = `<gpx><trk><trkseg>
      <trkpt lat="60.000000" lon="10.000000"><ele>1</ele></trkpt>
      <trkpt lat="60.000000" lon="10.001000"><ele>2</ele></trkpt>
      <trkpt lat="60.001000" lon="10.001000"><ele>3</ele></trkpt>
    </trkseg></trk></gpx>`;
    const s = await loaded(gpx);
    s.api.scrubberCanvas.value = makeCanvas();
    await s.api.onEnterEditorView();
    const call = vi.mocked(drawScrubberCanvas).mock.calls.at(-1)![0];
    expect(call.distances[1]).toBeCloseTo(55.5, 1);
    expect(call.distances[2]).toBeCloseTo(166.5, 1);
    expect(call.totalDistance).toBeCloseTo(166.5, 1);
  });

  it('a tied press (both handles on the same point) grabs the start handle', async () => {
    const s = await loaded();
    s.api.scrubberCanvas.value = makeCanvas();
    s.api.segmentStartIndex.value = 5;
    s.api.segmentEndIndex.value = 5;
    s.api.scrubberPointerDown(ptr(xOf(5)));
    s.api.scrubberPointerMove(ptr(at(9)));
    expect(s.api.segmentStartIndex.value).toBe(4); // start clamped to end-1
    expect(s.api.segmentEndIndex.value).toBe(5);
  });

  it('a null processSegment result is skipped silently', async () => {
    const s = await loaded();
    s.api.segmentName.value = 'a';
    s.api.addSegment();
    s.api.pendingSegments.value[0].startIdx = 99;
    s.api.pendingSegments.value[0].endIdx = 120;
    await s.api.applySegments();
    expect(alert).not.toHaveBeenCalled();
  });

  it('saving without a map view raises no errors', async () => {
    const s = await loaded();
    s.api.segmentName.value = 'a';
    s.api.addSegment();
    s.api.saveAsTour.value = true;
    s.mapView.value = null;
    await s.api.applySegments();
    expect(alert).not.toHaveBeenCalled();
    expect(s.trails.value).toHaveLength(2);
    expect(s.tours.value).toHaveLength(1);
  });

  it('enter/leave editor view work without a map view', async () => {
    const s = await loaded();
    s.mapView.value = null;
    s.api.scrubberCanvas.value = makeCanvas();
    await expect(s.api.onEnterEditorView()).resolves.toBeUndefined();
    expect(() => s.api.onLeaveEditorView()).not.toThrow();
  });

  it('difficulty change redraws the scrubber', async () => {
    const s = await loaded();
    s.api.scrubberCanvas.value = makeCanvas();
    s.api.segmentDifficulty.value = 'red';
    await nextTick();
    expect(drawScrubberCanvas).toHaveBeenCalledTimes(1);
  });

  it('mutating a pending segment in place redraws with its new color (deep watch)', async () => {
    const s = await loaded();
    s.api.scrubberCanvas.value = makeCanvas();
    s.api.segmentName.value = 'a';
    s.api.segmentDifficulty.value = 'green';
    s.api.addSegment();
    await nextTick(); await nextTick();
    vi.mocked(drawScrubberCanvas).mockClear();
    s.api.pendingSegments.value[0].difficulty = 'black';
    await nextTick(); await nextTick();
    expect(drawScrubberCanvas).toHaveBeenCalledTimes(1);
    expect(vi.mocked(drawScrubberCanvas).mock.calls[0][0].committedSegments[0].color).toBe(DIFF_COLOR.black);
  });
});
