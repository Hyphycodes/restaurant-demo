import type { EventSeries, OneTimeEventSeed } from './types';
export const eventSeries: EventSeries[] = [
  {
    "slug": "vinyl-vermouth",
    "title": "Vinyl & Vermouth",
    "summary": "Records spinning. Martinis cold. Dinner optional.",
    "description": "Our Thursday listening ritual. Resident selectors move between soul, disco, Italian classics and tasteful house. Order a vermouth over ice, share a few plates, and settle in.",
    "cadence": {
      "kind": "weekly",
      "weekday": 4
    },
    "startMinutes": 1200,
    "endMinutes": 1380,
    "ageMin": 21,
    "ageNote": "Cocktail service for guests 21+.",
    "musicFormats": [
      "Soul",
      "Disco",
      "Italian classics"
    ],
    "venueName": "Casa Aurelia · West Loop",
    "artworkAssetId": null,
    "flyerAssetId": "flyerVinyl",
    "flyerPrintedDate": null,
    "ticketUrl": null,
    "priceCents": 0,
    "ticketPolicy": "free",
    "status": "scheduled",
    "seriesEndsOn": null
  },
  {
    "slug": "sunday-supper",
    "title": "Sunday Supper",
    "summary": "Pass the pasta. Pour another glass.",
    "description": "A generous family-style dinner: antipasti, two pastas, a slow-cooked main and something sweet. $58 per person. The dishes change; the hospitality stays.",
    "cadence": {
      "kind": "weekly",
      "weekday": 0
    },
    "startMinutes": 1020,
    "endMinutes": 1260,
    "ageMin": null,
    "ageNote": "All ages welcome.",
    "musicFormats": [
      "Jazz",
      "Italian classics"
    ],
    "venueName": "Casa Aurelia · West Loop",
    "artworkAssetId": null,
    "flyerAssetId": "flyerSupper",
    "flyerPrintedDate": null,
    "ticketUrl": null,
    "priceCents": 5800,
    "ticketPolicy": "door",
    "status": "scheduled",
    "seriesEndsOn": null
  },
  {
    "slug": "after-hours-friday",
    "title": "After Hours Friday",
    "summary": "Dinner ends. The night doesn’t.",
    "description": "Friday evenings drift into cocktails and music. House, disco and R&B from our resident selectors, with room to talk and a little room to dance.",
    "cadence": {
      "kind": "weekly",
      "weekday": 5
    },
    "startMinutes": 1320,
    "endMinutes": 1500,
    "ageMin": 21,
    "ageNote": "Cocktail service for guests 21+.",
    "musicFormats": [
      "House",
      "Disco",
      "R&B"
    ],
    "venueName": "Casa Aurelia · West Loop",
    "artworkAssetId": null,
    "flyerAssetId": "flyerFridays",
    "flyerPrintedDate": null,
    "ticketUrl": null,
    "priceCents": 0,
    "ticketPolicy": "free",
    "status": "scheduled",
    "seriesEndsOn": null
  },
  {
    "slug": "after-hours-saturday",
    "title": "After Hours Saturday",
    "summary": "One more record. One more round.",
    "description": "Saturday at the supper club: candlelight, late cocktails and a selection of records made for staying a little longer.",
    "cadence": {
      "kind": "weekly",
      "weekday": 6
    },
    "startMinutes": 1320,
    "endMinutes": 1500,
    "ageMin": 21,
    "ageNote": "Cocktail service for guests 21+.",
    "musicFormats": [
      "Soul",
      "House",
      "Disco"
    ],
    "venueName": "Casa Aurelia · West Loop",
    "artworkAssetId": null,
    "flyerAssetId": "flyerSaturday",
    "flyerPrintedDate": null,
    "ticketUrl": null,
    "priceCents": 0,
    "ticketPolicy": "free",
    "status": "scheduled",
    "seriesEndsOn": null
  },
  {
    "slug": "aperitivo-club",
    "title": "Aperitivo Club",
    "summary": "Your evening starts here.",
    "description": "Wednesday spritzes, martinis and small plates. A seat at the bar and a reason to linger before dinner.",
    "cadence": {
      "kind": "weekly",
      "weekday": 3
    },
    "startMinutes": 1020,
    "endMinutes": 1200,
    "ageMin": 21,
    "ageNote": "Cocktail service for guests 21+.",
    "musicFormats": [
      "Jazz",
      "Soul"
    ],
    "venueName": "Casa Aurelia · West Loop",
    "artworkAssetId": null,
    "flyerAssetId": "flyerAperitivo",
    "flyerPrintedDate": null,
    "ticketUrl": null,
    "priceCents": 0,
    "ticketPolicy": "free",
    "status": "scheduled",
    "seriesEndsOn": null
  }
];
export const eventOverrides: {seriesSlug:string;date:string;status?:'sold-out'|'cancelled'|'postponed'|'free';ticketUrl?:string;priceCents?:number|null}[] = [];
const dateAfter = (days:number) => {const d=new Date();d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};
export const oneTimeEvents: OneTimeEventSeed[] = [
 {id:'demo-vinyl-opening',slug:'vinyl-vermouth-session',title:'Vinyl & Vermouth: The Listening Table',summary:'An intimate evening of records, aperitivo and Italian plates.',description:'A special listening session with resident selectors. Your sample ticket includes an aperitivo and a shared antipasti course. All reservations and sales in this portfolio are fictional.',date:dateAfter(3),startMinutes:20*60,endMinutes:24*60,category:'vinyl-vermouth',visualPreset:'brass',priceText:'$28',ticketUrl:null,sourceUrl:'https://example.invalid/demo-1',sourceEventId:'demo-1'},
 {id:'demo-sunday-table',slug:'sunday-supper-special',title:'Sunday Supper: A Seat at the Table',summary:'Four family-style courses. One long, lovely evening.',description:'Seasonal antipasti, handmade pasta, braised short rib and tiramisu. A fictional showcase of the supper club ticketing experience.',date:dateAfter(5),startMinutes:17*60,endMinutes:21*60,category:'special',visualPreset:'brass',priceText:'$58',ticketUrl:null,sourceUrl:'https://example.invalid/demo-2',sourceEventId:'demo-2'},
 {id:'demo-pasta-night',slug:'pasta-night',title:'Pasta Night',summary:'Three pastas. A glass of wine. No rush.',description:'A rotating menu from the pasta kitchen, served in three generous courses. This is a fictional event in our portfolio calendar.',date:dateAfter(9),startMinutes:18*60,endMinutes:22*60,category:'special',visualPreset:'brass',priceText:'$45',ticketUrl:null,sourceUrl:'https://example.invalid/demo-3',sourceEventId:'demo-3'},
];
