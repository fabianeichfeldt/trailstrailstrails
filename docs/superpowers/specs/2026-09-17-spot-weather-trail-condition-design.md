# Spot-Wetter & Trail-Zustand — Design Spec

**Date:** 2026-09-17
**Status:** Approved, pending implementation
**Mockup:** `nimbalyst-local/mockups/spot-weather-card.mockup.html`

## Purpose

Mountainbiker entscheiden anhand des Wetters der letzten Tage, ob ein Trail fahrbar ist — nicht anhand des Wetters von jetzt. Zwei trockene Tage nach 13 mm Regen heißt griffig; dieselben 13 mm im November heißen matschig. Die Spot-Seite soll diese Frage beantworten, statt den Nutzer zu einer Wetter-App zu schicken.

Zweitens hat `trail_details` bereits `rain_policy` (`none`/`during`/`after`) und `rain_closed_hours`, aber `SpotDetailStatus.vue:60-65` rendert das nur als toten Text (*"Geschlossen 24h nach Regen"*). Mit echten Niederschlagsdaten wird daraus eine beantwortete Frage.

## Scope decisions

- **Datenquelle:** Open-Meteo Forecast-API. Kein API-Key, CORS offen, ein Call liefert Vergangenheit + Gegenwart + Vorhersage. Verifiziert gegen den Live-Endpoint am 2026-09-17.
- **Nicht-kommerziell:** trailradar.org ist nicht kommerziell → Open-Metos Free-Tier (<10k Calls/Tag) ist lizenzkonform. Ändert sich das, ist Bright Sky (DWD, keine Kommerz-Klausel, nur DE) der Ausweichpfad — deshalb sitzt der Fetch hinter einer eigenen Datei mit eigenem Response-Typ.
- **Rein beratend.** Das Wetter überschreibt **nie** `STATUS_META` / `computeEffectiveStatus()`. Der offizielle Spot-Status bleibt der Trailcrew vorbehalten (CLAUDE.md: reale Verantwortung für die Richtigkeit). Berechnete Aussagen werden im UI als berechnet gekennzeichnet.
- **Urteil + Belege**, nicht nur eine Ampel: eine große Aussage plus die Tagesniederschläge, aus denen sie folgt, damit erfahrene Fahrer die Bewertung überstimmen können.
- **Kein Server-Cache in v1.** Client-seitiger localStorage-Cache. Marker-Badges und ein Kartenfilter "nur trockene Spots" sind bewusst **out of scope** — die brauchen einen vorgefüllten Server-Cache (Supabase-Tabelle + `pg_cron`) und sind ein eigenes Vorhaben.
- **Keine `soil_moisture_*`-Felder.** Absolute m³/m³ sind ohne Bodenart und bei ~11 km Modellgitter nicht interpretierbar. Die Wasserbilanz aus Niederschlag und Verdunstung ist nachvollziehbar und testbar.
- **Nur die Spot-Seite.** Kein Einbau ins Embed-Widget (zusätzliche Third-Party-Requests aus fremden Seiten).

## 1. Datenquelle

Ein Request pro Spot:

```
https://api.open-meteo.com/v1/forecast
  ?latitude=<lat>&longitude=<lon>
  &past_days=5&forecast_days=1&timezone=auto
  &current=temperature_2m,apparent_temperature,weather_code,precipitation,wind_speed_10m
  &daily=weather_code,precipitation_sum,temperature_2m_max,temperature_2m_min,
         et0_fao_evapotranspiration,snowfall_sum
  &hourly=precipitation,snowfall
```

Verifiziert (Winterberg, 51.19/8.52): HTTP 200, ~5 KB, `generationtime_ms` < 3 ms. `timezone=auto` liefert Ortszeit, `elevation` kommt ungefragt mit. `daily.time` enthält 5 vergangene Tage + heute; `hourly` 144 Stundenwerte.

**`past_days` auf dem Forecast-Endpoint, nicht `archive-api`** — das Archiv hat 5 Tage Verzug und ist für „vorgestern" unbrauchbar.

Kein Key heißt: nichts geht ins Bundle, was nicht hineingehört, und es gibt keine Secret-Rotation.

## 2. Das Urteil — Wasserbilanz

Reine Regensumme der letzten 72 h ist saisonal irreführend. Stattdessen ein Eimer über die letzten 120 h, von alt nach neu:

```
wetness = 0
für jede Stunde:
  wetness += hourly.precipitation[h]
  wetness -= daily.et0_fao_evapotranspiration[tag(h)] / 24
  wetness = clamp(wetness, 0, 30)
```

Verdunstung durch 24 zu teilen ist bewusst grob — der saisonale Unterschied (Juli ≈ 4 mm/Tag, November ≈ 0,4 mm/Tag) trägt das Ergebnis, nicht der Tagesgang.

| `wetness` | Stufe | Text |
|---|---|---|
| 0 – 1 mm | `dusty` | **Staubtrocken** — loser Staub in Kurven |
| 1 – 4 mm | `prime` | **Griffig** — bester Zustand |
| 4 – 10 mm | `damp` | **Feucht, aber fahrbar** — rutschige Wurzeln |
| > 10 mm | `wet` | **Nass und weich** — Trails schonen |

