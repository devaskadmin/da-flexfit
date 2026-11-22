const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  syncScheduleGroups,
  buildEntryGroupKey,
  normalizeIdentityEntries,
  resolveExerciseGroupId,
  resolveSavedAssignments,
} = require('../utils/workoutPlanGroups');
const {
  extractDayWeekAssignments,
  extractDayWeekAssignmentsById,
  persistDayWeekAssignments,
  remapAssignmentsById,
} = require('../utils/workoutPlanSettings');
const { buildScheduleGroupView, buildDayNameMapForRows } = require('../utils/workoutScheduleGroupView');

// 0.85.313.a8.1 isolated persistence tests. An in-memory stand-in replaces the database; no real DB,
// no migration and no production data are touched. Schedule 5 stands in for protected PlanID #5.
const PROTECTED_PLAN_ID = 5;
const TARGET_PLAN_ID = 81;

const row = (id, scheduleId, label, groupType, sortOrder, displayOrder = null) => ({
  id,
  workout_schedule_id: scheduleId,
  label,
  group_type: groupType,
  sort_order: sortOrder,
  workout_log_display_order: displayOrder,
});

const createFakeDb = (seedRows, { settingsJson = null } = {}) => {
  const state = {
    groups: seedRows.map((entry) => ({ ...entry })),
    nextId: Math.max(100, ...seedRows.map((entry) => entry.id)) + 1,
    settingsJson,
    queries: [],
  };
  const norm = (sql) => sql.replace(/\s+/g, ' ').trim();

  return {
    state,
    async query(sql, params) {
      const s = norm(sql);
      state.queries.push({ sql: s, params });

      if (/^SELECT id, label, group_type, sort_order(, workout_log_display_order)? FROM workout_schedule_groups WHERE workout_schedule_id = \? ORDER BY sort_order ASC, id ASC$/.test(s)) {
        const withOrder = /workout_log_display_order/.test(s);
        return [state.groups
          .filter((entry) => entry.workout_schedule_id === params[0])
          .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
          .map((entry) => (withOrder ? { ...entry } : {
            id: entry.id, label: entry.label, group_type: entry.group_type, sort_order: entry.sort_order,
          }))];
      }
      if (/^DELETE FROM workout_schedule_groups WHERE workout_schedule_id = \? AND id IN \(/.test(s)) {
        const [scheduleId, ...ids] = params;
        state.groups = state.groups.filter((entry) => !(entry.workout_schedule_id === scheduleId && ids.includes(entry.id)));
        return [{ affectedRows: ids.length }];
      }
      if (/^UPDATE workout_schedule_groups SET label = \?, group_type = \?, sort_order = \?(, workout_log_display_order = \?)? WHERE id = \? AND workout_schedule_id = \?$/.test(s)) {
        const withOrder = /workout_log_display_order/.test(s);
        const values = [...params];
        const scheduleId = values.pop();
        const id = values.pop();
        const [label, groupType, sortOrder, displayOrder] = values;
        const target = state.groups.find((entry) => entry.id === id && entry.workout_schedule_id === scheduleId);
        if (!target) return [{ affectedRows: 0 }];
        Object.assign(target, { label, group_type: groupType, sort_order: sortOrder });
        if (withOrder) target.workout_log_display_order = displayOrder;
        return [{ affectedRows: 1 }];
      }
      if (/^INSERT INTO workout_schedule_groups \(workout_schedule_id, label, group_type, sort_order(, workout_log_display_order)?\) VALUES/.test(s)) {
        const [scheduleId, label, groupType, sortOrder, displayOrder = null] = params;
        const id = state.nextId;
        state.nextId += 1;
        state.groups.push(row(id, scheduleId, label, groupType, sortOrder, displayOrder));
        return [{ insertId: id, affectedRows: 1 }];
      }
      if (/^SELECT settings_json FROM workout_schedules WHERE id = \? LIMIT 1 FOR UPDATE$/.test(s)) {
        return [[{ settings_json: state.settingsJson }]];
      }
      if (/^UPDATE workout_schedules SET settings_json = \? WHERE id = \?$/.test(s)) {
        state.settingsJson = params[0];
        return [{ affectedRows: 1 }];
      }
      throw new Error(`Unexpected query: ${s}`);
    },
  };
};

const groupsOf = (db, scheduleId) => db.state.groups
  .filter((entry) => entry.workout_schedule_id === scheduleId)
  .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);

