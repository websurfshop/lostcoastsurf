/**
 * Local Board listings — real estate + classifieds.
 * Edit copy, price, specs and contact info here; each entry gets its own page
 * at /listing/<slug>.
 */

// Photos live in public/listing/ so they ship as plain static files with the
// build output (works on Cloudflare Pages and any static host).
const P = "/listing";
const aerial = { url: `${P}/Aerial_Deer_court.jpg` };
const bigPicture = { url: `${P}/big_picture.jpg` };
const boatLaunch = { url: `${P}/Boat_launch.jpg` };
const culdesac = { url: `${P}/Culdesac_Survey.jpg` };
const gentleSlope = { url: `${P}/Gentle_Slope.jpg` };
const goodFishing = { url: `${P}/Good_fishing.jpg` };
const map = { url: `${P}/Map.jpg` };
const plotmap = { url: `${P}/Plotmap_Survey.jpg` };
const taxiway = { url: `${P}/Taxiway_30.jpg` };
const topOfLot = { url: `${P}/Top_of_Lot.jpg` };
const topOfLot2 = { url: `${P}/Top_of_Lot2.jpg` };
const view = { url: `${P}/View.jpg` };
const topo= { url: `${P}/topo.jpg` };
const viewLighthouse = { url: `${P}/View_of_Lighthouse.jpg` };
const whip = { url: `${P}/whip.jpg` };
const whip2 = { url: `${P}/whip2.jpg` };
const chainsaw = { url: `${P}/chainsaw.jpg` };
const brush = { url: `${P}/brush.jpg` };
const ride = { url: `${P}/ride.jpg` };

export type Photo = { src: string; alt: string };

export type Listing = {
  slug: string;
  kind: "Real Estate" | "Classified";
  title: string;
  /** One-line teaser used on the home page banner. */
  teaser: string;
  cta: string;
  price?: string;
  specs?: { label: string; value: string }[];
  /** Paragraphs of long-form copy. */
  body: string[];
  photos: Photo[];
  location?: { address: string; mapsUrl: string };
  contact: { name?: string; email?: string; phone?: string };
};

export const LISTINGS: Listing[] = [
  {
    slug: "deer-court-oceanview-parcel",
    kind: "Real Estate",
    title: "Buildable oceanview parcel — Deer Court, Shelter Cove",
    teaser: "Gentle-slope cul-de-sac lot with survey and topo done. Street to street access.  Ocean and lighthouse views.",
    cta: "See the lot",
    price: "$27,000",
    specs: [
      { label: "Type", value: "Vacant residential lot" },
      { label: "Location", value: "Deer Court cul-de-sac, Shelter Cove" },
      { label: "Views", value: "Ocean, Cape Mendocino lighthouse" },
      { label: "Terrain", value: "Gentle slope, guaranteed buildable" },
      { label: "Survey", value: "Survey, topography completed by Baird Engineering" },
      { label: "Engineering", value: "Soils engineering completed" },
      { label: "Financing", value: "Owner financing available" },
      { label: "Nearby", value: "Airport taxiway, boat launch, Deadman's" },
    ],
    body: [
      "A rare gentle-slope parcel on a quiet Deer Court cul-de-sac in Shelter Cove, minutes from the boat launch, the airstrip, and the reef at Deadman's.",
      "The survey, soils report, and topographic work are already complete and the lot is confirmed buildable, so you can go straight to build instead of spending a season on due diligence.",
      "Sightlines run out over the water toward the Cape Mendocino lighthouse, with black-sand beaches, salmon and rockfish grounds, and the whole King Range wilderness out the back door.",
      "Will build to suit, California Contractor License # 341185"
    ],
    photos: [
      { src: viewLighthouse.url, alt: "View toward the Cape Mendocino lighthouse" },
      { src: culdesac.url, alt: "Cul-de-sac engineering survey and topo drawing" },
      { src: view.url, alt: "Ocean view from the property" },
      { src: topOfLot.url, alt: "Standing at the top of the lot looking toward the ocean" },
      { src: topOfLot2.url, alt: "Second view from the top of the lot" },
      { src: gentleSlope.url, alt: "Gentle slope across the buildable portion of the lot" },
      { src: topo.url, alt: "Topographic map completed by Baird Engineering" },
      { src: viewLighthouse.url, alt: "View toward the Cape Mendocino lighthouse" },
      { src: plotmap.url, alt: "Plot map with completed survey and topography" },
      { src: taxiway.url, alt: "Shelter Cove airport taxiway near the property" },
      { src: boatLaunch.url, alt: "Shelter Cove boat launch" },
      { src: goodFishing.url, alt: "Fishing off the Shelter Cove coast" },
      { src: bigPicture.url, alt: "Wide view over the Shelter Cove coastline from the parcel" },
      { src: aerial.url, alt: "Aerial view of the Deer Court cul-de-sac and surrounding lots" },
      { src: map.url, alt: "Area map showing the parcel location in Shelter Cove" },
    ],
    location: {
      address: "Deer Court, Shelter Cove, CA 95589",
      mapsUrl: "https://www.google.com/maps/search/?api=1&query=Deer+Court+Shelter+Cove+CA+95589",
    },
    contact: {
      name: "Lost Coast Surf",
      email: "websurfshop@gmail.com",
      phone: "415-SURF-509 (415-787-3509)SMS/text"
    },
  },
  {
    slug: "Mowing-Lot-Clearing",
    kind: "Classified",
    title: "Mowing / Lot Clearing",
    teaser: "Weed whipping, chainsaw work, lawn and grass mowing. $25.",
    cta: "Contact ",
    price: "$25",
    specs: [
      { label: "Work", value: "Tree work, Yard work, Mowing" },
      { label: "Crew", value: "1-3 hearty boys" },
      { label: "Tools", value: "Chainsaw, weed whacker, Ride-on lawnmower" },
    ],
    body: [
      "Weed whipping, chainsaw work, lawn and grass mowing. $25.",
      "Good looking and reliable... lol",
    ],
    photos: [
      { src: whip.url, alt: "Weed whipping" },
      { src: ride.url, alt: "Mowing" },
      { src: brush.url, alt: "Brush clearing" },
      { src: whip2.url, alt: "Mowing" },
      { src: chainsaw.url, alt: "Tree cutting and limbing" },
    ],

    contact: {
      name: "Lost Coast Surfers",
      email: "websurfshop@gmail.com",
      phone: "415-SURF-509 (415-787-3509)SMS/text"
    },
  },
];

export function getListing(slug: string): Listing | undefined {
  return LISTINGS.find((l) => l.slug === slug);
}
