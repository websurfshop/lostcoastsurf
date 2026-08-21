/**
 * Lost Coast Surf Monitor — data layer.
 *
 * Pure frontend. All sources are public, CORS-enabled APIs.
 * Results are cached in localStorage for 30 minutes so the page behaves like a
 * static report instead of hammering live APIs.
 */

export const LAT = 40.0255;
export const LON = -124.0725;
export const TIDE_STATION = "9416841"; // Shelter Cove, CA
export const BUOY_ID = "46022"; // Eel River

export const LINKS = {
  webcam:
    "https://weathercams.faa.gov/map/-122.751060625,40.02549,9/cameraSite/1044/details/camera",
  tides: `https://tidesandcurrents.noaa.gov/noaatidepredictions.html?id=${TIDE_STATION}`,
  marine: "https://forecast.weather.gov/shmrn.php?mz=pzz470",
  buoy: `https://www.ndbc.noaa.gov/station_page.php?station=${BUOY_ID}`,
  weather: `https://forecast.weather.gov/MapClick.php?lat=${LAT}&lon=${LON}`,
};

export const BREAK = {
  name: "Deadman's",
  area: "Shelter Cove, CA",
  type: "Reef / rock point",
  facing: 225, // SW
  facingLabel: "SW (225°)",
  bestWind: "E / NE (offshore)",
  bestWindDeg: 55,
  bestTide: "Mid, incoming",
};

const CACHE_KEY = "lcsm:report:v1";
export const CACHE_TTL_MS = 30 * 60 * 1000;

/* ---------------------------------- types --------------------------------- */

export type HourPoint = {
  time: string; // ISO local
  waveHeight: number | null;
  swellHeight: number | null;
  swellPeriod: number | null;
  swellDirection: number | null;
  windSpeed: number | null;
  windDirection: number | null;
  score: number;
};

export type TideEvent = { time: string; height: number; type: "H" | "L" };

export type BuoyObs = {
  time: string | null;
  windDir: number | null;
  windSpeed: number | null;
  gust: number | null;
  waveHeight: number | null;
  dominantPeriod: number | null;
  meanWaveDir: number | null;
  pressure: number | null;
  airTemp: number | null;
  waterTemp: number | null;
};

export type RideWindow = {
  day: string;
  start: string;
  end: string;
  score: number;
  note: string;
};

export type SurfReport = {
  fetchedAt: number;
  current: HourPoint & {
    airTemp: number | null;
    waterTemp: number | null;
    pressure: number | null;
    windGust: number | null;
  };
  hourly: HourPoint[];
  tides: TideEvent[];
  buoy: BuoyObs | null;
  windows: RideWindow[];
  errors: string[];
};

/* -------------------------------- utilities -------------------------------- */

export function degToCompass(deg: number | null | undefined): string {
  if (deg == null || Number.isNaN(deg)) return "—";
  const pts = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
  ];
  return pts[Math.round((deg % 360) / 22.5) % 16] ?? "—";
}

/** Angular difference in degrees, 0–180. */
function angleDiff(a: number, b: number) {
  const d = Math.abs(((a - b + 180 + 360) % 360) - 180);
  return d;
}

/** true when the wind blows from land out through the lineup. */
export function isOffshore(windDirFrom: number | null): boolean {
  if (windDirFrom == null) return false;
  return angleDiff(windDirFrom, BREAK.bestWindDeg) < 70;
}

export function windLabel(windDirFrom: number | null): "OFF" | "ON" | "X-SHORE" {
  if (windDirFrom == null) return "X-SHORE";
  if (isOffshore(windDirFrom)) return "OFF";
  if (angleDiff(windDirFrom, BREAK.facing) < 70) return "ON";
  return "X-SHORE";
}

export function ratingWord(score: number): string {
  if (score >= 8.5) return "Firing";
  if (score >= 7) return "Optimum";
  if (score >= 5.5) return "Fun";
  if (score >= 4) return "Marginal";
  if (score >= 2.5) return "Poor";
  return "Flat / Blown";
}