const snapshotProtected = (db) => JSON.stringify(groupsOf(db, PROTECTED_PLAN_ID));

const seed = () => [
  row(7, PROTECTED_PLAN_ID, 'Push Day', 'day', 1),
  row(8, PROTECTED_PLAN_ID, 'Week 1', 'week', 2),
  row(10, TARGET_PLAN_ID, 'Monday', 'day', 1),
  row(11, TARGET_PLAN_ID, 'Wednesday', 'day', 2),
  row(12, TARGET_PLAN_ID, 'Week 1', 'week', 1),
  row(13, TARGET_PLAN_ID, 'Week 2', 'week', 2),
];

// Mirrors what the builder sends: entries (key/id/label/sortOrder), exercises by scheduleGroupKey,
// and assignments keyed by lowercase day key -> week key.
const entriesPlanner = (overrides = {}) => ({
  scheduleMode: 'day',
  dayGroupEntries: [
    { key: 'd1', id: 10, label: 'Monday', sortOrder: 1 },
    { key: 'd2', id: 11, label: 'Wednesday', sortOrder: 2 },
  ],
  weekGroupEntries: [
    { key: 'w1', id: 12, label: 'Week 1', sortOrder: 1 },
    { key: 'w2', id: 13, label: 'Week 2', sortOrder: 2 },
  ],
  groupSetsProvided: { day: true, week: true },
  exercises: [],
  settings: { dayWeekAssignments: { d1: 'w1', d2: 'w2' } },
  ...overrides,
});

// Same sequence replaceScheduleGroupsAndExercises runs (sync, map exercises, resolve assignments).
const savePlanner = async (db, scheduleId, planner) => {
  const { groupIdByKey } = await syncScheduleGroups(db, scheduleId, planner, {
    hasWorkoutLogDisplayOrder: true,
    preserveCustomWorkoutLogOrder: true,
  });
  const exercises = (planner.exercises || []).map((exercise) => ({
    name: exercise.name,
    groupId: resolveExerciseGroupId(planner, planner.scheduleMode === 'week' ? 'week' : 'day', exercise, groupIdByKey, ''),
  }));
  const resolved = resolveSavedAssignments(planner, groupIdByKey);
  await persistDayWeekAssignments(db, scheduleId, planner, { hasSettingsJson: true, ...resolved });
  return { groupIdByKey, exercises, resolved };
};

test('renaming a day or week updates the row in place and keeps its id', async () => {
  const db = createFakeDb(seed());
  const before = snapshotProtected(db);
  const planner = entriesPlanner({
    dayGroupEntries: [
      { key: 'd1', id: 10, label: 'Push Day', sortOrder: 1 },
      { key: 'd2', id: 11, label: 'Wednesday', sortOrder: 2 },
    ],
    weekGroupEntries: [
      { key: 'w1', id: 12, label: 'Foundation', sortOrder: 1 },
      { key: 'w2', id: 13, label: 'Week 2', sortOrder: 2 },
    ],
  });

  const { groupIdByKey } = await savePlanner(db, TARGET_PLAN_ID, planner);

  assert.equal(groupIdByKey.get(buildEntryGroupKey('day', 'd1')), 10);
  assert.equal(groupIdByKey.get(buildEntryGroupKey('week', 'w1')), 12);
  assert.deepEqual(groupsOf(db, TARGET_PLAN_ID).map((g) => [g.id, g.label]), [
    [12, 'Foundation'], [10, 'Push Day'], [13, 'Week 2'], [11, 'Wednesday'],
  ].sort((a, b) => {
    const left = groupsOf(db, TARGET_PLAN_ID).findIndex((g) => g.id === a[0]);
    const right = groupsOf(db, TARGET_PLAN_ID).findIndex((g) => g.id === b[0]);
    return left - right;
  }));
  assert.equal(db.state.queries.some((q) => /^INSERT INTO workout_schedule_groups/.test(q.sql)), false);
  assert.equal(db.state.queries.some((q) => /^DELETE FROM workout_schedule_groups/.test(q.sql)), false);
  assert.equal(snapshotProtected(db), before);
});

