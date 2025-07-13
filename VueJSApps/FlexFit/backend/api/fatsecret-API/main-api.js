require('dotenv').config();
const express = require('express');
const router = express.Router();
var request = require("request");
const clientID = process.env.FATSECRET_CLIENT_ID;
const clientSecret = process.env.FATSECRET_CLIENT_SECRET;

// GET /api/get-fatsecret-session
router.get('/get-fatsecret-session', (req, res) => {
  var options = {
    method: 'POST',
    url: 'https://oauth.fatsecret.com/connect/token',
    auth : {
      user : clientID,
      password : clientSecret
    },
    headers: { 'content-type': 'application/x-www-form-urlencoded'},
    form: {
      'grant_type': 'client_credentials',
      'scope' : 'basic'
    },
    json: true
  };

  request(options, function (error, response, body) {
    if (error) return res.status(500).json({ error: error.message });
    res.json(body);
  });
});

// POST /api/fatsecret-food-search
router.post('/fatsecret-food-search', (req, res) => {
  const { search_expression } = req.body;
  if (!search_expression) {
    return res.status(400).json({ error: 'Missing search_expression' });
  }
  // 1. Get FatSecret token
  var tokenOptions = {
    method: 'POST',
    url: 'https://oauth.fatsecret.com/connect/token',
    auth : {
      user : clientID,
      password : clientSecret
    },
    headers: { 'content-type': 'application/x-www-form-urlencoded'},
    form: {
      'grant_type': 'client_credentials',
      'scope' : 'basic'
    },
    json: true
  };
  request(tokenOptions, function (tokenError, tokenResponse, tokenBody) {
    if (tokenError || !tokenBody.access_token) {
      return res.status(500).json({ error: 'Failed to get FatSecret token' });
    }
    // 2. Search food
    const options = {
      method: 'POST',
      url: 'https://platform.fatsecret.com/rest/server.api',
      headers: {
        Authorization: `Bearer ${tokenBody.access_token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      form: {
        method: 'foods.search',
        search_expression,
        format: 'json',
      },
      json: true,
    };
    request(options, function (error, response, body) {
      if (error) return res.status(500).json({ error: error.message });
      res.json(body);
    });
  });
});



module.exports = router;
