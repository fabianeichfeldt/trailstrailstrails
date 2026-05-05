#!/usr/bin/env node
/**
 * preprocess-gpx.js
 *
 * Reads GPX files from:
 *   data/{spotId}/trails/*.gpx
 *   data/{spotId}/tours/*.gpx
 *   data/{spotId}_{name}/trails/*.gpx  (name is optional)
 *
 * Per spot, loads optional config.json for difficulty/direction metadata.
 * If config.json is missing, it is generated as a template to fill in.
 *
 * Folder naming: {spotId} or {spotId}_{name} (name and underscore are optional)
 * Note: spotId is a GUID with dashes, so use underscore as separator.
 *
 * Outputs: data/processed.json
 *
 * Usage:
 *   node preprocess-gpx.js [dataDir]
 *   dataDir defaults to ./data
 */

const fs   = require('fs');
const path = require('path');

const DATA_DIR = process.argv[2] || path.join(__dirname, 'data');
const OUT_FILE = path.join(DATA_DIR, 'processed.json');

// ── GPX parser ────────────────────────────────────────────────────────────────

function parseGpx(content) {
  const nameMatch = content.match(/<name>([^<]*)<\/name>/);
  const name = nameMatch ? nameMatch[1].trim() : '';

  const points = [];
  const re = /<trkpt\b([^>]*)>([\s\S]*?)<\/trkpt>/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const latM = m[1].match(/lat="([^"]+)"/);
    const lonM = m[1].match(/lon="([^"]+)"/);
    if (!latM || !lonM) continue;

    const eleM  = m[2].match(/<ele>([^<]+)<\/ele>/);
    const timeM = m[2].match(/<time>([^<]+)<\/time>/);

    points.push({
      lat:  parseFloat(latM[1]),
      lng:  parseFloat(lonM[1]),
      alt:  eleM ? parseFloat(eleM[1]) : 0,
      time: timeM ? new Date(timeM[1]) : null,
    });
  }

  return { name, points };
}

// ── Elevation smoother ────────────────────────────────────────────────────────
// Rolling average over `window` points — kills GPS altitude noise.

function smoothElevation(points, window = 5) {
  const half = Math.floor(window / 2);
  return points.map((p, i) => {
    const s = Math.max(0, i - half);
    const e = Math.min(points.length - 1, i + half);
    let sum = 0;
    for (let j = s; j <= e; j++) sum += points[j].alt;
    return { ...p, alt: Math.round(sum / (e - s + 1)) };
  });
}

// ── Ramer-Douglas-Peucker ─────────────────────────────────────────────────────
// epsilon in meters.  Typical good value for MTB: 4 m.

function perpDistMeters(p, a, b) {
  const cos = Math.cos(a.lat * Math.PI / 180);
  const px = (p.lng - a.lng) * 111000 * cos;
  const py = (p.lat - a.lat) * 111000;
  const dx = (b.lng - a.lng) * 111000 * cos;
  const dy = (b.lat - a.lat) * 111000;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px, py);
  const t  = Math.max(0, Math.min(1, (px * dx + py * dy) / lenSq));
  return Math.hypot(px - t * dx, py - t * dy);
}

function rdp(points, epsilon) {
  if (points.length <= 2) return points;

  let maxD = 0, maxI = 0;
  const last = points.length - 1;
  for (let i = 1; i < last; i++) {
    const d = perpDistMeters(points[i], points[0], points[last]);
    if (d > maxD) { maxD = d; maxI = i; }
  }

  if (maxD > epsilon) {
    const L = rdp(points.slice(0, maxI + 1), epsilon);
    const R = rdp(points.slice(maxI), epsilon);
    return L.slice(0, -1).concat(R);
  }
  return [points[0], points[last]];
}

// ── Stats ─────────────────────────────────────────────────────────────────────

function computeStats(points) {
  let distM = 0, gain = 0, loss = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const dlat = (b.lat - a.lat) * 111000;
    const dlng = (b.lng - a.lng) * 111000 * Math.cos(b.lat * Math.PI / 180);
    distM += Math.hypot(dlat, dlng);
    const dAlt = b.alt - a.alt;
    if (dAlt > 0) gain += dAlt; else loss += -dAlt;
  }

  let durationMinutes = null;
  const t0 = points.find(p => p.time)?.time;
  const tN = [...points].reverse().find(p => p.time)?.time;
  if (t0 && tN) durationMinutes = Math.round((tN - t0) / 60000);

  return {
    distance_km:      Math.round(distM / 100) / 10,
    elevation_gain:   Math.round(gain),
    elevation_loss:   Math.round(loss),
    duration_minutes: durationMinutes,
  };
}

