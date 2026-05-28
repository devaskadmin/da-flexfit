const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { sanitizeText, parseNumber } = require('../utils/sanitize.js');

// ✅ DB Connect
const pool = require('../db');

function deepMerge(target, source) {
  const out = { ...(target || {}) };
  for (const key of Object.keys(source || {})) {
    const sourceValue = source[key];
    const targetValue = out[key];

    if (
      sourceValue &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      out[key] = deepMerge(targetValue, sourceValue);
    } else {
      out[key] = sourceValue;
    }
  }
  return out;
}

const readSettingsObject = (raw) => {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) || {};
    } catch (_) {
      return {};
    }
  }
  return {};
};

const buildPlanId = () => {
  return `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const extractWorkoutPlans = (settings) => {
  const planner = settings?.workoutPlanner || {};
  const plans = Array.isArray(planner?.plans) ? planner.plans.filter(Boolean) : [];
  const currentPlan = planner?.currentPlan && typeof planner.currentPlan === 'object'
    ? planner.currentPlan
    : null;

  if (!currentPlan) {
    return plans;
  }

  const currentPlanId = String(currentPlan?.planId || '').trim();
  if (currentPlanId && !plans.some((plan) => String(plan?.planId || '').trim() === currentPlanId)) {
    return [...plans, currentPlan];
  }

  return plans;
};

const serializeWorkoutListItem = (plan) => {
  const exercises = Array.isArray(plan?.exercises) ? plan.exercises : [];
  const firstExerciseWithImage = exercises.find((exercise) => {
    const candidate = String(exercise?.image || exercise?.ImageURL || '').trim();
    return Boolean(candidate);
  });

  return {
    planId: String(plan?.planId || '').trim(),
    name: String(plan?.metadata?.name || '').trim() || 'Untitled Workout',
    type: String(plan?.metadata?.type || 'Strength').trim() || 'Strength',
    estimatedDuration: Number(plan?.metadata?.estimatedDuration || 0),
    exerciseCount: exercises.length,
    coverImage: String(firstExerciseWithImage?.image || firstExerciseWithImage?.ImageURL || '').trim(),
    updatedAt: plan?.updatedAt || null,
  };
};

const hasSavedWorkoutExerciseList = (settings) => {
  const plans = extractWorkoutPlans(settings);
  return plans.some((plan) => Array.isArray(plan?.exercises) && plan.exercises.length > 0);
};

const normalizePlannerPayload = (planner = {}) => {
  const defaultDayGroups = ['Any Day'];
  const defaultWeekGroups = ['Week 1'];

  const normalizeOrderEntries = (entries, fallbackGroups) => {
    const source = Array.isArray(entries) ? entries : [];
    const byLabel = new Map();

    source.forEach((entry, index) => {
      const label = String(entry?.label || '').trim();
      if (!label) {
        return;
      }
      const numericOrder = Number(entry?.sortOrder);
      byLabel.set(
        label.toLowerCase(),
        Number.isFinite(numericOrder) && numericOrder > 0 ? numericOrder : index + 1
      );
    });

    const normalizedGroups = fallbackGroups.map((label) => String(label || '').trim()).filter(Boolean);
    const orderedGroups = [...normalizedGroups].sort((left, right) => {
      const leftOrder = byLabel.get(left.toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = byLabel.get(right.toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }
      return normalizedGroups.indexOf(left) - normalizedGroups.indexOf(right);
    });

    return {
      orderedGroups,
      orderEntries: orderedGroups.map((label, index) => ({ label, sortOrder: index + 1 })),
    };
  };

  const incomingDayGroups = Array.isArray(planner.dayGroups)
    ? planner.dayGroups.map((v) => String(v || '').trim()).filter(Boolean)
    : defaultDayGroups;

  const incomingWeekGroups = Array.isArray(planner.weekGroups)
    ? planner.weekGroups.map((v) => String(v || '').trim()).filter(Boolean)
    : defaultWeekGroups;

  const normalizedDayGroupsBase = incomingDayGroups.length > 0 ? incomingDayGroups : defaultDayGroups;
  const normalizedWeekGroupsBase = incomingWeekGroups.length > 0 ? incomingWeekGroups : defaultWeekGroups;

  const dayOrderInfo = normalizeOrderEntries(planner.dayGroupOrders, normalizedDayGroupsBase);
  const weekOrderInfo = normalizeOrderEntries(planner.weekGroupOrders, normalizedWeekGroupsBase);

  const normalizedDayGroups = dayOrderInfo.orderedGroups.length ? dayOrderInfo.orderedGroups : defaultDayGroups;
  const normalizedWeekGroups = weekOrderInfo.orderedGroups.length ? weekOrderInfo.orderedGroups : defaultWeekGroups;
  const mode = planner.scheduleMode === 'week' ? 'week' : 'day';
  const fallbackGroup = mode === 'week' ? normalizedWeekGroups[0] : normalizedDayGroups[0];

  const exercises = Array.isArray(planner.exercises)
    ? planner.exercises.map((exercise) => ({
        id: String(exercise?.id || ''),
        exerciseId: Number(exercise?.exerciseId || 0),
        name: String(exercise?.name || '').trim(),
        image: String(exercise?.image || '').trim(),
        workoutType: String(exercise?.workoutType || '').trim(),
        muscleGroup: String(exercise?.muscleGroup || '').trim(),
        equipment: String(exercise?.equipment || '').trim(),
        sets: Number(exercise?.sets || 0),
        reps: Number(exercise?.reps || 0),
        weight: Number(exercise?.weight || 0),
        duration: Number(exercise?.duration || 0),
        restTime: Number(exercise?.restTime || 0),
        notes: String(exercise?.notes || '').trim(),
        scheduleGroup: String(exercise?.scheduleGroup || fallbackGroup),
      }))
    : [];

  const metadata = {
    name: String(planner?.metadata?.name || '').trim(),
    description: String(planner?.metadata?.description || '').trim(),
    type: String(planner?.metadata?.type || 'Strength').trim() || 'Strength',
    estimatedDuration: Number(planner?.metadata?.estimatedDuration || 0),
  };

  const incomingPlanId = String(planner?.planId || '').trim();

  return {
    version: 1,
    planId: incomingPlanId || buildPlanId(),
    scheduleMode: mode,
    dayGroups: normalizedDayGroups,
    weekGroups: normalizedWeekGroups,
    dayGroupOrders: dayOrderInfo.orderEntries,
    weekGroupOrders: weekOrderInfo.orderEntries,
    metadata,
    exercises,
    updatedAt: new Date().toISOString(),
  };
};

//Gets user ID
router.get('/user-id', (req, res) => {
    if (req.session?.user?.id) {
      return res.json({ userId: req.session.user.id });
    }
    res.status(401).json({ error: 'User not logged in' });
  });

//Get Users
  router.get('/users', async (req, res) => {
    try {
      const [rows] = await pool.query('SELECT * FROM users');
      res.status(200).json(rows);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch users', details: err.message });
    }
  });

// Get current user's profile settings JSON
router.get('/user-profile-settings', async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not logged in' });
    }

    const [rows] = await pool.query('SELECT settings FROM user_profiles WHERE user_id = ? LIMIT 1', [userId]);

    let userRows = [];
    try {
      // Preferred shape when Email column exists.
      [userRows] = await pool.query(
        'SELECT FirstName, LastName, username, Email FROM users WHERE id = ? LIMIT 1',
        [userId]
      );
    } catch (err) {
      // Backward-compatible fallback for schemas where only username exists.
      if (err?.code === 'ER_BAD_FIELD_ERROR') {
        [userRows] = await pool.query(
          'SELECT FirstName, LastName, username FROM users WHERE id = ? LIMIT 1',
          [userId]
        );
      } else {
        throw err;
      }
    }

    const user = userRows?.[0] || {};
    
    // Apply default avatar if none exists
    const avatarPath = user?.avatarPath || '/images/avatar/default.png';
    const avatarName = user?.avatarName || 'default.png';
    
    const profile = {
      firstName: user?.FirstName || '',
      lastName: user?.LastName || '',
      username: user?.username || '',
      email: user?.Email || user?.email || user?.username || '',
      avatarPath: avatarPath,
      avatarName: avatarName,
    };

    if (!rows.length) {
      return res.json({ settings: {}, profile });
    }

    let parsed = {};
    const raw = rows[0]?.settings;
    if (typeof raw === 'string' && raw.trim()) {
      try {
        parsed = JSON.parse(raw);
      } catch (_) {
        parsed = {};
      }
    } else if (raw && typeof raw === 'object') {
      parsed = raw;
    }

    return res.json({ settings: parsed || {}, profile });
  } catch (err) {
    console.error('❌ Failed to get user profile settings:', err);
    return res.status(500).json({ error: 'Failed to load user profile settings' });
  }
});

// Save/merge current user's profile settings JSON
router.put('/user-profile-settings', async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not logged in' });
    }

    const incoming = req.body?.settings;
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
      return res.status(400).json({ error: 'settings object is required' });
    }

    const [rows] = await pool.query('SELECT settings FROM user_profiles WHERE user_id = ? LIMIT 1', [userId]);
    let currentSettings = {};
    if (rows.length > 0) {
      const raw = rows[0]?.settings;
      if (typeof raw === 'string' && raw.trim()) {
        try {
          currentSettings = JSON.parse(raw) || {};
        } catch (_) {
          currentSettings = {};
        }
      } else if (raw && typeof raw === 'object') {
        currentSettings = raw;
      }
    }

    const mergedSettings = deepMerge(currentSettings, incoming);

    await pool.query(
      `INSERT INTO user_profiles (user_id, user_role, tier, settings)
       VALUES (?, 'member', 1, ?)
       ON DUPLICATE KEY UPDATE settings = VALUES(settings)`,
      [userId, JSON.stringify(mergedSettings)]
    );

    return res.json({ message: 'Profile settings saved', settings: mergedSettings });
  } catch (err) {
    console.error('❌ Failed to save user profile settings:', err);
    return res.status(500).json({ error: 'Failed to save user profile settings' });
  }
});

const serializeScheduleListItem = (row = {}) => ({
  planId: String(row.id || ''),
  name: String(row.title || '').trim() || 'Untitled Workout',
  type: String(row.workout_type || 'Strength').trim() || 'Strength',
  estimatedDuration: Number(row.estimated_duration_minutes || 0),
  exerciseCount: Number(row.exercise_count || 0),
  coverImage: String(row.cover_image || '').trim(),
  status: String(row.status || 'draft').trim() || 'draft',
  visibility: String(row.visibility || 'private').trim() || 'private',
  updatedAt: row.updated_at || null,
});

const loadSchedulesForUser = async (userId) => {
  const [rows] = await pool.query(
    `SELECT
      ws.id,
      ws.title,
      ws.workout_type,
      ws.estimated_duration_minutes,
      ws.status,
      ws.visibility,
      ws.updated_at,
      COUNT(wse.id) AS exercise_count,
      MIN(
        CASE
          WHEN COALESCE(wse.exercise_image_url, e.ImageURL, '') <> ''
          THEN COALESCE(wse.exercise_image_url, e.ImageURL)
          ELSE NULL
        END
      ) AS cover_image
    FROM workout_schedules ws
    LEFT JOIN workout_schedule_exercises wse ON wse.workout_schedule_id = ws.id
    LEFT JOIN exercises e ON e.ExerciseID = wse.exercise_id
    WHERE ws.user_id = ?
    GROUP BY ws.id
    ORDER BY ws.updated_at DESC, ws.id DESC`,
    [userId]
  );

  return rows.map(serializeScheduleListItem);
};

const hasSavedExercisesForUser = async (userId) => {
  const [rows] = await pool.query(
    `SELECT 1
     FROM workout_schedules ws
     INNER JOIN workout_schedule_exercises wse ON wse.workout_schedule_id = ws.id
     WHERE ws.user_id = ?
     LIMIT 1`,
    [userId]
  );
  return rows.length > 0;
};

const buildPlannerFromSchedule = async (scheduleId, userId) => {
  const [scheduleRows] = await pool.query(
    `SELECT *
     FROM workout_schedules
     WHERE id = ? AND user_id = ?
     LIMIT 1`,
    [scheduleId, userId]
  );

  if (!scheduleRows.length) {
    return null;
  }

  const schedule = scheduleRows[0];

  const [groupRows] = await pool.query(
    `SELECT id, label, group_type, sort_order
     FROM workout_schedule_groups
     WHERE workout_schedule_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [schedule.id]
  );

  const [exerciseRows] = await pool.query(
    `SELECT
      wse.id,
      wse.workout_schedule_id,
      wse.workout_schedule_group_id,
      wse.exercise_id,
      wse.exercise_name,
      wse.exercise_image_url,
      wse.workout_type,
      wse.muscle_group,
      wse.equipment,
      wse.sort_order,
      wse.notes,
      wse.target_sets,
      wse.target_reps,
      wse.target_weight,
      wse.target_duration_minutes,
      wse.target_rest_seconds,
      wsg.label AS group_label,
      e.ExerciseTitle,
      e.ImageURL,
      e.WorkoutType AS ExerciseWorkoutType,
      e.MuscleGroup AS ExerciseMuscleGroup,
      e.Equipment AS ExerciseEquipment
     FROM workout_schedule_exercises wse
     LEFT JOIN workout_schedule_groups wsg ON wsg.id = wse.workout_schedule_group_id
     LEFT JOIN exercises e ON e.ExerciseID = wse.exercise_id
     WHERE wse.workout_schedule_id = ?
     ORDER BY wse.sort_order ASC, wse.id ASC`,
    [schedule.id]
  );

  const scheduleMode = String(schedule.schedule_mode || 'day').trim() === 'week' ? 'week' : 'day';

  const dayGroupRows = groupRows.filter((g) => ['day', 'any', 'section'].includes(String(g.group_type || '').trim()));
  const weekGroupRows = groupRows.filter((g) => String(g.group_type || '').trim() === 'week');

  const dayGroups = dayGroupRows
    .map((g) => String(g.label || '').trim())
    .filter(Boolean);
  const weekGroups = weekGroupRows
    .map((g) => String(g.label || '').trim())
    .filter(Boolean);

  const dayGroupOrders = dayGroupRows
    .map((g, index) => ({
      label: String(g.label || '').trim(),
      sortOrder: Number(g.sort_order || index + 1) || index + 1,
    }))
    .filter((entry) => entry.label);

  const weekGroupOrders = weekGroupRows
    .map((g, index) => ({
      label: String(g.label || '').trim(),
      sortOrder: Number(g.sort_order || index + 1) || index + 1,
    }))
    .filter((entry) => entry.label);

  const fallbackGroup = scheduleMode === 'week'
    ? (weekGroups[0] || 'Week 1')
    : (dayGroups[0] || 'Any Day');

  const exercises = exerciseRows.map((row) => ({
    id: `wse-${row.id}`,
    exerciseId: Number(row.exercise_id || 0),
    name: String(row.exercise_name || row.ExerciseTitle || '').trim(),
    image: String(row.exercise_image_url || row.ImageURL || '').trim(),
    workoutType: String(row.workout_type || row.ExerciseWorkoutType || schedule.workout_type || '').trim(),
    muscleGroup: String(row.muscle_group || row.ExerciseMuscleGroup || '').trim(),
    equipment: String(row.equipment || row.ExerciseEquipment || '').trim(),
    sets: Number(row.target_sets || 0),
    reps: Number(row.target_reps || 0),
    weight: Number(row.target_weight || 0),
    duration: Number(row.target_duration_minutes || 0),
    restTime: Number(row.target_rest_seconds || 0),
    notes: String(row.notes || '').trim(),
    scheduleGroup: String(row.group_label || fallbackGroup).trim() || fallbackGroup,
    sortOrder: Number(row.sort_order || 0),
  }));

  return {
    version: 2,
    planId: String(schedule.id),
    scheduleMode,
    dayGroups: dayGroups.length ? dayGroups : ['Any Day'],
    weekGroups: weekGroups.length ? weekGroups : ['Week 1'],
    dayGroupOrders: dayGroupOrders.length ? dayGroupOrders : [{ label: 'Any Day', sortOrder: 1 }],
    weekGroupOrders: weekGroupOrders.length ? weekGroupOrders : [{ label: 'Week 1', sortOrder: 1 }],
    metadata: {
      name: String(schedule.title || '').trim(),
      description: String(schedule.description || '').trim(),
      type: String(schedule.workout_type || 'Strength').trim() || 'Strength',
      estimatedDuration: Number(schedule.estimated_duration_minutes || 0),
    },
    exercises,
    status: String(schedule.status || 'draft').trim() || 'draft',
    visibility: String(schedule.visibility || 'private').trim() || 'private',
    updatedAt: schedule.updated_at,
  };
};

