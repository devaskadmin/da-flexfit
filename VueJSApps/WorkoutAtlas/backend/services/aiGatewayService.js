const crypto = require('crypto');

const DEFAULT_APP_NAME = 'workoutatlas';
const DEFAULT_REQUEST_TYPE = 'LOCAL_AI_QA';
const DEFAULT_GATEWAY_PATH = '/api/gateway';
const DEFAULT_STORAGE_BUCKET = 'workoutatlas-s3-data';

function resolveStorageBucketName(env = process.env) {
  const fromEnv = String(
    env.STORAGE_BUCKET
    || env.S3_BUCKET
    || env.WORKOUTATLAS_STORAGE_BUCKET
    || ''
  ).trim();

  return fromEnv || DEFAULT_STORAGE_BUCKET;
}

function createRequestId(prefix = 'wa') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildAiGatewayRequestPayload(message, appName = DEFAULT_APP_NAME) {
  const trimmed = String(message || '').trim();
  if (!trimmed) {
    throw new Error('Message must be a non-empty string.');
  }

  return {
    appId: appName || DEFAULT_APP_NAME,
    appName: appName || DEFAULT_APP_NAME,
    type: DEFAULT_REQUEST_TYPE,
    payload: {
      message: trimmed,
    },
  };
}

function buildGatewayHeaders({ requestId, timestamp, signature, apiToken }) {
  const headers = {
    'Content-Type': 'application/json',
    'x-request-id': String(requestId || '').trim(),
    'x-timestamp': String(timestamp || '').trim(),
    'x-signature': String(signature || '').trim(),
  };

  if (apiToken) {
    headers['x-api-token'] = String(apiToken);
  }

  return headers;
}

function normalizeAiGatewayResponse(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid AI gateway response.');
  }

  const responseText = String(payload.response || payload.data?.response || '').trim();
  if (!responseText) {
    throw new Error('AI gateway returned an empty response.');
  }

  return {
    success: Boolean(payload.success),
    provider: String(payload.provider || 'gateway').trim(),
    model: String(payload.model || 'unknown').trim(),
    response: responseText,
    timestamp: String(payload.timestamp || new Date().toISOString()).trim(),
  };
}

function createSignature(secret, method, path, timestamp, requestId, body) {
  const canonical = [String(method || '').toUpperCase(), path, timestamp, requestId, body].join('\n');
  return crypto.createHmac('sha256', String(secret || '')).update(canonical, 'utf8').digest('hex');
}

function createTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timeoutValue = Number(timeoutMs || 0);
  const timeoutHandle = timeoutValue > 0 ? setTimeout(() => controller.abort(), timeoutValue) : null;

  return {
    signal: controller.signal,
    clear: () => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    },
  };
}

function normalizeGatewayUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

function normalizeGatewayPath(path) {
  const trimmed = String(path || '').trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function sanitizeGatewayDiagnosticText(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).replace(/\s+/g, ' ').trim();
}

function extractGatewayResponseErrorCode(parsedBody, gatewayData, response) {
  const candidates = [
    gatewayData?.error,
    gatewayData?.code,
    gatewayData?.errorCode,
    parsedBody?.error?.code,
    parsedBody?.error?.error,
    parsedBody?.error?.name,
    parsedBody?.code,
    parsedBody?.errorCode,
    response?.status ? `HTTP_${response.status}` : null,
  ];

  const resolved = candidates.find((value) => typeof value === 'string' && value.trim());
  return sanitizeGatewayDiagnosticText(resolved) || 'GATEWAY_DELETE_FAILED';
}

function logGatewayDeleteDiagnostic({
  stage,
  requestId,
  storageKey,
  httpStatus = null,
  gatewayErrorCode = null,
  message = null,
  responseReceived = null,
}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    stage,
    requestId: requestId || null,
    action: 'DELETE_OBJECT',
    storageKey,
    httpStatus: Number.isInteger(httpStatus) ? httpStatus : null,
    gatewayErrorCode: gatewayErrorCode || null,
    message: sanitizeGatewayDiagnosticText(message) || null,
    responseReceived,
  };

  console.error(`[GatewayDelete] ${JSON.stringify(logEntry)}`);
}

function resolvePublicGatewayBaseUrl(env = process.env) {
  const gatewayBaseUrl = String(env.PUBLIC_GATEWAY_URL || '').trim();
  if (!gatewayBaseUrl) {
    throw new Error('PUBLIC_GATEWAY_URL is not configured.');
  }
  return normalizeGatewayUrl(gatewayBaseUrl);
}

