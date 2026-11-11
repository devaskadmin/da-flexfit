const test = require('node:test');
const assert = require('node:assert/strict');

const exerciseApi = require('../api/excerises.js');
const aiGatewayService = require('../services/aiGatewayService');
const {
  ensureExerciseFolderMarker,
  buildLogicalMediaPath,
  normalizeExerciseCreatePayload,
  validateExerciseCreatePayload,
  buildWorkoutTypeMuscleGroupMatrix,
  validateAndNormalizeExerciseCategorySelection,
  normalizeExerciseSearchTerm,
  escapeSqlLikePattern,
  buildLiteralSubstringLikeParam,
  buildLiteralSubstringLikeParams,
  fetchExercisePage,
  canReadExerciseForUser,
  canDeleteExercise,
  isRetiredSystemExercise,
  isRetiredCustomExercise,
  getDeleteMergeAccess,
  getMutableDependencyOwnershipImpact,
  validateRecordingTypeCompatibility,
  EXERCISE_ALLOWED_WORKOUT_TYPES,
  EXERCISE_ALLOWED_RECORDING_TYPES,
  EXERCISE_FIELD_LIMITS,
  normalizeExerciseTextField,
  normalizeExerciseAllowedValue,
  validateAndNormalizeExerciseMutationInput,
  tokenizeExerciseSearchKeywords,
  MAX_EXERCISE_SEARCH_KEYWORDS,
} = exerciseApi;
const pool = require('../db');

test('canonicalImageNameForSlot uses exercise and exercise-2 names with validated extensions', () => {
  assert.equal(exerciseApi.canonicalImageNameForSlot(0, '.jpg'), 'exercise.jpg');
  assert.equal(exerciseApi.canonicalImageNameForSlot(1, '.png'), 'exercise-2.png');
  assert.equal(exerciseApi.canonicalImageNameForSlot(0, '.webp'), 'exercise.webp');
});

test('validateRecordingTypeCompatibility blocks merges across incompatible recording types', () => {
  const compatibility = validateRecordingTypeCompatibility({
    sourceExercise: { RecordingType: 'Sets & Reps' },
    destinationExercise: { RecordingType: 'Time & Distance' },
  });

  assert.equal(compatibility.compatible, false);
  assert.match(compatibility.message, /Cannot merge because recording types are incompatible/i);
});

test('isRetiredSystemExercise identifies custom restricted system rows retired from active library', () => {
  assert.equal(isRetiredSystemExercise({
    IsSystemExercise: 1,
    IsGlobalExercise: 0,
    ExerciseScope: 'CUSTOM',
    ExercisePublicationState: 'RESTRICTED',
  }), true);

  assert.equal(isRetiredSystemExercise({
    IsSystemExercise: 1,
    ExerciseScope: 'SYSTEM',
    ExercisePublicationState: 'DISCOVERABLE',
  }), false);
});

test('getDeleteMergeAccess preserves SYSTEM admin rules and allows a CUSTOM owner', () => {
  const adminReq = { session: { user: { id: 1, role: 'admin' } } };
  const ownerReq = { session: { user: { id: 14, role: 'user' } } };
  const systemExercise = { ExerciseScope: 'SYSTEM', IsSystemExercise: 1 };
  const customExercise = {
    ExerciseScope: 'CUSTOM',
    IsSystemExercise: 0,
    IsGlobalExercise: 0,
    CreatedByUserID: 14,
  };

  assert.deepEqual(getDeleteMergeAccess({ req: adminReq, exercise: systemExercise }), {
    allowed: true,
    mode: 'SYSTEM',
  });
  assert.deepEqual(getDeleteMergeAccess({ req: ownerReq, exercise: systemExercise }), {
    allowed: false,
    mode: 'SYSTEM',
  });
  assert.deepEqual(getDeleteMergeAccess({ req: ownerReq, exercise: customExercise }), {
    allowed: true,
    mode: 'CUSTOM',
  });
});

test('getDeleteMergeAccess rejects unauthorized CUSTOM, SHARED, and retired SYSTEM exercises', () => {
  const req = { session: { user: { id: 15, role: 'user' } } };
  const adminReq = { session: { user: { id: 1, role: 'admin' } } };

  assert.equal(getDeleteMergeAccess({
    req,
    exercise: { ExerciseScope: 'CUSTOM', IsSystemExercise: 0, CreatedByUserID: 14 },
  }).allowed, false);
  assert.equal(getDeleteMergeAccess({
    req: adminReq,
    exercise: { ExerciseScope: 'CUSTOM', IsSystemExercise: 0, CreatedByUserID: 14 },
  }).allowed, false);
  assert.deepEqual(getDeleteMergeAccess({
    req,
    exercise: { ExerciseScope: 'SHARED', IsSystemExercise: 0, CreatedByUserID: 15 },
  }), { allowed: false, mode: null });
  assert.deepEqual(getDeleteMergeAccess({
    req,
    exercise: {
      ExerciseScope: 'CUSTOM',
      IsSystemExercise: 1,
      IsGlobalExercise: 0,
      ExercisePublicationState: 'RESTRICTED',
      CreatedByUserID: 15,
    },
  }), { allowed: false, mode: null });
});

