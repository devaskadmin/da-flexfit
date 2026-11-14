const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../db');

const {
  TARGET_PLAN_TYPES,
  buildWorkoutPlanConversionPreview,
} = require('../services/workoutPlanConversionEngine');

after(async () => {
  await pool.end();
});

function buildSourcePlan(overrides = {}) {
  return {
    planId: 'fixture-plan-1',
    scheduleMode: 'day',
    dayGroups: ['Day 1', 'Day 2'],
    dayGroupOrders: [
      { label: 'Day 1', sortOrder: 1 },
      { label: 'Day 2', sortOrder: 2 },
    ],
    weekGroups: ['Week 1'],
    weekGroupOrders: [{ label: 'Week 1', sortOrder: 1 }],
    status: 'active',
    visibility: 'private',
    metadata: {
      name: 'Fixture Mixed Plan',
      description: 'Fixture description',
      type: 'Hybrid',
      category: 'General Fitness',
      planType: 'community',
      estimatedDuration: 50,
      planDurationWeeks: 6,
      goalType: 'exercise_weight',
      goalTargetDate: '2027-01-01',
      goalId: '77',
      goalContext: {
        goalType: 'exercise_weight',
        exerciseId: 1001,
        exerciseName: 'Bench Press',
        targetValue: 225,
        targetUnit: 'lb',
        targetDate: '2027-01-01',
        status: 'active',
      },
      coverImage: '',
    },
    exercises: [
      {
        sortOrder: 2,
        exerciseId: 1001,
        name: 'Bench Press',
        workoutType: 'Strength',
        sets: 5,
        reps: 5,
        weight: 200,
        restTime: 120,
        scheduleGroup: 'Day 1',
        notes: 'Heavy day',
      },
      {
        sortOrder: 1,
        exerciseId: 1002,
        name: 'Run',
        workoutType: 'Cardio',
        duration: 30,
        distance: 3,
        calories: 300,
        scheduleGroup: 'Day 2',
        notes: 'Aerobic base',
      },
    ],
    ...overrides,
  };
}

function buildExerciseRecord({
  id,
  scope = 'SYSTEM',
  ownerUserId = null,
  createdByUserId = 0,
  publication = 'DISCOVERABLE',
  isSystem = 0,
  isGlobal = 1,
}) {
  return {
    ExerciseID: id,
    ExerciseScope: scope,
    OwnerTrainerID: ownerUserId,
    CreatedByUserID: createdByUserId,
    ExercisePublicationState: publication,
    IsSystemExercise: isSystem,
    IsGlobalExercise: isGlobal,
  };
}

async function resolveByMap(map) {
  return map;
}

test('Personal to Community conversion builds preview and payload when compatible', async () => {
  const sourcePlan = buildSourcePlan({
    metadata: {
      ...buildSourcePlan().metadata,
      planType: 'personal',
    },
  });

  const exerciseRecords = [
    buildExerciseRecord({ id: 1001, scope: 'SYSTEM', isSystem: 1 }),
    buildExerciseRecord({ id: 1002, scope: 'SHARED', ownerUserId: 12 }),
  ];

  const result = await buildWorkoutPlanConversionPreview({
    sourcePlan,
    targetPlanType: TARGET_PLAN_TYPES.COMMUNITY,
    authContext: { userId: 12, role: 'member' },
    resolveExercisesByIds: () => resolveByMap(exerciseRecords),
    options: { allowUnsafeCoverReferenceCarryForward: true },
  });

  assert.equal(result.ok, true);
  assert.equal(result.preview.target.planType, 'community');
  assert.equal(result.preview.canProceed, true);
  assert.equal(result.payload.metadata.planType, 'community');
});

test('Community to Personal conversion builds payload and preserves schedule ordering', async () => {
  const sourcePlan = buildSourcePlan();
  const exerciseRecords = [
    buildExerciseRecord({ id: 1001, scope: 'SYSTEM', isSystem: 1 }),
    buildExerciseRecord({ id: 1002, scope: 'SHARED', ownerUserId: 12 }),
  ];

  const result = await buildWorkoutPlanConversionPreview({
    sourcePlan,
    targetPlanType: TARGET_PLAN_TYPES.PERSONAL,
    authContext: { userId: 12, role: 'member' },
    resolveExercisesByIds: () => resolveByMap(exerciseRecords),
    options: { allowUnsafeCoverReferenceCarryForward: true },
  });

  assert.equal(result.ok, true);
  assert.equal(result.preview.canProceed, true);
  assert.deepEqual(result.payload.dayGroups, ['Day 1', 'Day 2']);
  assert.equal(result.payload.exercises[0].name, 'Run');
  assert.equal(result.payload.exercises[1].name, 'Bench Press');
});