// ── Spatial matching (Fréchet distance) ────────────────────────────────────────
// Finds which individual trails are ridden in a tour by matching GPX segments.

function latLngDistance(p1, p2) {
  const dlat = (p2.lat - p1.lat) * 111000;
  const dlng = (p2.lng - p1.lng) * 111000 * Math.cos(p1.lat * Math.PI / 180);
  return Math.hypot(dlat, dlng);
}

function frechetDistance(curve1, curve2) {
  if (curve1.length === 0 || curve2.length === 0) return Infinity;

  const memo = new Map();
  function fd(i, j) {
    if (i === 0 && j === 0) return latLngDistance(curve1[0], curve2[0]);
    if (i === 0 || j === 0) return Infinity;

    const key = `${i},${j}`;
    if (memo.has(key)) return memo.get(key);

    const dist = Math.max(
      latLngDistance(curve1[i], curve2[j]),
      Math.min(fd(i - 1, j), fd(i, j - 1), fd(i - 1, j - 1))
    );
    memo.set(key, dist);
    return dist;
  }

  return fd(curve1.length - 1, curve2.length - 1);
}

function matchTrailsInTour(tourPoints, trailsByName) {
  const matches = [];
  const maxDistance = 100; // meters — threshold for matching

  // Try to find each trail in the tour by sliding window
  const trailEntries = Object.entries(trailsByName);
  for (let tourStart = 0; tourStart < tourPoints.length; tourStart++) {
    for (const [trailName, trailData] of trailEntries) {
      // Skip trails that are already matched
      if (matches.some(m => m.name === trailName)) continue;

      const trailPts = trailData.points;
      if (trailPts.length < 3) continue;

      // Try windows of increasing size around tourStart
      for (let windowSize = trailPts.length; windowSize <= Math.min(trailPts.length + 20, tourPoints.length - tourStart); windowSize++) {
        if (tourStart + windowSize > tourPoints.length) break;

        const tourWindow = tourPoints.slice(tourStart, tourStart + windowSize);
        const dist = frechetDistance(trailPts, tourWindow);

        if (dist < maxDistance) {
          matches.push({
            name: trailName,
            tourStartIdx: tourStart,
            distance: dist,
            endIdx: tourStart + windowSize,
          });
          break; // Found this trail, move to next
        }
      }
    }
  }

  // Sort by appearance in tour and remove duplicates
  matches.sort((a, b) => a.tourStartIdx - b.tourStartIdx);

  const seen = new Set();
  const unique = matches.filter(m => {
    if (seen.has(m.name)) return false;
    seen.add(m.name);
    return true;
  });

  return unique.map(m => m.name);
}

// ── Process one GPX file ──────────────────────────────────────────────────────

const EPSILON_M = 4;

function processFile(filePath, meta = {}) {
  const content = fs.readFileSync(filePath, 'utf8');
  const { name: gpxName, points: rawPoints } = parseGpx(content);

  if (rawPoints.length === 0) {
    console.warn(`  ⚠  No track points found in ${path.basename(filePath)}`);
    return null;
  }

  const smoothed = smoothElevation(rawPoints);
  const thinned  = rdp(smoothed, EPSILON_M);
  const stats    = computeStats(thinned);

  const gpx_points = thinned.map(p => [
    Math.round(p.lat * 1e6) / 1e6,
    Math.round(p.lng * 1e6) / 1e6,
    p.alt,
  ]);

  console.log(
    `  ✓  ${path.basename(filePath).padEnd(35)}` +
    `${rawPoints.length} → ${thinned.length} pts  ` +
    `${stats.distance_km} km  ↑${stats.elevation_gain}m ↓${stats.elevation_loss}m` +
    (stats.duration_minutes ? `  ${stats.duration_minutes} min` : '')
  );

  return {
    filename:         path.basename(filePath),
    name:             meta.name ?? (gpxName || path.basename(filePath, '.gpx')),
    difficulty:       meta.difficulty ?? null,
    direction:        meta.direction  ?? null,
    trail_names:      meta.trail_names ?? null,   // tours only
    ...stats,
    raw_points:       rawPoints.length,
    thinned_points:   thinned.length,
    gpx_points,
    gpx_content:      content,  // original GPX XML for download
    raw_points_for_matching: rawPoints,  // full resolution for spatial matching
  };
}