test('isRetiredCustomExercise requires a restricted non-system self-reference', () => {
  assert.equal(isRetiredCustomExercise({
    ExerciseID: 1200,
    SourceExerciseID: 1200,
    ExerciseScope: 'CUSTOM',
    ExercisePublicationState: 'RESTRICTED',
    IsSystemExercise: 0,
  }), true);
  assert.equal(isRetiredCustomExercise({
    ExerciseID: 1200,
    SourceExerciseID: 88,
    ExerciseScope: 'CUSTOM',
    ExercisePublicationState: 'RESTRICTED',
    IsSystemExercise: 0,
  }), false);
});

test('getMutableDependencyOwnershipImpact rejects foreign schedules or favorites', async () => {
  const responses = [
    [[{ total: 3, foreignTotal: 2 }]],
    [[{ total: 1, foreignTotal: 0 }]],
  ];
  const conn = {
    query: async () => responses.shift(),
  };

  assert.deepEqual(await getMutableDependencyOwnershipImpact({
    conn,
    exerciseId: 1024,
    ownerUserId: 14,
  }), {
    scheduledAssignments: 3,
    foreignScheduledAssignments: 2,
    favorites: 1,
    foreignFavorites: 0,
    safe: false,
  });
});

test('resolveValidatedImageExtension accepts supported extension and mime type', () => {
  assert.equal(exerciseApi.resolveValidatedImageExtension({ originalname: 'my-photo.JPEG' }), '.jpeg');
  assert.equal(exerciseApi.resolveValidatedImageExtension({ originalname: 'no-ext', mimetype: 'image/png' }), '.png');
});

test('resolveValidatedImageExtension rejects unsupported extension and mime type', () => {
  assert.throws(
    () => exerciseApi.resolveValidatedImageExtension({ originalname: 'virus.svg', mimetype: 'image/svg+xml' }),
    /Unsupported image type/i
  );
});

test('normalizeStoredImageName strips path and query metadata safely', () => {
  assert.equal(exerciseApi.normalizeStoredImageName('APP/exercise-library/917/images/exercise.jpg?v=123'), 'exercise.jpg');
  assert.equal(exerciseApi.normalizeStoredImageName('exercise-2.webp'), 'exercise-2.webp');
  assert.equal(exerciseApi.normalizeStoredImageName('APP/exercise-library/default.JPG'), '');
});

test('assignExistingImagesToSlots preserves canonical slot intent', () => {
  const slots = exerciseApi.assignExistingImagesToSlots(['exercise-2.png', 'legacy-name.jpg']);
  assert.deepEqual(slots, ['legacy-name.jpg', 'exercise-2.png']);
});

test('deleteObjectViaGateway sends a DELETE_OBJECT request for an exercise image and preserves the gateway contract', async () => {
  let called = null;

  const result = await aiGatewayService.deleteObjectViaGateway({
    storageKey: 'APP/exercise-library/906/images/exercise-123.JPG',
    appName: 'Workout-Atlas',
    env: {
      PUBLIC_GATEWAY_URL: 'https://gateway.example.test',
      TAILSCALE_GATEWAY_ENDPOINT: '/api/gateway',
      TAILSCALE_GATEWAY_HMAC_SECRET: 'super-secret',
      TAILSCALE_GATEWAY_TIMEOUT_MS: '5000',
    },
    fetchImpl: async (url, options) => {
      called = { url, options };
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ success: true, data: { success: true } }),
      };
    },
  });

  assert.equal(result.success, true);
  assert.equal(called.options.method, 'POST');
  assert.equal(JSON.parse(called.options.body).payload.action, 'DELETE_OBJECT');
  assert.equal(JSON.parse(called.options.body).payload.storageKey, 'APP/exercise-library/906/images/exercise-123.JPG');
});

