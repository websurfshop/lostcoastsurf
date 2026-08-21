/**
 * Local Board listings — real estate + classifieds.
 * Edit copy, price, specs and contact info here; each entry gets its own page
 * at /listing/<slug>.
 */

import aerial from "@/assets/listing/Aerial_Deer_court.jpg.asset.json";
import bigPicture from "@/assets/listing/big_picture.jpg.asset.json";
import boatLaunch from "@/assets/listing/Boat_launch.jpg.asset.json";
import culdesac from "@/assets/listing/Culdesac_Survey.jpg.asset.json";
import gentleSlope from "@/assets/listing/Gentle_Slope.jpg.asset.json";
import goodFishing from "@/assets/listing/Good_fishing.jpg.asset.json";
import map from "@/assets/listing/Map.jpg.asset.json";
import plotmap from "@/assets/listing/Plotmap_Survey.jpg.asset.json";
import taxiway from "@/assets/listing/Taxiway_30.jpg.asset.json";
import topOfLot from "@/assets/listing/Top_of_Lot.jpg.asset.json";
import topOfLot2 from "@/assets/listing/Top_of_Lot2.jpg.asset.json";
import view from "@/assets/listing/View.jpg.asset.json";
import viewLighthouse from "@/assets/listing/View_of_Lighthouse.jpg.asset.json";

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
    teaser: "Gentle-slope cul-de-sac lot with survey and topo done. Ocean and lighthouse views.",
    cta: "See the lot",
    price: "Contact for price",
    specs: [
      { label: "Type", value: "Vacant residential lot" },
      { label: "Location", value: "Deer Court cul-de-sac, Shelter Cove" },
      { label: "Views", value: "Ocean, Cape Mendocino lighthouse" },
      { label: "Terrain", value: "Gentle slope, guaranteed buildable" },
      { label: "Survey", value: "Survey + topo completed" },
      { label: "Nearby", value: "Airport taxiway, boat launch, Deadman's" },
    ],
    body: [
      "A rare gentle-slope parcel on a quiet Deer Court cul-de-sac in Shelter Cove, minutes from the boat launch, the airstrip, and the reef at Deadman's.",
      "The survey and topographic work are already complete and the lot is confirmed buildable, so you can go straight to design instead of spending a season on due diligence.",
      "Sightlines run out over the water toward the Cape Mendocino lighthouse, with black-sand beaches, salmon and rockfish grounds, and the whole King Range wilderness out the back door.",
    ],
    photos: [
      { src: bigPicture.url, alt: "Wide view over the Shelter Cove coastline from the parcel" },
      { src: aerial.url, alt: "Aerial view of the Deer Court cul-de-sac and surrounding lots" },
      { src: topOfLot.url, alt: "Standing at the top of the lot looking toward the ocean" },
      { src: topOfLot2.url, alt: "Second view from the top of the lot" },
      { src: view.url, alt: "Ocean view from the property" },
      { src: viewLighthouse.url, alt: "View toward the Cape Mendocino lighthouse" },
      { src: gentleSlope.url, alt: "Gentle slope across the buildable portion of the lot" },
      { src: taxiway.url, alt: "Shelter Cove airport taxiway near the property" },
      { src: boatLaunch.url, alt: "Shelter Cove boat launch" },
      { src: goodFishing.url, alt: "Fishing off the Shelter Cove coast" },
      { src: plotmap.url, alt: "Plot map with completed survey and topography" },
      { src: culdesac.url, alt: "Cul-de-sac engineering survey and topo drawing" },
      { src: map.url, alt: "Area map showing the parcel location in Shelter Cove" },
    ],
    location: {
      address: "Deer Court, Shelter Cove, CA 95589",
      mapsUrl: "https://www.google.com/maps/search/?api=1&query=Deer+Court+Shelter+Cove+CA+95589",
    },
    contact: {
      name: "Lost Coast Surf",
      email: "you@lostcoastsurf.com",
    },
  },
  {
    slug: "longboard-9-0",
    kind: "Classified",
    title: "9'0 longboard for sale",
    teaser: "Single-fin, water tight, includes bag. $450 OBO. Pick up in Ferndale.",
    cta: "Contact seller",
    price: "$450 OBO",
    specs: [
      { label: "Length", value: "9'0" },
      { label: "Setup", value: "Single fin" },
      { label: "Condition", value: "Water tight, minor pressure dings" },
      { label: "Includes", value: "Board bag" },
      { label: "Pickup", value: "Ferndale, CA" },
    ],
    body: [
      "Classic 9'0 single-fin longboard — glides on the soft, longer-period days at Shelter Cove and handles the walled-up ones fine too.",
      "Water tight with a few pressure dings from normal use. Comes with a board bag. Cash on pickup in Ferndale.",
    ],
    photos: [],
    contact: {
      name: "Lost Coast Surf",
      email: "you@lostcoastsurf.com",
    },
  },
];

export function getListing(slug: string): Listing | undefined {
  return LISTINGS.find((l) => l.slug === slug);
}