/**
 * Conditions score, 0–10.
 * Size (0-4) + period quality (0-3) + swell angle into a SW-facing reef (0-1.5)
 * + wind (0-1.5, penalised hard when onshore and windy).
 */
export function scoreConditions(p: {
  swellHeight: number | null;
  swellPeriod: number | null;
  swellDirection: number | null;
  windSpeed: number | null;
  windDirection: number | null;
}): number {
  const h = p.swellHeight ?? 0;
  const per = p.swellPeriod ?? 0;
  const wind = p.windSpeed ?? 0;

  let size: number;
  if (h < 1) size = 0;
  else if (h < 2) size = 1.4;
  else if (h < 3) size = 2.6;
  else if (h < 5) size = 3.6;
  else if (h < 8) size = 4;
  else if (h < 11) size = 3.2;
  else size = 2;

  let period: number;
  if (per >= 15) period = 3;
  else if (per >= 12) period = 2.5;
  else if (per >= 10) period = 1.8;
  else if (per >= 8) period = 1;
  else period = 0.3;

  let angle = 0.7;
  if (p.swellDirection != null) {
    const off = angleDiff(p.swellDirection, BREAK.facing);
    angle = off < 45 ? 1.5 : off < 75 ? 1.1 : off < 100 ? 0.6 : 0.2;
  }

  let windPts: number;
  const off = isOffshore(p.windDirection);
  if (wind < 4) windPts = 1.5;
  else if (off) windPts = wind < 12 ? 1.5 : wind < 20 ? 1 : 0.4;
  else if (windLabel(p.windDirection) === "X-SHORE")
    windPts = wind < 8 ? 1 : wind < 15 ? 0.4 : 0;
  else windPts = wind < 7 ? 0.7 : wind < 12 ? 0.2 : 0;

  const raw = size + period + angle + windPts;
  return Math.max(0, Math.min(10, Math.round(raw * 10) / 10));
}

const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", ...opts }).format(d);

/**
 * NOAA and Open-Meteo return local Pacific timestamps with no zone suffix.
 * Read them as wall-clock values so the report reads the same from anywhere.
 */
const parseLocal = (iso: string) => new Date(`${iso}${/[Zz+]|-\d\d:\d\d$/.test(iso.slice(10)) ? "" : "Z"}`);

export const localHour = (iso: string) => parseLocal(iso).getUTCHours();

export const timeLabel = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "UTC", hour: "numeric", minute: "2-digit" }).format(
    parseLocal(iso),
  );
export const dayLabel = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short" })
    .format(parseLocal(iso))
    .toUpperCase();
export const stampLabel = (ms: number) =>
  fmt(new Date(ms), { hour: "numeric", minute: "2-digit", timeZoneName: "short" });

/* -------------------------------- fetchers -------------------------------- */

async function getJson(url: string) {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  // Some networks (captive portals, CDN error pages, proxies) answer with HTML
  // even on a 200. Parsing that as JSON is what produces
  // "Unexpected token '<'", so detect it and fail with a readable message.
  const text = await res.text();
  if (/^\s*</.test(text)) throw new Error(`Non-JSON (HTML) response from ${url}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Malformed JSON from ${url}`);
  }
}


function yyyymmdd(d: Date) {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  return p.replaceAll("-", "");
}

async function fetchMarine() {
  const url =
    `https://marine-api.open-meteo.com/v1/marine?latitude=${LAT}&longitude=${LON}` +
    `&current=wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period,sea_surface_temperature` +
    `&hourly=wave_height,swell_wave_height,swell_wave_period,swell_wave_direction` +
    `&length_unit=imperial&temperature_unit=fahrenheit&timezone=America%2FLos_Angeles&forecast_days=6`;
  return getJson(url);
}