test('identical day names in separate weeks stay separate rows with separate exercises', async () => {
  const db = createFakeDb(seed());
  const planner = entriesPlanner({
    dayGroupEntries: [
      { key: 'd1', id: 10, label: 'Monday', sortOrder: 1 },
      { key: 'd2', id: 11, label: 'Wednesday', sortOrder: 2 },
      { key: 'new-1', id: null, label: 'Monday', sortOrder: 3 },
    ],
    exercises: [
      { name: 'Bench', scheduleGroupKey: 'd1', scheduleGroup: 'Monday' },
      { name: 'Squat', scheduleGroupKey: 'new-1', scheduleGroup: 'Monday' },
    ],
    settings: { dayWeekAssignments: { d1: 'w1', d2: 'w1', 'new-1': 'w2' } },
  });

  const { exercises, groupIdByKey, resolved } = await savePlanner(db, TARGET_PLAN_ID, planner);

  const mondays = groupsOf(db, TARGET_PLAN_ID).filter((g) => g.label === 'Monday');
  assert.equal(mondays.length, 2);
  assert.notEqual(mondays[0].id, mondays[1].id);
  assert.equal(mondays[0].id, 10);

  const newMondayId = groupIdByKey.get(buildEntryGroupKey('day', 'new-1'));
  assert.equal(newMondayId, mondays[1].id);
  assert.deepEqual(exercises, [
    { name: 'Bench', groupId: 10 },
    { name: 'Squat', groupId: newMondayId },
  ]);

  // Assignment values are saved per group id, not per name.
  assert.deepEqual(resolved.assignmentsById, { 10: 12, 11: 12, [newMondayId]: 13 });
  assert.deepEqual(extractDayWeekAssignmentsById(db.state.settingsJson), { 10: 12, 11: 12, [newMondayId]: 13 });
  // The label-keyed legacy map only keeps unambiguous labels.
  assert.deepEqual(extractDayWeekAssignments(db.state.settingsJson), { wednesday: 'Week 1' });
});

test('reload exposes unique compatibility names and keeps each day in its own week', async () => {
  const db = createFakeDb(seed());
  const planner = entriesPlanner({
    dayGroupEntries: [
      { key: 'd1', id: 10, label: 'Monday', sortOrder: 1 },
      { key: 'd2', id: 11, label: 'Wednesday', sortOrder: 2 },
      { key: 'new-1', id: null, label: 'Monday', sortOrder: 3 },
    ],
    settings: { dayWeekAssignments: { d1: 'w1', d2: 'w1', 'new-1': 'w2' } },
  });
  await savePlanner(db, TARGET_PLAN_ID, planner);

  const view = buildScheduleGroupView({ groupRows: groupsOf(db, TARGET_PLAN_ID), settingsJson: db.state.settingsJson });
  assert.deepEqual(view.days.map((d) => [d.label, d.name, d.weekLabel]), [
    ['Monday', 'Monday', 'Week 1'],
    ['Wednesday', 'Wednesday', 'Week 1'],
    ['Monday', 'Monday (Week 2)', 'Week 2'],
  ]);
  assert.equal(view.hasDuplicateLabels, true);
  assert.deepEqual(view.assignments, { monday: 'Week 1', wednesday: 'Week 1', 'monday (week 2)': 'Week 2' });
  assert.equal(buildDayNameMapForRows(groupsOf(db, TARGET_PLAN_ID), db.state.settingsJson).size, 3);
});