test('deleteExerciseStoredMedia treats OBJECT_NOT_FOUND as already deleted and continues with remaining exercise objects', async () => {
  const calls = [];
  const result = await exerciseApi.deleteExerciseStoredMedia({
    exerciseId: 910,
    exercise: {
      ExerciseID: 910,
      PrimaryImage: '',
      ImageURL: '',
      MediaPath: 'APP/exercise-library/910/images',
      ImageGallery: '["APP/exercise-library/910/images/keep.JPG"]',
    },
    deleteObject: async ({ storageKey }) => {
      calls.push(storageKey);
      if (storageKey === 'APP/exercise-library/910/images/') {
        return {
          success: false,
          response: {
            success: false,
            error: 'OBJECT_NOT_FOUND',
            message: 'Object was not found.',
          },
        };
      }

      return {
        success: true,
        response: { success: true },
      };
    },
  });

  assert.deepEqual(calls, [
    'APP/exercise-library/910/images/',
    'APP/exercise-library/910/images/keep.JPG',
  ]);
  assert.deepEqual(result, ['APP/exercise-library/910/images/keep.JPG']);
});

test('deleteExerciseStoredMedia handles thrown OBJECT_NOT_FOUND gateway errors as already absent and still deletes remaining objects', async () => {
  const calls = [];
  const result = await exerciseApi.deleteExerciseStoredMedia({
    exerciseId: 915,
    exercise: {
      ExerciseID: 915,
      PrimaryImage: '',
      ImageURL: '',
      MediaPath: 'APP/exercise-library/915/images',
      ImageGallery: '["APP/exercise-library/915/images/clip-1.JPG"]',
    },
    deleteObject: async ({ storageKey }) => {
      calls.push(storageKey);
      if (storageKey === 'APP/exercise-library/915/images/') {
        const error = new Error('Object was not found.');
        error.gatewayErrorCode = 'OBJECT_NOT_FOUND';
        error.storageKey = storageKey;
        throw error;
      }

      return {
        success: true,
        response: { success: true },
      };
    },
  });

  assert.deepEqual(calls, [
    'APP/exercise-library/915/images/',
    'APP/exercise-library/915/images/clip-1.JPG',
  ]);
  assert.deepEqual(result, ['APP/exercise-library/915/images/clip-1.JPG']);
});

test('getExerciseRemoteDeleteTargets does not generate synthetic [] object keys from stringified empty galleries', () => {
  const targets = exerciseApi.getExerciseRemoteDeleteTargets({
    exerciseId: 915,
    exercise: {
      ExerciseID: 915,
      PrimaryImage: '',
      ImageURL: '',
      MediaPath: 'APP/exercise-library/915/images',
      ImageGallery: '[]',
    },
  });

  assert.deepEqual(targets, ['APP/exercise-library/915/images/']);
});

test('deleteExerciseStoredMedia deletes all known exercise objects for a normal personal exercise cleanup (914-style)', async () => {
  const calls = [];
  const result = await exerciseApi.deleteExerciseStoredMedia({
    exerciseId: 914,
    exercise: {
      ExerciseID: 914,
      PrimaryImage: 'clip-1.JPG',
      ImageURL: '',
      MediaPath: 'APP/exercise-library/914/images',
      ImageGallery: '["APP/exercise-library/914/images/clip-1.JPG","APP/exercise-library/914/images/clip-2.JPG"]',
    },
    deleteObject: async ({ storageKey }) => {
      calls.push(storageKey);
      return {
        success: true,
        response: { success: true },
      };
    },
  });

  assert.deepEqual(calls, [
    'APP/exercise-library/914/images/',
    'APP/exercise-library/914/images/clip-1.JPG',
    'APP/exercise-library/914/images/clip-2.JPG',
  ]);
  assert.deepEqual(result, calls);
});

test('ensureExerciseFolderMarker emits the expected remote folder marker key', async () => {
  let called = null;

  const result = await ensureExerciseFolderMarker({
    exerciseId: 906,
    putObject: async (payload) => {
      called = payload;
      return { success: true, response: { success: true } };
    },
  });

  assert.equal(result.success, true);
  assert.equal(called.storageKey, `${buildLogicalMediaPath(906)}/`);
  assert.equal(called.contentType, 'application/octet-stream');
  assert.equal(called.appName, 'Workout-Atlas');
  assert.ok(called.dataBase64 && called.dataBase64.length > 0);
});

test('ensureExerciseFolderMarker rejects gateway failure instead of reporting success', async () => {
  await assert.rejects(
    () => ensureExerciseFolderMarker({
      exerciseId: 906,
      putObject: async () => ({
        success: false,
        response: { success: false, message: 'Storage write failed' },
      }),
    }),
    /Exercise folder marker creation failed/i
  );
});

test('blank Equipment is normalized to None without images and personal ownership is preserved', () => {
  const result = normalizeExerciseCreatePayload({
    ExerciseTitle: 'USER_TEST_custom1',
    WorkoutType: 'Strength',
    RecordingType: 'Sets & Reps',
    Equipment: '',
    MuscleGroup: 'Arms: Biceps',
    Instructions: 'TEST',
    CreateAsGlobalExercise: false,
  }, {
    userId: 42,
    isAdmin: false,
  });

  assert.equal(result.Equipment, 'None');
  assert.equal(result.CreatedByUserID, 42);
  assert.equal(result.IsGlobalExercise, 0);
  assert.equal(result.createAsGlobalExercise, 0);
});

