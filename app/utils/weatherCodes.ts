/**
 * WMO weather interpretation codes (Open-Meteo `weather_code`) → German label
 * and a glyph.
 *
 * Emoji rather than Font Awesome: the weather strip needs six distinguishable
 * symbols at ~14px, and FA's monochrome cloud glyphs stop being tellable apart
 * at that size once colour is the only difference left.
 */

interface WeatherCodeMeta {
  label: string
  icon: string
}

const FALLBACK: WeatherCodeMeta = { label: 'Unbekannt', icon: '❔' }

const WEATHER_CODES: Record<number, WeatherCodeMeta> = {
  0:  { label: 'Klar',                  icon: '☀️' },
  1:  { label: 'Überwiegend klar',      icon: '🌤️' },
  2:  { label: 'Teilweise bewölkt',     icon: '⛅' },
  3:  { label: 'Bedeckt',               icon: '☁️' },
  45: { label: 'Nebel',                 icon: '🌫️' },
  48: { label: 'Reifnebel',             icon: '🌫️' },
  51: { label: 'Leichter Nieselregen',  icon: '🌦️' },
  53: { label: 'Nieselregen',           icon: '🌦️' },
  55: { label: 'Starker Nieselregen',   icon: '🌧️' },
  56: { label: 'Gefrierender Niesel',   icon: '🌧️' },
  57: { label: 'Gefrierender Niesel',   icon: '🌧️' },
  61: { label: 'Leichter Regen',        icon: '🌦️' },
  63: { label: 'Regen',                 icon: '🌧️' },
  65: { label: 'Starker Regen',         icon: '🌧️' },
  66: { label: 'Gefrierender Regen',    icon: '🌧️' },
  67: { label: 'Gefrierender Regen',    icon: '🌧️' },
  71: { label: 'Leichter Schneefall',   icon: '🌨️' },
  73: { label: 'Schneefall',            icon: '❄️' },
  75: { label: 'Starker Schneefall',    icon: '❄️' },
  77: { label: 'Schneegriesel',         icon: '🌨️' },
  80: { label: 'Leichte Schauer',       icon: '🌦️' },
  81: { label: 'Schauer',               icon: '🌧️' },
  82: { label: 'Heftige Schauer',       icon: '🌧️' },
  85: { label: 'Schneeschauer',         icon: '🌨️' },
  86: { label: 'Starke Schneeschauer',  icon: '🌨️' },
  95: { label: 'Gewitter',              icon: '⛈️' },
  96: { label: 'Gewitter mit Hagel',    icon: '⛈️' },
  99: { label: 'Gewitter mit Hagel',    icon: '⛈️' },
}

export function weatherCodeMeta(code: number | null | undefined): WeatherCodeMeta {
  if (code == null) return FALLBACK
  return WEATHER_CODES[code] ?? FALLBACK
}

export function weatherCodeLabel(code: number | null | undefined): string {
  return weatherCodeMeta(code).label
}

export function weatherCodeIcon(code: number | null | undefined): string {
  return weatherCodeMeta(code).icon
}
