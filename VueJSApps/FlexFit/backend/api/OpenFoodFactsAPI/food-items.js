const express = require('express');
const router = express.Router();
const pool = require('../../db.js');

// POST /api/food-items
router.post('/food-items', async (req, res) => {
  const p = req.body || {};
  // Defensive defaults
  const barcode_code = p.barcode_code || null;
  const product_name = p.product_name || null;
  const generic_name = p.generic_name || null;
  const brand_name = p.brand_name || null;
  const quantity = p.quantity || null;
  const category_tags = JSON.stringify(p.category_tags || []);
  const label_tags = JSON.stringify(p.label_tags || []);
  const ingredients_text = p.ingredients_text || null;
  const allergens = p.allergens || null;
  const traces = p.traces || null;
  const additives_tags = JSON.stringify(p.additives_tags || []);
  const packaging = p.packaging || null;
  const serving_size_text = p.serving_size_text || null;
  const nutriscore_grade = p.nutriscore_grade || null;
  const nova_group = (typeof p.nova_group === 'number') ? p.nova_group : (p.nova_group ? Number(p.nova_group) : null);
  const image_front_url = p.image_front_url || null;
  const image_nutrition_url = p.image_nutrition_url || null;
  const image_thumb_url = p.image_thumb_url || null;
  const off_url = p.off_url || null;
  const source = p.source || null;
  const last_modified_ts = p.last_modified_ts ? new Date(p.last_modified_ts) : null;
  const nutriments = JSON.stringify(p.nutriments || {});

  try {
    // Ensure table exists (simple, idempotent)
    const createSql = `CREATE TABLE IF NOT EXISTS food_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      barcode_code VARCHAR(255),
      product_name TEXT,
      generic_name TEXT,
      brand_name TEXT,
      quantity VARCHAR(255),
      category_tags TEXT,
      label_tags TEXT,
      ingredients_text TEXT,
      allergens TEXT,
      traces TEXT,
      additives_tags TEXT,
      packaging TEXT,
      serving_size_text VARCHAR(255),
      nutriscore_grade VARCHAR(10),
      nova_group INT,
      image_front_url TEXT,
      image_nutrition_url TEXT,
      image_thumb_url TEXT,
      off_url TEXT,
      source VARCHAR(50),
      last_modified_ts DATETIME,
      nutriments TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;
    await pool.query(createSql);

    const insertSql = `INSERT INTO food_items (
      barcode_code, product_name, generic_name, brand_name, quantity, category_tags, label_tags,
      ingredients_text, allergens, traces, additives_tags, packaging, serving_size_text,
      nutriscore_grade, nova_group, image_front_url, image_nutrition_url, image_thumb_url,
      off_url, source, last_modified_ts, nutriments
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const params = [
      barcode_code, product_name, generic_name, brand_name, quantity, category_tags, label_tags,
      ingredients_text, allergens, traces, additives_tags, packaging, serving_size_text,
      nutriscore_grade, nova_group, image_front_url, image_nutrition_url, image_thumb_url,
      off_url, source, last_modified_ts ? last_modified_ts.toISOString().slice(0, 19).replace('T', ' ') : null, nutriments
    ];

    const [result] = await pool.query(insertSql, params);
    res.json({ success: true, insertId: result.insertId });
  } catch (err) {
    console.error('Error saving food item:', err && err.message ? err.message : err);
    res.status(500).json({ error: 'Failed to save food item' });
  }
});

module.exports = router;
