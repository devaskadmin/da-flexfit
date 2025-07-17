const express = require('express');
const router = express.Router();
const axios = require('axios');

// GET /api/openfoodfacts-search
router.get('/openfoodfacts-search', async (req, res) => {
  const { query } = req.query;
  if (!query) {
    return res.status(400).json({ error: 'Missing search query' });
  }

  try {
    const response = await axios.get(`https://world.openfoodfacts.org/cgi/search.pl`, {
      params: {
        search_terms: query,
        search_simple: 1, // Simplified search
        json: 1,          // Return JSON response
      },
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching data from OpenFoodFacts:', error.message);
    res.status(500).json({ error: 'Failed to fetch data from OpenFoodFacts' });
  }
});

module.exports = router;