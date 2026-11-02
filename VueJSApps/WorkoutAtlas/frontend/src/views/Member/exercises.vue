<script setup>
   //Import libaries
  import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from "vue";
  import { useRoute } from 'vue-router';
   import DateDropDown from "@/components/DropDownDate.vue"; // not template folder
  import { API_BASE } from '@/config/env';
  import { DEFAULT_EXERCISE_IMAGE, getExerciseImage, isDefaultExerciseImageReference } from '@/utils/exerciseImage';
  import { useExerciseFiltering } from '@/composable/exerciseFilters';
   import '@fortawesome/fontawesome-free/css/all.min.css';

  const route = useRoute();
  const allExercises = ref([]);
   const searchExerciseRows = ref([]);
  const searchResultTotal = ref(0);
  const searchTotalPages = ref(0);
  const searchFilterOptions = ref({ muscleGroups: [], equipment: [] });
  const logLibraryLoaded = ref(false);
   const selectedExercise = ref(null);
   const workoutType = ref("All");
   const selectedMuscleGroup = ref("All");
   const selectedEquipment = ref("All");
  const showMyExercisesOnly = ref(false);
  const showTrainerCustomExercises = ref(false);
  const showUserCustomExercises = ref(false);
   const searchExercise = ref("");
   const workoutList = ref([]);
   const activeTab = ref('search-exercises'); // default tab
  const filtersOpen = ref(false);
   const existingLogs = ref([]);
  const exercisesLoadError = ref("");
  const exerciseView = ref('all');
  const favoriteExerciseIds = ref(new Set());
  const favoriteExercises = ref([]);
  const loadingFavorites = ref(false);
  const favoritesLoadError = ref("");
  const myCustomExercises = ref([]);
  const customExercisesLoadError = ref('');
  const showAdminGlobalExercises = ref(false);
  const trainerOwnerOptions = ref([]);
  const trainerOwnerOptionsLoading = ref(false);
  const trainerOwnerOptionsError = ref('');
  const currentUserRole = ref('');
  const logSearchExercise = ref('');
  const logWorkoutTypeFilter = ref('All');
  const logMuscleGroupFilter = ref('All');
  const logEquipmentFilter = ref('All');
  const logOwnershipFilter = ref('all');
  const logSuggestionIndex = ref(-1);
  const EXERCISE_FIELD_LIMITS = Object.freeze({
    ExerciseTitle: 100,
    WorkoutType: 50,
    RecordingType: 50,
    MuscleGroup: 50,
    Equipment: 50,
    Instructions: 65535,
    YouTubeVideoURL: 255,
  });
  const YOUTUBE_VIDEO_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;
  const YOUTUBE_ALLOWED_HOSTS = new Set([
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'youtu.be',
    'www.youtu.be',
  ]);
   
   
   
   const exercise = reactive({
     sets: "",
     reps: "",
     weight: "",
     duration: "",
     ImageGallery: "[]", // fallback
   });

   // Edit Exercise state (move this up so it's always in scope)
   const editExercise = reactive({
     ExerciseID: '',
     ExerciseTitle: '',
     MuscleGroup: '',
     Equipment: '',
     WorkoutType: '',
     RecordingType: '',
     Instructions: '',
    YouTubeVideoURL: '',
    ImageGallery: '[]',
    ExerciseScope: 'CUSTOM',
    ExercisePublicationState: 'DISCOVERABLE',
    OwnerTrainerID: '',
    CreateAsGlobalExercise: false,
    CanDelete: 0,
    CanEdit: 0,
   });

   // Error and success state for edit form
   const updateError = ref('');
   const updateSuccess = ref('');
   const isSaving = ref(false);
   const editExerciseSnapshot = ref(null);
  const editExerciseWasLegacyPrivate = ref(false);
   const deleteConfirmState = ref({
     visible: false,
     exercise: null,
     isSubmitting: false,
     error: '',
   });
   const deleteSuccessState = ref({
     visible: false,
     title: 'Exercise Deleted',
     message: 'The exercise was deleted successfully.',
      isGlobal: false,
   });
  const isAdminUser = computed(() => {
    const normalized = String(currentUserRole.value || '').trim().toLowerCase();
    return normalized === 'admin' || normalized === 'administrator';
  });
  const isTrainerUser = computed(() => String(currentUserRole.value || '').trim().toLowerCase() === 'trainer');
  const EXERCISE_SCOPE = Object.freeze({
    SYSTEM: 'SYSTEM',
    SHARED: 'SHARED',
    CUSTOM: 'CUSTOM',
  });
  const EXERCISE_PUBLICATION = Object.freeze({
    DISCOVERABLE: 'DISCOVERABLE',
    RESTRICTED: 'RESTRICTED',
  });
  const LEGACY_SCOPE = Object.freeze({
    TRAINER_SHARED: 'TRAINER_SHARED',
    PRIVATE: 'PRIVATE',
  });
  const canChooseScope = computed(() => true);

  const normalizeExercisePublicationState = (value) => {
    const normalized = String(value || '').trim().toUpperCase();
    if (normalized === EXERCISE_PUBLICATION.DISCOVERABLE || normalized === EXERCISE_PUBLICATION.RESTRICTED) {
      return normalized;
    }
    return '';
  };

  const normalizeExerciseScopeValue = (value) => {
    const normalized = String(value || '').trim().toUpperCase();
    if (!normalized) return EXERCISE_SCOPE.CUSTOM;
    if (normalized === EXERCISE_SCOPE.SYSTEM) return EXERCISE_SCOPE.SYSTEM;
    if (normalized === EXERCISE_SCOPE.SHARED || normalized === LEGACY_SCOPE.TRAINER_SHARED) return EXERCISE_SCOPE.SHARED;
    if (normalized === EXERCISE_SCOPE.CUSTOM || normalized === LEGACY_SCOPE.PRIVATE) return EXERCISE_SCOPE.CUSTOM;
    return EXERCISE_SCOPE.CUSTOM;
  };

  const isLegacyPrivateScope = (value) => String(value || '').trim().toUpperCase() === LEGACY_SCOPE.PRIVATE;

  const deriveCreatePublicationState = (scopeValue) => {
    const scope = normalizeExerciseScopeValue(scopeValue);
    if (scope === EXERCISE_SCOPE.SYSTEM || scope === EXERCISE_SCOPE.SHARED) {
      return EXERCISE_PUBLICATION.DISCOVERABLE;
    }
    return EXERCISE_PUBLICATION.DISCOVERABLE;
  };

  const deriveEditPublicationState = (scopeValue, exerciseModel = {}) => {
    const scope = normalizeExerciseScopeValue(scopeValue);
    if (scope === EXERCISE_SCOPE.SYSTEM || scope === EXERCISE_SCOPE.SHARED) {
      return EXERCISE_PUBLICATION.DISCOVERABLE;
    }

    const publicationFromModel = normalizeExercisePublicationState(exerciseModel?.ExercisePublicationState);
    if (publicationFromModel === EXERCISE_PUBLICATION.RESTRICTED) {
      return EXERCISE_PUBLICATION.RESTRICTED;
    }
    if (!publicationFromModel && Number(exerciseModel?.ExerciseID || 0) > 0) {
      return EXERCISE_PUBLICATION.RESTRICTED;
    }

    if (editExerciseWasLegacyPrivate.value) {
      return EXERCISE_PUBLICATION.RESTRICTED;
    }

    return EXERCISE_PUBLICATION.DISCOVERABLE;
  };

  const exerciseScopeOptions = computed(() => {
    if (isAdminUser.value) {
      return [
        { value: EXERCISE_SCOPE.SYSTEM, label: 'System Exercise' },
        { value: EXERCISE_SCOPE.SHARED, label: 'Shared Exercise' },
        { value: EXERCISE_SCOPE.CUSTOM, label: 'Custom Exercise' },
      ];
    }

    if (isTrainerUser.value) {
      return [
        { value: EXERCISE_SCOPE.SHARED, label: 'Shared Exercise' },
        { value: EXERCISE_SCOPE.CUSTOM, label: 'Custom Exercise' },
      ];
    }

    return [
      { value: EXERCISE_SCOPE.CUSTOM, label: 'Custom Exercise' },
    ];
  });
  const selectedExerciseScope = computed({
    get: () => normalizeExerciseScopeValue(newExercise.ExerciseScope),
    set: (value) => {
      const normalized = normalizeExerciseScopeValue(value);
      newExercise.ExerciseScope = normalized;
      if (newExercise.ExerciseScope === EXERCISE_SCOPE.SYSTEM) {
        newExercise.CreateAsGlobalExercise = true;
        newExercise.OwnerTrainerID = '';
      } else if (newExercise.ExerciseScope === EXERCISE_SCOPE.SHARED) {
        newExercise.CreateAsGlobalExercise = true;
        newExercise.OwnerTrainerID = isAdminUser.value ? (trainerOwnerOptions.value[0]?.id || '') : Number(userId.value || 0) || '';
      } else {
        newExercise.CreateAsGlobalExercise = false;
      }
      newExercise.ExercisePublicationState = deriveCreatePublicationState(newExercise.ExerciseScope);
    },
  });
  const selectedEditExerciseScope = computed({
    get: () => normalizeExerciseScopeValue(editExercise.ExerciseScope),
    set: (value) => {
      const normalized = normalizeExerciseScopeValue(value);
      editExercise.ExerciseScope = normalized;
      if (editExercise.ExerciseScope === EXERCISE_SCOPE.SYSTEM) {
        editExercise.CreateAsGlobalExercise = true;
        editExercise.OwnerTrainerID = '';
      } else if (editExercise.ExerciseScope === EXERCISE_SCOPE.SHARED) {
        editExercise.CreateAsGlobalExercise = true;
        if (!editExercise.OwnerTrainerID) {
          editExercise.OwnerTrainerID = isAdminUser.value ? (trainerOwnerOptions.value[0]?.id || '') : Number(userId.value || 0) || '';
        }
      } else {
        editExercise.CreateAsGlobalExercise = false;
      }
      editExercise.ExercisePublicationState = deriveEditPublicationState(editExercise.ExerciseScope, editExercise);
    },
  });
  const canEditExercise = (exercise = {}) => {
    if (isAdminUser.value) return true;
    if (Number(exercise?.IsSystemExercise ?? 0) === 1) return false;
    return Number(exercise?.CanEdit ?? 0) === 1;
  };
  const canDeleteExerciseFromUi = (exercise = {}) => {
    if (!exercise?.ExerciseID) return false;
    if (isAdminUser.value) return true;
    if (Number(exercise?.IsSystemExercise ?? 0) === 1) return false;
    return Number(exercise?.CanDelete ?? 0) === 1;
  };
  const isWorkoutLogView = computed(() => route.name === 'workouts' || route.path === '/workouts' || route.path === '/workout-log');
  const isExercisesView = computed(() => route.name === 'exercises' || route.path === '/exercises');

  const normalizeExerciseScope = (exercise = {}) => {
    const explicitScope = String(exercise?.ExerciseScope || '').trim().toUpperCase();
    if (explicitScope) return normalizeExerciseScopeValue(explicitScope);

    if (Number(exercise?.IsSystemExercise ?? 0) === 1) return EXERCISE_SCOPE.SYSTEM;
    if (Number(exercise?.IsGlobalExercise ?? 0) === 1) return EXERCISE_SCOPE.SHARED;
    return EXERCISE_SCOPE.CUSTOM;
  };

  const getScopeLabel = (exercise = {}) => {
    const scope = normalizeExerciseScope(exercise);
    if (scope === EXERCISE_SCOPE.SYSTEM) return 'System Exercise';
    if (scope === EXERCISE_SCOPE.SHARED) return 'Shared Exercise';
    return 'Custom Exercise';
  };

  const resolveTrainerOwnerId = (exercise = {}) => {
    const ownerId = Number(exercise?.OwnerTrainerID || 0);
    return ownerId > 0 ? ownerId : 0;
  };

  const normalizeTrainerOption = (member = {}) => ({
    id: Number(member?.id || member?.userId || 0),
    label: [member?.FirstName, member?.LastName].filter(Boolean).join(' ').trim() || member?.username || member?.displayName || `Trainer ${member?.id || ''}`,
    role: String(member?.user_role || member?.roleSlug || member?.role || '').trim().toLowerCase(),
  });

  const loadTrainerOwnerOptions = async () => {
    if (!isAdminUser.value) return;
    trainerOwnerOptionsLoading.value = true;
    trainerOwnerOptionsError.value = '';
    try {
      const res = await fetch(`${API_BASE}/api/admin/members?page=1&limit=500`, { credentials: 'include' });
      if (!res.ok) {
        throw new Error(`Failed to load trainer owners (${res.status})`);
      }

      const data = await res.json();
      const rows = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      trainerOwnerOptions.value = rows
        .map(normalizeTrainerOption)
        .filter((member) => member.id > 0 && member.role === 'trainer')
        .sort((left, right) => String(left.label).localeCompare(String(right.label)));
    } catch (err) {
      console.error('Failed to load trainer owners:', err);
      trainerOwnerOptions.value = [];
      trainerOwnerOptionsError.value = 'Unable to load trainer accounts right now.';
    } finally {
      trainerOwnerOptionsLoading.value = false;
    }
  };
   
   // ---- FILTER EXERCISES ----
   const logFilters = computed(() => ({
    search: logSearchExercise.value,
    workoutType: logWorkoutTypeFilter.value,
    muscleGroup: logMuscleGroupFilter.value,
    equipment: logEquipmentFilter.value,
    ownership: logOwnershipFilter.value,
   }));

  const filteredExercises = computed(() => searchExerciseRows.value);

  const normalizeOptionLabel = (value) => String(value || '').trim();
  const normalizeOptionKey = (value) => normalizeOptionLabel(value).toLowerCase();
  const CARDIO_MUSCLE_GROUP_OPTIONS = Object.freeze([
    'Core: Abs',
    'Legs: Calves',
    'Legs: Quadriceps',
    'Cardio: Full Body',
    'Cardio: General',
    'Legs: Hamstrings',
    'Legs: Glutes',
    'Legs: Full Lower Body',
    'Upper Body: Arms',
    'Upper Body: Back',
  ]);

  const workoutTypeMuscleGroupMap = computed(() => {
    const scopedMap = new Map();
    const sourceRows = Array.isArray(allExercises.value) ? allExercises.value : [];

    sourceRows.forEach((exerciseRow) => {
      const workoutTypeLabel = normalizeOptionLabel(exerciseRow?.WorkoutType);
      const muscleGroupLabel = normalizeOptionLabel(exerciseRow?.MuscleGroup);
      if (!workoutTypeLabel || !muscleGroupLabel) return;

      const workoutTypeKey = normalizeOptionKey(workoutTypeLabel);
      if (!scopedMap.has(workoutTypeKey)) {
        scopedMap.set(workoutTypeKey, new Map());
      }

      scopedMap.get(workoutTypeKey).set(normalizeOptionKey(muscleGroupLabel), muscleGroupLabel);
    });

    const cardioKey = normalizeOptionKey('Cardio');
    if (!scopedMap.has(cardioKey)) {
      scopedMap.set(cardioKey, new Map());
    }

    const cardioGroups = scopedMap.get(cardioKey);
    CARDIO_MUSCLE_GROUP_OPTIONS.forEach((label) => {
      cardioGroups.set(normalizeOptionKey(label), label);
    });

    return scopedMap;
  });

  const supportsMuscleGroupAll = computed(() => {
    for (const scopedGroups of workoutTypeMuscleGroupMap.value.values()) {
      if (scopedGroups.has('all')) {
        return true;
      }
    }
    return false;
  });

  const getMuscleGroupOptionsForWorkoutType = (workoutTypeValue, { preserveValue = '', allowStrengthAll = true } = {}) => {
    const workoutTypeKey = normalizeOptionKey(workoutTypeValue);
    const scopedGroups = workoutTypeMuscleGroupMap.value.get(workoutTypeKey);
    const options = scopedGroups ? [...scopedGroups.values()] : [];

    options.sort((left, right) => String(left).localeCompare(String(right)));

    if (workoutTypeKey === 'strength' && allowStrengthAll && supportsMuscleGroupAll.value && !options.some((value) => normalizeOptionKey(value) === 'all')) {
      options.unshift('All');
    }

    const preservedLabel = normalizeOptionLabel(preserveValue);
    if (preservedLabel && !options.some((value) => normalizeOptionKey(value) === normalizeOptionKey(preservedLabel))) {
      options.unshift(preservedLabel);
    }

    return options;
  };

  const isMuscleGroupValidForWorkoutType = (workoutTypeValue, muscleGroupValue, options = null) => {
    const muscleGroupKey = normalizeOptionKey(muscleGroupValue);
    if (!muscleGroupKey) return false;
    const candidateOptions = Array.isArray(options)
      ? options
      : getMuscleGroupOptionsForWorkoutType(workoutTypeValue, { allowStrengthAll: true });
    return candidateOptions.some((value) => normalizeOptionKey(value) === muscleGroupKey);
  };

  const applyMuscleGroupSelectionForWorkoutType = (exerciseModel, { preserveLegacyValue = false } = {}) => {
    if (!exerciseModel) return;

    const availableOptions = getMuscleGroupOptionsForWorkoutType(exerciseModel.WorkoutType, {
      preserveValue: preserveLegacyValue ? exerciseModel.MuscleGroup : '',
      allowStrengthAll: true,
    });

    if (isMuscleGroupValidForWorkoutType(exerciseModel.WorkoutType, exerciseModel.MuscleGroup, availableOptions)) {
      return;
    }

    if (normalizeOptionKey(exerciseModel.WorkoutType) === 'strength' && supportsMuscleGroupAll.value) {
      exerciseModel.MuscleGroup = 'All';
      return;
    }

    exerciseModel.MuscleGroup = availableOptions[0] || '';
  };

   const filteredLogExercises = useExerciseFiltering({
    rowsRef: allExercises,
    filtersRef: logFilters,
   });

   const logExerciseMatches = computed(() => filteredLogExercises.value.slice(0, 8));

   
   // ---- GET MUSCLE GROUPS + EQUIPMENT ----
   const muscleGroups = computed(() => {
     const groups = Array.from(new Set([
       ...searchFilterOptions.value.muscleGroups,
       ...allExercises.value.map(ex => ex.MuscleGroup),
     ].filter(Boolean)));
     groups.sort((a, b) => {
       if (a === null || a === undefined) return 1;
       if (b === null || b === undefined) return -1;
       return a.localeCompare(b);
     });
     return ["All", ...groups];
   });
   const equipmentList = computed(() => {
     const groups = new Set([
       ...searchFilterOptions.value.equipment,
       ...allExercises.value.map(ex => ex.Equipment),
     ].filter(Boolean));
     return ["All", ...groups];
   });
   // ---- GET MUSCLE GROUPS + EQUIPMENT ----
   
   // ---- IMAGE GALLERY FOR EXCERCISE ---
   const updateGallery = () => {
     const match = allExercises.value.find(
       (ex) => ex.ExerciseTitle === selectedExercise.value &&
         (workoutType.value === 'All' || ex.WorkoutType?.toLowerCase() === workoutType.value.toLowerCase())
     );
     if (match) {
       exercise.ImageGallery = match.ImageGallery || "[]";
     } else {
       exercise.ImageGallery = "[]";
     }
   };

   watch(selectedExercise, updateGallery);
   watch(workoutType, updateGallery);
   
   const galleryImages = computed(() => {
     try {
       return typeof exercise.ImageGallery === "string"
         ? JSON.parse(exercise.ImageGallery)
         : exercise.ImageGallery;
     } catch {
       return [];
     }
   });
   // ---- IMAGE GALLERY FOR EXCERCISE ---
   
   // ---- ADD EXERCISE ----
   const addError = ref("");


   const addExercise = () => {
  addError.value = ""; // Reset error
  // If timer is running, stop it
  if (stopwatchRunning.value) {
    clearInterval(stopwatchInterval);
    stopwatchRunning.value = false;
  }

  // Get the selected exercise object
  const selectedExObj = selectedExerciseDetails.value;
  const selectedType = selectedExObj?.WorkoutType || workoutType.value;
  const normalizedRecordingType = String(selectedExObj?.RecordingType || '').trim().toLowerCase();
  const allowSetsAndReps = normalizedRecordingType === 'sets & reps' || normalizedRecordingType === 'custom' || (!normalizedRecordingType && selectedType === 'Strength');
  const allowTimeDistance = normalizedRecordingType === 'time & distance' || normalizedRecordingType === 'custom' || (!normalizedRecordingType && selectedType !== 'Strength');

  // Duration logic
  let duration = 0;
  if (allowTimeDistance) {
    if (typeof exercise.duration !== 'number' || exercise.duration <= 0) {
      exercise.duration = 0.01;
    }
    duration = exercise.duration;
  } else {
    // Sets & Reps mode: duration is optional.
    duration = (typeof exercise.duration === 'number' && exercise.duration > 0) ? exercise.duration : 0;
  }

  // Always include all fields for log table binding
  let newLog = {
    name: selectedExercise.value,
    date: selectedDate.value,
    image: selectedImage.value,
    type: selectedType,
    recordingType: selectedExObj?.RecordingType || normalizedSelectedRecordingType.value,
    duration: duration || 0,
    // Strength fields
    sets: allowSetsAndReps ? (exercise.sets || 0) : 0,
    reps: allowSetsAndReps ? (exercise.reps || 0) : 0,
    weight: allowSetsAndReps ? (exercise.weight || 0) : 0,
    // Cardio/Other fields
    distance: allowTimeDistance ? (exercise.distance || 0) : 0,
    lapsRep: allowTimeDistance ? (exercise.lapsRep || 0) : 0,
    'Laps-Rep': allowTimeDistance ? (exercise.lapsRep || 0) : 0,
    calories: allowTimeDistance ? (exercise.calories || 0) : 0,
    speed: allowTimeDistance ? (exercise.speed || 0) : 0
  };

  workoutList.value.push(newLog);
};


//REMOVE excerise
const removeWorkout = (index) => {
  workoutList.value.splice(index, 1);
};
//Remove Excerise



//Delete excerise log
const deleteLog = async (workoutLogId) => {
  if (!workoutLogId) return;
  if (!confirm('Are you sure you want to delete this workout log?')) return;
  try {
    const res = await fetch(`${API_BASE}/api/workout-log/delete-workout-log/${workoutLogId}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to delete workout log');
    await loadWorkoutLogs();
  } catch (err) {
    alert('Failed to delete workout log.');
  }
};


   // ---- ADD EXERCISE ----
   
   // ---- ESTIMATE CALORIES ----
   const estimatedCalories = computed(() => {
     if (workoutType.value === "Cardio") {
       return exercise.duration ? exercise.duration * 10 : 0;
     } else {
       return exercise.sets && exercise.reps
         ? exercise.sets * exercise.reps * 0.5
         : 0;
     }
   });
   // ---- ESTIMATE CALORIES ----
   
   
   
   //Update Date format
  const toMySQLDate = (date) => {
    const d = new Date(date);
    const month = `${d.getMonth() + 1}`.padStart(2, '0');
    const day = `${d.getDate()}`.padStart(2, '0');
    const year = d.getFullYear();
    return `${year}-${month}-${day}`;
  };





//Save Workout
// Save all workout logs for the current user and date
const saveWorkout = async () => {
  if (!userId.value || !selectedDate.value || workoutList.value.length === 0) {
    alert('Missing user, date, or no exercises to save.');
    return;
  }
  const formattedDate = toMySQLDate(selectedDate.value);
  let errors = [];
  for (const log of workoutList.value) {
    // Find ExerciseID from allExercises
    const exObj = allExercises.value.find(ex => ex.ExerciseTitle === log.name || ex.ExerciseTitle === log.ExerciseTitle);
    const ExerciseID = exObj ? exObj.ExerciseID : null;
    if (!ExerciseID) {
      errors.push(`ExerciseID not found for ${log.name || log.ExerciseTitle}`);
      continue;
    }
    const payload = {
      UserID: userId.value,
      ExerciseID,
      WorkoutDate: formattedDate,
      WorkoutType: log.type,
      Duration: log.duration || 0,
      Reps: log.reps || 0,
      Sets: log.sets || 0,
      Weight: log.weight || 0,
      Calories: log.calories || 0,
      Distance: log.distance || 0,
      Speed: log.speed || 0,
      'Laps-Rep': log['Laps-Rep'] || log.lapsRep || 0
    };
    try {
      const res = await fetch(`${API_BASE}/api/workout-log/add-workout-log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include'
      });
      if (!res.ok) {
        const errData = await res.json();
        errors.push(errData.error || `Failed to save log for ${log.name || log.ExerciseTitle}`);
      }
    } catch (err) {
      errors.push(`Network error for ${log.name || log.ExerciseTitle}`);
    }
  }
  if (errors.length > 0) {
    alert('Some logs failed to save:\n' + errors.join('\n'));
  } else {
    alert('âœ… All workout logs saved!');
    workoutList.value = [];
    await loadWorkoutLogs();
  }
};

//Save Workout
   

//End of Load Logs
   const fetchWorkoutLogs = async () => {
  if (!userId.value || !selectedDate.value) return;

  try {
    const res = await fetch(`${API_BASE}/api/workout-log/get-workout-log?userId=${userId.value}&date=${selectedDate.value}`, {
      credentials: 'include'
    });

    const data = await res.json();

    workoutList.value = data.map(log => ({
      name: log.ExerciseTitle,
      type: log.WorkoutType,
      sets: log.Sets,
      reps: log.Reps,
      weight: log.Weight,
      duration: log.Duration,
      calories: log.Calories,
      distance: log.Distance,
      speed: log.Speed,
      'Laps-Rep': log['Laps-Rep'],
      date: log.WorkoutDate,
      image: getExerciseImage({
        ExerciseID: log.ExerciseID,
        ImageURL: log.ImageURL,
        ImageGallery: log.ImageGallery,
        PrimaryImage: log.PrimaryImage,
        ResolvedImageURL: log.ResolvedImageURL,
      })
    }));

  } catch (err) {
    console.error("âŒ Failed to load workout logs:", err);
  }
};



// Load Workout logs and map to correct structure for log table
const loadWorkoutLogs = async () => {
  if (!userId.value || !selectedDate.value) return;
  const formattedDate = toMySQLDate(selectedDate.value);

  try {
    const res = await fetch(`${API_BASE}/api/workout-log/get-workout-log?userId=${userId.value}&date=${formattedDate}`, {
      credentials: 'include'
    });
    const data = await res.json();
    existingLogs.value = Array.isArray(data)
      ? data.map(log => ({
          name: log.ExerciseTitle,
          type: log.WorkoutType,
          sets: log.Sets,
          reps: log.Reps,
          weight: log.Weight,
          duration: log.Duration,
          calories: log.Calories,
          distance: log.Distance,
          speed: log.Speed,
          'Laps-Rep': log['Laps-Rep'],
          date: log.WorkoutDate,
          image: getExerciseImage({
            ExerciseID: log.ExerciseID,
            ImageURL: log.ImageURL,
            ImageGallery: log.ImageGallery,
            PrimaryImage: log.PrimaryImage,
            ResolvedImageURL: log.ResolvedImageURL,
          }),
          WorkoutLogID: log.WorkoutLogID // for remove/edit
        }))
      : [];
  } catch (err) {
    console.error("âŒ Failed to fetch workout logs:", err);
    existingLogs.value = [];
  }
};
//End of Load logs
   





   


   
   
   
   
   
   
  //Get Excerises
  const userId = ref(null);
  
  // Use Date object for selected date
  const selectedDateRaw = ref(new Date());

   
  // Computed: Format the date as d/m/yyyy (e.g., 6/5/2025)   
  const selectedDate = computed(() => {
  const d = selectedDateRaw.value;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0'); // months are 0-based
  const year = d.getFullYear();
  return `${month}/${day}/${year}`;
});
   

