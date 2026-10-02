// Keyword parser — search step 2 fallback when AI is down, slow or out of budget.
// Simple rules over the sentence; whatever text is left becomes the dish (matched later with
// aliases + pg_trgm). areaNames: names from the areas table, to spot "near Patia".
import { EMPTY_FILTERS } from './schemas/searchFilters.js';

const PRICE = /(?:under|below|less than|within|up ?to|max(?:imum)?|budget(?: of)?|<)\s*(?:rs\.?|₹|inr)?\s*(\d{2,5})\b/i;
const RULES = [
  // [field, value, pattern]  — first match per field wins; order matters
  ['diet', 'non_veg', /\bnon[\s-]?veg(?:etarian)?\b/i],
  ['diet', 'veg', /\b(?:pure\s+veg|veg\s+only|vegetarian|veg)\b/i],
  ['spice', 'very_spicy', /\b(?:very|extra|super)\s+spicy\b/i],
  ['spice', 'mild', /\b(?:mild|not spicy|less spicy|non[\s-]?spicy)\b/i],
  ['spice', 'spicy', /\b(?:spicy|hot and spicy)\b/i],
  ['openNow', true, /\bopen(?:\s+now)?\b|\bright now\b/i],
  ['mealTime', 'Breakfast', /\bbreakfast\b/i],
  ['mealTime', 'Lunch', /\blunch\b/i],
  ['mealTime', 'Evening snacks', /\b(?:evening\s+)?snacks?\b/i],
  ['mealTime', 'Dinner', /\bdinner\b/i],
  ['mealTime', 'Late night', /\b(?:late[\s-]?night|midnight)\b/i],
  ['mood', 'Work', /\b(?:work(?:ing)?|laptop|wifi|wi-fi)\b/i],
  ['mood', 'Study', /\bstudy(?:ing)?\b/i],
  ['mood', 'Date', /\b(?:date|romantic)\b/i],
  ['mood', 'Family', /\bfamily\b/i],
  ['mood', 'Friends', /\bfriends?\b/i],
  ['mood', 'Solo', /\b(?:solo|alone)\b/i],
  ['mood', 'Quick bite', /\bquick(?:\s+bite)?\b/i],
  ['mood', 'Celebration', /\b(?:celebrat\w*|birthday|party|anniversary)\b/i],
  ['mood', 'Budget', /\b(?:cheap|budget|affordable|pocket[\s-]?friendly)\b/i],
  ['vibe', 'cozy', /\b(?:cozy|cosy)\b/i],
  ['vibe', 'rooftop', /\brooftop\b/i],
  ['vibe', 'aesthetic', /\baesthetic\b/i],
  ['vibe', 'calm', /\b(?:calm|peaceful|quiet)\b/i],
];

const FILLER = new Set(['best', 'good', 'great', 'nice', 'find', 'me', 'some', 'a', 'an', 'the', 'place', 'places', 'spot',
  'restaurant', 'restaurants', 'cafe', 'food', 'for', 'to', 'with', 'and', 'where', 'can', 'i', 'get', 'eat', 'want',
  'near', 'in', 'at', 'around', 'nearby', 'now', 'rs', 'inr', 'of', 'serving', 'that', 'serves', 'which', 'is', 'are', 'any']);

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const keywordParse = (sentence, areaNames = []) => {
  const filters = { ...EMPTY_FILTERS };
  let rest = ` ${sentence.toLowerCase()} `;

  const price = rest.match(PRICE);
  if (price) {
    filters.maxPrice = Number(price[1]);
    rest = rest.replace(price[0], ' ');
  }

  for (const [field, value, pattern] of RULES) {
    if (filters[field] !== null) continue;
    const m = rest.match(pattern);
    if (m) {
      filters[field] = value;
      rest = rest.replace(m[0], ' ');
    }
  }

  // Area: longest area name that appears in the sentence
  const area = [...areaNames]
    .sort((a, b) => b.length - a.length)
    .find((name) => new RegExp(`\\b${escape(name.toLowerCase())}\\b`).test(rest));
  if (area) {
    filters.area = area;
    rest = rest.replace(new RegExp(`\\b${escape(area.toLowerCase())}\\b`), ' ');
  }

  const dish = rest
    .replace(/[^\p{L}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w && !FILLER.has(w))
    .join(' ')
    .trim();
  filters.dish = dish || null;
  return filters;
};