test('Community to Global conversion succeeds for admin', async () => {
  const sourcePlan = buildSourcePlan();
  const exerciseRecords = [
    buildExerciseRecord({ id: 1001, scope: 'SYSTEM', isSystem: 1 }),
    buildExerciseRecord({ id: 1002, scope: 'SHARED', ownerUserId: 5 }),
  ];

  const result = await buildWorkoutPlanConversionPreview({
    sourcePlan,
    targetPlanType: TARGET_PLAN_TYPES.GLOBAL,
    authContext: { userId: 1, role: 'admin' },
    resolveExercisesByIds: () => resolveByMap(exerciseRecords),
    options: { allowUnsafeCoverReferenceCarryForward: true },
  });

  assert.equal(result.ok, true);
  assert.equal(result.preview.target.planType, 'global');
  assert.equal(result.preview.canProceed, true);
  assert.equal(result.payload.metadata.planType, 'global');
  assert.equal(result.payload.metadata.isFeatured, false);
});

test('Global to Personal conversion keeps draft defaults and metadata', async () => {
  const sourcePlan = buildSourcePlan({
    metadata: {
      ...buildSourcePlan().metadata,
      planType: 'global',
    },
    status: 'active',
    visibility: 'public',
  });

  const exerciseRecords = [
    buildExerciseRecord({ id: 1001, scope: 'SYSTEM', isSystem: 1 }),
    buildExerciseRecord({ id: 1002, scope: 'SHARED', ownerUserId: 12 }),
  ];

  const result = await buildWorkoutPlanConversionPreview({
    sourcePlan,
    targetPlanType: TARGET_PLAN_TYPES.PERSONAL,
    authContext: { userId: 12, role: 'member' },
    resolveExercisesByIds: () => resolveByMap(exerciseRecords),
    options: { allowUnsafeCoverReferenceCarryForward: true },
  });

  assert.equal(result.ok, true);
  assert.equal(result.preview.target.defaults.status, 'draft');
  assert.equal(result.payload.metadata.name, 'Fixture Mixed Plan');
  assert.equal(result.payload.metadata.planDurationWeeks, 6);
});

test('Unauthorized Global conversion rejected for non-admin', async () => {
  const sourcePlan = buildSourcePlan();

  const result = await buildWorkoutPlanConversionPreview({
    sourcePlan,
    targetPlanType: TARGET_PLAN_TYPES.GLOBAL,
    authContext: { userId: 12, role: 'member' },
    resolveExercisesByIds: () => resolveByMap([]),
  });

  assert.equal(result.ok, false);
  assert.equal(result.permission.code, 'TARGET_TYPE_FORBIDDEN');
});

test('Incompatible private exercise is detected and blocks proceed', async () => {
  const sourcePlan = buildSourcePlan();
  const exerciseRecords = [
    buildExerciseRecord({ id: 1001, scope: 'PRIVATE', ownerUserId: 44, publication: 'RESTRICTED', isGlobal: 0 }),
    buildExerciseRecord({ id: 1002, scope: 'SHARED', ownerUserId: 12 }),
  ];

  const result = await buildWorkoutPlanConversionPreview({
    sourcePlan,
    targetPlanType: TARGET_PLAN_TYPES.COMMUNITY,
    authContext: { userId: 12, role: 'member' },
    resolveExercisesByIds: () => resolveByMap(exerciseRecords),
    options: { allowUnsafeCoverReferenceCarryForward: true },
  });

  assert.equal(result.ok, true);
  assert.equal(result.preview.compatibility.incompatibleExerciseCount, 1);
  assert.equal(result.preview.canProceed, false);
  assert.equal(result.payload, null);
});

test('Existing exercise ordering is preserved in preview and payload sort', async () => {
  const sourcePlan = buildSourcePlan({
    exercises: [
      {
        sortOrder: 3,
        exerciseId: 1003,
        name: 'C',
        workoutType: 'Strength',
        sets: 3,
        reps: 8,
        scheduleGroup: 'Day 1',
      },
      {
        sortOrder: 1,
        exerciseId: 1001,
        name: 'A',
        workoutType: 'Strength',
        sets: 3,
        reps: 8,
        scheduleGroup: 'Day 1',
      },
      {
        sortOrder: 2,
        exerciseId: 1002,
        name: 'B',
        workoutType: 'Cardio',
        duration: 20,
        distance: 2,
        scheduleGroup: 'Day 2',
      },
    ],
  });

  const exerciseRecords = [
    buildExerciseRecord({ id: 1001, scope: 'SYSTEM', isSystem: 1 }),
    buildExerciseRecord({ id: 1002, scope: 'SHARED', ownerUserId: 12 }),
    buildExerciseRecord({ id: 1003, scope: 'SHARED', ownerUserId: 12 }),
  ];

  const result = await buildWorkoutPlanConversionPreview({
    sourcePlan,
    targetPlanType: TARGET_PLAN_TYPES.PERSONAL,
    authContext: { userId: 12, role: 'member' },
    resolveExercisesByIds: () => resolveByMap(exerciseRecords),
    options: { allowUnsafeCoverReferenceCarryForward: true },
  });

  assert.equal(result.ok, true);
  assert.equal(result.preview.canProceed, true);
  assert.deepEqual(result.payload.exercises.map((entry) => entry.name), ['A', 'B', 'C']);
});

