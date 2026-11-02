const pool = require('../db');
const {
  resolveGatewayConfig,
  getGatewayUrl,
  createRequestId,
  createSignature,
  createTimeoutSignal,
  buildGatewayHeaders,
  putObjectViaGateway,
} = require('../services/aiGatewayService');
const { deleteExerciseStoredMedia } = require('../api/excerises');

const baseUrl = process.env.WA_BASE_URL || 'http://localhost:5000';
const origin = process.env.WA_ORIGIN || 'http://localhost:5173';
const password = process.env.WA_TEST_PASSWORD || '-^LtH1kqJrDn';
const stamp = Date.now();

async function login(username) {
  const res = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify({ username, password, rememberMe: true }),
  });
  const json = await res.json().catch(() => ({}));
  const cookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  const cookie = cookies.map((entry) => entry.split(';')[0]).join('; ');
  return { status: res.status, json, cookie };
}

async function fetchGatewayObject(storageKey) {
  const cfg = resolveGatewayConfig(process.env);
  const gatewayUrl = getGatewayUrl(cfg);
  const payload = {
    appName: 'Workout-Atlas',
    type: 'LOCAL_CLOUD',
    payload: { action: 'GET_OBJECT', storageKey },
  };
  const body = JSON.stringify(payload);
  const requestId = createRequestId('wa-129c');
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createSignature(cfg.hmacSecret, 'POST', cfg.gatewayPath, timestamp, requestId, body);
  const timeout = createTimeoutSignal(cfg.timeoutMs);

  try {
    const res = await fetch(gatewayUrl, {
      method: 'POST',
      headers: buildGatewayHeaders({ requestId, timestamp, signature, apiToken: cfg.apiToken }),
      body,
      signal: timeout.signal,
    });
    const text = await res.text();
    let parsed = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch (_) {
      parsed = {};
    }

    const data = parsed?.data && typeof parsed.data === 'object' ? parsed.data : parsed;
    const ok = res.ok && data?.success !== false && parsed?.success !== false;
    if (!ok) {
      return { found: false, message: data?.message || parsed?.message || `HTTP ${res.status}` };
    }

    const dataBase64 = String(data?.dataBase64 || data?.objectBase64 || data?.base64 || '').trim();
    return { found: Boolean(dataBase64), dataBase64, contentType: String(data?.contentType || data?.mimeType || '').trim() };
  } finally {
    timeout.clear();
  }
}

async function resolveUserId(username) {
  const [rows] = await pool.query(
    `SELECT id
     FROM users
     WHERE LOWER(TRIM(username)) = LOWER(TRIM(?))
     LIMIT 1`,
    [username]
  );
  return Number(rows?.[0]?.id || 0);
}

async function countSnapshot() {
  const [rows] = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM exercises) AS exercises_total,
      (SELECT COUNT(*) FROM workout_schedules) AS schedules_total,
      (SELECT COUNT(*) FROM workout_schedule_groups) AS schedule_groups_total,
      (SELECT COUNT(*) FROM workout_schedule_exercises) AS schedule_exercises_total,
      (SELECT COUNT(*) FROM workout_log) AS workout_log_total
  `);
  return rows?.[0] || {};
}

async function createExercise({ ownerUserId, title, scope, publicationState, withMedia }) {
  const [insert] = await pool.query(
    `INSERT INTO exercises
      (CreatedByUserID, IsGlobalExercise, IsSystemExercise, ExerciseScope, ExercisePublicationState, OwnerTrainerID, SourceExerciseID,
       ExerciseTitle, MuscleGroup, Equipment, WorkoutType, RecordingType,
       ImageURL, MediaProvider, MediaPath, PrimaryImage, Instructions, ImageGallery,
       Duration, Calories, Distance, Speed, \`Laps-Rep\`)
     VALUES (?, ?, 0, ?, ?, ?, NULL,
       ?, 'Core: Abs', 'None', 'Strength', 'Sets & Reps',
       '', 'LOCAL', 'APP/exercise-library/0/images', '', ?, '[]',
       0, 0, 0, 0, 0)`,
    [
      ownerUserId,
      scope === 'SHARED' ? 1 : 0,
      scope,
      publicationState,
      scope === 'SHARED' ? ownerUserId : null,
      title,
      `QA ${title}`,
    ]
  );

  const exerciseId = Number(insert.insertId || 0);
  if (!exerciseId) {
    throw new Error(`Failed to create exercise ${title}`);
  }

  if (withMedia) {
    const sourceObject = await fetchGatewayObject('APP/exercise-library/1/images/1.jpg');
    if (!sourceObject.found) {
      throw new Error('Cannot seed QA media from system image 1.jpg');
    }

    const imageName = 'exercise.jpg';
    const mediaPath = `APP/exercise-library/${exerciseId}/images`;
    const storageKey = `${mediaPath}/${imageName}`;

    await putObjectViaGateway({
      storageKey,
      contentType: sourceObject.contentType || 'image/jpeg',
      dataBase64: sourceObject.dataBase64,
      appName: 'Workout-Atlas',
    });

    await pool.query(
      `UPDATE exercises
       SET MediaPath = ?,
           PrimaryImage = ?,
           ImageGallery = ?,
           ImageURL = ?
       WHERE ExerciseID = ? LIMIT 1`,
      [
        mediaPath,
        imageName,
        JSON.stringify([imageName]),
        `/api/media/exercises/${exerciseId}/image?name=${encodeURIComponent(imageName)}`,
        exerciseId,
      ]
    );
  }

  return exerciseId;
}

