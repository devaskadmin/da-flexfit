'use strict';

require('dotenv').config();

const express       = require('express');
const axios         = require('axios');
const helmet        = require('helmet');
const rateLimit     = require('express-rate-limit');
const { S3Client, GetObjectCommand, HeadBucketCommand, HeadObjectCommand, ListBucketsCommand } = require('@aws-sdk/client-s3');
const fs            = require('fs');
const path          = require('path');

// ─── Config ──────────────────────────────────────────────────────────────────

const TEST_TOKEN = process.env.TEST_TOKEN;
const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT;
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY;
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY;
const MINIO_BUCKET = process.env.MINIO_BUCKET;
const MINIO_REGION = process.env.MINIO_REGION;
const DEBUG_MODE = String(process.env.DEBUG || 'false').toLowerCase() === 'true';
const LOG_LEVEL  = (process.env.LOG_LEVEL || 'info').toLowerCase();
const PORT       = 3000;
const LOGS_DIR   = path.join(__dirname, 'logs');

// Object key for the test-image tools endpoint.
const TEST_IMAGE_KEY = 'test/test.jpg';

const requiredMinioEnvVars = [
  'MINIO_ENDPOINT',
  'MINIO_ACCESS_KEY',
  'MINIO_SECRET_KEY',
  'MINIO_BUCKET',
  'MINIO_REGION',
];

const missingMinioEnvVars = requiredMinioEnvVars.filter((name) => !process.env[name]);
const MINIO_ENABLED = missingMinioEnvVars.length === 0;

// ─── Log helpers ─────────────────────────────────────────────────────────────

if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });

const gatewayLogStream  = fs.createWriteStream(path.join(LOGS_DIR, 'gateway.log'),  { flags: 'a' });
const securityLogStream = fs.createWriteStream(path.join(LOGS_DIR, 'security.log'), { flags: 'a' });

function writeLog(stream, line) {
  const entry = `${line}\n`;
  stream.write(entry);
  if (LOG_LEVEL === 'debug') process.stdout.write(entry);
}

function logRequest({ timestamp, ip, endpoint, status, responseTimeMs }) {
  writeLog(
    gatewayLogStream,
    `[${timestamp}] endpoint=${endpoint} ip=${ip} status=${status} responseTime=${responseTimeMs}ms`
  );
}

function logAuthFailure({ timestamp, ip, endpoint }) {
  const line = `[${timestamp}] AUTH_FAILURE IP=${ip} ENDPOINT=${endpoint}`;
  writeLog(securityLogStream, line);
  console.warn(line);
}

// Keep route-level tool logs consistent in both file logs and console output.
function logToolsInfo(message) {
  const line = `[${new Date().toISOString()}] [TOOLS] ${message}`;
  writeLog(gatewayLogStream, line);
  console.log(line);
}

function logToolsError(message, error) {
  const detail = error?.message ? ` detail=${error.message}` : '';
  const code = error?.name ? ` code=${error.name}` : '';
  const line = `[${new Date().toISOString()}] [TOOLS] ${message}${code}${detail}`;
  writeLog(gatewayLogStream, line);
  console.error(line);
}

function logS3Operation({ commandType, bucket, objectKey, endpoint, statusCode, errorName, errorMessage }) {
  const lines = [
    `[${new Date().toISOString()}] [S3] ${commandType}`,
    `Bucket=${bucket || 'undefined'}`,
    `ObjectKey=${objectKey || 'n/a'}`,
    `Endpoint=${endpoint || 'undefined'}`,
    `Status=${statusCode ?? 'n/a'}`,
    `Error=${errorName || 'none'}`,
    `Message=${errorMessage || 'none'}`,
  ];
  const payload = lines.join(' | ');
  writeLog(gatewayLogStream, payload);
  if (errorName) {
    console.error(payload);
  } else {
    console.log(payload);
  }
}

function createMinioClient(forcePathStyle) {
  return new S3Client({
    endpoint: MINIO_ENDPOINT,
    region: MINIO_REGION,
    credentials: {
      accessKeyId: MINIO_ACCESS_KEY,
      secretAccessKey: MINIO_SECRET_KEY,
    },
    forcePathStyle,
  });
}

