-- WorkoutAtlas 0.85.99
-- ExerciseScope migration - Stage 1 diagnostics (read-only)
--
-- SAFETY:
--   - This script is SELECT-only.
--   - No DDL / DML changes are executed.
--
-- PURPOSE:
--   1) Inventory current exercises ownership/global/system flags
--   2) Produce deterministic candidate scope mapping
--   3) Surface ambiguity / data-quality exceptions for manual review
--   4) Probe role and potential trainer/client relationship readiness

-- -----------------------------------------------------------------------------
-- 0) Schema capability check
-- -----------------------------------------------------------------------------
SELECT
  c.TABLE_NAME,
  c.COLUMN_NAME,
  c.COLUMN_TYPE,
  c.IS_NULLABLE,
  c.COLUMN_DEFAULT
FROM information_schema.COLUMNS c
WHERE c.TABLE_SCHEMA = DATABASE()
  AND c.TABLE_NAME = 'exercises'
  AND c.COLUMN_NAME IN (
    'ExerciseID',
    'CreatedByUserID',
    'IsGlobalExercise',
    'IsSystemExercise',
    'ExerciseTitle'
  )
ORDER BY c.ORDINAL_POSITION;

-- -----------------------------------------------------------------------------
-- 1) Current distribution of ownership and visibility flags
-- -----------------------------------------------------------------------------
SELECT
  COUNT(*) AS total_exercises,
  SUM(CASE WHEN COALESCE(IsSystemExercise, 0) = 1 THEN 1 ELSE 0 END) AS system_rows,
  SUM(CASE WHEN COALESCE(IsGlobalExercise, 1) = 1 THEN 1 ELSE 0 END) AS global_rows,
  SUM(CASE WHEN COALESCE(IsGlobalExercise, 1) = 0 THEN 1 ELSE 0 END) AS non_global_rows,
  SUM(CASE WHEN CreatedByUserID IS NULL THEN 1 ELSE 0 END) AS owner_null_rows,
  SUM(CASE WHEN CreatedByUserID IS NOT NULL THEN 1 ELSE 0 END) AS owner_present_rows
FROM exercises;

-- -----------------------------------------------------------------------------
-- 2) Deterministic candidate ExerciseScope classification
-- -----------------------------------------------------------------------------
SELECT
  CASE
    WHEN COALESCE(e.IsSystemExercise, 0) = 1 THEN 'SYSTEM'
    WHEN COALESCE(e.IsGlobalExercise, 1) = 0 THEN 'PRIVATE'
    WHEN COALESCE(e.IsGlobalExercise, 1) = 1 AND e.CreatedByUserID IS NOT NULL THEN 'TRAINER_SHARED_CANDIDATE'
    WHEN COALESCE(e.IsGlobalExercise, 1) = 1 AND e.CreatedByUserID IS NULL THEN 'SYSTEM_CANDIDATE'
    ELSE 'UNCLASSIFIED'
  END AS candidate_scope,
  COUNT(*) AS row_count
FROM exercises e
GROUP BY candidate_scope
ORDER BY candidate_scope;

-- -----------------------------------------------------------------------------
-- 3) Ambiguity and exception reports
-- -----------------------------------------------------------------------------

-- 3.a) System rows that still have owner set (policy conflict candidates)
SELECT
  e.ExerciseID,
  e.ExerciseTitle,
  e.CreatedByUserID,
  e.IsGlobalExercise,
  e.IsSystemExercise
FROM exercises e
WHERE COALESCE(e.IsSystemExercise, 0) = 1
  AND e.CreatedByUserID IS NOT NULL
ORDER BY e.ExerciseID;

-- 3.b) Non-system global rows with no owner (cannot infer trainer ownership)
SELECT
  e.ExerciseID,
  e.ExerciseTitle,
  e.CreatedByUserID,
  e.IsGlobalExercise,
  e.IsSystemExercise
FROM exercises e
WHERE COALESCE(e.IsSystemExercise, 0) = 0
  AND COALESCE(e.IsGlobalExercise, 1) = 1
  AND e.CreatedByUserID IS NULL
ORDER BY e.ExerciseID;

-- 3.c) Private rows with missing owner (data-quality violation)
SELECT
  e.ExerciseID,
  e.ExerciseTitle,
  e.CreatedByUserID,
  e.IsGlobalExercise,
  e.IsSystemExercise
FROM exercises e
WHERE COALESCE(e.IsGlobalExercise, 1) = 0
  AND e.CreatedByUserID IS NULL
ORDER BY e.ExerciseID;

-- -----------------------------------------------------------------------------
-- 4) Owner role profile for non-system global exercises
--    Helps classify TRAINER_SHARED vs SYSTEM intent by owner role.
-- -----------------------------------------------------------------------------
SELECT
  COALESCE(LOWER(TRIM(r.slug)), 'no_role_mapping') AS owner_role_slug,
  COUNT(*) AS row_count
