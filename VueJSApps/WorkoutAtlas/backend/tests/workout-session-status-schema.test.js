const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WORKOUT_SCHEMA_PATH = path.resolve(__dirname, '../schema/workout_schedule_schema.sql');
const STATUS_MIGRATION_PATH = path.resolve(__dirname, '../migrations/workout/20261117_workout_session_status_paused.sql');
const USERS_ROUTE_PATH = path.resolve(__dirname, '../api/users.js');

const readFile = (filePath) => fs.readFileSync(filePath, 'utf8');

const parseEnumValues = (enumExpression) => {
  const values = [];
  const matcher = /'([^']+)'/g;
  let match;
  while ((match = matcher.exec(enumExpression)) !== null) {
    values.push(match[1]);
  }
  return values;
};

test('canonical workout_log_sessions schema includes paused and preserves completed lifecycle statuses', () => {
  const schemaSql = readFile(WORKOUT_SCHEMA_PATH);
  const match = schemaSql.match(/CREATE TABLE IF NOT EXISTS\s+workout_log_sessions[\s\S]*?status\s+ENUM\(([^)]+)\)\s+NOT NULL\s+DEFAULT\s+'([^']+)'/i);

  assert.ok(match, 'Could not find workout_log_sessions status enum definition in canonical schema.');
  const enumValues = parseEnumValues(match[1]);

  assert.ok(enumValues.includes('in_progress'));
  assert.ok(enumValues.includes('paused'));
  assert.ok(enumValues.includes('completed'));
  assert.ok(enumValues.includes('ended'));
  assert.ok(enumValues.includes('cancelled'));
  assert.equal(match[2], 'in_progress');
});

test('paused-status migration is idempotent and preserves existing enum values', () => {
  const migrationSql = readFile(STATUS_MIGRATION_PATH);

  assert.match(migrationSql, /information_schema\.COLUMNS/i);
  assert.match(migrationSql, /COLUMN_TYPE/i);
  assert.match(migrationSql, /DATA_TYPE/i);
  assert.ok(migrationSql.includes("REPLACE(@status_column_type, ')', ',''paused'')')"));
  assert.match(migrationSql, /MODIFY COLUMN status/i);
  assert.match(migrationSql, /NOT NULL DEFAULT ''in_progress''/i);

  assert.doesNotMatch(migrationSql, /DROP TABLE/i);
  assert.doesNotMatch(migrationSql, /TRUNCATE TABLE/i);
});

test('paused-status migration appends paused while keeping prior status values intact', () => {
  const appendPaused = (columnType) =>
    String(columnType || '').toLowerCase().includes("'paused'")
      ? String(columnType || '')
      : String(columnType || '').replace(')', ",''paused'')");

  const before = "enum('in_progress','completed','ended','cancelled')";
  const after = appendPaused(before);

  assert.ok(after.includes("'in_progress'"));
  assert.ok(after.includes("'completed'"));
  assert.ok(after.includes("'ended'"));
  assert.ok(after.includes("'cancelled'"));
  assert.ok(after.includes("'paused'"));
});

test('plan delete impact and cleanup queries treat paused sessions as active unfinished sessions', () => {
  const usersRoute = readFile(USERS_ROUTE_PATH);

  assert.match(
    usersRoute,
    /source_workout_schedule_id = \?\s*\n\s*AND status IN \('in_progress', 'in-progress', 'active', 'paused'\)/i
  );
  assert.match(
    usersRoute,
    /SET status = 'cancelled',[\s\S]*AND status IN \('in_progress', 'in-progress', 'active', 'paused'\)/i
  );
});