// Categorizes S3/MinIO errors for precise server-side logging.
function categorizeS3Error(error) {
  const statusCode = error?.$metadata?.httpStatusCode;
  const name = error?.name;
  const message = String(error?.message || '').toLowerCase();
  const causeCode = String(error?.cause?.code || '').toLowerCase();

  if (name === 'NoSuchKey' || name === 'NotFound') {
    return { type: 'object-not-found', statusCode: 404 };
  }

  if (name === 'NoSuchBucket' || message.includes('no such bucket')) {
    return { type: 'bucket-not-found', statusCode: 404 };
  }

  if (
    name === 'InvalidAccessKeyId' ||
    name === 'SignatureDoesNotMatch' ||
    name === 'AccessDenied' ||
    statusCode === 401 ||
    statusCode === 403
  ) {
    return { type: 'authentication-failure', statusCode: 403 };
  }

  if (
    causeCode === 'econnrefused' ||
    causeCode === 'enotfound' ||
    causeCode === 'etimedout' ||
    message.includes('connect') ||
    message.includes('network') ||
    message.includes('timeout')
  ) {
    return { type: 'connection-failure', statusCode: 500 };
  }

  if (statusCode === 404) {
    return { type: 'object-not-found', statusCode: 404 };
  }

  return { type: 'unknown-error', statusCode: 500 };
}

// Builds a safe, non-secret error payload for diagnostic responses.
function toDiagnosticError(error) {
  const classification = categorizeS3Error(error);
  let readableMessage = 'Unexpected storage error.';

  if (classification.type === 'authentication-failure') {
    readableMessage = 'Invalid MinIO credentials.';
  } else if (classification.type === 'connection-failure') {
    readableMessage = 'Unable to connect to MinIO endpoint.';
  } else if (classification.type === 'bucket-not-found') {
    readableMessage = 'Configured MinIO bucket was not found.';
  } else if (classification.type === 'object-not-found') {
    readableMessage = 'Test image object was not found.';
  }

  return {
    type: classification.type,
    message: readableMessage,
    httpStatusCode: error?.$metadata?.httpStatusCode || null,
    awsErrorName: error?.name || null,
    awsErrorMessage: error?.message || null,
    requestId: error?.$metadata?.requestId || null,
    extendedRequestId: error?.$metadata?.extendedRequestId || null,
    attempts: error?.$metadata?.attempts || null,
    totalRetryDelay: error?.$metadata?.totalRetryDelay || null,
  };
}

// Dedicated S3 client for local MinIO access.
const minioS3Client = MINIO_ENABLED ? createMinioClient(true) : null;

// ─── Middleware factories ─────────────────────────────────────────────────────

function getIp(req) {
  return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown')
    .split(',')[0].trim();
}

function requestLogger() {
  return (req, res, next) => {
    req._startTime = Date.now();
    res.on('finish', () => {
      logRequest({
        timestamp:     new Date().toISOString(),
        ip:            getIp(req),
        endpoint:      req.path,
        status:        res.statusCode,
        responseTimeMs: Date.now() - req._startTime,
      });
    });
    next();
  };
}

function validateToken() {
  return (req, res, next) => {
    const provided = req.query.token;
    if (!provided || provided !== TEST_TOKEN) {
      logAuthFailure({
        timestamp: new Date().toISOString(),
        ip:        getIp(req),
        endpoint:  req.path,
      });
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

// ─── App setup ────────────────────────────────────────────────────────────────

const app = express();

app.set('trust proxy', 1);

app.use(helmet());

app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
}));

app.use(requestLogger());

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.json({
    service:  'DevAsk Gateway',
    status:   'online',
    hostname: 'da-fproxygw',
  });
});

app.get('/health/minio', validateToken(), async (req, res) => {
  const timestamp = new Date().toISOString();

  if (!MINIO_ENABLED) {
    return res.status(500).json({
      service: 'minio',
      status:  'offline',
      message: 'MinIO disabled due to missing configuration.',
      timestamp,
    });
  }

  try {
    const response = await axios.get(`${MINIO_ENDPOINT}/minio/health/live`, { timeout: 5000 });

    if (response.status === 200) {
      return res.json({
        service:    'minio',
        status:     'online',
        httpStatus: 200,
        timestamp,
      });
    }

    throw new Error('Unexpected upstream status');
  } catch {
    return res.status(500).json({
      service: 'minio',
      status:  'offline',
    });
  }
});

// Returns current SDK/MinIO config diagnostics (without exposing secrets).
app.get('/api/test/config', (req, res) => {
  if (!DEBUG_MODE) {
    return res.status(403).json({
      success: false,
      message: 'Config diagnostics are disabled.',
    });
  }

  const response = {
    success: true,
    sdkConfig: {
      endpoint: MINIO_ENDPOINT || null,
      region: MINIO_REGION || null,
      forcePathStyle: true,
      accessKeyPresent: Boolean(MINIO_ACCESS_KEY),
      secretKeyPresent: Boolean(MINIO_SECRET_KEY),
    },
    compatibilityChecks: {
      forcePathStyleEnabled: true,
      endpointConfigured: Boolean(MINIO_ENDPOINT),
      noStsCallsConfigured: true,
      staticEnvCredentialsUsed: true,
      credentialProviderOverrideUsed: false,
    },
  };

  return res
    .status(200)
    .type('application/json')
    .send(JSON.stringify(response, null, 2));
});