async function fetchWeather() {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
    `&current=temperature_2m,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m` +
    `&hourly=wind_speed_10m,wind_direction_10m` +
    `&temperature_unit=fahrenheit&wind_speed_unit=kn&timezone=America%2FLos_Angeles&forecast_days=6`;
  return getJson(url);
}

async function fetchTides(): Promise<TideEvent[]> {
  const now = new Date();
  const end = new Date(now.getTime() + 4 * 864e5);
  const url =
    `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&datum=MLLW` +
    `&station=${TIDE_STATION}&time_zone=lst_ldt&units=english&interval=hilo&format=json` +
    `&begin_date=${yyyymmdd(now)}&end_date=${yyyymmdd(end)}`;
  const data = await getJson(url);
  if (!data.predictions) throw new Error("no tide predictions");
  return data.predictions.map((p: { t: string; v: string; type: string }) => ({
    time: p.t.replace(" ", "T"),
    height: Number(p.v),
    type: p.type as "H" | "L",
  }));
}

/** Milliseconds Pacific time is behind UTC right now. */
const PT_OFFSET_MS = () => {
  const now = new Date();
  const asPT = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const asUTC = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
  return asUTC.getTime() - asPT.getTime();
};

const num = (s: string | undefined) => (s === "MM" || s === undefined ? null : Number(s));

async function fetchBuoy(): Promise<BuoyObs> {
  const target = `https://www.ndbc.noaa.gov/data/realtime2/${BUOY_ID}.txt`;
  // NDBC does not send CORS headers, so read it through a public text mirror
  // first and only fall back to the direct URL.
  let text: string;
  try {
    const res = await fetch(`https://r.jina.ai/${target}`);
    if (!res.ok) throw new Error("ndbc relay " + res.status);
    text = await res.text();
  } catch {
    const res = await fetch(target);
    if (!res.ok) throw new Error("ndbc " + res.status);
    text = await res.text();
  }
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^\d{4}\s/.test(l));
  if (!lines.length) throw new Error("ndbc: no rows");

  // Walk recent rows so a single all-MM observation doesn't blank the panel.
  const rows = lines.slice(0, 24).map((l) => l.split(/\s+/));
  const pick = (i: number) => {
    for (const r of rows) {
      const v = num(r[i]);
      if (v != null && !Number.isNaN(v)) return v;
    }
    return null;
  };
  const r0 = rows[0]!;
  const mps = (v: number | null) => (v == null ? null : Math.round(v * 1.94384 * 10) / 10);
  const m2ft = (v: number | null) => (v == null ? null : Math.round(v * 3.28084 * 10) / 10);
  const c2f = (v: number | null) => (v == null ? null : Math.round((v * 9) / 5 + 32) );

  return {
    time: `${r0[0]}-${r0[1]}-${r0[2]}T${r0[3]}:${r0[4]}:00Z`,
    windDir: pick(5),
    windSpeed: mps(pick(6)),
    gust: mps(pick(7)),
    waveHeight: m2ft(pick(8)),
    dominantPeriod: pick(9),
    meanWaveDir: pick(11),
    pressure: pick(12),
    airTemp: c2f(pick(13)),
    waterTemp: c2f(pick(14)),
  };
}

/* --------------------------------- assembly -------------------------------- */

function buildWindows(hourly: HourPoint[]): RideWindow[] {
  const windows: RideWindow[] = [];
  let run: HourPoint[] = [];

  const flush = () => {
    if (run.length >= 2) {
      const best = run.reduce((a, b) => (b.score > a.score ? b : a));
      const first = run[0]!;
      const last = run[run.length - 1]!;
      windows.push({
        day: dayLabel(first.time),
        start: timeLabel(first.time),
        end: timeLabel(last.time),
        score: best.score,
        note: `${best.swellHeight?.toFixed(1) ?? "—"}ft @ ${
          best.swellPeriod?.toFixed(0) ?? "—"
        }s · ${windLabel(best.windDirection)} ${best.windSpeed?.toFixed(0) ?? "—"}kt`,
      });
    }
    run = [];
  };

  for (const h of hourly) {
    const hour = localHour(h.time);
    const daylight = hour >= 6 && hour <= 20;
    if (daylight && h.score >= 5.5) run.push(h);
    else flush();
  }
  flush();
  // Keep the eight best windows, then show them in the order they'll happen.
  const best = [...windows].sort((a, b) => b.score - a.score).slice(0, 8);
  return windows.filter((w) => best.includes(w));
}

