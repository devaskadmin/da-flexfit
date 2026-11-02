const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getWorkoutPlanCoverRow,
  canManageWorkoutPlanCover,
  canReadWorkoutPlanCover,
  uploadWorkoutPlanCover,
  cloneWorkoutPlanCoverToPlan,
  deleteWorkoutPlanCover,
  resolveCanonicalCoverStorageKeyForPlan,
  getWorkoutPlanCoverPlaceholderDescriptor,
  getWorkoutPlanCoverDescriptor,
  assertValidWorkoutPlanCoverFile,
} = require('../services/workoutPlanCoverService');

function createPoolMock(queryImpl) {
  return {
    query: queryImpl,
  };
}

function createReq(userId, roleSlug = '') {
  return {
    session: {
      user: {
        id: userId,
        roleSlug,
      },
    },
  };
}

function createImageFile(overrides = {}) {
  return {
    originalname: 'cover.jpg',
    mimetype: 'image/jpeg',
    size: 256,
    buffer: Buffer.from('fake-image-data'),
    ...overrides,
  };
}

test('successful upload stores canonical key and metadata after gateway success', async () => {
  const putCalls = [];
  const updateCalls = [];

  const pool = createPoolMock(async (sql, params) => {
    if (String(sql).includes('UPDATE workout_schedules')) {
      updateCalls.push({ sql, params });
      return [{ affectedRows: 1 }];
    }
    throw new Error('Unexpected query during upload test');
  });

  const result = await uploadWorkoutPlanCover({
    req: createReq(10),
    pool,
    plan: {
      id: 42,
      user_id: 10,
      workout_plan_type: null,
    },
    file: createImageFile(),
    putObject: async (payload) => {
      putCalls.push(payload);
      return { success: true };
    },
  });

  assert.equal(putCalls.length, 1);
  assert.equal(putCalls[0].storageKey, 'APP/workout-plans/42/images/cover.jpg');
  assert.equal(putCalls[0].contentType, 'image/jpeg');
  assert.equal(updateCalls.length, 1);
  assert.equal(updateCalls[0].params[0], 'APP/workout-plans/42/images/cover.jpg');
  assert.equal(updateCalls[0].params[1], 'image/jpeg');
  assert.equal(result.storageKey, 'APP/workout-plans/42/images/cover.jpg');
});

test('failed gateway upload does not update workout_schedules cover metadata', async () => {
  let updateAttempted = false;

  const pool = createPoolMock(async (sql) => {
    if (String(sql).includes('UPDATE workout_schedules')) {
      updateAttempted = true;
    }
    return [{ affectedRows: 1 }];
  });

  await assert.rejects(
    () => uploadWorkoutPlanCover({
      req: createReq(10),
      pool,
      plan: {
        id: 42,
        user_id: 10,
        workout_plan_type: null,
      },
      file: createImageFile(),
      putObject: async () => {
        const error = new Error('Gateway HTTP 500');
        error.statusCode = 502;
        throw error;
      },
    }),
    /Gateway HTTP 500/i
  );

  assert.equal(updateAttempted, false);
});

test('replacement upload uses same canonical storage key', async () => {
  const calls = [];

  const pool = createPoolMock(async (sql, params) => {
    if (String(sql).includes('UPDATE workout_schedules')) {
      calls.push(params[0]);
      return [{ affectedRows: 1 }];
    }
    throw new Error('Unexpected query during replacement upload test');
  });

  const existingPlan = {
    id: 42,
    user_id: 10,
    workout_plan_type: null,
    cover_image_storage_key: 'APP/workout-plans/42/images/cover.jpg',
  };

  await uploadWorkoutPlanCover({
    req: createReq(10),
    pool,
    plan: existingPlan,
    file: createImageFile({ mimetype: 'image/png' }),
    putObject: async () => ({ success: true }),
  });

  assert.deepEqual(calls, ['APP/workout-plans/42/images/cover.jpg']);
});

test('successful deletion clears metadata only after storage delete succeeds', async () => {
  const queryCalls = [];

  const pool = createPoolMock(async (sql, params) => {
    queryCalls.push({ sql, params });
    if (String(sql).includes('UPDATE workout_schedules')) {
      return [{ affectedRows: 1 }];
    }
    throw new Error('Unexpected query during deletion test');
  });

  const deleteCalls = [];
  const result = await deleteWorkoutPlanCover({
    pool,
    plan: {
      id: 88,
      user_id: 10,
      cover_image_storage_key: 'APP/workout-plans/88/images/cover.jpg',
    },
    deleteObject: async (payload) => {
      deleteCalls.push(payload);
      return { success: true };
    },
  });

  assert.equal(deleteCalls.length, 1);
  assert.equal(deleteCalls[0].storageKey, 'APP/workout-plans/88/images/cover.jpg');
  assert.equal(queryCalls.length, 1);
  assert.equal(result.deleted, true);
});

test('failed gateway deletion preserves existing metadata (no clear update)', async () => {
  let cleared = false;

  const pool = createPoolMock(async (sql) => {
    if (String(sql).includes('UPDATE workout_schedules')) {
      cleared = true;
    }
    return [{ affectedRows: 1 }];
  });

  await assert.rejects(
    () => deleteWorkoutPlanCover({
      pool,
      plan: {
        id: 88,
        user_id: 10,
        cover_image_storage_key: 'APP/workout-plans/88/images/cover.jpg',
      },
      deleteObject: async () => {
        const err = new Error('Delete failed');
        err.statusCode = 502;
        throw err;
      },
    }),
    /Delete failed/i
  );

  assert.equal(cleared, false);
});

test('invalid plan id is rejected', async () => {
  const pool = createPoolMock(async () => [[{ dummy: true }]]);
  await assert.rejects(() => getWorkoutPlanCoverRow(pool, 0), /positive integer/i);
});