test('admin SYSTEM create payload normalizes to SYSTEM scope without owner trainer assignment', () => {
  const result = normalizeExerciseCreatePayload({
    ExerciseTitle: 'ADMIN_TEST_system',
    WorkoutType: 'Strength',
    RecordingType: 'Sets & Reps',
    Equipment: 'Barbell',
    MuscleGroup: 'Full Body',
    Instructions: 'TEST',
    ExerciseScope: 'SYSTEM',
  }, {
    userId: 7,
    isAdmin: true,
  });

  assert.equal(result.ExerciseScope, 'SYSTEM');
  assert.equal(result.OwnerTrainerID, null);
  assert.equal(result.CreatedByUserID, 7);
  assert.equal(result.IsGlobalExercise, 1);
});

test('admin legacy TRAINER_SHARED create payload normalizes to SHARED and preserves the selected trainer owner', () => {
  const result = normalizeExerciseCreatePayload({
    ExerciseTitle: 'ADMIN_TEST_trainer_shared',
    WorkoutType: 'Strength',
    RecordingType: 'Sets & Reps',
    Equipment: 'Cable',
    MuscleGroup: 'Back',
    Instructions: 'TEST',
    ExerciseScope: 'TRAINER_SHARED',
    OwnerTrainerID: 88,
  }, {
    userId: 7,
    isAdmin: true,
    role: 'admin',
  });

  assert.equal(result.ExerciseScope, 'SHARED');
  assert.equal(result.OwnerTrainerID, 88);
  assert.equal(result.CreatedByUserID, 7);
  assert.equal(result.IsGlobalExercise, 1);
  assert.equal(result.ExercisePublicationState, 'DISCOVERABLE');
});

test('normalizeExerciseSearchTerm trims and safely bounds long search input', () => {
  const longSearch = `  ${'sit'.repeat(50)}  `;
  const normalized = normalizeExerciseSearchTerm(longSearch, 12);

  assert.equal(normalized, 'sitsitsitsit');
});

test('escapeSqlLikePattern treats SQL wildcard metacharacters as literal text', () => {
  assert.equal(escapeSqlLikePattern('100%_match!'), '100!%!_match!!');
});

test('buildLiteralSubstringLikeParam preserves regex-like text literally', () => {
  assert.equal(buildLiteralSubstringLikeParam('  (?:sit).*^$[]  '), '%(?:sit).*^$[]%');
});

test('buildLiteralSubstringLikeParam preserves apostrophes, slashes, dashes, parentheses, and backslashes literally', () => {
  assert.equal(
    buildLiteralSubstringLikeParam(String.raw`  O'Brien/Sit-Up (Band)\Demo  `),
    String.raw`%o'brien/sit-up (band)\demo%`
  );
});

test('buildLiteralSubstringLikeParam returns empty for blank search text', () => {
  assert.equal(buildLiteralSubstringLikeParam('   '), '');
});

test('tokenizeExerciseSearchKeywords splits whitespace, preserves order-independence inputs, and bounds keyword count', () => {
  assert.deepEqual(tokenizeExerciseSearchKeywords('  incline   dumbbell  curl  '), ['incline', 'dumbbell', 'curl']);
  assert.equal(tokenizeExerciseSearchKeywords('one two three four five six').length, MAX_EXERCISE_SEARCH_KEYWORDS);
});

test('buildLiteralSubstringLikeParams escapes each keyword literally', () => {
  assert.deepEqual(buildLiteralSubstringLikeParams('  incline %_dumbbell  (?:curl)  '), ['%incline%', '%!%!_dumbbell%', '%(?:curl)%']);
});

test('normalizeExerciseTextField trims names, preserves literal html-like text, and enforces the live title limit', () => {
  const result = normalizeExerciseTextField({
    value: '  <script>alert(1)</script> Squat #1  ',
    fieldLabel: 'Exercise Name',
    maxLength: EXERCISE_FIELD_LIMITS.ExerciseTitle,
    required: true,
  });

  assert.equal(result.valid, true);
  assert.equal(result.value, '<script>alert(1)</script> Squat #1');
});

test('normalizeExerciseTextField rejects control characters in exercise names', () => {
  const result = normalizeExerciseTextField({
    value: 'Bad\u0007Name',
    fieldLabel: 'Exercise Name',
    maxLength: EXERCISE_FIELD_LIMITS.ExerciseTitle,
    required: true,
  });

  assert.equal(result.valid, false);
  assert.match(result.error, /unsupported control characters/i);
});