// Streams a known test image from local MinIO directly to the browser.
app.get('/api/tools/test-image', async (req, res) => {
  logToolsInfo('Request received for /api/tools/test-image');

  if (!MINIO_ENABLED || !minioS3Client) {
    logToolsError('MinIO functionality is disabled for /api/tools/test-image');
    return res.status(503).json({
      success: false,
      message: 'Unable to retrieve test image.',
    });
  }

  try {
    await minioS3Client.send(new HeadBucketCommand({ Bucket: MINIO_BUCKET }));
    logToolsInfo('Connection successful');
    logToolsInfo('Bucket validation successful');
    logS3Operation({
      commandType: 'HeadBucket',
      bucket: MINIO_BUCKET,
      endpoint: MINIO_ENDPOINT,
      statusCode: 200,
    });

    // Request the object from MinIO using S3-compatible API.
    const s3Object = await minioS3Client.send(new GetObjectCommand({
      Bucket: MINIO_BUCKET,
      Key: TEST_IMAGE_KEY,
    }));
    logS3Operation({
      commandType: 'GetObject',
      bucket: MINIO_BUCKET,
      objectKey: TEST_IMAGE_KEY,
      endpoint: MINIO_ENDPOINT,
      statusCode: s3Object?.$metadata?.httpStatusCode || 200,
    });

    const objectStream = s3Object.Body;

    // Handle rare cases where body is unexpectedly empty.
    if (!objectStream || typeof objectStream.pipe !== 'function') {
      throw new Error('S3 returned an invalid object stream');
    }

    // Forward upstream metadata so the browser can render the image directly.
    res.setHeader('Content-Type', s3Object.ContentType || 'image/jpeg');
    if (s3Object.ContentLength) {
      res.setHeader('Content-Length', String(s3Object.ContentLength));
    }

    logToolsInfo('Object retrieved successfully');
    objectStream.pipe(res);
  } catch (error) {
    logS3Operation({
      commandType: error?.name === 'NoSuchKey' || error?.name === 'NotFound' ? 'GetObject' : 'HeadBucket',
      bucket: MINIO_BUCKET,
      objectKey: TEST_IMAGE_KEY,
      endpoint: MINIO_ENDPOINT,
      statusCode: error?.$metadata?.httpStatusCode || null,
      errorName: error?.name || 'Error',
      errorMessage: error?.message || 'Unknown error',
    });

    const classification = categorizeS3Error(error);

    if (classification.type === 'connection-failure') {
      logToolsError('MinIO connection failure while retrieving test image', error);
    } else if (classification.type === 'authentication-failure') {
      logToolsError('MinIO authentication failure while retrieving test image', error);
    } else if (classification.type === 'bucket-not-found') {
      logToolsError('MinIO bucket not found while retrieving test image', error);
    } else if (classification.type === 'object-not-found') {
      logToolsError('MinIO object not found while retrieving test image', error);
    } else {
      logToolsError('MinIO unknown retrieval failure while retrieving test image', error);
    }

    return res.status(classification.statusCode).json({
      success: false,
      message: 'Unable to retrieve test image.',
    });
  }
});

