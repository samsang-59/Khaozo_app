// AI one-line summary of a labelled dish (Must order / Mixed reviews) from its text reviews.
// Only public review text is sent — never reviewer names or any account data.
const SYSTEM = `You summarise what diners say about one dish at one restaurant in Bhubaneswar.
Write ONE short, neutral line (max 20 words) about taste, portion, spice or value, based only on the reviews.
No names, no emojis, no star numbers. Return ONLY JSON: {"summary": "..."}`;

export const dishSummaryPrompt = ({ dishName, placeName, label, reviews }) => ({
  system: SYSTEM,
  user: [
    `Dish: ${dishName} at ${placeName}`,
    `Label: ${label === 'must_order' ? 'Must order' : 'Mixed reviews'}`,
    'Reviews:',
    ...reviews.map((r) => `- ${r.slice(0, 300).replace(/\s+/g, ' ')}`),
  ].join('\n'),
});
