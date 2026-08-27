import { Link, createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  BUOY_ID,
  FISH_CACHE_TTL_MS,
  FISH_LINKS,
  type BuoyRow,
  type FishReport,
  type HourWind,
  type TideEvent,
  type TripEntry,
  agoLabel,
  clockLabel,
  dayShort,
  degToCompass,
  fetchFishReport,
  fishScore,
  fishWord,
  hourOf,
  isFishStale,
  isFutureLocal,
  nowLocalMs,
  pacificLabel,
  readFishCache,
  readTripLog,
  tripPatterns,
  writeFishCache,
  writeTripLog,
} from "@/lib/fishing";
import { CDFW, readRegulations, verifiedLabel, type Regulations } from "@/lib/regulations";

export const Route = createFileRoute("/fishing/")({
  head: () => ({
    meta: [
      { title: "Can I Fish? — Shelter Cove, CA Fishing Briefing" },
      {
        name: "description",
        content:
          "Live buoy 46022 conditions, morning wind window, tides, NWS marine alerts and CDFW Mendocino Management Area regulation links for fishing Shelter Cove, California.",
      },
      { property: "og:title", content: "Can I Fish? — Shelter Cove Fishing Briefing" },
      {
        property: "og:description",
        content:
          "Buoy 46022 now, the 6am–noon wind window, tide timing, marine alerts and CDFW regulation status for Shelter Cove on California's Lost Coast.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FishingPage;
});

const n1 = (v: number | null | undefined, d = 1) =>
  v == null || Number.isNaN(v) ? "—" : v.toFixed(d);

/* --------------------------------- helpers -------------------------------- */

/** Cosine-interpolated tide curve between the hi/lo predictions. */
function tideCurve(tides: TideEvent[], hours = 48) {
  if (tides.length < 2) return [] as { t: number; h: number }[];
  const pts = [...tides].sort((a, b) => stamp(a.time) - stamp(b.time));
  const start = nowLocalMs();
  const end = start + hours * 3600e3;
  const out: { t: number; h: number }[] = [];
  for (let t = start; t <= end; t += 15 * 60e3) {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]!;
      const b = pts[i + 1]!;
      const ta = stamp(a.time);
      const tb = stamp(b.time);
      if (t < ta || t > tb) continue;
      const f = (t - ta) / (tb - ta);
      out.push({ t, h: a.height + (b.height - a.height) * ((1 - Math.cos(Math.PI * f)) / 2) });
      break;
    }
  }
  return out;
}

const stamp = (iso: string) =>
  new Date(`${iso}${/[Zz+]|-\d\d:\d\d$/.test(iso.slice(10)) ? "" : "Z"}`).getTime();

function Spark({
  points,
  label,
  unit,
}: {
  points: { x: number; y: number | null }[];
  label: string;
  unit: string;
}) {
  const vals = points.map((p) => p.y).filter((v): v is number => v != null);
  if (vals.length < 2) return null;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const w = 320;
  const h = 56;
  const d = points
    .map((p, i) => {
      if (p.y == null) return null;
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p.y - min) / span) * (h - 8) - 4;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .filter(Boolean)
    .join(" ")
    .replace(/^L/, "M");

  return (
    <div className="border border-border bg-card/60 p-3">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {min.toFixed(1)}–{max.toFixed(1)} {unit}
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-14 w-full" preserveAspectRatio="none">
        <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary" />
      </svg>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
      <span>{children}</span>
      <span className="h-px flex-1 bg-foreground/15" />
    </h2>
  );
}

function Cell({ label, value, unit, sub }: {
  label: string;
  value: string;
  unit?: string;
  sub?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[104px] flex-col justify-between gap-5 bg-background p-4">
      <span className="text-[9px] font-bold uppercase text-muted-foreground">{label}</span>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-display text-3xl leading-none">
          {value}
          {unit ? <span className="ml-1 text-base">{unit}</span> : null}
        </span>
        {sub}
      </div>
    </div>
  );
}

/* ---------------------------------- page ---------------------------------- */

function FishingPage() {
  const [report, setReport] = useState<FishReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [regs, setRegs] = useState<Regulations>(() => readRegulations());
  const [log, setLog] = useState<TripEntry[]>([]);

  const load = useCallback(async (force = false) => {
    const cached = readFishCache();
    if (cached) setReport(cached);
    if (!force && !isFishStale(cached)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const fresh = await fetchFishReport();
      writeFishCache(fresh);
      setReport(fresh);
      setError(null);
    } catch {
      setError(
        cached
          ? "Refresh failed — showing the last cached briefing."
          : "Could not reach NOAA / NWS data right now.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setRegs(readRegulations());
    setLog(readTripLog());
    void load();
    const id = window.setInterval(() => void load(), FISH_CACHE_TTL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const buoy = report?.buoy ?? null;
  const score = fishScore({
    windSpeed: buoy?.windSpeed ?? null,
    waveHeight: buoy?.waveHeight ?? null,
    period: buoy?.dominantPeriod ?? null,
  });

  const morning = useMemo(
    () =>
      (report?.hourly ?? []).filter((h) => {
        const hr = hourOf(h.time);
        return hr >= 6 && hr <= 12 && stamp(h.time) >= nowLocalMs() - 36e5;
      }).slice(0, 14),
    [report],
  );

  const nextTides = (report?.tides ?? []).filter((t) => isFutureLocal(t.time)).slice(0, 4);
  const curve = useMemo(() => tideCurve(report?.tides ?? []), [report]);
  const today = report?.sun?.[0];
  const patterns = tripPatterns(log);

  const history = useMemo(
    () => [...(report?.buoyHistory ?? [])].sort((a, b) => a.time - b.time),
    [report],
  );

  return (
    <div className="sea min-h-screen bg-background font-mono text-foreground">
      <header className="sticky top-0 z-50 flex items-center justify-between gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className={`h-2 w-2 rounded-full bg-primary ${loading ? "animate-ping" : "animate-pulse"}`} />
          <Link to="/" className="text-[10px] font-bold uppercase tracking-widest hover:text-primary">
            ← Surf Monitor
          </Link>
        </div>
        <button
          onClick={() => void load(true)}
          className="text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-primary"
        >
          {report ? `fetched ${pacificLabel(report.fetchedAt)}` : "loading…"}
        </button>
      </header>

      <main className="mx-auto max-w-md space-y-8 px-4 py-8">
        {/* Safety alerts */}
        {(report?.alerts ?? []).length > 0 ? (
          <section className="animate-rise space-y-2">
            {report!.alerts.map((a) => (
              <a
                key={a.id}
                href={a.url}
                target="_blank"
                rel="noreferrer"
                className="block border-2 border-destructive bg-destructive/15 p-3"
              >
                <p className="text-[10px] font-bold uppercase tracking-widest text-destructive">
                  ⚠ {a.event} · {a.severity}
                </p>
                <p className="mt-1 text-xs leading-snug">{a.headline}</p>
                <p className="mt-2 text-[10px] uppercase text-muted-foreground">
                  {a.onset ? pacificLabel(Date.parse(a.onset), true) : "now"} →{" "}
                  {a.ends ? pacificLabel(Date.parse(a.ends), true) : "until cancelled"} · source →
                </p>
              </a>
            ))}
          </section>
        ) : (
          <section className="animate-rise border border-border bg-card/60 p-3 text-[10px] uppercase tracking-widest text-muted-foreground">
            No active NWS marine alerts for zone PZZ470 ·{" "}
            <a className="text-primary" href={FISH_LINKS.alerts} target="_blank" rel="noreferrer">
              verify
            </a>
          </section>
        )}

        {/* Hero */}
        <section className="animate-rise">
          <h1 className="mb-2 font-display text-5xl uppercase leading-none tracking-tight">
            Can I Fish?
          </h1>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Shelter Cove, CA · {regs.managementArea}
          </p>
          <div className="mt-4 flex items-baseline justify-between border-b-4 border-foreground/80 pb-2">
            <span className="font-display text-7xl italic leading-none tracking-tighter">
              {buoy ? score.toFixed(1) : "—"}
            </span>
            <div className="text-right">
              <p className="text-xs font-bold uppercase text-primary">
                {buoy ? fishWord(score) : "reading"}
              </p>
              <p className="font-display text-xl uppercase tracking-tight">Sea State</p>
            </div>
          </div>
          <p className="mt-3 border border-border bg-card/60 p-3 text-[10px] leading-relaxed text-muted-foreground">
            Conditions indicator only — not a launch decision. Consult current NWS warnings, harbor
            conditions, vessel limits, and local knowledge before you go.
          </p>
          {error ? (
            <p className="mt-3 text-[10px] uppercase tracking-wider text-destructive">{error}</p>
          ) : report?.errors.length ? (
            <p className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground">
              {report.errors.join(" · ")}
            </p>
          ) : null}
        </section>

        {/* Now — buoy 46022 */}
        <section className="animate-rise [animation-delay:100ms]">
          <SectionTitle>Now — Buoy {BUOY_ID} (Eel River)</SectionTitle>
          <div className="grid grid-cols-2 gap-px border border-border bg-border">
            <Cell
              label="Wind"
              value={n1(buoy?.windSpeed, 0)}
              unit="kt"
              sub={
                <span className="border border-foreground/60 px-1 text-xs font-bold">
                  {degToCompass(buoy?.windDir ?? null)}
                </span>
              }
            />
            <Cell label="Gusts" value={n1(buoy?.gust, 0)} unit="kt" />
            <Cell label="Wave Height" value={n1(buoy?.waveHeight)} unit="ft" />
            <Cell label="Dominant Period" value={n1(buoy?.dominantPeriod, 0)} unit="s" />
            <Cell
              label="Wave Direction"
              value={degToCompass(buoy?.meanWaveDir ?? null)}
              sub={
                <span className="text-base text-primary">
                  {buoy?.meanWaveDir != null ? `${Math.round(buoy.meanWaveDir)}°` : ""}
                </span>
              }
            />
            <Cell label="Water Temp" value={n1(buoy?.waterTemp, 0)} unit="°F" />
          </div>
          <p className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            Observed {buoy ? `${pacificLabel(buoy.time, true)} · ${agoLabel(buoy.time)}` : "—"} ·
            fetched {report ? pacificLabel(report.fetchedAt) : "—"} ·{" "}
            <a className="text-primary" href={FISH_LINKS.buoy} target="_blank" rel="noreferrer">
              NDBC {BUOY_ID}
            </a>
          </p>
        </section>

        {/* Trends */}
        <section className="animate-rise space-y-2 [animation-delay:150ms]">
          <SectionTitle>Buoy Trend — Last 48h</SectionTitle>
          {history.length > 2 ? (
            <>
              <Spark
                label="Wave Height"
                unit="ft"
                points={history.map((r: BuoyRow, i) => ({ x: i, y: r.waveHeight }))}
              />
              <Spark
                label="Wind Speed"
                unit="kt"
                points={history.map((r: BuoyRow, i) => ({ x: i, y: r.windSpeed }))}
              />
              <Spark
                label="Dominant Period"
                unit="s"
                points={history.map((r: BuoyRow, i) => ({ x: i, y: r.dominantPeriod }))}
              />
              <p className="text-[10px] uppercase text-muted-foreground">
                {history.length} observations · oldest {pacificLabel(history[0]!.time, true)}
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Buoy history unavailable.</p>
          )}
        </section>

        {/* Morning window */}
        <section className="animate-rise [animation-delay:200ms]">
          <SectionTitle>Morning Window — 6 AM to Noon</SectionTitle>
          <p className="mb-3 text-[10px] leading-relaxed text-muted-foreground">
            Afternoon northerlies usually decide the day here. These are the hours that matter.
          </p>
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-3">
            {morning.length === 0 ? (
              <p className="text-xs text-muted-foreground">Hourly forecast loading…</p>
            ) : (
              morning.map((h: HourWind) => {
                const s = fishScore({
                  windSpeed: h.windSpeed,
                  waveHeight: h.waveHeight,
                  period: h.wavePeriod,
                });
                return (
                  <div
                    key={h.time}
                    className={`w-24 flex-shrink-0 border p-3 ${
                      s >= 7 ? "border-primary" : "border-border"
                    } bg-card/60`}
                  >
                    <p
                      className={`mb-3 text-[9px] font-bold ${
                        s >= 7 ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {dayShort(h.time)} {clockLabel(h.time)}
                    </p>
                    <p className="font-display text-2xl">{n1(h.windSpeed, 0)}kt</p>
                    <p className="text-[9px] uppercase">
                      {degToCompass(h.windDirection)} · G{n1(h.windGust, 0)}
                    </p>
                    <p className="mt-1 text-[9px] uppercase text-muted-foreground">
                      sea {n1(h.waveHeight)}ft {n1(h.wavePeriod, 0)}s
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Tides + sun */}
        <section className="animate-rise [animation-delay:250ms]">
          <SectionTitle>Tide Timing & Daylight</SectionTitle>
          <div className="mb-3 grid grid-cols-2 gap-px border border-border bg-border">
            <div className="bg-background p-3">
              <p className="text-[9px] uppercase text-muted-foreground">Sunrise</p>
              <p className="font-display text-2xl">
                {today?.sunrise ? clockLabel(today.sunrise) : "—"}
              </p>
            </div>
            <div className="bg-background p-3">
              <p className="text-[9px] uppercase text-muted-foreground">Sunset</p>
              <p className="font-display text-2xl">
                {today?.sunset ? clockLabel(today.sunset) : "—"}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {nextTides.length === 0 ? (
              <p className="text-xs text-muted-foreground">Tide predictions unavailable.</p>
            ) : (
              nextTides.map((t, i) => (
                <div
                  key={t.time}
                  className="flex items-center justify-between border-b border-border py-1 text-sm last:border-0"
                >
                  <span className={i === 0 ? "text-primary" : ""}>
                    {i === 0 ? "Next " : ""}
                    {t.type === "H" ? "High" : "Low"}
                    <span className="ml-2 text-[10px] uppercase text-muted-foreground">
                      {dayShort(t.time)} · {t.type === "H" ? "↑ flooding to" : "↓ ebbing to"}
                    </span>
                  </span>
                  <span className="font-bold">
                    {t.height.toFixed(1)} ft
                    <span className="ml-2 font-normal text-muted-foreground">
                      {clockLabel(t.time)}
                    </span>
                  </span>
                </div>
              ))
            )}
          </div>
          {curve.length > 4 ? (
            <div className="mt-3">
              <Spark
                label="Tide Plot — Next 48h (ft MLLW)"
                unit="ft"
                points={curve.map((p, i) => ({ x: i, y: p.h }))}
              />
            </div>
          ) : null}
          <a
            className="mt-2 inline-block text-[10px] uppercase text-primary"
            href={FISH_LINKS.tides}
            target="_blank"
            rel="noreferrer"
          >
            Full NOAA tide table →
          </a>
        </section>

        {/* Targets / regulations */}
        <section className="animate-rise [animation-delay:300ms]">
          <SectionTitle>Targets & Regulations</SectionTitle>
          <div className="mb-3 border border-primary/60 bg-card/60 p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
              Verified {verifiedLabel(regs.lastVerified)}
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
              {regs.managementArea} — {regs.areaBounds}. CDFW is the legal authority; this page is a
              convenience summary that can lag an in-season change.
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-[10px] uppercase">
              <a className="text-primary" href={CDFW.mendocinoMap} target="_blank" rel="noreferrer">
                CDFW Mendocino rules →
              </a>
              <a className="text-primary" href={CDFW.inSeason} target="_blank" rel="noreferrer">
                In-season changes →
              </a>
              <Link className="text-muted-foreground" to="/fishing/admin">
                update →
              </Link>
            </div>
          </div>
          <div className="space-y-2">
            {regs.targets.map((t) => (
              <a
                key={t.id}
                href={t.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="block border border-border bg-card/60 p-3 transition-colors hover:border-primary/60"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-lg uppercase leading-tight">{t.name}</h3>
                  <span
                    className={`border px-1 text-[9px] font-bold uppercase ${
                      t.status === "open"
                        ? "border-primary text-primary"
                        : t.status === "closed"
                          ? "border-destructive text-destructive"
                          : "border-foreground/40 text-muted-foreground"
                    }`}
                  >
                    {t.status === "check" ? "verify at CDFW" : t.status}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-snug">{t.headline}</p>
                <dl className="mt-2 space-y-1 text-[10px] text-muted-foreground">
                  <div>
                    <dt className="inline font-bold uppercase">Season: </dt>
                    <dd className="inline">{t.season}</dd>
                  </div>
                  <div>
                    <dt className="inline font-bold uppercase">Limits: </dt>
                    <dd className="inline">{t.limits}</dd>
                  </div>
                  <div>
                    <dt className="inline font-bold uppercase">Size: </dt>
                    <dd className="inline">{t.sizeLimits}</dd>
                  </div>
                  <div>
                    <dt className="inline font-bold uppercase">Notes: </dt>
                    <dd className="inline">{t.notes}</dd>
                  </div>
                </dl>
                <p className="mt-2 text-[10px] font-bold uppercase text-primary">CDFW source →</p>
              </a>
            ))}
          </div>
        </section>

        {/* Local reports */}
        <section className="animate-rise [animation-delay:350ms]">
          <SectionTitle>Latest Local Reports</SectionTitle>
          {(report?.reports ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Report feed unavailable right now — read them at{" "}
              <a className="text-primary" href={FISH_LINKS.reports} target="_blank" rel="noreferrer">
                Fishing the North Coast
              </a>
              .
            </p>
          ) : (
            <div className="space-y-2">
              {report!.reports.map((r) => (
                <a
                  key={r.link}
                  href={r.link}
                  target="_blank"
                  rel="noreferrer"
                  className="block border border-border bg-card/60 p-3 transition-colors hover:border-primary/60"
                >
                  <p className="text-[11px] font-bold leading-snug">{r.title}</p>
                  {r.date ? (
                    <p className="mt-1 text-[9px] uppercase text-muted-foreground">{r.date}</p>
                  ) : null}
                  <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                    {r.summary}
                  </p>
                </a>
              ))}
            </div>
          )}
          <p className="mt-2 text-[10px] uppercase text-muted-foreground">
            Source: Fishing the North Coast (Shelter Cove reports via Jake Mitchell, Sea Hawk Sport
            Fishing)
          </p>
        </section>

        {/* Private trip log */}
        <TripLog log={log} setLog={setLog} patterns={patterns} />

        {/* Fish ID / release */}
        <section className="animate-rise space-y-2 [animation-delay:450ms]">
          <SectionTitle>Fish ID & Release Protocol</SectionTitle>
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            A descending device must be on board and ready when fishing groundfish — barotrauma
            kills released rockfish that aren't returned to depth. Rules change; use CDFW's live
            guidance, not this page.
          </p>
          <ExtLink href={CDFW.speciesId}>CDFW Fish ID resources</ExtLink>
          <ExtLink href={CDFW.descendingDevice}>Descending device requirements</ExtLink>
          <ExtLink href={CDFW.mpa}>Marine Protected Areas & closed zones</ExtLink>
        </section>

        <footer className="space-y-6 border-t border-border pt-4">
          <div className="grid gap-2">
            <ExtLink href={FISH_LINKS.marineForecast}>NWS Marine Forecast (Eureka)</ExtLink>
            <ExtLink href={FISH_LINKS.webcam}>FAA Live Webcam — Shelter Cove</ExtLink>
            <ExtLink href={FISH_LINKS.harbor}>Shelter Cove harbor & launch info</ExtLink>
            <ExtLink href={CDFW.oceanHub}>CDFW Ocean Fishing hub</ExtLink>
          </div>
          <div className="pb-12 text-center text-[9px] uppercase leading-relaxed tracking-widest text-muted-foreground">
            Lost Coast Surf Monitor · lostcoastsurf.com/fishing
            <br />
            Data cached 30 min · NDBC {BUOY_ID}, NOAA CO-OPS, NWS alerts, Open-Meteo
            <br />
            Conditions indicator only — not a launch decision. Verify boundaries and regulations
            with CDFW.
          </div>
        </footer>
      </main>
    </div>
  );
}

/* --------------------------------- trip log -------------------------------- */

function TripLog({
  log,
  setLog,
  patterns,
}: {
  log: TripEntry[];
  setLog: (e: TripEntry[]) => void;
  patterns: string[];
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    species: "",
    outcome: "caught" as TripEntry["outcome"],
    depthRange: "",
    method: "",
    seaState: "",
    notes: "",
  });

  const save = () => {
    const entry: TripEntry = { id: crypto.randomUUID(), ...form };
    const next = [entry, ...log];
    setLog(next);
    writeTripLog(next);
    setForm({ ...form, species: "", depthRange: "", method: "", seaState: "", notes: "" });
    setOpen(false);
  };

  const remove = (id: string) => {
    const next = log.filter((e) => e.id !== id);
    setLog(next);
    writeTripLog(next);
  };

  const field = "w-full border border-input bg-background p-2 text-xs";

  return (
    <section className="animate-rise [animation-delay:400ms]">
      <SectionTitle>My Trip Log (private)</SectionTitle>
      <p className="mb-3 text-[10px] leading-relaxed text-muted-foreground">
        Stored only in this browser. Log depth <em>ranges</em>, never exact waypoints.
      </p>

      {patterns.length > 0 ? (
        <div className="mb-3 border border-primary/60 bg-card/60 p-3">
          <p className="text-[9px] font-bold uppercase tracking-widest text-primary">Your patterns</p>
          <ul className="mt-1 space-y-1 text-[10px] text-muted-foreground">
            {patterns.map((p) => (
              <li key={p}>· {p}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <button
        onClick={() => setOpen((v) => !v)}
        className="mb-3 w-full border border-primary bg-primary/10 p-2 text-[10px] font-bold uppercase tracking-widest text-primary"
      >
        {open ? "Cancel" : "+ Log a trip"}
      </button>

      {open ? (
        <div className="mb-3 space-y-2 border border-border bg-card/60 p-3">
          <input
            className={field}
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
          <input
            className={field}
            placeholder="Species (e.g. lingcod)"
            value={form.species}
            onChange={(e) => setForm({ ...form, species: e.target.value })}
          />
          <select
            className={field}
            value={form.outcome}
            onChange={(e) => setForm({ ...form, outcome: e.target.value as TripEntry["outcome"] })}
          >
            <option value="caught">Caught / kept</option>
            <option value="released">Released</option>
            <option value="skunked">Skunked</option>
          </select>
          <input
            className={field}
            placeholder="Depth range (e.g. 70–110 ft)"
            value={form.depthRange}
            onChange={(e) => setForm({ ...form, depthRange: e.target.value })}
          />
          <input
            className={field}
            placeholder="Method (jig, bait, trolling…)"
            value={form.method}
            onChange={(e) => setForm({ ...form, method: e.target.value })}
          />
          <input
            className={field}
            placeholder="Sea state (2 ft @ 9s, light NW…)"
            value={form.seaState}
            onChange={(e) => setForm({ ...form, seaState: e.target.value })}
          />
          <textarea
            className={field}
            rows={2}
            placeholder="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          <button
            onClick={save}
            className="w-full bg-primary p-2 text-[10px] font-bold uppercase tracking-widest text-primary-foreground"
          >
            Save entry
          </button>
        </div>
      ) : null}

      <div className="space-y-2">
        {log.length === 0 ? (
          <p className="text-xs text-muted-foreground">No trips logged yet.</p>
        ) : (
          log.map((e) => (
            <div key={e.id} className="border border-border bg-card/60 p-3 text-[10px]">
              <div className="flex items-center justify-between">
                <span className="font-bold uppercase">
                  {e.date} · {e.species || "—"} · {e.outcome}
                </span>
                <button
                  onClick={() => remove(e.id)}
                  className="uppercase text-muted-foreground hover:text-destructive"
                >
                  delete
                </button>
              </div>
              <p className="mt-1 text-muted-foreground">
                {[e.depthRange, e.method, e.seaState].filter(Boolean).join(" · ")}
              </p>
              {e.notes ? <p className="mt-1 text-muted-foreground">{e.notes}</p> : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-between border border-foreground/25 p-3 text-[10px] font-bold uppercase transition-colors hover:bg-foreground hover:text-background"
    >
      <span>{children}</span>
      <span>→</span>
    </a>
  );
}
