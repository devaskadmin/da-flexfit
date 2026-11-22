const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  planGroupSync,
  syncScheduleGroups,
  buildGroupKey,
  familyOfGroupType,
} = require('../utils/workoutPlanGroups');

// Isolated fixture: an in-memory stand-in for workout_schedule_groups. No real database is used.
// It also holds rows for a second schedule (id 5, standing in for protected PlanID #5) that must never change.
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

const createFakeDb = (seedRows) => {
  const state = {
    groups: seedRows.map((entry) => ({ ...entry })),
    nextId: Math.max(100, ...seedRows.map((entry) => entry.id)) + 1,
    queries: [],
  };
  const norm = (sql) => sql.replace(/\s+/g, ' ').trim();

  return {
    state,
    async query(sql, params) {
      state.queries.push({ sql: norm(sql), params });
      const s = norm(sql);

      if (/^SELECT id, label, group_type, sort_order(, workout_log_display_order)? FROM workout_schedule_groups WHERE workout_schedule_id = \? ORDER BY sort_order ASC, id ASC$/.test(s)) {
        const withOrder = /workout_log_display_order/.test(s);
        const rows = state.groups
          .filter((entry) => entry.workout_schedule_id === params[0])
          .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
          .map((entry) => (withOrder ? { ...entry } : {
            id: entry.id,
            label: entry.label,
            group_type: entry.group_type,
            sort_order: entry.sort_order,
          }));
        return [rows];
      }

      if (/^DELETE FROM workout_schedule_groups WHERE workout_schedule_id = \? AND id IN \(/.test(s)) {
        const [scheduleId, ...ids] = params;
        const before = state.groups.length;
        state.groups = state.groups.filter((entry) => !(entry.workout_schedule_id === scheduleId && ids.includes(entry.id)));
        return [{ affectedRows: before - state.groups.length }];
      }

      if (/^UPDATE workout_schedule_groups SET label = \?, group_type = \?, sort_order = \?, workout_log_display_order = \? WHERE id = \? AND workout_schedule_id = \?$/.test(s)) {
        const [label, groupType, sortOrder, displayOrder, id, scheduleId] = params;
        const target = state.groups.find((entry) => entry.id === id && entry.workout_schedule_id === scheduleId);
        if (!target) {
          return [{ affectedRows: 0 }];
        }
        Object.assign(target, { label, group_type: groupType, sort_order: sortOrder, workout_log_display_order: displayOrder });
        return [{ affectedRows: 1 }];
      }

      if (/^UPDATE workout_schedule_groups SET label = \?, group_type = \?, sort_order = \? WHERE id = \? AND workout_schedule_id = \?$/.test(s)) {
        const [label, groupType, sortOrder, id, scheduleId] = params;
        const target = state.groups.find((entry) => entry.id === id && entry.workout_schedule_id === scheduleId);
        if (!target) {
          return [{ affectedRows: 0 }];
        }
        Object.assign(target, { label, group_type: groupType, sort_order: sortOrder });
        return [{ affectedRows: 1 }];
      }

      if (/^INSERT INTO workout_schedule_groups \(workout_schedule_id, label, group_type, sort_order(, workout_log_display_order)?\) VALUES/.test(s)) {
        const [scheduleId, label, groupType, sortOrder, displayOrder = null] = params;
        const id = state.nextId;
        state.nextId += 1;
        state.groups.push(row(id, scheduleId, label, groupType, sortOrder, displayOrder));
        return [{ insertId: id, affectedRows: 1 }];
      }

      throw new Error(`Unexpected query: ${s}`);
    },
  };
};

const groupsOf = (db, scheduleId) => db.state.groups
  .filter((entry) => entry.workout_schedule_id === scheduleId)
  .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);

// Mirrors the filter buildPlannerFromSchedule applies when loading (asserted against users.js below).
const loadGroups = (db, scheduleId) => {
  const rows = groupsOf(db, scheduleId);
  const isDay = (g) => ['day', 'any', 'section'].includes(String(g.group_type).toLowerCase());
  const isWeek = (g) => String(g.group_type).toLowerCase() === 'week';
  return {
    dayGroups: rows.filter(isDay).map((g) => g.label),
    weekGroups: rows.filter(isWeek).map((g) => g.label),
  };
};

const baseSeed = () => [
  row(7, PROTECTED_PLAN_ID, 'Push Day', 'day', 1),
  row(8, PROTECTED_PLAN_ID, 'Week 1', 'week', 2),
  row(10, TARGET_PLAN_ID, 'Monday', 'day', 1),
  row(11, TARGET_PLAN_ID, 'Wednesday', 'day', 2),
  row(12, TARGET_PLAN_ID, 'Week 1', 'week', 1),
  row(13, TARGET_PLAN_ID, 'Week 2', 'week', 2),
];