const loadExercisesLibrary = async () => {
  exercisesLoadError.value = "";

  try {
    const query = new URLSearchParams({
      paginated: '1',
      view: exerciseView.value,
      ownership: showMyExercisesOnly.value ? 'mine' : 'all',
      search: searchExercise.value.trim(),
      workoutType: workoutType.value,
      muscleGroup: selectedMuscleGroup.value,
      equipment: selectedEquipment.value,
      page: String(currentPage.value),
      pageSize: String(itemsPerPage.value),
      includeTrainerCustom: showTrainerCustomExercises.value ? 'true' : 'false',
      includeUserCustom: showUserCustomExercises.value ? 'true' : 'false',
    });
    const res = await fetch(`${API_BASE}/api/exercises?${query}`, {
      credentials: 'include'
    });

    if (!res.ok) {
      throw new Error(`Failed to load exercises (${res.status})`);
    }

    const data = await res.json();
    searchExerciseRows.value = Array.isArray(data?.items) ? data.items : [];
    searchResultTotal.value = Number(data?.total || 0);
    searchTotalPages.value = Number(data?.totalPages || 0);
    searchFilterOptions.value = {
      muscleGroups: Array.isArray(data?.filters?.muscleGroups) ? data.filters.muscleGroups : [],
      equipment: Array.isArray(data?.filters?.equipment) ? data.filters.equipment : [],
    };
    logLibraryLoaded.value = false;
  } catch (err) {
    console.error('âŒ Failed to load exercises:', err);
    searchExerciseRows.value = [];
    searchResultTotal.value = 0;
    searchTotalPages.value = 0;
    exercisesLoadError.value = 'Could not load exercises right now.';
  }
};

const loadLogExercisesLibrary = async () => {
  if (logLibraryLoaded.value) return;
  const res = await fetch(`${API_BASE}/api/exercises?view=all`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to load workout-log exercises (${res.status})`);
  const data = await res.json();
  allExercises.value = Array.isArray(data) ? data : [];
  logLibraryLoaded.value = true;
};

const loadCurrentSessionRole = async () => {
  try {
    const res = await fetch(`${API_BASE}/api/session`, { credentials: 'include' });
    if (!res.ok) {
      currentUserRole.value = '';
      return;
    }

    const data = await res.json();
    currentUserRole.value = String(data?.user?.role || data?.user?.roleSlug || '').trim();
  } catch (err) {
    console.error('Failed to resolve session role:', err);
    currentUserRole.value = '';
  }
};

const loadMyCustomExercises = async ({ includeAdminGlobal = false } = {}) => {
  customExercisesLoadError.value = '';
  try {
    const query = new URLSearchParams();
    if (includeAdminGlobal && isAdminUser.value) {
      query.set('scope', 'admin-global');
    }

    const suffix = query.toString() ? `?${query.toString()}` : '';
    const res = await fetch(`${API_BASE}/api/exercises/my${suffix}`, { credentials: 'include' });
    if (!res.ok) {
      throw new Error(`Failed to load custom exercises (${res.status})`);
    }
    const data = await res.json();
    myCustomExercises.value = Array.isArray(data) ? data : [];
    myCustomExercises.value.forEach((exerciseRow) => {
      exerciseRow.IsFavorite = isFavoriteExercise(exerciseRow.ExerciseID) ? 1 : Number(exerciseRow?.IsFavorite || 0);
    });
  } catch (err) {
    console.error('Failed to load custom exercises:', err);
    myCustomExercises.value = [];
    customExercisesLoadError.value = 'Could not load your custom exercises right now.';
  }
};

const isFavoriteExercise = (exerciseId) => {
  return favoriteExerciseIds.value.has(Number(exerciseId));
};

const toggleFavoriteExercise = async (exercise) => {
  const exerciseId = Number(exercise?.ExerciseID || 0);
  if (!exerciseId) return;

  try {
    const shouldAddFavorite = !isFavoriteExercise(exerciseId);
    const method = shouldAddFavorite ? 'POST' : 'DELETE';
    const url = `${API_BASE}/api/exercises/${exerciseId}/favorite`;

    const res = await fetch(url, {
      method,
      credentials: 'include'
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[Favorite] Failed ${res.status}:`, errorText);
      throw new Error(`Favorite update failed (${res.status}): ${errorText}`);
    }

    const next = new Set(favoriteExerciseIds.value);
    if (shouldAddFavorite) {
      next.add(exerciseId);
      exercise.IsFavorite = 1;
    } else {
      next.delete(exerciseId);
      exercise.IsFavorite = 0;
    }
    favoriteExerciseIds.value = next;

    if (exerciseView.value === 'favorites') {
      await loadExercisesLibrary();
    }

    searchExerciseRows.value.forEach((row) => {
      if (Number(row?.ExerciseID || 0) === exerciseId) {
        row.IsFavorite = shouldAddFavorite ? 1 : 0;
      }
    });
    myCustomExercises.value.forEach((row) => {
      if (Number(row?.ExerciseID || 0) === exerciseId) {
        row.IsFavorite = shouldAddFavorite ? 1 : 0;
      }
    });
    favoriteExercises.value.forEach((row) => {
      if (Number(row?.ExerciseID || 0) === exerciseId) {
        row.IsFavorite = shouldAddFavorite ? 1 : 0;
      }
    });
    
    // If we're on the Favorite Exercises tab, reload the favorites list
    if (activeTab.value === 'favorite-exercises') {
      await loadFavoriteExercises();
    }
  } catch (err) {
    console.error('Favorite update failed:', err);
    alert('Could not update favorite right now.');
  }
};

