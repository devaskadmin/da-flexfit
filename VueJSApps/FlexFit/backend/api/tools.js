const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const pool = require('../db');
const {
  DEFAULT_IMAGE_NAME,
  MEDIA_PROVIDER_LOCAL,
  buildExerciseImageUrl,
  ensureExerciseMediaColumns,
  parseJsonArray,
  toSafeRelativePath,
} = require('../services/mediaResolver');

const router = express.Router();

const BACKEND_ROOT = path.resolve(__dirname, '..');
const FRONTEND_EXERCISE_ROOT = path.resolve(BACKEND_ROOT, '..', 'frontend', 'src', 'assets', 'Excerises');
const CONTENT_LIBRARY_ROOT = path.join(BACKEND_ROOT, 'AWS-S3-CONTENT', 'APP', 'exercise-library');
const MIGRATION_STATE_ROOT = path.join(BACKEND_ROOT, 'AWS-S3-CONTENT', 'TEST', 'exercise-content-migration');
const PLAN_FILE = path.join(MIGRATION_STATE_ROOT, 'last-plan.json');
const LAST_RUN_FILE = path.join(MIGRATION_STATE_ROOT, 'last-run.json');
const AUDIT_CSV_FILE = path.join(MIGRATION_STATE_ROOT, 'last-audit.csv');

function buildLogicalMediaPath(exerciseId) {
  return `APP/exercise-library/${Number(exerciseId || 0)}/images`;
}

function normalizeGatewayUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function slugifyExerciseTitle(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '');
}

function normalizeLegacyAssetRelative(value) {
  const raw = String(value || '').trim().replace(/\\/g, '/');
  if (!raw) return '';

  const noQuery = raw.split('?')[0];
  const prefixes = [
    '/assets/Excerises/',
    'assets/Excerises/',
    '/assets/Exercises/',
    'assets/Exercises/',
  ];

  for (const prefix of prefixes) {
    if (noQuery.toLowerCase().startsWith(prefix.toLowerCase())) {
      return toSafeRelativePath(noQuery.slice(prefix.length));
    }
  }

  return toSafeRelativePath(noQuery);
}

function imageExtension(filePath) {
  const ext = path.extname(filePath || '').toLowerCase();
  return ext || '.jpg';
}

function listImageFilesInFolder(folderPath) {
  if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
    return [];
  }

  return fs.readdirSync(folderPath)
    .filter((name) => /\.(jpg|jpeg|png|gif|webp)$/i.test(name))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => path.join(folderPath, name));
}

function buildScanSources(row) {
  const gallery = parseJsonArray(row.ImageGallery);
  const relativeCandidates = [];

  for (const item of gallery) {
    const normalized = normalizeLegacyAssetRelative(item);
    if (normalized) {
      relativeCandidates.push(normalized);
    }
  }

  const imageUrlRelative = normalizeLegacyAssetRelative(row.ImageURL);
  if (imageUrlRelative) {
    relativeCandidates.push(imageUrlRelative);
  }

  const primaryRelative = normalizeLegacyAssetRelative(row.PrimaryImage);
  if (primaryRelative) {
    relativeCandidates.push(primaryRelative);
  }

  const uniqueRelative = Array.from(new Set(relativeCandidates));
  const fileMatches = uniqueRelative
    .map((relative) => {
      const absolutePath = path.join(FRONTEND_EXERCISE_ROOT, relative);
      return {
        relative,
        absolutePath,
        exists: fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile(),
      };
    })
    .filter((item) => item.exists);

  if (fileMatches.length > 0) {
    return fileMatches;
  }

  const legacyFolderName = slugifyExerciseTitle(row.ExerciseTitle);
  if (legacyFolderName) {
    const folderPath = path.join(FRONTEND_EXERCISE_ROOT, legacyFolderName);
    const folderFiles = listImageFilesInFolder(folderPath);
    if (folderFiles.length > 0) {
      return folderFiles.map((absolutePath) => ({
        relative: path.relative(FRONTEND_EXERCISE_ROOT, absolutePath).replace(/\\/g, '/'),
        absolutePath,
        exists: true,
      }));
    }
  }

  return [];
}