const planner = (overrides = {}) => ({
  scheduleMode: 'day',
  dayGroups: ['Monday', 'Wednesday'],
  weekGroups: ['Week 1', 'Week 2'],
  dayGroupOrders: [{ label: 'Monday', sortOrder: 1 }, { label: 'Wednesday', sortOrder: 2 }],
  weekGroupOrders: [{ label: 'Week 1', sortOrder: 1 }, { label: 'Week 2', sortOrder: 2 }],
  groupSetsProvided: { day: true, week: true },
  ...overrides,
});

const snapshotProtected = (db) => JSON.stringify(groupsOf(db, PROTECTED_PLAN_ID));

test('familyOfGroupType and buildGroupKey keep day and week sets apart', () => {
  assert.equal(familyOfGroupType('week'), 'week');
  assert.equal(familyOfGroupType('WEEK'), 'week');
  ['day', 'any', 'section', '', null, undefined].forEach((type) => assert.equal(familyOfGroupType(type), 'day'));
  assert.notEqual(buildGroupKey('day', 'Week 1'), buildGroupKey('week', 'Week 1'));
  assert.equal(buildGroupKey('week', ' Week 1 '), buildGroupKey('week', 'week 1'));
});

test('day mode save keeps the week groups; week mode save keeps the day groups', async () => {
  const dayDb = createFakeDb(baseSeed());
  await syncScheduleGroups(dayDb, TARGET_PLAN_ID, planner({ scheduleMode: 'day' }), { hasWorkoutLogDisplayOrder: true });
  assert.deepEqual(loadGroups(dayDb, TARGET_PLAN_ID), { dayGroups: ['Monday', 'Wednesday'], weekGroups: ['Week 1', 'Week 2'] });

  const weekDb = createFakeDb(baseSeed());
  await syncScheduleGroups(weekDb, TARGET_PLAN_ID, planner({ scheduleMode: 'week' }), { hasWorkoutLogDisplayOrder: true });
  assert.deepEqual(loadGroups(weekDb, TARGET_PLAN_ID), { dayGroups: ['Monday', 'Wednesday'], weekGroups: ['Week 1', 'Week 2'] });
});

test('saving a brand new plan in either mode writes both sets', async () => {
  for (const scheduleMode of ['day', 'week']) {
    const db = createFakeDb([]);
    await syncScheduleGroups(db, 90, planner({ scheduleMode }), { hasWorkoutLogDisplayOrder: true });
    assert.deepEqual(loadGroups(db, 90), { dayGroups: ['Monday', 'Wednesday'], weekGroups: ['Week 1', 'Week 2'] });
  }
});

test('re-saving an unchanged plan keeps every group id and creates no duplicates', async () => {
  const db = createFakeDb(baseSeed());
  const idsBefore = groupsOf(db, TARGET_PLAN_ID).map((g) => g.id);

  for (let i = 0; i < 3; i += 1) {
    await syncScheduleGroups(db, TARGET_PLAN_ID, planner(), { hasWorkoutLogDisplayOrder: true });
  }

  assert.deepEqual(groupsOf(db, TARGET_PLAN_ID).map((g) => g.id), idsBefore);
  assert.equal(groupsOf(db, TARGET_PLAN_ID).length, 4);
  assert.equal(db.state.queries.some((q) => /^INSERT/.test(q.sql)), false);
  assert.equal(db.state.queries.some((q) => /^DELETE/.test(q.sql)), false);
});

test('reordering updates sort_order in place without changing ids', async () => {
  const db = createFakeDb(baseSeed());
  await syncScheduleGroups(db, TARGET_PLAN_ID, planner({
    dayGroupOrders: [{ label: 'Wednesday', sortOrder: 1 }, { label: 'Monday', sortOrder: 2 }],
  }), { hasWorkoutLogDisplayOrder: true });

  const days = groupsOf(db, TARGET_PLAN_ID).filter((g) => g.group_type === 'day');
  assert.deepEqual(days.map((g) => [g.id, g.label, g.sort_order]), [[11, 'Wednesday', 1], [10, 'Monday', 2]]);
});