test('removing an entry deletes only that schedule row and never touches protected PlanID 5', async () => {
  const db = createFakeDb(seed());
  const before = snapshotProtected(db);
  const planner = entriesPlanner({
    dayGroupEntries: [{ key: 'd1', id: 10, label: 'Monday', sortOrder: 1 }],
    settings: { dayWeekAssignments: { d1: 'w1' } },
  });
  await savePlanner(db, TARGET_PLAN_ID, planner);

  assert.deepEqual(groupsOf(db, TARGET_PLAN_ID).filter((g) => g.group_type === 'day').map((g) => g.id), [10]);
  assert.equal(snapshotProtected(db), before);
  db.state.queries
    .filter((q) => /^(INSERT|UPDATE|DELETE)/.test(q.sql) && /workout_schedule_groups/.test(q.sql))
    .forEach((q) => assert.equal(q.params.includes(PROTECTED_PLAN_ID), false));
});

test('an entry id from another schedule or family is never matched; a new row is inserted instead', async () => {
  const db = createFakeDb(seed());
  const before = snapshotProtected(db);
  const planner = entriesPlanner({
    dayGroupEntries: [
      { key: 'd1', id: 7, label: 'Push Day', sortOrder: 1 },
      { key: 'd2', id: 12, label: 'Wednesday', sortOrder: 2 },
    ],
  });
  const { groupIdByKey } = await savePlanner(db, TARGET_PLAN_ID, planner);

  assert.notEqual(groupIdByKey.get(buildEntryGroupKey('day', 'd1')), 7);
  assert.notEqual(groupIdByKey.get(buildEntryGroupKey('day', 'd2')), 12);
  assert.equal(snapshotProtected(db), before);
  // Week 1 (id 12) is still a week row.
  assert.equal(groupsOf(db, TARGET_PLAN_ID).find((g) => g.id === 12).group_type, 'week');
});

test('custom workout log display order survives a rename', async () => {
  const rows = seed();
  rows.find((r) => r.id === 10).workout_log_display_order = 4;
  const db = createFakeDb(rows);
  await savePlanner(db, TARGET_PLAN_ID, entriesPlanner({
    dayGroupEntries: [
      { key: 'd1', id: 10, label: 'Chest', sortOrder: 1 },
      { key: 'd2', id: 11, label: 'Wednesday', sortOrder: 2 },
    ],
  }));
  assert.equal(groupsOf(db, TARGET_PLAN_ID).find((g) => g.id === 10).workout_log_display_order, 4);
});

test('a legacy label-only save is unchanged and drops any stale id map', async () => {
  const stale = JSON.stringify({ keep: 1, dayWeekAssignmentsById: { 10: 13 }, dayWeekAssignments: {} });
  const db = createFakeDb(seed(), { settingsJson: stale });
  const planner = {
    scheduleMode: 'day',
    dayGroups: ['Monday', 'Wednesday'],
    weekGroups: ['Week 1', 'Week 2'],
    dayGroupOrders: [],
    weekGroupOrders: [],
    groupSetsProvided: { day: true, week: true },
    exercises: [{ name: 'Row', scheduleGroup: 'Wednesday' }],
    settings: { dayWeekAssignments: { Monday: 'Week 2' } },
  };
  const { exercises, resolved } = await savePlanner(db, TARGET_PLAN_ID, planner);

  assert.deepEqual(resolved, { assignmentsById: null, legacyAssignments: null });
  assert.deepEqual(exercises, [{ name: 'Row', groupId: 11 }]);
  assert.deepEqual(groupsOf(db, TARGET_PLAN_ID).map((g) => g.id), [10, 12, 11, 13].sort((a, b) => {
    const rows2 = groupsOf(db, TARGET_PLAN_ID).map((g) => g.id);
    return rows2.indexOf(a) - rows2.indexOf(b);
  }));
  const stored = JSON.parse(db.state.settingsJson);
  assert.equal(stored.keep, 1);
  assert.equal('dayWeekAssignmentsById' in stored, false);
  assert.deepEqual(stored.dayWeekAssignments, { monday: 'Week 2' });
});

