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
  return {
    planId: String(plan?.planId || '').trim(),
    name: String(plan?.metadata?.name || '').trim() || 'Untitled Workout',
    type: String(plan?.metadata?.type || 'Strength').trim() || 'Strength',
    estimatedDuration: Number(plan?.metadata?.estimatedDuration || 0),
    exerciseCount: exercises.length,
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

  const dayGroups = Array.isArray(planner.dayGroups)
    ? planner.dayGroups.map((v) => String(v || '').trim()).filter(Boolean)
    : defaultDayGroups;

  const weekGroups = Array.isArray(planner.weekGroups)
    ? planner.weekGroups.map((v) => String(v || '').trim()).filter(Boolean)
    : defaultWeekGroups;

  const normalizedDayGroups = dayGroups.length > 0 ? dayGroups : defaultDayGroups;
  const normalizedWeekGroups = weekGroups.length > 0 ? weekGroups : defaultWeekGroups;
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
    const profile = {
      firstName: user?.FirstName || '',
      lastName: user?.LastName || '',
      username: user?.username || '',
      email: user?.Email || user?.email || user?.username || '',
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

// Get current user's workout planner payload from profile settings
router.get('/workout-planner', async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not logged in' });
    }

    const [rows] = await pool.query('SELECT settings FROM user_profiles WHERE user_id = ? LIMIT 1', [userId]);
    const settings = readSettingsObject(rows?.[0]?.settings);
    const allPlans = extractWorkoutPlans(settings).map((plan) => normalizePlannerPayload(plan));
    const requestedPlanId = String(req.query?.planId || '').trim();

    let selectedPlan = allPlans.find((plan) => String(plan?.planId || '') === requestedPlanId);
    if (!selectedPlan) {
      selectedPlan = normalizePlannerPayload(settings?.workoutPlanner?.currentPlan || allPlans[0] || {});
    }

    const workoutLists = allPlans
      .filter((plan) => Array.isArray(plan?.exercises) && plan.exercises.length > 0)
      .map(serializeWorkoutListItem)
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

    return res.json({
      planner: selectedPlan,
      workoutLists,
      hasWorkoutLists: workoutLists.length > 0,
      hasSavedWorkoutExerciseList: hasSavedWorkoutExerciseList(settings),
    });
  } catch (err) {
    console.error('❌ Failed to load workout planner:', err);
    return res.status(500).json({ error: 'Failed to load workout planner' });
  }
});

// Save current user's workout planner payload to profile settings
router.put('/workout-planner', async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not logged in' });
    }

    const incomingPlanner = req.body?.planner;
    if (!incomingPlanner || typeof incomingPlanner !== 'object' || Array.isArray(incomingPlanner)) {
      return res.status(400).json({ error: 'planner object is required' });
    }

    const [rows] = await pool.query('SELECT settings FROM user_profiles WHERE user_id = ? LIMIT 1', [userId]);
    const currentSettings = readSettingsObject(rows?.[0]?.settings);
    const normalizedPlanner = normalizePlannerPayload(incomingPlanner);

    const existingPlans = extractWorkoutPlans(currentSettings).map((plan) => normalizePlannerPayload(plan));
    const normalizedName = String(normalizedPlanner?.metadata?.name || '').trim().toLowerCase();

    const byPlanIdIndex = existingPlans.findIndex(
      (plan) => String(plan?.planId || '').trim() === String(normalizedPlanner?.planId || '').trim()
    );

    const byNameIndex = byPlanIdIndex >= 0
      ? -1
      : existingPlans.findIndex((plan) => String(plan?.metadata?.name || '').trim().toLowerCase() === normalizedName && normalizedName);

    if (byPlanIdIndex >= 0) {
      existingPlans[byPlanIdIndex] = normalizedPlanner;
    } else if (byNameIndex >= 0) {
      existingPlans[byNameIndex] = {
        ...normalizedPlanner,
        planId: existingPlans[byNameIndex].planId,
      };
    } else {
      existingPlans.push(normalizedPlanner);
    }

    const workoutLists = existingPlans
      .filter((plan) => Array.isArray(plan?.exercises) && plan.exercises.length > 0)
      .map(serializeWorkoutListItem)
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

    const workoutPlannerState = {
      ...(currentSettings.workoutPlanner || {}),
      currentPlan: normalizedPlanner,
      plans: existingPlans,
    };

    const mergedSettings = {
      ...currentSettings,
      workoutPlanner: workoutPlannerState,
    };

    await pool.query(
      `INSERT INTO user_profiles (user_id, user_role, tier, settings)
       VALUES (?, 'member', 1, ?)
       ON DUPLICATE KEY UPDATE settings = VALUES(settings)`,
      [userId, JSON.stringify(mergedSettings)]
    );

    return res.json({
      message: 'Workout planner saved',
      planner: normalizedPlanner,
      workoutLists,
      hasWorkoutLists: workoutLists.length > 0,
      hasSavedWorkoutExerciseList: normalizedPlanner.exercises.length > 0,
    });
  } catch (err) {
    console.error('❌ Failed to save workout planner:', err);
    return res.status(500).json({ error: 'Failed to save workout planner' });
  }
});

// Lightweight unlock-check endpoint used by sidebar and planner gates
router.get('/has-saved-workout-list', async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not logged in' });
    }

    const [rows] = await pool.query('SELECT settings FROM user_profiles WHERE user_id = ? LIMIT 1', [userId]);
    const settings = readSettingsObject(rows?.[0]?.settings);
    const hasSavedList = hasSavedWorkoutExerciseList(settings);
    const workoutLists = extractWorkoutPlans(settings)
      .map((plan) => normalizePlannerPayload(plan))
      .filter((plan) => Array.isArray(plan?.exercises) && plan.exercises.length > 0)
      .map(serializeWorkoutListItem);

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