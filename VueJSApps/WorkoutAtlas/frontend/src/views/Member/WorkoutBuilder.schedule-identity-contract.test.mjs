import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 0.85.313.a8.1: stable schedule group identity in the builder. Source-contract checks only.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(__dirname, 'WorkoutBuilder.vue'), 'utf8');
const script = source.slice(source.indexOf('<script setup'), source.indexOf('</script>'));

const bodyOf = (startMarker, endMarker) => {
  const start = script.indexOf(startMarker);
  assert.equal(start >= 0, true, `missing ${startMarker}`);
  return script.slice(start, script.indexOf(endMarker, start));
};

test('the save payload sends group entries with ids and each exercise\'s group key', () => {
  const payload = bodyOf('const plannerPayload = computed', '}));');
  assert.match(payload, /dayGroupEntries: buildGroupEntries\(/);
  assert.match(payload, /weekGroupEntries: buildGroupEntries\(/);
  assert.match(payload, /getScheduleGroupDbId\(name, 'day'\)/);
  assert.match(payload, /getScheduleGroupDbId\(name, 'week'\)/);
  assert.match(payload, /labelOverrides: dayLabelOverrides\.value/);
  assert.match(payload, /scheduleGroupKey:/);
});

test('hydrating a plan reads the entries (ids and real labels) before falling back to names', () => {
  const hydrate = bodyOf('const hydratePlanner', 'const clearSelection = async');
  assert.match(hydrate, /readGroupEntries\(/);
  assert.match(hydrate, /dayLabelOverrides\.value/);
  assert.match(hydrate, /applyScheduleGroupDbIds\(/);
});

test('renaming keeps the saved database id and only changes the label', () => {
  const rename = bodyOf('const saveInlineDayNameEdit', 'const removeScheduleGroup');
  assert.match(rename, /transferScheduleGroupIdentity\(mode, oldName, suggestedName\)/);
  assert.match(rename, /moveDayLabelOverride\(/);
  assert.match(rename, /setDayLabelOverride\(/);
  assert.match(rename, /findDayWithLabelInWeek\(/);
  assert.match(rename, /ignoreDay: oldName/);
});

test('removing a day drops its label override', () => {
  const remove = bodyOf('const removeScheduleGroup', 'const duplicateScheduleGroup');
  assert.match(remove, /setDayLabelOverride\(dayLabelOverrides\.value, groupName, ''\)/);
});

test('saved ids are adopted after both save paths, before the state is committed', () => {
  assert.match(script, /const adoptSavedGroupIds = \(savedPlanner\) =>/);
  assert.match(script, /adoptSavedGroupIds\(data\?\.planner\)/);
  assert.match(script, /adoptSavedGroupIds\(scheduleData\?\.planner\)/);
});

test('drafts and the dirty state include the label overrides and ids', () => {
  assert.match(script, /dayLabelOverrides: \{ \.\.\.dayLabelOverrides\.value \}|dayLabelOverrides: /);
  const dirty = bodyOf('const buildPlannerDirtyState', '\n};');
  assert.match(dirty, /dayLabelOverrides/);
});

test('the day label, not the internal key, is what the planner shows', () => {
  const format = bodyOf('const formatPlannerDayNameForDisplay', '\n};');
  assert.match(format, /resolveDayLabel\(/);
});
