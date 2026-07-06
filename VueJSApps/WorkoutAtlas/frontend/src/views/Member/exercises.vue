<script setup>
   //Import libaries
   import { ref, reactive, computed, onMounted, watch, nextTick } from "vue";
   import DateDropDown from "@/components/DropDownDate.vue"; // not template folder
  import { API_BASE } from '@/config/env';
  import { DEFAULT_EXERCISE_IMAGE, getExerciseImage, getExerciseImageFromGallery } from '@/utils/exerciseImage';
  import { useExerciseFiltering } from '@/composable/exerciseFilters';
   import '@fortawesome/fontawesome-free/css/all.min.css';
   
   // ---- VARIABLES ----
   const allExercises = ref([]);
   const selectedExercise = ref(null);
   const workoutType = ref("All");
   const selectedMuscleGroup = ref("All");
   const selectedEquipment = ref("All");
   const searchExercise = ref("");
   const workoutList = ref([]);
   const activeTab = ref('search-exercises'); // default tab
   const filtersOpen = ref(false); // mobile accordion â€“ collapsed by default
   const existingLogs = ref([]);
  const exercisesLoadError = ref("");
  const exerciseView = ref('all');
  const favoriteExerciseIds = ref(new Set());
  const favoriteExercises = ref([]);
  const loadingFavorites = ref(false);
  const favoritesLoadError = ref("");
  const myCustomExercises = ref([]);
  const customExercisesLoadError = ref('');
  const currentUserRole = ref('');
  const logSearchExercise = ref('');
  const logWorkoutTypeFilter = ref('All');
  const logMuscleGroupFilter = ref('All');
  const logEquipmentFilter = ref('All');
  const logOwnershipFilter = ref('all');
  const logSuggestionIndex = ref(-1);
   
   
   
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
    ImageGallery: '[]',
    CreateAsGlobalExercise: false,
    CanDelete: 0,
    CanEdit: 0,
   });

   // Error and success state for edit form
   const updateError = ref('');
   const updateSuccess = ref('');
   const isSaving = ref(false);
  const isAdminUser = computed(() => {
    const normalized = String(currentUserRole.value || '').trim().toLowerCase();
    return normalized === 'admin' || normalized === 'administrator';
  });
   
   // ---- FILTER EXERCISES ----
   const searchFilters = computed(() => ({
    search: searchExercise.value,
    workoutType: workoutType.value,
    muscleGroup: selectedMuscleGroup.value,
    equipment: selectedEquipment.value,
    ownership: 'all',
   }));

   const logFilters = computed(() => ({
    search: logSearchExercise.value,
    workoutType: logWorkoutTypeFilter.value,
    muscleGroup: logMuscleGroupFilter.value,
    equipment: logEquipmentFilter.value,
    ownership: logOwnershipFilter.value,
   }));

   const filteredExercises = useExerciseFiltering({
    rowsRef: allExercises,
    filtersRef: searchFilters,
   });

   const filteredLogExercises = useExerciseFiltering({
    rowsRef: allExercises,
    filtersRef: logFilters,
   });

   const logExerciseMatches = computed(() => filteredLogExercises.value.slice(0, 8));

   
   // ---- GET MUSCLE GROUPS + EQUIPMENT ----
   const muscleGroups = computed(() => {
     const groups = Array.from(new Set(allExercises.value.map(ex => ex.MuscleGroup)));
     groups.sort((a, b) => {
       if (a === null || a === undefined) return 1;
       if (b === null || b === undefined) return -1;
       return a.localeCompare(b);
     });
     return ["All", ...groups];
   });
   const equipmentList = computed(() => {
     const groups = new Set(allExercises.value.map(ex => ex.Equipment));
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
  const selectedExObj = allExercises.value.find(ex => ex.ExerciseTitle === selectedExercise.value);
  const selectedType = selectedExObj?.WorkoutType || workoutType.value;

  // Duration logic
  let duration = 0;
  if (selectedType !== 'Strength') {
    if (typeof exercise.duration !== 'number' || exercise.duration <= 0) {
      exercise.duration = 0.01;
    }
    duration = exercise.duration;
  } else {
    // Strength: duration is optional
    duration = (typeof exercise.duration === 'number' && exercise.duration > 0) ? exercise.duration : 0;
  }

  // Always include all fields for log table binding
  let newLog = {
    name: selectedExercise.value,
    date: selectedDate.value,
    image: selectedImage.value,
    type: selectedType,
    duration: duration || 0,
    // Strength fields
    sets: selectedType === 'Strength' ? (exercise.sets || 0) : 0,
    reps: selectedType === 'Strength' ? (exercise.reps || 0) : 0,
    weight: selectedType === 'Strength' ? (exercise.weight || 0) : 0,
    // Cardio/Other fields
    distance: selectedType !== 'Strength' ? (exercise.distance || 0) : 0,
    lapsRep: selectedType !== 'Strength' ? (exercise.lapsRep || 0) : 0,
    'Laps-Rep': selectedType !== 'Strength' ? (exercise.lapsRep || 0) : 0,
    calories: selectedType !== 'Strength' ? (exercise.calories || 0) : 0,
    speed: selectedType !== 'Strength' ? (exercise.speed || 0) : 0
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
    const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/workout-log/delete-workout-log/${workoutLogId}`, {
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
      const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/workout-log/add-workout-log`, {
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
    const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/workout-log/get-workout-log?userId=${userId.value}&date=${selectedDate.value}`, {
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
    const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/workout-log/get-workout-log?userId=${userId.value}&date=${formattedDate}`, {
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
    const res = await fetch(`${API_BASE}/api/exercises?view=${encodeURIComponent(exerciseView.value)}`, {
      credentials: 'include'
    });

    if (!res.ok) {
      throw new Error(`Failed to load exercises (${res.status})`);
    }

    const data = await res.json();
    allExercises.value = Array.isArray(data) ? data : [];

    const nextFavoriteIds = new Set();
    allExercises.value.forEach((ex) => {
      if (Number(ex?.IsFavorite || 0) === 1) {
        nextFavoriteIds.add(Number(ex.ExerciseID));
      }
    });
    favoriteExerciseIds.value = nextFavoriteIds;
  } catch (err) {
    console.error('âŒ Failed to load exercises:', err);
    allExercises.value = [];
    favoriteExerciseIds.value = new Set();
    exercisesLoadError.value = 'Could not load exercises right now.';
  }
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

const loadMyCustomExercises = async () => {
  customExercisesLoadError.value = '';
  try {
    const res = await fetch(`${API_BASE}/api/exercises/my`, { credentials: 'include' });
    if (!res.ok) {
      throw new Error(`Failed to load custom exercises (${res.status})`);
    }
    const data = await res.json();
    myCustomExercises.value = Array.isArray(data) ? data : [];
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

  //Get All exercises
  await loadExercisesLibrary();
  await loadMyCustomExercises();

  //Get user ID
  try {
    const res = await fetch(import.meta.env.VITE_API_BASE + '/api/user-id', {
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
  await loadMyCustomExercises();
});

watch(logSearchExercise, () => {
  logSuggestionIndex.value = -1;
});

// Trigger favorites load whenever the favorites tab becomes active
watch(activeTab, (tab) => {
  if (tab === 'favorite-exercises') {
    console.log('Favorite tab active');
    loadFavoriteExercises();
  }
});

// Helper: Switch to log-exercise if there are logs, else to search-exercises
// Does NOT override if the user deliberately switched to the Favorites tab.
function autoSwitchTabToLogOrLibrary() {
  if (activeTab.value === 'favorite-exercises') return;
  if (Array.isArray(existingLogs.value) && existingLogs.value.length > 0) {
    activeTab.value = 'log-exercise';
  } else {
    activeTab.value = 'search-exercises';
  }
}
   
   

   
   
   
   
   
   // Pagination List view
   const displayLimit = ref(3); // default number to show
   const displayedExercises = computed(() => filteredExercises.value.slice(0, displayLimit.value));
   
   const itemsPerPage = ref(3); // user-defined number
   const currentPage = ref(1); // start from 1
   
   
  const getFirstImage = (gallery, exerciseId = 0) => getExerciseImageFromGallery(gallery, exerciseId);

   
   const loadMore = () => {
     visibleCount.value += itemsPerPage.value;
   };
   
   
   
   const pagedExercises = computed(() => {
     const start = (currentPage.value - 1) * itemsPerPage.value;
     const end = start + itemsPerPage.value;
     return filteredExercises.value.slice(start, end);
   });
   
   const nextPage = () => {
     const totalItems = filteredExercises.value.length;
     const maxPage = Math.ceil(totalItems / itemsPerPage.value);
     if (currentPage.value < maxPage) currentPage.value++;
   };
   
   const prevPage = () => {
     if (currentPage.value > 1) currentPage.value--;
   };
   // Pagination liist view
   
   
   
   
   
   
   //Selected Excerise
   const selectExerciseFromList = (ex) => {
     selectedExercise.value = ex.ExerciseTitle;
     activeTab.value = "log-exercise";
     scrollToLogWorkout();
   };

  const selectExerciseForLog = (ex) => {
    if (!ex) return;
    selectedExercise.value = ex.ExerciseTitle;
    logSearchExercise.value = ex.ExerciseTitle;
    logSuggestionIndex.value = -1;
    scrollToLogWorkout();
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
//End of Selected Excerise image
   
   
//Edit Excerise



   const showEditForm = ref(false); // controls form visibility
   
   const workoutTypeOptions = ["Strength", "Cardio", "Other"];
   const recordingTypeOptions = ["Sets & Reps", "Time & Distance", "Custom"];
   
   
   const editExerciseFn = (exercise) => {
     Object.assign(editExercise, exercise);
   };
   
   const startEditing = (exercise) => {
       if (Number(exercise?.CanEdit || 0) !== 1 && !isAdminUser.value) {
         alert('You are not allowed to edit this exercise.');
         return;
       }
     Object.assign(editExercise, exercise);
       editExercise.CreateAsGlobalExercise = Number(exercise?.IsGlobalExercise || 0) === 1;
     showEditForm.value = true;
     scrollToEditForm(); // optional
   };
   
   const scrollToEditForm = () => {
     nextTick(() => {
       const el = document.getElementById("editExerciseForm");
       if (el) el.scrollIntoView({ behavior: "smooth" });
     });
   };
   
   
   const saveEditedExercise = async () => {
     // Clear previous messages
     updateError.value = '';
     updateSuccess.value = '';

     // Validation
     if (!editExercise.ExerciseTitle?.trim()) {
       updateError.value = 'Exercise Name is required';
       return;
     }
     if (!editExercise.WorkoutType?.trim()) {
       updateError.value = 'Workout Type is required';
       return;
     }
     if (!editExercise.RecordingType?.trim()) {
       updateError.value = 'Recording Type is required';
       return;
     }
     if (!editExercise.MuscleGroup?.trim()) {
       updateError.value = 'Muscle Group is required';
       return;
     }

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
       
       // Existing images to keep
       formData.append('existingImages', JSON.stringify(existingImages.value));
       // Images to delete
       formData.append('imagesToDelete', JSON.stringify(imagesToDelete.value));
       // New uploads
       selectedImages.value.forEach((img) => formData.append('images', img));

       const url = isUpdate
         ? import.meta.env.VITE_API_BASE + `/api/get-exercise/${editExercise.ExerciseID}`
         : import.meta.env.VITE_API_BASE + '/api/save-exercises';
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
      await loadMyCustomExercises();
       
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
    const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/workout-log/update-workout-log`, {
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
  WorkoutType: '',
  RecordingType: '',
  Equipment: '',
  MuscleGroup: '',
  Instructions: '',
  ImageGallery: '[]',
  CreateAsGlobalExercise: false,
});

const showAddForm = ref(false); // Toggle form visibility
// Unified AddWorkout for image upload (FormData)
const addFormError = ref("");
const AddWorkout = async () => {
  addFormError.value = "";
  if (!newExercise.ExerciseTitle || !newExercise.WorkoutType || !newExercise.MuscleGroup) {
    addFormError.value = "Error - Please fill out all fields (ExerciseTitle, WorkoutType, MuscleGroup)";
    return;
  }
  const formData = new FormData();
  for (const [key, value] of Object.entries(newExercise)) {
    formData.append(key, value || '');
  }
  selectedImages.value.forEach((img) => formData.append('images', img));
  try {
    const res = await fetch(import.meta.env.VITE_API_BASE + '/api/save-exercises', {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to add exercise');
    // Refresh the list
    await loadExercisesLibrary();
    await loadMyCustomExercises();
    alert('âœ… New exercise added!');
    showAddForm.value = false;
    // Reset form and images
    Object.assign(newExercise, {
      ExerciseTitle: '',
      WorkoutType: 'Strength',
      RecordingType: 'Sets & Reps',
      Equipment: '',
      MuscleGroup: '',
      Instructions: '',
      ImageGallery: '[]',
      CreateAsGlobalExercise: false,
    });
    selectedImages.value = [];
    imagePreviews.value = [];
    existingImages.value = [];
    imagesToDelete.value = [];
  } catch (err) {
    console.error('âŒ Add failed:', err);
    addFormError.value = 'Error adding exercise.';
  }
};
// (Duplicate removed below)
//Excerise



// Image Upload (Add/Edit Exercise)
const selectedImages = ref([]); // For new uploads (add/edit)
const imagePreviews = ref([]); // For previewing new uploads
const existingImages = ref([]); // For images already in DB (edit only)
const imagesToDelete = ref([]); // For images marked for deletion (edit only)

// For Add: handle new uploads
const handleImageUpload = (event) => {
  const files = Array.from(event.target.files);
  if (files.length + existingImages.value.length > 2) {
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

// For Edit: load existing images from ImageGallery
const loadExistingImages = () => {
  if (editExercise.ImageGallery) {
    try {
      const arr = typeof editExercise.ImageGallery === 'string' ? JSON.parse(editExercise.ImageGallery) : editExercise.ImageGallery;
      existingImages.value = arr.slice(0, 2); // Only allow 2
    } catch {
      existingImages.value = [];
    }
  } else {
    existingImages.value = [];
  }
  imagesToDelete.value = [];
};

// Call this when opening edit form
watch(showEditForm, (val) => { if (val) loadExistingImages(); });

// Remove existing image (mark for deletion)
const removeExistingImage = (img) => {
  imagesToDelete.value.push(img);
  existingImages.value = existingImages.value.filter(i => i !== img);
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


// Delete Exercise function
const deleteExercise = async (exercise) => {
  if (!exercise.ExerciseID) {
    alert('No ExerciseID found.');
    return;
  }
  if (Number(exercise?.CanDelete || 0) !== 1 && !isAdminUser.value) {
    alert('You are not allowed to delete this exercise.');
    return;
  }
  if (!confirm('Are you sure you want to delete this exercise? This cannot be undone.')) return;
  try {
    const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/delete-exercise/${exercise.ExerciseID}`,
      {
        method: 'DELETE',
        credentials: 'include'
      });
    if (!res.ok) throw new Error('Failed to delete exercise');
    // Refresh exercise list
    await loadExercisesLibrary();
    await loadMyCustomExercises();
    alert('âœ… Exercise deleted!');
    showEditForm.value = false;
  } catch (err) {
    alert('Failed to delete exercise.');
  }
};

// add this function near other handlers (e.g. after AddWorkout or near pagination handlers)
const clearFilters = () => {
  exerciseView.value = 'all';
  workoutType.value = 'All';
  selectedMuscleGroup.value = 'All';
  selectedEquipment.value = 'All';
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


</script>

<template>
  <div class="app-page-shell exercises-page">
  <div class="app-page-canvas app-inner-shell exercises-canvas">




  <section class="builder-hero ff-page-header app-header-gradient">


      <div class="builder-hero__content">
        <h2>Exercises Database</h2>
      </div>
      
    </section>








   <!-- Exercise Tab Section -->
  <div class="ex-page-body app-section-card">

              <nav class="ex-tab-bar" role="tablist" aria-label="Log workout sections">
                <button
                  type="button"
                  class="ex-tab"
                  :class="{ 'ex-tab--active': activeTab === 'search-exercises' }"
                  :aria-selected="activeTab === 'search-exercises'"
                  role="tab"
                  @click="activeTab = 'search-exercises'"
                >
                  <i class="fa-solid fa-magnifying-glass me-2"></i><span class="tab-label-full">Search Exercises</span><span class="tab-label-short">Search</span>
                </button>
                <button
                  type="button"
                  class="ex-tab"
                  :class="{ 'ex-tab--active': activeTab === 'log-exercise' }"
                  :aria-selected="activeTab === 'log-exercise'"
                  role="tab"
                  @click="activeTab = 'log-exercise'"
                >
                  <i class="fa-solid fa-dumbbell me-2"></i><span class="tab-label-full">My Custom Exercises</span><span class="tab-label-short">Custom</span>
                </button>
                <button
                  type="button"
                  class="ex-tab"
                  :class="{ 'ex-tab--active': activeTab === 'favorite-exercises' }"
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
                <div class="panel search-filter-card">
                  <!-- Mobile-only accordion toggle -->
                  <button class="filter-accordion-toggle" @click="filtersOpen = !filtersOpen" :aria-expanded="filtersOpen">
                    <span><i class="fa-solid fa-sliders me-2"></i>Filters</span>
                    <i :class="filtersOpen ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'"></i>
                  </button>
                  <!--Start of panel-->
                  <div class="panel-header search-filter-head">
                    <h4><i class="fa-solid fa-magnifying-glass me-2"></i>Search Exercises</h4>
                  </div>
                  <!--end of panel header-->
                  <div class="panel-body search-filter-body filter-body-animated" :class="{ 'filters-mobile-hidden': !filtersOpen }">
                      <div v-if="exercisesLoadError" class="alert alert-warning">
                        {{ exercisesLoadError }}
                      </div>
                      <div class="search-filter-grid">
                        <div class="search-filter-field full-width">
                          <label class="form-label">Search</label>
                          <input v-model="searchExercise" type="text" class="form-control" placeholder="Search exercise by name" />
                        </div>

                        <div class="search-filter-field">
                          <label class="form-label">View</label>
                          <select v-model="exerciseView" class="form-select">
                            <option value="all">All Exercises</option>
                            <option value="mine">My Exercises</option>
                            <option value="favorites">Favorite Exercises</option>
                          </select>
                        </div>

                        <div class="search-filter-field">
                          <label class="form-label">Workout Type</label>
                          <select v-model="workoutType" class="form-select">
                            <option value="All">All</option>
                            <option value="Strength">Strength</option>
                            <option value="Cardio">Cardio</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>

                        <div class="search-filter-field">
                          <label class="form-label">Muscle Group</label>
                          <select v-model="selectedMuscleGroup" class="form-select">
                            <option v-for="group in muscleGroups" :key="group" :value="group">
                              {{ group }}
                            </option>
                          </select>
                        </div>

                        <div class="search-filter-field">
                          <label class="form-label">Equipment</label>
                          <select v-model="selectedEquipment" class="form-select">
                            <option v-for="equip in equipmentList" :key="equip" :value="equip">
                              {{ equip }}
                            </option>
                          </select>
                        </div>
                      </div>

                      <div class="search-filter-actions">
                        <button class="btn btn-success add-exercise-centered" @click="showAddForm = !showAddForm">
                          {{ showAddForm ? 'Cancel' : 'âž• Add New Exercise' }}
                        </button>
                        <button class="btn btn-outline-secondary clear-filters-btn" @click="clearFilters" title="Reset filters">Clear Filters</button>
                      </div>

                      <div class="search-filter-divider"></div>
                  </div>
                </div>
                <!--End of Panel-->




              <!-- Exercise Results container -->
        
                <div class="panel exercise-results-panel">

                    <!--edit Excerise-->
                    <div class="row g-3 mt-3">
                        <div v-if="showEditForm" id="editExerciseForm" class="panel edit-exercise-panel col-12">
                            <div class="panel-header">
                              <h4>Edit Exercise</h4>
                            </div>
                            <div class="panel-body row g-3">
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
                                    <option v-for="group in muscleGroups" :key="group" :value="group">{{ group }}</option>
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
                                    :disabled="imagePreviews.length + existingImages.length >= 2"
                                  />
                                  <div class="mt-2 d-flex gap-2 flex-wrap">
                                    <template v-for="(img, index) in imagePreviews" :key="'new-edit-' + index">
                                      <div class="mb-2 position-relative">
                                        <img :src="img" style="max-width: 200px; border: 1px solid #ccc; border-radius: 12px;" />
                                        <span @click="removeNewImage(index)" style="position:absolute;top:0;right:0;color:red;cursor:pointer;font-size:3em;">&times;</span>
                                      </div>
                                    </template>
                                    <template v-for="(img, index) in existingImages" :key="'exist-edit-' + index">
                                      <div class="mb-2 position-relative">
                                        <img :src="getExerciseImage({ ExerciseID: editExercise.ExerciseID, PrimaryImage: img, ImageGallery: [img] })" style="max-width: 200px; border: 1px solid #ccc; border-radius: 12px;" />
                                        <span @click="removeExistingImage(img)" style="position:absolute;top:0;right:0;color:red;cursor:pointer;font-size:3em;">&times;</span>
                                        <div class="small text-center">{{ img.split('/').pop() }}</div>
                                      </div>
                                    </template>
                                  </div>
                              </div>
                              <div class="col-md-12">
                                  <label class="form-label">Instructions</label>
                                  <textarea v-model="editExercise.Instructions" class="form-control instructions" rows="=3" />
                              </div>
                              <div class="col-md-12" v-if="isAdminUser">
                                <div class="form-check mt-2">
                                  <input id="edit-global-toggle" v-model="editExercise.CreateAsGlobalExercise" class="form-check-input" type="checkbox" />
                                  <label for="edit-global-toggle" class="form-check-label">Create as Global Exercise</label>
                                </div>
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
                                    <button class="btn btn-outline-secondary ms-2" @click="showEditForm = false" :disabled="isSaving">Cancel</button>
                                  </div>
                                  <div class="ms-auto">
                                    <button v-if="Number(editExercise.CanDelete || 0) === 1 || isAdminUser" class="btn btn-danger" @click="deleteExercise(editExercise)" style="background-color: #e53935; color: #fff; min-width: 140px;">Delete Exercise</button>
                                  </div>
                              </div>

                            </div>
                        </div>
                    </div>
                    <!-- Edit Excerise-->
                <!--add Excerise-->
            
                    <div class="row g-3 mt-3">

                       <div v-if="showAddForm" class="panel mt-2">
  <div class="panel-header">
    <h4>Add New Exercise</h4>
  </div>
  <div class="panel-body row g-3">
    <div class="col-md-12">
      <div v-if="addFormError" class="alert alert-danger mb-2">{{ addFormError }}</div>
      <label class="form-label">Exercise Name <span style="color:red">*</span></label>
      <input v-model="newExercise.ExerciseTitle" class="form-control" required />
    </div>

    <div class="col-md-6">
      <label class="form-label">Workout Type <span style="color:red">*</span></label>
      <select v-model="newExercise.WorkoutType" class="form-select" required>
        <option v-for="type in workoutTypeOptions" :key="type" :value="type">{{ type }}</option>
      </select>
    </div>

    <div class="col-md-6">
      <label class="form-label">Recording Type</label>
      <select v-model="newExercise.RecordingType" class="form-select">
        <option v-for="type in recordingTypeOptions" :key="type" :value="type">{{ type }}</option>
      </select>
    </div>

    <div class="col-md-6">
      <label class="form-label">Equipment</label>
      <input v-model="newExercise.Equipment" class="form-control" />
    </div>

    <div class="col-md-6">
      <label class="form-label">Muscle Group <span style="color:red">*</span></label>
      <select v-model="newExercise.MuscleGroup" class="form-select" required>
        <option v-for="group in muscleGroups" :key="group" :value="group">{{ group }}</option>
      </select>
    </div>

    <!-- Add this inside your Add Exercise form component -->
<div class="col-md-12">
  <h6>Upload Images (max 2).</h6>
  <label class="form-label">Only image files are allowed (jpeg, jpg, png, gif, webp)</label>
  <input 
    type="file" 
    multiple 
    accept="image/*" 
    @change="handleImageUpload"
    class="form-control"
    :disabled="imagePreviews.length + existingImages.length >= 2"
  />
  <div class="mt-2 d-flex gap-2">
    <div v-for="(img, index) in imagePreviews" :key="'new-' + index" class="mb-2 position-relative">
      <img :src="img" style="max-width: 200px; border: 1px solid #ccc; border-radius: 12px;" />
      <span @click="removeNewImage(index)" style="position:absolute;top:0;right:0;color:red;cursor:pointer;font-size:3em;">&times;</span>
    </div>
    <div v-for="(img, index) in existingImages" :key="'exist-' + index" class="mb-2 position-relative">
      <img :src="getExerciseImage({ ExerciseID: newExercise.ExerciseID, PrimaryImage: img, ImageGallery: [img] })" style="max-width: 200px; border: 1px solid #ccc; border-radius: 12px;" />
      <span @click="removeExistingImage(img)" style="position:absolute;top:0;right:0;color:red;cursor:pointer;font-size:3em;">&times;</span>
      <div class="small text-center">{{ img.split('/').pop() }}</div>
    </div>
  </div>
</div>










    <div class="col-md-12">
      <label class="form-label">Instructions</label>
      <textarea v-model="newExercise.Instructions" class="form-control instructions" rows="3" />
    </div>

    <div class="col-md-12" v-if="isAdminUser">
      <div class="form-check mt-2">
        <input id="add-global-toggle" v-model="newExercise.CreateAsGlobalExercise" class="form-check-input" type="checkbox" />
        <label for="add-global-toggle" class="form-check-label">Create as Global Exercise</label>
      </div>
    </div>

    <div class="col-12 mt-3">
      <button class="btn btn-primary" @click="AddWorkout">Add Exercise</button>
      <button class="btn btn-outline-secondary ms-2" @click="showAddForm = false">Cancel</button>
    </div>
  </div>
</div>
                    </div>
                    <!-- ADD Excerise-->





                      <!--LIST VIEW-->
                      <div class="row g-3 mt-2">
                        <div class="results-header-row">
                          <span class="results-title">Exercise Results</span>
                          <span class="results-count">{{ filteredExercises.length }} items</span>
                        </div>

                        <div class="exercise-list">
                            <div class="exercise-row" v-for="ex in pagedExercises" :key="ex.ExerciseID">
                              <div class="exercise-img">
                                  <img
                                    :src="getFirstImage(ex.ImageGallery, ex.ExerciseID)"
                                    @click="selectExerciseFromList(ex)"
                                    class="clickable"
                                  />
                              </div>

                              <div class="exercise-info">
                                  <h5 class="exercise-title">{{ ex.ExerciseTitle }}</h5>

                                  <div class="exercise-meta">
                                    <p class="exercise-meta-inline">{{ ex.WorkoutType }}<span class="meta-dot"> • </span>{{ ex.MuscleGroup }}<span class="meta-dot"> • </span>{{ ex.Equipment }}</p>
                                    <p class="exercise-meta-inline" v-if="Number(ex.IsGlobalExercise || 0) === 1">Global exercise</p>
                                    <p class="exercise-meta-inline" v-else>Custom exercise</p>
                                  </div>

                                  <div class="exercise-actions">
                                    <button
                                      :class="['btn', 'btn-sm', 'btn-fav', isFavoriteExercise(ex.ExerciseID) && 'btn-fav--active']"
                                      @click="toggleFavoriteExercise(ex)"
                                    >
                                      <i v-if="isFavoriteExercise(ex.ExerciseID)" class="fa-solid fa-heart"></i>
                                      {{ isFavoriteExercise(ex.ExerciseID) ? 'Unfav' : 'Fav' }}
                                    </button>
                                    <button v-if="Number(ex.CanEdit || 0) === 1 || isAdminUser" class="btn btn-sm btn-outline-secondary" @click="startEditing(ex)">
                                      Edit Exercise
                                    </button>
                                  </div>
                              </div>
                            </div>

                            <div class="pagination-row">
                              <button class="btn btn-outline-secondary pagination-btn" @click="prevPage" :disabled="currentPage === 1">Prev</button>
                              <span class="pagination-info">Page {{ currentPage }} / {{ Math.ceil(filteredExercises.length / itemsPerPage) }}</span>
                              <button class="btn btn-outline-dark pagination-btn" @click="nextPage"
                                  :disabled="currentPage * itemsPerPage >= filteredExercises.length">Next</button>
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
  <div v-if="activeTab === 'favorite-exercises'">
    <div class="container container-block">
      <div class="panel search-filter-card">
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
          <div v-else class="row">
            <div v-for="ex in favoriteExercises" :key="ex.ExerciseID" class="col-sm-6 col-lg-4 col-xl-3 mb-4">
              <div class="exercise-card">
                <div class="exercise-image">
                  <img
                    :src="getExerciseImage(ex)"
                    :alt="ex.ExerciseTitle"
                    class="img-fluid"
                    loading="lazy"
                    @error="$event.target.src = DEFAULT_EXERCISE_IMAGE"
                  />
                </div>
                <div class="exercise-content">
                  <h5 class="exercise-title">{{ ex.ExerciseTitle }}</h5>
                  <div class="exercise-meta">
                    <span class="badge bg-primary me-1">{{ ex.WorkoutType }}</span>
                    <span class="badge bg-info me-1">{{ ex.MuscleGroup }}</span>
                    <span class="badge bg-secondary">{{ ex.Equipment }}</span>
                  </div>
                </div>
                <div class="exercise-actions">
                  <button
                    class="btn btn-sm btn-fav btn-fav--active"
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

  <!-- Log Exercise Section -->
  <div v-if="activeTab === 'log-exercise'">

  <div class="container container-block">
    <div class="panel">
      <div class="panel-header">
        <h4>My Custom Exercises</h4>
      </div>
      <div class="panel-body">
        <div v-if="customExercisesLoadError" class="alert alert-warning">{{ customExercisesLoadError }}</div>
        <div v-else-if="myCustomExercises.length === 0" class="text-center py-4">
          <p class="mb-2">No custom exercises created yet.</p>
          <p class="text-muted mb-3">Create your first custom exercise to personalize your workouts.</p>
          <button class="btn btn-success" @click="activeTab = 'search-exercises'; showAddForm = true">+ Create Exercise</button>
        </div>
        <div v-else class="exercise-list">
          <div class="exercise-row" v-for="myEx in myCustomExercises" :key="`mine-${myEx.ExerciseID}`">
            <div class="exercise-img">
              <img :src="getFirstImage(myEx.ImageGallery, myEx.ExerciseID)" class="clickable" @click="selectExerciseForLog(myEx)" />
            </div>
            <div class="exercise-info">
              <h5 class="exercise-title">{{ myEx.ExerciseTitle }}</h5>
              <div class="exercise-meta">
                <p class="exercise-meta-inline">{{ myEx.WorkoutType }}<span class="meta-dot"> • </span>{{ myEx.MuscleGroup }}<span class="meta-dot"> • </span>{{ myEx.Equipment }}</p>
              </div>
              <div class="exercise-actions">
                <button class="btn btn-sm btn-primary" @click="selectExerciseForLog(myEx)">Use in Log</button>
                <button v-if="Number(myEx.CanEdit || 0) === 1 || isAdminUser" class="btn btn-sm btn-outline-secondary" @click="startEditing(myEx)">Edit Exercise</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>


  <!--Log Excerise container -->
  <div class="container container-block">
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
                    <img :src="getFirstImage(match.ImageGallery, match.ExerciseID)" class="clickable" />
                  </div>
                  <div class="exercise-info">
                    <h5 class="exercise-title">{{ match.ExerciseTitle }}</h5>
                    <p class="exercise-meta-inline">{{ match.WorkoutType }}<span class="meta-dot"> • </span>{{ match.MuscleGroup }}<span class="meta-dot"> • </span>{{ match.Equipment }}</p>
                  </div>
                </div>
              </div>
            </div>


            <!-- Strength / Cardio Inputs -->
            <div id="log-workout-form" class="row g-3 mt-3" v-if="selectedExercise">
               
               <!--Workout Excerise-->
               <div class="col-md-4">
                 <img
                   v-if="selectedImage !== 'fallback.jpg'"
                   :src="selectedImage"
                   alt="Selected Exercise"
                   class="img-fluid workout-log-img"
                 />
               </div>
               <!--End of Workout Excerise-->

               <div class="col-md-8">
                 <h5><b>Selected Excerise Name: </b> {{ selectedExercise }}</h5>
                 <div v-if="selectedExercise" class="d-flex align-items-center mb-2">
                   <div class="sel-ex-input"><strong>Muscle Group: </strong>
                   
                     {{
                       (allExercises.find(ex => ex.ExerciseTitle === selectedExercise) && allExercises.find(ex => ex.ExerciseTitle === selectedExercise).MuscleGroup) || 'N/A'
                     }}
                   </div>
                 </div>


                 <!-- Strength Fields -->
                 <div v-if="selectedExercise && (allExercises.find(ex => ex.ExerciseTitle === selectedExercise)?.WorkoutType === 'Strength')">
                   <div class="d-flex align-items-center mb-2">
                     <div class="sel-ex-input">Weight (lbs):</div>
                     <input v-model.number="exercise.weight" type="number" class="form-control ms-2" min="1" />
                   </div>
                   <div class="d-flex align-items-center mb-2">
                     <div class="sel-ex-input">Reps:</div>
                     <input v-model.number="exercise.reps" type="number" class="form-control ms-2" min="1" />
                   </div>
                   <div class="d-flex align-items-center">
                     <div class="sel-ex-input">Sets:</div>
                     <input v-model.number="exercise.sets" type="number" class="form-control ms-2" min="1" />
                   </div>
                 </div>

                 <!-- Cardio Fields (hide if Strength) -->
                 <div v-if="selectedExercise && (allExercises.find(ex => ex.ExerciseTitle === selectedExercise)?.WorkoutType !== 'Strength')">
                   <div class="d-flex">
                     <div class="sel-ex-input">Distance (mi):</div>
                     <div>
                       <input v-model.number="exercise.distance" type="number" class="form-control" min="0" step="0.01" />
                     </div>
                   </div>
                   <div class="d-flex">
                     <div class="sel-ex-input">Laps-Rep:</div>
                     <div>
                       <input v-model.number="exercise.lapsRep" type="number" class="form-control" min="0" />
                     </div>
                   </div>
                   <div class="d-flex">
                     <div class="sel-ex-input">Calories:</div>
                     <div>
                       <input v-model.number="exercise.calories" type="number" class="form-control" min="0" />
                     </div>
                   </div>
                   <div class="d-flex">
                     <div class="sel-ex-input">Speed (mph):</div>
                     <div>
                       <input v-model.number="exercise.speed" type="number" class="form-control" min="0" step="0.01" />
                     </div>
                   </div>
                 </div>

                 <!-- Duration Timer (Always show in log-exercise tab) -->
                 <div v-if="activeTab === 'log-exercise'" class="d-flex align-items-center mt-2">
                   <div class="sel-ex-input">Duration (min):</div>
                   <div class="input-group">
                     <input v-model.number="exercise.duration" type="number" class="form-control" min="0" />
                     <button class="btn btn-outline-secondary ms-2" type="button" @click="toggleStopwatch">{{ stopwatchRunning ? 'Stop' : 'Start' }}</button>
                     <span class="ms-2">{{ formattedStopwatch }}</span>
                     <button v-if="stopwatchRunning || stopwatchTime > 0" class="btn btn-outline-danger ms-2" type="button" @click="resetStopwatch">Reset</button>
                   </div>
                 </div>


                 <!-- Add Exercise Button -->
                 <div class="d-flex">
                   <button class="btn btn-secondary" @click="activeTab = 'search-exercises'">Back to excerise list.</button>
                   <button @click="addExercise" class="btn btn-primary">Log Exercise</button>
                 </div>
               </div>

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
<div class="container mt-8 container-block">
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
      :src="log.image || getFirstImage(log.ImageGallery, log.ExerciseID)"
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
}

.exercises-canvas {
  display: grid;
  gap: 16px;
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

.panel {
  border: 1px solid #e5ecf5;
  border-radius: 16px;
  padding: 15px;
  background: #ffffff;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.045);
  width: 100%;
  box-sizing: border-box;
}

.panel-header h4 {
  margin: 0;
  color: #0f172a;
  font-weight: 800;
}

.panel-body {
  color: #334155;
}

.exercise-card {
  min-height: 120px;
  background-color: #fff;
  border-radius: 12px;
}
.exercise-card .exercise-image {
  width: 75%;
  margin: 0 auto;
}
.exercise-card .exercise-image img {
  width: 100%;
  height: auto;
  border-radius: 10px;
  display: block;
}
.image-box {
  flex-shrink: 0;
}
.exercise-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.exercise-row {
  display: grid;
  grid-template-columns: 132px minmax(0, 1fr);
  gap: 14px;
  padding: 10px 12px;
  border: 1px solid #dbe4ef;
  background: #ffffff;
  border-radius: 16px;
  align-items: center;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.035);
  transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
  width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}
.exercise-row:hover {
  transform: translateY(-1px);
  border-color: #93c5fd;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
}
.exercise-img img {
  width: 132px;
  height: 132px;
  object-fit: cover;
  border-radius: 14px;
}
.exercise-img {
  width: 132px;
  flex-shrink: 0;
}
.exercise-info {
  min-width: 0;
  display: grid;
  gap: 8px;
}
.exercise-title {
  font-weight: 800;
  font-size: 1rem;
  color: #0f172a;
  margin: 0 0 6px 0;
  padding: 0;
  border: 0;
}
.exercise-meta {
  display: grid;
  gap: 2px;
  margin-bottom: 8px;
}
.exercise-meta p {
  margin: 0;
  color: #64748b;
  font-size: 0.86rem;
  line-height: 1.35;
}
.exercise-meta p span {
  color: #334155;
  font-weight: 800;
  margin-right: 0;
}
.exercise-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 0;
}
.exercise-actions .btn {
  padding: 5px 10px;
  font-size: 0.8rem;
  border-radius: 7px;
  margin: 0;
}

.btn-fav {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  color: #475569;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.btn-fav:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
  color: #334155;
}
.btn-fav--active {
  background: #fee2e2;
  border-color: #fecaca;
  color: #991b1b;
}
.btn-fav--active .fa-heart {
  color: #dc2626;
}
.btn-fav--active:hover {
  background: #fecaca;
  border-color: #fca5a5;
  color: #7f1d1d;
}

/* Edit Exercise Panel */
.edit-exercise-panel {
  border: 1px solid #dbe4ef;
  border-radius: 16px;
  padding: 22px 24px;
  background: #ffffff;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.05);
  margin-top: 20px !important;
}
.edit-exercise-panel .panel-header {
  padding-bottom: 12px;
  margin-bottom: 16px;
  border-bottom: 1px dashed #cbd5e1;
}
.edit-exercise-panel .panel-header h4 {
  font-size: 1.15rem;
  font-weight: 800;
  color: #0f172a;
  margin: 0;
}
.edit-exercise-panel .form-label {
  font-size: 0.76rem;
  font-weight: 700;
  color: #64748b;
  margin-bottom: 5px;
}
.edit-exercise-panel .form-control,
.edit-exercise-panel .form-select {
  min-height: 38px;
  border: 1px solid #d6dee9;
  background: #ffffff;
  color: #334155;
  font-size: 0.9rem;
}
.edit-exercise-panel .form-control:focus,
.edit-exercise-panel .form-select:focus {
  border-color: #93c5fd;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.16);
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
  padding: 14px;
  margin: 0;
  background: #ffffff;
  border: 1px solid #e5ecf5;
  border-radius: 18px;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.045);
  box-sizing: border-box;
  overflow-x: hidden;
}

.ex-tab-bar {
  display: flex;
  align-items: stretch;
  background: #1e293b;
  border-radius: 14px 14px 0 0;
  padding: 0 6px;
  gap: 2px;
  margin-bottom: 0;
}

.ex-tab {
  flex: 1;
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.62);
  font-size: 0.92rem;
  font-weight: 600;
  padding: 15px 20px 14px;
  cursor: pointer;
  transition: color 0.2s ease, background-color 0.2s ease;
  white-space: nowrap;
}

.ex-tab::after {
  content: "";
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: -1px;
  height: 3px;
  border-radius: 999px;
  background: #f97316;
  transform: scaleX(0);
  transform-origin: center;
  transition: transform 0.22s ease;
  z-index: 2;
}
.ex-tab:hover { color: rgba(255, 255, 255, 0.92); }
.ex-tab--active {
  color: #ffffff;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.06);
}
.ex-tab--active::after { transform: scaleX(1); }
.ex-tab i,
.ex-tab span { color: inherit; }

/* Short/full label logic â€“ desktop: show full only */
.tab-label-short { display: none; }
.tab-label-full  { display: inline; }

/* â”€â”€ Filter card â”€â”€ */
.search-filter-card {
  border-radius: 12px;
  border: 1px solid #dbe4ef;
  box-shadow: 0 4px 10px rgba(15, 23, 42, 0.03);
  padding: 0;
}

.search-filter-head { display: none; }
.search-filter-head h4 {
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
  color: #0f172a;
}

.search-filter-body {
  padding: 8px 14px 8px;
}

/* Mobile accordion toggle â€“ hidden on desktop */
.filter-accordion-toggle {
  display: none;
}

/* Filter body animated collapse (mobile only) */
.filter-body-animated {
  overflow: hidden;
  transition: max-height .25s ease, opacity .2s ease;
}
.filter-body-animated.filters-mobile-hidden {
  display: block !important;
  max-height: 0 !important;
  opacity: 0;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
  pointer-events: none;
}

/* Inline meta */
.exercise-meta-inline {
  margin: 0;
  color: #64748b;
  font-size: 0.86rem;
  line-height: 1.35;
}
.meta-dot { color: #cbd5e1; }

/* Pagination row */
.pagination-row {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
}
.pagination-btn { min-width: 72px; }
.pagination-info {
  font-size: 0.86rem;
  color: #64748b;
  font-weight: 600;
  white-space: nowrap;
}

.search-filter-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px 10px;
  align-items: end;
}
.search-filter-field.full-width { grid-column: 1 / -1; }
.search-filter-field .form-label {
  margin-bottom: 2px;
  font-size: 0.76rem;
  font-weight: 700;
  color: #64748b;
}
.search-filter-field .form-control,
.search-filter-field .form-select {
  min-height: 34px;
  padding: 5px 10px;
  font-size: 0.9rem;
  border: 1px solid #dbe4ef;
  background: #f8fafc;
  color: #334155;
}
.search-filter-field .form-control:focus,
.search-filter-field .form-select:focus {
  border-color: #93c5fd;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.16);
}

.search-filter-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 8px;
  flex-wrap: wrap;
}
.search-filter-divider { display: none; }

.results-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid #e7edf5;
  padding-top: 8px;
  margin-top: 0;
  margin-bottom: 8px;
}
.results-title {
  font-size: 1rem;
  font-weight: 700;
  color: #334155;
}
.results-count {
  font-size: 0.84rem;
  color: #64748b;
}

.tab-content {
  background: #ffffff;
  border: 1px solid #dbe4ef;
  border-top: none;
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
  border-radius: 0 0 14px 14px;
}
.exercise-results-panel { padding-top: 0; }

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

<<<<<<< HEAD:VueJSApps/WorkoutAtlas/frontend/src/views/Member/exercises.vue
=======
/* -- 0.84.39 Exercise Database dark-theme normalization (scoped) ---------- */
.exercises-page {
  --ex-surface-1: var(--wa-shell-surface, #121923);
  --ex-surface-2: var(--wa-shell-surface-elevated, #17212d);
  --ex-surface-3: var(--wa-shell-surface-soft, #1d2a38);
  --ex-border: var(--wa-shell-border, rgba(120, 145, 175, 0.16));
  --ex-border-strong: var(--wa-shell-border-strong, rgba(120, 145, 175, 0.24));
  --ex-text: var(--wa-shell-text, #f8fafc);
  --ex-text-secondary: var(--wa-shell-text-secondary, #a4b0c0);
  --ex-text-muted: var(--wa-shell-text-muted, #738196);
  --ex-accent: var(--wa-shell-accent, var(--main-color, #3b82f6));
}

.exercises-page .builder-hero.ff-page-header.app-header-gradient {
  background: linear-gradient(135deg, rgba(15, 25, 39, 0.98), rgba(20, 31, 47, 0.95)) !important;
  border: 1px solid var(--ex-border);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.25);
}

.exercises-page .ex-page-body,
.exercises-page .tab-content,
.exercises-page .panel,
.exercises-page .search-filter-card,
.exercises-page .exercise-row,
.exercises-page .exercise-card,
.exercises-page .edit-exercise-panel,
.exercises-page .list-group-item,
.exercises-page .filter-accordion-toggle {
  background: var(--ex-surface-1);
  border-color: var(--ex-border);
  color: var(--ex-text);
}

.exercises-page .exercise-row:hover,
.exercises-page .exercise-row--active,
.exercises-page .search-filter-field .form-control,
.exercises-page .search-filter-field .form-select,
.exercises-page .edit-exercise-panel .form-control,
.exercises-page .edit-exercise-panel .form-select,
.exercises-page .filter-accordion-toggle,
.exercises-page .ex-tab--active,
.exercises-page .btn-fav {
  background: var(--ex-surface-2);
  border-color: var(--ex-border-strong);
}

.exercises-page .panel-header h4,
.exercises-page .exercise-title,
.exercises-page .results-title,
.exercises-page .pagination-info,
.exercises-page .logged-exercise-title,
.exercises-page .workout-log-summary,
.exercises-page .ex-tab--active {
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

.exercises-page .ex-tab-bar {
  background: var(--ex-surface-2);
  border-bottom: 1px solid var(--ex-border);
}

.exercises-page .ex-tab:hover {
  color: var(--ex-text);
  background: var(--ex-surface-3);
}

.exercises-page .ex-tab::after {
  background: var(--ex-accent);
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

.exercises-page .search-filter-field .form-control:focus,
.exercises-page .search-filter-field .form-select:focus,
.exercises-page .edit-exercise-panel .form-control:focus,
.exercises-page .edit-exercise-panel .form-select:focus {
  border-color: color-mix(in srgb, var(--ex-accent) 60%, var(--ex-border) 40%);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ex-accent) 24%, transparent 76%);
}

.exercises-page .btn-fav {
  color: var(--ex-text-secondary);
}

.exercises-page .btn-fav:hover {
  background: var(--ex-surface-3);
  color: var(--ex-text);
}

.exercises-page .btn-fav--active {
  background: color-mix(in srgb, #dc2626 20%, var(--ex-surface-2) 80%);
  border-color: color-mix(in srgb, #dc2626 40%, var(--ex-border) 60%);
  color: #fecaca;
}

.exercises-page .list-group-item,
.exercises-page .results-header-row,
.exercises-page .search-filter-card,
.exercises-page .tab-content,
.exercises-page .tab-content .panel,
.exercises-page .edit-exercise-panel .panel-header {
  border-color: var(--ex-border);
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

>>>>>>> origin/0.84-Mobile:VueJSApps/FlexFit/frontend/src/views/Member/exercises.vue
/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   RESPONSIVE â€“ 991px
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
@media (max-width: 991px) {
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
    padding: 16px;
    gap: 16px;
    min-height: 150px;
  }
  .exercise-img {
    width: 120px;
    height: 120px;
    flex-shrink: 0;
    margin: 0;
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
}

/* ─────────────────────────────────────────────────────
   RESPONSIVE - 768px (Tablet / large phone)
───────────────────────────────────────────────────── */
@media (max-width: 768px) {
  /* - Hero banner - */
  :deep(.builder-hero),
  .builder-hero {
    padding: 16px !important;
    min-height: auto !important;
    border-radius: 16px !important;
    margin-bottom: 12px !important;
  }
  :deep(.builder-hero) h2,
  :deep(.builder-hero__content) h2 {
    font-size: 1.4rem !important;
    font-weight: 700 !important;
    line-height: 1.2 !important;
    margin: 0 !important;
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

  /* - Tab bar: scrollable, compact - */
  .ex-tab-bar {
    overflow-x: auto;
    flex-wrap: nowrap;
    scrollbar-width: none;
    border-radius: 10px 10px 0 0;
    -webkit-overflow-scrolling: touch;
    padding: 0 2px;
    gap: 1px;
  }
  .ex-tab-bar::-webkit-scrollbar { display: none; }
  .ex-tab {
    flex: 0 0 auto;
    min-width: 100px;
    max-width: 120px;
    height: 40px;
    padding: 0 10px;
    font-size: 0.85rem;
  }
  .tab-label-full  { display: none; }
  .tab-label-short { display: inline; }

  /* - Accordion toggle visible on mobile - */
  .filter-accordion-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    background: #f8fafc;
    border: none;
    border-bottom: 1px solid #e2e8f0;
    padding: 12px 14px;
    font-size: 0.92rem;
    font-weight: 700;
    color: #334155;
    cursor: pointer;
    border-radius: 12px 12px 0 0;
  }
  .filter-accordion-toggle i { font-size: 0.85rem; color: #64748b; }

  /* - Filter grid: 1-col on mobile - */
  .search-filter-grid {
    grid-template-columns: 1fr;
    gap: 8px 0;
  }

  /* - Action buttons: stacked, full-width - */
  .search-filter-actions {
    flex-direction: column;
    gap: 8px;
    margin-top: 10px;
  }
  .search-filter-actions .btn {
    width: 100% !important;
    min-height: 48px !important;
    font-size: 0.95rem;
  }

  .search-filter-body {
    padding: 10px 12px 10px;
  }

  /* - Compact results header - */
  .results-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 8px;
    padding-bottom: 8px;
    margin-top: 0;
    margin-bottom: 10px;
    border-top: 1px solid #e7edf5;
  }
  .results-title {
    font-size: 0.9rem;
    font-weight: 700;
    color: #334155;
  }
  .results-count {
    font-size: 0.82rem;
    color: #64748b;
    font-weight: 600;
  }

  /* - Exercise list gap - */
  .exercise-list {
    gap: 10px;
  }

  /* - Compact exercise card - */
  .exercise-row {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    padding: 12px;
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
</style>