function resolveGatewayConfig(env = process.env) {
  const gatewayBaseUrl = resolvePublicGatewayBaseUrl(env);
  const gatewayPath = String(env.TAILSCALE_GATEWAY_ENDPOINT || DEFAULT_GATEWAY_PATH).trim();
  const hmacSecret = String(env.TAILSCALE_GATEWAY_HMAC_SECRET || '').trim();
  const appName = String(env.TAILSCALE_GATEWAY_APP_NAME || env.appName || DEFAULT_APP_NAME).trim();
  const timeoutMs = Number(env.TAILSCALE_GATEWAY_TIMEOUT_MS || 120000);

  return {
    gatewayOverrideUrl: gatewayBaseUrl,
    gatewayBaseUrl,
    gatewayPath: gatewayPath || DEFAULT_GATEWAY_PATH,
    hmacSecret,
    appName,
    timeoutMs,
  };
}

function getGatewayUrl(gatewayConfig) {
  const base = normalizeGatewayUrl(gatewayConfig?.gatewayBaseUrl || gatewayConfig?.gatewayOverrideUrl || process.env.PUBLIC_GATEWAY_URL);
  if (!base) {
    throw new Error('PUBLIC_GATEWAY_URL is not configured.');
  }

  const path = normalizeGatewayPath(gatewayConfig?.gatewayPath || DEFAULT_GATEWAY_PATH);
  if (!path) {
    return base;
  }

  if (base.endsWith(path)) {
    return base;
  }

  return `${base}${path}`;
}

function createGatewayError(payload, fallbackMessage = 'Unable to reach the AI gateway.') {
  const detail = payload?.error || payload?.detail || payload?.message || fallbackMessage;
  return {
    error: fallbackMessage,
    detail,
  };
}

