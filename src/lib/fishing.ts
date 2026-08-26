/**
 * "Can I fish?" briefing — data layer for Shelter Cove, CA.
 *
 * Pure frontend, no backend. Everything is fetched from public CORS-enabled
 * endpoints (or public text relays for NDBC, which sends no CORS headers) and
 * cached in localStorage for 30 minutes so the page behaves like a static
 * report and deploys as plain files to Cloudflare Pages.
 */

import { BUOY_ID, LAT, LON, TIDE_STATION, degToCompass, type TideEvent } from "@/lib/surf";

export { BUOY_ID, degToCompass };
export type { TideEvent };

export const MARINE_ZONE = "PZZ470"; // Pt St George to Cape Mendocino / Eureka waters
export const FISH_CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_KEY = "lcsm:fishing:v1";

export const FISH_LINKS = {
  reports: "https://fishingthenorthcoast.com/category/current-fishing-reports/",
  reportsFeed: "https://fishingthenorthcoast.com/category/current-fishing-reports/feed/",
  marineForecast: "https://forecast.weather.gov/shmrn.php?mz=pzz470",
  buoy: `https://www.ndbc.noaa.gov/station_page.php?station=${BUOY_ID}`,
  tides: `https://tidesandcurrents.noaa.gov/noaatidepredictions.html?id=${TIDE_STATION}`,
  harbor: "https://www.humboldtgov.org/2358/Shelter-Cove",
  webcam:
    "https://weathercams.faa.gov/map/-122.751060625,40.02549,9/cameraSite/1044/details/camera",
  alerts: `https://alerts.weather.gov/cap/wwaatmget.php?x=${MARINE_ZONE}&y=1`,
};

/* ---------------------------------- types ---------------------------------- */

export type BuoyRow = {
  time: number; // epoch ms (UTC)
  windDir: number | null;
  windSpeed: number | null; // kt
  gust: number | null; // kt
  waveHeight: number | null; // ft
  dominantPeriod: number | null; // s
  meanWaveDir: number | null;
  pressure: number | null;
  airTemp: number | null; // F
  waterTemp: number | null; // F
};

export type HourWind = {
  time: string;
  windSpeed: number | null; // kt
  windGust: number | null; // kt
  windDirection: number | null;
  waveHeight: number | null; // ft
  wavePeriod: number | null; // s
};

export type NwsAlert = {
  id: string;
  event: string;
  headline: string;
  severity: string;
  onset: string | null;
  ends: string | null;
  description: string;
  url: string;
};

export type SunTimes = { date: string; sunrise: string | null; sunset: string | null };

export type LocalReport = {
  title: string;
  link: string;
  date: string | null;
  summary: string;
};

export type FishReport = {
  fetchedAt: number;
  buoy: BuoyRow | null;
  buoyHistory: BuoyRow[];
  hourly: HourWind[];
  tides: TideEvent[];
  sun: SunTimes[];
  alerts: NwsAlert[];
  reports: LocalReport[];
  errors: string[];
};

/* -------------------------------- utilities -------------------------------- */

const parseLocal = (iso: string) =>
  new Date(`${iso}${/[Zz+]|-\d\d:\d\d$/.test(iso.slice(10)) ? "" : "Z"}`);

const PT_OFFSET_MS = () => {
  const now = new Date();
  const asPT = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const asUTC = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
  return asUTC.getTime() - asPT.getTime();
};

/** "now" expressed on the same wall-clock scale as the Pacific-local feeds. */
export const nowLocalMs = () => Date.now() - PT_OFFSET_MS();

export const hourOf = (iso: string) => parseLocal(iso).getUTCHours();

export const clockLabel = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "UTC", hour: "numeric", minute: "2-digit" }).format(
    parseLocal(iso),
  );

export const dayShort = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short" })
    .format(parseLocal(iso))
    .toUpperCase();

/** Formats a real UTC instant (buoy timestamps, alert times) in Pacific time. */
export const pacificLabel = (ms: number, withDay = false) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    ...(withDay ? { weekday: "short" as const } : {}),
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(ms));

export const agoLabel = (ms: number) => {
  const mins = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  return `${h} hr ${mins % 60} min ago`;
};

export const isFutureLocal = (iso: string) => parseLocal(iso).getTime() >= nowLocalMs();

/**
 * Fishability indicator, 0–10. NOT a launch decision — small-boat safety at
 * Shelter Cove is a beach-launch call that no model can make.
 */
