/**
 * Central asset registry.
 *
 * Components request assets by semantic ID — <Asset id="signaturePasta" /> — and
 * never by file path. Replacing the entire media package is therefore either a
 * one-line change per entry, or dropping a same-named file into public/media/.
 *
 * Human-readable view: docs/ASSET-MANIFEST.md
 * Slot requirements:   docs/ASSET-SLOT-SPECS.md
 * Validation:          npm run assets:check
 */

export type AssetStatus = 'final' | 'temp-wix' | 'placeholder' | 'brand';
export type AssetKind = 'image' | 'video' | 'vector' | 'texture';

export interface AssetRecord {
  /** Path under /public, or null when the slot has no acceptable asset yet. */
  path: string | null;
  kind: AssetKind;
  /**
   * Alt text. `null` marks the asset as decorative — it renders alt="" plus
   * aria-hidden. This is an explicit decision per slot, not a blank default.
   */
  alt: string | null;
  width: number;
  height: number;
  /** `w:h`, validated against width/height by the checker. */
  ratio: string;
  /** CSS object-position. Protects faces and food when the crop changes. */
  focal: string;
  /** Narrow-viewport focal override, when the safe area moves. */
  focalMobile?: string;
  /** Required for kind: 'video'. */
  poster?: string;
  /** Asset ID rendered instead below 768px, when one exists. */
  mobileVariant?: string;
  status: AssetStatus;
  /** Where this asset appears. Drives the "registered but unused" check. */
  usage: string[];
  source?: { url: string; retrieved: string };
  /**
   * Set when the image has words baked into the pixels. A series artwork asset
   * tagged 'date' fails the build — recurring artwork must never be the
   * authoritative date source. See PLAN.md §4.1.
   */
  containsText?: 'none' | 'brand' | 'date';
  maxBytes?: number;
}

