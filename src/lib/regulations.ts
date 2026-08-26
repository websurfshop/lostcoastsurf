/**
 * CDFW regulation snapshot for the Mendocino Management Area
 * (Cape Mendocino to Point Arena) — Shelter Cove sits inside this area.
 *
 * CDFW publishes no stable public API for ocean sport regulations, so this file
 * is the hand-verified record of record. The /fishing/admin page can override it
 * in the browser (localStorage) for an immediate in-season fix, and the export
 * button produces the JSON to paste back here so the change ships in the build.
 *
 * ALWAYS confirm against the CDFW source link before fishing.
 */

export const CDFW = {
  mendocinoMap:
    "https://wildlife.ca.gov/Fishing/Ocean/Regulations/Fishing-Map/Mendocino",
  oceanHub: "https://wildlife.ca.gov/Fishing/Ocean",
  inSeason: "https://wildlife.ca.gov/Fishing/Ocean/Regulations/In-Season-Changes",
  groundfish: "https://wildlife.ca.gov/Fishing/Ocean/Regulations/Groundfish",
  salmon: "https://wildlife.ca.gov/Fishing/Ocean/Regulations/Salmon",
  crab: "https://wildlife.ca.gov/Fishing/Ocean/Regulations/Crab",
  halibut: "https://wildlife.ca.gov/Fishing/Ocean/Regulations/Pacific-Halibut",
  mpa: "https://wildlife.ca.gov/Conservation/Marine/MPAs",
  speciesId: "https://wildlife.ca.gov/Fishing/Ocean/Fish-ID",
  descendingDevice:
    "https://wildlife.ca.gov/Fishing/Ocean/Descending-Devices",
} as const;

export type RegStatus = "open" | "closed" | "restricted" | "check";

export type Target = {
  id: string;
  name: string;
  status: RegStatus;
  headline: string;
  season: string;
  limits: string;
  sizeLimits: string;
  notes: string;
  sourceUrl: string;
};

export type Regulations = {
  managementArea: string;
  areaBounds: string;
  lastVerified: string; // ISO date, when a human checked CDFW
  verifiedBy: string;
  targets: Target[];
};

export const DEFAULT_REGULATIONS: Regulations = {
  managementArea: "Mendocino Management Area",
  areaBounds: "Cape Mendocino (40°10'00\" N) to Point Arena (38°57'30\" N)",
  lastVerified: "2026-08-26",
  verifiedBy: "Lost Coast Surf Monitor",
  targets: [
    {
      id: "groundfish",
      name: "Rockfish / Lingcod",
      status: "check",
      headline: "Season and depth limits change in-season — verify before you run out.",
      season:
        "Recreational groundfish typically opens in spring and closes at year end, with a depth constraint that shifts through the season.",
      limits:
        "Rockfish: 10 fish daily aggregate (sub-limits apply). Lingcod: 2 fish daily.",
      sizeLimits: "Lingcod 22 in minimum. Cabezon 15 in. Greenling 12 in.",
      notes:
        "Depth restriction (fathom line) is the number that changes most often. Descending device required to be rigged and ready when fishing groundfish.",
      sourceUrl: CDFW.groundfish,
    },
    {
      id: "halibut",
      name: "Pacific Halibut",
      status: "check",
      headline: "Quota-driven — the fishery closes when the CA quota is reached.",
      season:
        "Open days are set annually by IPHC/CDFW and the season can close early on quota attainment.",
      limits: "1 fish per day, 1 in possession (no size limit).",
      sizeLimits: "None.",
      notes:
        "Requires a Pacific Halibut Report Card. Check CDFW for the current open dates and any early closure notice.",
      sourceUrl: CDFW.halibut,
    },
    {
      id: "salmon",
      name: "Salmon (Chinook)",
      status: "check",
      headline: "Ocean salmon seasons for the KMZ/Fort Bragg areas are set each spring.",
      season:
        "Set annually by the Pacific Fishery Management Council; recent years have included full closures.",
      limits: "Set with the annual season — commonly 2 fish daily when open.",
      sizeLimits: "Minimum size varies by area and season (often 20 in or 24 in).",
      notes:
        "Ocean Salmon Report Card required. No retention of coho at any time. Confirm the current-year regulation before running gear.",
      sourceUrl: CDFW.salmon,
    },
    {
      id: "crab",
      name: "Dungeness Crab",
      status: "check",
      headline: "Recreational season opens in early November, subject to delays.",
      season:
        "Typically the first Saturday in November through July 30, north of Point Arena; openers are often delayed for whale entanglement risk or domoic acid.",
      limits: "10 crab per day.",
      sizeLimits: "5.75 in minimum carapace width.",
      notes:
        "Trap restrictions and fleet advisories apply. Check the CDFW crab page and the marine health advisory before setting gear.",
      sourceUrl: CDFW.crab,
    },
    {
      id: "shore",
      name: "Shore / Rock Fishing",
      status: "check",
      headline: "Shore fishing for many species stays open when boat depth limits do not.",
      season:
        "Some species may be taken from shore, piers, and jetties outside boat-based groundfish depth constraints.",
      limits: "Species-specific; the general groundfish bag limits still apply.",
      sizeLimits: "Species-specific.",
      notes:
        "Know the MPA boundaries around Shelter Cove before casting — closed-area lines are legal boundaries and this site is not the authority on them.",
      sourceUrl: CDFW.mendocinoMap,
    },
  ],
};

const OVERRIDE_KEY = "lcsm:regs:v1";

export function readRegulations(): Regulations {
  if (typeof window === "undefined") return DEFAULT_REGULATIONS;
  try {
    const raw = window.localStorage.getItem(OVERRIDE_KEY);
    if (!raw) return DEFAULT_REGULATIONS;
    const parsed = JSON.parse(raw) as Regulations;
    if (!parsed?.targets?.length) return DEFAULT_REGULATIONS;
    return parsed;
  } catch {
    return DEFAULT_REGULATIONS;
  }
}

export function writeRegulations(regs: Regulations) {
  try {
    window.localStorage.setItem(OVERRIDE_KEY, JSON.stringify(regs));
  } catch {
    /* storage unavailable */
  }
}

export function clearRegulations() {
  try {
    window.localStorage.removeItem(OVERRIDE_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function verifiedLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  const days = Math.floor((Date.now() - d.getTime()) / 864e5);
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
  if (days <= 0) return `${date} (today)`;
  return `${date} (${days} day${days === 1 ? "" : "s"} ago)`;
}