export async function fetchReport(): Promise<SurfReport> {
  const errors: string[] = [];
  const [marineR, weatherR, tidesR, buoyR] = await Promise.allSettled([
    fetchMarine(),
    fetchWeather(),
    fetchTides(),
    fetchBuoy(),
  ]);

  if (marineR.status === "rejected") throw new Error("Marine forecast unavailable");
  const marine = marineR.value;
  const weather = weatherR.status === "fulfilled" ? weatherR.value : null;
  if (!weather) errors.push("Wind & air data unavailable");
  const tides = tidesR.status === "fulfilled" ? tidesR.value : [];
  if (!tides.length) errors.push("Tide predictions unavailable");
  const buoy = buoyR.status === "fulfilled" ? buoyR.value : null;
  if (!buoy) errors.push(`Buoy ${BUOY_ID} feed unavailable`);

  const mh = marine.hourly;
  const wh = weather?.hourly;
  const windAt = (t: string) => {
    if (!wh) return { s: null as number | null, d: null as number | null };
    const i = wh.time.indexOf(t);
    return i < 0
      ? { s: null, d: null }
      : { s: wh.wind_speed_10m[i], d: wh.wind_direction_10m[i] };
  };

  const nowMs = Date.now();
  const hourly: HourPoint[] = mh.time
    .map((t: string, i: number) => {
      const w = windAt(t);
      const base = {
        time: t,
        waveHeight: mh.wave_height[i],
        swellHeight: mh.swell_wave_height[i],
        swellPeriod: mh.swell_wave_period[i],
        swellDirection: mh.swell_wave_direction[i],
        windSpeed: w.s,
        windDirection: w.d,
      };
      return { ...base, score: scoreConditions(base) };
    })
    .filter((h: HourPoint) => parseLocal(h.time).getTime() >= nowMs - 36e5 - PT_OFFSET_MS());

  const mc = marine.current;
  const wc = weather?.current;
  const currentBase = {
    time: mc.time,
    waveHeight: mc.wave_height ?? null,
    swellHeight: mc.swell_wave_height ?? null,
    swellPeriod: mc.swell_wave_period ?? null,
    swellDirection: mc.swell_wave_direction ?? null,
    windSpeed: wc?.wind_speed_10m ?? buoy?.windSpeed ?? null,
    windDirection: wc?.wind_direction_10m ?? buoy?.windDir ?? null,
  };

  return {
    fetchedAt: Date.now(),
    current: {
      ...currentBase,
      score: scoreConditions(currentBase),
      airTemp: wc?.temperature_2m ?? buoy?.airTemp ?? null,
      waterTemp: mc.sea_surface_temperature ?? buoy?.waterTemp ?? null,
      pressure: wc?.surface_pressure ?? buoy?.pressure ?? null,
      windGust: wc?.wind_gusts_10m ?? buoy?.gust ?? null,
    },
    hourly,
    tides,
    buoy,
    windows: buildWindows(hourly),
    errors,
  };
}

/* ---------------------------------- cache ---------------------------------- */

export function isFuture(iso: string): boolean {
  return parseLocal(iso).getTime() >= Date.now() - PT_OFFSET_MS() - 36e5;
}

export function readCache(): SurfReport | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SurfReport;
    if (!parsed?.fetchedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCache(report: SurfReport) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(report));
  } catch {
    /* storage full or blocked — cache is best-effort */
  }
}

export function isStale(report: SurfReport | null): boolean {
  return !report || Date.now() - report.fetchedAt > CACHE_TTL_MS;
}
