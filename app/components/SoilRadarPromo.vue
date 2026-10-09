<template>
  <section class="soil-promo-outer" aria-labelledby="soil-promo-title" data-testid="soil-promo">
    <div class="soil-promo inner">
      <div class="map" aria-hidden="true">
        <!-- A real radar screenshot, not a mock: the soil clouds and cluster donuts are the pitch. -->
        <img :src="'/assets/soil-radar-preview.webp'" alt="" class="map-img" width="900" height="1041" loading="lazy" data-testid="soil-promo-map">
        <span class="sweep" />
        <span class="osm">© OpenStreetMap-Mitwirkende</span>
      </div>

      <div class="copy">
        <span class="tag">Neu · {{ FEATURES.soil_radar.label }}</span>
        <h2 id="soil-promo-title">Wo fährt's sich heute am besten?</h2>
        <p>
          Der {{ FEATURES.soil_radar.label }} legt den Bodenzustand aller Spots über die Karte – berechnet aus
          Regen der letzten Tage, aktuellem Wetter und Bodenart. So siehst du auf einen Blick, wo gerade
          <strong>Hero Dirt</strong> wartet und wo du im Schlamm stecken bleibst.
        </p>
        <ul class="levels">
          <li v-for="(l, i) in LEVELS" :key="l">
            <span class="dot" :style="{ background: SOIL_PALETTE[i] }" aria-hidden="true" v-html="SOIL_GLYPHS[l]" />
            {{ SOIL_LABELS[l] }}
          </li>
        </ul>
        <NuxtLink to="/map?radar=1" class="promo-cta" data-testid="soil-promo-cta">Boden-Radar ausprobieren →</NuxtLink>
        <p class="fine">
          {{ minPlanName('soil_radar') }}-Funktion<template v-if="promoActive"> – neue Mitglieder testen {{ SIGNUP_PROMO.weeks }} Wochen kostenlos</template>.
          Ohne Konto siehst du eine Beispielansicht.
        </p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { FEATURES, SIGNUP_PROMO, isSignupPromoActive, minPlanName } from '~/entitlements/features'
import { SOIL_GLYPHS, SOIL_LABELS, SOIL_PALETTE } from '~/map/soilBadge'

// Same order as SOIL_PALETTE: dusty → wet.
const LEVELS = ['dusty', 'dry', 'prime', 'damp', 'wet'] as const
const promoActive = isSignupPromoActive()
</script>

<style scoped>
.soil-promo-outer { padding: 2rem 1rem; }
/* Map on the left fades into the navy text panel on the right; stacks map-over-text on phones. */
.soil-promo {
  position: relative;
  max-width: 860px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  overflow: hidden;
  border-radius: 18px;
  background: #1a2035;
  color: #fff;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
}
.map {
  position: relative;
  min-height: 380px;
  overflow: hidden;
  -webkit-mask-image: linear-gradient(90deg, #000 60%, transparent);
  mask-image: linear-gradient(90deg, #000 60%, transparent);
}
.map-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% 40%;
}
/* Same conic sweep the live layer plays when it reveals the clouds. */
.sweep {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 160%;
  aspect-ratio: 1;
  translate: -50% -50%;
  border-radius: 50%;
  background: conic-gradient(from 0deg, rgba(22, 192, 96, 0.35), rgba(22, 192, 96, 0) 60deg);
  animation: promo-sweep 5s linear infinite;
  pointer-events: none;
}
@keyframes promo-sweep { to { rotate: 360deg; } }
.osm {
  position: absolute;
  left: 8px;
  bottom: 6px;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.8);
  color: #333;
  font-size: 10px;
}
.copy { position: relative; padding: 1.8rem 1.6rem 1.8rem 0.6rem; align-self: center; }

@media (max-width: 640px) {
  .soil-promo { grid-template-columns: 1fr; }
  .map {
    min-height: 0;
    height: 240px;
    -webkit-mask-image: linear-gradient(180deg, #000 65%, transparent);
    mask-image: linear-gradient(180deg, #000 65%, transparent);
  }
  .copy { padding: 0.4rem 1.1rem 1.3rem; }
  /* The bottom edge fades out here, so the credit moves up where it stays legible. */
  .osm { left: auto; right: 8px; bottom: auto; top: 6px; }
}

.dot :deep(svg) { width: 14px; height: 14px; }

.tag {
  display: inline-block;
  padding: 2px 9px;
  border-radius: 99px;
  background: rgba(22, 192, 96, 0.18);
  color: #5be39a;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
h2 { margin: 0.5rem 0 0.4rem; font-size: clamp(1.2rem, 3vw, 1.5rem); line-height: 1.2; }
.copy > p { margin: 0 0 0.8rem; font-size: 0.9rem; line-height: 1.55; color: #c9d1e0; }
.copy strong { color: #fff; }
.levels {
  list-style: none;
  margin: 0 0 1rem;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  font-size: 0.8rem;
  color: #dfe5ef;
}
.levels li { display: flex; align-items: center; gap: 5px; }
.dot {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
/* Not `.cta`: the default layout styles `.page-layout .cta` as a full-width band. */
.promo-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 1.3rem;
  border-radius: 999px;
  background: #16c060;
  color: #0e1a12;
  font-weight: 700;
  font-size: 0.95rem;
  text-decoration: none;
}
.promo-cta:hover { background: #1fd36d; }
.promo-cta:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.copy > .fine { margin: 0.7rem 0 0; font-size: 0.75rem; color: #9aa6ba; }
@media (max-width: 640px) { .promo-cta { width: 100%; box-sizing: border-box; } }
@media (prefers-reduced-motion: reduce) { .sweep { animation: none; opacity: 0; } }
</style>