const replaceScheduleGroupsAndExercises = async (connection, scheduleId, planner) => {
  const mode = planner?.scheduleMode === 'week' ? 'week' : 'day';
  const inputDayGroups = Array.isArray(planner?.dayGroups) ? planner.dayGroups : [];
  const inputWeekGroups = Array.isArray(planner?.weekGroups) ? planner.weekGroups : [];

  const dayGroups = inputDayGroups.map((v) => String(v || '').trim()).filter(Boolean);
  const weekGroups = inputWeekGroups.map((v) => String(v || '').trim()).filter(Boolean);

  const normalizedDayGroups = dayGroups.length ? dayGroups : ['Any Day'];
  const normalizedWeekGroups = weekGroups.length ? weekGroups : ['Week 1'];

  const incomingDayOrders = Array.isArray(planner?.dayGroupOrders) ? planner.dayGroupOrders : [];
  const incomingWeekOrders = Array.isArray(planner?.weekGroupOrders) ? planner.weekGroupOrders : [];

  const findSortOrder = (entries, label, fallbackIndex) => {
    const normalizedLabel = String(label || '').trim().toLowerCase();
    const found = entries.find((entry) => String(entry?.label || '').trim().toLowerCase() === normalizedLabel);
    const parsed = Number(found?.sortOrder);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackIndex + 1;
  };

  const groupEntries = mode === 'week'
    ? normalizedWeekGroups
      .map((label, index) => ({
        label,
        groupType: 'week',
        sortOrder: findSortOrder(incomingWeekOrders, label, index),
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder)
    : normalizedDayGroups
      .map((label, index) => ({
        label,
        groupType: label.toLowerCase() === 'any day' ? 'any' : 'day',
        sortOrder: findSortOrder(incomingDayOrders, label, index),
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder);

  await connection.query('DELETE FROM workout_schedule_exercises WHERE workout_schedule_id = ?', [scheduleId]);
  await connection.query('DELETE FROM workout_schedule_groups WHERE workout_schedule_id = ?', [scheduleId]);

  const groupIdByLabel = new Map();
  for (const groupEntry of groupEntries) {
    const [insertGroup] = await connection.query(
      `INSERT INTO workout_schedule_groups
        (workout_schedule_id, label, group_type, sort_order)
       VALUES (?, ?, ?, ?)`,
      [scheduleId, groupEntry.label, groupEntry.groupType, groupEntry.sortOrder]
    );
    groupIdByLabel.set(groupEntry.label, insertGroup.insertId);
  }

  const fallbackGroupLabel = mode === 'week' ? normalizedWeekGroups[0] : normalizedDayGroups[0];
  const exercises = Array.isArray(planner?.exercises) ? planner.exercises : [];

  for (let i = 0; i < exercises.length; i += 1) {
    const ex = exercises[i] || {};
    const label = String(ex.scheduleGroup || fallbackGroupLabel || '').trim();
    const groupId = groupIdByLabel.get(label) || null;

    await connection.query(
      `INSERT INTO workout_schedule_exercises
        (
          workout_schedule_id,
          workout_schedule_group_id,
          exercise_id,
          exercise_name,
          exercise_image_url,
          workout_type,
          muscle_group,
          equipment,
          sort_order,
          notes,
          target_sets,
          target_reps,
          target_weight,
          target_duration_minutes,
          target_rest_seconds
        )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        scheduleId,
        groupId,
        Number(ex.exerciseId || 0) || null,
        sanitizeText(ex.name || '', 150),
        sanitizeText(ex.image || '', 255),
        sanitizeText(ex.workoutType || '', 50),
        sanitizeText(ex.muscleGroup || '', 80),
        sanitizeText(ex.equipment || '', 80),
        i + 1,
        sanitizeText(ex.notes || '', 500),
        parseNumber(ex.sets),
        parseNumber(ex.reps),
        parseNumber(ex.weight, true),
        parseNumber(ex.duration),
        parseNumber(ex.restTime),
      ]
    );
  }
};

// New API: create draft schedule immediately (supports zero exercises)
router.post('/workout-schedules', async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not logged in' });
    }

    const payload = req.body || {};
    const title = sanitizeText(payload?.title || 'Untitled Workout', 150) || 'Untitled Workout';
    const description = sanitizeText(payload?.description || '', 1000);
    const workoutType = sanitizeText(payload?.workoutType || 'Strength', 50) || 'Strength';
    const estimatedDuration = parseNumber(payload?.estimatedDurationMinutes) || 0;
    const scheduleMode = String(payload?.scheduleMode || 'day').trim() === 'week' ? 'week' : 'day';

    const [result] = await pool.query(
      `INSERT INTO workout_schedules
        (user_id, title, description, workout_type, estimated_duration_minutes, status, visibility, schedule_mode)
       VALUES (?, ?, ?, ?, ?, 'draft', 'private', ?)`,
      [userId, title, description, workoutType, estimatedDuration, scheduleMode]
    );

    const scheduleId = result.insertId;

    const fallbackLabel = scheduleMode === 'week' ? 'Week 1' : 'Any Day';
    const fallbackType = scheduleMode === 'week' ? 'week' : 'any';

    await pool.query(
      `INSERT INTO workout_schedule_groups (workout_schedule_id, label, group_type, sort_order)
       VALUES (?, ?, ?, 1)`,
      [scheduleId, fallbackLabel, fallbackType]
    );

    const planner = await buildPlannerFromSchedule(scheduleId, userId);
    const workoutLists = await loadSchedulesForUser(userId);

    return res.status(201).json({
      message: 'Workout draft created',
      planner,
      workoutLists,
      hasWorkoutLists: workoutLists.length > 0,
      hasSavedWorkoutExerciseList: await hasSavedExercisesForUser(userId),
    });
  } catch (err) {
    console.error('❌ Failed to create workout schedule draft:', err);
    return res.status(500).json({ error: 'Failed to create workout schedule draft' });
  }
});

router.get('/workout-schedules', async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not logged in' });
    }

    const workoutLists = await loadSchedulesForUser(userId);
    return res.json({
      workoutLists,
      hasWorkoutLists: workoutLists.length > 0,
      hasSavedWorkoutExerciseList: await hasSavedExercisesForUser(userId),
    });
  } catch (err) {
    console.error('❌ Failed to list workout schedules:', err);
    return res.status(500).json({ error: 'Failed to list workout schedules' });
  }
});

router.get('/workout-schedules/:id', async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not logged in' });
    }

    const scheduleId = Number(req.params?.id || 0);
    if (!scheduleId) {
      return res.status(400).json({ error: 'Invalid schedule id' });
    }

    const planner = await buildPlannerFromSchedule(scheduleId, userId);
    if (!planner) {
      return res.status(404).json({ error: 'Workout schedule not found' });
    }

    return res.json({ planner });
  } catch (err) {
    console.error('❌ Failed to load workout schedule:', err);
    return res.status(500).json({ error: 'Failed to load workout schedule' });
  }
});

router.patch('/workout-schedules/:id', async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not logged in' });
    }

    const scheduleId = Number(req.params?.id || 0);
    if (!scheduleId) {
      return res.status(400).json({ error: 'Invalid schedule id' });
    }

    const body = req.body || {};
    const title = sanitizeText(body?.title || '', 150);
    const description = sanitizeText(body?.description || '', 1000);
    const workoutType = sanitizeText(body?.workoutType || '', 50);
    const estimatedDuration = parseNumber(body?.estimatedDurationMinutes);
    const status = sanitizeText(body?.status || '', 20);
    const visibility = sanitizeText(body?.visibility || '', 20);
    const scheduleMode = String(body?.scheduleMode || '').trim();

    const [result] = await pool.query(
      `UPDATE workout_schedules
       SET
         title = COALESCE(NULLIF(?, ''), title),
         description = COALESCE(?, description),
         workout_type = COALESCE(NULLIF(?, ''), workout_type),
         estimated_duration_minutes = COALESCE(?, estimated_duration_minutes),
         status = CASE WHEN ? IN ('draft','active','archived') THEN ? ELSE status END,
         visibility = CASE WHEN ? IN ('private','unlisted','public') THEN ? ELSE visibility END,
         schedule_mode = CASE WHEN ? IN ('day','week') THEN ? ELSE schedule_mode END,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [
        title,
        description,
        workoutType,
        estimatedDuration,
        status,
        status,
        visibility,
        visibility,
        scheduleMode,
        scheduleMode,
        scheduleId,
        userId,
      ]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Workout schedule not found' });
    }

    const planner = await buildPlannerFromSchedule(scheduleId, userId);
    return res.json({ message: 'Workout schedule updated', planner });
  } catch (err) {
    console.error('❌ Failed to update workout schedule:', err);
    return res.status(500).json({ error: 'Failed to update workout schedule' });
  }
});

router.put('/workout-schedules/:id/groups', async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not logged in' });
    }

    const scheduleId = Number(req.params?.id || 0);
    if (!scheduleId) {
      return res.status(400).json({ error: 'Invalid schedule id' });
    }

    const scheduleMode = String(req.body?.scheduleMode || 'day').trim() === 'week' ? 'week' : 'day';
    const groups = Array.isArray(req.body?.groups) ? req.body.groups : [];
    const normalizedGroups = groups
      .map((g, index) => ({
        label: sanitizeText(g?.label || '', 120),
        groupType: sanitizeText(g?.groupType || (scheduleMode === 'week' ? 'week' : 'day'), 20),
        sortOrder: parseNumber(g?.sortOrder) || index + 1,
      }))
      .filter((g) => g.label);

    const [ownedRows] = await pool.query(
      'SELECT id FROM workout_schedules WHERE id = ? AND user_id = ? LIMIT 1',
      [scheduleId, userId]
    );
    if (!ownedRows.length) {
      return res.status(404).json({ error: 'Workout schedule not found' });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      await connection.query('DELETE FROM workout_schedule_groups WHERE workout_schedule_id = ?', [scheduleId]);

      const finalGroups = normalizedGroups.length
        ? normalizedGroups
        : [{ label: scheduleMode === 'week' ? 'Week 1' : 'Any Day', groupType: scheduleMode === 'week' ? 'week' : 'any', sortOrder: 1 }];

      for (const group of finalGroups) {
        await connection.query(
          `INSERT INTO workout_schedule_groups (workout_schedule_id, label, group_type, sort_order)
           VALUES (?, ?, ?, ?)`,
          [scheduleId, group.label, group.groupType, group.sortOrder]
        );
      }

      await connection.query(
        `UPDATE workout_schedules SET schedule_mode = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [scheduleMode, scheduleId]
      );

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    const planner = await buildPlannerFromSchedule(scheduleId, userId);
    return res.json({ message: 'Workout schedule groups saved', planner });
  } catch (err) {
    console.error('❌ Failed to save workout schedule groups:', err);
    return res.status(500).json({ error: 'Failed to save workout schedule groups' });
  }
});

router.post('/workout-schedules/:id/exercises', async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not logged in' });
    }

    const scheduleId = Number(req.params?.id || 0);
    if (!scheduleId) {
      return res.status(400).json({ error: 'Invalid schedule id' });
    }

    const [ownedRows] = await pool.query(
      'SELECT id FROM workout_schedules WHERE id = ? AND user_id = ? LIMIT 1',
      [scheduleId, userId]
    );
    if (!ownedRows.length) {
      return res.status(404).json({ error: 'Workout schedule not found' });
    }

    const body = req.body || {};
    const exerciseId = parseNumber(body.exerciseId);
    const groupId = parseNumber(body.workoutScheduleGroupId);

    let fallback = {};
    if (exerciseId) {
      const [exerciseRows] = await pool.query(
        'SELECT ExerciseTitle, ImageURL, WorkoutType, MuscleGroup, Equipment FROM exercises WHERE ExerciseID = ? LIMIT 1',
        [exerciseId]
      );
      fallback = exerciseRows?.[0] || {};
    }

    const [insertResult] = await pool.query(
      `INSERT INTO workout_schedule_exercises
        (
          workout_schedule_id,
          workout_schedule_group_id,
          exercise_id,
          exercise_name,
          exercise_image_url,
          workout_type,
          muscle_group,
          equipment,
          sort_order,
          notes,
          target_sets,
          target_reps,
          target_weight,
          target_duration_minutes,
          target_rest_seconds
        )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        scheduleId,
        groupId || null,
        exerciseId || null,
        sanitizeText(body.name || fallback.ExerciseTitle || '', 150),
        sanitizeText(body.image || fallback.ImageURL || '', 255),
        sanitizeText(body.workoutType || fallback.WorkoutType || '', 50),
        sanitizeText(body.muscleGroup || fallback.MuscleGroup || '', 80),
        sanitizeText(body.equipment || fallback.Equipment || '', 80),
        parseNumber(body.sortOrder) || 9999,
        sanitizeText(body.notes || '', 500),
        parseNumber(body.targetSets),
        parseNumber(body.targetReps),
        parseNumber(body.targetWeight, true),
        parseNumber(body.targetDurationMinutes),
        parseNumber(body.targetRestSeconds),
      ]
    );

    await pool.query('UPDATE workout_schedules SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [scheduleId]);
    const planner = await buildPlannerFromSchedule(scheduleId, userId);
    return res.status(201).json({ message: 'Exercise added to schedule', id: insertResult.insertId, planner });
  } catch (err) {
    console.error('❌ Failed to add schedule exercise:', err);
    return res.status(500).json({ error: 'Failed to add schedule exercise' });
  }
});

router.patch('/workout-schedules/:id/exercises/:scheduleExerciseId', async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not logged in' });
    }

    const scheduleId = Number(req.params?.id || 0);
    const scheduleExerciseId = Number(req.params?.scheduleExerciseId || 0);
    if (!scheduleId || !scheduleExerciseId) {
      return res.status(400).json({ error: 'Invalid schedule or exercise id' });
    }

    const body = req.body || {};
    const [result] = await pool.query(
      `UPDATE workout_schedule_exercises wse
       INNER JOIN workout_schedules ws ON ws.id = wse.workout_schedule_id
       SET
         wse.workout_schedule_group_id = COALESCE(?, wse.workout_schedule_group_id),
         wse.sort_order = COALESCE(?, wse.sort_order),
         wse.notes = COALESCE(?, wse.notes),
         wse.target_sets = COALESCE(?, wse.target_sets),
         wse.target_reps = COALESCE(?, wse.target_reps),
         wse.target_weight = COALESCE(?, wse.target_weight),
         wse.target_duration_minutes = COALESCE(?, wse.target_duration_minutes),
         wse.target_rest_seconds = COALESCE(?, wse.target_rest_seconds),
         wse.updated_at = CURRENT_TIMESTAMP
       WHERE wse.id = ? AND ws.id = ? AND ws.user_id = ?`,
      [
        parseNumber(body.workoutScheduleGroupId),
        parseNumber(body.sortOrder),
        sanitizeText(body.notes || '', 500) || null,
        parseNumber(body.targetSets),
        parseNumber(body.targetReps),
        parseNumber(body.targetWeight, true),
        parseNumber(body.targetDurationMinutes),
        parseNumber(body.targetRestSeconds),
        scheduleExerciseId,
        scheduleId,
        userId,
      ]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Schedule exercise not found' });
    }

    await pool.query('UPDATE workout_schedules SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [scheduleId]);
    const planner = await buildPlannerFromSchedule(scheduleId, userId);
    return res.json({ message: 'Schedule exercise updated', planner });
  } catch (err) {
    console.error('❌ Failed to update schedule exercise:', err);
    return res.status(500).json({ error: 'Failed to update schedule exercise' });
  }
});