export const assets = {
  "brandLogo": {
    "path": "/media/brandLogo.webp",
    "kind": "image",
    "alt": "Cosa Nostra Italian Supper Club",
    "width": 1000,
    "height": 260,
    "ratio": "1000:260",
    "focal": "50% 50%",
    "status": "brand",
    "usage": [
      "Cosa Nostra brandLogo semantic slot"
    ],
    "containsText": "brand",
    "maxBytes": 500000
  },
  "heroImage": {
    "path": "/media/heroImage.webp",
    "kind": "image",
    "alt": "An intimate dining room with dark upholstery and softly lit tables",
    "width": 1800,
    "height": 1200,
    "ratio": "1800:1200",
    "focal": "50% 50%",
    "status": "final",
    "usage": [
      "Cosa Nostra heroImage semantic slot"
    ],
    "containsText": "none",
    "maxBytes": 500000
  },
  "backBar": {
    "path": "/media/backBar.webp",
    "kind": "image",
    "alt": "Cocktail preparation in warm evening light",
    "width": 1000,
    "height": 1200,
    "ratio": "1000:1200",
    "focal": "50% 50%",
    "status": "final",
    "usage": [
      "Cosa Nostra backBar semantic slot"
    ],
    "containsText": "none",
    "maxBytes": 500000
  },
  "exteriorSign": {
    "path": "/media/exteriorSign.webp",
    "kind": "image",
    "alt": "Cosa Nostra fictional supper club entrance artwork",
    "width": 900,
    "height": 1125,
    "ratio": "900:1125",
    "focal": "50% 50%",
    "status": "final",
    "usage": [
      "Cosa Nostra exteriorSign semantic slot"
    ],
    "containsText": "brand",
    "maxBytes": 500000
  },
  "diningRoom": {
    "path": "/media/diningRoom.webp",
    "kind": "image",
    "alt": "Candlelit tables and upholstered chairs in an elegant dining room",
    "width": 1000,
    "height": 1200,
    "ratio": "1000:1200",
    "focal": "50% 50%",
    "status": "final",
    "usage": [
      "Cosa Nostra diningRoom semantic slot"
    ],
    "containsText": "none",
    "maxBytes": 500000
  },
  "signaturePasta": {
    "path": "/media/signaturePasta.webp",
    "kind": "image",
    "alt": "Spaghetti and meatballs with tomato sauce and fresh basil",
    "width": 1200,
    "height": 1000,
    "ratio": "1200:1000",
    "focal": "50% 50%",
    "status": "final",
    "usage": [
      "Cosa Nostra signaturePasta semantic slot"
    ],
    "containsText": "none",
    "maxBytes": 500000
  },
  "roomAtmosphere": {
    "path": "/media/roomAtmosphere.webp",
    "kind": "image",
    "alt": "An intimate corner with warm light and dark furniture",
    "width": 1200,
    "height": 800,
    "ratio": "1200:800",
    "focal": "50% 50%",
    "status": "final",
    "usage": [
      "Cosa Nostra roomAtmosphere semantic slot"
    ],
    "containsText": "none",
    "maxBytes": 500000
  },
  "bartender": {
    "path": "/media/bartender.webp",
    "kind": "image",
    "alt": "A bartender measuring a cocktail beside elegant glassware",
    "width": 900,
    "height": 1000,
    "ratio": "900:1000",
    "focal": "50% 50%",
    "status": "final",
    "usage": [
      "Cosa Nostra bartender semantic slot"
    ],
    "containsText": "none",
    "maxBytes": 500000
  },
  "dishPasta": {
    "path": "/media/dishPasta.webp",
    "kind": "image",
    "alt": "Italian pasta served with meatballs and herbs",
    "width": 1200,
    "height": 900,
    "ratio": "1200:900",
    "focal": "50% 50%",
    "status": "final",
    "usage": [
      "Cosa Nostra dishPasta semantic slot"
    ],
    "containsText": "none",
    "maxBytes": 500000
  },
  "burrataPlate": {
    "path": "/media/burrataPlate.webp",
    "kind": "image",
    "alt": "Burrata, prosciutto and basil on a decorative Italian plate",
    "width": 1200,
    "height": 900,
    "ratio": "1200:900",
    "focal": "50% 50%",
    "status": "final",
    "usage": [
      "Cosa Nostra burrataPlate semantic slot"
    ],
    "containsText": "none",
    "maxBytes": 500000
  },
  "cocktailPour": {
    "path": "/media/cocktailPour.webp",
    "kind": "image",
    "alt": "Hands preparing a cocktail at the bar",
    "width": 1000,
    "height": 1000,
    "ratio": "1000:1000",
    "focal": "50% 50%",
    "status": "final",
    "usage": [
      "Cosa Nostra cocktailPour semantic slot"
    ],
    "containsText": "none",
    "maxBytes": 500000
  },
  "houseNegroni": {
    "path": "/media/houseNegroni.webp",
    "kind": "image",
    "alt": "A red Negroni over a large ice cube on a marble table",
    "width": 1000,
    "height": 1200,
    "ratio": "1000:1200",
    "focal": "50% 50%",
    "status": "final",
    "usage": [
      "Cosa Nostra houseNegroni semantic slot"
    ],
    "containsText": "none",
    "maxBytes": 500000
  },
  "roomCrowd": {
    "path": "/media/roomCrowd.webp",
    "kind": "image",
    "alt": "The supper club dining atmosphere, set for an evening together",
    "width": 1200,
    "height": 900,
    "ratio": "1200:900",
    "focal": "50% 50%",
    "status": "final",
    "usage": [
      "Cosa Nostra roomCrowd semantic slot"
    ],
    "containsText": "none",
    "maxBytes": 500000
  },
  "cocktailPair": {
    "path": "/media/cocktailPair.webp",
    "kind": "image",
    "alt": "A classic Italian aperitivo in a low glass",
    "width": 1200,
    "height": 900,
    "ratio": "1200:900",
    "focal": "50% 50%",
    "status": "final",
    "usage": [
      "Cosa Nostra cocktailPair semantic slot"
    ],
    "containsText": "none",
    "maxBytes": 500000
  },
  "flyerFridays": {
    "path": "/media/flyerFridays.webp",
    "kind": "image",
    "alt": "Editorial illustration of guests dancing with cocktails",
    "width": 900,
    "height": 1125,
    "ratio": "900:1125",
    "focal": "50% 50%",
    "status": "final",
    "usage": [
      "Cosa Nostra flyerFridays semantic slot"
    ],
    "containsText": "none",
    "maxBytes": 500000
  },
  "flyerSaturday": {
    "path": "/media/flyerSaturday.webp",
    "kind": "image",
    "alt": "Two illustrated supper club guests enjoying the evening",
    "width": 900,
    "height": 1125,
    "ratio": "900:1125",
    "focal": "50% 50%",
    "status": "final",
    "usage": [
      "Cosa Nostra flyerSaturday semantic slot"
    ],
    "containsText": "none",
    "maxBytes": 500000
  },
  "privateEvents": {
    "path": "/media/privateEvents.webp",
    "kind": "image",
    "alt": "Elegant tables for a private dinner",
    "width": 1200,
    "height": 900,
    "ratio": "1200:900",
    "focal": "50% 50%",
    "status": "final",
    "usage": [
      "Cosa Nostra privateEvents semantic slot"
    ],
    "containsText": "none",
    "maxBytes": 500000
  },
  "birthdayCelebration": {
    "path": "/media/birthdayCelebration.webp",
    "kind": "image",
    "alt": "Italian antipasti made for a celebratory table",
    "width": 1200,
    "height": 900,
    "ratio": "1200:900",
    "focal": "50% 50%",
    "status": "final",
    "usage": [
      "Cosa Nostra birthdayCelebration semantic slot"
    ],
    "containsText": "none",
    "maxBytes": 500000
  },
  "flyerVinyl": {
    "path": "/media/flyerVinyl.webp",
    "kind": "image",
    "alt": "Vinyl and Vermouth editorial illustration",
    "width": 900,
    "height": 1125,
    "ratio": "900:1125",
    "focal": "50% 50%",
    "status": "final",
    "usage": [
      "Cosa Nostra flyerVinyl semantic slot"
    ],
    "containsText": "none",
    "maxBytes": 500000
  },
  "flyerSupper": {
    "path": "/media/flyerSupper.webp",
    "kind": "image",
    "alt": "Sunday Supper editorial illustration",
    "width": 900,
    "height": 1125,
    "ratio": "900:1125",
    "focal": "50% 50%",
    "status": "final",
    "usage": [
      "Cosa Nostra flyerSupper semantic slot"
    ],
    "containsText": "none",
    "maxBytes": 500000
  },
  "flyerAperitivo": {
    "path": "/media/flyerAperitivo.webp",
    "kind": "image",
    "alt": "Aperitivo Club editorial illustration",
    "width": 900,
    "height": 1125,
    "ratio": "900:1125",
    "focal": "50% 50%",
    "status": "final",
    "usage": [
      "Cosa Nostra flyerAperitivo semantic slot"
    ],
    "containsText": "none",
    "maxBytes": 500000
  },
  "teamEnergy": {
    "path": "/media/teamEnergy.webp",
    "kind": "image",
    "alt": "Thoughtful cocktail service for the evening",
    "width": 1200,
    "height": 800,
    "ratio": "1200:800",
    "focal": "50% 50%",
    "status": "final",
    "usage": [
      "Cosa Nostra teamEnergy semantic slot"
    ],
    "containsText": "none",
    "maxBytes": 500000
  },
  "roomNight": {
    "path": "/media/night/room-night.webp",
    "kind": "image",
    "alt": "The dining room after dark, candles lit on dark wood tables",
    "width": 1800,
    "height": 1200,
    "ratio": "1800:1200",
    "focal": "50% 60%",
    "status": "final",
    "usage": [
      "Homepage hero, Behind the Hospitality"
    ],
    "containsText": "none",
    "maxBytes": 300000
  },
  "roomNightTall": {
    "path": "/media/night/room-night-tall.webp",
    "kind": "image",
    "alt": "A candlelit table in the dining room after dark",
    "width": 960,
    "height": 1200,
    "ratio": "960:1200",
    "focal": "45% 70%",
    "status": "final",
    "usage": [
      "Homepage hero on phones, private dining"
    ],
    "containsText": "none",
    "maxBytes": 300000
  },
  "roomDetail": {
    "path": "/media/night/room-detail.webp",
    "kind": "image",
    "alt": "Two candles glowing on a dark wood table",
    "width": 1200,
    "height": 900,
    "ratio": "1200:900",
    "focal": "45% 55%",
    "status": "final",
    "usage": [
      "Evening chapters, visit"
    ],
    "containsText": "none",
    "maxBytes": 300000
  },
  "barNight": {
    "path": "/media/night/bar-night.webp",
    "kind": "image",
    "alt": "A bartender shaking a cocktail in low amber light",
    "width": 900,
    "height": 1000,
    "ratio": "900:1000",
    "focal": "45% 35%",
    "status": "final",
    "usage": [
      "Evening chapters, menu bar list"
    ],
    "containsText": "none",
    "maxBytes": 300000
  },
  "pastaNight": {
    "path": "/media/night/pasta-night.webp",
    "kind": "image",
    "alt": "Spaghetti and meatballs lifted from the bowl in warm light",
    "width": 1200,
    "height": 1000,
    "ratio": "1200:1000",
    "focal": "52% 40%",
    "status": "final",
    "usage": [
      "Homepage kitchen, menu"
    ],
    "containsText": "none",
    "maxBytes": 300000
  },
  "burrataNight": {
    "path": "/media/night/burrata-night.webp",
    "kind": "image",
    "alt": "Burrata with prosciutto and basil on a painted Italian plate",
    "width": 1200,
    "height": 900,
    "ratio": "1200:900",
    "focal": "50% 45%",
    "status": "final",
    "usage": [
      "Menu antipasti, catering"
    ],
    "containsText": "none",
    "maxBytes": 300000
  },
  "negroniPaper": {
    "path": "/media/night/negroni-paper.webp",
    "kind": "image",
    "alt": "A Negroni over a single large ice cube on marble",
    "width": 1000,
    "height": 1200,
    "ratio": "1000:1200",
    "focal": "50% 45%",
    "status": "final",
    "usage": [
      "Menu bar list, homepage bar"
    ],
    "containsText": "none",
    "maxBytes": 300000
  }
} as const satisfies Record<string, AssetRecord>;
export type AssetId = keyof typeof assets;
export function getAsset(id: AssetId):AssetRecord {return assets[id];}
export function ratioToCss(record:Pick<AssetRecord,'ratio'>):string{return record.ratio.replace(':',' / ');}