test('invalid image type is rejected', () => {
  assert.throws(
    () => assertValidWorkoutPlanCoverFile(createImageFile({ mimetype: 'image/svg+xml' })),
    /Unsupported image type/i
  );
});

test('unauthorized access is blocked for personal plan mutation and trainer cross-plan mutation', async () => {
  const pool = createPoolMock(async (sql, params = []) => {
    if (String(sql).includes('FROM user_roles')) {
      const roleCandidates = params.slice(1).map((value) => String(value || '').trim().toLowerCase());
      if (roleCandidates.includes('trainer')) {
        return [[{ role: 'trainer' }]];
      }
      return [[]];
    }
    throw new Error('Unexpected query during authorization test');
  });

  const personalDenied = await canManageWorkoutPlanCover({
    req: createReq(111),
    pool,
    plan: {
      id: 7,
      user_id: 222,
      workout_plan_type: null,
    },
  });

  assert.equal(personalDenied.ok, false);
  assert.equal(personalDenied.statusCode, 404);

  const trainerDenied = await canManageWorkoutPlanCover({
    req: createReq(111),
    pool,
    plan: {
      id: 7,
      user_id: 222,
      workout_plan_type: 'global',
    },
  });

  assert.equal(trainerDenied.ok, false);
  assert.equal(trainerDenied.statusCode, 403);
});

test('missing cover returns placeholder descriptor and cross-plan canonical keys are rejected', () => {
  const placeholder = getWorkoutPlanCoverPlaceholderDescriptor();
  assert.equal(placeholder.mediaPath, 'APP/workout-plans');
  assert.equal(placeholder.imageName, 'default.JPG');

  const planCover = getWorkoutPlanCoverDescriptor(42);
  assert.equal(planCover.mediaPath, 'APP/workout-plans/42/images');

  assert.throws(
    () => resolveCanonicalCoverStorageKeyForPlan(42, 'APP/workout-plans/43/images/cover.jpg'),
    /canonical key/i
  );
});

test('draft and archived global plans are not readable by unauthorized users', async () => {
  const pool = createPoolMock(async (sql) => {
    if (String(sql).includes('FROM user_roles')) {
      return [[]];
    }
    throw new Error('Unexpected query during read authorization test');
  });

  const draftRead = await canReadWorkoutPlanCover({
    req: createReq(99),
    pool,
    plan: {
      id: 99,
      user_id: 11,
      workout_plan_type: 'global',
      status: 'draft',
      visibility: 'private',
    },
  });

  assert.equal(draftRead.ok, false);
  assert.equal(draftRead.statusCode, 404);

  const archivedRead = await canReadWorkoutPlanCover({
    req: createReq(99),
    pool,
    plan: {
      id: 99,
      user_id: 11,
      workout_plan_type: 'global',
      status: 'archived',
      visibility: 'public',
    },
  });

  assert.equal(archivedRead.ok, false);
  assert.equal(archivedRead.statusCode, 404);
});

test('cloneWorkoutPlanCoverToPlan copies source bytes into destination canonical key and saves destination metadata', async () => {
  const fetchCalls = [];
  const putCalls = [];
  const updateCalls = [];

  const pool = createPoolMock(async (sql, params) => {
    if (String(sql).includes('UPDATE workout_schedules')) {
      updateCalls.push({ sql, params });
      return [{ affectedRows: 1 }];
    }
    throw new Error('Unexpected query during clone cover test');
  });

  const result = await cloneWorkoutPlanCoverToPlan({
    pool,
    sourcePlan: {
      id: 12,
      cover_image_storage_key: 'APP/workout-plans/12/images/cover.jpg',
      cover_image_content_type: 'image/webp',
    },
    destinationPlanId: 77,
    fetchObject: async (payload) => {
      fetchCalls.push(payload);
      return {
        contentType: 'image/jpeg',
        dataBase64: Buffer.from('copied-cover').toString('base64'),
      };
    },
    putObject: async (payload) => {
      putCalls.push(payload);
      return { success: true };
    },
  });

  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].storageKey, 'APP/workout-plans/12/images/cover.jpg');
  assert.equal(putCalls.length, 1);
  assert.equal(putCalls[0].storageKey, 'APP/workout-plans/77/images/cover.jpg');
  assert.equal(putCalls[0].contentType, 'image/webp');
  assert.equal(updateCalls.length, 1);
  assert.equal(updateCalls[0].params[0], 'APP/workout-plans/77/images/cover.jpg');
  assert.equal(updateCalls[0].params[1], 'image/webp');
  assert.equal(result.copied, true);
  assert.equal(result.sourceStorageKey, 'APP/workout-plans/12/images/cover.jpg');
  assert.equal(result.destinationStorageKey, 'APP/workout-plans/77/images/cover.jpg');
});

test('cloneWorkoutPlanCoverToPlan no-ops when source has no cover metadata', async () => {
  let fetchCalled = false;
  let putCalled = false;

  const pool = createPoolMock(async () => {
    throw new Error('Metadata update should not run for no-op clone');
  });

  const result = await cloneWorkoutPlanCoverToPlan({
    pool,
    sourcePlan: {
      id: 12,
      cover_image_storage_key: '',
      cover_image_content_type: null,
    },
    destinationPlanId: 77,
    fetchObject: async () => {
      fetchCalled = true;
      return { contentType: 'image/jpeg', dataBase64: 'ignored' };
    },
    putObject: async () => {
      putCalled = true;
      return { success: true };
    },
  });

  assert.equal(fetchCalled, false);
  assert.equal(putCalled, false);
  assert.equal(result.copied, false);
  assert.equal(result.hadSourceCover, false);
});