const loadFavoriteExercises = async () => {
  loadingFavorites.value = true;
  favoritesLoadError.value = '';
  try {
    const url = `${API_BASE}/api/exercises/favorites`;
    const res = await fetch(url, {
      credentials: 'include'
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[Favorite] Failed to load favorites (${res.status}):`, errorText);
      throw new Error(`Failed to load favorites (${res.status})`);
    }

    const data = await res.json();
    console.log('Favorite API response:', data);
    // Handle different response formats from backend
    favoriteExercises.value = Array.isArray(data) ? data : (data.favorites || data.exercises || []);
    favoriteExerciseIds.value = new Set(favoriteExercises.value.map((exerciseRow) => Number(exerciseRow?.ExerciseID || 0)).filter(Boolean));
    console.log('favoriteExercises:', favoriteExercises.value);
  } catch (err) {
    console.error('Error pulling favorites:', err);
    favoriteExercises.value = [];
    favoritesLoadError.value = 'Error pulling favorites. Please try again.';
  } finally {
    loadingFavorites.value = false;
  }
};

//Async function to pass data from front end to backend
onMounted(async () => {
  await loadCurrentSessionRole();
  if (isAdminUser.value) {
    await loadTrainerOwnerOptions();
  }

  await loadFavoriteExercises();

  //Get All exercises
  await loadExercisesLibrary();
  await loadLogExercisesLibrary();
  await loadMyCustomExercises({ includeAdminGlobal: showAdminGlobalExercises.value });

  //Get user ID
  try {
    const res = await fetch(API_BASE + '/api/user-id', {
      credentials: 'include'
    });
    const data = await res.json();
    if (data.userId) {
      userId.value = data.userId;
    } else {
      userId.value = 'Not logged in';
    }
  } catch (err) {
    console.error('Failed to fetch user ID:', err);
    userId.value = 'Error';
  }
  //End of Get user ID

  await loadWorkoutLogs();
  // Auto-switch tab on initial load
  autoSwitchTabToLogOrLibrary();
});

// Watch for date changes and reload logs, then auto-switch tab
watch(selectedDateRaw, async () => {
  await loadWorkoutLogs();
  autoSwitchTabToLogOrLibrary();
});

// Watch for changes in saved logs (existingLogs)
watch(existingLogs, () => {
  autoSwitchTabToLogOrLibrary();
});

watch(exerciseView, async () => {
  currentPage.value = 1;
  await loadExercisesLibrary();
  await loadMyCustomExercises({ includeAdminGlobal: showAdminGlobalExercises.value });
});

watch(logSearchExercise, () => {
  logSuggestionIndex.value = -1;
});

// Trigger favorites load whenever the favorites tab becomes active
watch(activeTab, async (tab) => {
  if (tab === 'favorite-exercises') {
    console.log('Favorite tab active');
    loadFavoriteExercises();
  } else if (tab === 'custom-exercises') {
    await loadMyCustomExercises({ includeAdminGlobal: showAdminGlobalExercises.value });
  } else if (tab === 'workout-log') {
    try {
      await loadLogExercisesLibrary();
    } catch (err) {
      console.error('Failed to load exercises for workout logging:', err);
    }
  }
});

// Helper: Switch to workout-log if there are logs, else to search-exercises
// Does NOT override if the user deliberately switched to the Favorites tab.
function autoSwitchTabToLogOrLibrary() {
  if (activeTab.value === 'favorite-exercises') return;
  if (Array.isArray(existingLogs.value) && existingLogs.value.length > 0) {
    activeTab.value = 'workout-log';
  } else {
    activeTab.value = 'search-exercises';
  }
}
   
   

   
   
   
   
   
   // Pagination List view
   const displayLimit = ref(3); // default number to show
   const displayedExercises = computed(() => filteredExercises.value.slice(0, displayLimit.value));
   
  const pageSizeOptions = [5, 10, 25, 50, 100];
  const itemsPerPage = ref(10); // default rows per page
  const resultsDisplayMode = ref('list');
   const currentPage = ref(1); // start from 1
    let searchReloadTimer;

   watch([searchExercise, workoutType, selectedMuscleGroup, selectedEquipment, showMyExercisesOnly], () => {
     currentPage.value = 1;
     clearTimeout(searchReloadTimer);
     searchReloadTimer = setTimeout(loadExercisesLibrary, 250);
   });

   watch([showTrainerCustomExercises, showUserCustomExercises], async () => {
     currentPage.value = 1;
     clearTimeout(searchReloadTimer);
     await loadExercisesLibrary();
   });
   
   
  const getFirstImage = (exercise = {}) => getExerciseImage(exercise);

   
   const loadMore = () => {
     visibleCount.value += itemsPerPage.value;
   };
   
   
   
   const pagedExercises = computed(() => {
     return filteredExercises.value;
   });

  const effectiveResultsTotal = computed(() => {
    if (Number(searchResultTotal.value) > 0) return Number(searchResultTotal.value);
    if (pagedExercises.value.length > 0) return pagedExercises.value.length;
    return 0;
  });

  const effectiveTotalPages = computed(() => {
    if (Number(searchTotalPages.value) > 0) return Number(searchTotalPages.value);
    const total = effectiveResultsTotal.value;
    if (total <= 0) return 0;
    return Math.max(1, Math.ceil(total / Math.max(1, Number(itemsPerPage.value) || 1)));
  });

  const effectiveCurrentPage = computed(() => {
    if (effectiveTotalPages.value <= 0) return 0;
    const safeCurrent = Math.max(1, Number(currentPage.value) || 1);
    return Math.min(safeCurrent, effectiveTotalPages.value);
  });

  const isFirstResultsPage = computed(() => effectiveCurrentPage.value <= 1);
  const isLastResultsPage = computed(
    () => effectiveTotalPages.value === 0 || effectiveCurrentPage.value >= effectiveTotalPages.value
  );

  const onRowsPerPageChange = async () => {
    currentPage.value = 1;
    await loadExercisesLibrary();
  };
   
   const nextPage = async () => {
     if (isLastResultsPage.value) return;
     currentPage.value++;
     await loadExercisesLibrary();
   };
   
   const prevPage = async () => {
     if (isFirstResultsPage.value) return;
     currentPage.value--;
     await loadExercisesLibrary();
   };
   // Pagination liist view
   
   
   
   
   
   
   //Selected Excerise
   const goToWorkoutLog = (exercise = null) => {
     if (exercise?.ExerciseTitle) {
       selectedExercise.value = exercise.ExerciseTitle;
       logSearchExercise.value = exercise.ExerciseTitle;
       logSuggestionIndex.value = -1;
     }

     activeTab.value = 'workout-log';
     nextTick(() => {
       scrollToLogWorkout();
     });
   };

   const selectExerciseFromList = (ex) => {
     goToWorkoutLog(ex);
   };

  const selectExerciseForLog = (ex) => {
    if (!ex) return;
    goToWorkoutLog(ex);
  };

  const onLogSearchKeydown = (event) => {
    const list = logExerciseMatches.value;
    if (!list.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      logSuggestionIndex.value = Math.min(logSuggestionIndex.value + 1, list.length - 1);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      logSuggestionIndex.value = Math.max(logSuggestionIndex.value - 1, 0);
      return;
    }

    if (event.key === 'Enter' && logSuggestionIndex.value >= 0) {
      event.preventDefault();
      selectExerciseForLog(list[logSuggestionIndex.value]);
    }
  };
   
   const scrollToLogWorkout = () => {
     const logWorkoutEl = document.getElementById('log-workout-form');
     if (logWorkoutEl) {
       logWorkoutEl.scrollIntoView({ behavior: 'smooth' });
     }
   };
   
   
//Selected excerise Image handeling
const selectedImage = computed(() => {
  if (!selectedExercise.value) {
    return DEFAULT_EXERCISE_IMAGE;
  }

  const match = allExercises.value.find(ex => ex.ExerciseTitle === selectedExercise.value);
  return getExerciseImage(match);
});

const selectedExerciseDetails = computed(() => {
  if (!selectedExercise.value) return null;
  return allExercises.value.find((ex) => ex.ExerciseTitle === selectedExercise.value) || null;
});

const normalizedSelectedRecordingType = computed(() => {
  const explicitRecordingType = String(selectedExerciseDetails.value?.RecordingType || '').trim();
  if (explicitRecordingType) {
    return explicitRecordingType;
  }

  const normalizedWorkoutType = String(selectedExerciseDetails.value?.WorkoutType || '').trim().toLowerCase();
  return normalizedWorkoutType === 'strength' ? 'Sets & Reps' : 'Time & Distance';
});

const usesSetsAndRepsLogging = computed(() => {
  const normalized = normalizedSelectedRecordingType.value.toLowerCase();
  return normalized === 'sets & reps' || normalized === 'custom';
});

const usesTimeDistanceLogging = computed(() => {
  const normalized = normalizedSelectedRecordingType.value.toLowerCase();
  return normalized === 'time & distance' || normalized === 'custom';
});

const selectedExerciseMeta = computed(() => ({
  title: selectedExerciseDetails.value?.ExerciseTitle || selectedExercise.value || 'Select an exercise',
  muscleGroup: selectedExerciseDetails.value?.MuscleGroup || 'N/A',
  workoutType: selectedExerciseDetails.value?.WorkoutType || 'N/A',
  recordingType: normalizedSelectedRecordingType.value,
  equipment: selectedExerciseDetails.value?.Equipment || 'N/A',
}));

const selectedExerciseYouTube = computed(() => parseAndNormalizeYouTubeUrl(selectedExerciseDetails.value?.YouTubeVideoURL || ''));

const selectedExerciseYouTubeEmbedUrl = computed(() => {
  const videoId = String(selectedExerciseYouTube.value?.videoId || '').trim();
  if (!videoId) return '';
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
});

const selectedExerciseYouTubeWatchUrl = computed(() => {
  const videoId = String(selectedExerciseYouTube.value?.videoId || '').trim();
  if (!videoId) return '';
  return `https://www.youtube.com/watch?v=${videoId}`;
});
//End of Selected Excerise image
   
   
//Edit Excerise



   const showEditForm = ref(false); // controls form visibility
   
   const workoutTypeOptions = ["Strength", "Cardio", "Other"];
   const recordingTypeOptions = ["Sets & Reps", "Time & Distance", "Custom"];
   const equipmentOptions = ['Ab Roller', 'Bands', 'Barbell', 'Cable', 'Dumbbell', 'Exercise Ball', 'EZ Curl Bar', 'Foam Roller', 'Kettlebell', 'Machine', 'Mat', 'Medicine Ball', 'None', 'Other'];

  const normalizeUnicodeText = (value) => {
    try {
      return String(value ?? '').normalize('NFC');
    } catch (_err) {
      return null;
    }
  };

  const containsDisallowedControlCharacters = (value, { allowNewlines = false, allowTabs = false } = {}) => {
    for (const char of String(value ?? '')) {
      const codePoint = char.charCodeAt(0);
      if (codePoint > 31 && codePoint !== 127) continue;
      if (allowNewlines && (char === '\n' || char === '\r')) continue;
      if (allowTabs && char === '\t') continue;
      return true;
    }

    return false;
  };

  const validateExerciseTextField = ({ value, fieldLabel, maxLength, required = false, allowNewlines = false, allowTabs = false } = {}) => {
    const normalizedUnicode = normalizeUnicodeText(value);
    if (normalizedUnicode === null || normalizedUnicode.includes('\uFFFD')) {
      return { valid: false, error: `${fieldLabel} contains invalid Unicode text.` };
    }

    const trimmedValue = normalizedUnicode.trim();
    if (!trimmedValue) {
      if (required) {
        return { valid: false, error: `${fieldLabel} is required.` };
      }

      return { valid: true, value: '' };
    }

    if (containsDisallowedControlCharacters(trimmedValue, { allowNewlines, allowTabs })) {
      return { valid: false, error: `${fieldLabel} contains unsupported control characters.` };
    }

    if (trimmedValue.length > maxLength) {
      return { valid: false, error: `${fieldLabel} must be ${maxLength} characters or fewer.` };
    }

    return { valid: true, value: trimmedValue };
  };

  const parseAndNormalizeYouTubeUrl = (rawValue) => {
    const normalized = validateExerciseTextField({
      value: rawValue,
      fieldLabel: 'YouTube Video URL',
      maxLength: EXERCISE_FIELD_LIMITS.YouTubeVideoURL,
    });

    if (!normalized.valid) {
      return { valid: false, error: normalized.error };
    }

    const inputValue = String(normalized.value || '').trim();
    if (!inputValue) {
      return { valid: true, value: '', videoId: '' };
    }

    if (/[<>]/.test(inputValue) || /<\s*iframe/i.test(inputValue)) {
      return { valid: false, error: 'YouTube Video URL must be a valid YouTube link, not embedded HTML.' };
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(inputValue);
    } catch (_err) {
      return { valid: false, error: 'Please enter a valid YouTube URL (watch, youtu.be, shorts, or embed).' };
    }

    const protocol = String(parsedUrl.protocol || '').toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') {
      return { valid: false, error: 'YouTube Video URL must use http or https.' };
    }

    const host = String(parsedUrl.hostname || '').toLowerCase();
    if (!YOUTUBE_ALLOWED_HOSTS.has(host)) {
      return { valid: false, error: 'Only youtube.com and youtu.be links are supported.' };
    }

    const pathSegments = String(parsedUrl.pathname || '')
      .split('/')
      .filter(Boolean)
      .map((segment) => segment.trim())
      .filter(Boolean);

    let videoId = '';
    if (host === 'youtu.be' || host === 'www.youtu.be') {
      videoId = String(pathSegments[0] || '').trim();
    } else {
      const primarySegment = String(pathSegments[0] || '').toLowerCase();
      if (primarySegment === 'watch') {
        videoId = String(parsedUrl.searchParams.get('v') || '').trim();
      } else if (primarySegment === 'shorts' || primarySegment === 'embed') {
        videoId = String(pathSegments[1] || '').trim();
      }
    }

    if (!YOUTUBE_VIDEO_ID_REGEX.test(videoId)) {
      return { valid: false, error: 'Please enter a valid YouTube URL (watch, youtu.be, shorts, or embed).' };
    }

    return {
      valid: true,
      value: `https://www.youtube.com/watch?v=${videoId}`,
      videoId,
    };
  };

  const canonicalizeOptionValue = (value, options = []) => {
    const normalized = String(value ?? '').trim().toLocaleLowerCase();
    return options.find((option) => String(option).trim().toLocaleLowerCase() === normalized) || '';
  };

  const validateExerciseFormValues = ({ exerciseModel, requireTrainerOwner = false } = {}) => {
    const nameResult = validateExerciseTextField({
      value: exerciseModel?.ExerciseTitle,
      fieldLabel: 'Exercise Name',
      maxLength: EXERCISE_FIELD_LIMITS.ExerciseTitle,
      required: true,
    });
    if (!nameResult.valid) return { valid: false, error: nameResult.error };

    const workoutTypeValue = canonicalizeOptionValue(exerciseModel?.WorkoutType, workoutTypeOptions);
    if (!workoutTypeValue) {
      return { valid: false, error: 'Please choose a valid workout type.' };
    }

    const recordingTypeValue = canonicalizeOptionValue(exerciseModel?.RecordingType, recordingTypeOptions);
    if (!recordingTypeValue) {
      return { valid: false, error: 'Please choose a valid recording type.' };
    }

    const equipmentText = validateExerciseTextField({
      value: exerciseModel?.Equipment || 'None',
      fieldLabel: 'Equipment',
      maxLength: EXERCISE_FIELD_LIMITS.Equipment,
      required: true,
    });
    if (!equipmentText.valid) return { valid: false, error: equipmentText.error };

    const equipmentValue = canonicalizeOptionValue(equipmentText.value || 'None', equipmentOptions);
    if (!equipmentValue) {
      return { valid: false, error: 'Please choose a valid equipment option.' };
    }

    const muscleGroupResult = validateExerciseTextField({
      value: exerciseModel?.MuscleGroup,
      fieldLabel: 'Muscle Group',
      maxLength: EXERCISE_FIELD_LIMITS.MuscleGroup,
      required: true,
    });
    if (!muscleGroupResult.valid) return { valid: false, error: muscleGroupResult.error };

    const allowedMuscleGroups = getMuscleGroupOptionsForWorkoutType(workoutTypeValue, {
      preserveValue: muscleGroupResult.value,
      allowStrengthAll: true,
    });
    if (!isMuscleGroupValidForWorkoutType(workoutTypeValue, muscleGroupResult.value, allowedMuscleGroups)) {
      return { valid: false, error: 'Please choose a valid muscle group for the selected workout type.' };
    }

    const normalizedMuscleGroup = allowedMuscleGroups.find((option) => normalizeOptionKey(option) === normalizeOptionKey(muscleGroupResult.value)) || muscleGroupResult.value;

    const instructionsResult = validateExerciseTextField({
      value: exerciseModel?.Instructions,
      fieldLabel: 'Instructions',
      maxLength: EXERCISE_FIELD_LIMITS.Instructions,
      allowNewlines: true,
      allowTabs: true,
    });
    if (!instructionsResult.valid) return { valid: false, error: instructionsResult.error };

    const youtubeResult = parseAndNormalizeYouTubeUrl(exerciseModel?.YouTubeVideoURL);
    if (!youtubeResult.valid) return { valid: false, error: youtubeResult.error };

    if (requireTrainerOwner && !Number(exerciseModel?.OwnerTrainerID || 0)) {
      return { valid: false, error: 'Please select a valid trainer owner.' };
    }

    return {
      valid: true,
      normalizedValues: {
        ExerciseTitle: nameResult.value,
        WorkoutType: workoutTypeValue,
        RecordingType: recordingTypeValue,
        Equipment: equipmentValue,
        MuscleGroup: normalizedMuscleGroup,
        Instructions: instructionsResult.value,
        YouTubeVideoURL: youtubeResult.value,
      },
    };
  };
   
   
   const editExerciseFn = (exercise) => {
     Object.assign(editExercise, exercise);
   };
   
   const startEditing = (exercise) => {
       if (!canEditExercise(exercise)) {
         alert('You are not allowed to edit this exercise.');
         return;
       }
      if (isAdminUser.value && trainerOwnerOptions.value.length === 0) {
        loadTrainerOwnerOptions();
      }
     Object.assign(editExercise, exercise);
        editExercise.YouTubeVideoURL = String(exercise?.YouTubeVideoURL || '').trim();
      editExerciseWasLegacyPrivate.value = isLegacyPrivateScope(exercise?.ExerciseScope);
      editExercise.ExerciseScope = normalizeExerciseScope(exercise);
      editExercise.OwnerTrainerID = resolveTrainerOwnerId(exercise);
      editExercise.CreateAsGlobalExercise = editExercise.ExerciseScope !== EXERCISE_SCOPE.CUSTOM;
      editExercise.ExercisePublicationState = deriveEditPublicationState(editExercise.ExerciseScope, exercise);
      applyMuscleGroupSelectionForWorkoutType(editExercise, { preserveLegacyValue: true });
      loadExistingImages();
        editExerciseSnapshot.value = cloneExerciseState(editExercise);
      if (editExercise.ExerciseScope === EXERCISE_SCOPE.SHARED && !isAdminUser.value) {
        editExercise.OwnerTrainerID = Number(userId.value || 0) || '';
      }
     activeTab.value = 'search-exercises';
     showEditForm.value = true;
     scrollToEditForm(); // optional
   };
   
   const scrollToEditForm = () => {
     nextTick(() => {
       const el = document.getElementById("editExerciseForm");
       if (el) el.scrollIntoView({ behavior: "smooth" });
     });
   };

   const cancelEditingExercise = () => {
     if (editExerciseSnapshot.value) {
       Object.assign(editExercise, cloneExerciseState(editExerciseSnapshot.value));
     }
     selectedImages.value = [];
     imagePreviews.value = [];
     loadExistingImages();
     showEditForm.value = false;
   };
   
   
   const saveEditedExercise = async () => {
     // Clear previous messages
     updateError.value = '';
     updateSuccess.value = '';

     const normalizedScope = normalizeExerciseScope(editExercise);
     if (isAdminUser.value || isTrainerUser.value) {
       if (normalizedScope === EXERCISE_SCOPE.SYSTEM && !isAdminUser.value) {
         updateError.value = 'Only administrators may save SYSTEM exercises.';
         return;
       }

       if (normalizedScope === EXERCISE_SCOPE.SHARED) {
         if (isAdminUser.value) {
           if (!Number(editExercise.OwnerTrainerID || 0)) {
             updateError.value = 'Please select a valid trainer owner.';
             return;
           }
         } else {
           editExercise.OwnerTrainerID = Number(userId.value || 0) || '';
         }
       }
     } else {
       editExercise.ExerciseScope = EXERCISE_SCOPE.CUSTOM;
     }

     editExercise.ExerciseScope = normalizedScope;
     editExercise.CreateAsGlobalExercise = normalizedScope !== EXERCISE_SCOPE.CUSTOM;
     editExercise.ExercisePublicationState = deriveEditPublicationState(normalizedScope, editExercise);

     const editValidation = validateExerciseFormValues({
       exerciseModel: editExercise,
       requireTrainerOwner: Boolean(isAdminUser.value && normalizedScope === EXERCISE_SCOPE.SHARED),
     });
     if (!editValidation.valid) {
       updateError.value = editValidation.error;
       return;
     }
     Object.assign(editExercise, editValidation.normalizedValues);

     const isUpdate = !!editExercise.ExerciseID;
     if (isUpdate && !editExercise.ExerciseID) {
       updateError.value = 'Missing exercise ID. Cannot update exercise.';
       return;
     }

     // Validate image count
     const totalImages = existingImages.value.length + selectedImages.value.length;
     if (totalImages > 2) {
       updateError.value = 'You can only have up to 2 images.';
       return;
     }

     isSaving.value = true;

     try {
       const formData = new FormData();
       
       // Append all exercise fields
       for (const [key, value] of Object.entries(editExercise)) {
         formData.append(key, value || '');
       }

      formData.set('ExerciseScope', editExercise.ExerciseScope || EXERCISE_SCOPE.CUSTOM);
      formData.set('ExercisePublicationState', editExercise.ExercisePublicationState || EXERCISE_PUBLICATION.DISCOVERABLE);
      formData.set('OwnerTrainerID', String(editExercise.OwnerTrainerID || ''));
      formData.set('CreateAsGlobalExercise', editExercise.CreateAsGlobalExercise ? 'true' : 'false');
       
       // Existing images to keep
       formData.append('existingImages', JSON.stringify(existingImages.value));
       // Images to delete
       formData.append('imagesToDelete', JSON.stringify(imagesToDelete.value));
       // New uploads
       selectedImages.value.forEach((img) => formData.append('images', img));

       const url = isUpdate
         ? API_BASE + `/api/get-exercise/${editExercise.ExerciseID}`
         : API_BASE + '/api/save-exercises';
       const method = isUpdate ? 'PUT' : 'POST';

       const response = await fetch(url, {
         method,
         body: formData,
         credentials: 'include'
       });

       const result = await response.json();

       if (!response.ok) {
         console.error(`âŒ API Error (${response.status}):`, result);
         throw new Error(result.error || result.message || (isUpdate ? 'Update failed' : 'Insert failed'));
       }

       // Success!
       updateSuccess.value = isUpdate ? 'Exercise updated successfully!' : 'Exercise added successfully!';
       
       // Refresh exercise list
       await loadExercisesLibrary();
      await loadMyCustomExercises({ includeAdminGlobal: showAdminGlobalExercises.value });
       
       // Clear form after short delay to show success message
       setTimeout(() => {
         showEditForm.value = false;
         selectedImages.value = [];
         imagePreviews.value = [];
         existingImages.value = [];
         imagesToDelete.value = [];
         updateSuccess.value = '';
       }, 2000);

     } catch (err) {
       console.error('âŒ Error updating/inserting exercise:', err);
       
       // Show specific error message
       if (err.message.includes('fetch')) {
         updateError.value = 'Unable to connect to server. Please check your connection.';
       } else {
         updateError.value = err.message || 'Failed to save exercise. Please try again.';
       }
     } finally {
       isSaving.value = false;
     }
   };
   
   //End of Edit Excerise




  //Combined Excerises
const strengthLogs = computed(() =>
  combinedWorkoutLogs.value.filter(log => (log.type || log.WorkoutType) === 'Strength')
);
const cardioLogs = computed(() =>
  combinedWorkoutLogs.value.filter(log => (log.type || log.WorkoutType) === 'Cardio')
);







// --- Per-row Edit State ---
import { reactive as vueReactive } from 'vue';
const rowEditState = vueReactive({}); // key: row index or unique id, value: true/false

// Remove a log from the workout log table
const removeLog = (log, idx) => {
  if (log.isNew) {
    // Remove from workoutList by index (match by all fields for safety)
    const index = workoutList.value.findIndex(w =>
      w.name === log.name &&
      w.date === log.date &&
      w.type === log.type &&
      w.sets === log.sets &&
      w.reps === log.reps &&
      w.weight === log.weight &&
      w.duration === log.duration &&
      w.calories === log.calories &&
      w.distance === log.distance &&
      w.speed === log.speed &&
      w.lapsRep === log.lapsRep
    );
    if (index !== -1) workoutList.value.splice(index, 1);
  } else {
    // Existing log from backend
    deleteLog(log.WorkoutLogID);
  }
  // Remove edit state for this row
  if (rowEditState[idx] !== undefined) delete rowEditState[idx];
};

// Enable edit mode for a row
const editLog = (log, idx) => {
  rowEditState[idx] = true;
};

// Save edited log for a row (backend update for saved logs)
const updateLog = async (log, idx) => {
  // Only allow save for existing logs (not new unsaved ones)
  if (!log.WorkoutLogID) return;
  // Prepare payload
  const payload = {
    UserID: userId.value,
    ExerciseID: allExercises.value.find(ex => ex.ExerciseTitle === (log.name || log.ExerciseTitle))?.ExerciseID,
    WorkoutDate: log.date || log.WorkoutDate,
    WorkoutType: log.type || log.WorkoutType,
    Duration: log.duration || 0,
    Reps: log.reps || 0,
    Sets: log.sets || 0,
    Weight: log.weight || 0,
    Calories: log.calories || 0,
    Distance: log.distance || 0,
    Speed: log.speed || 0,
    'Laps-Rep': log['Laps-Rep'] || log.lapsRep || 0,
    WorkoutLogID: log.WorkoutLogID
  };
  try {
    const res = await fetch(`${API_BASE}/api/workout-log/update-workout-log`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed to update log');
    // Disable edit mode for this row
    rowEditState[idx] = false;
    // Optionally reload logs to get updated data
    await loadWorkoutLogs();
  } catch (err) {
    // Always disable edit mode even if update fails, so user can retry
    rowEditState[idx] = false;
    alert('Failed to update log.');
  }
};




//df -hcerises
// New State
const newExercise = reactive({
  ExerciseTitle: '',
  WorkoutType: 'Strength',
  RecordingType: 'Sets & Reps',
  Equipment: 'None',
  MuscleGroup: '',
  Instructions: '',
  YouTubeVideoURL: '',
  ImageGallery: '[]',
  ExerciseScope: 'CUSTOM',
  ExercisePublicationState: 'DISCOVERABLE',
  OwnerTrainerID: '',
  CreateAsGlobalExercise: false,
});

const showAddForm = ref(false); // Toggle form visibility
const creatingGlobalExercise = ref(false);
const isSubmittingAddExercise = ref(false);

const showExerciseStatusToast = ({ title, message }) => {
  const existingToast = document.getElementById('wa-exercise-created-toast');
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement('div');
  toast.id = 'wa-exercise-created-toast';
  toast.className = 'wa-exercise-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  const iconWrap = document.createElement('div');
  iconWrap.className = 'wa-exercise-toast__icon';
  const icon = document.createElement('i');
  icon.className = 'fa-solid fa-circle-check';
  iconWrap.appendChild(icon);

  const content = document.createElement('div');
  content.className = 'wa-exercise-toast__content';
  const titleNode = document.createElement('div');
  titleNode.className = 'wa-exercise-toast__title';
  titleNode.textContent = String(title || 'Success');
  const messageNode = document.createElement('div');
  messageNode.className = 'wa-exercise-toast__message';
  messageNode.textContent = String(message || 'Exercise updated successfully.');
  content.appendChild(titleNode);
  content.appendChild(messageNode);

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'wa-exercise-toast__close';
  closeButton.setAttribute('aria-label', 'Dismiss notification');
  const closeIcon = document.createElement('i');
  closeIcon.className = 'fa-solid fa-xmark';
  closeButton.appendChild(closeIcon);

  toast.appendChild(iconWrap);
  toast.appendChild(content);
  toast.appendChild(closeButton);

  closeButton?.addEventListener('click', () => {
    toast.remove();
  });

  document.body.appendChild(toast);
  window.setTimeout(() => {
    toast.remove();
  }, 3000);
};

const openAddExercise = ({ global = false } = {}) => {
  creatingGlobalExercise.value = Boolean(global && isAdminUser.value);
  if (isAdminUser.value && trainerOwnerOptions.value.length === 0) {
    loadTrainerOwnerOptions();
  }
  newExercise.ExerciseScope = EXERCISE_SCOPE.CUSTOM;
  newExercise.ExercisePublicationState = EXERCISE_PUBLICATION.DISCOVERABLE;
  newExercise.OwnerTrainerID = '';
  newExercise.CreateAsGlobalExercise = false;
  newExercise.Equipment = 'None';
  newExercise.WorkoutType = 'Strength';
  newExercise.YouTubeVideoURL = '';
  newExercise.MuscleGroup = '';
  applyMuscleGroupSelectionForWorkoutType(newExercise);
  activeTab.value = 'search-exercises';
  showAddForm.value = true;
  nextTick(() => {
    document.getElementById('customExerciseForm')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
};

const closeAddExercise = ({ nextTab = 'custom-exercises' } = {}) => {
  showAddForm.value = false;
  creatingGlobalExercise.value = false;
  newExercise.ExerciseScope = EXERCISE_SCOPE.CUSTOM;
  newExercise.ExercisePublicationState = EXERCISE_PUBLICATION.DISCOVERABLE;
  newExercise.OwnerTrainerID = '';
  newExercise.CreateAsGlobalExercise = false;
  newExercise.Equipment = 'None';
  newExercise.WorkoutType = 'Strength';
  newExercise.YouTubeVideoURL = '';
  newExercise.MuscleGroup = supportsMuscleGroupAll.value ? 'All' : '';
  activeTab.value = nextTab;
};

// Unified AddWorkout for image upload (FormData)
const addFormError = ref("");
const AddWorkout = async () => {
  addFormError.value = "";

  if (isSubmittingAddExercise.value) {
    return;
  }

  isSubmittingAddExercise.value = true;

  newExercise.CreateAsGlobalExercise = Boolean(isAdminUser.value && newExercise.CreateAsGlobalExercise);
  if (!isAdminUser.value && !isTrainerUser.value) {
    newExercise.ExerciseScope = EXERCISE_SCOPE.CUSTOM;
    newExercise.OwnerTrainerID = '';
  } else {
    newExercise.ExerciseScope = normalizeExerciseScopeValue(newExercise.ExerciseScope);
  }

  if (newExercise.ExerciseScope === EXERCISE_SCOPE.SHARED) {
    if (isAdminUser.value) {
      newExercise.OwnerTrainerID = Number(newExercise.OwnerTrainerID || 0) || '';
    } else if (isTrainerUser.value) {
      newExercise.OwnerTrainerID = Number(userId.value || 0) || '';
    }
  }
  if (newExercise.ExerciseScope === EXERCISE_SCOPE.SYSTEM && !isAdminUser.value) {
    addFormError.value = 'Only administrators may create SYSTEM exercises.';
    isSubmittingAddExercise.value = false;
    return;
  }

  newExercise.CreateAsGlobalExercise = newExercise.ExerciseScope !== EXERCISE_SCOPE.CUSTOM;
  newExercise.ExercisePublicationState = deriveCreatePublicationState(newExercise.ExerciseScope);

  const addValidation = validateExerciseFormValues({
    exerciseModel: newExercise,
    requireTrainerOwner: Boolean(isAdminUser.value && newExercise.ExerciseScope === EXERCISE_SCOPE.SHARED),
  });
  if (!addValidation.valid) {
    addFormError.value = addValidation.error;
    isSubmittingAddExercise.value = false;
    return;
  }
  Object.assign(newExercise, addValidation.normalizedValues);

  const formData = new FormData();
  for (const [key, value] of Object.entries(newExercise)) {
    const normalizedValue = key === 'Equipment'
      ? String(value ?? '').trim() || 'None'
      : value ?? '';
    formData.append(key, normalizedValue);
  }
  selectedImages.value.forEach((img) => formData.append('images', img));
  try {
    const res = await fetch(API_BASE + '/api/save-exercises', {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to add exercise');
    const createdAsGlobal = newExercise.ExerciseScope !== EXERCISE_SCOPE.CUSTOM;
    const nextTab = createdAsGlobal ? 'search-exercises' : 'custom-exercises';

    if (createdAsGlobal) {
      await loadExercisesLibrary();
    } else {
      await loadMyCustomExercises({ includeAdminGlobal: showAdminGlobalExercises.value });
    }

    closeAddExercise({ nextTab });
    showCreationSuccessBanner({ target: createdAsGlobal ? 'global' : 'personal' });
    // Reset form and images
    Object.assign(newExercise, {
      ExerciseTitle: '',
      WorkoutType: 'Strength',
      RecordingType: 'Sets & Reps',
      Equipment: 'None',
      MuscleGroup: supportsMuscleGroupAll.value ? 'All' : '',
      Instructions: '',
      YouTubeVideoURL: '',
      ImageGallery: '[]',
      ExerciseScope: EXERCISE_SCOPE.CUSTOM,
      ExercisePublicationState: EXERCISE_PUBLICATION.DISCOVERABLE,
      OwnerTrainerID: '',
      CreateAsGlobalExercise: false,
    });
    selectedImages.value = [];
    imagePreviews.value = [];
    existingImages.value = [];
    imagesToDelete.value = [];
  } catch (err) {
    console.error('Add failed:', err);
    addFormError.value = err.message || 'Error adding exercise.';
  } finally {
    isSubmittingAddExercise.value = false;
  }
};
// (Duplicate removed below)
//Excerise



// Image Upload (Add/Edit Exercise)
const selectedImages = ref([]); // For new uploads (add/edit)
const imagePreviews = ref([]); // For previewing new uploads
const existingImages = ref([]); // Filenames retained for save payloads
const existingImagePreviewEntries = ref([]); // Real uploaded media preview entries for edit only
const imagesToDelete = ref([]); // For images marked for deletion (edit only)
const failedExistingImageNames = ref(new Set());

const cloneExerciseState = (value = {}) => JSON.parse(JSON.stringify(value || {}));

const parseStoredExerciseImages = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;

  const raw = String(value || '').trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [raw];
  }
};

const getOrderedExerciseImageNames = (exerciseModel = {}) => {
  const ordered = [];
  const seen = new Set();
  const pushIfUnique = (candidate) => {
    const normalized = String(candidate || '').trim();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    ordered.push(normalized);
  };

  pushIfUnique(exerciseModel.PrimaryImage);
  parseStoredExerciseImages(exerciseModel.ImageGallery).forEach(pushIfUnique);
  return ordered.slice(0, 2);
};

const buildExistingImagePreviewEntries = (exerciseModel = {}) => {
  return getOrderedExerciseImageNames(exerciseModel)
    .filter((imageName) => !isDefaultExerciseImageReference(imageName))
    .map((imageName) => ({
      name: imageName,
      url: getExerciseImage({
        ExerciseID: exerciseModel.ExerciseID,
        PrimaryImage: imageName,
        ImageGallery: [imageName],
      }),
    }));
};

const hasRemovedAllRealExerciseImages = computed(() => existingImagePreviewEntries.value.length === 0 && imagePreviews.value.length === 0);

const hasExistingImageLoadFailures = computed(() => failedExistingImageNames.value.size > 0);

const editPrimaryPreviewEntry = computed(() => {
  if (existingImagePreviewEntries.value.length > 0) {
    const primaryExisting = existingImagePreviewEntries.value[0];
    return {
      type: failedExistingImageNames.value.has(primaryExisting.name) ? 'error' : 'existing',
      name: primaryExisting.name,
      url: primaryExisting.url,
    };
  }

  if (imagePreviews.value.length > 0) {
    return {
      type: 'new',
      name: 'New image',
      url: imagePreviews.value[0],
    };
  }

  return {
    type: 'default',
    name: 'Default exercise placeholder',
    url: DEFAULT_EXERCISE_IMAGE,
  };
});

// For Add: handle new uploads
const handleImageUpload = (event) => {
  const files = Array.from(event.target.files);
  if (files.length + existingImagePreviewEntries.value.length > 2) {
    alert('You can only upload up to 2 images.');
    return;
  }
  for (const file of files) {
    if (!file.type.startsWith('image/')) {
      alert(`File ${file.name} is not a valid image`);
      continue;
    }
    selectedImages.value.push(file);
    const reader = new FileReader();
    reader.onload = (e) => imagePreviews.value.push(e.target.result);
    reader.readAsDataURL(file);
  }
};

watch(() => newExercise.WorkoutType, () => {
  applyMuscleGroupSelectionForWorkoutType(newExercise);
});

watch(() => editExercise.WorkoutType, () => {
  if (!showEditForm.value) return;
  applyMuscleGroupSelectionForWorkoutType(editExercise);
});

// For Edit: load existing images from ImageGallery
const loadExistingImages = () => {
  existingImages.value = getOrderedExerciseImageNames(editExercise).filter((imageName) => !isDefaultExerciseImageReference(imageName));
  existingImagePreviewEntries.value = buildExistingImagePreviewEntries(editExercise);
  imagesToDelete.value = [];
  failedExistingImageNames.value = new Set();
};

// Call this when opening edit form
watch(showEditForm, (val) => { if (val) loadExistingImages(); });

// Remove existing image (mark for deletion)
const removeExistingImage = (img) => {
  imagesToDelete.value.push(img);
  existingImages.value = existingImages.value.filter(i => i !== img);
  existingImagePreviewEntries.value = existingImagePreviewEntries.value.filter((entry) => entry.name !== img);
  const nextFailed = new Set(failedExistingImageNames.value);
  nextFailed.delete(img);
  failedExistingImageNames.value = nextFailed;
};

const markExistingImageLoadFailure = (img) => {
  const nextFailed = new Set(failedExistingImageNames.value);
  nextFailed.add(img);
  failedExistingImageNames.value = nextFailed;
};

// Remove new upload before saving
const removeNewImage = (idx) => {
  selectedImages.value.splice(idx, 1);
  imagePreviews.value.splice(idx, 1);
};

// (Duplicate removed)

// (Duplicate removed)


// Stopwatch for Duration (Cardio)
const stopwatchTime = ref(0); // seconds
const stopwatchRunning = ref(false);
let stopwatchInterval = null;

const formattedStopwatch = computed(() => {
  const min = Math.floor(stopwatchTime.value / 60).toString().padStart(2, '0');
  const sec = (stopwatchTime.value % 60).toString().padStart(2, '0');
  return `${min}:${sec}`;
});

const toggleStopwatch = () => {
  if (stopwatchRunning.value) {
    clearInterval(stopwatchInterval);
    stopwatchRunning.value = false;
    // Set duration in minutes (rounded to 2 decimals)
    exercise.duration = Math.round((stopwatchTime.value / 60) * 100) / 100;
  } else {
    stopwatchRunning.value = true;
    stopwatchInterval = setInterval(() => {
      stopwatchTime.value++;
    }, 1000);
  }
};

const resetStopwatch = () => {
  clearInterval(stopwatchInterval);
  stopwatchRunning.value = false;
  stopwatchTime.value = 0;
  exercise.duration = 0;
};


// Add this computed property to combine logs for the log tables
const combinedWorkoutLogs = computed(() => {
  // Use both new (not yet saved) and existing logs
  // existingLogs.value: logs loaded from backend
  // workoutList.value: logs added in this session (not yet saved)
  // Mark new logs with isNew for correct handling
  const newLogs = workoutList.value.map(log => ({ ...log, isNew: true }));
  // Defensive: ensure existingLogs is always an array
  const existing = Array.isArray(existingLogs.value) ? existingLogs.value : [];
  return [...existing, ...newLogs];
});

const creationSuccessBannerState = ref({
  visible: false,
  message: 'Exercise added successfully!',
  target: 'personal',
});
let creationSuccessBannerTimer = null;

const clearCreationSuccessBannerTimer = () => {
  if (creationSuccessBannerTimer) {
    clearTimeout(creationSuccessBannerTimer);
    creationSuccessBannerTimer = null;
  }
};

const showCreationSuccessBanner = ({ target }) => {
  clearCreationSuccessBannerTimer();
  creationSuccessBannerState.value = {
    visible: true,
    message: 'Exercise added successfully!',
    target: target === 'global' ? 'global' : 'personal',
  };

  creationSuccessBannerTimer = setTimeout(() => {
    creationSuccessBannerState.value.visible = false;
    creationSuccessBannerTimer = null;
  }, 10000);
};

onUnmounted(() => {
  clearCreationSuccessBannerTimer();
});


const closeDeleteConfirmModal = () => {
  deleteConfirmState.value = {
    visible: false,
    exercise: null,
    isSubmitting: false,
    error: '',
  };
};

const closeDeleteSuccessModal = () => {
  deleteSuccessState.value = {
    visible: false,
    title: 'Exercise Deleted',
    message: 'The exercise was deleted successfully.',
    isGlobal: false,
  };
};

const handleDeleteSuccessAcknowledge = async () => {
  const isGlobal = Number(deleteSuccessState.value?.isGlobal || 0) === 1;

  closeDeleteSuccessModal();
  showEditForm.value = false;
  updateError.value = '';
  updateSuccess.value = '';

  activeTab.value = isGlobal ? 'search-exercises' : 'custom-exercises';

  await loadExercisesLibrary();
  await loadMyCustomExercises({ includeAdminGlobal: showAdminGlobalExercises.value });
};

const openDeleteExerciseModal = (exercise) => {
  if (!exercise?.ExerciseID) return;
  if (Number(exercise?.CanDelete || 0) !== 1 && !isAdminUser.value) return;

  deleteConfirmState.value = {
    visible: true,
    exercise,
    isSubmitting: false,
    error: '',
  };
};

const confirmDeleteExercise = async () => {
  const exercise = deleteConfirmState.value.exercise;
  if (!exercise?.ExerciseID) return;
  if (deleteConfirmState.value.isSubmitting) return;

  deleteConfirmState.value.isSubmitting = true;
  deleteConfirmState.value.error = '';

  try {
    const res = await fetch(`${API_BASE}/api/delete-exercise/${exercise.ExerciseID}`, {
      method: 'DELETE',
      credentials: 'include'
    });

    const payload = await res.json().catch(() => ({}));

    if (!res.ok || payload?.success === false) {
      const errorData = payload;
      throw new Error(errorData?.message || errorData?.error || 'Failed to delete exercise.');
    }

    const isGlobal = Number(exercise?.IsGlobalExercise || 0) === 1;
    const successTitle = isGlobal ? 'Global Exercise Deleted' : 'Exercise Deleted';
    const successMessage = 'Exercise deleted successfully!';

    deleteSuccessState.value = {
      visible: true,
      title: successTitle,
      message: successMessage,
      isGlobal,
    };

    closeDeleteConfirmModal();
  } catch (err) {
    deleteConfirmState.value.error = err?.message || 'Failed to delete exercise.';
  } finally {
    deleteConfirmState.value.isSubmitting = false;
  }
};

// Delete Exercise function
const deleteExercise = (exercise) => {
  openDeleteExerciseModal(exercise);
};

// add this function near other handlers (e.g. after AddWorkout or near pagination handlers)
const clearFilters = () => {
  exerciseView.value = 'all';
  workoutType.value = 'All';
  selectedMuscleGroup.value = 'All';
  selectedEquipment.value = 'All';
  showMyExercisesOnly.value = false;
  showTrainerCustomExercises.value = false;
  showUserCustomExercises.value = false;
  searchExercise.value = '';
  logSearchExercise.value = '';
  logWorkoutTypeFilter.value = 'All';
  logMuscleGroupFilter.value = 'All';
  logEquipmentFilter.value = 'All';
  logOwnershipFilter.value = 'all';
  logSuggestionIndex.value = -1;
  currentPage.value = 1;
  // reset any derived pagination/display state if you need:
  displayLimit.value = 3;
};

const toggleAdminGlobalExercises = async () => {
  if (!isAdminUser.value) return;
  showAdminGlobalExercises.value = !showAdminGlobalExercises.value;
  await loadMyCustomExercises({ includeAdminGlobal: showAdminGlobalExercises.value });
};


</script>

<template>
  <div class="app-page-shell exercises-page">
  <div class="app-page-canvas app-inner-shell exercises-canvas">

    <div
      v-if="deleteConfirmState.visible"
      class="exercise-delete-modal-backdrop"
      @click.self="closeDeleteConfirmModal()"
    >
      <div class="exercise-delete-modal" role="dialog" aria-modal="true" aria-labelledby="exercise-delete-title">
        <button
          type="button"
          class="exercise-delete-modal-close"
          aria-label="Close delete confirmation"
          @click="closeDeleteConfirmModal()"
        >
          <i class="fa-solid fa-xmark"></i>
        </button>

        <div class="exercise-delete-modal-icon" aria-hidden="true">
          <i class="fa-solid fa-triangle-exclamation"></i>
        </div>

        <h3 id="exercise-delete-title" class="exercise-delete-modal-title">
          {{ Number(deleteConfirmState.exercise?.IsGlobalExercise || 0) === 1 ? 'Delete Global Exercise?' : 'Delete Exercise?' }}
        </h3>

        <p class="exercise-delete-modal-name">
          {{ deleteConfirmState.exercise?.ExerciseTitle || 'This exercise' }}
        </p>

        <p class="exercise-delete-modal-copy">
          Are you sure you want to delete this exercise? This action cannot be undone.
        </p>

        <p v-if="Number(deleteConfirmState.exercise?.IsGlobalExercise || 0) === 1" class="exercise-delete-modal-warning">
          This global exercise is available to all users.
        </p>

        <div v-if="deleteConfirmState.error" class="exercise-delete-modal-error">
          {{ deleteConfirmState.error }}
        </div>

        <div class="exercise-delete-modal-actions">
          <button type="button" class="btn btn-secondary exercise-delete-modal-cancel" @click="closeDeleteConfirmModal()">
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-danger exercise-delete-modal-confirm"
            :disabled="deleteConfirmState.isSubmitting"
            @click="confirmDeleteExercise()"
          >
            <span v-if="deleteConfirmState.isSubmitting">
              <i class="fa-solid fa-spinner fa-spin me-2"></i>
              Deleting...
            </span>
            <span v-else>
              {{ Number(deleteConfirmState.exercise?.IsGlobalExercise || 0) === 1 ? 'Delete Global Exercise' : 'Delete Exercise' }}
            </span>
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="deleteSuccessState.visible"
      class="exercise-delete-modal-backdrop"
      @click.self="handleDeleteSuccessAcknowledge()"
    >
      <div class="exercise-delete-modal" role="dialog" aria-modal="true" aria-labelledby="exercise-delete-success-title">
        <button
          type="button"
          class="exercise-delete-modal-close"
          aria-label="Close delete success"
          @click="handleDeleteSuccessAcknowledge()"
        >
          <i class="fa-solid fa-xmark"></i>
        </button>

        <div class="exercise-delete-modal-icon exercise-delete-success-icon" aria-hidden="true">
          <i class="fa-solid fa-circle-check"></i>
        </div>

        <h3 id="exercise-delete-success-title" class="exercise-delete-modal-title">
          {{ deleteSuccessState.title }}
        </h3>

        <p class="exercise-delete-modal-copy mt-2">
          {{ deleteSuccessState.message }}
        </p>

        <div class="exercise-delete-modal-actions">
          <button
            type="button"
            class="btn btn-success exercise-delete-success-ok"
            @click="handleDeleteSuccessAcknowledge()"
          >
            OK
          </button>
        </div>
      </div>
    </div>

  <section class="builder-hero ff-page-header app-header-gradient">


      <div class="builder-hero__content">
        <h2>{{ isExercisesView ? 'Exercises' : 'Workout Log' }}</h2>
      </div>
      
    </section>

    <nav class="ex-view-switch wa-h-tabs" aria-label="Workout log and exercises navigation">
      <router-link
        to="/workout-log"
        class="ex-view-switch__link ex-view-switch__link--log wa-h-tab"
        :class="{
          'ex-view-switch__link--active wa-h-tab--active': isWorkoutLogView,
          'ex-view-switch__link--expanded': isWorkoutLogView,
          'ex-view-switch__link--compact': isExercisesView,
        }"
      >
        <i class="fa-solid fa-dumbbell" aria-hidden="true"></i>
        <span>Workout Log</span>
      </router-link>
      <router-link
        to="/exercises"
        class="ex-view-switch__link ex-view-switch__link--exercises wa-h-tab"
        :class="{
          'ex-view-switch__link--active wa-h-tab--active': isExercisesView,
          'ex-view-switch__link--expanded': isExercisesView,
          'ex-view-switch__link--compact': isWorkoutLogView,
        }"
      >
        <i class="fa-solid fa-book-open" aria-hidden="true"></i>
        <span>Exercises</span>
      </router-link>
    </nav>








   <!-- Exercise Tab Section -->
  <div class="ex-page-body app-section-card">

              <nav class="ex-tab-bar wa-h-tabs wa-h-tabs--tricolor" role="tablist" aria-label="Log workout sections">
                <button
                  type="button"
                  class="ex-tab wa-h-tab"
                  :class="{ 'ex-tab--active': activeTab === 'search-exercises', 'wa-h-tab--active': activeTab === 'search-exercises' }"
                  :aria-selected="activeTab === 'search-exercises'"
                  role="tab"
                  @click="activeTab = 'search-exercises'"
                >
                  <i class="fa-solid fa-magnifying-glass me-2"></i><span class="tab-label-full">Search Exercises</span><span class="tab-label-short">Search</span>
                </button>
                <button
                  type="button"
                  class="ex-tab wa-h-tab"
                  :class="{ 'ex-tab--active': activeTab === 'custom-exercises', 'wa-h-tab--active': activeTab === 'custom-exercises' }"
                  :aria-selected="activeTab === 'custom-exercises'"
                  role="tab"
                  @click="activeTab = 'custom-exercises'"
                >
                  <i class="fa-solid fa-dumbbell me-2"></i><span class="tab-label-full">My Custom Exercises</span><span class="tab-label-short">Custom</span>
                </button>
                <button
                  type="button"
                  class="ex-tab wa-h-tab"
                  :class="{ 'ex-tab--active': activeTab === 'favorite-exercises', 'wa-h-tab--active': activeTab === 'favorite-exercises' }"
                  :aria-selected="activeTab === 'favorite-exercises'"
                  role="tab"
                  @click="activeTab = 'favorite-exercises'; loadFavoriteExercises();"
                >
                  <i class="fa-solid fa-star me-2"></i><span class="tab-label-full">Favorite Exercises</span><span class="tab-label-short">Favorites</span>
                </button>
              </nav>

             <div class="tab-content px-0" id="nav-tabContent">


            <!-- Search Exercise Section -->
            <div v-if="activeTab === 'search-exercises'">
                <!--Search Excerises CONTAINER -->
            <div class="container container-block">
                <div
                  v-if="creationSuccessBannerState.visible && creationSuccessBannerState.target === 'global'"
                  class="alert alert-success d-flex align-items-center mb-3"
                  role="alert"
                >
                  <i class="fa-solid fa-circle-check me-2"></i>
                  <div>{{ creationSuccessBannerState.message }}</div>
                </div>

                <div class="panel search-filter-card exercise-database-toolbar search-only-toolbar">
                  <div class="panel-body search-filter-body">
                      <div v-if="exercisesLoadError" class="alert alert-warning">
                        {{ exercisesLoadError }}
                      </div>
                      <div class="search-compact-row">
                        <div class="search-filter-input-wrap search-filter-input-wrap--search-only">
                          <i class="fa-solid fa-magnifying-glass search-filter-input-icon" aria-hidden="true"></i>
                          <input v-model="searchExercise" type="text" class="form-control" placeholder="Search exercise by name" />
                        </div>
                        <div class="search-compact-actions">
                          <button
                            class="filter-accordion-toggle exercise-toolbar-add--icon filter-accordion-toggle--icon-only"
                            type="button"
                            :aria-expanded="filtersOpen"
                            :aria-label="filtersOpen ? 'Hide Filters' : 'Show Filters'"
                            :title="filtersOpen ? 'Hide Filters' : 'Show Filters'"
                            aria-controls="exercise-filters-panel"
                            @click="filtersOpen = !filtersOpen"
                          >
                            <i class="fa-solid fa-sliders filter-toggle-main-icon" aria-hidden="true"></i>
                          </button>
                        </div>
                      </div>
                  </div>
                </div>

                <div class="search-custom-toggle-block">
                  <div class="search-custom-toggle-list">
                    <div class="search-filter-toggle-row search-filter-toggle-row--custom">
                      <input
                        id="show-trainer-custom-exercises-toggle"
                        v-model="showTrainerCustomExercises"
                        class="wa-global-toggle search-filter-toggle-checkbox"
                        type="checkbox"
                      />
                      <label for="show-trainer-custom-exercises-toggle" class="search-filter-toggle-label">
                        Show Custom Exercises from Trainers (Not Verified)
                      </label>
                    </div>
                    <div class="search-filter-toggle-row search-filter-toggle-row--custom">
                      <input
                        id="show-user-custom-exercises-toggle"
                        v-model="showUserCustomExercises"
                        class="wa-global-toggle search-filter-toggle-checkbox"
                        type="checkbox"
                      />
                      <label for="show-user-custom-exercises-toggle" class="search-filter-toggle-label">
                        Show Custom Exercises from Users (Not Verified)
                      </label>
                    </div>
                  </div>
                  <div v-if="showTrainerCustomExercises || showUserCustomExercises" class="search-custom-warning" role="alert">
                    Community-created exercises are not verified by WorkoutAtlas. Review details before use.
                  </div>
                </div>

                <div v-if="filtersOpen" id="exercise-filters-panel" class="panel search-filter-card exercise-database-toolbar filters-toolbar">
                  <div class="panel-body search-filter-body">
                      <div class="filter-body-animated">
                      <div class="search-filter-grid">
                        <div class="search-filter-field search-filter-field--select">
                          <label class="form-label">View</label>
                          <div class="search-filter-select-wrap">
                            <select v-model="exerciseView" class="form-select">
                              <option value="all">All Exercises</option>
                              <option value="mine">My Exercises</option>
                              <option value="favorites">Favorite Exercises</option>
                            </select>
                            <i class="fa-solid fa-chevron-down search-filter-select-icon" aria-hidden="true"></i>
                          </div>
                        </div>

                        <div class="search-filter-field search-filter-field--select">
                          <label class="form-label">Exercise Type / Category</label>
                          <div class="search-filter-select-wrap">
                            <select v-model="workoutType" class="form-select">
                              <option value="All">All</option>
                              <option value="Strength">Strength</option>
                              <option value="Cardio">Cardio</option>
                              <option value="Other">Other</option>
                            </select>
                            <i class="fa-solid fa-chevron-down search-filter-select-icon" aria-hidden="true"></i>
                          </div>
                        </div>

                        <div class="search-filter-field search-filter-field--select">
                          <label class="form-label">Body Area / Muscle Group</label>
                          <div class="search-filter-select-wrap">
                            <select v-model="selectedMuscleGroup" class="form-select">
                              <option v-for="group in muscleGroups" :key="group" :value="group">
                                {{ group }}
                              </option>
                            </select>
                            <i class="fa-solid fa-chevron-down search-filter-select-icon" aria-hidden="true"></i>
                          </div>
                        </div>

                        <div class="search-filter-field search-filter-field--select">
                          <label class="form-label">Equipment</label>
                          <div class="search-filter-select-wrap">
                            <select v-model="selectedEquipment" class="form-select">
                              <option v-for="equip in equipmentList" :key="equip" :value="equip">
                                {{ equip }}
                              </option>
                            </select>
                            <i class="fa-solid fa-chevron-down search-filter-select-icon" aria-hidden="true"></i>
                          </div>
                        </div>
                      </div>

                        <div class="search-filter-actions">
                          <div class="search-filter-toggle-row">
                            <input
                              id="show-my-exercises-toggle"
                              v-model="showMyExercisesOnly"
                              class="wa-global-toggle search-filter-toggle-checkbox"
                              type="checkbox"
                            />
                            <label for="show-my-exercises-toggle" class="search-filter-toggle-label">Show My Exercises</label>
                          </div>
                          <button class="btn btn-outline-secondary clear-filters-btn" @click="clearFilters" title="Reset filters">
                            <i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
                            <span>Clear Filters</span>
                          </button>
                        </div>
                      <div class="search-filter-divider"></div>
                      </div>
                  </div>
                </div>
                <!--End of Panel-->




              <!-- Exercise Results container -->
        
                <div class="panel exercise-results-panel">

                    <!--edit Excerise-->
                    <div v-if="showEditForm" class="row g-3 mt-3">
                      <div id="editExerciseForm" class="panel edit-exercise-panel col-12">
                            <div class="panel-header">
                              <h4>Edit Exercise</h4>
                            </div>
                            <div class="panel-body row g-3">
                              <div class="col-md-12">
                                <div class="edit-exercise-primary-preview">
                                  <template v-if="editPrimaryPreviewEntry.type === 'error'">
                                    <div class="edit-exercise-primary-preview__failure" role="status">
                                      <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
                                      <span>Saved image failed to load.</span>
                                    </div>
                                  </template>
                                  <template v-else>
                                    <img
                                      :src="editPrimaryPreviewEntry.url"
                                      :alt="editExercise.ExerciseTitle || 'Exercise image preview'"
                                      class="edit-exercise-primary-preview__image"
                                    />
                                  </template>
                                </div>
                              </div>
                              <div class="col-md-12">
                                  <label class="form-label">Exercise Name: <span style="color:red">*</span></label>
                                  <input v-model="editExercise.ExerciseTitle" class="form-control" required />
                              </div>
                              <div class="col-md-6">
                                  <label class="form-label">Workout Type: <span style="color:red">*</span></label>
                                  <select v-model="editExercise.WorkoutType" class="form-select" required>
                                    <option v-for="type in workoutTypeOptions" :key="type" :value="type">{{ type }}</option>
                                  </select>
                              </div>
                              <div class="col-md-6">
                                  <label class="form-label">Recording Type:</label>
                                  <select v-model="editExercise.RecordingType" class="form-select">
                                    <option v-for="type in recordingTypeOptions" :key="type" :value="type">{{ type }}</option>
                                  </select>
                              </div>
                              <div class="col-md-6">
                                  <label class="form-label">Equipment:</label>
                                  <input v-model="editExercise.Equipment" class="form-control" />
                              </div>
                              <div class="col-md-6">
                                  <label class="form-label">Muscle Group:<span style="color:red">*</span></label>
                                  <select v-model="editExercise.MuscleGroup" class="form-select" required>
                                    <option v-for="group in getMuscleGroupOptionsForWorkoutType(editExercise.WorkoutType, { preserveValue: editExercise.MuscleGroup, allowStrengthAll: true })" :key="group" :value="group">{{ group }}</option>
                                  </select>
                              </div>
                              <div class="col-md-12">
                                  <label class="form-label">Upload Images (max 2):</label>
                                  <input 
                                    type="file" 
                                    multiple 
                                    accept="image/*" 
                                    @change="handleImageUpload"
                                    class="form-control"
                                    :disabled="imagePreviews.length + existingImagePreviewEntries.length >= 2"
                                  />
                                  <div class="edit-exercise-image-section">
                                    <div v-if="imagePreviews.length || existingImagePreviewEntries.length" class="edit-exercise-image-previews">
                                      <div v-for="(img, index) in imagePreviews" :key="'new-edit-' + index" class="edit-exercise-image-preview">
                                        <img :src="img" class="edit-exercise-preview-image" />
                                        <button type="button" class="edit-exercise-image-remove" @click="removeNewImage(index)" aria-label="Remove selected image">&times;</button>
                                      </div>
                                      <div v-for="entry in existingImagePreviewEntries" :key="`exist-edit-${entry.name}`" class="edit-exercise-image-preview">
                                        <template v-if="failedExistingImageNames.has(entry.name)">
                                          <div class="edit-exercise-image-failure" role="status">
                                            <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
                                            <span>Saved image failed to load.</span>
                                          </div>
                                        </template>
                                        <template v-else>
                                          <img :src="entry.url" class="edit-exercise-preview-image" @error="markExistingImageLoadFailure(entry.name)" />
                                        </template>
                                        <button type="button" class="edit-exercise-image-remove" @click="removeExistingImage(entry.name)" aria-label="Remove existing image">&times;</button>
                                        <div class="edit-exercise-image-name">{{ entry.name.split('/').pop() }}</div>
                                      </div>
                                    </div>

                                    <p v-if="hasExistingImageLoadFailures" class="edit-exercise-image-warning">
                                      One or more saved exercise images failed to load. The media reference was preserved.
                                    </p>
                                  </div>
                              </div>
                              <div class="col-md-12">
                                  <label class="form-label">YouTube Video URL (Optional)</label>
                                  <input
                                    v-model="editExercise.YouTubeVideoURL"
                                    type="url"
                                    class="form-control"
                                    placeholder="https://www.youtube.com/watch?v=VIDEO_ID"
                                  />
                                  <p class="form-text mt-1 mb-0 youtube-url-helper-text">Supported links: youtube.com/watch, youtu.be, youtube.com/shorts, and youtube.com/embed.</p>
                              </div>
                              <div class="col-md-12">
                                  <label class="form-label">Instructions</label>
                                  <textarea v-model="editExercise.Instructions" class="form-control instructions" rows="=3" />
                              </div>
                              <div v-if="canChooseScope" class="col-md-12 custom-exercise-field-row">
                                <label class="form-label">Exercise Scope</label>
                                <div class="custom-exercise-select-wrap">
                                  <select v-model="selectedEditExerciseScope" class="form-select custom-exercise-form-select">
                                    <option v-for="scope in exerciseScopeOptions" :key="scope.value" :value="scope.value">{{ scope.label }}</option>
                                  </select>
                                  <span class="custom-exercise-select-arrow" aria-hidden="true">▼</span>
                                </div>
                                <p class="form-text mt-1 mb-0 exercise-scope-helper-text">
                                  <span v-if="selectedEditExerciseScope === 'SYSTEM'">System exercises are visible to all authenticated users.</span>
                                  <span v-else-if="selectedEditExerciseScope === 'SHARED' && isAdminUser">Choose a valid trainer owner before saving.</span>
                                  <span v-else-if="selectedEditExerciseScope === 'SHARED'">Your trainer account will own this shared exercise.</span>
                                  <span v-else>Custom exercises are discoverable unless restricted by supported privacy controls.</span>
                                </p>
                              </div>
                              <div v-if="isAdminUser && selectedEditExerciseScope === 'SHARED'" class="col-md-12 custom-exercise-field-row">
                                <label class="form-label">Trainer Owner <span style="color:red">*</span></label>
                                <div class="custom-exercise-select-wrap">
                                  <select v-model.number="editExercise.OwnerTrainerID" class="form-select custom-exercise-form-select" :disabled="trainerOwnerOptionsLoading">
                                    <option value="" disabled>Select a trainer</option>
                                    <option v-for="trainer in trainerOwnerOptions" :key="trainer.id" :value="trainer.id">{{ trainer.label }}</option>
                                  </select>
                                  <span class="custom-exercise-select-arrow" aria-hidden="true">▼</span>
                                </div>
                                <p v-if="trainerOwnerOptionsLoading" class="form-text mt-1 mb-0">Loading trainer accounts...</p>
                                <p v-else-if="trainerOwnerOptionsError" class="form-text mt-1 mb-0 text-danger">{{ trainerOwnerOptionsError }}</p>
                              </div>
                              <!-- Cardio Fields 
                                  <div class="col-md-12">
                                    <hr><h4>Cardio</h4><hr>
                                    
                                  </div>
                                  <div class="col-md-4">
                                    <label class="form-label">Duration (min)</label>
                                    <input type="number" v-model.number="editExercise.Duration" class="form-control" />
                                  </div>
                                  <div class="col-md-4">
                                    <label class="form-label">Calories</label>
                                    <input type="number" v-model.number="editExercise.Calories" class="form-control" />
                                  </div>
                                  <div class="col-md-3">
                                    <label class="form-label">Distance (miles)</label>
                                    <input type="number" v-model.number="editExercise.Distance" class="form-control" />
                                  </div>
                                  <div class="col-md-3">
                                    <label class="form-label">Speed (mph)</label>
                                    <input type="number" v-model.number="editExercise.Speed" class="form-control" />
                                  </div>
                                  <div class="col-md-3">
                                    <label class="form-label">Laps/Reps</label>
                                    <input type="number" v-model.number="editExercise['Laps-Reps']" class="form-control" />
                                  </div>
                                  -->

                              <!-- Error and Success Messages -->
                              <div v-if="updateError" class="col-12">
                                <div class="alert alert-danger d-flex align-items-center" role="alert">
                                  <i class="fa-solid fa-circle-exclamation me-2"></i>
                                  <div>{{ updateError }}</div>
                                </div>
                              </div>
                              <div v-if="updateSuccess" class="col-12">
                                <div class="alert alert-success d-flex align-items-center" role="alert">
                                  <i class="fa-solid fa-circle-check me-2"></i>
                                  <div>{{ updateSuccess }}</div>
                                </div>
                              </div>

                              <div class="col-12 mt-3 d-flex align-items-center" style="gap: 8px;">
                                  <div>
                                    <button class="btn btn-success" @click="saveEditedExercise" :disabled="isSaving">
                                      <span v-if="isSaving">
                                        <i class="fa-solid fa-spinner fa-spin me-1"></i> Saving...
                                      </span>
                                      <span v-else>Save Changes</span>
                                    </button>
                                    <button class="btn btn-outline-secondary ms-2" @click="cancelEditingExercise" :disabled="isSaving">Cancel</button>
                                  </div>
                                  <div class="ms-auto">
                                    <button
                                      v-if="isAdminUser && Number(editExercise.IsGlobalExercise || 0) === 1 && Number(editExercise.IsSystemExercise || 0) !== 1"
                                      class="btn btn-danger exercise-delete-btn"
                                      @click="deleteExercise(editExercise)"
                                    >
                                      Delete Global Exercise
                                    </button>
                                    <button
                                      v-else-if="Number(editExercise.CanDelete || 0) === 1 && Number(editExercise.IsSystemExercise || 0) !== 1"
                                      class="btn btn-danger exercise-delete-btn"
                                      @click="deleteExercise(editExercise)"
                                    >
                                      Delete Exercise
                                    </button>
                                  </div>
                              </div>

                            </div>
                        </div>
                    </div>
                    <!-- Edit Excerise-->
                <!--add Excerise-->
            
                      <div v-if="showAddForm" class="row g-3 mt-3">

                        <div id="customExerciseForm" class="panel mt-2 custom-exercise-form-panel">
  <div class="panel-header">
    <h4>Add Exercise</h4>
  </div>
  <div class="panel-body row g-3">
    <div class="col-md-12 custom-exercise-field-row">
      <div v-if="addFormError" class="alert alert-danger mb-2">{{ addFormError }}</div>
      <label class="form-label">Exercise Name <span style="color:red">*</span></label>
      <input v-model="newExercise.ExerciseTitle" class="form-control" required />
    </div>

    <div class="col-md-12 custom-exercise-field-row">
      <label class="form-label">Workout Type <span style="color:red">*</span></label>
      <div class="custom-exercise-select-wrap">
        <select v-model="newExercise.WorkoutType" class="form-select custom-exercise-form-select" required>
          <option v-for="type in workoutTypeOptions" :key="type" :value="type">{{ type }}</option>
        </select>
        <span class="custom-exercise-select-arrow" aria-hidden="true">▼</span>
      </div>
    </div>

    <div class="col-md-12 custom-exercise-field-row">
      <label class="form-label">Muscle Group <span style="color:red">*</span></label>
      <div class="custom-exercise-select-wrap">
        <select v-model="newExercise.MuscleGroup" class="form-select custom-exercise-form-select" required>
          <option v-for="group in getMuscleGroupOptionsForWorkoutType(newExercise.WorkoutType, { allowStrengthAll: true })" :key="group" :value="group">{{ group }}</option>
        </select>
        <span class="custom-exercise-select-arrow" aria-hidden="true">▼</span>
      </div>
    </div>

    <div class="col-md-12 custom-exercise-field-row">
      <label class="form-label">Recording Type</label>
      <div class="custom-exercise-select-wrap">
        <select v-model="newExercise.RecordingType" class="form-select custom-exercise-form-select">
          <option v-for="type in recordingTypeOptions" :key="type" :value="type">{{ type }}</option>
        </select>
        <span class="custom-exercise-select-arrow" aria-hidden="true">▼</span>
      </div>
    </div>

    <div class="col-md-12 custom-exercise-field-row">
      <label class="form-label">Equipment</label>
      <input v-model="newExercise.Equipment" class="form-control" />
    </div>

    <div v-if="canChooseScope" class="col-md-12 custom-exercise-field-row">
      <label class="form-label">Exercise Scope</label>
      <div class="custom-exercise-select-wrap">
        <select v-model="selectedExerciseScope" class="form-select custom-exercise-form-select">
          <option v-for="scope in exerciseScopeOptions" :key="scope.value" :value="scope.value">{{ scope.label }}</option>
        </select>
        <span class="custom-exercise-select-arrow" aria-hidden="true">▼</span>
      </div>
      <p class="form-text mt-1 mb-0 exercise-scope-helper-text">
        <span v-if="selectedExerciseScope === 'SYSTEM'">System exercises are visible to all authenticated users.</span>
        <span v-else-if="selectedExerciseScope === 'SHARED' && isAdminUser">Choose a valid trainer owner before saving.</span>
        <span v-else-if="selectedExerciseScope === 'SHARED'">Your trainer account will own this shared exercise.</span>
        <span v-else>Custom exercises are discoverable unless restricted by supported privacy controls.</span>
      </p>
    </div>

    <div v-if="isAdminUser && selectedExerciseScope === 'SHARED'" class="col-md-12 custom-exercise-field-row">
      <label class="form-label">Trainer Owner <span style="color:red">*</span></label>
      <div class="custom-exercise-select-wrap">
        <select v-model.number="newExercise.OwnerTrainerID" class="form-select custom-exercise-form-select" :disabled="trainerOwnerOptionsLoading">
          <option value="" disabled>Select a trainer</option>
          <option v-for="trainer in trainerOwnerOptions" :key="trainer.id" :value="trainer.id">{{ trainer.label }}</option>
        </select>
        <span class="custom-exercise-select-arrow" aria-hidden="true">▼</span>
      </div>
      <p v-if="trainerOwnerOptionsLoading" class="form-text mt-1 mb-0">Loading trainer accounts...</p>
      <p v-else-if="trainerOwnerOptionsError" class="form-text mt-1 mb-0 text-danger">{{ trainerOwnerOptionsError }}</p>
    </div>

    <div class="col-md-12 custom-exercise-upload-section">
      <div class="custom-exercise-upload-header">
        <div class="custom-exercise-upload-title-wrap">
          <span class="custom-exercise-upload-label">Images</span>
          <span class="custom-exercise-upload-optional">Optional</span>
        </div>
        <span class="custom-exercise-upload-meta">JPG, PNG, GIF or WEBP — Maximum 2 images.</span>
      </div>

      <label
        class="custom-exercise-upload-box"
        :class="{ 'is-disabled': imagePreviews.length + existingImages.length >= 2 }"
        :for="imagePreviews.length + existingImages.length >= 2 ? '' : 'add-global-exercise-upload'"
      >
        <input
          id="add-global-exercise-upload"
          type="file"
          multiple
          accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
          @change="handleImageUpload"
          class="custom-exercise-upload-input"
          :disabled="imagePreviews.length + existingImages.length >= 2"
        />
        <span class="custom-exercise-upload-icon"><i class="fa-solid fa-image"></i></span>
        <span class="custom-exercise-upload-action">Choose Images</span>
      </label>

      <div v-if="imagePreviews.length || existingImages.length" class="custom-exercise-image-previews">
        <div v-for="(img, index) in imagePreviews" :key="'new-' + index" class="custom-exercise-image-preview">
          <img :src="img" class="custom-exercise-preview-image" />
          <button type="button" class="custom-exercise-image-remove" @click="removeNewImage(index)" aria-label="Remove selected image">&times;</button>
        </div>
        <div v-for="(img, index) in existingImages" :key="'exist-' + index" class="custom-exercise-image-preview">
          <img :src="getExerciseImage({ ExerciseID: newExercise.ExerciseID, PrimaryImage: img, ImageGallery: [img] })" class="custom-exercise-preview-image" />
          <button type="button" class="custom-exercise-image-remove" @click="removeExistingImage(img)" aria-label="Remove existing image">&times;</button>
          <div class="custom-exercise-image-name">{{ img.split('/').pop() }}</div>
        </div>
      </div>
    </div>

    <div class="col-md-12 custom-exercise-field-row custom-exercise-field-row--multiline">
      <label class="form-label">YouTube Video URL (Optional)</label>
      <div>
        <input
          v-model="newExercise.YouTubeVideoURL"
          type="url"
          class="form-control"
          placeholder="https://www.youtube.com/watch?v=VIDEO_ID"
        />
        <p class="form-text mt-1 mb-0 youtube-url-helper-text">Supported links: youtube.com/watch, youtu.be, youtube.com/shorts, and youtube.com/embed.</p>
      </div>
    </div>










    <div class="col-md-12 custom-exercise-field-row custom-exercise-field-row--multiline">
      <label class="form-label">Instructions</label>
      <textarea v-model="newExercise.Instructions" class="form-control instructions" rows="3" />
    </div>

    <div class="col-12 mt-3 custom-exercise-form-actions">
      <button class="btn btn-primary custom-exercise-create-button" @click="AddWorkout">Add Exercise</button>
      <button class="btn btn-outline-secondary ms-2 custom-exercise-cancel-button" @click="closeAddExercise">Cancel</button>
    </div>
  </div>
</div>
                    </div>
                    <!-- ADD Excerise-->





                      <!--LIST VIEW-->
                      <div class="row g-3 mt-2">
                        <div class="results-header-row">
                          <div class="results-header-title-group">
                            <span class="results-title">Results</span>
                          </div>
                          <div class="results-display-toggle" role="group" aria-label="Exercise results display mode">
                            <button
                              type="button"
                              class="results-display-btn"
                              :class="{ 'results-display-btn--active': resultsDisplayMode === 'list' }"
                              @click="resultsDisplayMode = 'list'"
                              :aria-pressed="resultsDisplayMode === 'list'"
                              title="List view"
                            >
                              <i class="fa-solid fa-list" aria-hidden="true"></i>
                              <span>List</span>
                            </button>
                            <button
                              type="button"
                              class="results-display-btn"
                              :class="{ 'results-display-btn--active': resultsDisplayMode === 'grid' }"
                              @click="resultsDisplayMode = 'grid'"
                              :aria-pressed="resultsDisplayMode === 'grid'"
                              title="Grid view"
                            >
                              <i class="fa-solid fa-table-cells" aria-hidden="true"></i>
                              <span>Grid</span>
                            </button>
                            <button
                              v-if="isAdminUser"
                              class="btn btn-success exercise-toolbar-add exercise-toolbar-add--icon"
                              @click="openAddExercise({ global: true })"
                              title="Create Exercise"
                              aria-label="Create Exercise"
                            >
                              <i class="fa-solid fa-plus" aria-hidden="true"></i>
                            </button>
                          </div>
                        </div>

                        <div class="exercise-list" :class="{ 'exercise-list--grid': resultsDisplayMode === 'grid' }">
                            <div class="exercise-row" v-for="ex in pagedExercises" :key="ex.ExerciseID">
                              <div class="exercise-img">
                                  <img
                                    :src="getFirstImage(ex)"
                                    @click="selectExerciseFromList(ex)"
                                    class="clickable"
                                  />
                              </div>

                              <div class="exercise-info">
                                  <h5 class="exercise-title">{{ ex.ExerciseTitle }}</h5>

                                  <div class="exercise-meta" aria-label="Exercise details">
                                    <span
                                      v-if="normalizeExerciseScope(ex) !== 'CUSTOM'"
                                      class="exercise-badge exercise-badge--global"
                                    >
                                      {{ getScopeLabel(ex) }}
                                    </span>
                                    <span class="exercise-meta-item">
                                      <i class="fa-solid fa-dumbbell" aria-hidden="true"></i>
                                      {{ ex.WorkoutType }}
                                    </span>
                                    <span class="exercise-meta-item">
                                      <i class="fa-solid fa-heart-pulse" aria-hidden="true"></i>
                                      {{ ex.MuscleGroup }}
                                    </span>
                                    <span class="exercise-meta-item">
                                      <i class="fa-solid fa-toolbox" aria-hidden="true"></i>
                                      {{ ex.Equipment }}
                                    </span>
                                  </div>

                                  <div class="exercise-actions exercise-actions--icon-only">
                                    <button
                                      v-if="canEditExercise(ex)"
                                      class="btn btn-sm btn-edit-exercise exercise-action-icon-btn exercise-action-icon-btn--edit"
                                      @click="startEditing(ex)"
                                      title="Edit Exercise"
                                      aria-label="Edit Exercise"
                                    >
                                      <i class="fa-solid fa-pen-to-square" aria-hidden="true"></i>
                                    </button>
                                    <button
                                      :class="[
                                        'btn',
                                        'btn-sm',
                                        'btn-fav',
                                        'exercise-action-icon-btn',
                                        'exercise-action-icon-btn--fav',
                                        isFavoriteExercise(ex.ExerciseID) && 'btn-fav--active'
                                      ]"
                                      @click="toggleFavoriteExercise(ex)"
                                      :title="isFavoriteExercise(ex.ExerciseID) ? 'Unfavorite Exercise' : 'Favorite Exercise'"
                                      :aria-label="isFavoriteExercise(ex.ExerciseID) ? 'Unfavorite Exercise' : 'Favorite Exercise'"
                                    >
                                      <i
                                        :class="isFavoriteExercise(ex.ExerciseID) ? 'fa-solid fa-heart' : 'fa-regular fa-heart'"
                                        aria-hidden="true"
                                      ></i>
                                    </button>
                                    <button
                                      v-if="canDeleteExerciseFromUi(ex)"
                                      class="btn btn-sm btn-danger exercise-action-icon-btn exercise-action-icon-btn--delete"
                                      @click="deleteExercise(ex)"
                                      :title="Number(ex.IsSystemExercise || 0) === 1 ? 'Delete System Exercise' : 'Delete Exercise'"
                                      :aria-label="Number(ex.IsSystemExercise || 0) === 1 ? 'Delete System Exercise' : 'Delete Exercise'"
                                    >
                                      <i class="fa-solid fa-trash" aria-hidden="true"></i>
                                    </button>
                                  </div>
                              </div>
                            </div>

                            <div class="results-pagination-toolbar" role="toolbar" aria-label="Exercise results pagination toolbar">
                              <label class="rows-per-page-control" for="rowsPerPageSelect">
                                <span class="rows-per-page-label">Display</span>
                                <select
                                  id="rowsPerPageSelect"
                                  v-model.number="itemsPerPage"
                                  class="form-select rows-per-page-select"
                                  @change="onRowsPerPageChange"
                                >
                                  <option v-for="size in pageSizeOptions" :key="size" :value="size">{{ size }}</option>
                                </select>
                              </label>

                              <button class="btn btn-outline-secondary pagination-btn" @click="prevPage" :disabled="isFirstResultsPage">Previous</button>
                              <span class="pagination-info">Page {{ effectiveCurrentPage }} / {{ effectiveTotalPages }}</span>
                              <button class="btn btn-outline-dark pagination-btn" @click="nextPage" :disabled="isLastResultsPage">Next</button>

                            </div>
                        </div>
                      </div>
                      <!--LIST VIEW-->



                   

        
                  <!--end of WorkoutList-->
                  <!--End of panel body-->

              </div>
              <!-- /exercise-results-panel -->
            </div>
            <!-- /container-block -->
          </div>
          <!-- /search-exercises tab -->

          <!-- Favorite Exercises Section -->
  <div v-if="activeTab === 'favorite-exercises'" class="favorites-section">
    <div class="container container-block">
      <div class="panel search-filter-card favorites-panel">
        <div class="panel-header search-filter-head">
          <h3 class="m-0">Favorite Exercises</h3>
        </div>
        <div class="panel-body">
          <!-- Loading State -->
          <div v-if="loadingFavorites" class="text-center py-5">
            <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem; margin-bottom: 1rem;">
              <span class="visually-hidden">Loading...</span>
            </div>
            <p style="color: #64748b; font-size: 1rem;">Loading your favorites...</p>
          </div>

          <!-- Error State -->
          <div v-else-if="favoritesLoadError" class="text-center py-5">
            <i class="fa-solid fa-exclamation-triangle" style="font-size: 3rem; color: #dc3545; margin-bottom: 1rem;"></i>
            <p style="color: #dc3545; font-size: 1rem; font-weight: 600;">Error loading favorite exercises. Please try again.</p>
            <button class="btn btn-primary mt-2" @click="loadFavoriteExercises()">Try Again</button>
          </div>

          <!-- Empty State -->
          <div v-else-if="favoriteExercises.length === 0" class="text-center py-5">
            <i class="fa-solid fa-heart" style="font-size: 3rem; color: #cbd5e1; margin-bottom: 1rem;"></i>
            <p style="color: #64748b; font-size: 1rem;">
              No favorite exercises yet. Favorite exercises from the Search Exercises tab to see them here.
            </p>
          </div>

          <!-- Favorite Exercises List -->
          <div v-else class="row favorites-grid">
            <div v-for="ex in favoriteExercises" :key="ex.ExerciseID" class="col-sm-6 col-lg-4 col-xl-3 mb-4 favorite-exercise-item">
              <div class="exercise-card favorite-exercise-card">
                <div class="exercise-image">
                  <img
                    :src="getExerciseImage(ex)"
                    :alt="ex.ExerciseTitle"
                    class="img-fluid"
                    loading="lazy"
                    @error="$event.target.src = DEFAULT_EXERCISE_IMAGE"
                  />
                </div>
                <div class="exercise-content favorite-exercise-content">
                  <h5 class="exercise-title">{{ ex.ExerciseTitle }}</h5>
                  <div class="exercise-meta favorite-exercise-badges">
                    <span class="badge favorite-exercise-badge favorite-exercise-badge--type">{{ ex.WorkoutType }}</span>
                    <span class="badge favorite-exercise-badge favorite-exercise-badge--muscle">{{ ex.MuscleGroup }}</span>
                    <span class="badge favorite-exercise-badge favorite-exercise-badge--equipment">{{ ex.Equipment }}</span>
                  </div>
                </div>
                <div class="exercise-actions favorite-exercise-action">
                  <button
                    class="btn btn-sm btn-fav btn-fav--active favorite-exercise-toggle"
                    @click="toggleFavoriteExercise(ex)"
                  >
                    <i class="fa-solid fa-heart"></i> Unfav
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- My Custom Exercises Section -->
  <div>

  <div v-if="activeTab === 'custom-exercises'" class="container container-block">
    <div class="panel">
      <div class="panel-header custom-exercises-header">
        <div class="custom-exercises-header__title-wrap">
          <h4>{{ showAdminGlobalExercises ? 'My Global Exercises' : 'My Custom Exercises' }}</h4>
          <span
            v-if="showAdminGlobalExercises"
            class="custom-exercises-header__status"
            aria-live="polite"
          >
            Global view active
          </span>
        </div>
        <div class="custom-exercises-header__actions">
          <button
            v-if="isAdminUser"
            class="btn btn-sm custom-admin-global-toggle"
            :class="{ 'custom-admin-global-toggle--active': showAdminGlobalExercises }"
            @click="toggleAdminGlobalExercises"
            :aria-pressed="showAdminGlobalExercises"
            :title="showAdminGlobalExercises ? 'Show My Custom Exercises' : 'Show My Global Exercises'"
          >
            {{ showAdminGlobalExercises ? 'Show My Custom Exercises' : 'Show My Global Exercises' }}
          </button>
          <button
            class="btn btn-sm btn-success exercise-toolbar-add exercise-toolbar-add--icon custom-exercise-create-button custom-exercise-create-button--section"
            @click="openAddExercise({ global: false })"
            title="Create Exercise"
            aria-label="Create Exercise"
          >
            <i class="fa-solid fa-plus" aria-hidden="true"></i>
          </button>
        </div>
      </div>
      <div class="panel-body">
        <div
          v-if="creationSuccessBannerState.visible && creationSuccessBannerState.target === 'personal'"
          class="alert alert-success d-flex align-items-center"
          role="alert"
        >
          <i class="fa-solid fa-circle-check me-2"></i>
          <div>{{ creationSuccessBannerState.message }}</div>
        </div>

        <div v-if="customExercisesLoadError" class="alert alert-warning">{{ customExercisesLoadError }}</div>
        <div v-else-if="myCustomExercises.length === 0" class="text-center py-4">
          <p class="mb-2">No custom exercises created yet.</p>
          <p class="text-muted mb-3">Create your first custom exercise to personalize your workouts.</p>
        </div>
        <div v-else class="exercise-list">
          <div class="exercise-row" v-for="myEx in myCustomExercises" :key="`mine-${myEx.ExerciseID}`">
            <div class="exercise-img">
              <img :src="getFirstImage(myEx)" class="clickable" @click="selectExerciseForLog(myEx)" />
            </div>
            <div class="exercise-info">
              <h5 class="exercise-title">{{ myEx.ExerciseTitle }}</h5>
              <div class="exercise-meta">
                <p class="exercise-meta-inline">{{ myEx.WorkoutType }}<span class="meta-dot"> • </span>{{ myEx.MuscleGroup }}<span class="meta-dot"> • </span>{{ myEx.Equipment }}</p>
              </div>
              <div class="exercise-actions">
                <button class="btn btn-sm btn-primary" @click="selectExerciseForLog(myEx)">Add to Log</button>
                <button
                  v-if="canEditExercise(myEx)"
                  class="btn btn-sm btn-edit-exercise exercise-action-icon-btn exercise-action-icon-btn--edit"
                  @click="startEditing(myEx)"
                  title="Edit Exercise"
                  aria-label="Edit Exercise"
                >
                  <i class="fa-solid fa-pen-to-square" aria-hidden="true"></i>
                </button>
                <button
                  :class="[
                    'btn',
                    'btn-sm',
                    'btn-fav',
                    'exercise-action-icon-btn',
                    'exercise-action-icon-btn--fav',
                    isFavoriteExercise(myEx.ExerciseID) && 'btn-fav--active'
                  ]"
                  @click="toggleFavoriteExercise(myEx)"
                  :title="isFavoriteExercise(myEx.ExerciseID) ? 'Unfavorite Exercise' : 'Favorite Exercise'"
                  :aria-label="isFavoriteExercise(myEx.ExerciseID) ? 'Unfavorite Exercise' : 'Favorite Exercise'"
                >
                  <i
                    :class="isFavoriteExercise(myEx.ExerciseID) ? 'fa-solid fa-heart' : 'fa-regular fa-heart'"
                    aria-hidden="true"
                  ></i>
                </button>
                <button
                  v-if="canDeleteExerciseFromUi(myEx)"
                  class="btn btn-sm btn-danger exercise-action-icon-btn exercise-action-icon-btn--delete"
                  @click="deleteExercise(myEx)"
                  :title="Number(myEx.IsSystemExercise || 0) === 1 ? 'Delete System Exercise' : 'Delete Exercise'"
                  :aria-label="Number(myEx.IsSystemExercise || 0) === 1 ? 'Delete System Exercise' : 'Delete Exercise'"
                >
                  <i class="fa-solid fa-trash" aria-hidden="true"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>


  <!-- Workout Log container -->
  <div v-if="activeTab === 'workout-log'" class="container container-block">
         <div class="panel">
            <!--Start of panel-->

            <div v-if="addError" class="alert alert-danger mt-2">
            {{ addError }}
            </div>

            <div class="panel-header">
              <h4>Log Excerise</h4>
            </div>

            <div class="panel-body">
              <div class="search-filter-grid">
                <div class="search-filter-field full-width">
                  <label class="form-label">Search Exercise For Log</label>
                  <input
                    v-model="logSearchExercise"
                    class="form-control"
                    placeholder="Search as you type"
                    @keydown="onLogSearchKeydown"
                  />
                </div>
                <div class="search-filter-field">
                  <label class="form-label">Workout Type</label>
                  <select v-model="logWorkoutTypeFilter" class="form-select">
                    <option value="All">All</option>
                    <option value="Strength">Strength</option>
                    <option value="Cardio">Cardio</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div class="search-filter-field">
                  <label class="form-label">Muscle Group</label>
                  <select v-model="logMuscleGroupFilter" class="form-select">
                    <option v-for="group in muscleGroups" :key="`log-group-${group}`" :value="group">{{ group }}</option>
                  </select>
                </div>
                <div class="search-filter-field">
                  <label class="form-label">Equipment</label>
                  <select v-model="logEquipmentFilter" class="form-select">
                    <option v-for="equip in equipmentList" :key="`log-equip-${equip}`" :value="equip">{{ equip }}</option>
                  </select>
                </div>
                <div class="search-filter-field">
                  <label class="form-label">Library</label>
                  <select v-model="logOwnershipFilter" class="form-select">
                    <option value="all">All</option>
                    <option value="global">Global Exercises</option>
                    <option value="custom">My Custom Exercises</option>
                  </select>
                </div>
              </div>

              <div class="exercise-list mt-3" v-if="logExerciseMatches.length">
                <div
                  class="exercise-row"
                  v-for="(match, index) in logExerciseMatches"
                  :key="`log-match-${match.ExerciseID}`"
                  :class="{ 'exercise-row--active': index === logSuggestionIndex }"
                  @click="selectExerciseForLog(match)"
                >
                  <div class="exercise-img">
                    <img :src="getFirstImage(match)" class="clickable" />
                  </div>
                  <div class="exercise-info">
                    <h5 class="exercise-title">{{ match.ExerciseTitle }}</h5>
                    <p class="exercise-meta-inline">{{ match.WorkoutType }}<span class="meta-dot"> • </span>{{ match.MuscleGroup }}<span class="meta-dot"> • </span>{{ match.Equipment }}</p>
                  </div>
                </div>
              </div>
            </div>


            <!-- Strength / Cardio Inputs -->
            <div id="log-workout-form" class="mt-3" v-if="selectedExercise">
              <section class="log-selected-panel">
                <div class="log-selected-panel__header">
                  <div class="log-selected-panel__media" v-if="selectedImage !== 'fallback.jpg'">
                    <img
                      :src="selectedImage"
                      :alt="selectedExerciseMeta.title"
                      class="log-selected-panel__thumb"
                    />
                  </div>
                  <div class="log-selected-panel__summary">
                    <p class="log-selected-panel__eyebrow">Selected Exercise</p>
                    <h5 class="log-selected-panel__title">{{ selectedExerciseMeta.title }}</h5>
                    <div class="log-selected-panel__badges">
                      <span class="log-selected-panel__badge">{{ selectedExerciseMeta.muscleGroup }}</span>
                      <span class="log-selected-panel__badge">{{ selectedExerciseMeta.workoutType }}</span>
                      <span class="log-selected-panel__badge">{{ selectedExerciseMeta.recordingType }}</span>
                    </div>
                  </div>
                </div>

                <div class="log-selected-panel__body">
                  <section v-if="selectedExerciseYouTubeEmbedUrl" class="exercise-video-panel" aria-label="Exercise demonstration video">
                    <p class="exercise-video-panel__label">Video Demonstration</p>
                    <div class="exercise-video-panel__frame-wrap">
                      <iframe
                        class="exercise-video-panel__frame"
                        :src="selectedExerciseYouTubeEmbedUrl"
                        :title="`YouTube demonstration for ${selectedExerciseMeta.title}`"
                        loading="lazy"
                        referrerpolicy="strict-origin-when-cross-origin"
                        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowfullscreen
                      ></iframe>
                    </div>
                    <a
                      v-if="selectedExerciseYouTubeWatchUrl"
                      :href="selectedExerciseYouTubeWatchUrl"
                      class="exercise-video-panel__link"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open on YouTube
                    </a>
                  </section>

                  <div class="log-selected-panel__grid">
                    <div v-if="usesSetsAndRepsLogging" class="log-field">
                      <label class="form-label log-field__label">Weight (lbs)</label>
                      <input v-model.number="exercise.weight" type="number" class="form-control log-field__input" min="1" />
                    </div>
                    <div v-if="usesSetsAndRepsLogging" class="log-field">
                      <label class="form-label log-field__label">Reps</label>
                      <input v-model.number="exercise.reps" type="number" class="form-control log-field__input" min="1" />
                    </div>
                    <div v-if="usesSetsAndRepsLogging" class="log-field">
                      <label class="form-label log-field__label">Sets</label>
                      <input v-model.number="exercise.sets" type="number" class="form-control log-field__input" min="1" />
                    </div>
                    <div v-if="usesTimeDistanceLogging" class="log-field">
                      <label class="form-label log-field__label">Distance (mi)</label>
                      <input v-model.number="exercise.distance" type="number" class="form-control log-field__input" min="0" step="0.01" />
                    </div>
                    <div v-if="usesTimeDistanceLogging" class="log-field">
                      <label class="form-label log-field__label">Laps / Rep</label>
                      <input v-model.number="exercise.lapsRep" type="number" class="form-control log-field__input" min="0" />
                    </div>
                    <div v-if="usesTimeDistanceLogging" class="log-field">
                      <label class="form-label log-field__label">Calories</label>
                      <input v-model.number="exercise.calories" type="number" class="form-control log-field__input" min="0" />
                    </div>
                    <div v-if="usesTimeDistanceLogging" class="log-field">
                      <label class="form-label log-field__label">Speed (mph)</label>
                      <input v-model.number="exercise.speed" type="number" class="form-control log-field__input" min="0" step="0.01" />
                    </div>
                  </div>

                  <div v-if="usesTimeDistanceLogging" class="log-timer-row">
                    <div class="log-field log-field--duration">
                      <label class="form-label log-field__label">Duration (min)</label>
                      <input v-model.number="exercise.duration" type="number" class="form-control log-field__input" min="0" step="0.01" />
                    </div>
                    <div class="log-timer-row__controls">
                      <button class="btn btn-outline-secondary" type="button" @click="toggleStopwatch">{{ stopwatchRunning ? 'Stop' : 'Start' }}</button>
                      <div class="log-timer-row__elapsed" aria-live="polite">{{ formattedStopwatch }}</div>
                      <button v-if="stopwatchRunning || stopwatchTime > 0" class="btn btn-outline-danger" type="button" @click="resetStopwatch">Reset</button>
                    </div>
                  </div>

                  <div class="log-selected-panel__actions">
                    <button
                      class="btn btn-secondary log-selected-panel__back-btn"
                      @click="activeTab = 'search-exercises'"
                      aria-label="Back to exercise list"
                      title="Back to exercise list"
                    >
                      <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
                    </button>
                    <button @click="addExercise" class="btn btn-primary log-selected-panel__submit-btn">Log Exercise</button>
                  </div>
                </div>
              </section>

            </div><!--End of rightColumn-->

            <div id="log-workout-form" class="row g-3 mt-3" v-if="!selectedExercise">
              <div class="col-md-4">
 <button class="btn btn-secondary" @click="activeTab = 'search-exercises'">Select excerise.</button>
              </div>
              <div class="col-md-8">