FROM exercises e
LEFT JOIN user_roles ur
  ON ur.user_id = e.CreatedByUserID
LEFT JOIN roles r
  ON r.id = ur.role_id
WHERE COALESCE(e.IsSystemExercise, 0) = 0
  AND COALESCE(e.IsGlobalExercise, 1) = 1
GROUP BY owner_role_slug
ORDER BY row_count DESC, owner_role_slug ASC;

-- -----------------------------------------------------------------------------
-- 5) Candidate backfill preview (non-persistent)
--    Shows what Stage 2 update would write for ExerciseScope + OwnerTrainerID.
-- -----------------------------------------------------------------------------
SELECT
  e.ExerciseID,
  e.ExerciseTitle,
  e.CreatedByUserID AS current_created_by,
  COALESCE(e.IsGlobalExercise, 1) AS current_is_global,
  COALESCE(e.IsSystemExercise, 0) AS current_is_system,
  CASE
    WHEN COALESCE(e.IsSystemExercise, 0) = 1 THEN 'SYSTEM'
    WHEN COALESCE(e.IsGlobalExercise, 1) = 0 THEN 'PRIVATE'
    WHEN COALESCE(e.IsGlobalExercise, 1) = 1 AND e.CreatedByUserID IS NOT NULL THEN 'TRAINER_SHARED'
    WHEN COALESCE(e.IsGlobalExercise, 1) = 1 AND e.CreatedByUserID IS NULL THEN 'SYSTEM'
    ELSE NULL
  END AS preview_ExerciseScope,
  CASE
    WHEN COALESCE(e.IsSystemExercise, 0) = 1 THEN NULL
    WHEN COALESCE(e.IsGlobalExercise, 1) = 0 THEN e.CreatedByUserID
    WHEN COALESCE(e.IsGlobalExercise, 1) = 1 AND e.CreatedByUserID IS NOT NULL THEN e.CreatedByUserID
    WHEN COALESCE(e.IsGlobalExercise, 1) = 1 AND e.CreatedByUserID IS NULL THEN NULL
    ELSE NULL
  END AS preview_OwnerTrainerID
FROM exercises e
ORDER BY e.ExerciseID;

-- -----------------------------------------------------------------------------
-- 6) Assignment dependency readiness checks
-- -----------------------------------------------------------------------------

-- 6.a) Verify role tables exist and contain trainer/admin slugs
SELECT
  t.table_name,
  t.engine,
  t.table_rows
FROM information_schema.TABLES t
WHERE t.TABLE_SCHEMA = DATABASE()
  AND t.TABLE_NAME IN ('users', 'roles', 'user_roles')
ORDER BY t.TABLE_NAME;

SELECT
  LOWER(TRIM(slug)) AS role_slug,
  COUNT(*) AS role_count
FROM roles
GROUP BY LOWER(TRIM(slug))
HAVING role_slug IN ('admin', 'administrator', 'trainer', 'member')
ORDER BY role_slug;

-- 6.b) Detect existing trainer-client relationship candidates in current DB
SELECT
  c.TABLE_NAME,
  c.COLUMN_NAME,
  c.COLUMN_TYPE
FROM information_schema.COLUMNS c
WHERE c.TABLE_SCHEMA = DATABASE()
  AND (
    LOWER(c.TABLE_NAME) LIKE '%trainer%'
    OR LOWER(c.TABLE_NAME) LIKE '%client%'
    OR LOWER(c.COLUMN_NAME) LIKE '%trainer%'
    OR LOWER(c.COLUMN_NAME) LIKE '%client%'
    OR LOWER(c.COLUMN_NAME) LIKE '%assigned%'
  )
ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION;

-- -----------------------------------------------------------------------------
-- 7) Exercise usage impact counts (for migration risk sizing)
-- -----------------------------------------------------------------------------
SELECT
  (SELECT COUNT(*) FROM user_favorite_exercises) AS favorite_links,
  (SELECT COUNT(*) FROM workout_schedule_exercises WHERE exercise_id IS NOT NULL) AS schedule_links,
  (SELECT COUNT(*) FROM workout_log WHERE ExerciseID IS NOT NULL) AS workout_log_links;

SELECT
  e.ExerciseID,
  e.ExerciseTitle,
  COUNT(DISTINCT ufe.id) AS favorite_count,
  COUNT(DISTINCT wse.id) AS schedule_count,
  COUNT(DISTINCT wl.WorkoutLogID) AS workout_log_count
FROM exercises e
LEFT JOIN user_favorite_exercises ufe
  ON ufe.exercise_id = e.ExerciseID
LEFT JOIN workout_schedule_exercises wse
  ON wse.exercise_id = e.ExerciseID
LEFT JOIN workout_log wl
  ON wl.ExerciseID = e.ExerciseID
GROUP BY e.ExerciseID, e.ExerciseTitle
ORDER BY workout_log_count DESC, schedule_count DESC, favorite_count DESC, e.ExerciseID ASC;