test('removing a group deletes only that group and never touches the other set', async () => {
  const db = createFakeDb(baseSeed());
  await syncScheduleGroups(db, TARGET_PLAN_ID, planner({ dayGroups: ['Monday'], dayGroupOrders: [{ label: 'Monday', sortOrder: 1 }] }), {
    hasWorkoutLogDisplayOrder: true,
  });

  assert.deepEqual(loadGroups(db, TARGET_PLAN_ID), { dayGroups: ['Monday'], weekGroups: ['Week 1', 'Week 2'] });
  assert.deepEqual(groupsOf(db, TARGET_PLAN_ID).map((g) => g.id).sort((a, b) => a - b), [10, 12, 13]);
});

test('adding a group in the inactive set inserts it and keeps existing ids', async () => {
  const db = createFakeDb(baseSeed());
  await syncScheduleGroups(db, TARGET_PLAN_ID, planner({
    scheduleMode: 'day',
    weekGroups: ['Week 1', 'Week 2', 'Week 3'],
    weekGroupOrders: [{ label: 'Week 1', sortOrder: 1 }, { label: 'Week 2', sortOrder: 2 }, { label: 'Week 3', sortOrder: 3 }],
  }), { hasWorkoutLogDisplayOrder: true });

  const weeks = groupsOf(db, TARGET_PLAN_ID).filter((g) => g.group_type === 'week');
  assert.deepEqual(weeks.map((g) => g.label), ['Week 1', 'Week 2', 'Week 3']);
  assert.deepEqual(weeks.slice(0, 2).map((g) => g.id), [12, 13]);
});

test('a day and a week sharing a label stay separate and exercises resolve to the active set', async () => {
  const db = createFakeDb([]);
  const result = await syncScheduleGroups(db, 90, planner({
    scheduleMode: 'week',
    dayGroups: ['Week 1', 'Friday'],
    dayGroupOrders: [],
    weekGroups: ['Week 1', 'Week 2'],
    weekGroupOrders: [],
  }), { hasWorkoutLogDisplayOrder: true });

  assert.equal(groupsOf(db, 90).length, 4);
  const dayWeek1 = result.groupIdByKey.get(buildGroupKey('day', 'Week 1'));
  const weekWeek1 = result.groupIdByKey.get(buildGroupKey('week', 'Week 1'));
  assert.notEqual(dayWeek1, weekWeek1);
  assert.equal(db.state.groups.find((g) => g.id === weekWeek1).group_type, 'week');
  assert.equal(db.state.groups.find((g) => g.id === dayWeek1).group_type, 'day');
});

test('a set the client did not send is left untouched', async () => {
  const db = createFakeDb(baseSeed());
  const weeksBefore = JSON.stringify(groupsOf(db, TARGET_PLAN_ID).filter((g) => g.group_type === 'week'));

  await syncScheduleGroups(db, TARGET_PLAN_ID, {
    scheduleMode: 'day',
    dayGroups: ['Monday', 'Wednesday', 'Friday'],
    weekGroups: ['Week 1'],
    groupSetsProvided: { day: true, week: false },
  }, { hasWorkoutLogDisplayOrder: true });

  assert.equal(JSON.stringify(groupsOf(db, TARGET_PLAN_ID).filter((g) => g.group_type === 'week')), weeksBefore);
  assert.deepEqual(loadGroups(db, TARGET_PLAN_ID).dayGroups, ['Monday', 'Wednesday', 'Friday']);
});

test('an untouched placeholder in the inactive set is not written for a plan that never used it', async () => {
  const dayOnly = createFakeDb([]);
  await syncScheduleGroups(dayOnly, 90, {
    scheduleMode: 'day',
    dayGroups: ['Monday'],
    weekGroups: ['Week 1'],
    groupSetsProvided: { day: true, week: true },
  }, { hasWorkoutLogDisplayOrder: true });
  assert.deepEqual(loadGroups(dayOnly, 90), { dayGroups: ['Monday'], weekGroups: [] });

  const weekOnly = createFakeDb([]);
  await syncScheduleGroups(weekOnly, 91, {
    scheduleMode: 'week',
    dayGroups: ['Any Day'],
    weekGroups: ['Week 1', 'Week 2'],
    groupSetsProvided: { day: true, week: true },
  }, { hasWorkoutLogDisplayOrder: true });
  assert.deepEqual(loadGroups(weekOnly, 91), { dayGroups: [], weekGroups: ['Week 1', 'Week 2'] });
});