Please Select an excerise
              </div>
              
            </div>

            
            <!--End of row-->

           
         </div>
</div>


<!-- Workout Log Panel -->
<div v-if="activeTab === 'workout-log'" class="container mt-8 container-block">
  <div class="panel">

    <!-- Workout Log -->
    <div class="panel-header">
      <h4>Workout Log</h4>
      <!-- Summary header below Workout Log header -->
      <div class="workout-log-summary" style="margin-top: 6px; margin-bottom: 10px; font-size: 1rem; font-weight: 500;">
        Exercises Completed: {{ combinedWorkoutLogs.length }}<br />
        Date: {{ selectedDate }}
      </div>
    </div>
    <div class="panel-body">


<!-- Workout Log Table (Header) -->
<div class="row font-weight-bold" style="display: flex;">
  <div style="flex-basis: 20%; max-width: 20%;">Excerise:</div>
  <div style="flex-basis: 70%; max-width: 70%;">Info</div>
  <div style="flex-basis: 10%; max-width: 10%;">Action</div>
</div>
<!-- Workout Log Table (Rows) -->
<div class="list-group-item d-flex align-items-start" v-for="(log, idx) in combinedWorkoutLogs" :key="log.WorkoutLogID || log.id || idx" style="display: flex; align-items: flex-start;">
  <!-- Exercise Name and Image (20%) -->
  <div style="flex-basis: 20%; max-width: 20%; display: flex; flex-direction: column; align-items: flex-start; justify-content: flex-start; padding-right: 15px;">
    <div class="logged-exercise-title" style="font-weight: bold; font-size: 0.92rem; margin-bottom: 4px; line-height: 1.1;">{{ log.name || log.ExerciseTitle }}</div>
    <img
      :src="log.image || getFirstImage(log)"
      class="summary-img me-3 img-fluid"
      style="width: 100%; height: auto; max-width: 100%; object-fit: cover; border-radius: 8px; margin-left: 0; align-self: flex-start; vertical-align: top;"
    />
  </div>
  <!-- Info (70%) -->
  <div style="flex-basis: 70%; max-width: 70%;">
    <div class="row">
      <!-- Sub-column 1: Reps, Sets, Weight, Duration -->
      <div class="col-6">
        <div class="row align-items-center mb-2">
          <div class="fw-bold" style="width:30%;min-width:60px;">Reps:</div>
          <div style="width:70%">
            <template v-if="rowEditState[idx]">
              <input v-model="log.reps" class="form-control" placeholder="Reps" />
            </template>
            <template v-else>
              <span>{{ log.reps }}</span>
            </template>
          </div>
        </div>
        <div class="row align-items-center mb-2">
          <div class="fw-bold" style="width:30%;min-width:60px;">Sets:</div>
          <div style="width:70%">
            <template v-if="rowEditState[idx]">
              <input v-model="log.sets" class="form-control" placeholder="Sets" />
            </template>
            <template v-else>
              <span>{{ log.sets }}</span>
            </template>
          </div>
        </div>
        <div class="row align-items-center mb-2">
          <div class="fw-bold" style="width:30%;min-width:60px;">Weight:</div>
          <div style="width:70%">
            <template v-if="rowEditState[idx]">
              <input v-model="log.weight" class="form-control" placeholder="Weight" />
            </template>
            <template v-else>
              <span>{{ log.weight }}</span>
            </template>
          </div>
        </div>
        <div class="row align-items-center mb-2">
          <div class="fw-bold" style="width:30%;min-width:60px;">Duration:</div>
          <div style="width:70%">
            <template v-if="rowEditState[idx]">
              <input v-model="log.duration" class="form-control" placeholder="Duration" />
            </template>
            <template v-else>
              <span>{{ log.duration }}</span>
            </template>
          </div>
        </div>
      </div>
      <!-- Sub-column 2: Calories, Distance, Speed -->
      <div class="col-6">
        <div class="row align-items-center mb-2">
          <div class="fw-bold" style="width:30%;min-width:60px;">Calories:</div>
          <div style="width:70%">
            <template v-if="rowEditState[idx]">
              <input v-model="log.calories" class="form-control" placeholder="calories" />
            </template>
            <template v-else>
              <span>{{ log.calories }}</span>
            </template>
          </div>
        </div>
        <div class="row align-items-center mb-2">
          <div class="fw-bold" style="width:30%;min-width:60px;">Distance:</div>
          <div style="width:70%">
            <template v-if="rowEditState[idx]">
              <input v-model="log.distance" class="form-control" placeholder="distance" />
            </template>
            <template v-else>
              <span>{{ log.distance }}</span>
            </template>
          </div>
        </div>
        <div class="row align-items-center mb-2">
          <div class="fw-bold" style="width:30%;min-width:60px;">Speed:</div>
          <div style="width:70%">
            <template v-if="rowEditState[idx]">
              <input v-model="log.speed" class="form-control" placeholder="speed" />
            </template>
            <template v-else>
              <span>{{ log.speed }}</span>
            </template>
          </div>
        </div>
        <div class="row align-items-center mb-2">
          <div class="fw-bold" style="width:30%;min-width:60px;">Laps-Rep:</div>
          <div style="width:70%">
            <template v-if="rowEditState[idx]">
              <input v-model="log['Laps-Rep']" class="form-control" placeholder="Laps-Rep" />
            </template>
            <template v-else>
              <span>{{ log['Laps-Rep'] }}</span>
            </template>
          </div>
        </div>
      </div>
    </div>
   <p></p>
  </div>
  <!-- Actions (10%) -->
  <div style="flex-basis: 10%; max-width: 10%; display: flex; flex-direction: column; align-items: center; justify-content: center;">
    <!-- Edit (pen) icon: show only if not in edit mode for this row -->
    <button v-if="!rowEditState[idx]" @click="editLog(log, idx)" class="btn btn-sm mb-2 log-action-btn" title="Edit" style="background-color: #6c757d; border-color: #6c757d;">
      <i class="fas fa-pen log-action-icon" style="color: #fff;"></i>
    </button>
    <!-- Save (disk) icon: show only if in edit mode for this row -->
    <button v-if="rowEditState[idx]" @click="updateLog(log, idx)" class="btn btn-sm mb-2 log-action-btn" title="Save" style="background-color: #e53935; border-color: #e53935; color: #fff;">
      <i class="fas fa-save log-action-icon"></i>
    </button>
    <button @click="removeLog(log, idx)" class="btn btn-sm btn-danger log-action-btn"><span class="log-action-icon" style="display:inline-block; line-height:1;">ðŸ—‘ï¸</span></button>
  </div>