async function createSourcePlan({ ownerUserId, title, exerciseEntries, isFeatured = false }) {
  const [scheduleInsert] = await pool.query(
    `INSERT INTO workout_schedules
      (user_id, title, description, workout_type, workout_plan_type, estimated_duration_minutes, status, visibility, schedule_mode)
     VALUES (?, ?, ?, 'Strength', ?, 45, 'active', 'public', 'day')`,
    [ownerUserId, title, 'QA adoption source', isFeatured ? 'featured' : 'community_shared']
  );

  const scheduleId = Number(scheduleInsert.insertId || 0);
  const [groupInsert] = await pool.query(
    `INSERT INTO workout_schedule_groups (workout_schedule_id, label, group_type, sort_order)
     VALUES (?, 'Any Day', 'any', 1)`,
    [scheduleId]
  );
  const groupId = Number(groupInsert.insertId || 0);

  for (let i = 0; i < exerciseEntries.length; i += 1) {
    const entry = exerciseEntries[i];
    await pool.query(
      `INSERT INTO workout_schedule_exercises
        (workout_schedule_id, workout_schedule_group_id, exercise_id, exercise_name, exercise_image_url, workout_type, muscle_group, equipment,
         sort_order, notes, target_sets, target_reps, target_weight, target_duration_minutes, target_rest_seconds)
       VALUES (?, ?, ?, ?, ?, 'Strength', 'Core: Abs', 'None', ?, ?, ?, ?, ?, ?, ?)`,
      [
        scheduleId,
        groupId,
        entry.exerciseId,
        entry.name,
        entry.image,
        i + 1,
        entry.notes,
        entry.sets,
        entry.reps,
        entry.weight,
        entry.duration,
        entry.rest,
      ]
    );
  }

  return { scheduleId, groupId };
}

async function hardDeleteExercise(exerciseId) {
  const safeId = Number(exerciseId || 0);
  if (!safeId) return;

  const [rows] = await pool.query(
    `SELECT ExerciseID, ExerciseTitle, ImageURL, ImageGallery, CreatedByUserID,
            OwnerTrainerID, SourceExerciseID, ExerciseScope, ExercisePublicationState,
            IsGlobalExercise, COALESCE(IsSystemExercise, 0) AS IsSystemExercise,
            MediaProvider, MediaPath, PrimaryImage
     FROM exercises
     WHERE ExerciseID = ?
     LIMIT 1`,
    [safeId]
  );

  const row = rows?.[0] || null;
  if (!row) return;

  await deleteExerciseStoredMedia({ exerciseId: safeId, exercise: row });
  await pool.query('DELETE FROM user_favorite_exercises WHERE exercise_id = ?', [safeId]);
  await pool.query('DELETE FROM exercises WHERE ExerciseID = ? LIMIT 1', [safeId]);
}

