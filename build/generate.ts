import fs from "fs/promises";
import path from "path";
import { regions, Region } from "./region";

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

  for (const [slug, region] of Object.entries(regions)) {
    await generateRegionPage(template, slug, region);
  }
}

main().catch(err => {
  console.error("❌ Build failed", err);
  process.exit(1);
});