function makePlanEntry(row) {
  const exerciseId = Number(row.ExerciseID || 0);
  const sourceFiles = buildScanSources(row);

  const images = sourceFiles.map((file, index) => {
    const ordinal = index + 1;
    const ext = imageExtension(file.absolutePath);
    const newFileName = `${ordinal}${ext}`;

    return {
      order: ordinal,
      sourceRelative: file.relative,
      sourceAbsolute: file.absolutePath,
      newFileName,
      newStoragePath: `APP/exercise-library/${exerciseId}/images/${newFileName}`,
      newPublicPath: buildExerciseImageUrl(exerciseId, newFileName),
      targetAbsolute: path.join(CONTENT_LIBRARY_ROOT, String(exerciseId), 'images', newFileName),
    };
  });

  const firstImage = images[0] || null;

  return {
    exerciseId,
    exerciseTitle: row.ExerciseTitle || 'Exercise',
    oldPath: String(row.ImageURL || '').trim() || null,
    oldGallery: parseJsonArray(row.ImageGallery),
    newPath: firstImage ? `/${firstImage.newStoragePath}` : null,
    mediaProvider: MEDIA_PROVIDER_LOCAL,
    mediaPath: buildLogicalMediaPath(exerciseId),
    primaryImage: firstImage ? firstImage.newFileName : null,
    images,
    status: images.length > 0 ? 'ready' : 'no-source-files',
  };
}