test('Existing schedule groups are preserved in conversion payload', async () => {
  const sourcePlan = buildSourcePlan({
    scheduleMode: 'week',
    dayGroups: ['Any Day'],
    weekGroups: ['Week 3', 'Week 1', 'Week 2'],
    weekGroupOrders: [
      { label: 'Week 1', sortOrder: 1 },
      { label: 'Week 2', sortOrder: 2 },
      { label: 'Week 3', sortOrder: 3 },
    ],
    exercises: [
      {
        sortOrder: 1,
        exerciseId: 1001,
        name: 'Week Exercise',
        workoutType: 'Strength',
        sets: 3,
        reps: 8,
        scheduleGroup: 'Week 2',
      },
    ],
  });

  const exerciseRecords = [buildExerciseRecord({ id: 1001, scope: 'SYSTEM', isSystem: 1 })];

  const result = await buildWorkoutPlanConversionPreview({
    sourcePlan,
    targetPlanType: TARGET_PLAN_TYPES.PERSONAL,
    authContext: { userId: 12, role: 'member' },
    resolveExercisesByIds: () => resolveByMap(exerciseRecords),
    options: { allowUnsafeCoverReferenceCarryForward: true },
  });

  assert.equal(result.ok, true);
  assert.equal(result.payload.scheduleMode, 'week');
  assert.deepEqual(result.payload.weekGroups, ['Week 1', 'Week 2', 'Week 3']);
  assert.equal(result.payload.exercises[0].scheduleGroup, 'Week 2');
});

test('Original source object remains unchanged after conversion preview', async () => {
  const sourcePlan = buildSourcePlan();
  const before = JSON.parse(JSON.stringify(sourcePlan));

  const exerciseRecords = [
    buildExerciseRecord({ id: 1001, scope: 'SYSTEM', isSystem: 1 }),
    buildExerciseRecord({ id: 1002, scope: 'SHARED', ownerUserId: 12 }),
  ];

  await buildWorkoutPlanConversionPreview({
    sourcePlan,
    targetPlanType: TARGET_PLAN_TYPES.PERSONAL,
    authContext: { userId: 12, role: 'member' },
    resolveExercisesByIds: () => resolveByMap(exerciseRecords),
    options: { allowUnsafeCoverReferenceCarryForward: true },
  });

  assert.deepEqual(sourcePlan, before);
});

test('Invalid template source is rejected via canonical validation', async () => {
  const invalidSource = {
    scheduleMode: 'day',
    dayGroups: ['Day 1'],
    weekGroups: ['Week 1'],
    metadata: {
      name: '',
      type: 'Strength',
    },
    exercises: [],
  };

  const result = await buildWorkoutPlanConversionPreview({
    sourcePlan: invalidSource,
    targetPlanType: TARGET_PLAN_TYPES.PERSONAL,
    authContext: { userId: 12, role: 'member' },
    resolveExercisesByIds: () => resolveByMap([]),
  });

  assert.equal(result.ok, false);
  assert.ok(Array.isArray(result.validation.errors));
  assert.ok(result.validation.errors.length > 0);
});

test('Cover copy safety limitation blocks final conversion when cover reference exists', async () => {
  const sourcePlan = buildSourcePlan({
    metadata: {
      ...buildSourcePlan().metadata,
      coverImage: 'https://cdn.example.com/cover.jpg',
    },
  });

  const exerciseRecords = [
    buildExerciseRecord({ id: 1001, scope: 'SYSTEM', isSystem: 1 }),
    buildExerciseRecord({ id: 1002, scope: 'SHARED', ownerUserId: 12 }),
  ];

  const result = await buildWorkoutPlanConversionPreview({
    sourcePlan,
    targetPlanType: TARGET_PLAN_TYPES.PERSONAL,
    authContext: { userId: 12, role: 'member' },
    resolveExercisesByIds: () => resolveByMap(exerciseRecords),
    options: { allowUnsafeCoverReferenceCarryForward: false },
  });

  assert.equal(result.ok, true);
  assert.equal(result.preview.canProceed, false);
  assert.ok(Array.isArray(result.preview.blockers));
  assert.ok(result.preview.blockers.some((entry) => /cover image reference/i.test(entry.message)));
  assert.equal(result.payload, null);
});