</div>
<!-- End of Log -->

      

      

    </div>
    <!-- Save Workout-->
       <button 
            @click="saveWorkout" 
            class="btn btn-success" 
            :disabled="!userId || workoutList.length === 0">
            Save Workouts
          </button>  
        <!--End of Save Workout-->  
  </div>
</div>





  </div><!--end ofLog Exercise Section-->
</div><!-- End of tab-content -->
</div><!-- End of ex-page-body: Exercise Section -->
  </div>
  </div>
</template>
<style scoped>
/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   BASE / DESKTOP
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.exercises-page {
  display: block;
  overflow-x: hidden;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  background: #0b1320;
}

.custom-exercise-create-button--section {
  background: #16A34A !important;
  border-color: #16A34A !important;
  color: #ffffff !important;
  box-shadow: none !important;
}

.custom-exercises-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.custom-exercises-header__title-wrap {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.custom-exercises-header__status {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(56, 189, 248, 0.2);
  border: 1px solid rgba(125, 211, 252, 0.38);
  color: #dff6ff;
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;
}

.custom-exercises-header__actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.custom-admin-global-toggle {
  background: #1E3A8A !important;
  border: 1px solid #1E3A8A !important;
  color: #ffffff !important;
  font-weight: 700;
  min-height: 32px;
  padding: 0 12px;
  border-radius: 8px;
}

.custom-admin-global-toggle:hover,
.custom-admin-global-toggle:focus-visible {
  background: #1D4ED8 !important;
  border-color: #1D4ED8 !important;
  color: #ffffff !important;
}

.custom-admin-global-toggle--active {
  background: #1D4ED8 !important;
  border-color: #1D4ED8 !important;
}

.custom-exercise-create-button--section:hover,
.custom-exercise-create-button--section:focus,
.custom-exercise-create-button--section:active {
  background: #15803d !important;
  border-color: #15803d !important;
  color: #ffffff !important;
  box-shadow: none !important;
}

#customExerciseForm {
  border: none !important;
  box-shadow: none !important;
  background: transparent !important;
  border-radius: 0 !important;
}