async function deleteScheduleCascade(scheduleId) {
  const safeId = Number(scheduleId || 0);
  if (!safeId) return;
  await pool.query('DELETE FROM workout_schedule_exercises WHERE workout_schedule_id = ?', [safeId]);
  await pool.query('DELETE FROM workout_schedule_groups WHERE workout_schedule_id = ?', [safeId]);
  await pool.query('DELETE FROM workout_schedules WHERE id = ? LIMIT 1', [safeId]);
}

(async () => {
  const trainerUserId = await resolveUserId('trainer@demo.com');
  const recipientUserId = await resolveUserId('user@demo.com');
  if (!trainerUserId || !recipientUserId) {
    throw new Error('Could not resolve trainer or recipient user IDs.');
  }

  const userSession = await login('user@demo.com');
  if (userSession.status !== 200 || !userSession.cookie) {
    throw new Error('Could not establish recipient login session.');
  }

  const qaCreatedExerciseIds = [];
  const qaCreatedScheduleIds = [];
  const qaAdoptedScheduleIds = [];
  const verdicts = [];
  const add = (name, pass, detail) => verdicts.push({ test: name, pass: Boolean(pass), detail });

  const before = await countSnapshot();

  try {
    const systemExerciseId = 1;

    const sharedExerciseId = await createExercise({
      ownerUserId: trainerUserId,
      title: `QA_085129C_SHARED_${stamp}`,
      scope: 'SHARED',
      publicationState: 'DISCOVERABLE',
      withMedia: false,
    });
    qaCreatedExerciseIds.push(sharedExerciseId);

    const customDiscoverableId = await createExercise({
      ownerUserId: trainerUserId,
      title: `QA_085129C_CUSTOM_DISC_${stamp}`,
      scope: 'CUSTOM',
      publicationState: 'DISCOVERABLE',
      withMedia: true,
    });
    qaCreatedExerciseIds.push(customDiscoverableId);

    const customRestrictedId = await createExercise({
      ownerUserId: trainerUserId,
      title: `QA_085129C_CUSTOM_REST_${stamp}`,
      scope: 'CUSTOM',
      publicationState: 'RESTRICTED',
      withMedia: true,
    });
    qaCreatedExerciseIds.push(customRestrictedId);

    const successPlan = await createSourcePlan({
      ownerUserId: trainerUserId,
      title: `QA_085129C_PLAN_SUCCESS_${stamp}`,
      exerciseEntries: [
        { exerciseId: systemExerciseId, name: 'System Keep', image: '/api/media/exercises/1/image?name=1.jpg', notes: 'sys', sets: 3, reps: 10, weight: 0, duration: 0, rest: 45 },
        { exerciseId: sharedExerciseId, name: 'Shared Keep', image: '', notes: 'shared', sets: 4, reps: 8, weight: 0, duration: 0, rest: 60 },
        { exerciseId: customDiscoverableId, name: 'Custom Copy A', image: `/api/media/exercises/${customDiscoverableId}/image?name=exercise.jpg`, notes: 'custom-a', sets: 5, reps: 6, weight: 25, duration: 0, rest: 75 },
        { exerciseId: customDiscoverableId, name: 'Custom Copy A Repeat', image: `/api/media/exercises/${customDiscoverableId}/image?name=exercise.jpg`, notes: 'custom-a-repeat', sets: 2, reps: 12, weight: 15, duration: 0, rest: 30 },
      ],
    });
    qaCreatedScheduleIds.push(successPlan.scheduleId);

    const unauthorizedPlan = await createSourcePlan({
      ownerUserId: trainerUserId,
      title: `QA_085129C_PLAN_UNAUTH_${stamp}`,
      exerciseEntries: [
        { exerciseId: customRestrictedId, name: 'Restricted Source', image: `/api/media/exercises/${customRestrictedId}/image?name=exercise.jpg`, notes: 'restricted', sets: 1, reps: 1, weight: 0, duration: 0, rest: 10 },
      ],
    });
    qaCreatedScheduleIds.push(unauthorizedPlan.scheduleId);

    const failurePlan = await createSourcePlan({
      ownerUserId: trainerUserId,
      title: `QA_085129C_PLAN_FAIL_${stamp}`,
      exerciseEntries: [
        { exerciseId: customDiscoverableId, name: 'Custom Copy First', image: `/api/media/exercises/${customDiscoverableId}/image?name=exercise.jpg`, notes: 'copy-first', sets: 3, reps: 5, weight: 20, duration: 0, rest: 20 },
        { exerciseId: customRestrictedId, name: 'Restricted Blocker', image: `/api/media/exercises/${customRestrictedId}/image?name=exercise.jpg`, notes: 'blocked-second', sets: 1, reps: 1, weight: 0, duration: 0, rest: 5 },
      ],
    });
    qaCreatedScheduleIds.push(failurePlan.scheduleId);

    const adoptSuccessRes = await fetch(`${baseUrl}/api/global-workout-plans/${successPlan.scheduleId}/use`, {
      method: 'POST',
      headers: { Origin: origin, Cookie: userSession.cookie },
    });
    const adoptSuccessJson = await adoptSuccessRes.json().catch(() => ({}));
    add('Adopt success plan responds 201', adoptSuccessRes.status === 201, `status=${adoptSuccessRes.status}`);

    const adoptedScheduleId = Number(adoptSuccessJson?.planner?.planId || 0);
    if (!adoptedScheduleId) {
      throw new Error('Adoption succeeded but no adopted planId returned.');
    }
    qaAdoptedScheduleIds.push(adoptedScheduleId);

    const [adoptedRows] = await pool.query(
      `SELECT id, exercise_id, exercise_name, notes, target_sets, target_reps, target_weight, target_duration_minutes, target_rest_seconds, sort_order
       FROM workout_schedule_exercises
       WHERE workout_schedule_id = ?
       ORDER BY sort_order ASC, id ASC`,
      [adoptedScheduleId]
    );

    const adoptedIds = adoptedRows.map((row) => Number(row.exercise_id || 0));
    add('Schedule ordering and count preserved', adoptedRows.length === 4 && adoptedRows.every((row, idx) => Number(row.sort_order || 0) === idx + 1), `rows=${adoptedRows.length}`);

    const [copiedCustomRows] = await pool.query(
      `SELECT ExerciseID, CreatedByUserID, ExerciseScope, ExercisePublicationState, SourceExerciseID, MediaPath, ImageURL, PrimaryImage
       FROM exercises
       WHERE CreatedByUserID = ?
         AND SourceExerciseID = ?
       ORDER BY ExerciseID DESC`,
      [recipientUserId, customDiscoverableId]
    );

    const copiedCustom = copiedCustomRows[0] || null;
    if (!copiedCustom) {
      throw new Error('Could not locate copied custom exercise for recipient.');
    }

    const copiedCustomId = Number(copiedCustom.ExerciseID || 0);
    qaCreatedExerciseIds.push(copiedCustomId);

    add('SYSTEM ID retained', adoptedIds.includes(systemExerciseId), `ids=${adoptedIds.join(',')}`);
    add('SHARED ID retained', adoptedIds.includes(sharedExerciseId), `ids=${adoptedIds.join(',')}`);
    add('CUSTOM received independent ID', adoptedIds.includes(copiedCustomId) && !adoptedIds.includes(customDiscoverableId), `copied=${copiedCustomId}`);

    const copiedOccurrences = adoptedIds.filter((id) => id === copiedCustomId).length;
    add('Repeated CUSTOM deduplicated to one copied ExerciseID', copiedOccurrences === 2, `copiedOccurrences=${copiedOccurrences}`);

    add(
      'Copied CUSTOM recipient-owned and restricted',
      Number(copiedCustom.CreatedByUserID || 0) === recipientUserId
        && String(copiedCustom.ExerciseScope || '').toUpperCase() === 'CUSTOM'
        && String(copiedCustom.ExercisePublicationState || '').toUpperCase() === 'RESTRICTED',
      `owner=${copiedCustom.CreatedByUserID}, scope=${copiedCustom.ExerciseScope}, pub=${copiedCustom.ExercisePublicationState}`
    );

    add('SourceExerciseID provenance preserved', Number(copiedCustom.SourceExerciseID || 0) === customDiscoverableId, `source=${copiedCustom.SourceExerciseID}`);

    const copiedMediaPathOk = String(copiedCustom.MediaPath || '').includes(`/${copiedCustomId}/images`);
    const copiedMediaObject = await fetchGatewayObject(`APP/exercise-library/${copiedCustomId}/images/${copiedCustom.PrimaryImage || 'exercise.jpg'}`);
    add('Copied media independently stored and accessible in new namespace', copiedMediaPathOk && copiedMediaObject.found, `path=${copiedCustom.MediaPath}`);

    const unauthorizedRes = await fetch(`${baseUrl}/api/global-workout-plans/${unauthorizedPlan.scheduleId}/use`, {
      method: 'POST',
      headers: { Origin: origin, Cookie: userSession.cookie },
    });
    add('Unauthorized restricted plan adoption is blocked', unauthorizedRes.status === 403, `status=${unauthorizedRes.status}`);

    const [sourceMarkerRows] = await pool.query(`SELECT COALESCE(MAX(ExerciseID), 0) AS max_id FROM exercises`);
    const predictedCopiedIdOnFailure = Number(sourceMarkerRows?.[0]?.max_id || 0) + 1;

    const failRes = await fetch(`${baseUrl}/api/global-workout-plans/${failurePlan.scheduleId}/use`, {
      method: 'POST',
      headers: { Origin: origin, Cookie: userSession.cookie },
    });
    add('Forced failure scenario triggers adoption rejection', failRes.status === 403, `status=${failRes.status}`);

    const [failedCopyRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM exercises
       WHERE CreatedByUserID = ? AND SourceExerciseID = ? AND ExerciseID = ?`,
      [recipientUserId, customDiscoverableId, predictedCopiedIdOnFailure]
    );

    const noFailedCopyRow = Number(failedCopyRows?.[0]?.total || 0) === 0;
    const failedCopyMedia = await fetchGatewayObject(`APP/exercise-library/${predictedCopiedIdOnFailure}/images/exercise.jpg`);
    add('Outer rollback removes DB copy and cleans copied media object', noFailedCopyRow && !failedCopyMedia.found, `predictedCopyId=${predictedCopiedIdOnFailure}, mediaFound=${failedCopyMedia.found}`);

    const [historyRows] = await pool.query(`SELECT COUNT(*) AS total FROM workout_log`);
    add('Workout history unchanged', Number(historyRows?.[0]?.total || 0) === Number(before.workout_log_total || 0), `before=${before.workout_log_total}, after=${historyRows?.[0]?.total}`);

    for (const adoptedId of qaAdoptedScheduleIds) {
      await deleteScheduleCascade(adoptedId);
    }
    for (const sourceScheduleId of qaCreatedScheduleIds) {
      await deleteScheduleCascade(sourceScheduleId);
    }
    for (const exerciseId of [...new Set(qaCreatedExerciseIds)].reverse()) {
      await hardDeleteExercise(exerciseId);
    }

    const after = await countSnapshot();
    add(
      'QA cleanup restored baseline counts',
      Number(after.exercises_total || 0) === Number(before.exercises_total || 0)
      && Number(after.schedules_total || 0) === Number(before.schedules_total || 0)
      && Number(after.schedule_groups_total || 0) === Number(before.schedule_groups_total || 0)
      && Number(after.schedule_exercises_total || 0) === Number(before.schedule_exercises_total || 0)
      && Number(after.workout_log_total || 0) === Number(before.workout_log_total || 0),
      `before=${JSON.stringify(before)}, after=${JSON.stringify(after)}`
    );

    const passCount = verdicts.filter((v) => v.pass).length;
    const failCount = verdicts.filter((v) => !v.pass).length;

    console.log(JSON.stringify({
      overall: failCount === 0 ? 'PASS' : 'FAIL',
      summary: { passCount, failCount },
      verdicts,
    }, null, 2));

    process.exit(failCount === 0 ? 0 : 2);
  } catch (err) {
    for (const adoptedId of qaAdoptedScheduleIds) {
      try { await deleteScheduleCascade(adoptedId); } catch (_) {}
    }
    for (const sourceScheduleId of qaCreatedScheduleIds) {
      try { await deleteScheduleCascade(sourceScheduleId); } catch (_) {}
    }
    for (const exerciseId of [...new Set(qaCreatedExerciseIds)].reverse()) {
      try { await hardDeleteExercise(exerciseId); } catch (_) {}
    }

    console.log(JSON.stringify({ overall: 'FAIL', error: err?.message || String(err), verdicts }, null, 2));
    process.exit(1);
  }
})();
