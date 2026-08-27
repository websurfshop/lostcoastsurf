import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import {
  CDFW,
  DEFAULT_REGULATIONS,
  clearRegulations,
  readRegulations,
  verifiedLabel,
  writeRegulations,
  type RegStatus,
  type Regulations,
} from "@/lib/regulations";

export const Route = createFileRoute("/fishing/admin")({
  head: () => ({
    meta: [
      { title: "Regulation Editor — Can I Fish? Shelter Cove" },
      {
        name: "description",
        content:
          "Update the CDFW Mendocino Management Area regulation summary shown on the Shelter Cove fishing briefing after an in-season notice.",
      },
      { property: "og:title", content: "Regulation Editor — Can I Fish? Shelter Cove" },
      {
        property: "og:description",
        content: "Fast in-season editor for the Shelter Cove fishing regulation summary.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RegAdmin,
});

const field = "w-full border border-input bg-background p-2 text-xs";

function RegAdmin() {
  const [regs, setRegs] = useState<Regulations>(DEFAULT_REGULATIONS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setRegs(readRegulations());
  }, []);

  const patchTarget = (id: string, patch: Partial<Regulations["targets"][number]>) =>
    setRegs({
      ...regs,
      targets: regs.targets.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    });

  const save = () => {
    const next = { ...regs, lastVerified: new Date().toISOString().slice(0, 10) };
    setRegs(next);
    writeRegulations(next);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };

  const reset = () => {
    clearRegulations();
    setRegs(DEFAULT_REGULATIONS);
  };

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(regs, null, 2));
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="sea min-h-screen bg-background font-mono text-foreground">
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur-sm">
        <Link to="/fishing" className="text-[10px] font-bold uppercase tracking-widest hover:text-primary">
          ← Can I Fish?
        </Link>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Regulation editor
        </span>
      </header>

      <main className="mx-auto max-w-md space-y-6 px-4 py-8">
        <section>
          <h1 className="font-display text-3xl uppercase leading-none">Regulation Editor</h1>
          <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
            Edits are stored in this browser only and take effect immediately on the briefing page.
            Use “Copy JSON” and paste the result into <code>src/lib/regulations.ts</code> to ship the
            change to every visitor on the next deploy.
          </p>
          <p className="mt-2 text-[10px] uppercase tracking-widest text-primary">
            Last verified {verifiedLabel(regs.lastVerified)}
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-[10px] uppercase">
            <a className="text-primary" href={CDFW.mendocinoMap} target="_blank" rel="noreferrer">
              CDFW Mendocino →
            </a>
            <a className="text-primary" href={CDFW.inSeason} target="_blank" rel="noreferrer">
              In-season changes →
            </a>
          </div>
        </section>

        <section className="space-y-4">
          {regs.targets.map((t) => (
            <div key={t.id} className="space-y-2 border border-border bg-card/60 p-3">
              <h2 className="font-display text-lg uppercase">{t.name}</h2>
              <select
                className={field}
                value={t.status}
                onChange={(e) => patchTarget(t.id, { status: e.target.value as RegStatus })}
              >
                <option value="open">Open</option>
                <option value="closed">Closed</option>
                <option value="restricted">Restricted</option>
                <option value="check">Verify at CDFW</option>
              </select>
              <textarea
                className={field}
                rows={2}
                value={t.headline}
                onChange={(e) => patchTarget(t.id, { headline: e.target.value })}
                placeholder="Headline"
              />
              <textarea
                className={field}
                rows={2}
                value={t.season}
                onChange={(e) => patchTarget(t.id, { season: e.target.value })}
                placeholder="Season dates"
              />
              <input
                className={field}
                value={t.limits}
                onChange={(e) => patchTarget(t.id, { limits: e.target.value })}
                placeholder="Bag limits"
              />
              <input
                className={field}
                value={t.sizeLimits}
                onChange={(e) => patchTarget(t.id, { sizeLimits: e.target.value })}
                placeholder="Size limits"
              />
              <textarea
                className={field}
                rows={2}
                value={t.notes}
                onChange={(e) => patchTarget(t.id, { notes: e.target.value })}
                placeholder="Notes"
              />
              <input
                className={field}
                value={t.sourceUrl}
                onChange={(e) => patchTarget(t.id, { sourceUrl: e.target.value })}
                placeholder="CDFW source URL"
              />
            </div>
          ))}
        </section>

        <section className="space-y-2 pb-16">
          <button
            onClick={save}
            className="w-full bg-primary p-3 text-[10px] font-bold uppercase tracking-widest text-primary-foreground"
          >
            Save & stamp verified today
          </button>
          <button
            onClick={copyJson}
            className="w-full border border-primary p-3 text-[10px] font-bold uppercase tracking-widest text-primary"
          >
            Copy JSON for regulations.ts
          </button>
          <button
            onClick={reset}
            className="w-full border border-border p-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
          >
            Reset to shipped defaults
          </button>
          {saved ? (
            <p className="text-center text-[10px] uppercase tracking-widest text-primary">Done ✓</p>
          ) : null}
        </section>
      </main>
    </div>
  );
}