export function fishScore(p: {
  windSpeed: number | null;
  waveHeight: number | null;
  period: number | null;
}): number {
  const wind = p.windSpeed ?? 99;
  const wave = p.waveHeight ?? 99;
  const per = p.period ?? 0;

  let w: number;
  if (wind <= 5) w = 5;
  else if (wind <= 10) w = 4;
  else if (wind <= 15) w = 2.5;
  else if (wind <= 20) w = 1;
  else w = 0;

  let s: number;
  if (wave <= 3) s = 4;
  else if (wave <= 5) s = 3;
  else if (wave <= 7) s = 1.5;
  else if (wave <= 9) s = 0.5;
  else s = 0;

  // Long-period groundswell at low height is friendlier than short wind chop.
  const p2 = per >= 12 ? 1 : per >= 9 ? 0.7 : per >= 6 ? 0.4 : 0.1;

  return Math.max(0, Math.min(10, Math.round((w + s + p2) * 10) / 10));
}

export function fishWord(score: number): string {
  if (score >= 8.5) return "Glassy / Prime";
  if (score >= 7) return "Workable";
  if (score >= 5) return "Bumpy";
  if (score >= 3) return "Rough";
  return "Blown Out";
}

/* -------------------------------- fetchers --------------------------------- */

async function getJson(url: string) {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const text = await res.text();
  if (/^\s*</.test(text)) throw new Error(`Non-JSON (HTML) response from ${url}`);
  return JSON.parse(text) as any;
}

/** Fetch plain text through public relays because the origin blocks CORS. */
async function getRelayedText(target: string, valid: (body: string) => boolean) {
  const sources = [
    `https://r.jina.ai/${target}`,
    `https://corsproxy.io/?${encodeURIComponent(target)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`,
    target,
  ];
  for (const src of sources) {
    try {
      const res = await fetch(src);
      if (!res.ok) continue;
      const body = await res.text();
      if (valid(body)) return body;
    } catch {
      /* next relay */
    }
  }
  return null;
}

const num = (s: string | undefined) =>
  s === undefined || s === "MM" || Number.isNaN(Number(s)) ? null : Number(s);
const kt = (v: number | null) => (v == null ? null : Math.round(v * 1.94384 * 10) / 10);
const m2ft = (v: number | null) => (v == null ? null : Math.round(v * 3.28084 * 10) / 10);
const c2f = (v: number | null) => (v == null ? null : Math.round((v * 9) / 5 + 32));

/** Last 48 hours of NDBC 46022 observations, newest first. */
async function fetchBuoyHistory(): Promise<BuoyRow[]> {
  const text = await getRelayedText(
    `https://www.ndbc.noaa.gov/data/realtime2/${BUOY_ID}.txt`,
    (b) => /^\d{4}\s/m.test(b),
  );
  if (!text) throw new Error("ndbc unreachable");

  const rows = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^\d{4}\s/.test(l))
    .map((l) => l.split(/\s+/));

  const cutoff = Date.now() - 48 * 3600e3;
  const out: BuoyRow[] = [];
  for (const r of rows) {
    const t = Date.UTC(
      Number(r[0]),
      Number(r[1]) - 1,
      Number(r[2]),
      Number(r[3]),
      Number(r[4]),
    );
    if (Number.isNaN(t) || t < cutoff) continue;
    out.push({
      time: t,
      windDir: num(r[5]),
      windSpeed: kt(num(r[6])),
      gust: kt(num(r[7])),
      waveHeight: m2ft(num(r[8])),
      dominantPeriod: num(r[9]),
      meanWaveDir: num(r[11]),
      pressure: num(r[12]),
      airTemp: c2f(num(r[13])),
      waterTemp: c2f(num(r[14])),
    });
  }
  if (!out.length) throw new Error("ndbc: no recent rows");
  return out;
}

/** Newest non-null value across recent rows, so one MM row doesn't blank a field. */
export function latestBuoy(history: BuoyRow[]): BuoyRow | null {
  if (!history.length) return null;
  const keys: (keyof BuoyRow)[] = [
    "windDir",
    "windSpeed",
    "gust",
    "waveHeight",
    "dominantPeriod",
    "meanWaveDir",
    "pressure",
    "airTemp",
    "waterTemp",
  ];
  const base = { ...history[0]! };
  for (const k of keys) {
    if (base[k] != null) continue;
    const found = history.find((r) => r[k] != null);
    if (found) (base as any)[k] = found[k];
  }
  return base;
}

