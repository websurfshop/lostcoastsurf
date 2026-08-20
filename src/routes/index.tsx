import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import {
  BREAK,
  BUOY_ID,
  CACHE_TTL_MS,
  LINKS,
  type SurfReport,
  dayLabel,
  degToCompass,
  fetchReport,
  isFuture,
  isStale,
  ratingWord,
  readCache,
  stampLabel,
  timeLabel,
  windLabel,
  writeCache,
} from "@/lib/surf";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lost Coast Surf Monitor — Deadman's, Shelter Cove CA" },
      {
        name: "description",
        content:
          "Cached 30-minute surf report for Deadman's, Shelter Cove: swell height, period, direction, wind, tides, water temp and buoy 46022 observations.",
      },
      { property: "og:title", content: "Lost Coast Surf Monitor — Deadman's, Shelter Cove" },
      {
        property: "og:description",
        content:
          "Swell, wind, tide and buoy 46022 conditions for Deadman's on California's Lost Coast.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const n1 = (v: number | null | undefined, d = 1) =>
  v == null || Number.isNaN(v) ? "—" : v.toFixed(d);

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
      <span>{children}</span>
      <span className="h-px flex-1 bg-foreground/10" />
    </h2>
  );
}

function Cell({
  label,
  value,
  unit,
  sub,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[112px] flex-col justify-between gap-6 bg-background p-4">
      <span className="text-[9px] font-bold uppercase text-muted-foreground">{label}</span>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-display text-4xl leading-none">
          {value}
          {unit ? <span className="ml-1 text-lg">{unit}</span> : null}
        </span>
        {sub}
      </div>
    </div>
  );
}