#customExerciseForm .panel-header {
  padding: 0 0 12px !important;
  margin: 0 0 8px !important;
  background: transparent !important;
  border: none !important;
  border-top: none !important;
  border-right: none !important;
  border-left: none !important;
  border-bottom: 1px solid rgba(145, 166, 214, 0.28) !important;
  box-shadow: none !important;
  border-radius: 0 !important;
  height: auto !important;
  display: flex !important;
  align-items: center !important;
}

.exercise-delete-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(3, 8, 17, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 24px;
}

.exercise-delete-modal {
  position: relative;
  width: min(100%, 430px);
  background: #101a2f;
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 18px;
  box-shadow: 0 22px 60px rgba(0, 0, 0, 0.42);
  padding: 28px 24px 20px;
  color: #edf4ff;
}

.exercise-delete-modal-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 50%;
  background: rgba(148, 163, 184, 0.12);
  color: #dfe8ff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.exercise-delete-modal-icon {
  width: 62px;
  height: 62px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
  background: rgba(220, 53, 69, 0.14);
  color: #ff6b7d;
  font-size: 1.7rem;
}

.exercise-delete-success-icon {
  background: rgba(34, 197, 94, 0.14);
  color: #4ade80;
}

.exercise-delete-modal-title {
  margin: 0;
  text-align: center;
  font-size: 1.65rem;
  font-weight: 700;
  color: #fff;
}

.exercise-delete-modal-name {
  margin: 12px 0 10px;
  text-align: center;
  font-size: 1.02rem;
  font-weight: 700;
  color: #f8fbff;
  word-break: break-word;
}

.exercise-delete-modal-copy,
.exercise-delete-modal-warning {
  margin: 0;
  text-align: center;
  color: rgba(225, 234, 247, 0.8);
  line-height: 1.55;
  font-size: 0.97rem;
}

.exercise-delete-modal-warning {
  margin-top: 10px;
  color: #ffd9a8;
  font-weight: 600;
}

.exercise-delete-modal-error {
  margin-top: 14px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(220, 53, 69, 0.12);
  border: 1px solid rgba(220, 53, 69, 0.35);
  color: #ffc6cf;
  font-size: 0.9rem;
  text-align: center;
}

.exercise-delete-modal-actions {
  margin-top: 18px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.exercise-delete-modal-cancel {
  min-width: 98px;
  background: rgba(148, 163, 184, 0.18) !important;
  border-color: rgba(148, 163, 184, 0.28) !important;
  color: #f6f9ff !important;
}

.exercise-delete-modal-confirm {
  min-width: 162px;
}

.exercise-delete-success-ok {
  min-width: 108px;
}

#customExerciseForm .panel-header h4 {
  margin: 0;
  color: #fff;
  font-weight: 700;
  line-height: 1.3;
}

.custom-exercise-form-panel .panel-body {
  max-height: calc(100vh - 260px);
  overflow-y: auto;
  overflow-x: hidden;
  --bs-gutter-x: 16px;
  --bs-gutter-y: 8px;
}

.custom-exercise-field-row {
  display: grid;
  grid-template-columns: minmax(88px, 34%) minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  margin-bottom: 10px;
}

.custom-exercise-field-row > .alert {
  grid-column: 1 / -1;
}

.custom-exercise-field-row .form-label {
  min-width: 0;
  margin: 0;
  font-size: 0.82rem;
  font-weight: 700;
  line-height: 1.35;
  letter-spacing: 0.01em;
  color: #edf3ff;
}

.custom-exercise-field-row .exercise-scope-helper-text {
  color: #cbd5e1;
}

.custom-exercise-field-row .form-control,
.custom-exercise-field-row .form-select {
  width: 100%;
  min-width: 0;
  min-height: 40px;
  background: rgba(18, 26, 39, 0.8) !important;
  border: 1px solid rgba(145, 166, 214, 0.36) !important;
  border-radius: 10px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02);
  color: #f4f8ff;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
}

.wa-global-toggle-stack {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 6px;
}

.wa-global-toggle-header-row {
  display: flex;
  align-items: center;
}

.wa-global-toggle-header {
  color: #edf3ff;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  line-height: 1.2;
}

.wa-global-toggle-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 0;
  margin: 0;
  padding: 0;
}

.wa-global-toggle {
  appearance: auto;
  -webkit-appearance: checkbox;
  width: 18px;
  height: 18px;
  flex: 0 0 18px;
  margin: 0;
  cursor: pointer;
  accent-color: #2f6bff;
  border-radius: 4px;
  transform: translateY(0);
}

.wa-global-toggle:focus,
.wa-global-toggle:focus-visible {
  outline: 2px solid rgba(78, 130, 255, 0.8);
  outline-offset: 2px;
}

.wa-global-toggle-helper {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  color: rgba(237, 243, 255, 0.82);
  font-size: 0.88rem;
  line-height: 1.35;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.wa-global-toggle-helper strong {
  font-weight: 700;
  color: #edf3ff;
}

.wa-exercise-toast {
  position: fixed;
  top: 18px;
  right: 18px;
  z-index: 2000;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: min(360px, calc(100vw - 24px));
  padding: 12px 14px 12px 12px;
  border: 1px solid rgba(120, 171, 255, 0.26);
  border-left: 4px solid #30c28a;
  border-radius: 12px;
  background: rgba(9, 18, 31, 0.96);
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.28);
  color: #edf3ff;
}

.wa-exercise-toast__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
  border-radius: 50%;
  background: rgba(48, 194, 138, 0.14);
  color: #6fe0ab;
  font-size: 0.96rem;
}

.wa-exercise-toast__content {
  flex: 1 1 auto;
  min-width: 0;
}

.wa-exercise-toast__title {
  margin: 0 0 2px;
  color: #f4f8ff;
  font-size: 0.92rem;
  font-weight: 700;
  line-height: 1.25;
}

.wa-exercise-toast__message {
  margin: 0;
  color: rgba(237, 243, 255, 0.8);
  font-size: 0.82rem;
  line-height: 1.35;
}

.wa-exercise-toast__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: rgba(237, 243, 255, 0.72);
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.wa-exercise-toast__close:hover,
.wa-exercise-toast__close:focus-visible {
  background: rgba(255, 255, 255, 0.06);
  color: #ffffff;
  outline: none;
}

@media (max-width: 575.98px) {
  .wa-exercise-toast {
    top: 12px;
    right: 12px;
    left: 12px;
    width: auto;
  }
  .wa-global-toggle-stack {
    gap: 5px;
  }

  .custom-exercises-header {
    align-items: stretch;
  }

  .custom-exercises-header__title-wrap {
    width: 100%;
    justify-content: space-between;
  }

  .custom-exercises-header__actions {
    width: 100%;
    justify-content: flex-end;
    flex-wrap: wrap;
  }

  .custom-admin-global-toggle {
    flex: 1 1 auto;
    min-width: 200px;
  }

  .wa-global-toggle-row {
    align-items: flex-start;
    gap: 8px;
  }

  .wa-global-toggle-helper {
    flex: 1 1 auto;
  }
}

.custom-exercise-field-row .custom-exercise-select-wrap {
  position: relative;
  width: 100%;
}

.custom-exercise-field-row .custom-exercise-form-select {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  padding-right: 2.5rem;
}

.custom-exercise-field-row .custom-exercise-select-arrow {
  position: absolute;
  right: 0.9rem;
  top: 50%;
  transform: translateY(-50%);
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.7rem;
  line-height: 1;
  pointer-events: none;
}

.custom-exercise-field-row .form-control:focus,
.custom-exercise-field-row .form-select:focus,
.custom-exercise-field-row .form-control:focus-visible,
.custom-exercise-field-row .form-select:focus-visible {
  background: rgba(22, 31, 48, 0.94) !important;
  border-color: rgba(118, 155, 255, 0.8) !important;
  box-shadow: 0 0 0 3px rgba(92, 134, 255, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.03);
  outline: none;
}

.custom-exercise-field-row--multiline {
  align-items: start;
}

.custom-exercise-field-row--multiline .form-label {
  padding-top: 10px;
}

.custom-exercise-field-row--multiline .instructions {
  min-height: 96px;
  resize: vertical;
}

.custom-exercise-upload-section {
  min-width: 0;
  overflow: hidden;
  padding: 12px 0 0;
}

.custom-exercise-upload-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
}

.custom-exercise-upload-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.custom-exercise-upload-label {
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  color: #edf3ff;
}

.custom-exercise-upload-optional {
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(115, 144, 213, 0.12);
  border: 1px solid rgba(145, 166, 214, 0.28);
  color: #dbe7ff;
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.custom-exercise-upload-meta {
  font-size: 0.72rem;
  color: #c8d8ff;
  line-height: 1.4;
}

.custom-exercise-upload-box {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  min-height: 58px;
  padding: 12px 16px;
  border: 1px dashed rgba(140, 170, 255, 0.42);
  border-radius: 12px;
  background: rgba(17, 25, 38, 0.72);
  color: #edf4ff;
  cursor: pointer;
  transition: border-color 0.18s ease, background-color 0.18s ease, transform 0.18s ease;
}

.custom-exercise-upload-box:hover {
  background: rgba(21, 31, 48, 0.86);
  border-color: rgba(145, 170, 255, 0.72);
}

.custom-exercise-upload-box.is-disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.custom-exercise-upload-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.custom-exercise-upload-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: rgba(104, 140, 255, 0.14);
  border: 1px solid rgba(133, 164, 255, 0.28);
  color: #cfe0ff;
  font-size: 1rem;
}

.custom-exercise-upload-action {
  font-size: 0.8rem;
  font-weight: 700;
  color: #edf4ff;
}

.custom-exercise-upload-empty {
  margin: 10px 0 0;
  color: #d9e5ff;
  font-size: 0.74rem;
  font-style: italic;
} 

.youtube-url-helper-text {
  color: #cbd5e1;
}

.edit-exercise-image-section {
  margin-top: 12px;
  display: grid;
  gap: 10px;
}

.edit-exercise-primary-preview {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: min(160px, 100%);
  min-height: 110px;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid rgba(150, 177, 255, 0.28);
  background: rgba(11, 18, 32, 0.72);
}

.edit-exercise-primary-preview__image {
  display: block;
  width: 100%;
  height: 110px;
  object-fit: cover;
  object-position: center;
}

.edit-exercise-primary-preview__failure {
  min-height: 110px;
  width: 100%;
  display: grid;
  place-items: center;
  gap: 8px;
  padding: 14px;
  text-align: center;
  color: #f8d7da;
  background: rgba(127, 29, 29, 0.24);
}

.edit-exercise-image-empty {
  margin: 0;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px dashed rgba(145, 160, 200, 0.26);
  background: rgba(15, 23, 42, 0.55);
  color: #d9e5ff;
  font-size: 0.84rem;
}