async function fetchHourly(): Promise<{ hourly: HourWind[]; sun: SunTimes[] }> {
  const [wx, marine] = await Promise.all([
    getJson(
      `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
        `&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m` +
        `&daily=sunrise,sunset&wind_speed_unit=kn&timezone=America%2FLos_Angeles&forecast_days=3`,
    ),
    getJson(
      `https://marine-api.open-meteo.com/v1/marine?latitude=${LAT}&longitude=${LON}` +
        `&hourly=wave_height,wave_period&length_unit=imperial&timezone=America%2FLos_Angeles&forecast_days=3`,
    ).catch(() => null),
  ]);

  const times: string[] = wx.hourly.time;
  const mIdx = (t: string) => (marine ? marine.hourly.time.indexOf(t) : -1);

  const hourly: HourWind[] = times.map((t, i) => {
    const j = mIdx(t);
    return {
      time: t,
      windSpeed: wx.hourly.wind_speed_10m?.[i] ?? null,
      windGust: wx.hourly.wind_gusts_10m?.[i] ?? null,
      windDirection: wx.hourly.wind_direction_10m?.[i] ?? null,
      waveHeight: j >= 0 ? (marine.hourly.wave_height?.[j] ?? null) : null,
      wavePeriod: j >= 0 ? (marine.hourly.wave_period?.[j] ?? null) : null,
    };
  });

  const sun: SunTimes[] = (wx.daily?.time ?? []).map((d: string, i: number) => ({
    date: d,
    sunrise: wx.daily.sunrise?.[i] ?? null,
    sunset: wx.daily.sunset?.[i] ?? null,
  }));

  return { hourly, sun };
}

function yyyymmdd(d: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(d)
    .replaceAll("-", "");
}

async function fetchTideEvents(): Promise<TideEvent[]> {
  const now = new Date();
  const end = new Date(now.getTime() + 3 * 864e5);
  const data = await getJson(
    `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&datum=MLLW` +
      `&station=${TIDE_STATION}&time_zone=lst_ldt&units=english&interval=hilo&format=json` +
      `&begin_date=${yyyymmdd(now)}&end_date=${yyyymmdd(end)}`,
  );
  if (!data.predictions) throw new Error("no tide predictions");
  return data.predictions.map((p: { t: string; v: string; type: string }) => ({
    time: p.t.replace(" ", "T"),
    height: Number(p.v),
    type: p.type as "H" | "L",
  }));
}

/** Six-minute tide predictions for the plot. */
export async function fetchTideCurve(): Promise<{ time: string; height: number }[]> {
  const now = new Date();
  const end = new Date(now.getTime() + 2 * 864e5);
  const data = await getJson(
    `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&datum=MLLW` +
      `&station=${TIDE_STATION}&time_zone=lst_ldt&units=english&interval=h&format=json` +
      `&begin_date=${yyyymmdd(now)}&end_date=${yyyymmdd(end)}`,
  );
  return (data.predictions ?? []).map((p: { t: string; v: string }) => ({
    time: p.t.replace(" ", "T"),
    height: Number(p.v),
  }));
}

async function fetchAlerts(): Promise<NwsAlert[]> {
  const out: NwsAlert[] = [];
  const seen = new Set<string>();
  const urls = [
    `https://api.weather.gov/alerts/active?zone=${MARINE_ZONE}`,
    `https://api.weather.gov/alerts/active?point=${LAT},${LON}`,
  ];
  for (const url of urls) {
    try {
      const data = await getJson(url);
      for (const f of data.features ?? []) {
        const p = f.properties ?? {};
        if (seen.has(f.id)) continue;
        seen.add(f.id);
        out.push({
          id: f.id,
          event: p.event ?? "Alert",
          headline: p.headline ?? p.event ?? "Marine alert",
          severity: p.severity ?? "Unknown",
          onset: p.onset ?? p.effective ?? null,
          ends: p.ends ?? p.expires ?? null,
          description: (p.description ?? "").slice(0, 900),
          url: p["@id"] ?? FISH_LINKS.alerts,
        });
      }
    } catch {
      /* other source may still answer */
    }
  }
  return out;
}

