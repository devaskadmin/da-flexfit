// src/api/nutrition.js
export async function searchFoodFatSecret(search_expression) {
  const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/fatsecret-food-search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ search_expression })
  });
  if (!res.ok) throw new Error('Failed to search food');
  return await res.json();
}