function Index() {
  const [report, setReport] = useState<SurfReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    const cached = readCache();
    if (cached) setReport(cached);
    if (!force && !isStale(cached)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const fresh = await fetchReport();
      writeCache(fresh);
      setReport(fresh);
      setError(null);
    } catch {
      setError(
        cached
          ? "Refresh failed — showing the last cached report."
          : "Could not reach NOAA / marine data right now.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), CACHE_TTL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const c = report?.current;
  const upcomingTides = (report?.tides ?? [])
    .filter((t) => isFuture(t.time))
    .slice(0, 6);
  const timeline = (report?.hourly ?? []).filter((_, i) => i % 3 === 0).slice(0, 16);

  return (
    <div className="min-h-screen bg-background font-mono text-foreground">
      <header className="sticky top-0 z-50 flex items-center justify-between gap-3 border-b border-foreground/10 bg-background/90 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div
            className={`h-2 w-2 rounded-full bg-primary ${loading ? "animate-ping" : "animate-pulse"}`}
          />
          <span className="text-[10px] font-bold uppercase tracking-widest">
            Station {BUOY_ID} // Eel River Buoy
          </span>
        </div>
        <button
          onClick={() => void load(true)}
          className="text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-primary"
        >
          {report ? `30m cached: ${stampLabel(report.fetchedAt)}` : "loading…"}
        </button>
      </header>

      <main className="mx-auto max-w-md space-y-8 px-4 py-8">
        <section className="animate-rise">
          <h1 className="mb-2 text-[10px] uppercase tracking-[0.2em]">
            Break: {BREAK.name} / {BREAK.area}
          </h1>
          <div className="flex items-baseline justify-between border-b-4 border-foreground pb-2">
            <span className="font-display text-8xl italic leading-none tracking-tighter">
              {c ? c.score.toFixed(1) : "—"}
            </span>
            <div className="text-right">
              <p className="text-xs font-bold uppercase text-primary">
                {c ? ratingWord(c.score) : "reading"}
              </p>
              <p className="font-display text-2xl uppercase tracking-tight">Conditions</p>
            </div>
          </div>
          {error ? (
            <p className="mt-3 text-[10px] uppercase tracking-wider text-primary">{error}</p>
          ) : null}
        </section>

        <section className="grid animate-rise grid-cols-2 gap-px border border-foreground/10 bg-foreground/10 [animation-delay:100ms]">
          <Cell label="Swell Height" value={n1(c?.swellHeight)} unit="ft" />
          <Cell label="Period" value={n1(c?.swellPeriod, 0)} unit="s" />
          <Cell
            label="Swell Direction"
            value={degToCompass(c?.swellDirection ?? null)}
            sub={
              <span className="text-lg text-primary">
                {c?.swellDirection != null ? `${Math.round(c.swellDirection)}°` : ""}
              </span>
            }
          />
          <Cell
            label="Wind"
            value={n1(c?.windSpeed, 0)}
            unit="kt"
            sub={
              <span className="border border-foreground px-1 text-xs font-bold">
                {windLabel(c?.windDirection ?? null)}
              </span>
            }
          />
          <Cell label="Wave Height" value={n1(c?.waveHeight)} unit="ft" />
          <Cell label="Water Temp" value={n1(c?.waterTemp, 0)} unit="°F" />
          <Cell label="Air Temp" value={n1(c?.airTemp, 0)} unit="°F" />
          <Cell label="Pressure" value={n1(c?.pressure, 0)} unit="mb" />
        </section>

        <section className="animate-rise [animation-delay:200ms]">
          <SectionTitle>Tide Cycle</SectionTitle>
          <div className="space-y-2">
            {upcomingTides.length === 0 ? (
              <p className="text-xs text-muted-foreground">Tide predictions unavailable.</p>
            ) : (
              upcomingTides.map((t, i) => (
                <div
                  key={t.time}
                  className="flex items-center justify-between border-b border-foreground/5 py-1 text-sm last:border-0"
                >
                  <span className={i === 0 ? "text-primary" : ""}>
                    {i === 0 ? "Next " : ""}
                    {t.type === "H" ? "High" : "Low"} Tide
                    <span className="ml-2 text-[10px] uppercase text-muted-foreground">
                      {dayLabel(t.time)}
                    </span>
                  </span>
                  <span className="font-bold">
                    {t.height.toFixed(1)} ft
                    <span className="ml-2 font-normal text-muted-foreground">
                      {timeLabel(t.time)}
                    </span>
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="animate-rise [animation-delay:300ms]">
          <SectionTitle>48h Forecast Timeline</SectionTitle>
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-4">
            {timeline.map((h) => (
              <div
                key={h.time}
                className={`w-24 flex-shrink-0 border p-3 ${
                  h.score >= 7 ? "border-primary" : "border-foreground/10"
                } bg-card/60`}
              >
                <p
                  className={`mb-4 text-[9px] font-bold ${
                    h.score >= 7 ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {dayLabel(h.time)} {timeLabel(h.time)}
                </p>
                <p className="font-display text-2xl">{n1(h.swellHeight)}ft</p>
                <p className="text-[9px] uppercase">
                  {n1(h.swellPeriod, 0)}s · {windLabel(h.windDirection)} {n1(h.windSpeed, 0)}kt
                </p>
              </div>
            ))}
            {timeline.length === 0 ? (
              <p className="text-xs text-muted-foreground">Forecast loading…</p>
            ) : null}
          </div>
        </section>

        <section className="animate-rise [animation-delay:400ms]">
          <SectionTitle>Rideable Windows — Next 5 Days</SectionTitle>
          <div className="space-y-2">
            {(report?.windows ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No windows scoring 5.5+ in the next five days.
              </p>
            ) : (
              report!.windows.map((w) => (
                <div
                  key={`${w.day}-${w.start}`}
                  className="flex items-center justify-between border border-foreground/10 p-3"
                >
                  <div>
                    <p className="text-xs font-bold uppercase">
                      {w.day} · {w.start} – {w.end}
                    </p>
                    <p className="text-[10px] uppercase text-muted-foreground">{w.note}</p>
                  </div>
                  <span className="font-display text-2xl text-primary">{w.score.toFixed(1)}</span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="animate-rise rounded-xs bg-foreground p-6 text-background [animation-delay:500ms]">
          <h3 className="mb-4 text-[10px] font-bold uppercase tracking-widest text-primary">
            Break Profile: {BREAK.name}
          </h3>
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-[11px]">
            <div>
              <p className="mb-1 uppercase text-background/40">Break Type</p>
              <p className="font-bold">{BREAK.type}</p>
            </div>
            <div>
              <p className="mb-1 uppercase text-background/40">Facing</p>
              <p className="font-bold">{BREAK.facingLabel}</p>
            </div>
            <div>
              <p className="mb-1 uppercase text-background/40">Best Wind</p>
              <p className="font-bold">{BREAK.bestWind}</p>
            </div>
            <div>
              <p className="mb-1 uppercase text-background/40">Best Tide</p>
              <p className="font-bold">{BREAK.bestTide}</p>
            </div>
          </div>
        </section>

        <section className="animate-rise [animation-delay:600ms]">
          <SectionTitle>Buoy {BUOY_ID} — Eel River</SectionTitle>
          {report?.buoy ? (
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-[11px]">
              <Row label="Wave Height" value={`${n1(report.buoy.waveHeight)} ft`} />
              <Row label="Dominant Period" value={`${n1(report.buoy.dominantPeriod, 0)} s`} />
              <Row
                label="Mean Wave Dir"
                value={`${degToCompass(report.buoy.meanWaveDir)} ${
                  report.buoy.meanWaveDir ?? "—"
                }°`}
              />
              <Row
                label="Wind"
                value={`${degToCompass(report.buoy.windDir)} ${n1(report.buoy.windSpeed, 0)} kt`}
              />
              <Row label="Water Temp" value={`${n1(report.buoy.waterTemp, 0)} °F`} />
              <Row label="Air Temp" value={`${n1(report.buoy.airTemp, 0)} °F`} />
              <Row label="Pressure" value={`${n1(report.buoy.pressure, 1)} mb`} />
              <Row label="Gust" value={`${n1(report.buoy.gust, 0)} kt`} />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Buoy feed unavailable — check the station page below.
            </p>
          )}
        </section>

        <footer className="space-y-6 border-t border-foreground/10 pt-4">
          <div className="grid grid-cols-1 gap-2">
            <ExtLink href={LINKS.webcam}>FAA Live Webcam: Shelter Cove</ExtLink>
            <ExtLink href={LINKS.tides}>NOAA Tide Tables — Shelter Cove</ExtLink>
            <ExtLink href={LINKS.marine}>NWS Marine Forecast (Eureka)</ExtLink>
            <ExtLink href={LINKS.weather}>NWS Weather Forecast — Shelter Cove</ExtLink>
            <ExtLink href={LINKS.buoy}>NDBC Station {BUOY_ID}</ExtLink>
          </div>
          <div className="pb-12 text-center text-[9px] uppercase tracking-widest text-muted-foreground">
            Lost Coast Surf Monitor · lostcoastsurf.com
            <br />
            Data cached 30 min · NOAA CO-OPS, NDBC {BUOY_ID}, Open-Meteo Marine
            <br />
            Conditions are estimates. Verify in person — the Lost Coast is remote.
          </div>
        </footer>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-foreground/5 py-1">
      <span className="uppercase text-muted-foreground">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-between border border-foreground/20 p-3 text-[10px] font-bold uppercase transition-colors hover:bg-foreground hover:text-background"
    >
      <span>{children}</span>
      <span>&rarr;</span>
    </a>
  );
}
