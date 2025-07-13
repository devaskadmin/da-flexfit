const request = require('request');

// FatSecret session token storage
let fatSecretSessionToken = null;

// Helper to fetch and store FatSecret session token
const fetchFatSecretSessionToken = () => {
  const clientID = process.env.FATSECRET_CLIENT_ID;
  const clientSecret = process.env.FATSECRET_CLIENT_SECRET;
  const options = {
    method: 'POST',
    url: 'https://oauth.fatsecret.com/connect/token',
    auth: {
      user: clientID,
      password: clientSecret
    },
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    form: {
      'grant_type': 'client_credentials',
      'scope': 'basic'
    },
    json: true
  };
  request(options, function (error, response, body) {
    if (error) {
      console.error('FatSecret session fetch error:', error);
      return;
    }
    fatSecretSessionToken = body.access_token;
    console.log('✅ FatSecret session token fetched and stored.');
  });
};

const getFatSecretSessionToken = () => fatSecretSessionToken;

module.exports = {
  fetchFatSecretSessionToken,
  getFatSecretSessionToken
};
