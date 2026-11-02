const test = require('node:test');
const assert = require('node:assert/strict');

const {
  WORKOUTATLAS_PLAN_FORMAT,
  WORKOUTATLAS_PLAN_SCHEMA_VERSION,
  KNOWN_PERSISTENCE_GAPS,
  toCanonicalWorkoutPlanTemplate,
  validateWorkoutPlanTemplate,
  toInternalWorkoutPlannerPayload,
} = require('../utils/workoutPlanTemplate');

function buildSamplePlanner(overrides = {}) {
  return {
    planId: '81',
    scheduleMode: 'day',
    dayGroups: ['Day 2', 'Day 1'],
    weekGroups: ['Week 1'],
    dayGroupOrders: [
      { label: 'Day 1', sortOrder: 1 },
      { label: 'Day 2', sortOrder: 2 },
    ],
    metadata: {
      name: 'Template Validation Plan',
      description: 'Mixed mode plan',
      type: 'Hybrid',
      category: 'General Fitness',
      planType: 'community',
      estimatedDuration: 48,
      planDurationWeeks: 8,
      goalType: 'exercise_weight',
      goalTargetDate: '2026-12-31',
      goalId: '19',
      goalContext: {
        goalType: 'exercise_weight',
        exerciseId: 7,
        exerciseName: 'Bench Press',
        targetValue: 225,
        targetUnit: 'lb',
        targetDate: '2026-12-31',
        status: 'active',
      },
    },
    status: 'draft',
    visibility: 'private',
    exercises: [
      {
        sortOrder: 2,
        exerciseId: 101,
        name: 'Bench Press',
        image: 'https://cdn.example.com/bench.jpg',
        workoutType: 'Strength',
        muscleGroup: 'Chest',
        equipment: 'Barbell',
        sets: 4,
        reps: 8,
        weight: 185,
        restTime: 90,
        notes: 'Explosive concentric',
        scheduleGroup: 'Day 1',
      },
      {
        sortOrder: 1,
        exerciseId: 202,
        name: 'Run',
        workoutType: 'Cardio',
        duration: 30,
        distance: 3.5,
        calories: 330,
        notes: 'Zone 2 effort',
        scheduleGroup: 'Day 2',
      },
      {
        sortOrder: 3,
        exerciseId: 303,
        name: 'Sandbag Carry',
        workoutType: 'Other',
        recordingType: 'custom',
        duration: 12,
        distance: 0.25,
        notes: 'Steady pacing',
        scheduleGroup: 'Day 1',
      },
    ],
    ...overrides,
  };
}

test('serializes planner data into canonical workout template format', () => {
  const source = buildSamplePlanner();
  const template = toCanonicalWorkoutPlanTemplate(source);

  assert.equal(template.format, WORKOUTATLAS_PLAN_FORMAT);
  assert.equal(template.schemaVersion, WORKOUTATLAS_PLAN_SCHEMA_VERSION);
  assert.equal(template.template.metadata.name, 'Template Validation Plan');
  assert.equal(template.template.metadata.planType, 'community');
  assert.equal(template.template.schedule.mode, 'day');

  assert.deepEqual(
    template.template.schedule.dayGroups.map((group) => group.label),
    ['Day 1', 'Day 2']
  );

  const cardioExercise = template.template.schedule.exercises.find((item) => item.exercise.name === 'Run');
  assert.ok(cardioExercise);
  assert.equal(cardioExercise.exercise.recordingType, 'time_distance');
  assert.equal(cardioExercise.targets.durationMinutes, 30);
  assert.equal(cardioExercise.targets.distanceMiles, 3.5);
  assert.equal(cardioExercise.targets.calories, 330);

  const otherExercise = template.template.schedule.exercises.find((item) => item.exercise.name === 'Sandbag Carry');
  assert.ok(otherExercise);
  assert.equal(otherExercise.exercise.recordingType, 'time_distance');

  const validation = validateWorkoutPlanTemplate(template);
  assert.equal(validation.ok, true);
});