// Returns gateway/MinIO diagnostics with detail level controlled by DEBUG.
app.get('/api/test/status', async (req, res) => {
  const timestamp = new Date().toISOString();

  const highLevelResponse = {
    success: true,
    gateway: 'online',
    storage: MINIO_ENABLED ? 'online' : 'offline',
  };

  const debugResponse = {
    success: true,
    gateway: {
      status: 'online',
      timestamp,
    },
    minio: {
      status: MINIO_ENABLED ? 'online' : 'offline',
      configuration: {
        endpoint: MINIO_ENDPOINT,
        bucket: MINIO_BUCKET,
        region: MINIO_REGION,
      },
      connectivity: {
        success: false,
      },
      bucketValidation: {
        success: false,
      },
      testImageValidation: {
        success: false,
        objectKey: TEST_IMAGE_KEY,
      },
    },
  };

  let hasFailure = false;

  if (!MINIO_ENABLED || !minioS3Client) {
    hasFailure = true;
    debugResponse.success = false;
    debugResponse.minio.connectivity = {
      success: false,
      error: {
        type: 'connection-failure',
        message: 'MinIO functionality disabled due to missing configuration.',
        httpStatusCode: null,
      },
    };
    debugResponse.minio.bucketValidation = {
      success: false,
      bucket: MINIO_BUCKET || null,
      error: {
        type: 'bucket-not-found',
        message: 'Bucket validation skipped because MinIO is disabled.',
        httpStatusCode: null,
      },
    };
    debugResponse.minio.testImageValidation = {
      success: false,
      objectKey: TEST_IMAGE_KEY,
      error: {
        type: 'object-not-found',
        message: 'Test image validation skipped because MinIO is disabled.',
        httpStatusCode: null,
      },
    };
  } else {
    // 1) Connectivity test against MinIO health endpoint.
    try {
      await axios.get(`${MINIO_ENDPOINT}/minio/health/live`, { timeout: 5000 });
      debugResponse.minio.connectivity = {
        success: true,
        message: 'Connection to MinIO succeeded.',
      };
      logToolsInfo('Connection successful');
    } catch (error) {
      hasFailure = true;
      debugResponse.minio.connectivity = {
        success: false,
        error: {
          type: 'connection-failure',
          message: 'Unable to connect to MinIO endpoint.',
          httpStatusCode: null,
        },
      };
      logToolsError('Diagnostic connectivity test failed', error);
    }

    // 2) Bucket validation via S3 HeadBucket.
    try {
      await minioS3Client.send(new HeadBucketCommand({ Bucket: MINIO_BUCKET }));
      logS3Operation({
        commandType: 'HeadBucket',
        bucket: MINIO_BUCKET,
        endpoint: MINIO_ENDPOINT,
        statusCode: 200,
      });
      debugResponse.minio.bucketValidation = {
        success: true,
        bucket: MINIO_BUCKET,
        message: 'Bucket exists and is accessible.',
      };
      logToolsInfo('Bucket validation successful');
    } catch (error) {
      hasFailure = true;
      logS3Operation({
        commandType: 'HeadBucket',
        bucket: MINIO_BUCKET,
        endpoint: MINIO_ENDPOINT,
        statusCode: error?.$metadata?.httpStatusCode || null,
        errorName: error?.name || 'Error',
        errorMessage: error?.message || 'Unknown error',
      });
      debugResponse.minio.bucketValidation = {
        success: false,
        bucket: MINIO_BUCKET,
        error: toDiagnosticError(error),
      };
      logToolsError('Diagnostic bucket validation failed', error);
    }

    // 3) Test image validation via S3 HeadObject.
    try {
      await minioS3Client.send(new HeadObjectCommand({
        Bucket: MINIO_BUCKET,
        Key: TEST_IMAGE_KEY,
      }));
      logS3Operation({
        commandType: 'HeadObject',
        bucket: MINIO_BUCKET,
        objectKey: TEST_IMAGE_KEY,
        endpoint: MINIO_ENDPOINT,
        statusCode: 200,
      });
      debugResponse.minio.testImageValidation = {
        success: true,
        objectKey: TEST_IMAGE_KEY,
        message: 'Test image exists and is accessible.',
      };
      logToolsInfo('Object retrieved successfully');
    } catch (error) {
      hasFailure = true;
      logS3Operation({
        commandType: 'HeadObject',
        bucket: MINIO_BUCKET,
        objectKey: TEST_IMAGE_KEY,
        endpoint: MINIO_ENDPOINT,
        statusCode: error?.$metadata?.httpStatusCode || null,
        errorName: error?.name || 'Error',
        errorMessage: error?.message || 'Unknown error',
      });
      debugResponse.minio.testImageValidation = {
        success: false,
        objectKey: TEST_IMAGE_KEY,
        error: toDiagnosticError(error),
      };
      logToolsError('Diagnostic test image validation failed', error);
    }
  }

  if (hasFailure) {
    highLevelResponse.success = false;
    highLevelResponse.storage = 'offline';
    debugResponse.success = false;
  }

  // Production-safe: return only high-level status unless DEBUG=true.
  if (!DEBUG_MODE) {
    return res.status(hasFailure ? 500 : 200).json(highLevelResponse);
  }

  // Human-readable diagnostics for faster troubleshooting without SSH access.
  return res
    .status(hasFailure ? 500 : 200)
    .type('application/json')
    .send(JSON.stringify(debugResponse, null, 2));
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Gateway running on port ${PORT}`);

  missingMinioEnvVars.forEach((name) => {
    logToolsError(`Gateway Startup: Missing environment variable ${name}`);
  });

  if (!MINIO_ENABLED) {
    logToolsError('Gateway Startup: MinIO functionality disabled due to missing configuration');
  }

  logToolsInfo(`Gateway Startup: MINIO Endpoint=${MINIO_ENDPOINT || 'undefined'}`);
  logToolsInfo(`Gateway Startup: Bucket Name=${MINIO_BUCKET || 'undefined'}`);
  logToolsInfo(`Gateway Startup: Region=${MINIO_REGION || 'undefined'}`);
});
