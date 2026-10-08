<template>
  <section class="soil-promo-outer" aria-labelledby="soil-promo-title" data-testid="soil-promo">
    <div class="soil-promo inner">
      <div class="visual" aria-hidden="true">
        <div class="scope">
          <span class="ring r1" /><span class="ring r2" /><span class="ring r3" />
          <span class="beam" />
          <span
            v-for="(b, i) in BLIPS"
            :key="i"
            class="blip"
            :style="{ top: b.top, left: b.left, background: SOIL_PALETTE[b.lvl] }"
            v-html="SOIL_GLYPHS[LEVELS[b.lvl]!]"
          />
        </div>
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
const BLIPS = [
  { top: '22%', left: '30%', lvl: 2 }, { top: '35%', left: '64%', lvl: 1 },
  { top: '60%', left: '22%', lvl: 3 }, { top: '68%', left: '58%', lvl: 2 },
  { top: '46%', left: '44%', lvl: 0 }, { top: '18%', left: '55%', lvl: 4 },
] as const
const promoActive = isSignupPromoActive()
</script>

<style scoped>
.soil-promo-outer { padding: 2rem 1rem; }
.soil-promo {
  max-width: 860px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 1.8rem;
  align-items: center;
  padding: 1.6rem;
  border-radius: 18px;
  background: linear-gradient(140deg, #1a2035 0%, #22304a 100%);
  color: #fff;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
}
@media (max-width: 640px) {
  .soil-promo { grid-template-columns: 1fr; gap: 1.2rem; padding: 1.3rem 1.1rem; }
  .visual { max-width: 200px; margin: 0 auto; width: 100%; }
}

.scope {
  position: relative;
  aspect-ratio: 1;
  border-radius: 50%;
  overflow: hidden;
  background: radial-gradient(circle, #24364f 0%, #182338 70%);
  box-shadow: inset 0 0 0 2px rgba(91, 227, 154, 0.35);
}
.ring {
  position: absolute;
  inset: 0;
  margin: auto;
  border-radius: 50%;
  border: 1px solid rgba(91, 227, 154, 0.22);
}
.r1 { width: 33%; height: 33%; }
.r2 { width: 66%; height: 66%; }
.r3 { width: 99%; height: 99%; }
.beam {
  position: absolute;
  inset: 0;
  background: conic-gradient(from 0deg, rgba(91, 227, 154, 0.45), rgba(91, 227, 154, 0) 70deg);
  border-radius: 50%;
  animation: promo-sweep 4s linear infinite;
}
.blip {
  position: absolute;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #fff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
}
.blip :deep(svg), .dot :deep(svg) { width: 14px; height: 14px; }
@keyframes promo-sweep { to { transform: rotate(360deg); } }

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
@media (prefers-reduced-motion: reduce) { .beam { animation: none; } }
</style>