test('converts canonical template back to internal planner payload', () => {
  const template = toCanonicalWorkoutPlanTemplate(buildSamplePlanner());
  const payload = toInternalWorkoutPlannerPayload(template);

  assert.equal(payload.scheduleMode, 'day');
  assert.deepEqual(payload.dayGroups, ['Day 1', 'Day 2']);
  assert.equal(payload.metadata.name, 'Template Validation Plan');
  assert.equal(payload.metadata.goalId, '19');
  assert.equal(payload.metadata.planDurationWeeks, 8);

  assert.equal(payload.exercises.length, 3);
  assert.equal(payload.exercises[0].name, 'Run');
  assert.equal(payload.exercises[0].sortOrder, 1);
  assert.equal(payload.exercises[0].calories, 330);
  assert.equal(payload.exercises[1].name, 'Bench Press');
  assert.equal(payload.exercises[2].name, 'Sandbag Carry');
});

test('supports week scheduling mode and validates week group membership', () => {
  const template = toCanonicalWorkoutPlanTemplate(buildSamplePlanner({
    scheduleMode: 'week',
    dayGroups: ['Any Day'],
    weekGroups: ['Week 2', 'Week 1'],
    weekGroupOrders: [
      { label: 'Week 1', sortOrder: 1 },
      { label: 'Week 2', sortOrder: 2 },
    ],
    exercises: [
      {
        sortOrder: 1,
        exerciseId: 900,
        name: 'Week Lift',
        workoutType: 'Strength',
        sets: 3,
        reps: 5,
        scheduleGroup: 'Week 1',
      },
    ],
  }));

  assert.equal(template.template.schedule.mode, 'week');
  assert.deepEqual(
    template.template.schedule.weekGroups.map((group) => group.label),
    ['Week 1', 'Week 2']
  );

  const validation = validateWorkoutPlanTemplate(template);
  assert.equal(validation.ok, true);
});

test('rejects invalid JSON shape and unsupported schema version', () => {
  const invalidTemplate = {
    format: 'wrong.format',
    schemaVersion: 2,
    template: {
      metadata: { name: '' },
      publication: { status: 'draft' },
      goals: {},
      coverImage: { assetRefType: 'none', uri: null },
      schedule: { mode: 'day', dayGroups: [], weekGroups: [], exercises: [] },
      extensions: {},
    },
  };

  const validation = validateWorkoutPlanTemplate(invalidTemplate);
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join(' '), /Unsupported schemaVersion/i);
  assert.match(validation.errors.join(' '), /format must be/i);
});

test('rejects templates exposing sensitive/internal fields', () => {
  const template = toCanonicalWorkoutPlanTemplate(buildSamplePlanner());
  template.template.extensions.userId = 22;
  template.template.coverImage.uri = 'APP/workout-plans/88/images/cover.jpg';

  const validation = validateWorkoutPlanTemplate(template);
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join(' '), /forbidden internal fields/i);
  assert.match(validation.errors.join(' '), /must not expose private storage keys/i);
});

test('serialization does not mutate source objects', () => {
  const source = buildSamplePlanner();
  const before = JSON.parse(JSON.stringify(source));

  toCanonicalWorkoutPlanTemplate(source);

  assert.deepEqual(source, before);
});

test('invalid template throws when converting to internal payload', () => {
  const invalidTemplate = {
    format: WORKOUTATLAS_PLAN_FORMAT,
    schemaVersion: 999,
    template: {},
  };

  assert.throws(
    () => toInternalWorkoutPlannerPayload(invalidTemplate),
    /Unsupported schemaVersion/i
  );
});

test('validation returns known persistence gap warnings', () => {
  const template = toCanonicalWorkoutPlanTemplate(buildSamplePlanner());
  const validation = validateWorkoutPlanTemplate(template);

  assert.equal(validation.ok, true);
  assert.ok(validation.warnings.length >= KNOWN_PERSISTENCE_GAPS.length);
});
