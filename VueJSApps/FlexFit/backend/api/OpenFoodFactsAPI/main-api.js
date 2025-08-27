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
        search_simple: 1,
        json: 1,
      },
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching data from OpenFoodFacts:', error.message);
    res.status(500).json({ error: 'Failed to Load data.' });
  }
});

// GET /api/openfoodfacts-product?code=xxxx
router.get('/openfoodfacts-product', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'Missing product code' });
  try {
    const response = await axios.get(`https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(code)}.json`);
    res.json(response.data);
  } catch (err) {
    console.error('Error fetching product:', err.message);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// GET /api/openfoodfacts-get-category
router.get('/openfoodfacts-get-category', async (req, res) => {
  try {
    const response = await axios.get('https://world.openfoodfacts.org/categories.json');
    const categories = (response.data.tags || []).map(tag => tag.name).filter(Boolean);
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories from OpenFoodFacts:', error.message);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// GET /api/openfoodfacts-get-brandname
router.get('/openfoodfacts-get-brandname', async (req, res) => {
  try {
    const response = await axios.get('https://world.openfoodfacts.org/brands.json');
    const brands = (response.data.tags || []).map(tag => tag.name).filter(Boolean);
    res.json(brands);
  } catch (error) {
    console.error('Error fetching brands from OpenFoodFacts:', error.message);
    res.status(500).json({ error: 'Failed to fetch brands' });
  }
});

// GET /api/openfoodfacts-get-labels
router.get('/openfoodfacts-get-labels', async (req, res) => {
  try {
    const response = await axios.get('https://world.openfoodfacts.org/labels.json');
    const labels = (response.data.tags || []).map(tag => tag.name).filter(Boolean);
    res.json(labels);
  } catch (error) {
    console.error('Error fetching labels from OpenFoodFacts:', error.message);
    res.status(500).json({ error: 'Failed to fetch labels' });
  }
});

module.exports = router;