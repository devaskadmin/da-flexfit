const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  extractDayWeekAssignments,
  persistDayWeekAssignments,
} = require('../utils/workoutPlanSettings');

// 0.85.313.a3.4: global save, clone and adoption keep day-to-week assignments.
// Isolated fixtures only: an in-memory stand-in for the workout_schedules table. No real database.
const PROTECTED_PLAN_ID = 5;

const createFakeSchedulesDb = (rows) => {
  const state = {
    rows: new Map(Object.entries(rows).map(([id, settingsJson]) => [Number(id), settingsJson])),
    queries: [],
    updatedIds: [],
  };
  return {
    state,
    async query(sql, params) {
      state.queries.push({ sql, params });
      if (/^SELECT settings_json FROM workout_schedules WHERE id = \?/i.test(sql)) {
        const id = Number(params[0]);
        return [state.rows.has(id) ? [{ settings_json: state.rows.get(id) }] : []];
      }
      if (/^UPDATE workout_schedules SET settings_json = \? WHERE id = \?/i.test(sql)) {
        const id = Number(params[1]);
        state.rows.set(id, params[0]);
        state.updatedIds.push(id);
        return [{ affectedRows: 1 }];
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
};

const SOURCE_SETTINGS = JSON.stringify({
  theme: 'dark',
  dayWeekAssignments: { monday: 'Week 1', wednesday: 'Week 2', friday: 'Week 2' },
});

// Mirrors what the clone/adopt routes do: read the source planner (buildPlannerFromSchedule exposes
// settings.dayWeekAssignments), build the clone planner, then persist onto the new schedule id.
const cloneAssignments = async (db, sourceId, cloneId, { hasSettingsJson = true } = {}) => {
  const sourcePlanner = {
    scheduleMode: 'week',
    weekGroups: ['Week 1', 'Week 2'],
    dayGroups: ['Monday', 'Wednesday', 'Friday'],
    settings: { dayWeekAssignments: extractDayWeekAssignments(db.state.rows.get(sourceId)) },
  };
  const plannerForClone = { ...sourcePlanner, planId: String(cloneId) };
  return persistDayWeekAssignments(db, cloneId, plannerForClone, { hasSettingsJson });
};

test('adopting a global plan copies assignments to the new copy and leaves the source unchanged', async () => {
  const db = createFakeSchedulesDb({ 40: SOURCE_SETTINGS, 41: null, [PROTECTED_PLAN_ID]: '{"protected":true}' });

  const result = await cloneAssignments(db, 40, 41);
  assert.deepEqual(result, { persisted: true, reason: '' });

  assert.deepEqual(extractDayWeekAssignments(db.state.rows.get(41)), {
    monday: 'Week 1',
    wednesday: 'Week 2',
    friday: 'Week 2',
  });
  assert.equal(db.state.rows.get(40), SOURCE_SETTINGS);
  assert.equal(db.state.rows.get(PROTECTED_PLAN_ID), '{"protected":true}');
  assert.deepEqual(db.state.updatedIds, [41]);
});

test('cloning a featured plan keeps week names as assignment values and does not copy other source settings', async () => {
  const db = createFakeSchedulesDb({ 50: SOURCE_SETTINGS, 51: null });
  await cloneAssignments(db, 50, 51);

  const stored = JSON.parse(db.state.rows.get(51));
  assert.deepEqual(Object.keys(stored), ['dayWeekAssignments']);
  assert.deepEqual(new Set(Object.values(stored.dayWeekAssignments)), new Set(['Week 1', 'Week 2']));
});

test('a clone keeps unrelated settings already stored on the destination', async () => {
  const db = createFakeSchedulesDb({ 60: SOURCE_SETTINGS, 61: JSON.stringify({ keep: { me: 1 } }) });
  await cloneAssignments(db, 60, 61);

  const stored = JSON.parse(db.state.rows.get(61));
  assert.deepEqual(stored.keep, { me: 1 });
  assert.equal(stored.dayWeekAssignments.wednesday, 'Week 2');
});

test('a source without assignments yields an empty assignment object on the clone', async () => {
  const db = createFakeSchedulesDb({ 70: null, 71: null });
  await cloneAssignments(db, 70, 71);
  assert.deepEqual(extractDayWeekAssignments(db.state.rows.get(71)), {});
});

test('global create/edit save (admin schedule PATCH) persists edited assignments and replaces stale ones', async () => {
  const db = createFakeSchedulesDb({ 80: JSON.stringify({ dayWeekAssignments: { monday: 'Week 1' }, other: 1 }) });
  const normalizedPlanner = { settings: { dayWeekAssignments: { Tuesday: 'Week 3', monday: 'Week 2' } } };

  await persistDayWeekAssignments(db, 80, normalizedPlanner, { hasSettingsJson: true });

  const stored = JSON.parse(db.state.rows.get(80));
  assert.deepEqual(stored.dayWeekAssignments, { tuesday: 'Week 3', monday: 'Week 2' });
  assert.equal(stored.other, 1);
});

test('no write happens when settings_json is unavailable in the target database', async () => {
  const db = createFakeSchedulesDb({ 90: SOURCE_SETTINGS, 91: null });
  const result = await cloneAssignments(db, 90, 91, { hasSettingsJson: false });
  assert.equal(result.persisted, false);
  assert.equal(db.state.queries.length, 0);
  assert.equal(db.state.rows.get(91), null);
});

test('assignment persistence only issues statements scoped to the destination schedule and never DDL', async () => {
  const db = createFakeSchedulesDb({ 100: SOURCE_SETTINGS, 101: null, [PROTECTED_PLAN_ID]: '{"protected":true}' });
  await cloneAssignments(db, 100, 101);

  db.state.queries
    .filter((entry) => /^(SELECT settings_json|UPDATE)/i.test(entry.sql) && /FOR UPDATE|^UPDATE/i.test(entry.sql))
    .forEach((entry) => {
      assert.equal(entry.params.includes(101), true);
      assert.equal(entry.params.includes(PROTECTED_PLAN_ID), false);
    });
  db.state.queries.forEach((entry) => {
    assert.equal(/\b(ALTER|DROP|CREATE|TRUNCATE)\b/i.test(entry.sql), false);
  });
});

test('assignments referencing weeks beyond the copied weeks are stored verbatim, not rewritten', async () => {
  const db = createFakeSchedulesDb({ 110: JSON.stringify({ dayWeekAssignments: { monday: 'Deload' } }), 111: null });
  await cloneAssignments(db, 110, 111);
  assert.deepEqual(extractDayWeekAssignments(db.state.rows.get(111)), { monday: 'Deload' });
});

const readSource = (relative) => fs.readFileSync(path.join(__dirname, relative), 'utf8');

test('users.js persists assignments after the group/exercise replace in every global, clone and adopt path', () => {
  const usersSource = readSource('../api/users.js');

  // 0.85.313.a8.1: each replace now returns the resolved group-id assignments, spread into the persist options.
  const globalSave = /const (\w+) = await replaceScheduleGroupsAndExercises\(connection, scheduleId, normalizedPlanner\);\s*(?:\/\/[^\n]*\n\s*)?await persistDayWeekAssignments\(connection, scheduleId, normalizedPlanner, \{\s*hasSettingsJson: schemaState\.hasSettingsJson,\s*\.\.\.\1,\s*\}\);\s*await connection\.commit\(\);/g;
  // PUT /workout-planner (a3) and PATCH /admin/global-workout-plans/:id/schedule (a3.4).
  assert.equal((usersSource.match(globalSave) || []).length, 2);

  const cloneAdopt = /const (\w+) = await replaceScheduleGroupsAndExercises\(connection, clonedScheduleId, plannerForClone\);\s*(?:\/\/[^\n]*\n\s*)?await persistDayWeekAssignments\(connection, clonedScheduleId, plannerForClone, \{\s*hasSettingsJson: schemaState\.hasSettingsJson,\s*\.\.\.\1,\s*\}\);\s*await cloneWorkoutPlanCoverToPlan/g;
  // POST /global-workout-plans/:id/use and POST /featured-workout-plans/:id/clone.
  assert.equal((usersSource.match(cloneAdopt) || []).length, 2);

  const conversion = /const convertedPlannerForSave = \{\s*\.\.\.convertedPlannerPayload,\s*planId: String\(convertedPlanId\),\s*settings: sourcePlanner\.settings,\s*\};\s*const (\w+) = await replaceScheduleGroupsAndExercises\(connection, convertedPlanId, convertedPlannerForSave\);\s*await persistDayWeekAssignments\(connection, convertedPlanId, convertedPlannerForSave, \{\s*hasSettingsJson: schemaState\.hasSettingsJson,\s*\.\.\.\1,\s*\}\);/;
  assert.match(usersSource, conversion);

  assert.equal(usersSource.split('persistDayWeekAssignments(connection').length - 1, 5);
});

test('users.js keeps all 37 routes and adds no schema change for assignment persistence', () => {
  const usersSource = readSource('../api/users.js');
  assert.equal((usersSource.match(/\brouter\.(get|post|put|patch|delete)\s*\(/g) || []).length, 37);
  assert.equal(/ADD COLUMN settings_json|ALTER TABLE[^`]*settings_json/i.test(usersSource), false);
});

test('auth.js register-time featured plan copy carries assignments only when settings_json exists', () => {
  const authSource = readSource('../api/auth.js');
  assert.match(authSource, /require\('\.\.\/utils\/workoutPlanSettings'\)/);
  assert.match(authSource, /'schedule_mode', 'settings_json'/);
  assert.match(authSource, /hasSettingsJson: hasColumn\('workout_schedules', 'settings_json'\)/);
  assert.match(authSource, /if \(schemaState\.hasSettingsJson\) \{\s*const \[sourceSettingsRows\] = await connection\.query\(\s*'SELECT settings_json FROM workout_schedules WHERE id = \? LIMIT 1',\s*\[featuredPlanId\]/);
  assert.match(authSource, /dayWeekAssignments: extractDayWeekAssignments\(sourceSettingsRows\?\.\[0\]\?\.settings_json\)/);
  assert.equal(/ADD COLUMN settings_json|ALTER TABLE[^`]*settings_json/i.test(authSource), false);
});
