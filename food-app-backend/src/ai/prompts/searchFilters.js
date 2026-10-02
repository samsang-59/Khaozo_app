// Search step 2 prompt: one English sentence → JSON filters. Only the search sentence is sent
// (never user names, emails or notes).
import { MOODS, MEAL_TIMES } from '../schemas/searchFilters.js';

const SYSTEM = `You turn a food search sentence from Bhubaneswar, India into JSON filters.
Return ONLY a JSON object with exactly these keys (use null when not mentioned):
- "dish": the dish or food the person wants, e.g. "chicken biryani", "momos", "dahibara aloodum" (null if none)
- "spice": one of "mild", "medium", "spicy", "very_spicy"
- "maxPrice": number in rupees for "under / below / within ₹N"
- "area": a Bhubaneswar locality or landmark mentioned, e.g. "Patia", "KIIT", "Saheed Nagar"
- "openNow": true if they want somewhere open now
- "mood": one of ${MOODS.map((m) => `"${m}"`).join(', ')}
- "mealTime": one of ${MEAL_TIMES.map((m) => `"${m}"`).join(', ')}
- "diet": "veg" (vegetarian / pure veg), "egg", or "non_veg"
- "vibe": a feel of the place not covered above, e.g. "cozy", "rooftop", "quiet" (null if none)
Do not invent values that are not in the sentence.`;

export const searchFiltersPrompt = (sentence) => ({ system: SYSTEM, user: sentence.slice(0, 300) });
