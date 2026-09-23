import type { PageSection, PageSeo } from './types';
export const homeSections: PageSection[] = [
  {
    "key": "breadth",
    "eyebrow": "The kitchen & the bar",
    "heading": "Made to be shared.",
    "body": "Handmade pasta, generous plates, a very good martini. Simple pleasures, considered carefully.",
    "visible": true,
    "variant": "stagger"
  },
  {
    "key": "two-paths",
    "eyebrow": "Catering",
    "heading": "Bring the supper club to you.",
    "body": "Pasta trays, antipasti and something sweet for the whole table.",
    "visible": true,
    "variant": "stagger"
  }
];
export const pageCopy = {
  "home": {
    "heroHeadlineLines": [
      "Stay for dinner.",
      "Leave much later."
    ],
    "heroBody": "Handmade pasta. Proper cocktails. A room that comes alive after dark. Italian-American hospitality in the heart of Chicago."
  },
  "menu": {
    "eyebrow": "At the table",
    "heading": "A little indulgence. A lot to share.",
    "body": "Old favorites, a few new rituals. From the first antipasto to the last spoon of tiramisu.",
    "unpricedNote": "Ask your server about seasonal selections."
  },
  "cocktails": {
    "eyebrow": "At the bar",
    "heading": "The usual, made memorable.",
    "body": "Bitter, bright, stirred and shaken. Italian aperitivo meets the American cocktail bar."
  },
  "events": {
    "eyebrow": "The social calendar",
    "heading": "Good evenings become traditions.",
    "body": "Vinyl on Thursdays. Long Sunday suppers. Cocktails that carry you into the weekend."
  },
  "catering": {
    "eyebrow": "Bring everyone",
    "heading": "Our table. Wherever you gather.",
    "body": "Office lunches, pasta trays and family-style feasts. Good hospitality travels.",
    "note": "Demo packages below are illustrative. Plan for 48 hours’ notice; a real team would confirm availability and delivery."
  },
  "privateEvents": {
    "eyebrow": "Private dining",
    "heading": "Make an evening of it.",
    "body": "Birthdays, rehearsal dinners, company gatherings and just-because celebrations. A private room, a generous table, a night that feels like yours."
  },
  "visit": {
    "eyebrow": "West Loop · Chicago",
    "heading": "There’s a place for you.",
    "body": "An imagined corner of Chicago, made for long dinners and unhurried nights."
  },
  "contact": {
    "eyebrow": "Come a little closer",
    "heading": "Meet us after five.",
    "body": "Cosa Nostra is a fictional restaurant and portfolio experience. Explore the room, plan a sample visit, or step behind the scenes."
  },
  "work": {
    "eyebrow": "Work with us",
    "heading": "Hospitality is a team sport.",
    "body": "Thoughtful service, busy evenings, shared staff meals. Bring your warmth and your curiosity.",
    "empty": "We always make room for good people. Leave a sample introduction."
  },
  "careers": {
    "eyebrow": "Careers",
    "heading": "Join the house. Stay for family meal.",
    "body": "Help make an ordinary evening feel exceptional. Explore fictional dining room, kitchen and bar roles at Cosa Nostra.",
    "energyHeading": "Good people. Great evenings.",
    "energyBody": "Our fictional team cares about the details: a remembered name, a perfectly timed course, the right record. Explore roles in the dining room, kitchen and bar. Sample applications stay in this demo.",
    "perks": [
      "Staff meals",
      "Flexible schedules",
      "Training & development"
    ],
    "marquee": "Warm hospitality • Good records • Shared tables"
  },
  "talent": {
    "eyebrow": "Set the mood",
    "heading": "Bring your sound to the room.",
    "body": "Selectors, musicians and photographers: show us what you make. We’re building a calendar with a point of view.",
    "disciplinesLead": "People we love hearing from"
  },
  "notFound": {
    "heading": "This one is off the menu.",
    "body": "The page you’re looking for has left for the evening. Let’s find you a better table."
  }
} as const;
export const seo: Record<string,PageSeo> = {
  "home": {
    "title": "Cosa Nostra — Italian Supper Club · Chicago",
    "description": "Handmade pasta. Proper cocktails. A room that comes alive after dark. Italian-American hospitality in the heart of Chicago.",
    "ogAssetId": null
  },
  "menu": {
    "title": "At The Table — Cosa Nostra",
    "description": "Old favorites, a few new rituals. From the first antipasto to the last spoon of tiramisu.",
    "ogAssetId": null
  },
  "cocktails": {
    "title": "At The Bar — Cosa Nostra",
    "description": "Bitter, bright, stirred and shaken. Italian aperitivo meets the American cocktail bar.",
    "ogAssetId": null
  },
  "events": {
    "title": "The Social Calendar — Cosa Nostra",
    "description": "Vinyl on Thursdays. Long Sunday suppers. Cocktails that carry you into the weekend.",
    "ogAssetId": null
  },
  "catering": {
    "title": "Bring Everyone — Cosa Nostra",
    "description": "Office lunches, pasta trays and family-style feasts. Good hospitality travels.",
    "ogAssetId": null
  },
  "privateEvents": {
    "title": "Private Dining — Cosa Nostra",
    "description": "Birthdays, rehearsal dinners, company gatherings and just-because celebrations. A private room, a generous table, a night that feels like yours.",
    "ogAssetId": null
  },
  "visit": {
    "title": "West Loop · Chicago — Cosa Nostra",
    "description": "An imagined corner of Chicago, made for long dinners and unhurried nights.",
    "ogAssetId": null
  },
  "contact": {
    "title": "Come A Little Closer — Cosa Nostra",
    "description": "Cosa Nostra is a fictional restaurant and portfolio experience. Explore the room, plan a sample visit, or step behind the scenes.",
    "ogAssetId": null
  },
  "work": {
    "title": "Work With Us — Cosa Nostra",
    "description": "Thoughtful service, busy evenings, shared staff meals. Bring your warmth and your curiosity.",
    "ogAssetId": null
  },
  "careers": {
    "title": "Join The — Cosa Nostra",
    "description": "Help make an ordinary evening feel exceptional. Explore fictional dining room, kitchen and bar roles at Cosa Nostra.",
    "ogAssetId": null
  },
  "talent": {
    "title": "Set The Mood — Cosa Nostra",
    "description": "Selectors, musicians and photographers: show us what you make. We’re building a calendar with a point of view.",
    "ogAssetId": null
  },
  "notFound": {
    "title": "Notfound — Cosa Nostra",
    "description": "The page you’re looking for has left for the evening. Let’s find you a better table.",
    "ogAssetId": null
  },
  "privacy": {
    "title": "Privacy — Cosa Nostra",
    "description": "How this fictional portfolio demo handles sample interactions.",
    "ogAssetId": null
  }
};