test('an existing inactive set is kept in sync even when it is only the placeholder', async () => {
  const db = createFakeDb([row(20, 90, 'Week 1', 'week', 1), row(21, 90, 'Monday', 'day', 1)]);
  await syncScheduleGroups(db, 90, {
    scheduleMode: 'day',
    dayGroups: ['Monday'],
    weekGroups: ['Week 1'],
    groupSetsProvided: { day: true, week: true },
  }, { hasWorkoutLogDisplayOrder: true });
  assert.deepEqual(groupsOf(db, 90).map((g) => g.id).sort((a, b) => a - b), [20, 21]);
});

test('case-insensitive duplicate labels are saved once', async () => {
  const db = createFakeDb([]);
  await syncScheduleGroups(db, 90, planner({
    dayGroups: ['Monday', 'monday', ' MONDAY ', 'Tuesday'],
    dayGroupOrders: [],
    weekGroups: ['Week 1', 'week 1', 'Week 2'],
    weekGroupOrders: [],
  }), { hasWorkoutLogDisplayOrder: true });
  assert.deepEqual(loadGroups(db, 90), { dayGroups: ['Monday', 'Tuesday'], weekGroups: ['Week 1', 'Week 2'] });
});

test('legacy duplicate rows are collapsed to one and the first id is kept', async () => {
  const db = createFakeDb([row(30, 90, 'Monday', 'day', 1), row(31, 90, 'monday', 'day', 2)]);
  await syncScheduleGroups(db, 90, planner({ dayGroups: ['Monday'], dayGroupOrders: [], weekGroups: [] }), { hasWorkoutLogDisplayOrder: true });
  assert.deepEqual(groupsOf(db, 90).map((g) => g.id), [30]);
});

test('the active group_type is any/day for day labels and week for week labels', async () => {
  const db = createFakeDb([]);
  await syncScheduleGroups(db, 90, planner({
    dayGroups: ['Any Day', 'Monday'],
    dayGroupOrders: [],
    weekGroups: ['Week 1', 'Week 2'],
    weekGroupOrders: [],
  }), { hasWorkoutLogDisplayOrder: true });
  assert.deepEqual(groupsOf(db, 90).map((g) => [g.label, g.group_type]), [
    ['Any Day', 'any'],
    ['Week 1', 'week'],
    ['Monday', 'day'],
    ['Week 2', 'week'],
  ]);
});

test('custom workout-log order survives in place only while the custom order flag is on', async () => {
  const seed = [row(40, 90, 'Monday', 'day', 1, 2), row(41, 90, 'Tuesday', 'day', 2, 1), row(42, 90, 'Week 1', 'week', 1, 3)];
  const p = planner({ dayGroups: ['Monday', 'Tuesday'], dayGroupOrders: [], weekGroups: ['Week 1'], weekGroupOrders: [] });

  const kept = createFakeDb(seed);
  await syncScheduleGroups(kept, 90, p, { hasWorkoutLogDisplayOrder: true, preserveCustomWorkoutLogOrder: true });
  assert.deepEqual(
    Object.fromEntries(kept.state.groups.map((g) => [g.id, g.workout_log_display_order])),
    { 40: 2, 41: 1, 42: 3 }
  );

  const cleared = createFakeDb(seed);
  await syncScheduleGroups(cleared, 90, p, { hasWorkoutLogDisplayOrder: true, preserveCustomWorkoutLogOrder: false });
  assert.deepEqual(groupsOf(cleared, 90).map((g) => g.workout_log_display_order), [null, null, null]);
  assert.deepEqual(groupsOf(cleared, 90).map((g) => g.id).sort((a, b) => a - b), [40, 41, 42]);
});

test('schemas without workout_log_display_order use the narrower statements', async () => {
  const db = createFakeDb([row(50, 90, 'Monday', 'day', 1)]);
  await syncScheduleGroups(db, 90, planner({ dayGroups: ['Monday', 'Tuesday'], dayGroupOrders: [], weekGroups: ['Week 1', 'Week 2'], weekGroupOrders: [] }), {
    hasWorkoutLogDisplayOrder: false,
  });
  assert.equal(db.state.queries.some((q) => /workout_log_display_order/.test(q.sql)), false);
  assert.deepEqual(loadGroups(db, 90), { dayGroups: ['Monday', 'Tuesday'], weekGroups: ['Week 1', 'Week 2'] });
});

test('switching modes and saving each time never loses either set (day -> week -> day)', async () => {
  const db = createFakeDb(baseSeed());
  await syncScheduleGroups(db, TARGET_PLAN_ID, planner({ scheduleMode: 'week' }), { hasWorkoutLogDisplayOrder: true });
  await syncScheduleGroups(db, TARGET_PLAN_ID, planner({ scheduleMode: 'day' }), { hasWorkoutLogDisplayOrder: true });
  assert.deepEqual(loadGroups(db, TARGET_PLAN_ID), { dayGroups: ['Monday', 'Wednesday'], weekGroups: ['Week 1', 'Week 2'] });
  assert.deepEqual(groupsOf(db, TARGET_PLAN_ID).map((g) => g.id).sort((a, b) => a - b), [10, 11, 12, 13]);
});

