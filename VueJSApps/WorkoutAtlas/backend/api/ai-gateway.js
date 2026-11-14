const express = require('express');
const router = express.Router();
const {
  buildAiGatewayRequestPayload,
  buildGatewayHeaders,
  normalizeAiGatewayResponse,
  createSignature,
  createTimeoutSignal,
  resolveGatewayConfig,
  getGatewayUrl,
  createGatewayError,
  createRequestId,
} = require('../services/aiGatewayService');

function requireAuthenticatedUser(req, res, next) {
  if (!req.session?.user?.id) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  next();
}

router.post('/ai/qa-message', requireAuthenticatedUser, async (req, res) => {
  const isDevelopment = String(process.env.NODE_ENV || '').trim().toLowerCase() !== 'production';
  let requestId = '';
  let gatewayUrl = '';
  let appName = '';

  try {
    const message = String(req.body?.message || '').trim();
    const gatewayConfig = resolveGatewayConfig(process.env);
    appName = String(gatewayConfig.appName || '').trim();
    const payload = buildAiGatewayRequestPayload(message, gatewayConfig.appName);
    requestId = String(req.headers['x-request-id'] || createRequestId('wa')).trim();
    const timestamp = String(Math.floor(Date.now() / 1000));
    const serializedBody = JSON.stringify(payload);
    const signature = createSignature(
      gatewayConfig.hmacSecret,
      'POST',
      gatewayConfig.gatewayPath || '/api/gateway',
      timestamp,
      requestId,
      serializedBody
    );

    gatewayUrl = getGatewayUrl(gatewayConfig);

    if (!gatewayConfig.gatewayBaseUrl && !gatewayConfig.gatewayOverrideUrl) {
      return res.status(503).json(createGatewayError({
        error: 'Gateway URL is not configured.',
      }, 'AI gateway is not configured yet.'));
    }

    if (!gatewayConfig.hmacSecret) {
      return res.status(503).json(createGatewayError({
        error: 'Gateway authentication is not configured.',
      }, 'AI gateway authentication is not configured.'));
    }

    const timeout = createTimeoutSignal(gatewayConfig.timeoutMs);

    try {
      const response = await fetch(gatewayUrl, {
        method: 'POST',
        headers: buildGatewayHeaders({
          requestId,
          timestamp,
          signature,
          apiToken: gatewayConfig.apiToken,
        }),
        body: serializedBody,
        signal: timeout.signal,
      });

      const rawText = await response.text();
      let parsedBody = {};
      try {
        parsedBody = rawText ? JSON.parse(rawText) : {};
      } catch (_) {
        parsedBody = {};
      }

      if (!response.ok) {
        const gatewayError = createGatewayError(parsedBody, 'Unable to reach the AI gateway.');
        const statusCode = Number(response.status) >= 400 ? response.status : 502;
        if (isDevelopment) {
          return res.status(statusCode).json({
            ...gatewayError,
            requestId,
            gatewayUrl,
            appName,
            gatewayStatus: response.status,
            gatewayBody: parsedBody,
            gatewayRaw: rawText,
          });
        }

        return res.status(statusCode).json(gatewayError);
      }

      const normalized = normalizeAiGatewayResponse(parsedBody);
      return res.json(normalized);
    } catch (err) {
      if (err?.name === 'AbortError') {
        const timeoutPayload = { error: 'AI gateway request timed out.' };
        if (isDevelopment) {
          timeoutPayload.requestId = requestId;
          timeoutPayload.gatewayUrl = gatewayUrl;
          timeoutPayload.appName = appName;
        }
        return res.status(504).json(timeoutPayload);
      }

      throw err;
    } finally {
      timeout.clear();
    }
  } catch (err) {
    if (isDevelopment) {
      return res.status(500).json({
        error: err?.message || 'Unable to process AI request.',
        requestId,
        gatewayUrl,
        appName,
      });
    }

    return res.status(500).json({ error: 'Unable to process AI request.' });
  }
});

module.exports = router;

