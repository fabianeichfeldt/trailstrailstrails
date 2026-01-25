import fs from "fs/promises";
import path from "path";
import { regions, Region } from "./region";
import {Trail, TrailDetails } from "./trail";

const DIST_DIR = path.resolve("dist");
const TEMPLATE_FILE = path.join(DIST_DIR, "index.html");
const TRAILS_DIR = path.join(DIST_DIR, "trails");

function capitalizeFirstLetter(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function applyRegionSEO(html: string, slug: string, region: Region): string {
  const regionTitle =
    region.pronom || "in und um " + capitalizeFirstLetter(slug);

  const title =
    `<title>Finde offizielle MTB Trails ${regionTitle}</title>`;

  const description =
    `<meta name="description" content="Finde offizielle Mountainbike Trails ${regionTitle}. Community-basiert und aktuell">`;

  return html
    .replace(/<h1[^>]*>[\s\S]*?<\/h1>/i, `<h1>Trailradar - ${regionTitle}</h1>`)
    .replace(/<title>.*<\/title>/, title)
    .replace(/<meta name="description"[^>]*>/, description)
    .replace(
      /<meta property="og:url"[^>]*>/,
      `<meta property="og:url" content="https://trailradar.org/trails/${slug}/">`
    )
    .replace(
      /<link rel="canonical"[^>]*>/,
      `<link rel="canonical" href="https://trailradar.org/trails/${slug}/">`
    );
}

function applyRegionDescription(html: string, region: Region): string {
  if (!region.descr) return html;

  return html.replace(
    /<section class="seo-text">.*?<h2/s,
    `<section class="seo-text">
      <h2 class="seo-title">
        Entdecke offizielle MTB Trails ${region.pronom}
      </h2>
      <p>${region.descr}</p>
      <h2`
  );
}

async function generateTrailPage(
  template: string,
  trail: TrailDetails
) {
  const slug = trail.trail_id;

  let html = template;
  html = applyTrailSEO(html, slug, trail);

  const outDir = path.join(TRAILS_DIR, slug);
  const outFile = path.join(outDir, "index.html");

  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(outFile, html, "utf8");

  console.log("🚵 Generated trail", `/trails/${slug}/`);
}

async function fetchAllTrails(): Promise<TrailDetails[]> {
  const res = await fetch("https://ixafegmxkadbzhxmepsd.supabase.co/rest/v1/trail_details?select=*", {
    headers: {
      Authorization: `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}`,
      apikey: `${process.env.VITE_SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch trails: ${res.status}`);
  }

  const details = (await res.json()) as TrailDetails[];

  const res_trails = await fetch("https://ixafegmxkadbzhxmepsd.supabase.co/rest/v1/trails?select=*", {
    headers: {
      Authorization: `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}`,
      apikey: `${process.env.VITE_SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
  });

  if (!res_trails.ok) {
    throw new Error(`Failed to fetch trails: ${res_trails.status}`);
  }

  const trails = (await res_trails.json()) as Trail[];

  return details.map(trail => {
    const t = trails.find(t => t.id === trail.trail_id);
    if (!t) return trail;

    trail.name = t.name;
    trail.latitude = t.latitude;
    trail.longitude = t.longitude;
    return trail;
  })
}


function applyTrailSEO(html: string, slug: string, trail: TrailDetails) {
  const title = `<title>Trailradar - ${trail.name}</title>`;

  const description =
    trail.trail_description ||
    (trail.rules || []).join(", ").slice(0, 160);

  return html
    .replace(/<h1>.*<\/h1>/, `<h1>Trailradar - ${trail.name}</h1>`)
    .replace(/<title>.*<\/title>/, title)
    .replace(
      "</head>",
      `
<script type="application/ld+json">
[{
  "@context":"https://schema.org",
  "@type":"Place",
  "name":"${trail.name}",
  "description":"${description}",
  "geo":{
    "@type":"GeoCoordinates",
    "latitude":${trail.latitude},
    "longitude":${trail.longitude}
  },
  "url":"https://trailradar.org/trails/${slug}/"
}]
</script>
<link rel="canonical" href="https://trailradar.org/trails/${slug}/">
</head>`
    )
    .replace(
      /<h2 class="seo-title">[\s\S]*?<\/h2>/s,
      `<h2 class="seo-title">${trail.name}</h2>`
    )
    .replace(
      /<p class="seo-text">[\s\S]*?<\/p>/s,
      `<p>${description}</p>`
    );
}


async function generateRegionPage(
  template: string,
  slug: string,
  region: Region
) {
  let html = template;

  html = applyRegionSEO(html, slug, region);
  html = applyRegionDescription(html, region);

  const outDir = path.join(TRAILS_DIR, slug);
  const outFile = path.join(outDir, "index.html");

  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(outFile, html, "utf8");

  console.log("✅ Generated", `/trails/${slug}/`);
}

async function main() {
  const template = await fs.readFile(TEMPLATE_FILE, "utf8");
  await fs.mkdir(TRAILS_DIR, { recursive: true });

  console.log("🌍 Generating region pages...");
  for (const [slug, region] of Object.entries(regions)) {
    await generateRegionPage(template, slug, region);
  }

  console.log("📡 Fetching trails...");
  const trails = await fetchAllTrails();

  console.log(`🚴 Generating ${trails.length} trail pages...`);
  for (const trail of trails) {
    await generateTrailPage(template, trail);
  }

  console.log("✅ All pages generated");
}


main().catch(err => {
  console.error("❌ Build failed", err);
  process.exit(1);
});
