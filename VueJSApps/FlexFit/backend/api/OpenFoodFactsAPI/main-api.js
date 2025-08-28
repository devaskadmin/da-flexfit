const express = require('express');
const router = express.Router();
const axios = require('axios');

// Helper: axios get with simple retry/backoff
const axiosGetWithRetry = async (url, opts = {}, retries = 2, backoffMs = 500) => {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const cfg = Object.assign({ timeout: 10000 }, opts);
      return await axios.get(url, cfg);
    } catch (err) {
      lastErr = err;
      // If no more retries, break and throw
      if (i === retries) break;
      // backoff
      await new Promise(r => setTimeout(r, backoffMs * (i + 1)));
    }
  }
  throw lastErr;
};

// GET /api/openfoodfacts-search
router.get('/openfoodfacts-search', async (req, res) => {
  const { query } = req.query;
  if (!query) {
    return res.status(400).json({ error: 'Missing search query' });
  }

  try {
    const response = await axiosGetWithRetry(`https://world.openfoodfacts.org/cgi/search.pl`, {
      params: {
        search_terms: query,
        search_simple: 1,
        json: 1,
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching data from OpenFoodFacts:', error && error.message || error);
    // If axios provided a response (e.g., 502 from upstream), forward status and body where possible
    if (error && error.response) {
      const status = error.response.status || 502;
      const data = error.response.data || { error: error.message || 'Upstream error' };
      return res.status(status).json({ error: data });
    }
    res.status(502).json({ error: error.message || 'Failed to load data from OpenFoodFacts' });
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