// ── Config template helper ────────────────────────────────────────────────────

function buildConfigTemplate(trailFiles, tourFiles) {
  const trails = {};
  for (const f of trailFiles) {
    trails[path.basename(f)] = { difficulty: 'blue', direction: 'one-way-down' };
  }
  const tours = {};
  for (const f of tourFiles) {
    tours[path.basename(f)] = { direction: 'cw', trail_names: [] };
  }
  return { trails, tours };
}

// ── Folder name parsing ──────────────────────────────────────────────────────
// Parses folder names like "uuid" or "uuid_trail-name" into spotId and optional name.
// Uses underscore separator since spotId (GUID) contains dashes.

function parseSpotFolder(folderName) {
  const underscoreIdx = folderName.indexOf('_');
  if (underscoreIdx === -1) {
    return { spotId: folderName, name: undefined };
  }
  return {
    spotId: folderName.substring(0, underscoreIdx),
    name: folderName.substring(underscoreIdx + 1),
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

function readGpxFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.toLowerCase().endsWith('.gpx'))
    .map(f => path.join(dir, f));
}

function main() {
  if (!fs.existsSync(DATA_DIR)) {
    console.error(`Data folder not found: ${DATA_DIR}`);
    process.exit(1);
  }

  const spotFolders = fs.readdirSync(DATA_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => parseSpotFolder(d.name));

  if (spotFolders.length === 0) {
    console.log('No spot folders found in', DATA_DIR);
    return;
  }

  const result = {};

  for (const { spotId, name } of spotFolders) {
    const folderName = name ? `${spotId}_${name}` : spotId;
    const spotDir   = path.join(DATA_DIR, folderName);
    const trailDir  = path.join(spotDir, 'trails');
    const tourDir   = path.join(spotDir, 'tours');
    const configPath = path.join(spotDir, 'config.json');

    const trailFiles = readGpxFiles(trailDir);
    const tourFiles  = readGpxFiles(tourDir);

    // Generate config template if missing
    if (!fs.existsSync(configPath)) {
      const template = buildConfigTemplate(trailFiles, tourFiles);
      fs.writeFileSync(configPath, JSON.stringify(template, null, 2));
      console.log(`\n📝 Generated config template → ${configPath}`);
      console.log('   Fill in difficulty/direction/trail_names, then re-run.\n');
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    const spotLabel = name ? `${spotId} (${name})` : spotId;
    console.log(`\n📍 Spot: ${spotLabel}`);

    const trails = [];
    for (const f of trailFiles) {
      const meta = config.trails?.[path.basename(f)] ?? {};
      const processed = processFile(f, meta);
      if (processed) trails.push(processed);
    }

    const tours = [];
    for (const f of tourFiles) {
      const meta = config.tours?.[path.basename(f)] ?? {};
      const processed = processFile(f, meta);
      if (processed) tours.push(processed);
    }

    // ── Auto-detect trails in tours using spatial matching ──
    if (trails.length > 0 && tours.length > 0) {
      const trailsByName = {};
      for (const t of trails) {
        trailsByName[t.name] = {
          name: t.name,
          points: t.raw_points_for_matching,
        };
      }

      for (const tour of tours) {
        const detectedTrails = matchTrailsInTour(tour.raw_points_for_matching || [], trailsByName);
        if (detectedTrails.length > 0 && (!tour.trail_names || tour.trail_names.length === 0)) {
          tour.trail_names = detectedTrails;
          console.log(`  ✓ Auto-detected trails in "${tour.name}": ${detectedTrails.join(', ')}`);
        }
      }
    }

    // Strip raw_points_for_matching before saving to JSON (keeps file smaller)
    trails.forEach(t => delete t.raw_points_for_matching);
    tours.forEach(t => delete t.raw_points_for_matching);

    result[spotId] = { trails, tours };
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2));
  console.log(`\n✅ Written to ${OUT_FILE}`);
}

main();