test('legacy plans without an id map load exactly as before', () => {
  const rows = seed().filter((r) => r.workout_schedule_id === TARGET_PLAN_ID);
  const settings = JSON.stringify({ dayWeekAssignments: { monday: 'Week 2' } });
  const view = buildScheduleGroupView({ groupRows: rows, settingsJson: settings });

  assert.deepEqual(view.days.map((d) => d.name), ['Monday', 'Wednesday']);
  assert.equal(view.hasDuplicateLabels, false);
  assert.deepEqual(view.assignments, { monday: 'Week 2' });
  assert.deepEqual(view.weeks.map((w) => w.name), ['Week 1', 'Week 2']);
});

test('assignment id map is remapped for a copied plan and ignores unknown ids', () => {
  const idMap = new Map([[10, 210], [12, 212], [13, 213]]);
  assert.deepEqual(remapAssignmentsById({ 10: 12, 11: 13, 10000: 12 }, idMap), { 210: 212 });
  assert.deepEqual(remapAssignmentsById(null, idMap), {});
});

test('entry validation rejects duplicate keys, bad labels and oversized lists', () => {
  const options = {
    validateLabel: (raw) => (/^[A-Za-z0-9&'() -]{1,60}$/.test(String(raw ?? '').trim())
      ? { ok: true, value: String(raw).trim() }
      : { ok: false, message: 'Invalid label' }),
    createError: (message) => Object.assign(new Error(message), { status: 400 }),
  };
  assert.throws(() => normalizeIdentityEntries([{ key: 'a', label: 'Monday' }, { key: 'A', label: 'Monday' }], 'day', options), /unique/);
  assert.throws(() => normalizeIdentityEntries([{ key: 'a', label: 'Mon<script>' }], 'day', options), /Invalid label/);
  assert.throws(() => normalizeIdentityEntries(Array.from({ length: 201 }, (_, i) => ({ key: `k${i}`, label: 'Day' })), 'day', options), /Too many/);
  assert.deepEqual(normalizeIdentityEntries([{ key: 'b', id: '11', label: ' Monday ', sortOrder: 2 }, { key: 'a', id: 'x', label: 'Monday', sortOrder: 1 }], 'day', options), [
    { key: 'a', id: null, label: 'Monday', sortOrder: 1 },
    { key: 'b', id: 11, label: 'Monday', sortOrder: 2 },
  ]);
  assert.deepEqual(normalizeIdentityEntries(undefined, 'day', options), []);
});

test('users.js, auth.js and workout-log.js carry the identity wiring and keep all 37 routes in order', () => {
  const read = (relative) => fs.readFileSync(path.join(__dirname, relative), 'utf8');
  const users = read('../api/users.js');
  const auth = read('../api/auth.js');
  const log = read('../api/workout-log.js');

  const routes = (users.match(/\brouter\.(get|post|put|patch|delete)\s*\(\s*'[^']+'/g) || []);
  assert.equal(routes.length, 37);
  assert.equal(routes.length, new Set(routes).size);

  assert.match(users, /normalizeIdentityEntries\(planner\.dayGroupEntries, 'day'/);
  assert.match(users, /normalizeIdentityEntries\(planner\.weekGroupEntries, 'week'/);
  assert.match(users, /buildScheduleGroupView\(\{/);
  assert.equal(users.split('persistDayWeekAssignments(connection').length - 1, 5);
  assert.match(auth, /remapAssignmentsById\(/);
  assert.match(auth, /extractDayWeekAssignmentsById\(/);
  assert.match(log, /withDayDisplayLabels/);

  // No schema change in the a8.1 utilities (users.js / auth.js keep only their pre-existing optional-column checks).
  [read('../utils/workoutPlanGroups.js'), read('../utils/workoutPlanSettings.js'), read('../utils/workoutScheduleGroupView.js')]
    .forEach((source) => assert.equal(/CREATE TABLE|ALTER TABLE|DROP TABLE|ADD COLUMN|CREATE INDEX|DROP INDEX/i.test(source.replace(/\/\/[^\n]*/g, '')), false));
  assert.equal(/ADD COLUMN settings_json|ALTER TABLE[^`]*settings_json/i.test(users), false);
  // PlanID 5 is never hard-coded.
  assert.equal(/workout_schedule_id\s*=\s*5\b|scheduleId\s*===?\s*5\b/.test(users), false);
});