Vier Overrides schlagen die Bilanz, in dieser Reihenfolge geprüft:

1. `snowfall` der letzten 24 h > 0 **oder** `temperature_2m_max` < 1 °C → `snow`
2. `current.precipitation` > 0 → `raining`
3. Spot ist ein reiner Pumptrack (`isDirtPark(t) && t.pumptrack && !t.dirtpark`) → `surface_hard`, kein Bodenurteil, nur aktuelles Wetter. Asphalt trocknet in Minuten.
4. Daten fehlen/unvollständig → `unknown`, Karte rendert nicht.

Bei `wet` erscheint zusätzlich ein Trail-Etikette-Hinweis: nasse Trails zu fahren hinterlässt Rillen, die die Trailcrew von Hand repariert. Für eine App über *legale, gepflegte* Trails ist das der eigentliche Punkt, nicht der Fahrkomfort.

## 3. Schichten

Nach dem Layer-Diagramm in CLAUDE.md:

### `app/types/Weather.ts`
`OpenMeteoResponse` (Rohform, nur die angeforderten Felder), `SpotWeather` (normalisiert: `current`, `days: DayWeather[]`), `TrailCondition` (`level`, `headline`, `detail`, `hoursSinceRain`, `wetnessMm`).

### `app/communication/weather.ts`
- `fetchSpotWeather(lat: number, lon: number): Promise<SpotWeather | null>` — baut die URL, mappt die Response auf `SpotWeather`, gibt bei jedem Fehler `null` zurück (nie werfen; die Karte ist beratend, sie darf die Seite nicht mitreißen).
- localStorage-Cache: Key `tr_wx_v1_<lat.toFixed(2)>_<lon.toFixed(2)>`, TTL 1 h. Das Runden auf ~1 km teilt den Cache zwischen benachbarten Spots und entspricht ohnehin Open-Metos Modellgitter. Kaputtes JSON im Cache → verwerfen und neu holen.
- `const WEATHER_API = 'https://api.open-meteo.com/v1/forecast'` ist hier erlaubt: die Architekturregel *"No hardcoded Supabase project URL"* (`app/architecture.test.ts:30-50`) prüft gezielt die Supabase-Projekt-ID, nicht beliebige URLs.
- Importiert nichts aus `stores/`, `composables/`, `app/map/` — durch `.dependency-cruiser.cjs` und `architecture.test.ts:160` erzwungen.

### `app/utils/trailCondition.ts`
`computeTrailCondition(weather: SpotWeather, spotType: TrailConditionMode): TrailCondition` — **pure**, keine `Date.now()`-Abhängigkeit außer über einen optionalen injizierten Zeitpunkt, damit Tests deterministisch sind. Enthält die Wasserbilanz, die Schwellwerttabelle und die Overrides.

`TrailConditionMode` wird über einen Record nach Spot-Typ aufgelöst, nicht über `if/else` (Open/Closed-Muster aus CLAUDE.md):

```ts
const CONDITION_MODE: Record<Trail['type'], (t: Trail) => 'soil' | 'hard'> = {
  trail:    () => 'soil',
  bikepark: () => 'soil',
  dirtpark: (t) => (isDirtPark(t) && t.pumptrack && !t.dirtpark ? 'hard' : 'soil'),
}
```

### `app/composables/useSpotWeather.ts`
`useSpotWeather(lat, lon, spot)` → `{ weather, condition, loading }`. Zwei Komponenten konsumieren dieselben Daten (Wetter-Karte und Status-Banner), deshalb hier ein Modul-Level-Dedupe der laufenden Promise pro Cache-Key statt zwei Requests.

**Der Fetch läuft ausschließlich in `onMounted`.** Passiert er beim Prerender, backt `nuxt generate` das Wetter des Build-Tages in statisches HTML, das bis zum nächsten Deploy so ausgeliefert wird — dieselbe Fehlerklasse wie die gebackenen `server/api`-Routen in CLAUDE.md, und wie damals würde sie weder von Dev noch vom gemockten Testlauf gefangen. SSR rendert das Skeleton.

### `app/components/trail_detail/SpotDetailWeather.vue`
Die Karte. Aufbau laut Mockup:
- Badge + Urteil + Begründungssatz links, aktuelles Wetter rechts (Temperatur, gefühlt, Wind, Icon).
- Belegleiste: sechs Spalten (5 Tage zurück + heute), je Wettericon, Niederschlagsbalken und mm. Heute wird über Label-Farbe und eine Akzentlinie markiert, **nicht** über eine Hintergrundbox — die würde die Spaltenhöhe ändern und die Balken-Grundlinie gegen die anderen fünf verschieben.
- Balkenhöhe: `sqrt`-Skala auf max. 44 px, damit 0,8 mm sichtbar bleibt neben 13,4 mm. Farbe in drei Stufen (< 2 / 2–8 / > 8 mm).
- Fußzeile: „Berechnet aus Niederschlag & Verdunstung · keine Trailcrew-Angabe" links, Attribution „Wetter: Open-Meteo" rechts (CC-BY, Pflicht).
- Mobile (< 600 px): aktuelles Wetter rutscht als eigene Zeile unter das Urteil. Sechs Balken passen bei 360 px ohne Scrollen. Nichts ist antippbar — keine Touch-Target-Frage.