router.delete('/workout-schedules/:id/exercises/:scheduleExerciseId', async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not logged in' });
    }

    const scheduleId = Number(req.params?.id || 0);
    const scheduleExerciseId = Number(req.params?.scheduleExerciseId || 0);
    if (!scheduleId || !scheduleExerciseId) {
      return res.status(400).json({ error: 'Invalid schedule or exercise id' });
    }

    const [result] = await pool.query(
      `DELETE wse
       FROM workout_schedule_exercises wse
       INNER JOIN workout_schedules ws ON ws.id = wse.workout_schedule_id
       WHERE wse.id = ? AND ws.id = ? AND ws.user_id = ?`,
      [scheduleExerciseId, scheduleId, userId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Schedule exercise not found' });
    }

    await pool.query('UPDATE workout_schedules SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [scheduleId]);
    const planner = await buildPlannerFromSchedule(scheduleId, userId);
    return res.json({ message: 'Exercise removed from schedule', planner });
  } catch (err) {
    console.error('❌ Failed to remove schedule exercise:', err);
    return res.status(500).json({ error: 'Failed to remove schedule exercise' });
  }
});

router.delete('/workout-schedules/:id', async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not logged in' });
    }

    const scheduleId = Number(req.params?.id || 0);
    if (!scheduleId) {
      return res.status(400).json({ error: 'Invalid schedule id' });
    }

    const [result] = await pool.query(
      'DELETE FROM workout_schedules WHERE id = ? AND user_id = ?',
      [scheduleId, userId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Workout schedule not found' });
    }

    const workoutLists = await loadSchedulesForUser(userId);
    return res.json({
      message: 'Workout schedule deleted',
      workoutLists,
      hasWorkoutLists: workoutLists.length > 0,
      hasSavedWorkoutExerciseList: await hasSavedExercisesForUser(userId),
    });
  } catch (err) {
    console.error('❌ Failed to delete workout schedule:', err);
    return res.status(500).json({ error: 'Failed to delete workout schedule' });
  }
});