function csvEscape(value) {
  const text = String(value == null ? '' : value);
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function writeAuditCsv(rows) {
  const header = ['ExerciseID', 'ExerciseTitle', 'OldPath', 'NewPath', 'Status'];
  const lines = [header.join(',')];

  for (const row of rows) {
    lines.push([
      csvEscape(row.exerciseId),
      csvEscape(row.exerciseTitle),
      csvEscape(row.oldPath || ''),
      csvEscape(row.newPath || ''),
      csvEscape(row.status || ''),
    ].join(','));
  }

  ensureDirectory(MIGRATION_STATE_ROOT);
  fs.writeFileSync(AUDIT_CSV_FILE, `${lines.join('\n')}\n`, 'utf8');
}

function requireAuthUser(req, res) {
  const user = req?.session?.user;
  if (!user?.id) {
    res.status(401).json({ error: 'Unauthorized. Please log in.' });
    return null;
  }
  return user;
}

function summarizePlan(planEntries) {
  const totalExercises = planEntries.length;
  const ready = planEntries.filter((entry) => entry.status === 'ready').length;
  const noSource = planEntries.filter((entry) => entry.status === 'no-source-files').length;
  const totalImages = planEntries.reduce((sum, entry) => sum + entry.images.length, 0);

  return {
    totalExercises,
    readyExercises: ready,
    missingSourceExercises: noSource,
    totalImages,
  };
}

async function requestGatewayTestImage(gatewayBase) {
  return axios.get(`${gatewayBase}/api/tools/test-image`, {
    timeout: 12000,
    responseType: 'stream',
    validateStatus: () => true,
  });
}

async function fetchExerciseRows() {
  await ensureExerciseMediaColumns(pool);
  const [rows] = await pool.query(
    `SELECT ExerciseID, ExerciseTitle, ImageURL, ImageGallery, MediaProvider, MediaPath, PrimaryImage
     FROM exercises
     ORDER BY ExerciseID ASC`
  );
  return Array.isArray(rows) ? rows : [];
}

async function generatePlan() {
  const rows = await fetchExerciseRows();
  const entries = rows.map((row) => makePlanEntry(row));

  const plan = {
    generatedAt: new Date().toISOString(),
    sourceRoot: FRONTEND_EXERCISE_ROOT,
    targetRoot: CONTENT_LIBRARY_ROOT,
    summary: summarizePlan(entries),
    entries,
  };

  ensureDirectory(MIGRATION_STATE_ROOT);
  fs.writeFileSync(PLAN_FILE, JSON.stringify(plan, null, 2), 'utf8');
  writeAuditCsv(entries);
  return plan;
}

function readPlanIfExists() {
  if (!fs.existsSync(PLAN_FILE)) return null;
  const raw = fs.readFileSync(PLAN_FILE, 'utf8');
  return JSON.parse(raw);
}

function readLastRunIfExists() {
  if (!fs.existsSync(LAST_RUN_FILE)) return null;
  const raw = fs.readFileSync(LAST_RUN_FILE, 'utf8');
  return JSON.parse(raw);
}

router.get('/tools/test-image', async (req, res) => {
  const gatewayBase = normalizeGatewayUrl(process.env.PUBLIC_GATEWAY_URL);

  if (!gatewayBase) {
    return res.status(500).json({
      success: false,
      message: 'PUBLIC_GATEWAY_URL is not configured.',
    });
  }

  try {
    const gatewayImageResponse = await requestGatewayTestImage(gatewayBase);

    if (gatewayImageResponse.status < 200 || gatewayImageResponse.status >= 300) {
      return res.status(gatewayImageResponse.status || 502).json({
        success: false,
        message: 'Gateway image retrieval failed.',
      });
    }

    const passthroughHeaders = ['content-type', 'content-length', 'cache-control', 'etag', 'last-modified'];
    passthroughHeaders.forEach((headerName) => {
      const headerValue = gatewayImageResponse.headers?.[headerName];
      if (headerValue) {
        res.setHeader(headerName, headerValue);
      }
    });

    return gatewayImageResponse.data.pipe(res);
  } catch (error) {
    console.error('Tools test image proxy failed:', error?.message || error);
    return res.status(502).json({
      success: false,
      message: 'Unable to retrieve test image via gateway proxy.',
    });
  }
});

router.get('/tools/status', async (req, res) => {
  const gatewayBase = normalizeGatewayUrl(process.env.PUBLIC_GATEWAY_URL);
  const timestamp = new Date().toISOString();

  if (!gatewayBase) {
    return res.status(500).json({
      gateway: false,
      storage: false,
      timestamp,
    });
  }

  let gateway = false;
  let storage = false;

  try {
    const gatewayResponse = await axios.get(gatewayBase, {
      timeout: 8000,
      validateStatus: () => true,
    });
    gateway = gatewayResponse.status >= 200 && gatewayResponse.status < 300;

    if (gateway) {
      const storageResponse = await requestGatewayTestImage(gatewayBase);
      const contentType = String(storageResponse.headers?.['content-type'] || '').toLowerCase();
      const isImageContent = contentType.startsWith('image/');

      storage =
        storageResponse.status >= 200 &&
        storageResponse.status < 300 &&
        isImageContent;
    }
  } catch (error) {
    console.error('Tools status check failed:', error?.message || error);
  }

  return res.json({
    gateway,
    storage,
    timestamp,
  });
});

router.get('/tools/migration/scan', async (req, res) => {
  const user = requireAuthUser(req, res);
  if (!user) return;

  try {
    const plan = await generatePlan();
    return res.json({
      success: true,
      generatedAt: plan.generatedAt,
      summary: plan.summary,
      sample: plan.entries.slice(0, 25),
    });
  } catch (error) {
    console.error('Migration scan failed:', error?.message || error);
    return res.status(500).json({ success: false, error: 'Migration scan failed.' });
  }
});

router.post('/tools/migration/plan', async (req, res) => {
  const user = requireAuthUser(req, res);
  if (!user) return;

  try {
    const plan = await generatePlan();
    return res.json({
      success: true,
      generatedAt: plan.generatedAt,
      summary: plan.summary,
      entries: plan.entries,
    });
  } catch (error) {
    console.error('Migration plan generation failed:', error?.message || error);
    return res.status(500).json({ success: false, error: 'Failed to generate migration plan.' });
  }
});

router.post('/tools/migration/execute', async (req, res) => {
  const user = requireAuthUser(req, res);
  if (!user) return;

  const dryRun = Boolean(req.body?.dryRun);

  try {
    const plan = await generatePlan();
    const readyEntries = plan.entries.filter((entry) => entry.status === 'ready');

    const [snapshotRows] = await pool.query(
      `SELECT ExerciseID, ImageURL, ImageGallery, MediaProvider, MediaPath, PrimaryImage
       FROM exercises
       ORDER BY ExerciseID ASC`
    );

    const runId = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(MIGRATION_STATE_ROOT, `backup-${runId}.json`);
    ensureDirectory(MIGRATION_STATE_ROOT);
    fs.writeFileSync(backupPath, JSON.stringify(snapshotRows, null, 2), 'utf8');

    const audit = [];
    const copiedFiles = [];

    for (const entry of plan.entries) {
      if (entry.status !== 'ready') {
        audit.push({
          exerciseId: entry.exerciseId,
          exerciseTitle: entry.exerciseTitle,
          oldPath: entry.oldPath,
          newPath: entry.newPath,
          status: 'SKIPPED_NO_SOURCE',
        });
        continue;
      }

      let status = 'SUCCESS';
      let errorMessage = '';

      try {
        const targetDir = path.join(CONTENT_LIBRARY_ROOT, String(entry.exerciseId), 'images');
        if (!dryRun) {
          ensureDirectory(targetDir);
          for (const image of entry.images) {
            fs.copyFileSync(image.sourceAbsolute, image.targetAbsolute);
            copiedFiles.push(image.targetAbsolute);
          }

          const gallery = entry.images.map((image) => image.newFileName);
          const primaryImage = gallery[0] || DEFAULT_IMAGE_NAME;

          await pool.query(
            `UPDATE exercises
             SET MediaProvider = ?,
                 MediaPath = ?,
                 PrimaryImage = ?,
                 ImageGallery = ?
             WHERE ExerciseID = ?`,
            [
              MEDIA_PROVIDER_LOCAL,
              buildLogicalMediaPath(entry.exerciseId),
              primaryImage,
              JSON.stringify(gallery),
              entry.exerciseId,
            ]
          );
        }
      } catch (error) {
        status = 'FAILED';
        errorMessage = error?.message || String(error);
      }

      audit.push({
        exerciseId: entry.exerciseId,
        exerciseTitle: entry.exerciseTitle,
        oldPath: entry.oldPath,
        newPath: entry.newPath,
        status: errorMessage ? `${status}: ${errorMessage}` : status,
      });
    }

    writeAuditCsv(audit);

    const run = {
      runId,
      executedAt: new Date().toISOString(),
      dryRun,
      backupPath,
      copiedFiles,
      planSummary: plan.summary,
      audit,
      successCount: audit.filter((item) => item.status.startsWith('SUCCESS')).length,
      failureCount: audit.filter((item) => item.status.startsWith('FAILED')).length,
      skippedCount: audit.filter((item) => item.status.startsWith('SKIPPED')).length,
      readyCount: readyEntries.length,
      auditCsvPath: AUDIT_CSV_FILE,
    };

    fs.writeFileSync(LAST_RUN_FILE, JSON.stringify(run, null, 2), 'utf8');

    return res.json({
      success: true,
      dryRun,
      run,
    });
  } catch (error) {
    console.error('Migration execute failed:', error?.message || error);
    return res.status(500).json({ success: false, error: 'Failed to execute migration.' });
  }
});

router.post('/tools/migration/verify', async (req, res) => {
  const user = requireAuthUser(req, res);
  if (!user) return;

  try {
    const plan = readPlanIfExists() || await generatePlan();
    const [rows] = await pool.query(
      `SELECT ExerciseID, MediaProvider, MediaPath, PrimaryImage
       FROM exercises`
    );
    const byExerciseId = new Map((rows || []).map((row) => [Number(row.ExerciseID), row]));

    const results = plan.entries.map((entry) => {
      const dbRow = byExerciseId.get(Number(entry.exerciseId));
      const expectedFiles = entry.images.map((image) => image.targetAbsolute);
      const missingFiles = expectedFiles.filter((filePath) => !fs.existsSync(filePath));

      const dbReady =
        dbRow &&
        String(dbRow.MediaProvider || '').toUpperCase() === MEDIA_PROVIDER_LOCAL &&
        String(dbRow.MediaPath || '') === buildLogicalMediaPath(entry.exerciseId) &&
        (!entry.primaryImage || String(dbRow.PrimaryImage || '') === entry.primaryImage);

      return {
        exerciseId: entry.exerciseId,
        exerciseTitle: entry.exerciseTitle,
        status: entry.status,
        missingFiles,
        dbReady,
        verified: entry.status !== 'ready' ? true : (missingFiles.length === 0 && dbReady),
      };
    });

    const verifiedCount = results.filter((item) => item.verified).length;
    const failed = results.filter((item) => !item.verified);

    return res.json({
      success: failed.length === 0,
      summary: {
        total: results.length,
        verified: verifiedCount,
        failed: failed.length,
      },
      failed,
      results,
    });
  } catch (error) {
    console.error('Migration verification failed:', error?.message || error);
    return res.status(500).json({ success: false, error: 'Failed to verify migration.' });
  }
});

router.post('/tools/migration/rollback', async (req, res) => {
  const user = requireAuthUser(req, res);
  if (!user) return;

  const deleteCopiedFiles = Boolean(req.body?.deleteCopiedFiles);

  try {
    const lastRun = readLastRunIfExists();
    if (!lastRun?.backupPath || !fs.existsSync(lastRun.backupPath)) {
      return res.status(404).json({ success: false, error: 'No rollback backup snapshot found.' });
    }

    const snapshot = JSON.parse(fs.readFileSync(lastRun.backupPath, 'utf8'));
    const rows = Array.isArray(snapshot) ? snapshot : [];

    for (const row of rows) {
      await pool.query(
        `UPDATE exercises
         SET ImageURL = ?,
             ImageGallery = ?,
             MediaProvider = ?,
             MediaPath = ?,
             PrimaryImage = ?
         WHERE ExerciseID = ?`,
        [
          row.ImageURL || null,
          row.ImageGallery || null,
          row.MediaProvider || MEDIA_PROVIDER_LOCAL,
          row.MediaPath || buildLogicalMediaPath(row.ExerciseID),
          row.PrimaryImage || null,
          row.ExerciseID,
        ]
      );
    }

    let deletedFiles = 0;
    if (deleteCopiedFiles && Array.isArray(lastRun.copiedFiles)) {
      for (const filePath of lastRun.copiedFiles) {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          deletedFiles += 1;
        }
      }
    }

    return res.json({
      success: true,
      restoredRows: rows.length,
      deletedFiles,
      deleteCopiedFiles,
    });
  } catch (error) {
    console.error('Migration rollback failed:', error?.message || error);
    return res.status(500).json({ success: false, error: 'Failed to rollback migration.' });
  }
});

module.exports = router;