test('normalizeExerciseAllowedValue canonicalizes configured values case-insensitively', () => {
  const equipment = normalizeExerciseAllowedValue({
    value: '  dumbbell  ',
    fieldLabel: 'Equipment',
    allowedValues: ['None', 'Dumbbell', 'Barbell'],
    maxLength: EXERCISE_FIELD_LIMITS.Equipment,
    required: true,
  });

  assert.equal(equipment.valid, true);
  assert.equal(equipment.value, 'Dumbbell');
});

test('validateAndNormalizeExerciseMutationInput enforces configured type and equipment values', () => {
  const matrix = buildWorkoutTypeMuscleGroupMatrix([
    { WorkoutType: 'Strength', MuscleGroup: 'Core: Abs' },
    { WorkoutType: 'Strength', MuscleGroup: 'All' },
    { WorkoutType: 'Cardio', MuscleGroup: 'Legs: Hamstrings' },
  ]);

  const valid = validateAndNormalizeExerciseMutationInput({
    payload: {
      ExerciseTitle: "  O'Brien/Sit-Up (Band) #1  ",
      WorkoutType: 'strength',
      RecordingType: 'custom',
      MuscleGroup: 'core: abs',
      Equipment: 'none',
      Instructions: '  <b>Keep core tight.</b>  ',
    },
    matrix,
    equipmentOptions: ['None', 'Bands', 'Dumbbell'],
  });

  assert.equal(valid.valid, true);
  assert.equal(valid.values.ExerciseTitle, "O'Brien/Sit-Up (Band) #1");
  assert.equal(valid.values.WorkoutType, 'Strength');
  assert.equal(valid.values.RecordingType, 'Custom');
  assert.equal(valid.values.MuscleGroup, 'Core: Abs');
  assert.equal(valid.values.Equipment, 'None');
  assert.equal(valid.values.Instructions, '<b>Keep core tight.</b>');

  const cardioValid = validateAndNormalizeExerciseMutationInput({
    payload: {
      ExerciseTitle: 'Brisk Walking',
      WorkoutType: 'Cardio',
      RecordingType: 'Time & Distance',
      MuscleGroup: 'Cardio: General',
      Equipment: 'None',
      Instructions: 'steady pace',
    },
    matrix,
    equipmentOptions: ['None', 'Bands', 'Dumbbell'],
  });

  assert.equal(cardioValid.valid, true);
  assert.equal(cardioValid.values.MuscleGroup, 'Cardio: General');

  const invalid = validateAndNormalizeExerciseMutationInput({
    payload: {
      ExerciseTitle: 'Valid Name',
      WorkoutType: EXERCISE_ALLOWED_WORKOUT_TYPES[0],
      RecordingType: EXERCISE_ALLOWED_RECORDING_TYPES[0],
      MuscleGroup: 'Core: Abs',
      Equipment: 'Laser Sword',
      Instructions: '',
    },
    matrix,
    equipmentOptions: ['None', 'Bands', 'Dumbbell'],
  });

  assert.equal(invalid.valid, false);
  assert.match(invalid.fieldErrors.Equipment, /valid equipment/i);
});

test('fetchExercisePage uses escaped LIKE search and keeps visibility filters in the paginated query', async () => {
  const originalQuery = pool.query;
  const calls = [];

  pool.query = async (sql, params) => {
    calls.push({ sql, params });

    if (String(sql).includes('COUNT(*) AS total')) {
      return [[{ total: 1 }]];
    }

    if (String(sql).includes('SELECT DISTINCT e.WorkoutType, e.MuscleGroup, e.Equipment')) {
      return [[{ WorkoutType: 'Strength', MuscleGroup: 'Core', Equipment: 'None' }]];
    }

    return [[{
      ExerciseID: 101,
      ExerciseTitle: 'Assisted Sit-Up',
      ExerciseScope: 'SYSTEM',
      IsSystemExercise: 1,
      IsGlobalExercise: 1,
      CreatedByUserID: 1,
      OwnerTrainerID: null,
      IsFavorite: 0,
    }]];
  };

  try {
    const result = await fetchExercisePage({
      view: 'all',
      ownership: 'all',
      userId: 42,
      isAdmin: false,
      search: `  ' OR 1=1 -- %_sit  `,
      workoutType: 'All',
      muscleGroup: 'All',
      equipment: 'All',
      page: 2,
      pageSize: 10,
    });

    assert.equal(result.total, 1);
    assert.equal(result.page, 2);
    assert.equal(result.pageSize, 10);
    assert.equal(result.totalPages, 1);
    assert.equal(result.items.length, 1);

    const countCall = calls.find((call) => String(call.sql).includes('COUNT(*) AS total'));
    const selectCall = calls.find((call) => String(call.sql).includes('ORDER BY e.ExerciseTitle ASC'));

    assert.ok(countCall, 'expected count query');
    assert.ok(selectCall, 'expected select query');
    assert.match(countCall.sql, /LIKE \? ESCAPE '!'/);
    assert.match(countCall.sql, /ExerciseScope = 'SYSTEM'/);
    assert.match(countCall.sql, /CreatedByUserID/);
    assert.match(countCall.sql, /user_roles ur/);
    assert.match(countCall.sql, /user_profiles up/);
    assert.deepEqual(countCall.params, [42, 0, 42, 0, 0, 42, 42, 42, "%'%", '%or%', '%1=1%', '%--%', '%!%!_sit%']);
    assert.deepEqual(selectCall.params, [42, 0, 42, 0, 0, 42, 42, 42, "%'%", '%or%', '%1=1%', '%--%', '%!%!_sit%', 10, 10]);
  } finally {
    pool.query = originalQuery;
  }
});

