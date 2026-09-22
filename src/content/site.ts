import type { Announcement, SiteSettings } from './types';
export const site: SiteSettings = {
  "name": "Cosa Nostra",
  "shortName": "Cosa Nostra",
  "tagline": "Italian Supper Club",
  "street": "West Loop",
  "locality": "Chicago",
  "region": "IL",
  "postalCode": "",
  "country": "US",
  "geo": null,
  "phone": {
    "value": "(312) 555-0147",
    "provisional": false
  },
  "altPhone": null,
  "email": "hello@example.invalid",
  "timeZone": "America/Chicago",
  "hours": {
    "value": [
      {
        "day": 0,
        "ranges": [
          {
            "openMinutes": 900,
            "closeMinutes": 1380
          }
        ]
      },
      {
        "day": 1,
        "ranges": [
          {
            "openMinutes": 960,
            "closeMinutes": 1380
          }
        ]
      },
      {
        "day": 2,
        "ranges": [
          {
            "openMinutes": 960,
            "closeMinutes": 1380
          }
        ]
      },
      {
        "day": 3,
        "ranges": [
          {
            "openMinutes": 960,
            "closeMinutes": 1380
          }
        ]
      },
      {
        "day": 4,
        "ranges": [
          {
            "openMinutes": 960,
            "closeMinutes": 1380
          }
        ]
      },
      {
        "day": 5,
        "ranges": [
          {
            "openMinutes": 960,
            "closeMinutes": 1500
          }
        ]
      },
      {
        "day": 6,
        "ranges": [
          {
            "openMinutes": 960,
            "closeMinutes": 1500
          }
        ]
      }
    ],
    "provisional": false
  },
  "temporaryClosures": [],
  "reservationUrl": "/reservations",
  "orderUrl": "/order",
  "cateringOrderUrl": "/catering#inquiry",
  "directionsUrl": "/contact#location",
  "socials": [
    {
      "platform": "instagram",
      "handle": "@cosanostra.demo · fictional",
      "url": "/contact"
    }
  ],
  "priceRange": "$$$",
  "cuisine": [
    "Italian-American",
    "Italian"
  ]
};
export const announcements: Announcement[] = [];
export const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'] as const;
export const DAY_NAMES_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'] as const;