// Compatibility endpoint used by existing frontend workflow
router.get('/workout-planner', async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not logged in' });
    }

    const workoutLists = await loadSchedulesForUser(userId);
    const requestedPlanId = Number(req.query?.planId || 0);
    const fallbackPlanId = workoutLists.length ? Number(workoutLists[0].planId) : 0;
    const selectedId = requestedPlanId || fallbackPlanId;
    const planner = selectedId ? await buildPlannerFromSchedule(selectedId, userId) : null;

    return res.json({
      planner: planner || normalizePlannerPayload({}),
      workoutLists,
      hasWorkoutLists: workoutLists.length > 0,
      hasSavedWorkoutExerciseList: await hasSavedExercisesForUser(userId),
    });
  } catch (err) {
    console.error('❌ Failed to load workout planner:', err);
    return res.status(500).json({ error: 'Failed to load workout planner' });
  }
});

// Compatibility endpoint used by existing frontend workflow
router.put('/workout-planner', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not logged in' });
    }

    const incomingPlanner = req.body?.planner;
    if (!incomingPlanner || typeof incomingPlanner !== 'object' || Array.isArray(incomingPlanner)) {
      return res.status(400).json({ error: 'planner object is required' });
    }

    const normalizedPlanner = normalizePlannerPayload(incomingPlanner);
    const planId = Number(normalizedPlanner?.planId || 0);

    await connection.beginTransaction();

    let scheduleId = planId;
    if (scheduleId) {
      const [ownedRows] = await connection.query(
        'SELECT id FROM workout_schedules WHERE id = ? AND user_id = ? LIMIT 1',
        [scheduleId, userId]
      );
      if (!ownedRows.length) {
        await connection.rollback();
        return res.status(404).json({ error: 'Workout plan not found' });
      }

      await connection.query(
        `UPDATE workout_schedules
         SET
           title = ?,
           description = ?,
           workout_type = ?,
           estimated_duration_minutes = ?,
           status = ?,
           schedule_mode = ?,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND user_id = ?`,
        [
          sanitizeText(normalizedPlanner?.metadata?.name || '', 150) || 'Untitled Workout',
          sanitizeText(normalizedPlanner?.metadata?.description || '', 1000),
          sanitizeText(normalizedPlanner?.metadata?.type || 'Strength', 50) || 'Strength',
          parseNumber(normalizedPlanner?.metadata?.estimatedDuration) || 0,
          'active',
          normalizedPlanner?.scheduleMode === 'week' ? 'week' : 'day',
          scheduleId,
          userId,
        ]
      );
    } else {
      const [insertResult] = await connection.query(
        `INSERT INTO workout_schedules
          (user_id, title, description, workout_type, estimated_duration_minutes, status, visibility, schedule_mode)
         VALUES (?, ?, ?, ?, ?, ?, 'private', ?)`,
        [
          userId,
          sanitizeText(normalizedPlanner?.metadata?.name || '', 150) || 'Untitled Workout',
          sanitizeText(normalizedPlanner?.metadata?.description || '', 1000),
          sanitizeText(normalizedPlanner?.metadata?.type || 'Strength', 50) || 'Strength',
          parseNumber(normalizedPlanner?.metadata?.estimatedDuration) || 0,
          'active',
          normalizedPlanner?.scheduleMode === 'week' ? 'week' : 'day',
        ]
      );
      scheduleId = insertResult.insertId;
    }

    await replaceScheduleGroupsAndExercises(connection, scheduleId, normalizedPlanner);
    await connection.commit();

    const planner = await buildPlannerFromSchedule(scheduleId, userId);
    const workoutLists = await loadSchedulesForUser(userId);
    const hasSavedExerciseList = await hasSavedExercisesForUser(userId);

    return res.json({
      message: 'Workout planner saved',
      planner,
      workoutLists,
      hasWorkoutLists: workoutLists.length > 0,
      hasSavedWorkoutExerciseList: hasSavedExerciseList,
    });
  } catch (err) {
    try {
      await connection.rollback();
    } catch (_) {
      // ignore rollback errors
    }
    console.error('❌ Failed to save workout planner:', err);
    return res.status(500).json({ error: 'Failed to save workout planner' });
  } finally {
    connection.release();
  }
});