/** Latest Fishing the North Coast posts (RSS through a text relay). */
async function fetchLocalReports(): Promise<LocalReport[]> {
  const xml = await getRelayedText(FISH_LINKS.reportsFeed, (b) => /<item/i.test(b));
  if (!xml) throw new Error("reports feed unreachable");

  const items = xml.split(/<item[\s>]/i).slice(1, 7);
  const grab = (block: string, tag: string) => {
    const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
    if (!m) return "";
    return m[1]!
      .replace(/<!\[CDATA\[|\]\]>/g, "")
      .replace(/<[^>]+>/g, "")
      .replace(/&#8217;|&#8216;/g, "'")
      .replace(/&#8220;|&#8221;/g, '"')
      .replace(/&amp;/g, "&")
      .replace(/&nbsp;/g, " ")
      .trim();
  };

  return items
    .map((block) => ({
      title: grab(block, "title"),
      link: grab(block, "link") || FISH_LINKS.reports,
      date: grab(block, "pubDate") || null,
      summary: grab(block, "description").slice(0, 320),
    }))
    .filter((r) => r.title);
}

/* --------------------------------- assembly -------------------------------- */

export async function fetchFishReport(): Promise<FishReport> {
  const errors: string[] = [];
  const [buoyR, hourlyR, tidesR, alertsR, reportsR] = await Promise.allSettled([
    fetchBuoyHistory(),
    fetchHourly(),
    fetchTideEvents(),
    fetchAlerts(),
    fetchLocalReports(),
  ]);

  const buoyHistory = buoyR.status === "fulfilled" ? buoyR.value : [];
  if (!buoyHistory.length) errors.push(`Buoy ${BUOY_ID} feed unavailable`);
  const hourlyData = hourlyR.status === "fulfilled" ? hourlyR.value : { hourly: [], sun: [] };
  if (!hourlyData.hourly.length) errors.push("Hourly wind/sea forecast unavailable");
  const tides = tidesR.status === "fulfilled" ? tidesR.value : [];
  if (!tides.length) errors.push("Tide predictions unavailable");
  const alerts = alertsR.status === "fulfilled" ? alertsR.value : [];
  if (alertsR.status === "rejected") errors.push("NWS alert feed unavailable — check NWS directly");
  const reports = reportsR.status === "fulfilled" ? reportsR.value : [];
  if (!reports.length) errors.push("Local report feed unavailable");

  if (!buoyHistory.length && !hourlyData.hourly.length && !tides.length)
    throw new Error("No data sources reachable");

  return {
    fetchedAt: Date.now(),
    buoy: latestBuoy(buoyHistory),
    buoyHistory,
    hourly: hourlyData.hourly,
    tides,
    sun: hourlyData.sun,
    alerts,
    reports,
    errors,
  };
}

/* ---------------------------------- cache ---------------------------------- */

export function readFishCache(): FishReport | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FishReport;
    return parsed?.fetchedAt ? parsed : null;
  } catch {
    return null;
  }
}

export function writeFishCache(report: FishReport) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(report));
  } catch {
    /* quota or private mode */
  }
}

export function isFishStale(r: FishReport | null): boolean {
  return !r || Date.now() - r.fetchedAt > FISH_CACHE_TTL_MS;
}

/* -------------------------------- trip log --------------------------------- */

export type TripEntry = {
  id: string;
  date: string; // yyyy-mm-dd
  species: string;
  outcome: "caught" | "released" | "skunked";
  depthRange: string; // e.g. "70-110 ft" — no exact waypoints
  method: string;
  seaState: string;
  notes: string;
};

const LOG_KEY = "lcsm:triplog:v1";

export function readTripLog(): TripEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(LOG_KEY) ?? "[]") as TripEntry[];
  } catch {
    return [];
  }
}

export function writeTripLog(entries: TripEntry[]) {
  try {
    window.localStorage.setItem(LOG_KEY, JSON.stringify(entries));
  } catch {
    /* storage unavailable */
  }
}

/** Simple anonymized pattern lines from the private log. */
export function tripPatterns(entries: TripEntry[]): string[] {
  const hits = entries.filter((e) => e.outcome !== "skunked" && e.species.trim());
  if (hits.length < 2) return [];
  const bySpecies = new Map<string, TripEntry[]>();
  for (const e of hits) {
    const k = e.species.trim().toLowerCase();
    bySpecies.set(k, [...(bySpecies.get(k) ?? []), e]);
  }
  const out: string[] = [];
  for (const [species, list] of bySpecies) {
    if (list.length < 2) continue;
    const depths = list.map((e) => e.depthRange).filter(Boolean);
    const methods = [...new Set(list.map((e) => e.method).filter(Boolean))];
    out.push(
      `${species} — ${list.length} logged hookups` +
        (depths.length ? `, most often ${depths[0]}` : "") +
        (methods.length ? ` · ${methods.slice(0, 2).join(", ")}` : ""),
    );
  }
  return out;
}
