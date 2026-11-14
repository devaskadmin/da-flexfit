const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const aiGatewayService = require('../services/aiGatewayService.js');
const aiGatewayRouter = require('../api/ai-gateway.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.session = { user: { id: 42, role: 'member' } };
    next();
  });
  app.use('/api', aiGatewayRouter);
  return app;
}

test('gateway config uses the canonical Workout-Atlas app name when no env override is set', () => {
  const previousGatewayUrl = process.env.PUBLIC_GATEWAY_URL;
  process.env.PUBLIC_GATEWAY_URL = 'https://gateway.example.test';

  try {
    const config = aiGatewayService.resolveGatewayConfig(process.env);
    assert.equal(config.appName, 'Workout-Atlas');
  } finally {
    if (previousGatewayUrl === undefined) {
      delete process.env.PUBLIC_GATEWAY_URL;
    } else {
      process.env.PUBLIC_GATEWAY_URL = previousGatewayUrl;
    }
  }
});

test('ai qa route accepts authenticated non-admin members and proxies through the gateway', async () => {
  const previousEnv = {
    PUBLIC_GATEWAY_URL: process.env.PUBLIC_GATEWAY_URL,
    TAILSCALE_GATEWAY_HMAC_SECRET: process.env.TAILSCALE_GATEWAY_HMAC_SECRET,
    TAILSCALE_GATEWAY_ENDPOINT: process.env.TAILSCALE_GATEWAY_ENDPOINT,
    TAILSCALE_GATEWAY_TIMEOUT_MS: process.env.TAILSCALE_GATEWAY_TIMEOUT_MS,
  };

  process.env.PUBLIC_GATEWAY_URL = 'https://gateway.example.test';
  process.env.TAILSCALE_GATEWAY_HMAC_SECRET = 'test-secret';
  process.env.TAILSCALE_GATEWAY_ENDPOINT = '/api/gateway';
  process.env.TAILSCALE_GATEWAY_TIMEOUT_MS = '15000';

  const originalFetch = global.fetch;
  const rawHttpFetch = (...args) => originalFetch.apply(globalThis, args);

  global.fetch = async (...args) => {
    const url = String(args[0] || '');
    if (url.includes('gateway.example.test')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          success: true,
          response: 'Generated workout plan for a 10 lb weight-loss goal.',
          provider: 'local-test',
          model: 'test-model',
          timestamp: new Date().toISOString(),
        }),
      };
    }
    return rawHttpFetch(...args);
  };

  const app = createApp();
  const server = app.listen(0);

  try {
    const port = server.address().port;
    const response = await rawHttpFetch(`http://127.0.0.1:${port}/api/ai/qa-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Create me a workout plan to lose 10 lbs.' }),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.response, 'Generated workout plan for a 10 lb weight-loss goal.');
  } finally {
    global.fetch = originalFetch;
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});