async function putObjectViaGateway({
  storageKey,
  contentType = 'application/octet-stream',
  dataBase64,
  appName = DEFAULT_APP_NAME,
  env = process.env,
  fetchImpl = fetch,
}) {
  if (!storageKey || typeof storageKey !== 'string' || !storageKey.trim()) {
    throw new Error('storageKey is required for gateway object writes.');
  }

  if (typeof dataBase64 !== 'string' || !dataBase64.trim()) {
    throw new Error('dataBase64 is required for gateway object writes.');
  }

  const gatewayConfig = resolveGatewayConfig(env);
  const gatewayUrl = getGatewayUrl(gatewayConfig);
  const requestPayload = {
    appName: String(appName || gatewayConfig.appName || DEFAULT_APP_NAME).trim() || DEFAULT_APP_NAME,
    type: 'LOCAL_CLOUD',
    payload: {
      action: 'PUT_OBJECT',
      storageKey: storageKey.trim(),
      contentType: String(contentType || 'application/octet-stream').trim() || 'application/octet-stream',
      dataBase64: dataBase64.trim(),
    },
  };

  const serializedBody = JSON.stringify(requestPayload);
  const requestId = createRequestId('wa-gw');
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createSignature(
    gatewayConfig.hmacSecret,
    'POST',
    gatewayConfig.gatewayPath || DEFAULT_GATEWAY_PATH,
    timestamp,
    requestId,
    serializedBody
  );

  const timeout = createTimeoutSignal(gatewayConfig.timeoutMs);
  try {
    const response = await (fetchImpl || fetch)(gatewayUrl, {
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

    const gatewayData = parsedBody?.data && typeof parsedBody.data === 'object'
      ? parsedBody.data
      : parsedBody;

    const ok = response.ok && gatewayData?.success !== false && parsedBody?.success !== false;
    if (!ok) {
      const detail = String(
        gatewayData?.message ||
        parsedBody?.error?.message ||
        parsedBody?.message ||
        parsedBody?.detail ||
        `Gateway HTTP ${response.status}`
      ).trim();
      const error = new Error(detail || `Gateway upload failed for ${storageKey}.`);
      error.statusCode = response.status >= 400 ? response.status : 502;
      error.gatewayBody = gatewayData;
      throw error;
    }

    return {
      success: true,
      storageKey,
      bucket: gatewayData?.bucket || resolveStorageBucketName(env),
      response: gatewayData,
    };
  } finally {
    timeout.clear();
  }
}

async function deleteObjectViaGateway({
  storageKey,
  appName = DEFAULT_APP_NAME,
  env = process.env,
  fetchImpl = fetch,
  requestId: providedRequestId = null,
}) {
  if (!storageKey || typeof storageKey !== 'string' || !storageKey.trim()) {
    throw new Error('storageKey is required for gateway object deletions.');
  }

  const gatewayConfig = resolveGatewayConfig(env);
  const gatewayUrl = getGatewayUrl(gatewayConfig);
  const requestPayload = {
    appName: String(appName || gatewayConfig.appName || DEFAULT_APP_NAME).trim() || DEFAULT_APP_NAME,
    type: 'LOCAL_CLOUD',
    payload: {
      action: 'DELETE_OBJECT',
      storageKey: storageKey.trim(),
    },
  };

  const serializedBody = JSON.stringify(requestPayload);
  const requestId = String(providedRequestId || '').trim() || createRequestId('wa-gw');
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createSignature(
    gatewayConfig.hmacSecret,
    'POST',
    gatewayConfig.gatewayPath || DEFAULT_GATEWAY_PATH,
    timestamp,
    requestId,
    serializedBody
  );

  const timeout = createTimeoutSignal(gatewayConfig.timeoutMs);
  logGatewayDeleteDiagnostic({
    stage: 'attempt',
    requestId,
    storageKey: storageKey.trim(),
    message: 'Sending delete request to gateway.',
    responseReceived: false,
  });

  try {
    let response;

    try {
      response = await (fetchImpl || fetch)(gatewayUrl, {
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
    } catch (fetchError) {
      logGatewayDeleteDiagnostic({
        stage: 'request_failed_before_response',
        requestId,
        storageKey: storageKey.trim(),
        message: fetchError?.message || 'Gateway request failed before an HTTP response was received.',
        responseReceived: false,
      });
      fetchError.gatewayRequestId = requestId;
      fetchError.gatewayAction = 'DELETE_OBJECT';
      fetchError.storageKey = storageKey.trim();
      throw fetchError;
    }

    let rawText;
    try {
      rawText = await response.text();
    } catch (bodyReadError) {
      logGatewayDeleteDiagnostic({
        stage: 'response_read_failed_after_response',
        requestId,
        storageKey: storageKey.trim(),
        httpStatus: response.status,
        message: bodyReadError?.message || 'Gateway response body could not be read.',
        responseReceived: true,
      });
      bodyReadError.gatewayRequestId = requestId;
      bodyReadError.gatewayAction = 'DELETE_OBJECT';
      bodyReadError.storageKey = storageKey.trim();
      bodyReadError.httpStatus = response.status;
      throw bodyReadError;
    }

    let parsedBody = {};
    try {
      parsedBody = rawText ? JSON.parse(rawText) : {};
    } catch (_) {
      parsedBody = {};
    }

    const gatewayData = parsedBody?.data && typeof parsedBody.data === 'object'
      ? parsedBody.data
      : parsedBody;

    const ok = response.ok && gatewayData?.success !== false && parsedBody?.success !== false;
    if (!ok) {
      const detail = String(
        gatewayData?.message ||
        parsedBody?.error?.message ||
        parsedBody?.message ||
        parsedBody?.detail ||
        `Gateway HTTP ${response.status}`
      ).trim();
      const gatewayErrorCode = extractGatewayResponseErrorCode(parsedBody, gatewayData, response);

      logGatewayDeleteDiagnostic({
        stage: 'response_error',
        requestId,
        storageKey: storageKey.trim(),
        httpStatus: response.status,
        gatewayErrorCode,
        message: detail,
        responseReceived: true,
      });

      const error = new Error(detail || `Gateway delete failed for ${storageKey}.`);
      error.statusCode = response.status >= 400 ? response.status : 502;
      error.gatewayBody = gatewayData;
      error.gatewayRequestId = requestId;
      error.gatewayAction = 'DELETE_OBJECT';
      error.storageKey = storageKey.trim();
      error.gatewayErrorCode = gatewayErrorCode;
      error.gatewayHttpStatus = response.status;
      throw error;
    }

    return {
      success: true,
      storageKey,
      bucket: gatewayData?.bucket || resolveStorageBucketName(env),
      response: gatewayData,
      gatewayRequestId: requestId,
    };
  } finally {
    timeout.clear();
  }
}

module.exports = {
  DEFAULT_APP_NAME,
  DEFAULT_REQUEST_TYPE,
  DEFAULT_GATEWAY_PATH,
  DEFAULT_STORAGE_BUCKET,
  buildAiGatewayRequestPayload,
  buildGatewayHeaders,
  normalizeAiGatewayResponse,
  createSignature,
  createTimeoutSignal,
  resolveStorageBucketName,
  resolveGatewayConfig,
  getGatewayUrl,
  createGatewayError,
  createRequestId,
  putObjectViaGateway,
  deleteObjectViaGateway,
};

