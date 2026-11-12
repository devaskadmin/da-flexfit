const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const groupingModulePath = path.resolve(__dirname, '../../frontend/src/utils/workoutLogGrouping.mjs');

const loadGroupingModule = async () => import(pathToFileURL(groupingModulePath).href);

const savedPlanFixture = {
  planId: '121',
  dayGroups: [
    'Monday - Cardio',
    'Tuesday - Chest & Biceps',
    'Wednesday - Shoulders and back',
    'Thursday - Leg day',
  ],
  exercises: [
    ...Array.from({ length: 2 }, (_, index) => ({ id: `monday-${index}`, scheduleGroup: 'Monday - Cardio' })),
    ...Array.from({ length: 7 }, (_, index) => ({ id: `tuesday-${index}`, scheduleGroup: 'Tuesday - Chest & Biceps' })),
    ...Array.from({ length: 7 }, (_, index) => ({ id: `wednesday-${index}`, scheduleGroup: 'Wednesday - Shoulders and back' })),
    ...Array.from({ length: 5 }, (_, index) => ({ id: `thursday-${index}`, scheduleGroup: 'Thursday - Leg day' })),
  ],
};

test('saved planner API payload renders every stored workout day and exercise assignment', async () => {
  const { buildWorkoutLogExerciseGroups } = await loadGroupingModule();
  const result = buildWorkoutLogExerciseGroups({
    groups: savedPlanFixture.dayGroups,
    exercises: savedPlanFixture.exercises,
  });

  assert.deepEqual(result.map((entry) => entry.name), savedPlanFixture.dayGroups);
  assert.deepEqual(result.map((entry) => entry.exercises.length), [2, 7, 7, 5]);
  assert.equal(result.reduce((total, entry) => total + entry.exercises.length, 0), 21);
});

test('orphan active-session recovery preserves the loaded saved plan', async () => {
  const {
    selectExpandedPlanDuringSessionRecovery,
    selectTabDuringSessionRecovery,
  } = await loadGroupingModule();

  assert.equal(selectExpandedPlanDuringSessionRecovery({
    currentPlan: savedPlanFixture,
    sessionPlanId: null,
  }), savedPlanFixture);
  assert.equal(selectExpandedPlanDuringSessionRecovery({
    currentPlan: savedPlanFixture,
    sessionPlanId: '122',
  }), null);
  assert.equal(selectTabDuringSessionRecovery({
    currentTab: 'overview',
    activateTab: false,
  }), 'overview');
  assert.equal(selectTabDuringSessionRecovery({
    currentTab: 'overview',
    activateTab: true,
  }), 'dayDetails');
});

test('buildWorkoutLogExerciseGroups preserves configured day order when labels match', async () => {
  const { buildWorkoutLogExerciseGroups } = await loadGroupingModule();
  const groups = ['Monday', 'Tuesday', 'Wednesday'];
  const exercises = [
    { id: 'e-1', scheduleGroup: 'Tuesday' },
    { id: 'e-2', scheduleGroup: 'Monday' },
    { id: 'e-3', scheduleGroup: 'Tuesday' },
  ];

  const result = buildWorkoutLogExerciseGroups({ groups, exercises });
  assert.deepEqual(result.map((entry) => entry.name), ['Monday', 'Tuesday']);
  assert.equal(result[0].exercises.length, 1);
  assert.equal(result[1].exercises.length, 2);
});

test('buildWorkoutLogExerciseGroups falls back to exercise schedule groups when configured groups do not match', async () => {
  const { buildWorkoutLogExerciseGroups } = await loadGroupingModule();
  const groups = ['Any Day'];
  const exercises = [
    { id: 'e-1', scheduleGroup: 'Monday - Cardio' },
    { id: 'e-2', scheduleGroup: 'Tuesday - Chest' },
  ];

  const result = buildWorkoutLogExerciseGroups({ groups, exercises });
  assert.deepEqual(result.map((entry) => entry.name), ['Monday - Cardio', 'Tuesday - Chest']);
});

test('filterWorkoutLogDayExercises matches day labels case-insensitively', async () => {
  const { filterWorkoutLogDayExercises } = await loadGroupingModule();
  const exercises = [
    { id: 'e-1', scheduleGroup: 'Tuesday - Chest & Biceps' },
    { id: 'e-2', scheduleGroup: 'Monday - Cardio' },
  ];

  const result = filterWorkoutLogDayExercises({
    selectedDay: 'tuesday - chest & biceps',
    exercises,
    fallbackGroup: 'Any Day',
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'e-1');
});