test('fetchExercisePage adds one escaped LIKE clause per keyword and keeps pagination counts aligned', async () => {
  const originalQuery = pool.query;
  const calls = [];

  pool.query = async (sql, params) => {
    calls.push({ sql, params });

    if (String(sql).includes('COUNT(*) AS total')) {
      return [[{ total: 3 }]];
    }

    if (String(sql).includes('SELECT DISTINCT e.WorkoutType, e.MuscleGroup, e.Equipment')) {
      return [[{ WorkoutType: 'Strength', MuscleGroup: 'Core: Abs', Equipment: 'Dumbbell' }]];
    }

    return [[
      {
        ExerciseID: 201,
        ExerciseTitle: 'Incline Dumbbell Press',
        ExerciseScope: 'SYSTEM',
        IsSystemExercise: 1,
        IsGlobalExercise: 1,
        CreatedByUserID: 1,
        OwnerTrainerID: null,
        IsFavorite: 0,
      },
      {
        ExerciseID: 202,
        ExerciseTitle: 'Dumbbell Incline Curl',
        ExerciseScope: 'SYSTEM',
        IsSystemExercise: 1,
        IsGlobalExercise: 1,
        CreatedByUserID: 1,
        OwnerTrainerID: null,
        IsFavorite: 0,
      },
    ]];
  };

  try {
    const result = await fetchExercisePage({
      view: 'all',
      ownership: 'all',
      userId: 42,
      isAdmin: false,
      search: ' incline   dumbbell ',
      workoutType: 'All',
      muscleGroup: 'All',
      equipment: 'All',
      page: 1,
      pageSize: 2,
    });

    assert.equal(result.total, 3);
    assert.equal(result.totalPages, 2);
    assert.equal(result.items.length, 2);

    const countCall = calls.find((call) => String(call.sql).includes('COUNT(*) AS total'));
    assert.ok(countCall);
    assert.match(countCall.sql, /LIKE \? ESCAPE '!'.*LIKE \? ESCAPE '!'/);
    assert.deepEqual(countCall.params, [42, 0, 42, 0, 0, 42, 42, 42, '%incline%', '%dumbbell%']);
  } finally {
    pool.query = originalQuery;
  }
});

test('fetchExercisePage splits discoverable custom filters by creator role and preserves legacy includeCustom compatibility', async () => {
  const originalQuery = pool.query;
  const calls = [];

  pool.query = async (sql, params) => {
    calls.push({ sql: String(sql), params });

    if (String(sql).includes('COUNT(*) AS total')) {
      return [[{ total: 0 }]];
    }

    if (String(sql).includes('SELECT DISTINCT e.WorkoutType, e.MuscleGroup, e.Equipment')) {
      return [[]];
    }

    return [[]];
  };

  try {
    await fetchExercisePage({
      view: 'all',
      ownership: 'all',
      userId: 42,
      isAdmin: false,
      includeTrainerCustom: true,
      includeUserCustom: false,
      page: 1,
      pageSize: 10,
    });

    await fetchExercisePage({
      view: 'all',
      ownership: 'all',
      userId: 42,
      isAdmin: false,
      includeCustom: true,
      page: 1,
      pageSize: 10,
    });

    const countCalls = calls.filter((call) => call.sql.includes('COUNT(*) AS total'));
    assert.equal(countCalls.length, 2);
    assert.deepEqual(countCalls[0].params.slice(0, 8), [42, 0, 42, 1, 0, 42, 42, 42]);
    assert.deepEqual(countCalls[1].params.slice(0, 8), [42, 0, 42, 1, 1, 42, 42, 42]);
  } finally {
    pool.query = originalQuery;
  }
});

