const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  normalizeDayWeekAssignments,
  hasIncomingDayWeekAssignments,
  parseStoredSettings,
  extractDayWeekAssignments,
  mergeDayWeekAssignmentsIntoSettings,
  persistDayWeekAssignments,
  MAX_ASSIGNMENT_ENTRIES,
} = require('../utils/workoutPlanSettings');

// Isolated fixture: an in-memory stand-in for one workout_schedules row. No real database is used.
const createFakeConnection = (initialSettingsJson, { exists = true } = {}) => {
  const state = { settingsJson: initialSettingsJson, queries: [] };
  return {
    state,
    async query(sql, params) {
      state.queries.push({ sql, params });
      if (/^SELECT settings_json/i.test(sql)) {
        return [exists ? [{ settings_json: state.settingsJson }] : []];
      }
      if (/^UPDATE workout_schedules SET settings_json/i.test(sql)) {
        state.settingsJson = params[0];
        return [{ affectedRows: 1 }];
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
};

test('normalizeDayWeekAssignments lowercases days, trims weeks and drops invalid or unsafe entries', () => {
  const out = normalizeDayWeekAssignments({
    ' Monday ': ' Week 2 ',
    Tuesday: '',
    Wednesday: 7,
    '': 'Week 1',
    ['x'.repeat(121)]: 'Week 1',
    Thursday: 'w'.repeat(121),
    constructor: 'Week 1',
    prototype: 'Week 1',
  });
  assert.deepEqual(out, { monday: 'Week 2' });
  assert.deepEqual(normalizeDayWeekAssignments(null), {});
  assert.deepEqual(normalizeDayWeekAssignments(['Week 1']), {});
  assert.equal(Object.getPrototypeOf(normalizeDayWeekAssignments(JSON.parse('{"__proto__":"Week 1"}'))), Object.prototype);
});

test('normalizeDayWeekAssignments caps the number of entries', () => {
  const big = {};
  for (let i = 0; i < MAX_ASSIGNMENT_ENTRIES + 25; i += 1) {
    big[`day ${i}`] = 'Week 1';
  }
  assert.equal(Object.keys(normalizeDayWeekAssignments(big)).length, MAX_ASSIGNMENT_ENTRIES);
});

test('hasIncomingDayWeekAssignments requires an object under settings', () => {
  assert.equal(hasIncomingDayWeekAssignments({ settings: { dayWeekAssignments: {} } }), true);
  assert.equal(hasIncomingDayWeekAssignments({ settings: {} }), false);
  assert.equal(hasIncomingDayWeekAssignments({ settings: { dayWeekAssignments: [] } }), false);
  assert.equal(hasIncomingDayWeekAssignments({}), false);
  assert.equal(hasIncomingDayWeekAssignments(null), false);
});

test('parseStoredSettings handles null, JSON text, objects and non-object JSON', () => {
  assert.deepEqual(parseStoredSettings(null), { ok: true, settings: {} });
  assert.deepEqual(parseStoredSettings(''), { ok: true, settings: {} });
  assert.deepEqual(parseStoredSettings('null'), { ok: true, settings: {} });
  assert.deepEqual(parseStoredSettings('{"a":1}'), { ok: true, settings: { a: 1 } });
  assert.deepEqual(parseStoredSettings({ a: 1 }), { ok: true, settings: { a: 1 } });
  assert.equal(parseStoredSettings('[1]').ok, false);
  assert.equal(parseStoredSettings('"text"').ok, false);
  assert.equal(parseStoredSettings('{bad').ok, false);
});

test('extractDayWeekAssignments restores saved assignments and tolerates missing or corrupt settings', () => {
  assert.deepEqual(
    extractDayWeekAssignments(JSON.stringify({ theme: 'x', dayWeekAssignments: { monday: 'Week 2' } })),
    { monday: 'Week 2' }
  );
  assert.deepEqual(extractDayWeekAssignments(null), {});
  assert.deepEqual(extractDayWeekAssignments('{"theme":"x"}'), {});
  assert.deepEqual(extractDayWeekAssignments('{bad'), {});
  assert.deepEqual(extractDayWeekAssignments('[1]'), {});
});

test('mergeDayWeekAssignmentsIntoSettings preserves every other settings key', () => {
  const existing = JSON.stringify({ theme: 'dark', nested: { a: [1, 2] }, dayWeekAssignments: { monday: 'Week 1' } });
  const merged = mergeDayWeekAssignmentsIntoSettings(existing, { Monday: 'Week 2', tuesday: 'Week 1' });
  assert.equal(merged.ok, true);
  assert.deepEqual(JSON.parse(merged.json), {
    theme: 'dark',
    nested: { a: [1, 2] },
    dayWeekAssignments: { monday: 'Week 2', tuesday: 'Week 1' },
  });
  assert.deepEqual(JSON.parse(mergeDayWeekAssignmentsIntoSettings(null, { monday: 'Week 1' }).json), {
    dayWeekAssignments: { monday: 'Week 1' },
  });
  assert.equal(mergeDayWeekAssignmentsIntoSettings('[1]', { monday: 'Week 1' }).ok, false);
});

test('save then load round trip restores assignments without disturbing other settings', async () => {
  const db = createFakeConnection(JSON.stringify({ keep: { me: true } }));
  const planner = { settings: { dayWeekAssignments: { Monday: 'Week 2', Friday: 'Week 1' } } };

  const result = await persistDayWeekAssignments(db, 81, planner, { hasSettingsJson: true });
  assert.deepEqual(result, { persisted: true, reason: '' });

  const stored = JSON.parse(db.state.settingsJson);
  assert.deepEqual(stored.keep, { me: true });
  assert.deepEqual(extractDayWeekAssignments(db.state.settingsJson), { monday: 'Week 2', friday: 'Week 1' });
  assert.equal(db.state.queries.length, 2);
  assert.match(db.state.queries[0].sql, /FOR UPDATE/);
  assert.deepEqual(db.state.queries[0].params, [81]);
  assert.equal(db.state.queries[1].params[1], 81);
});

test('persist is a no-op when the column is unavailable or no assignments were sent', async () => {
  const noColumn = createFakeConnection(null);
  const planner = { settings: { dayWeekAssignments: { monday: 'Week 1' } } };
  assert.equal((await persistDayWeekAssignments(noColumn, 1, planner, { hasSettingsJson: false })).persisted, false);
  assert.equal((await persistDayWeekAssignments(noColumn, 1, planner)).persisted, false);
  assert.equal(noColumn.state.queries.length, 0);

  const legacyClient = createFakeConnection('{"keep":1}');
  assert.equal((await persistDayWeekAssignments(legacyClient, 1, { exercises: [] }, { hasSettingsJson: true })).persisted, false);
  assert.equal(legacyClient.state.queries.length, 0);
  assert.equal(legacyClient.state.settingsJson, '{"keep":1}');
});

test('persist never overwrites non-object stored settings or missing schedules', async () => {
  const planner = { settings: { dayWeekAssignments: { monday: 'Week 1' } } };

  const arrayStored = createFakeConnection('[1,2]');
  const arrayResult = await persistDayWeekAssignments(arrayStored, 5, planner, { hasSettingsJson: true });
  assert.equal(arrayResult.persisted, false);
  assert.equal(arrayStored.state.settingsJson, '[1,2]');
  assert.equal(arrayStored.state.queries.length, 1);

  const missing = createFakeConnection(null, { exists: false });
  assert.equal((await persistDayWeekAssignments(missing, 999, planner, { hasSettingsJson: true })).persisted, false);
  assert.equal(missing.state.queries.length, 1);
});

test('persist only issues statements scoped to the supplied schedule id', async () => {
  const db = createFakeConnection(null);
  await persistDayWeekAssignments(db, 42, { settings: { dayWeekAssignments: { monday: 'Week 1' } } }, { hasSettingsJson: true });
  db.state.queries.forEach((entry) => {
    assert.match(entry.sql, /WHERE id = \?/);
    assert.equal(entry.params.includes(42), true);
  });
});

test('users.js wires settings_json persistence surgically and keeps the route table intact', () => {
  const usersSource = fs.readFileSync(path.join(__dirname, '../api/users.js'), 'utf8');
  assert.match(usersSource, /require\('\.\.\/utils\/workoutPlanSettings'\)/);
  assert.match(usersSource, /column_name = 'settings_json'/);
  assert.match(usersSource, /hasSettingsJson: false,/);
  assert.match(usersSource, /await persistDayWeekAssignments\(connection, scheduleId, normalizedPlanner, \{\s*hasSettingsJson: schemaState\.hasSettingsJson,\s*\}\);/);
  assert.match(usersSource, /dayWeekAssignments: schemaState\.hasSettingsJson\s*\?\s*extractDayWeekAssignments\(schedule\.settings_json\)/);
  assert.equal(/ADD COLUMN settings_json|ALTER TABLE[^`]*settings_json/i.test(usersSource), false);
  assert.equal((usersSource.match(/\brouter\.(get|post|put|patch|delete)\s*\(/g) || []).length, 37);
  assert.equal(usersSource.split('persistDayWeekAssignments(connection').length - 1, 1);
});
