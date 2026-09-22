import type { CateringItem,CateringPackage } from './types';
export const cateringPackages: CateringPackage[] = [
  {
    "id": "office-table",
    "name": "The Office Table",
    "servesMin": 10,
    "servesMax": 12,
    "priceCents": 28500,
    "includes": [
      "Two trays of pasta",
      "House salad",
      "Rosemary focaccia",
      "Olive oil cake"
    ]
  },
  {
    "id": "sunday-table",
    "name": "The Sunday Table",
    "servesMin": 18,
    "servesMax": 20,
    "priceCents": 62000,
    "includes": [
      "Antipasti selection",
      "Rigatoni and Bolognese",
      "Chicken Parmigiana",
      "Tiramisu"
    ]
  },
  {
    "id": "grand-evening",
    "name": "The Grand Evening",
    "servesMin": 25,
    "servesMax": 30,
    "priceCents": 105000,
    "includes": [
      "Burrata and seasonal antipasti",
      "Three pasta selections",
      "Braised short rib",
      "Roasted vegetables",
      "Dessert assortment"
    ]
  }
];
export const cateringItems: CateringItem[] = [
  {
    "id": "spicy-rigatoni-tray",
    "name": "Spicy Rigatoni Tray",
    "priceCents": 9500,
    "note": "Serves 8–10. Fictional catering selection."
  },
  {
    "id": "bolognese-tray",
    "name": "Bolognese Tray",
    "priceCents": 11000,
    "note": "Serves 8–10. Fictional catering selection."
  },
  {
    "id": "antipasti-platter",
    "name": "Antipasti Platter",
    "priceCents": 8500,
    "note": "Serves 8–10. Fictional catering selection."
  },
  {
    "id": "chicken-parmigiana-tray",
    "name": "Chicken Parmigiana Tray",
    "priceCents": 12500,
    "note": "Serves 8–10. Fictional catering selection."
  },
  {
    "id": "house-salad",
    "name": "House Salad",
    "priceCents": 5500,
    "note": "Serves 8–10. Fictional catering selection."
  },
  {
    "id": "tiramisu-tray",
    "name": "Tiramisu Tray",
    "priceCents": 6500,
    "note": "Serves 8–10. Fictional catering selection."
  }
];
export const birthdayCelebration = {name:'An Evening Together',includes:['A family-style Italian menu','A candlelit table for your party','A celebratory dessert'],addOns:[{label:'Nonalcoholic welcome spritz',priceCents:1100},{label:'Seasonal dessert course',priceCents:1200}]};
export const privateEventTypes = ['Birthday','Rehearsal dinner','Company dinner','Engagement celebration','Full buyout','Other celebration'] as const;