test('canReadExerciseForUser does not expose trainer shared exercises to clients without assignment support', () => {
  const clientReq = { session: { user: { id: 200, role: 'client' } } };
  const trainerReq = { session: { user: { id: 201, role: 'trainer' } } };
  const adminReq = { session: { user: { id: 1, role: 'admin' } } };
  const trainerSharedExercise = {
    ExerciseScope: 'TRAINER_SHARED',
    OwnerTrainerID: 201,
    CreatedByUserID: 201,
    IsSystemExercise: 0,
    IsGlobalExercise: 1,
  };

  assert.equal(canReadExerciseForUser({ req: clientReq, exercise: trainerSharedExercise }), false);
  assert.equal(canReadExerciseForUser({ req: trainerReq, exercise: trainerSharedExercise }), true);
  assert.equal(canReadExerciseForUser({ req: adminReq, exercise: trainerSharedExercise }), true);
});

test('canDeleteExercise allows administrators to delete system exercises but blocks non-admin users', () => {
  const adminReq = { session: { user: { id: 1, role: 'admin', roleSlug: 'admin' } } };
  const trainerReq = { session: { user: { id: 201, role: 'trainer', roleSlug: 'trainer' } } };
  const systemExercise = {
    ExerciseScope: 'SYSTEM',
    OwnerTrainerID: null,
    CreatedByUserID: 201,
    IsSystemExercise: 1,
    IsGlobalExercise: 1,
  };

  assert.equal(canDeleteExercise({ req: adminReq, exercise: systemExercise }), true);
  assert.equal(canDeleteExercise({ req: trainerReq, exercise: systemExercise }), false);
});

test('trainer legacy TRAINER_SHARED create payload normalizes to SHARED for their own account', () => {
  const result = normalizeExerciseCreatePayload({
    ExerciseTitle: 'TRAINER_TEST_shared',
    WorkoutType: 'Strength',
    RecordingType: 'Sets & Reps',
    Equipment: 'Cable',
    MuscleGroup: 'Back',
    Instructions: 'TEST',
    ExerciseScope: 'TRAINER_SHARED',
  }, {
    userId: 55,
    isAdmin: false,
    role: 'trainer',
  });

  assert.equal(result.ExerciseScope, 'SHARED');
  assert.equal(result.OwnerTrainerID, 55);
  assert.equal(result.CreatedByUserID, 55);
  assert.equal(result.IsGlobalExercise, 1);
  assert.equal(result.ExercisePublicationState, 'DISCOVERABLE');
});

test('admin SHARED create payload without explicit owner does not assign an unrelated trainer owner', () => {
  const result = normalizeExerciseCreatePayload({
    ExerciseTitle: 'ADMIN_TEST_shared_no_owner',
    WorkoutType: 'Strength',
    RecordingType: 'Sets & Reps',
    Equipment: 'Cable',
    MuscleGroup: 'Back',
    Instructions: 'TEST',
    ExerciseScope: 'SHARED',
  }, {
    userId: 7,
    isAdmin: true,
    role: 'admin',
  });

  assert.equal(result.ExerciseScope, 'SHARED');
  assert.equal(result.OwnerTrainerID, null);
  assert.equal(result.CreatedByUserID, 7);
  assert.equal(result.IsGlobalExercise, 1);
  assert.equal(result.ExercisePublicationState, 'DISCOVERABLE');
});

test('non-admin create payload is forced to CUSTOM even if a global scope is requested', () => {
  const result = normalizeExerciseCreatePayload({
    ExerciseTitle: 'USER_TEST_private',
    WorkoutType: 'Strength',
    RecordingType: 'Sets & Reps',
    Equipment: 'Body only',
    MuscleGroup: 'Core',
    Instructions: 'TEST',
    ExerciseScope: 'SYSTEM',
    CreateAsGlobalExercise: true,
  }, {
    userId: 42,
    isAdmin: false,
  });

  assert.equal(result.ExerciseScope, 'CUSTOM');
  assert.equal(result.OwnerTrainerID, null);
  assert.equal(result.CreatedByUserID, 42);
  assert.equal(result.IsGlobalExercise, 0);
  assert.equal(result.ExercisePublicationState, 'DISCOVERABLE');
});

test('explicit Equipment = None is preserved without images', () => {
  const result = normalizeExerciseCreatePayload({
    ExerciseTitle: 'USER_TEST_custom2',
    WorkoutType: 'Strength',
    RecordingType: 'Sets & Reps',
    Equipment: 'None',
    MuscleGroup: 'Arms: Biceps',
    Instructions: 'TEST',
    CreateAsGlobalExercise: false,
  }, {
    userId: 42,
    isAdmin: false,
  });

  assert.equal(result.Equipment, 'None');
  assert.equal(result.CreatedByUserID, 42);
  assert.equal(result.IsGlobalExercise, 0);
});

