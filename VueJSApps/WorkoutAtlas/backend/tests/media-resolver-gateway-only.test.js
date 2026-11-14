const test = require('node:test');
const assert = require('node:assert/strict');

const { streamExerciseImage } = require('../services/mediaResolver');

function createMockResponse() {
  const headers = new Map();
  const result = {
    headers,
    body: null,
    setHeader(name, value) {
      headers.set(String(name).toLowerCase(), value);
    },
    end(buffer) {
      result.body = buffer;
    },
  };

  return result;
}

function withGatewayEnv(fn) {
  const previous = {
    PUBLIC_GATEWAY_URL: process.env.PUBLIC_GATEWAY_URL,
    TAILSCALE_GATEWAY_HMAC_SECRET: process.env.TAILSCALE_GATEWAY_HMAC_SECRET,
    TAILSCALE_GATEWAY_ENDPOINT: process.env.TAILSCALE_GATEWAY_ENDPOINT,
    TAILSCALE_GATEWAY_TIMEOUT_MS: process.env.TAILSCALE_GATEWAY_TIMEOUT_MS,
  };

  process.env.PUBLIC_GATEWAY_URL = 'https://gateway.example.test';
  process.env.TAILSCALE_GATEWAY_HMAC_SECRET = 'test-secret';
  process.env.TAILSCALE_GATEWAY_ENDPOINT = '/api/gateway';
  process.env.TAILSCALE_GATEWAY_TIMEOUT_MS = '3000';

  return Promise.resolve()
    .then(fn)
    .finally(() => {
      process.env.PUBLIC_GATEWAY_URL = previous.PUBLIC_GATEWAY_URL;
      process.env.TAILSCALE_GATEWAY_HMAC_SECRET = previous.TAILSCALE_GATEWAY_HMAC_SECRET;
      process.env.TAILSCALE_GATEWAY_ENDPOINT = previous.TAILSCALE_GATEWAY_ENDPOINT;
      process.env.TAILSCALE_GATEWAY_TIMEOUT_MS = previous.TAILSCALE_GATEWAY_TIMEOUT_MS;
    });
}

test('streamExerciseImage serves gateway GET_OBJECT payload', async () => {
  const previousFetch = global.fetch;
  const response = createMockResponse();

  global.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({
      success: true,
      data: {
        success: true,
        contentType: 'image/jpeg',
        dataBase64: Buffer.from('img-bytes').toString('base64'),
      },
    }),
  });

  await withGatewayEnv(async () => {
    await streamExerciseImage(response, {
      ExerciseID: 1,
      MediaPath: 'APP/exercise-library/1/images',
      PrimaryImage: '1.jpg',
    }, '1.jpg');
  });

  global.fetch = previousFetch;

  assert.equal(response.headers.get('content-type'), 'image/jpeg');
  assert.equal(response.headers.get('content-length'), Buffer.byteLength('img-bytes'));
  assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
  assert.equal(Buffer.from(response.body).toString('utf8'), 'img-bytes');
});

test('streamExerciseImage returns gateway error and does not fallback to local filesystem', async () => {
  const previousFetch = global.fetch;
  const response = createMockResponse();

  global.fetch = async () => ({
    ok: false,
    status: 404,
    text: async () => JSON.stringify({
      success: false,
      data: {
        success: false,
        message: 'OBJECT_NOT_FOUND',
      },
    }),
  });

  let capturedError = null;
  await withGatewayEnv(async () => {
    try {
      await streamExerciseImage(response, {
        ExerciseID: 1,
        MediaPath: 'APP/exercise-library/1/images',
        PrimaryImage: 'missing.jpg',
      }, 'missing.jpg');
    } catch (error) {
      capturedError = error;
    }
  });

  global.fetch = previousFetch;

  assert.ok(capturedError);
  assert.equal(Number(capturedError.statusCode || 0), 404);
  assert.match(String(capturedError.message || ''), /OBJECT_NOT_FOUND|not found/i);
  assert.doesNotMatch(String(capturedError.message || ''), /local content repository/i);
  assert.equal(response.body, null);
});