test('week names referenced by day-to-week assignments still exist after a day mode save', async () => {
  const db = createFakeDb(baseSeed());
  const assignments = { monday: 'Week 2', wednesday: 'Week 1' };
  await syncScheduleGroups(db, TARGET_PLAN_ID, planner({ scheduleMode: 'day' }), { hasWorkoutLogDisplayOrder: true });
  const weeks = loadGroups(db, TARGET_PLAN_ID).weekGroups.map((label) => label.toLowerCase());
  Object.values(assignments).forEach((week) => assert.equal(weeks.includes(week.toLowerCase()), true));
});

test('statements stay scoped to the supplied schedule and protected PlanID 5 is never changed', async () => {
  const db = createFakeDb(baseSeed());
  const before = snapshotProtected(db);

  await syncScheduleGroups(db, TARGET_PLAN_ID, planner({ scheduleMode: 'week', dayGroups: ['Monday'], dayGroupOrders: [] }), {
    hasWorkoutLogDisplayOrder: true,
  });

  assert.equal(snapshotProtected(db), before);
  db.state.queries.forEach((entry) => {
    assert.match(entry.sql, /workout_schedule_id/);
    assert.equal(entry.params.includes(TARGET_PLAN_ID), true);
    assert.equal(entry.params.includes(PROTECTED_PLAN_ID), false);
    assert.equal(/\bALTER\b|\bDROP\b|\bTRUNCATE\b|\bCREATE\b/i.test(entry.sql), false);
  });
});

test('planGroupSync does no I/O and reports what it would change', () => {
  const plan = planGroupSync(
    planner({ dayGroups: ['Monday', 'Friday'], dayGroupOrders: [], weekGroups: ['Week 1'], weekGroupOrders: [] }),
    [row(10, 81, 'Monday', 'day', 1), row(11, 81, 'Wednesday', 'day', 2), row(12, 81, 'Week 1', 'week', 1)]
  );
  assert.deepEqual(plan.updates.map((u) => u.id).sort((a, b) => a - b), [10, 12]);
  assert.deepEqual(plan.inserts.map((i) => i.label), ['Friday']);
  assert.deepEqual(plan.deleteIds, [11]);
});

test('users.js saves groups through the shared sync helper and keeps the route table intact', () => {
  const usersSource = fs.readFileSync(path.join(__dirname, '../api/users.js'), 'utf8');
  assert.match(usersSource, /require\('\.\.\/utils\/workoutPlanGroups'\)/);
  assert.match(usersSource, /await syncScheduleGroups\(connection, scheduleId, planner, \{/);
  // a8.1: exercise-to-group resolution moved into the shared helper (still family + label unless entries are sent).
  assert.match(usersSource, /resolveExerciseGroupId\(planner, mode, ex, groupIdByKey, fallbackGroupLabel\)/);
  assert.match(usersSource, /groupSetsProvided: \{\s*day: dayIdentityEntries\.length > 0 \|\| \(Array\.isArray\(planner\.dayGroups\)/);
  // The delete-all-groups step is gone from the shared save helper.
  const helperStart = usersSource.indexOf('const replaceScheduleGroupsAndExercises');
  const helperEnd = usersSource.indexOf("router.post('/workout-schedules'", helperStart);
  const helperSource = usersSource.slice(helperStart, helperEnd);
  assert.equal(/DELETE FROM workout_schedule_groups/.test(helperSource), false);
  assert.equal(/INSERT INTO workout_schedule_groups/.test(helperSource), false);
  assert.match(helperSource, /DELETE FROM workout_schedule_exercises WHERE workout_schedule_id = \?/);
  // Load side still splits day and week groups by group_type.
  assert.match(usersSource, /\['day', 'any', 'section'\]\.includes\(groupType\)|buildScheduleGroupView\(\{/);
  assert.match(usersSource, /String\(g\?\.group_type \|\| ''\)\.trim\(\)\.toLowerCase\(\) === 'week'|groupView\.weeks/);
  assert.equal((usersSource.match(/\brouter\.(get|post|put|patch|delete)\s*\(/g) || []).length, 37);
  assert.equal(/ADD COLUMN|CREATE TABLE/i.test(helperSource), false);
});