test('validation reports the missing field instead of accepting an invalid payload', () => {
  const result = validateExerciseCreatePayload({
    ExerciseTitle: 'USER_TEST_custom3',
    WorkoutType: '',
    RecordingType: 'Sets & Reps',
    Equipment: 'None',
    MuscleGroup: 'Arms: Biceps',
    Instructions: 'TEST',
  });

  assert.equal(result.valid, false);
  assert.deepEqual(result.missingFields, ['Workout Type']);
});

test('validation failure does not create a database record', async () => {
  const db = require('../db');
  const originalQuery = db.query;
  let insertCalled = false;

  db.query = async (sql) => {
    const normalizedSql = String(sql).toLowerCase();

    if (normalizedSql.includes('from information_schema.columns')) {
      return [[{ COLUMN_NAME: 'YouTubeVideoURL' }]];
    }

    if (String(sql).toLowerCase().includes('insert into exercises')) {
      insertCalled = true;
      return [{ insertId: 9999 }];
    }

    return [[]];
  };

  try {
    const router = require('../api/excerises.js');
    const routeLayer = router.stack.find((layer) => layer.route && layer.route.path === '/save-exercises');
    const handler = routeLayer.route.stack[routeLayer.route.stack.length - 1].handle;

    const req = {
      body: {
        ExerciseTitle: 'USER_TEST_custom4',
        WorkoutType: '',
        RecordingType: 'Sets & Reps',
        Equipment: 'None',
        MuscleGroup: 'Arms: Biceps',
        Instructions: 'TEST',
        CreateAsGlobalExercise: false,
      },
      session: {
        user: { id: 42, role: 'member' },
      },
      files: [],
    };

    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    };

    await handler(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(String(res.body.error || ''), /Workout Type/i);
    assert.equal(insertCalled, false);
  } finally {
    db.query = originalQuery;
  }
});

test('strength category selection defaults blank muscle group to All when supported by catalog data', () => {
  const matrix = buildWorkoutTypeMuscleGroupMatrix([
    { WorkoutType: 'Strength', MuscleGroup: 'Arms: Biceps' },
    { WorkoutType: 'Cardio', MuscleGroup: 'All' },
  ]);

  const result = validateAndNormalizeExerciseCategorySelection({
    workoutType: 'Strength',
    muscleGroup: '',
    matrix,
    allowStrengthAllDefault: true,
  });

  assert.equal(result.valid, true);
  assert.equal(result.value, 'All');
});

test('cardio category selection rejects strength-only muscle groups', () => {
  const matrix = buildWorkoutTypeMuscleGroupMatrix([
    { WorkoutType: 'Strength', MuscleGroup: 'Arms: Biceps' },
    { WorkoutType: 'Cardio', MuscleGroup: 'Legs: Quadriceps' },
  ]);

  const result = validateAndNormalizeExerciseCategorySelection({
    workoutType: 'Cardio',
    muscleGroup: 'Arms: Biceps',
    matrix,
    allowStrengthAllDefault: true,
  });

  assert.equal(result.valid, false);
});

test('favorite endpoint rejects favoriting an inaccessible private exercise', async () => {
  const db = require('../db');
  const originalQuery = db.query;
  let insertCalled = false;

  db.query = async (sql) => {
    const normalizedSql = String(sql).toLowerCase();

    if (normalizedSql.includes('from information_schema.columns') || normalizedSql.includes('from information_schema.statistics')) {
      return [[{ COLUMN_NAME: 'stub' }]];
    }

    if (normalizedSql.includes('create table if not exists user_favorite_exercises')) {
      return [{}];
    }

    if (normalizedSql.includes('select exerciseid, exercisetitle') && normalizedSql.includes('from exercises')) {
      return [[{
        ExerciseID: 931,
        ExerciseTitle: 'TEST TRAINER 1',
        CreatedByUserID: 15,
        OwnerTrainerID: 15,
        SourceExerciseID: null,
        ExerciseScope: 'PRIVATE',
        IsGlobalExercise: 0,
        IsSystemExercise: 0,
      }]];
    }

    if (normalizedSql.includes('insert into user_favorite_exercises')) {
      insertCalled = true;
      return [{}];
    }

    return [[]];
  };

  try {
    const router = require('../api/excerises.js');
    const routeLayer = router.stack.find((layer) => layer.route && layer.route.path === '/exercises/:id/favorite' && layer.route.methods.post);
    const handler = routeLayer.route.stack[routeLayer.route.stack.length - 1].handle;

    const req = {
      params: { id: '931' },
      session: {
        user: { id: 14, role: 'member', roleSlug: 'member' },
      },
    };

    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    };

    await handler(req, res);

    assert.equal(res.statusCode, 403);
    assert.match(String(res.body.error || ''), /unauthorized/i);
    assert.equal(insertCalled, false);
  } finally {
    db.query = originalQuery;
  }
});