.edit-exercise-image-previews {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.edit-exercise-image-preview {
  position: relative;
  width: min(132px, 100%);
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(150, 177, 255, 0.28);
  background: rgba(11, 18, 32, 0.72);
}

.edit-exercise-preview-image {
  display: block;
  width: 100%;
  height: 132px;
  object-fit: cover;
  object-position: center;
}

.edit-exercise-image-remove {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 999px;
  background: rgba(15, 23, 35, 0.82);
  color: #f7faff;
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.edit-exercise-image-name {
  padding: 6px 8px 8px;
  font-size: 0.68rem;
  color: #dfeaff;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  background: rgba(12, 20, 30, 0.8);
}

.edit-exercise-image-failure {
  min-height: 132px;
  display: grid;
  place-items: center;
  gap: 8px;
  padding: 14px;
  text-align: center;
  color: #f8d7da;
  background: rgba(127, 29, 29, 0.24);
}

.edit-exercise-image-warning {
  margin: 0;
  color: #facc15;
  font-size: 0.8rem;
}

.custom-exercise-image-previews {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  max-width: 100%;
  margin-top: 12px;
}

.custom-exercise-image-preview {
  position: relative;
  width: min(120px, 100%);
  max-width: 100%;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(150, 177, 255, 0.28);
  background: rgba(11, 18, 32, 0.72);
}

.custom-exercise-preview-image {
  display: block;
  width: 100%;
  height: 120px;
  object-fit: cover;
  border-radius: 12px;
}

.custom-exercise-image-remove {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 999px;
  background: rgba(15, 23, 35, 0.82);
  color: #f7faff;
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.custom-exercise-image-name {
  padding: 5px 8px 7px;
  font-size: 0.62rem;
  color: #dfeaff;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  background: rgba(12, 20, 30, 0.8);
}

.custom-exercise-form-actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 8px;
  margin-top: 6px;
  padding-top: 4px;
}

.custom-exercise-form-actions .btn {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  padding: 8px 6px;
  margin-left: 0 !important;
  font-size: 0.82rem;
  white-space: nowrap;
}

.exercises-canvas {
  display: grid;
  gap: 14px;
  overflow-x: hidden;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.dashboard-breadcrumb {
  margin-bottom: 0;
  border-radius: 18px;
  border: 1px solid rgba(37, 99, 235, 0.3);
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.05);
}

.dashboard-breadcrumb h2 {
  margin: 0;
  color: #ffffff;
  font-weight: 800;
  letter-spacing: -0.015em;
}

.header-meta {
  color: #cbd5e1;
  font-weight: 600;
  margin-right: 10px;
}

.panel-header h4 {
  margin: 0;
  color: var(--ex-text, #f8fafc);
  font-weight: 800;
}

.panel-body {
  color: var(--ex-text-secondary, #a4b0c0);
}

.exercise-card {
  min-height: 120px;
  background-color: var(--ex-surface-2, #17212d);
  border-radius: 10px;
}
.exercise-card .exercise-image {
  width: 75%;
  margin: 0 auto;
}
.exercise-card .exercise-image img {
  width: 100%;
  height: auto;
  border-radius: 9px;
  display: block;
}
.image-box {
  flex-shrink: 0;
}
.exercise-list {
  display: flex;
  flex-direction: column;
  gap: 9px;
}
.exercise-row {
  display: grid;
  grid-template-columns: 118px minmax(0, 1fr);
  gap: 14px;
  padding: 12px;
  border: 1px solid rgba(145, 160, 200, 0.22);
  background: linear-gradient(180deg, rgba(22, 33, 57, 0.96), rgba(19, 29, 49, 0.96));
  border-radius: 12px;
  align-items: center;
  box-shadow: 0 10px 20px rgba(15, 23, 42, 0.18);
  transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease, background 0.16s ease;
  width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}
.exercise-row:hover {
  transform: translateY(-1px);
  border-color: rgba(145, 160, 200, 0.28);
  background: linear-gradient(180deg, rgba(26, 39, 65, 0.98), rgba(21, 32, 54, 0.98));
  box-shadow: 0 14px 26px rgba(37, 99, 235, 0.18);
}
.exercise-img img {
  width: 118px;
  height: 118px;
  object-fit: cover;
  border-radius: 10px;
}
.exercise-img {
  width: 118px;
  height: 118px;
  flex-shrink: 0;
  overflow: hidden;
  border-radius: 10px;
  border: 1px solid rgba(145, 160, 200, 0.18);
  background: rgba(17, 24, 39, 0.8);
}
.exercise-info {
  min-width: 0;
  display: grid;
  gap: 7px;
}
.exercise-title {
  font-weight: 800;
  font-size: 1.04rem;
  letter-spacing: -0.02em;
  color: var(--ex-text, #f8fafc);
  margin: 0;
  padding: 0;
  border: 0;
  line-height: 1.25;
}
.exercise-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 4px 8px;
  border: 1px solid transparent;
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: 0.01em;
  white-space: normal;
  max-width: 100%;
}
.exercise-badge--global {
  background: rgba(59, 130, 246, 0.14);
  color: #dbeafe;
  border-color: rgba(96, 165, 250, 0.35);
}
.exercise-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  align-items: center;
}
.exercise-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.06);
  border: 1px solid rgba(148, 163, 184, 0.14);
  color: var(--ex-text-secondary, #a4b0c0);
  font-size: 0.74rem;
  line-height: 1.2;
  white-space: normal;
  max-width: 100%;
}
.exercise-meta-item i {
  font-size: 0.68rem;
  opacity: 0.9;
}
.exercise-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 0;
  align-items: center;
}
.exercise-delete-btn {
  background-color: #e53935 !important;
  border-color: #e53935 !important;
  color: #fff !important;
  min-width: 140px;
}
.exercise-actions .btn {
  padding: 7px 12px;
  font-size: 0.8rem;
  border-radius: 8px;
  margin: 0;
  font-weight: 700;
  min-height: 34px;
}

.btn-fav {
  background: #dc2626;
  border: 1px solid #dc2626;
  color: #ffffff;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.btn-fav:hover {
  background: #b91c1c;
  border-color: #b91c1c;
  color: #ffffff;
}
.btn-fav--active {
  background: #dc2626;
  border-color: #dc2626;
  color: #ffffff;
}
.btn-fav--active .fa-heart {
  color: #ffffff;
}
.btn-fav--active:hover {
  background: #b91c1c;
  border-color: #b91c1c;
  color: #ffffff;
}

.btn-edit-exercise {
  background: var(--wa-action-blue, #2f6bff);
  border: 1px solid var(--wa-action-blue, #2f6bff);
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.btn-edit-exercise:hover,
.btn-edit-exercise:focus-visible {
  background: var(--wa-action-blue-hover, #2459d8);
  border-color: var(--wa-action-blue-hover, #2459d8);
  color: #ffffff;
}

.btn-fav i,
.btn-edit-exercise i {
  font-size: 0.94rem;
  line-height: 1;
}

.exercise-actions--icon-only {
  display: inline-flex !important;
  align-items: center;
  flex-wrap: nowrap !important;
  gap: 8px;
}

.exercise-actions--icon-only .exercise-action-icon-btn {
  width: 40px !important;
  min-width: 40px !important;
  max-width: 40px !important;
  height: 40px !important;
  min-height: 40px !important;
  padding: 0 !important;
  flex: 0 0 40px !important;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0;
}

.exercise-actions--icon-only .exercise-action-icon-btn i {
  font-size: 0.98rem;
  line-height: 1;
}

.exercise-actions--icon-only .exercise-action-icon-btn--fav {
  background: #dc2626;
  border-color: #dc2626;
  color: #ffffff;
}

.exercise-actions--icon-only .exercise-action-icon-btn--fav:hover,
.exercise-actions--icon-only .exercise-action-icon-btn--fav:focus-visible {
  background: #b91c1c;
  border-color: #b91c1c;
  color: #ffffff;
}

.exercise-actions--icon-only .exercise-action-icon-btn--edit {
  background: var(--wa-action-blue, #2f6bff);
  border-color: var(--wa-action-blue, #2f6bff);
  color: #ffffff;
}

.exercise-actions--icon-only .exercise-action-icon-btn--edit:hover,
.exercise-actions--icon-only .exercise-action-icon-btn--edit:focus-visible {
  background: var(--wa-action-blue-hover, #2459d8);
  border-color: var(--wa-action-blue-hover, #2459d8);
  color: #ffffff;
}

.exercise-action-icon-btn--delete {
  background: #dc2626;
  border-color: #dc2626;
  color: #ffffff;
}

.exercise-action-icon-btn--delete:hover,
.exercise-action-icon-btn--delete:focus-visible {
  background: #b91c1c;
  border-color: #b91c1c;
  color: #ffffff;
}

/* Edit Exercise Panel */
.edit-exercise-panel {
  border: 1px solid var(--ex-border, rgba(120, 145, 175, 0.16));
  border-radius: 12px;
  padding: 18px 20px;
  background: var(--ex-surface-2, #17212d);
  box-shadow: 0 10px 22px rgba(2, 6, 23, 0.16);
  margin-top: 20px !important;
}
.edit-exercise-panel .panel-header {
  padding-bottom: 12px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--ex-border, rgba(120, 145, 175, 0.16));
}
.edit-exercise-panel .panel-header h4 {
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--ex-text, #f8fafc);
  margin: 0;
}
.edit-exercise-panel .form-label {
  font-size: 0.76rem;
  font-weight: 700;
  color: var(--ex-text-secondary, #a4b0c0);
  margin-bottom: 5px;
}
.edit-exercise-panel .form-control,
.edit-exercise-panel .form-select {
  min-height: 38px;
  border: 1px solid var(--ex-border-strong, rgba(120, 145, 175, 0.24));
  background: var(--ex-surface-1, #121923);
  color: var(--ex-text, #f8fafc);
  font-size: 0.9rem;
}
.edit-exercise-panel .form-control:focus,
.edit-exercise-panel .form-select:focus {
  border-color: color-mix(in srgb, var(--ex-accent, #3b82f6) 60%, var(--ex-border-strong) 40%);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ex-accent, #3b82f6) 22%, transparent 78%);
}
.edit-exercise-panel .instructions {
  min-height: 150px;
}
.edit-exercise-panel .panel-body {
  padding: 0;
}

.instructions {
  min-height: 250px;
}
.container-block {
  margin-top: 0;
}
.container.container-block {
  max-width: 100% !important;
  width: 100% !important;
  padding-left: 0 !important;
  padding-right: 0 !important;
}
.workout-log-img {
  height: 200px;
  width: 350px;
}
.sel-ex-input {
  min-width: 100px;
  padding-bottom: 10px;
}
.log-selected-panel {
  display: grid;
  gap: 16px;
  padding: 16px;
  background: rgba(15, 23, 42, 0.74);
  border: 1px solid rgba(145, 160, 200, 0.2);
  border-radius: 14px;
}
.log-selected-panel__header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 16px;
  align-items: center;
}
.log-selected-panel__media {
  width: 112px;
  min-width: 112px;
}
.log-selected-panel__thumb {
  width: 112px;
  height: 112px;
  object-fit: cover;
  object-position: center;
  border-radius: 12px;
  border: 1px solid rgba(145, 160, 200, 0.24);
  display: block;
  background: rgba(15, 23, 42, 0.9);
}
.log-selected-panel__summary {
  min-width: 0;
}
.log-selected-panel__eyebrow {
  margin: 0 0 4px;
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ex-text-muted, #9ca3af);
}
.log-selected-panel__title {
  margin: 0;
  color: var(--ex-text, #f8fafc);
}
.log-selected-panel__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}
.log-selected-panel__badge {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.14);
  border: 1px solid rgba(96, 165, 250, 0.22);
  color: var(--ex-text-secondary, #dbe4ff);
  font-size: 0.82rem;
  font-weight: 600;
}
.log-selected-panel__body {
  display: grid;
  gap: 16px;
}

.exercise-video-panel {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.exercise-video-panel__label {
  margin: 0;
  color: var(--ex-text-secondary, #dbe4ff);
  font-size: 0.84rem;
  font-weight: 700;
}

.exercise-video-panel__frame-wrap {
  position: relative;
  width: 100%;
  max-width: 100%;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(145, 160, 200, 0.24);
  background: rgba(15, 23, 42, 0.8);
}

.exercise-video-panel__frame-wrap::before {
  content: '';
  display: block;
  padding-top: 56.25%;
}

.exercise-video-panel__frame {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
}

.exercise-video-panel__link {
  color: #93c5fd;
  font-size: 0.82rem;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.exercise-video-panel__link:hover,
.exercise-video-panel__link:focus-visible {
  color: #bfdbfe;
}
.log-selected-panel__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
.log-field {
  min-width: 0;
}
.log-field__label {
  margin-bottom: 6px;
  color: var(--ex-text-secondary, #dbe4ff);
  font-size: 0.84rem;
  font-weight: 600;
}
.log-field__input {
  min-height: 42px;
}
.log-field--duration {
  max-width: 180px;
}
.log-timer-row {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 12px;
}
.log-timer-row__controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.log-timer-row__elapsed {
  min-width: 88px;
  min-height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
  border-radius: 10px;
  background: rgba(23, 33, 58, 0.92);
  border: 1px solid rgba(145, 160, 200, 0.24);
  color: var(--ex-text, #f8fafc);
  font-weight: 700;
  letter-spacing: 0.04em;
}
.log-selected-panel__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.log-selected-panel__back-btn {
  width: 42px;
  min-width: 42px;
  height: 42px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.log-selected-panel__submit-btn {
  min-height: 42px;
  padding-inline: 18px;
}
textarea {
  resize: vertical;
}
.btn {
  margin: 2px;
}

.summary-img {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 8px;
}
.clickable {
  cursor: pointer;
}

/* â”€â”€ Tab bar â”€â”€ */
.ex-page-body {
  width: 100%;
  padding: 12px 12px 10px;
  margin: 0;
  background: rgba(27, 36, 68, 0.9);
  border: 1px solid rgba(145, 160, 200, 0.22);
  border-radius: 12px;
  box-shadow: 0 8px 22px rgba(2, 6, 23, 0.14);
  box-sizing: border-box;
  overflow-x: hidden;
}

.exercises-page .ex-page-body.app-section-card {
  background: rgba(27, 36, 68, 0.9) !important;
  border-color: rgba(145, 160, 200, 0.22) !important;
  border-radius: 12px !important;
  box-shadow: 0 8px 22px rgba(2, 6, 23, 0.14) !important;
}

.ex-tab-bar {
  display: flex;
  gap: 6px;
  padding: 6px;
  margin-bottom: 12px;
  background: rgba(19, 30, 51, 0.9);
  border: 1px solid rgba(145, 160, 200, 0.18);
  border-radius: 8px;
  box-shadow: none;
}

.ex-view-switch {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: stretch;
  gap: 4px;
  padding: 6px;
  margin-bottom: 12px;
  background: rgba(19, 30, 51, 0.9);
  border: 1px solid rgba(145, 160, 200, 0.18);
  border-radius: 8px;
  box-shadow: none;
}
.ex-view-switch.wa-h-tabs {
  display: grid !important;
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  align-items: stretch;
}

.ex-view-switch__link {
  flex: 1 1 auto;
  width: 100%;
  min-height: 48px;
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 7px;
  background: #1b2444;
  border: none;
  color: #ffffff;
  text-decoration: none;
  font-size: 12px;
  font-weight: 500;
  padding: 11px 14px;
  cursor: pointer;
  line-height: 1.12;
  transition: color 0.2s ease, background-color 0.2s ease, font-size 200ms ease;
  white-space: normal;
  border-radius: 3px !important;
  color: #ffffff !important;
}

.ex-view-switch__link::after {
  content: '';
  display: none;
}

.ex-view-switch__link i,
.ex-view-switch__link span {
  color: inherit;
}

.ex-view-switch__link--expanded {
  flex-basis: auto;
  max-width: 100%;
  width: 100%;
}

.ex-view-switch__link--compact {
  flex-basis: auto;
  max-width: 100%;
  width: 100%;
}

.ex-view-switch.wa-h-tabs .ex-view-switch__link--log {
  background: #1E305C !important;
}

.ex-view-switch.wa-h-tabs .ex-view-switch__link--exercises {
  background: #1E305C !important;
}

.ex-view-switch__link:hover {
  color: #ffffff !important;
  filter: brightness(1.06);
}

.ex-view-switch.wa-h-tabs .ex-view-switch__link--log.ex-view-switch__link--active {
  color: #ffffff !important;
  background: #15803D !important;
  font-size: 16px;
  font-weight: 700;
  box-shadow: inset 0 -2px 0 0 rgba(255, 255, 255, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.2) !important;
}

.ex-view-switch.wa-h-tabs .ex-view-switch__link--exercises.ex-view-switch__link--active {
  color: #ffffff !important;
  background: #15803D !important;
  font-size: 16px;
  font-weight: 700;
  box-shadow: inset 0 -2px 0 0 rgba(255, 255, 255, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.2) !important;
}

.ex-view-switch__link.ex-view-switch__link--active::after {
  content: 'ACTIVE';
  display: block;
  width: 100%;
  margin-top: 2px;
  font-size: 0.58rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  text-align: center;
  color: #ffffff;
}

@media (prefers-reduced-motion: reduce) {
  .ex-view-switch__link {
    transition: none;
  }
}

.ex-tab {
  flex: 1;
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #1b2444;
  border: none;
  color: var(--ex-text-secondary, #a4b0c0);
  font-size: 0.92rem;
  font-weight: 600;
  padding: 10px 14px;
  cursor: pointer;
  transition: color 0.2s ease, background-color 0.2s ease;
  white-space: nowrap;
  border-radius: 3px;
}
/* design-system.css applies `button { border-radius: 999px !important }` site-wide
   (src/styles/design-system.css). Override it here using the same technique as
   WorkoutBuilder's `.builder-tabs .builder-tab` so tabs stay rectangular, not pill-shaped. */
.ex-tab-bar .ex-tab {
  border-radius: 3px !important;
}
.ex-tab:hover { color: rgba(255, 255, 255, 0.92); }
.ex-tab--active {
  color: #ffffff;
  font-weight: 700;
  background: #1d4f9f;
  box-shadow: inset 0 -2px 0 0 rgba(200, 221, 255, 0.95), 0 0 0 1px rgba(196, 220, 255, 0.28);
}
.exercises-page .ex-tab--active,
.exercises-page .ex-tab--active i,
.exercises-page .ex-tab--active span {
  color: #ffffff;
}

.exercises-page .ex-tab--active:hover,
.exercises-page .ex-tab--active:focus,
.exercises-page .ex-tab--active:focus-visible {
  background: #1d4f9f;
  color: #ffffff;
  box-shadow: inset 0 -2px 0 0 rgba(200, 221, 255, 0.95), 0 0 0 1px rgba(196, 220, 255, 0.28);
}
.ex-tab:focus,
.ex-tab:focus-visible {
  outline: none;
}
.ex-tab--active:focus,
.ex-tab--active:focus-visible {
  box-shadow: inset 0 -2px 0 0 rgba(200, 221, 255, 0.95), 0 0 0 1px rgba(196, 220, 255, 0.28);
}
.ex-tab i,
.ex-tab span { color: inherit; }

/* Short/full label logic â€“ desktop: show full only */
.tab-label-short { display: none; }
.tab-label-full  { display: inline; }

/* â”€â”€ Filter card â”€â”€ */
.search-filter-card {
  border-radius: 8px;
  border: 1px solid rgba(145, 160, 200, 0.18);
  box-shadow: none;
  padding: 0;
  background: rgba(19, 30, 51, 0.7);
  margin-top: 0;
}

.search-filter-head { display: none; }
.search-filter-head h4 {
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
  color: var(--ex-text, #f8fafc);
}

.search-filter-body {
  padding: 8px 10px;
}

/* Filters accordion toggle */
.filter-accordion-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: auto;
  background: rgba(19, 30, 51, 0.9);
  border: 1px solid rgba(145, 160, 200, 0.18);
  padding: 8px 12px;
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--ex-text, #f8fafc);
  cursor: pointer;
  border-radius: 6px;
  margin: 0 0 8px;
  box-shadow: none !important;
  outline: none;
  transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease;
}

.filter-accordion-toggle:hover,
.filter-accordion-toggle:focus-visible {
  background: #1d2b4f;
  border-color: rgba(145, 160, 200, 0.34);
  box-shadow: none !important;
}

.filter-toggle-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--ex-text, #f8fafc);
}

.filter-toggle-main-icon {
  font-size: 0.84rem;
  color: inherit;
}

/* Filter body animated collapse (mobile only) */
.filter-body-animated {
  max-height: 1600px;
  opacity: 1;
  overflow: hidden;
  transition: max-height .25s ease, opacity .2s ease;
}

.filter-body-animated.filters-mobile-hidden {
  max-height: 0 !important;
  opacity: 0;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
  pointer-events: none;
}

/* Inline meta */
.exercise-meta-inline {
  margin: 0;
  color: var(--ex-text-secondary, #a4b0c0);
  font-size: 0.86rem;
  line-height: 1.35;
}
.meta-dot { color: var(--ex-text-muted, #738196); }

/* Pagination row */
.pagination-row {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
}
.pagination-btn { min-width: 72px; }
.pagination-row .pagination-btn {
  border-color: var(--wa-action-blue, #2f6bff) !important;
  background: var(--wa-action-blue, #2f6bff) !important;
  color: #ffffff !important;
  box-shadow: none !important;
}

.pagination-row .pagination-btn:hover,
.pagination-row .pagination-btn:focus-visible {
  border-color: var(--wa-action-blue-hover, #2459d8) !important;
  background: var(--wa-action-blue-hover, #2459d8) !important;
  color: #ffffff !important;
}

.pagination-row .pagination-btn:disabled,
.pagination-row .pagination-btn.disabled {
  border-color: rgba(103, 132, 214, 0.45) !important;
  background: rgba(47, 107, 255, 0.35) !important;
  color: rgba(255, 255, 255, 0.78) !important;
  opacity: 0.65;
}

.results-bottom-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
}
.pagination-info {
  font-size: 0.86rem;
  color: #64748b;
  font-weight: 600;
  white-space: nowrap;
}

.search-filter-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px 12px;
  align-items: end;
  margin-top: 0;
}
.search-filter-field.full-width { grid-column: 1 / -1; }
.search-filter-field .form-label {
  margin-bottom: 2px;
  font-size: 0.76rem;
  font-weight: 700;
  color: var(--ex-text-secondary, #a4b0c0);
}
.search-filter-field .form-control,
.search-filter-field .form-select {
  min-height: 40px;
  padding: 8px 10px;
  font-size: 0.9rem;
  border: 1px solid var(--ex-border-strong, rgba(120, 145, 175, 0.24));
  background: #17213a;
  color: var(--ex-text, #f8fafc);
  border-radius: 6px;
}
.search-filter-field .form-control:focus,
.search-filter-field .form-select:focus {
  border-color: color-mix(in srgb, var(--ex-accent, #3b82f6) 60%, var(--ex-border-strong) 40%);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ex-accent, #3b82f6) 22%, transparent 78%);
}

.search-filter-actions {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-top: 4px;
  flex-wrap: wrap;
}

.search-filter-toggle-row {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  padding: 0 2px;
}

.search-filter-toggle-checkbox {
  margin: 0;
}

.search-filter-toggle-label {
  margin: 0;
  color: var(--ex-text, #f8fafc);
  font-size: 0.86rem;
  font-weight: 600;
  line-height: 1.2;
  cursor: pointer;
  user-select: none;
}
.search-custom-toggle-block {
  margin: 8px 0 10px;
  padding: 8px 12px;
  border: 1px solid rgba(120, 145, 175, 0.18);
  border-radius: 10px;
  background: linear-gradient(180deg, rgba(27, 36, 68, 0.92), rgba(18, 26, 50, 0.96));
}

.search-custom-toggle-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 16px;
  align-items: start;
}

.search-filter-toggle-row--custom {
  width: 100%;
  min-height: 24px;
  padding: 0;
  align-items: flex-start;
}

.search-filter-toggle-row--custom .search-filter-toggle-checkbox {
  flex: 0 0 auto;
  margin-top: 2px;
}

.search-custom-warning {
  margin-top: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid rgba(245, 158, 11, 0.32);
  background: rgba(120, 53, 15, 0.18);
  color: #fde68a;
  font-size: 0.84rem;
  line-height: 1.45;
  font-weight: 600;
}
.search-filter-divider { display: none; }

.exercise-database-toolbar {
  overflow: hidden;
  border: 1px solid rgba(145, 160, 200, 0.24);
  border-radius: 6px;
  background: #1b2444;
  box-shadow: 0 8px 18px rgba(37, 99, 235, 0.12);
}



.search-only-toolbar .search-filter-body {
  padding: 8px 10px;
}

.search-compact-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.search-compact-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

.search-compact-actions .filter-accordion-toggle {
  margin: 0;
}

.search-compact-actions .filter-accordion-toggle--icon-only {
  width: 40px !important;
  min-width: 40px !important;
  max-width: 40px !important;
  height: 40px !important;
  min-height: 40px !important;
  padding: 0 !important;
  border-radius: 8px !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  flex: 0 0 40px !important;
  margin: 0 !important;
  background: #17213a !important;
  border: 1px solid rgba(145, 160, 200, 0.28) !important;
  color: #dbe8ff !important;
  box-shadow: none !important;
}

.search-compact-actions .filter-accordion-toggle--icon-only:hover,
.search-compact-actions .filter-accordion-toggle--icon-only:focus-visible {
  background: #1d2b4f !important;
  border-color: rgba(145, 160, 200, 0.4) !important;
  color: #ffffff !important;
}

.search-compact-actions .filter-accordion-toggle--icon-only[aria-expanded='true'] {
  background: #1d4f9f !important;
  border-color: rgba(160, 197, 255, 0.75) !important;
  color: #ffffff !important;
}

.search-compact-actions .filter-accordion-toggle--icon-only .filter-toggle-main-icon {
  font-size: 0.9rem !important;
  line-height: 1;
  color: inherit !important;
}

.search-filter-input-wrap--search-only {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
}

.search-filter-input-wrap--search-only .form-control {
  width: 100%;
  min-width: 0;
  height: 40px;
  min-height: 40px;
  padding: 8px 10px 8px 54px;
  border: 1px solid rgba(145, 160, 200, 0.24);
  border-radius: 6px !important;
  background-color: #17213a;
  color: var(--ex-text, #f8fafc);
  font-size: 0.88rem;
  line-height: 1.2;
}

.filter-accordion-toggle {
  flex: 0 0 auto;
  margin: 0;
  white-space: nowrap;
}

.search-filter-input-wrap--search-only .form-control::placeholder {
  color: var(--ex-text-secondary, #a4b0c0);
}

.filters-toolbar .filter-accordion-toggle {
  margin-top: 0;
}

.exercises-page .panel.search-filter-card,
.exercises-page .panel.exercise-database-toolbar,
.exercises-page .panel.exercise-results-panel,
.exercises-page .tab-content .panel {
  background: #1b2444 !important;
  border-color: rgba(145, 160, 200, 0.24) !important;
  border-radius: 8px !important;
  box-shadow: 0 8px 18px rgba(37, 99, 235, 0.12) !important;
}

.exercises-page .search-only-toolbar,
.exercises-page .filters-toolbar {
  border-radius: 6px !important;
}

.exercise-database-toolbar .search-filter-body {
  padding: 8px 10px;
}

.exercise-database-toolbar .search-filter-primary-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
  align-items: end;
}

.exercise-database-toolbar .search-filter-primary-row .full-width {
  grid-column: auto;
}

.exercise-database-toolbar .search-filter-grid {
  gap: 10px;
  margin-top: 4px;
}

.exercise-database-toolbar .search-filter-field {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.exercise-database-toolbar .search-filter-field .form-label {
  margin: 0;
  color: var(--ex-text, #f8fafc);
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  line-height: 1.2;
}

.exercise-database-toolbar .search-filter-input-wrap,
.exercise-database-toolbar .search-filter-select-wrap {
  position: relative;
  width: 100%;
}

.exercise-database-toolbar .search-filter-input-icon {
  position: absolute;
  left: 15px;
  top: 50%;
  transform: translateY(-50%);
  width: 14px;
  height: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
  color: var(--ex-text-muted, #738196);
  font-size: 0.82rem;
  line-height: 1;
  pointer-events: none;
}

.exercise-database-toolbar .search-filter-field--search .form-control {
  padding-left: 54px !important;
}

.exercise-database-toolbar .search-filter-select-wrap .form-select {
  padding-right: 34px;
}

.exercise-database-toolbar .search-filter-select-icon {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--ex-text-muted, #738196);
  font-size: 0.72rem;
  pointer-events: none;
}

.exercise-database-toolbar .search-filter-field .form-control,
.exercise-database-toolbar .search-filter-field .form-select {
  width: 100%;
  min-width: 0;
  height: 40px;
  min-height: 40px;
  padding: 8px 10px;
  border: 1px solid rgba(145, 160, 200, 0.24);
  border-radius: 6px !important;
  background-color: #17213a;
  color: var(--ex-text, #f8fafc);
  font-size: 0.88rem;
  line-height: 1.2;
}

.exercise-database-toolbar .search-filter-field .form-control::placeholder {
  color: var(--ex-text-secondary, #a4b0c0);
}

.exercise-database-toolbar .search-filter-field .form-control:focus,
.exercise-database-toolbar .search-filter-field .form-select:focus {
  border-color: rgba(145, 160, 200, 0.24);
  box-shadow: 0 0 0 0.2rem rgba(37, 99, 235, 0.24);
}

.exercise-database-toolbar .search-filter-actions {
  flex-wrap: nowrap;
  margin: 0;
  align-items: flex-end;
  gap: 8px;
}

.exercise-database-toolbar .search-filter-actions .btn {
  min-height: 40px;
  height: 40px;
  padding: 8px 14px;
  border-radius: 6px !important;
  font-size: 0.84rem;
  font-weight: 700;
  white-space: nowrap;
}

.exercise-page-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 10px;
}

.exercise-page-actions .exercise-toolbar-add,
.exercise-database-toolbar .exercise-toolbar-add,
.results-header-actions .exercise-toolbar-add,
.results-pagination-toolbar .exercise-toolbar-add,
.search-compact-actions .exercise-toolbar-add {
  border-color: var(--wa-action-green, #0d5b55) !important;
  background: var(--wa-action-green, #0d5b55) !important;
  color: #ffffff !important;
  box-shadow: none !important;
  min-height: 40px;
  height: 40px;
  padding: 8px 14px;
  border-radius: 6px !important;
  font-size: 0.84rem;
  font-weight: 700;
  white-space: nowrap;
}

.exercise-page-actions .exercise-toolbar-add:hover,
.exercise-page-actions .exercise-toolbar-add:focus,
.exercise-database-toolbar .exercise-toolbar-add:hover,
.exercise-database-toolbar .exercise-toolbar-add:focus,
.results-header-actions .exercise-toolbar-add:hover,
.results-header-actions .exercise-toolbar-add:focus,
.results-pagination-toolbar .exercise-toolbar-add:hover,
.results-pagination-toolbar .exercise-toolbar-add:focus,
.search-compact-actions .exercise-toolbar-add:hover,
.search-compact-actions .exercise-toolbar-add:focus {
  border-color: var(--wa-action-green-hover, #0a4a45) !important;
  background: var(--wa-action-green-hover, #0a4a45) !important;
}

.exercise-database-toolbar .clear-filters-btn {
  border-color: rgba(145, 160, 200, 0.24) !important;
  background: #17213a !important;
  color: var(--ex-text, #f8fafc) !important;
  box-shadow: none !important;
}

.exercise-page-actions .exercise-toolbar-add,
.exercise-database-toolbar .exercise-toolbar-add,
.results-header-actions .exercise-toolbar-add,
.results-pagination-toolbar .exercise-toolbar-add,
.search-compact-actions .exercise-toolbar-add,
.exercise-database-toolbar .clear-filters-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.exercise-database-toolbar .clear-filters-btn:hover,
.exercise-database-toolbar .clear-filters-btn:focus {
  border-color: color-mix(in srgb, var(--ex-accent, #3b82f6) 40%, var(--ex-border-strong) 60%) !important;
  background: #22325a !important;
  color: var(--ex-text, #f8fafc) !important;
}

.results-header-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas:
    "title add"
    "controls controls";
  align-items: center;
  gap: 10px 12px;
  border: 1px solid rgba(145, 160, 200, 0.18);
  background: rgba(19, 30, 51, 0.7);
  border-radius: 8px;
  padding: 10px 12px;
  margin: 0 0 10px;
}

.results-header-title-group {
  grid-area: title;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.results-header-controls {
  grid-area: controls;
  display: grid;
  grid-template-columns: auto minmax(80px, 1fr) auto;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.results-header-actions {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.results-header-right {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.results-toolbar-meta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.results-display-toggle {
  justify-self: end;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.results-display-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 38px;
  height: 38px;
  min-width: 90px;
  width: auto;
  padding: 8px 12px;
  border: 1px solid rgba(96, 165, 250, 0.28);
  border-radius: 999px;
  background: rgba(23, 33, 58, 0.9);
  color: var(--ex-text-secondary, #a4b0c0);
  font-size: 0.8rem;
  font-weight: 700;
  line-height: 1;
  position: relative;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
}

.results-display-btn i {
  font-size: 0.8rem;
  line-height: 1;
}

.results-display-btn:hover,
.results-display-btn:focus-visible {
  background: rgba(31, 45, 82, 0.96);
  color: var(--ex-text, #f8fafc);
  border-color: rgba(96, 165, 250, 0.2);
}

.results-display-btn--active {
  background: linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%);
  border-color: rgba(147, 197, 253, 0.7);
  color: #ffffff;
  box-shadow: inset 0 -1px 0 rgba(15, 23, 42, 0.14), 0 0 0 1px rgba(147, 197, 253, 0.12);
}

.rows-per-page-control {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  justify-self: start;
}

.rows-per-page-label {
  font-size: 0.82rem;
  color: var(--ex-text-secondary, #a4b0c0);
  line-height: 1;
  white-space: nowrap;
}

.rows-per-page-label-full {
  display: inline;
}

.rows-per-page-label-short {
  display: none;
}

.rows-per-page-select {
  width: 76px;
  min-height: 32px;
  height: 32px;
  padding: 4px 24px 4px 8px;
  border-radius: 6px !important;
  font-size: 0.82rem;
  font-weight: 600;
}

.results-header-add {
  grid-area: add;
  justify-self: end;
  min-height: 40px;
  height: 40px;
  padding: 8px 14px;
  font-weight: 700;
  white-space: nowrap;
}

.results-count {
  justify-self: center;
  font-size: 0.84rem;
  color: var(--ex-text-secondary, #a4b0c0);
  line-height: 1.2;
  white-space: nowrap;
  text-align: center;
}

.exercise-list--grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
}

.exercise-list--grid .exercise-row {
  height: 100%;
}

.exercise-list--grid .pagination-row {
  grid-column: 1 / -1;
}

.exercise-list--grid .results-bottom-actions {
  grid-column: 1 / -1;
}

.results-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--ex-text, #f8fafc);
}
.results-count {
  font-size: 0.84rem;
  color: var(--ex-text-secondary, #a4b0c0);
  line-height: 1.2;
}

.tab-content {
  background: transparent;
  border: 0;
  border-radius: 0 0 14px 14px;
  margin-top: 0;
  padding: 0;
  line-height: 1.6;
  overflow-x: hidden;
  width: 100%;
  box-sizing: border-box;
}
.tab-content > div { margin-top: 0; }
.tab-content .container.container-block { margin-top: 0 !important; }
.tab-content .panel {
  margin-top: 0;
  border-top: 0;
  border-radius: 8px;
  background: #1b2444;
  border-color: rgba(145, 160, 200, 0.24);
}
.exercise-results-panel { padding-top: 0; }

.panel {
  border: 1px solid rgba(145, 160, 200, 0.18);
  border-radius: 10px;
  padding: 15px;
  background: rgba(19, 30, 51, 0.7);
  box-shadow: none;
  width: 100%;
  box-sizing: border-box;
}

/* Workout log styles */
.list-group-item.d-flex.align-items-center > .flex-grow-1 > div.row > .col {
  padding: 2px 6px !important;
  margin: 0 !important;
}
.list-group-item.d-flex.align-items-start > div[style*="flex-basis: 70%"],
.list-group-item.d-flex.align-items-start > div[style*="max-width: 70%"] {
  padding-left: 37px !important;
}
.list-group-item.d-flex.align-items-start {
  margin-bottom: 32px !important;
  margin-top: 16px !important;
  padding-top: 18px !important;
  padding-bottom: 18px !important;
}
.panel-body { margin-bottom: 0; }
.list-group-item.d-flex.align-items-center {
  padding-top: 6px !important;
  padding-bottom: 6px !important;
  margin-bottom: 2px !important;
}
.log-action-btn {
  width: 33px;
  height: 33px;
  min-width: 33px;
  min-height: 33px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  padding: 0;
}
.log-action-icon {
  font-size: 1.32em !important;
  vertical-align: middle;
  line-height: 1;
}

/* -- 0.84.39 Exercise Database dark-theme normalization (scoped) ---------- */
.exercises-page {
  --ex-surface-1: var(--wa-shell-surface, #1b2444);
  --ex-surface-2: var(--wa-shell-surface-elevated, #17213a);
  --ex-surface-3: var(--wa-shell-surface-soft, #22325a);
  --ex-border: var(--wa-shell-border, rgba(120, 145, 175, 0.16));
  --ex-border-strong: var(--wa-shell-border-strong, rgba(120, 145, 175, 0.24));
  --ex-text: var(--wa-shell-text, #f8fafc);
  --ex-text-secondary: var(--wa-shell-text-secondary, #a4b0c0);
  --ex-text-muted: var(--wa-shell-text-muted, #738196);
  --ex-accent: var(--wa-shell-accent, #1d4f9f);
}

.exercises-page .builder-hero.ff-page-header.app-header-gradient {
  background: linear-gradient(135deg, #0f2561 0%, #112463 42%, #1b2444 100%) !important;
  border: 1px solid var(--ex-border);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.25);
}

/* .panel already supplies background/border/radius/shadow to exercise-results-panel,
   favorites-panel, edit-exercise-panel and custom-exercise-form-panel (all carry the
   .panel class). .search-filter-card and .exercise-database-toolbar set their own
   background/border/radius directly below, so no page-wide !important override is
   needed here (that override was forcing 14px radius over the intended 8px, and
   forcing a muted grey background onto the active tab - both removed). */

.exercises-page .exercise-card,
.exercises-page .edit-exercise-panel,
.exercises-page .list-group-item {
  background: #1b2444;
  border-color: rgba(145, 160, 200, 0.24);
  color: var(--ex-text);
}

.exercises-page .exercise-row:hover,
.exercises-page .exercise-row--active,
.exercises-page .search-filter-field .form-control,
.exercises-page .search-filter-field .form-select,
.exercises-page .edit-exercise-panel .form-control,
.exercises-page .edit-exercise-panel .form-select,
.exercises-page .filter-accordion-toggle,
.exercises-page .btn-fav,
.exercises-page .btn-edit-exercise {
  background: #17213a;
  border-color: var(--ex-border-strong);
}

.exercises-page .panel-header h4,
.exercises-page .exercise-title,
.exercises-page .results-title,
.exercises-page .pagination-info,
.exercises-page .logged-exercise-title,
.exercises-page .workout-log-summary {
  color: var(--ex-text);
}

.exercises-page .exercise-meta p,
.exercises-page .exercise-meta-inline,
.exercises-page .results-count,
.exercises-page .search-filter-field .form-label,
.exercises-page .edit-exercise-panel .form-label,
.exercises-page .header-meta,
.exercises-page .pagination-info,
.exercises-page .filter-accordion-toggle i,
.exercises-page .tab-label-full,
.exercises-page .tab-label-short,
.exercises-page .ex-tab {
  color: var(--ex-text-secondary);
}

.exercises-page .meta-dot {
  color: var(--ex-text-muted);
}

.exercises-page .ex-tab:hover {
  color: var(--ex-text);
  background: var(--ex-surface-3);
}

.exercises-page .search-filter-field .form-control,
.exercises-page .search-filter-field .form-select,
.exercises-page .edit-exercise-panel .form-control,
.exercises-page .edit-exercise-panel .form-select,
.exercises-page textarea,
.exercises-page input[type="number"] {
  color: var(--ex-text);
}

.exercises-page .search-filter-field .form-control::placeholder,
.exercises-page textarea::placeholder {
  color: var(--ex-text-muted);
}

.exercises-page .exercise-database-toolbar .search-filter-field .form-label {
  color: var(--ex-text, #f8fafc);
}

.exercises-page .exercise-database-toolbar .search-filter-field .form-control::placeholder {
  color: var(--ex-text-secondary, #a4b0c0);
}

.exercises-page .search-filter-field .form-control:focus,
.exercises-page .search-filter-field .form-select:focus,
.exercises-page .edit-exercise-panel .form-control:focus,
.exercises-page .edit-exercise-panel .form-select:focus {
  border-color: color-mix(in srgb, var(--ex-accent) 60%, var(--ex-border) 40%);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ex-accent) 24%, transparent 76%);
}

.exercises-page .btn-fav {
  background: #dc2626;
  border-color: #dc2626;
  color: #ffffff;
}

.exercises-page .btn-fav:hover {
  background: #b91c1c;
  border-color: #b91c1c;
  color: #ffffff;
}

.exercises-page .btn-fav--active {
  background: #dc2626;
  border-color: #dc2626;
  color: #ffffff;
}

.exercises-page .btn-edit-exercise {
  background: var(--wa-action-blue, #2f6bff);
  border-color: var(--wa-action-blue, #2f6bff);
  color: #ffffff;
}

.exercises-page .btn-edit-exercise:hover,
.exercises-page .btn-edit-exercise:focus-visible {
  background: var(--wa-action-blue-hover, #2459d8);
  border-color: var(--wa-action-blue-hover, #2459d8);
  color: #ffffff;
}

.exercises-page .list-group-item,
.exercises-page .results-header-row,
.exercises-page .search-filter-card,
.exercises-page .tab-content,
.exercises-page .tab-content .panel,
.exercises-page .edit-exercise-panel .panel-header {
  border-color: rgba(145, 160, 200, 0.24);
}

.exercises-page .summary-img,
.exercises-page .exercise-img img,
.exercises-page .exercise-card .exercise-image img {
  border: 1px solid var(--ex-border-strong);
}

.exercises-page .btn-outline-secondary,
.exercises-page .btn-outline-dark,
.exercises-page .btn-secondary {
  color: var(--ex-text-secondary);
  border-color: var(--ex-border-strong);
  background: var(--ex-surface-2);
}

.exercises-page .btn-outline-secondary:hover,
.exercises-page .btn-outline-dark:hover,
.exercises-page .btn-secondary:hover {
  color: var(--ex-text);
  background: var(--ex-surface-3);
  border-color: var(--ex-border-strong);
}

.exercises-page .pagination-info,
.exercises-page .form-check-label,
.exercises-page .sel-ex-input,
.exercises-page .panel-body {
  color: var(--ex-text-secondary);
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   RESPONSIVE â€“ 991px
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
@media (max-width: 991px) {
  .results-header-actions {
    align-items: center;
    justify-content: flex-end;
  }

  .results-display-toggle {
    margin-left: auto;
  }

  .rows-per-page-control {
    width: 100%;
    justify-content: flex-end;
  }

  .exercise-list--grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .search-filter-grid {
    grid-template-columns: 1fr;
  }
  .search-filter-actions {
    width: 100%;
  }
  .search-filter-actions .btn {
    flex: 1 1 calc(50% - 6px);
    min-height: 38px;
  }
  /* Dual-column card layout */
  .exercise-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 14px 16px;
    gap: 16px;
    min-height: 150px;
  }
  .exercise-img {
    width: 120px;
    height: 120px;
    flex-shrink: 0;
  }
  .exercise-img img {
    width: 120px;
    height: 120px;
    object-fit: cover;
    border-radius: 12px;
    display: block;
  }
  .exercise-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .exercise-info .exercise-title {
    margin-bottom: 8px;
  }
  .exercise-info .exercise-meta {
    gap: 6px;
    margin-bottom: 8px;
  }
  .exercise-info .exercise-actions {
    margin-top: auto;
  }
  .exercise-card {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 16px;
    padding: 16px;
    min-height: 150px;
  }
  .exercise-card .exercise-image {
    width: 120px;
    height: 120px;
    flex-shrink: 0;
    margin: 0;
  }
  .exercise-card .exercise-image img {
    width: 120px;
    height: 120px;
    object-fit: cover;
    border-radius: 12px;
    display: block;
  }
  .exercise-card .exercise-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .exercise-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-top: auto;
  }
  .exercise-actions .btn {
    width: 100%;
    min-height: 44px;
    font-size: 0.82rem;
  }

  .log-selected-panel__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

/* ─────────────────────────────────────────────────────
   RESPONSIVE - 768px (Tablet / large phone)
───────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .search-custom-toggle-list {
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
  }

  .exercise-database-toolbar .search-filter-primary-row {
    grid-template-columns: minmax(0, 1fr);
  }

  /* - Hero banner - */
  :deep(.builder-hero),
  .builder-hero {
    padding: 12px !important;
    min-height: auto !important;
    border-radius: 16px !important;
    margin-bottom: 8px !important;
  }
  :deep(.builder-hero) h2,
  :deep(.builder-hero__content) h2 {
    font-size: 1.2rem !important;
    font-weight: 700 !important;
    line-height: 1.2 !important;
    margin: 0 !important;
  }

  .ex-view-switch {
    padding: 4px;
    margin-bottom: 8px;
    gap: 4px;
  }

  .ex-view-switch__link {
    min-height: 44px;
    padding: 9px 12px;
  }

  /* - Overflow guard - */
  .exercises-page,
  .exercises-canvas,
  .ex-page-body,
  .tab-content,
  .panel,
  .container,
  .container-block {
    overflow-x: hidden !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
  }
  img {
    max-width: 100%;
    height: auto;
  }

  /* Tab bar layout/colors on mobile are owned by the ".exercises-page .ex-tab-bar"
     / ".exercises-page .ex-tab" rules in the mobile hierarchy block further down. */
  .tab-label-full  { display: none; }
  .tab-label-short { display: inline; }

  /* - Accordion toggle mobile style - */
  .search-compact-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: stretch;
    gap: 8px;
  }

  .filter-accordion-toggle {
    align-items: center;
    justify-content: center;
    width: auto;
    background: #17213a;
    border: 1px solid rgba(145, 160, 200, 0.24);
    padding: 7px 12px;
    font-size: 0.92rem;
    font-weight: 700;
    color: var(--ex-text-secondary, #a4b0c0);
    cursor: pointer;
    border-radius: 4px !important;
    white-space: nowrap;
    min-height: 42px;
    padding: 7px 11px;
  }
  .filter-toggle-main-icon { color: #60a5fa; }
  .filter-accordion-toggle i { font-size: 0.78rem; color: var(--ex-text-muted, #738196); }

  /* - Filter grid: 1-col on mobile - */
  .search-filter-grid {
    grid-template-columns: 1fr;
    gap: 8px 0;
  }

  /* - Action buttons: stacked, full-width - */
  .search-filter-actions {
    flex-direction: column;
    gap: 8px;
    margin-top: 4px;
  }
  .search-filter-actions .btn {
    width: 100% !important;
    min-height: 38px !important;
    font-size: 0.88rem;
  }

  .search-filter-body {
    padding: 8px 10px;
  }

  .exercise-database-toolbar .search-filter-field .form-control,
  .exercise-database-toolbar .search-filter-field .form-select,
  .search-filter-actions .btn {
    min-height: 40px !important;
    height: 40px !important;
    border-radius: 6px !important;
  }

  .exercise-database-toolbar .search-filter-field--search .form-control {
    padding-left: 40px !important;
  }

  .exercise-database-toolbar .search-filter-select-wrap .form-select {
    padding-right: 34px !important;
  }

  .exercise-database-toolbar .search-filter-input-icon,
  .exercise-database-toolbar .search-filter-select-icon {
    font-size: 0.74rem;
  }

  /* Results header colors/spacing on mobile are owned by the
     ".exercises-page .results-header-row" rule in the mobile hierarchy block further down. */

  /* - Exercise list gap - */
  .exercise-list {
    gap: 10px;
  }

  .exercise-list--grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .log-selected-panel {
    padding: 14px;
  }

  .log-selected-panel__header {
    grid-template-columns: 1fr;
    justify-items: start;
  }

  .log-selected-panel__media,
  .log-selected-panel__thumb {
    width: 88px;
    min-width: 88px;
    height: 88px;
  }

  .log-selected-panel__grid {
    grid-template-columns: 1fr;
  }

  .log-field--duration {
    max-width: none;
  }

  .log-timer-row,
  .log-selected-panel__actions {
    flex-direction: column;
    align-items: stretch;
  }

  .log-timer-row__controls {
    width: 100%;
  }

  .log-timer-row__controls .btn,
  .log-selected-panel__submit-btn {
    flex: 1 1 auto;
    width: 100%;
  }

  .log-selected-panel__back-btn {
    width: 100%;
    min-width: 0;
  }

  /* - Compact exercise card - */
  .exercise-row {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    padding: 10px;
    gap: 10px;
    min-height: auto;
  }
  .exercise-img {
    width: 72px;
    height: 72px;
    flex-shrink: 0;
    margin: 0;
  }
  .exercise-img img {
    width: 72px;
    height: 72px;
    object-fit: cover;
    border-radius: 10px;
    display: block;
  }
  .exercise-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    height: auto;
  }
  .exercise-info .exercise-title {
    font-size: 0.9rem;
    font-weight: 700;
    margin-bottom: 0;
    line-height: 1.15;
  }
  .exercise-info .exercise-meta {
    gap: 2px;
    margin-bottom: 4px;
  }
  .exercise-meta p {
    font-size: 0.82rem;
    line-height: 1.15;
  }
  .exercise-info .exercise-actions {
    margin-top: 4px;
  }
  .exercise-card {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    gap: 10px;
    padding: 12px;
    min-height: auto;
  }
  .exercise-card .exercise-image {
    width: 72px;
    height: 72px;
    flex-shrink: 0;
    margin: 0;
  }
  .exercise-card .exercise-image img {
    width: 72px;
    height: 72px;
    object-fit: cover;
    border-radius: 10px;
    display: block;
  }
  .exercise-card .exercise-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  /* - Compact action buttons (horizontal) - */
  .exercise-actions {
    display: flex;
    flex-direction: row;
    gap: 8px;
    margin-top: 0;
  }
  .exercise-actions .btn {
    height: 34px;
    min-height: 34px;
    font-size: 0.8rem;
    padding: 4px 10px;
    width: auto;
  }
}

/* ─────────────────────────────────────────────────────
   RESPONSIVE - 480px (Small phones)
───────────────────────────────────────────────────── */
@media (max-width: 480px) {
  .ex-view-switch {
    gap: 3px;
    padding: 4px;
  }

  .ex-view-switch .ex-view-switch__link,
  .ex-view-switch .ex-view-switch__link--expanded,
  .ex-view-switch .ex-view-switch__link--compact {
    flex: 1 1 auto;
    flex-basis: auto;
    width: 100% !important;
    min-height: 52px;
    min-width: 0;
    padding: 8px 6px;
    font-size: 12px;
    font-weight: 500;
    line-height: 1.1;
    gap: 3px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ex-view-switch .ex-view-switch__link i {
    font-size: 0.78rem;
    flex-shrink: 0;
  }

  .ex-view-switch__link.ex-view-switch__link--active::after {
    font-size: 0.52rem;
    margin-top: 1px;
  }

  .ex-tab {
    min-width: 80px;
    max-width: 100px;
    height: 36px;
    padding: 0 8px;
    font-size: 0.78rem;
  }
  .ex-tab i { display: none; }
  .exercise-img { width: 64px; height: 64px; }
  .exercise-img img { width: 64px; height: 64px; border-radius: 8px; }
  .exercise-card .exercise-image { width: 64px; height: 64px; }
  .exercise-card .exercise-image img { width: 64px; height: 64px; border-radius: 8px; }
  .exercise-row { padding: 10px; gap: 8px; }
  .exercise-actions .btn { height: 32px; min-height: 32px; font-size: 0.75rem; padding: 3px 8px; }
}

@media (max-width: 430px) {
  .search-compact-row {
    grid-template-columns: minmax(0, 1fr);
  }

  .search-compact-actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
    width: 100%;
  }

  .search-compact-actions .filter-accordion-toggle {
    width: 100%;
  }

  .search-compact-actions .filter-toggle-label {
    justify-content: center;
    width: 100%;
  }

  .exercises-page .ex-tab {
    font-size: 0.7rem;
    padding: 0 4px !important;
  }

  .results-header-row {
    gap: 8px 10px;
    padding: 10px;
    margin-bottom: 12px;
  }

  .results-header-title-group {
    display: inline-flex;
    align-items: center;
    justify-content: flex-start;
    gap: 6px;
    min-width: 0;
  }

  .results-title {
    width: auto;
    line-height: 1.2;
  }

  .results-header-controls {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      'rows count'
      'toggle toggle';
    gap: 6px 8px;
  }

  .results-header-add {
    min-height: 34px;
    height: 34px;
    padding: 6px 10px;
    font-size: 0.72rem;
  }

  .results-display-toggle {
    grid-area: toggle;
    width: 100%;
    justify-self: stretch;
    display: inline-flex;
    min-width: 0;
    padding: 0;
    margin-left: 0;
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .rows-per-page-control {
    grid-area: rows;
    justify-self: start;
    min-width: 0;
  }

  .results-display-btn {
    min-height: 38px;
    height: 38px;
    width: auto;
    padding: 8px 8px;
    font-size: 0.72rem;
  }

  .rows-per-page-label {
    flex-shrink: 0;
    white-space: nowrap;
    line-height: 1.2;
  }

  .rows-per-page-label-full {
    display: none;
  }

  .rows-per-page-label-short {
    display: inline;
  }

  .rows-per-page-select {
    width: 68px;
    min-width: 68px;
    flex-shrink: 0;
  }

  .results-count {
    grid-area: count;
    font-size: 0.74rem;
    line-height: 1.2;
    min-width: 0;
    text-align: right;
    white-space: nowrap;
  }

  .rows-per-page-label {
    font-size: 0.7rem;
  }

  .exercise-list {
    padding-bottom: 70px;
  }
}

@media (max-width: 360px) {
  .results-header-row {
    gap: 8px 10px;
  }

  .results-header-controls {
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 6px 8px;
  }

  .results-header-add {
    justify-self: end;
    width: auto;
  }

  .rows-per-page-label {
    width: auto;
  }

  .rows-per-page-select {
    width: 68px;
    min-width: 68px;
  }
}

/* Workout Builder-inspired hierarchy for the Exercise Database mobile view. */
@media (max-width: 768px) {
  .exercises-page .ex-page-body {
    padding: 8px !important;
    border: 1px solid rgba(145, 160, 200, 0.24) !important;
    border-radius: 10px !important;
    box-shadow: 0 10px 26px rgba(2, 6, 23, 0.32) !important;
  }

  .exercises-page .ex-tab-bar {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 3px;
    width: 100%;
    padding: 3px !important;
    overflow: hidden;
    background: #1b2444;
    border: 1px solid rgba(145, 160, 200, 0.24);
    border-radius: 10px 10px 0 0 !important;
  }

  .exercises-page .ex-tab {
    width: 100%;
    min-width: 0;
    max-width: none;
    height: 40px !important;
    min-height: 40px !important;
    padding: 0 6px !important;
    gap: 4px;
    border-radius: 3px !important;
    font-size: 0.74rem;
    font-weight: 700;
    line-height: 1;
    opacity: 1;
    box-shadow: none;
  }

  .exercises-page .ex-tab--active {
    background: #1d4f9f !important;
    color: #ffffff !important;
    filter: none;
    transform: none;
    box-shadow: inset 0 -2px 0 0 rgba(200, 221, 255, 0.95), 0 0 0 1px rgba(196, 220, 255, 0.28);
  }

  .exercises-page .ex-tab i {
    display: inline-block;
    margin-right: 2px !important;
    color: #ffffff !important;
    font-size: 0.7rem;
  }

  .search-compact-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: stretch;
    gap: 8px;
  }

  .search-filter-input-wrap--search-only {
    min-width: 0;
  }

  .filter-accordion-toggle {
    min-width: 0;
  }

  .exercises-page .tab-content {
    border-color: rgba(145, 160, 200, 0.24) !important;
    border-radius: 0 0 10px 10px !important;
    padding-bottom: calc(88px + env(safe-area-inset-bottom, 0px));
  }

  .exercises-page .tab-content .container.container-block {
    padding: 4px !important;
  }

  .exercises-page .tab-content .panel {
    border: 1px solid rgba(145, 160, 200, 0.24) !important;
    border-radius: 8px !important;
    box-shadow: 0 8px 18px rgba(37, 99, 235, 0.12) !important;
  }

  .exercises-page .tab-content .panel.exercise-results-panel {
    border: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    background: transparent !important;
    padding: 0 !important;
  }

  .exercises-page .tab-content .panel-header {
    gap: 8px;
    min-height: 38px;
    padding: 8px 10px;
    background: #1b2444 !important;
    background-image: none !important;
    border: 1px solid rgba(145, 160, 200, 0.24);
    border-left: 3px solid #1d4f9f;
    border-radius: 10px 10px 4px 4px;
  }

  .exercises-page .tab-content .panel-header.d-flex.justify-content-between {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 6px;
    align-items: center !important;
    flex-wrap: nowrap !important;
  }

  .exercises-page .tab-content .panel-header.d-flex.justify-content-between h4 {
    min-width: 0;
    font-size: 0.82rem;
  }

  .exercises-page .tab-content .panel-header h4 {
    color: #ffffff !important;
    font-size: 0.9rem;
    font-weight: 800;
    line-height: 1.2;
  }

  .exercises-page .tab-content .panel-header .btn {
    min-height: 34px !important;
    padding: 5px 6px !important;
    border-radius: 6px !important;
    font-size: 0.68rem;
    white-space: nowrap;
  }

  .exercises-page .results-header-row {
    min-height: 38px;
    margin-bottom: 8px;
    padding: 8px 10px;
    background: #173a70;
    border: 1px solid rgba(96, 165, 250, 0.34);
    border-left: 3px solid #60a5fa;
    border-radius: 7px;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      'title add'
      'controls controls';
    gap: 8px 10px;
  }

  .exercises-page .results-header-controls {
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 6px;
    align-items: center;
    min-width: 0;
  }

  .exercises-page .results-display-toggle {
    min-width: 0;
    justify-self: end;
  }

  .exercises-page .results-display-btn {
    min-width: 72px;
    padding: 7px 9px;
  }

  .exercises-page .results-title {
    color: #ffffff !important;
    font-size: 0.88rem;
    font-weight: 800;
  }

  .exercises-page .results-count {
    color: #c8ddff !important;
    font-size: 0.76rem;
  }

  .exercises-page .panel-body {
    padding: 8px !important;
  }

  .exercises-page .panel-body .py-4 {
    padding-top: 12px !important;
    padding-bottom: 12px !important;
  }

  .exercises-page .exercise-row,
  .exercises-page .exercise-card,
  .exercises-page .list-group-item {
    border-radius: 8px !important;
    border-color: rgba(145, 160, 200, 0.24) !important;
  }

  .exercises-page .exercise-list {
    width: 100%;
    min-width: 0;
    padding-bottom: calc(94px + env(safe-area-inset-bottom, 0px));
  }

  .exercises-page .exercise-row {
    grid-template-columns: 70px minmax(0, 1fr);
    gap: 10px;
    padding: 9px;
    width: 100%;
    min-width: 0;
  }

  .exercises-page .exercise-img,
  .exercises-page .exercise-img img {
    width: 70px;
    height: 70px;
  }

  .exercises-page .exercise-title {
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  .exercises-page .exercise-actions {
    width: 100%;
    gap: 6px;
  }

  .exercises-page .exercise-actions .btn {
    min-width: 0;
  }

  .exercises-page .tab-content .favorites-panel {
    overflow: hidden;
    background: #1b2444 !important;
    background-image: none !important;
    border-color: rgba(145, 160, 200, 0.24) !important;
    box-shadow: 0 8px 18px rgba(37, 99, 235, 0.12) !important;
  }

  .exercises-page .favorites-panel > .panel-body {
    background: #1b2444 !important;
  }

  .exercises-page .favorites-grid {
    --bs-gutter-x: 0;
    --bs-gutter-y: 0;
    margin: 0;
  }

  .exercises-page .favorite-exercise-item {
    width: 100%;
    margin-bottom: 8px !important;
    padding: 0;
  }

  .exercises-page .favorite-exercise-item:last-child {
    margin-bottom: 0 !important;
  }

  .exercises-page .favorite-exercise-card {
    position: relative;
    display: grid;
    grid-template-columns: 60px minmax(0, 1fr);
    gap: 9px;
    align-items: center;
    min-height: 78px;
    padding: 9px !important;
    overflow: hidden;
    background: #1b2444 !important;
    background-image: none !important;
    border: 1px solid rgba(145, 160, 200, 0.24) !important;
    border-radius: 7px !important;
    box-shadow: 0 8px 18px rgba(37, 99, 235, 0.12) !important;
  }

  .exercises-page .favorite-exercise-card .exercise-image,
  .exercises-page .favorite-exercise-card .exercise-image img {
    width: 60px;
    height: 60px;
    margin: 0;
    border-radius: 6px;
  }

  .exercises-page .favorite-exercise-card .exercise-image img {
    object-fit: cover;
    border: 1px solid rgba(145, 160, 200, 0.24);
  }

  .exercises-page .favorite-exercise-content {
    align-self: stretch;
    justify-content: center;
    gap: 5px;
    min-width: 0;
    padding-right: 54px;
  }

  .exercises-page .favorite-exercise-content .exercise-title {
    margin: 0;
    color: #f8fafc;
    font-size: 0.88rem;
    font-weight: 800;
    line-height: 1.15;
    overflow-wrap: anywhere;
  }

  .exercises-page .favorite-exercise-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin: 0;
  }

  .exercises-page .favorite-exercise-badge {
    display: inline-flex;
    align-items: center;
    width: auto;
    max-width: 100%;
    min-height: 18px;
    padding: 3px 6px;
    border: 1px solid transparent;
    border-radius: 4px;
    font-size: 0.62rem;
    font-weight: 700;
    line-height: 1;
    white-space: normal;
  }

  .exercises-page .favorite-exercise-badge--type {
    color: #c8ddff;
    background: rgba(37, 99, 235, 0.2) !important;
    border-color: rgba(96, 165, 250, 0.32);
  }

  .exercises-page .favorite-exercise-badge--muscle {
    color: #bff7ed;
    background: rgba(13, 148, 136, 0.2) !important;
    border-color: rgba(45, 212, 191, 0.3);
  }

  .exercises-page .favorite-exercise-badge--equipment {
    color: #d8dee9;
    background: rgba(100, 116, 139, 0.24) !important;
    border-color: rgba(148, 163, 184, 0.26);
  }

  .exercises-page .favorite-exercise-action {
    position: absolute;
    top: 8px;
    right: 8px;
    margin: 0;
  }

  .exercises-page .favorite-exercise-toggle {
    width: auto !important;
    min-width: 56px;
    height: 32px !important;
    min-height: 32px !important;
    padding: 4px 7px !important;
    border-radius: 6px !important;
    color: #e2e8f0 !important;
    background: #17213a !important;
    border-color: rgba(148, 163, 184, 0.32) !important;
    font-size: 0.7rem;
    white-space: nowrap;
  }

  .exercises-page .favorite-exercise-toggle .fa-heart {
    color: #ef476f !important;
  }
}

  @media (max-width: 430px) {
    .search-compact-row {
      grid-template-columns: minmax(0, 1fr) !important;
    }

    .search-compact-actions {
      width: 100%;
    }

    .search-compact-actions .filter-accordion-toggle {
      width: 100% !important;
    }
  }

  /* v0.85.87 - Exercise Results pagination toolbar consolidation */
  .exercises-page .results-header-row {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    gap: 8px !important;
    grid-template-columns: none !important;
    grid-template-areas: none !important;
  }

  .exercises-page .results-header-title-group {
    min-width: 0;
    flex: 1 1 auto;
  }

  .exercises-page .results-title {
    display: block;
    min-width: 0;
    white-space: normal;
    overflow-wrap: anywhere;
    line-height: 1.15;
  }

  .exercises-page .results-display-toggle {
    display: inline-flex !important;
    align-items: center;
    gap: 6px;
    justify-self: auto !important;
    flex: 0 0 auto;
  }

  .exercises-page .results-display-btn {
    min-width: 72px;
    height: 34px;
    min-height: 34px;
    padding: 6px 10px;
    font-size: 0.76rem;
  }

  .exercises-page .results-pagination-toolbar {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    gap: 6px;
    width: 100%;
    margin-top: 10px;
    padding: 8px;
    border: 1px solid rgba(145, 160, 200, 0.2);
    border-radius: 8px;
    background: rgba(16, 26, 46, 0.88);
    overflow: hidden;
  }

  .exercises-page .results-pagination-toolbar .rows-per-page-control {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin: 0;
    min-width: 0;
    width: auto !important;
    flex: 0 0 auto;
  }

  .exercises-page .results-pagination-toolbar .rows-per-page-label {
    font-size: 0.74rem;
    font-weight: 700;
    color: #c8ddff;
    white-space: nowrap;
  }

  .exercises-page .results-pagination-toolbar .rows-per-page-select {
    width: 58px;
    min-width: 58px;
    max-width: 58px;
    height: 32px;
    min-height: 32px;
    padding: 4px 18px 4px 6px;
    font-size: 0.76rem;
  }

  .exercises-page .results-pagination-toolbar .pagination-btn {
    min-width: 62px;
    height: 32px;
    min-height: 32px;
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 0.74rem;
    font-weight: 700;
    white-space: nowrap;
  }

  .exercises-page .results-pagination-toolbar .pagination-info {
    justify-self: auto;
    flex: 1 1 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 32px;
    min-width: 0;
    font-size: 0.74rem;
    font-weight: 700;
    line-height: 1.1;
    text-align: center;
    white-space: nowrap;
    color: #c8ddff;
  }

  .exercises-page .exercise-toolbar-add--icon {
    width: 32px !important;
    min-width: 32px !important;
    max-width: 32px !important;
    height: 32px !important;
    min-height: 32px !important;
    padding: 0 !important;
    border-radius: 6px !important;
    display: inline-flex !important;
    align-items: center;
    justify-content: center;
    align-self: center;
    margin: 0 !important;
    gap: 0 !important;
  }

  .exercises-page .exercise-toolbar-add--icon i {
    font-size: 0.86rem;
    line-height: 1;
  }

  .exercises-page .results-bottom-actions,
  .exercises-page .pagination-row,
  .exercises-page .results-header-controls,
  .exercises-page .results-header-add,
  .exercises-page .results-count {
    display: none !important;
  }

  @media (max-width: 480px) {
    .exercises-page .results-header-row {
      display: grid !important;
      grid-template-columns: minmax(0, 1fr) !important;
      grid-template-areas:
        'title'
        'toggle' !important;
      align-items: start !important;
      justify-items: stretch;
      padding: 7px 8px !important;
      gap: 6px !important;
    }

    .exercises-page .results-header-title-group {
      grid-area: title;
    }

    .exercises-page .results-title {
      font-size: 0.82rem;
    }

    .exercises-page .results-display-toggle {
      grid-area: toggle;
      justify-self: start !important;
    }

    .exercises-page .results-display-btn {
      min-width: 62px;
      height: 32px;
      min-height: 32px;
      padding: 5px 8px;
      font-size: 0.72rem;
    }

    .exercises-page .results-pagination-toolbar {
      gap: 4px;
      padding: 6px;
      display: flex !important;
      flex-wrap: nowrap !important;
      align-items: center;
    }

    .exercises-page .results-pagination-toolbar .rows-per-page-label {
      font-size: 0.7rem;
    }

    .exercises-page .results-pagination-toolbar .rows-per-page-select {
      width: 50px;
      min-width: 50px;
      max-width: 50px;
      padding-right: 16px;
      font-size: 0.7rem;
    }

    .exercises-page .results-pagination-toolbar .pagination-btn {
      min-width: 48px;
      padding: 3px 5px;
      font-size: 0.66rem;
    }

    .exercises-page .results-pagination-toolbar .pagination-info {
      font-size: 0.66rem;
    }

    .exercises-page .exercise-toolbar-add--icon {
      width: 30px !important;
      min-width: 30px !important;
      max-width: 30px !important;
      height: 30px !important;
      min-height: 30px !important;
    }
  }

.exercises-page .search-compact-actions .filter-accordion-toggle--icon-only {
  width: 32px !important;
  min-width: 32px !important;
  max-width: 32px !important;
  height: 32px !important;
  min-height: 32px !important;
  flex: 0 0 32px !important;
  border-radius: 6px !important;
}

@media (max-width: 480px) {
  .exercises-page .search-compact-actions .filter-accordion-toggle--icon-only {
    width: 30px !important;
    min-width: 30px !important;
    max-width: 30px !important;
    height: 30px !important;
    min-height: 30px !important;
    flex: 0 0 30px !important;
  }
}

/* v0.85.89 - keep Search toolbar to one row on all viewports */
.exercises-page .search-compact-row {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
  flex-wrap: nowrap !important;
  min-width: 0 !important;
  width: 100% !important;
  overflow: hidden !important;
}

.exercises-page .search-filter-input-wrap--search-only {
  flex: 1 1 0% !important;
  width: auto !important;
  max-width: 100% !important;
  min-width: 0 !important;
}

.exercises-page .search-compact-actions {
  display: inline-flex !important;
  align-items: center !important;
  gap: 8px !important;
  flex: 0 0 auto !important;
  flex-wrap: nowrap !important;
  width: auto !important;
  max-width: none !important;
}

.exercises-page .search-compact-actions .filter-accordion-toggle--icon-only {
  flex-shrink: 0 !important;
}

/* v0.85.89 - keep Results header to one row on all viewports */
.exercises-page .results-header-row {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 8px !important;
  flex-wrap: nowrap !important;
}

.exercises-page .results-header-title-group {
  flex: 1 1 auto !important;
  min-width: 0 !important;
}

.exercises-page .results-title {
  white-space: nowrap !important;
}

.exercises-page .results-display-toggle {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: flex-end !important;
  gap: 6px !important;
  flex: 0 0 auto !important;
  flex-wrap: nowrap !important;
}

.exercises-page .results-display-toggle .exercise-toolbar-add--icon {
  margin-left: 2px !important;
  flex-shrink: 0 !important;
}
</style>

