// Code-level sanity (data model Step 7): no "Chicken + veg", no "Egg + veg".
// Used when a user adds a new dish and when admin creates / approves one.
const MEAT_OR_FISH = new Set(['Chicken', 'Mutton', 'Fish', 'Prawn', 'Crab']);

export const dietClash = (ingredientName, diet) => {
  if (!ingredientName) return false;
  if (MEAT_OR_FISH.has(ingredientName)) return diet !== 'non_veg';
  if (ingredientName === 'Egg') return diet === 'veg';
  return false;
};