router.delete('/workout-planner/:planId', async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not logged in' });
    }

    const scheduleId = Number(req.params?.planId || 0);
    if (!scheduleId) {
      return res.status(400).json({ error: 'planId is required' });
    }

    const [result] = await pool.query(
      'DELETE FROM workout_schedules WHERE id = ? AND user_id = ?',
      [scheduleId, userId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Workout plan not found' });
    }

    const workoutLists = await loadSchedulesForUser(userId);
    return res.json({
      message: 'Workout plan deleted',
      workoutLists,
      hasWorkoutLists: workoutLists.length > 0,
      hasSavedWorkoutExerciseList: await hasSavedExercisesForUser(userId),
    });
  } catch (err) {
    console.error('❌ Failed to delete workout planner:', err);
    return res.status(500).json({ error: 'Failed to delete workout planner' });
  }
});

// Lightweight unlock-check endpoint used by sidebar and planner gates
router.get('/has-saved-workout-list', async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not logged in' });
    }

    const workoutLists = await loadSchedulesForUser(userId);
    const hasSavedList = await hasSavedExercisesForUser(userId);

    return res.json({
      hasWorkoutLists: workoutLists.length > 0,
      hasSavedWorkoutExerciseList: hasSavedList,
      workoutLists,
      message: hasSavedList
        ? 'User has a saved workout exercise list.'
        : 'Create and save a workout plan to unlock your exercise list.',
    });
  } catch (err) {
    console.error('❌ Failed to check saved workout list:', err);
    return res.status(500).json({ error: 'Failed to check saved workout list' });
  }
});
 
module.exports = router;