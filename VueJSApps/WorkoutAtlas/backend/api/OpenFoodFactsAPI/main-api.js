const express = require('express');
const router = express.Router();
const axios = require('axios');

const DEBUG = process.env.DEBUG === 'true' || process.env.DEBUG === '1';

/* ------------------------ Helpers ------------------------ */

// axios GET with simple retry/backoff
const axiosGetWithRetry = async (url, opts = {}, retries = 2, backoffMs = 500) => {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const cfg = Object.assign({ timeout: 10000 }, opts);
      return await axios.get(url, cfg);
    } catch (err) {
      lastErr = err;
      if (i === retries) break;
      await new Promise(r => setTimeout(r, backoffMs * (i + 1)));
    }
  }
  throw lastErr;
};

// normalize OFF tag like "en:walmart" => "walmart"
const normalizeTag = (t) => {
  if (!t) return '';
  const s = String(t).toLowerCase().trim();
  return (s.includes(':') ? s.split(':')[1] : s).replace(/[^a-z0-9_-]/g, '');
};

const ensureArray = (v) => Array.isArray(v) ? v : (v == null ? [] : [v]);

// add a tag filter block to OFF v1 params using next available index
const addTagFilter = (params, { type, contains = 'contains', value }) => {
  let i = 1;
  while (params[`tagtype_${i}`]) i++;
  params[`tagtype_${i}`] = type;
  params[`tag_contains_${i}`] = contains;
  params[`tag_${i}`] = value;
};

/* ------------------------ Routes ------------------------ */

/**
 * GET /api/openfoodfacts-search
 * Examples:
 *   /api/openfoodfacts-search?query=chicken
 *   /api/openfoodfacts-search?store=walmart
 *   /api/openfoodfacts-search?query=protein&store=walmart&country=United%20States&page_size=200
 */
router.get('/openfoodfacts-search', async (req, res) => {
  const { query } = req.query;
  if (!query) {
    return res.status(400).json({ error: 'Missing search query' });
  }

  try {
    // Always search for store 'harris teeter'
    const params = {
      action: 'process',
      search_terms: query,
      tagtype_1: 'stores',
      tag_contains_1: 'contains',
      tag_1: 'harris teeter',
      sort_by: 'unique_scans_n',
      page_size: 20,
      json: 1
    };
    const qs = new URLSearchParams(params).toString();
    const requestUrl = `https://world.openfoodfacts.org/cgi/search.pl?${qs}`;
    if (DEBUG) console.log('OpenFoodFacts Nutrition URL:', requestUrl);
    const response = await axiosGetWithRetry('https://world.openfoodfacts.org/cgi/search.pl', { params });
    const products = Array.isArray(response.data?.products) ? response.data.products : [];
    res.json({
      request_url: requestUrl,
      products
    });
  } catch (error) {
    console.error('Error fetching data from OpenFoodFacts:', error?.message || error);
    if (error?.response) {
      const status = error.response.status || 502;
      const data = error.response.data || { error: error.message || 'Upstream error' };
      return res.status(status).json({ error: data });
    }
    res.status(502).json({ error: error.message || 'Failed to load data from OpenFoodFacts' });
  }
});

/**
 * GET /api/openfoodfacts-product?code=xxxx
 * Fetch a single product by barcode
 */
router.get('/openfoodfacts-product', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'Missing product code' });
  try {
    const response = await axios.get(`https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(code)}.json`, { timeout: 10000 });
    res.json(response.data);
  } catch (err) {
    console.error('Error fetching product:', err.message);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

/**
 * GET /api/openfoodfacts-get-category
 * Returns category names list
 */
router.get('/openfoodfacts-get-category', async (_req, res) => {
  try {
    const response = await axios.get('https://world.openfoodfacts.org/categories.json', { timeout: 10000 });
    const categories = (response.data.tags || []).map(tag => tag.name).filter(Boolean);
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories from OpenFoodFacts:', error.message);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

/**
 * GET /api/openfoodfacts-get-brandname
 * Returns brand names list
 */
router.get('/openfoodfacts-get-brandname', async (_req, res) => {
  try {
    const response = await axios.get('https://world.openfoodfacts.org/brands.json', { timeout: 10000 });
    const brands = (response.data.tags || []).map(tag => tag.name).filter(Boolean);
    res.json(brands);
  } catch (error) {
    console.error('Error fetching brands from OpenFoodFacts:', error.message);
    res.status(500).json({ error: 'Failed to fetch brands' });
  }
});

/**
 * GET /api/openfoodfacts-get-labels
 * Returns label names list
 */
router.get('/openfoodfacts-get-labels', async (_req, res) => {
  try {
    const response = await axios.get('https://world.openfoodfacts.org/labels.json', { timeout: 10000 });
    const labels = (response.data.tags || []).map(tag => tag.name).filter(Boolean);
    res.json(labels);
  } catch (error) {
    console.error('Error fetching labels from OpenFoodFacts:', error.message);
    res.status(500).json({ error: 'Failed to fetch labels' });
  }
});

module.exports = router;