### Änderung an `app/pages/trails/[slug].vue`
`<SpotDetailWeather>` direkt nach `<SpotDetailStatus>` und **vor** `<SpotDetailPhotos>`. Die Karte beantwortet dieselbe Frage wie das Status-Banner und gehört daneben, nicht zwischen die Bilder. Kein Eintrag in `SpotDetailNav.vue` — die Karte steht oberhalb der Sticky-Nav, ein Anker nach oben wäre unsinnig.

### Änderung an `app/components/trail_detail/SpotDetailStatus.vue`
`rainHint` (Zeile 60-65) wird um die berechnete Hälfte ergänzt, sobald Wetterdaten vorliegen:

| `rain_policy` | bisher | neu |
|---|---|---|
| `during` | „Geschlossen bei Regen" | + `· es regnet gerade` / `· aktuell kein Regen` |
| `after` | „Geschlossen 24h nach Regen" | + `· letzter Regen vor 31 h` bzw. `· Regen vor 5 h — Regel greift` |

Der Zusatz bekommt eine eigene visuelle Auszeichnung (Pill), damit erkennbar bleibt, was Trailcrew-Angabe und was Rechnung ist. `effectiveStatus` und `statusMeta` bleiben unberührt.

## 4. Testing

Alles vitest, kein Playwright — nichts hier braucht einen echten Browser.

**`app/utils/trailCondition.test.ts`** (pure, fixture-getrieben). Fixtures als eingecheckte JSON-Schnipsel im Open-Meteo-Format:
- Trockenwoche im August → `dusty`
- 13,4 mm vor 2 Tagen, danach trocken bei et0 ≈ 2 mm → `prime` (der real geprüfte Winterberg-Fall)
- Dieselben 13,4 mm bei et0 ≈ 0,4 mm im November → `wet` (beweist, dass die Verdunstung wirkt — der eigentliche Grund für die Bilanz statt einer Regensumme)
- 7 mm über zwei Tage → `damp`
- Neuschnee → `snow`, schlägt die Bilanz
- `current.precipitation > 0` → `raining`, schlägt die Bilanz
- Pumptrack → `hard`, kein Bodenurteil
- Lückenhafte Response (`null` in `precipitation_sum`) → `unknown`, wirft nicht

**`app/communication/weather.test.ts`** — `fetch` gemockt. URL-Parameter korrekt, Cache-Miss holt, Cache-Hit holt nicht, abgelaufener Cache holt erneut, kaputtes Cache-JSON wird verworfen, HTTP 429/500/Netzwerkfehler → `null` statt Exception. **Open-Meteo wird in Tests nie real aufgerufen.**

**`app/components/trail_detail/SpotDetailWeather.test.ts`** — nur die Netzwerkgrenze (`communication/weather`) gemockt, dann geprüft, was der Nutzer tatsächlich liest: „Griffig", „13,4", die sechs Spalten, die Attribution. Kein Test gegen Rückgabewerte interner Helfer (Symptom-Test-Regel).

**`app/components/trail_detail/SpotDetailStatus.test.ts`** — bestehende Datei erweitern: mit Wetterdaten erscheint der berechnete Zusatz, ohne Wetterdaten bleibt der bisherige Text unverändert, und in **keinem** Fall ändert sich `statusMeta`/die Banner-Klasse.

**`app/architecture.test.ts`** — eine Assertion ergänzen: `app/utils/trailCondition.ts` importiert nichts aus `communication/`, `stores/` oder `composables/` und enthält kein `fetch` (die Bewertungslogik bleibt pure und damit später serverseitig wiederverwendbar, falls der `pg_cron`-Cache kommt).

## Architecture impact

Keine Änderung an den Schichtgrenzen. Neue Dateien sitzen in bestehenden Ebenen, `communication/weather.ts` ist die erste Nicht-Supabase-Datenquelle in `communication/` — der Layer war dafür immer offen (der Name ist nicht „supabase/"), nur genutzt wurde er bisher nur so.

Keine Supabase-Schemaänderung, keine Migration, keine RLS-Policy, kein `database.types.ts`-Regenerieren.

Laufzeitkosten: ein 5-KB-Request pro Spot-Seitenaufruf, 1 h gecacht, weit unter dem 10k/Tag-Limit. Bundle: keine neue Abhängigkeit.

## Explizit nicht in diesem Vorhaben

- Marker-Badge bzw. Karten-Tint für nasse Spots
- Kartenfilter „nur trockene Spots"
- Supabase-Cache-Tabelle + `pg_cron`-Vorbefüllung
- Wettervorhersage über heute hinaus („wann ist es wieder trocken?")
- Trailcrew-Oberfläche zum Kalibrieren der Schwellwerte pro Spot (lehmiger Boden im Sauerland trocknet anders als Sand in Brandenburg)
