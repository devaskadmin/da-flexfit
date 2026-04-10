<script setup>
   //Import libaries
   import { ref, reactive, computed, onMounted, watch, nextTick } from "vue";
   import DateDropDown from "@/components/DropDownDate.vue"; // not template folder
  import { API_BASE } from '@/config/env';
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
   const existingLogs = ref([]);
  const exercisesLoadError = ref("");
   
   
   
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
     ImageGallery: '[]'
   });
   
   // ---- FILTER EXERCISES ----
   const filteredExercises = computed(() => {
  let list = allExercises.value;

  if (workoutType.value !== "All") {
    list = list.filter(ex => ex.WorkoutType?.toLowerCase() === workoutType.value.toLowerCase());
  }

  if (selectedMuscleGroup.value !== "All") {
    list = list.filter(ex => ex.MuscleGroup === selectedMuscleGroup.value);
  }

  if (selectedEquipment.value !== "All") {
    list = list.filter(ex => ex.Equipment === selectedEquipment.value);
  }


  if (searchExercise.value) {
    const term = searchExercise.value.toLowerCase();
    list = list.filter(ex => {
      const title = ex.ExerciseTitle ? ex.ExerciseTitle.toLowerCase() : '';
      const muscle = ex.MuscleGroup ? ex.MuscleGroup.toLowerCase() : '';
      const equip = ex.Equipment ? ex.Equipment.toLowerCase() : '';
      // Partial match anywhere in the string (not just start)
      return (
        title.includes(term) ||
        muscle.includes(term) ||
        equip.includes(term)
      );
    });
  }

  return list;
});

   
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
      method: 'DELETE'
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
        body: JSON.stringify(payload)
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
    alert('✅ All workout logs saved!');
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
      image: log.ImageGallery ? `/assets/Excerises/${JSON.parse(log.ImageGallery)[0]}` : '/assets/Excerises/default/default.jpg'
    }));

  } catch (err) {
    console.error("❌ Failed to load workout logs:", err);
  }
};



// Load Workout logs and map to correct structure for log table
const loadWorkoutLogs = async () => {
  if (!userId.value || !selectedDate.value) return;
  const formattedDate = toMySQLDate(selectedDate.value);

  try {
    const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/workout-log/get-workout-log?userId=${userId.value}&date=${formattedDate}`);
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
          image: log.ImageGallery ? `/assets/Excerises/${JSON.parse(log.ImageGallery)[0]}` : '/assets/Excerises/default/default.jpg',
          WorkoutLogID: log.WorkoutLogID // for remove/edit
        }))
      : [];
  } catch (err) {
    console.error("❌ Failed to fetch workout logs:", err);
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
    const res = await fetch(`${API_BASE}/api/get-exercises`, {
      credentials: 'include'
    });

    if (!res.ok) {
      throw new Error(`Failed to load exercises (${res.status})`);
    }

    const data = await res.json();
    allExercises.value = Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('❌ Failed to load exercises:', err);
    allExercises.value = [];
    exercisesLoadError.value = 'Could not load exercises right now.';
  }
};

//Async function to pass data from front end to backend
onMounted(async () => {
  //Get All exercises
  await loadExercisesLibrary();

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

// Helper: Switch to log-exercise if there are logs, else to search-exercises
function autoSwitchTabToLogOrLibrary() {
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
   
   
   const getFirstImage = (gallery) => {
  try {
    const images = typeof gallery === 'string' ? JSON.parse(gallery) : gallery;
    return images?.length > 0
      ? `/assets/Excerises/${images[0]}`
      : '/assets/Excerises/default/default.jpg';
  } catch {
    return '/assets/Excerises/default/default.jpg';
  }
};

   
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
   
   const scrollToLogWorkout = () => {
     const logWorkoutEl = document.getElementById('log-workout-form');
     if (logWorkoutEl) {
       logWorkoutEl.scrollIntoView({ behavior: 'smooth' });
     }
   };
   
   
//Selected excerise Image handeling
const selectedImage = computed(() => {
  if (!selectedExercise.value) {
    return '/assets/Excerises/default/default.jpg';
  }

  const match = allExercises.value.find(ex => ex.ExerciseTitle === selectedExercise.value);
  if (!match || !match.ImageGallery) {
    return '/assets/Excerises/default/default.jpg';
  }

  try {
    const gallery = JSON.parse(match.ImageGallery);
    return gallery.length > 0
      ? `/assets/Excerises/${gallery[0]}` // ✅ Remove folder prefixing
      : '/assets/Excerises/default/default.jpg';
  } catch {
    return '/assets/Excerises/default/default.jpg';
  }
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
     Object.assign(editExercise, exercise);
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
     try {
       const formData = new FormData();
       for (const [key, value] of Object.entries(editExercise)) {
         formData.append(key, value || '');
       }
       // Existing images to keep
       formData.append('existingImages', JSON.stringify(existingImages.value));
       // Images to delete
       formData.append('imagesToDelete', JSON.stringify(imagesToDelete.value));
       // New uploads
       selectedImages.value.forEach((img) => formData.append('images', img));
       if (existingImages.value.length + selectedImages.value.length > 2) {
         alert('You can only have up to 2 images.');
         return;
       }
       const isUpdate = !!editExercise.ExerciseID;
       const url = isUpdate
         ? import.meta.env.VITE_API_BASE + `/api/get-exercise/${editExercise.ExerciseID}`
         : import.meta.env.VITE_API_BASE + '/api/save-exercises';
       const method = isUpdate ? 'PUT' : 'POST';
       const response = await fetch(url, {
         method,
         body: formData
       });
       const result = await response.json();
       if (!response.ok) throw new Error(result.error || (isUpdate ? 'Update failed' : 'Insert failed'));
       // Refresh exercise list
      const res = await fetch(`${API_BASE}/api/get-exercises`);
       allExercises.value = await res.json();
       alert(isUpdate ? '✅ Exercise updated successfully!' : '✅ Exercise added successfully!');
       showEditForm.value = false;
       selectedImages.value = [];
       imagePreviews.value = [];
       existingImages.value = [];
       imagesToDelete.value = [];
     } catch (err) {
       console.error('❌ Error updating/inserting exercise:', err);
       alert('Failed to update/add exercise.');
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
      body: JSON.stringify(payload)
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
  ImageGallery: '[]'
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
      body: formData
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to add exercise');
    // Refresh the list
    const fetchRes = await fetch(import.meta.env.VITE_API_BASE + '/api/get-exercises');
    allExercises.value = await fetchRes.json();
    alert('✅ New exercise added!');
    showAddForm.value = false;
    // Reset form and images
    Object.assign(newExercise, {
      ExerciseTitle: '',
      WorkoutType: 'Strength',
      RecordingType: 'Sets & Reps',
      Equipment: '',
      MuscleGroup: '',
      Instructions: '',
      ImageGallery: '[]'
    });
    selectedImages.value = [];
    imagePreviews.value = [];
    existingImages.value = [];
    imagesToDelete.value = [];
  } catch (err) {
    console.error('❌ Add failed:', err);
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
  if (!confirm('Are you sure you want to delete this exercise? This cannot be undone.')) return;
  try {
    const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/delete-exercise/${exercise.ExerciseID}`,
      { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete exercise');
    // Refresh exercise list
    const fetchRes = await fetch(`${API_BASE}/api/get-exercises`);
    allExercises.value = await fetchRes.json();
    alert('✅ Exercise deleted!');
    showEditForm.value = false;
  } catch (err) {
    alert('Failed to delete exercise.');
  }
};

// add this function near other handlers (e.g. after AddWorkout or near pagination handlers)
const clearFilters = () => {
  workoutType.value = 'All';
  selectedMuscleGroup.value = 'All';
  selectedEquipment.value = 'All';
  searchExercise.value = '';
  currentPage.value = 1;
  // reset any derived pagination/display state if you need:
  displayLimit.value = 3;
};


</script>

<template>

  <div class="dashboard-breadcrumb ff-page-header mb-25">
      <h2>Log Workout</h2>
    <div class="dashboard-filter">
      <DateDropDown v-model="selectedDateRaw" compact />
    </div>
   </div>


   <!--DEBUG PAGE CONTAINER -->
   <div class="container mt-8 container-block">

      <div class="panel">
         <!--Start of panel-->
         <div class="panel-header">
            <!-- Panel Header-->
              <h4>Excerise</h4>
          </div>
   
     
          <div class="row">
            <div class="col-xs-12 ">

              <nav class="ex-tab-bar" role="tablist" aria-label="Log workout sections">
                <button
                  type="button"
                  class="ex-tab"
                  :class="{ 'ex-tab--active': activeTab === 'search-exercises' }"
                  :aria-selected="activeTab === 'search-exercises'"
                  role="tab"
                  @click="activeTab = 'search-exercises'"
                >
                  <i class="fa-solid fa-magnifying-glass me-2"></i><span>Search Exercise Library</span>
                </button>
                <button
                  type="button"
                  class="ex-tab"
                  :class="{ 'ex-tab--active': activeTab === 'log-exercise' }"
                  :aria-selected="activeTab === 'log-exercise'"
                  role="tab"
                  @click="activeTab = 'log-exercise'"
                >
                  <i class="fa-solid fa-dumbbell me-2"></i><span>Log Exercise</span>
                </button>
              </nav>

             <div class="tab-content px-0" id="nav-tabContent">


            <!-- Search Exercise Section -->
            <div v-if="activeTab === 'search-exercises'">
                <!--Search Excerises CONTAINER -->
            <div class="container container-block">
                <div class="panel search-filter-card">
                  <!--Start of panel-->
                  <div class="panel-header search-filter-head">
                    <h4><i class="fa-solid fa-magnifying-glass me-2"></i>Search Exercise Library</h4>
                  </div>
                  <!--end of panel header-->
                  <div class="panel-body search-filter-body">
                      <div v-if="exercisesLoadError" class="alert alert-warning">
                        {{ exercisesLoadError }}
                      </div>
                      <div class="search-filter-grid">
                        <div class="search-filter-field full-width">
                          <label class="form-label">Search</label>
                          <input v-model="searchExercise" type="text" class="form-control" placeholder="Search exercise by name" />
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
                          {{ showAddForm ? 'Cancel' : '➕ Add New Exercise' }}
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
                        <div v-if="showEditForm" id="editExerciseForm" class="panel mt-4">
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
                                        <img :src="`/assets/Excerises/${img}`" style="max-width: 200px; border: 1px solid #ccc; border-radius: 12px;" />
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
                              <div class="col-12 mt-3 d-flex align-items-center" style="gap: 8px;">
                                  <div>
                                    <button class="btn btn-success" @click="saveEditedExercise">Save Changes</button>
                                    <button class="btn btn-outline-secondary ms-2" @click="showEditForm = false">Cancel</button>
                                  </div>
                                  <div class="ms-auto">
                                    <button class="btn btn-danger" @click="deleteExercise(editExercise)" style="background-color: #e53935; color: #fff; min-width: 140px;">Delete Exercise</button>
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
      <img :src="`/assets/Excerises/${img}`" style="max-width: 200px; border: 1px solid #ccc; border-radius: 12px;" />
      <span @click="removeExistingImage(img)" style="position:absolute;top:0;right:0;color:red;cursor:pointer;font-size:3em;">&times;</span>
      <div class="small text-center">{{ img.split('/').pop() }}</div>
    </div>
  </div>
</div>










    <div class="col-md-12">
      <label class="form-label">Instructions</label>
      <textarea v-model="newExercise.Instructions" class="form-control instructions" rows="3" />
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
                          <div>
                            <h5>Exercise Results</h5>
                            <p>Showing {{ filteredExercises.length }} exercises</p>
                          </div>
                        </div>

                        <div class="exercise-list">
                            <div class="exercise-row" v-for="ex in pagedExercises" :key="ex.ExerciseID">
                              <div class="exercise-img">
                                  <img
                                    :src="getFirstImage(ex.ImageGallery)"
                                    @click="selectExerciseFromList(ex)"
                                    class="clickable"
                                  />
                              </div>

                              <div class="exercise-info">
                                  <h5 class="exercise-title">{{ ex.ExerciseTitle }}</h5>

                                  <div class="exercise-meta">
                                    <p><span>Workout Type:</span> {{ ex.WorkoutType }}</p>
                                    <p><span>Muscle Group:</span> {{ ex.MuscleGroup }}</p>
                                    <p><span>Equipment:</span> {{ ex.Equipment }}</p>
                                  </div>

                                  <div class="exercise-actions">
                                    <button class="btn btn-sm btn-outline-primary" @click="selectExerciseFromList(ex)">
                                      Select Exercise
                                    </button>
                                    <button class="btn btn-sm btn-outline-secondary" @click="startEditing(ex)">
                                      Edit Exercise
                                    </button>
                                  </div>
                              </div>
                            </div>

                            <div class="text-center mt-3">
                              <button class="btn btn-outline-secondary me-2" @click="prevPage" :disabled="currentPage === 1">Prev</button>
                              <button class="btn btn-outline-dark" @click="nextPage"
                                  :disabled="currentPage * itemsPerPage >= filteredExercises.length">Next</button>
                            </div>
                            <p class="text-center small mt-2 mb-1">
                              Showing {{ (currentPage - 1) * itemsPerPage + 1 }} to
                              {{
                              Math.min(currentPage * itemsPerPage, filteredExercises.length)
                              }} of {{ filteredExercises.length }} exercises
                            </p>
                        </div>
                      </div>
                      <!--LIST VIEW-->



                   

        
                  <!--end of WorkoutList-->
                  <!--End of panel body-->
                

              
          </div>
          <!--End of Log Excerise container-->






                
            </div>
            <!--End of SEARCH excerises-->

          <!--Excerise Libary-->


          <!--End of Excerise Libary-->







            </div>
            <!-- End of Search Exercise Section -->


  <!-- Log Exercise Section -->
  <div v-if="activeTab === 'log-exercise'">


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
      :src="log.image || getFirstImage(log.ImageGallery)"
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
    <button @click="removeLog(log, idx)" class="btn btn-sm btn-danger log-action-btn"><span class="log-action-icon" style="display:inline-block; line-height:1;">🗑️</span></button>
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
</div>
</div>
</div></div>








  </div><!-- End of Exercise Section -->
</template>
<style scoped>
   .dashboard-breadcrumb {
   margin-bottom: 20px;
   }
  .header-meta {
  color: #ffffff;
  font-weight: 600;
  margin-right: 10px;
  }
   .panel {
   border: 1px solid #ddd;
   border-radius: 5px;
   padding: 15px;
   }
   .exercise-card {
   min-height: 120px;
   background-color: #fff;
   border-radius: 4px;
   }
   .image-box {
   flex-shrink: 0;
   }
  .exercise-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  }
  .exercise-row {
  display: grid;
  grid-template-columns: 168px minmax(0, 1fr);
  gap: 14px;
  border: 1px solid #d8dde6;
  background: #ffffff;
  padding: 10px;
  border-radius: 16px;
  align-items: start;
  }
  .exercise-img img {
  width: 100%;
  height: 168px;
  object-fit: cover;
  border-radius: 12px;
  }
  .exercise-img {
  width: 100%;
  }
  .exercise-info {
  min-width: 0;
  display: grid;
  gap: 8px;
  }
  .exercise-title {
  font-weight: 700;
  font-size: 1.06rem;
  color: #1f2937;
  margin: 0;
  padding: 0;
  border: 0;
  }
  .exercise-meta {
  display: grid;
  gap: 4px;
  }
  .exercise-meta p {
  margin: 0;
  color: #4b5563;
  font-size: 0.94rem;
  line-height: 1.45;
  }
  .exercise-meta p span {
  color: #334155;
  font-weight: 600;
  margin-right: 4px;
  }
  .exercise-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 2px;
  }
   .instructions{
   min-height: 250px;
   }
  .container-block{
   margin-top:0;
  }
  .container.container-block {
   max-width: 100% !important;
   width: 100% !important;
   padding-left: 0 !important;
   padding-right: 0 !important;
  }
   .workout-log-img{
    height: 200px;
    width:350px;
   }
   .sel-ex-input{
    min-width: 100px;
    padding-bottom: 10px;    
   }
   textarea {
  resize: vertical;
}
.btn{
  margin:2px
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






















.ex-tab-bar {
  display: flex;
  align-items: stretch;
  background: #1e2736;
  border-radius: 12px 12px 0 0;
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

.ex-tab:hover {
  color: rgba(255, 255, 255, 0.88);
}

.ex-tab--active {
  color: #ffffff;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.02);
}

.ex-tab--active::after {
  transform: scaleX(1);
}

.ex-tab i {
  color: inherit;
}

.ex-tab span {
  color: inherit;
}

.search-filter-card {
  border-radius: 12px;
  border: 1px solid #d9dee7;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  padding: 0;
}

.search-filter-head {
  padding: 14px 16px 8px;
  border-bottom: 1px solid #eceff4;
}

.search-filter-head h4 {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 700;
  color: #2d3748;
}

.search-filter-body {
  padding: 14px 16px 12px;
}

.search-filter-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px 14px;
  align-items: end;
}

.search-filter-field.full-width {
  grid-column: 1 / -1;
}

.search-filter-field .form-label {
  margin-bottom: 6px;
  font-size: 0.82rem;
  font-weight: 600;
  color: #5b6472;
}

.search-filter-field .form-control,
.search-filter-field .form-select {
  min-height: 40px;
}

.search-filter-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-top: 12px;
  flex-wrap: wrap;
}

.search-filter-divider {
  margin-top: 12px;
  border-top: 1px solid #e7ebf1;
}

.results-header-row {
  border-top: 1px solid #e7ebf1;
  padding-top: 12px;
  margin-bottom: 4px;
}

.results-header-row h5 {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: #334155;
}

.results-header-row p {
  margin: 2px 0 0;
  font-size: 0.84rem;
  color: #64748b;
}

.tab-content {
  background: #fdfdfd;
  border: 1px solid #ddd;
  border-top: none;
  border-radius: 0 0 12px 12px;
  margin-top: 0;
  padding: 0;
  line-height: 1.6;
}

.tab-content > div {
  margin-top: 0;
}

.tab-content .container.container-block {
  margin-top: 0 !important;
}

.tab-content .panel {
  margin-top: 0;
  border-top: 0;
  border-radius: 0 0 5px 5px;
}

.exercise-results-panel {
  padding-top: 6px;
}

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

  .exercise-row {
    grid-template-columns: 1fr;
    padding: 12px;
    gap: 12px;
  }

  .exercise-img {
    max-width: 100%;
  }

  .exercise-img img {
    width: 100%;
    height: auto;
    max-height: 220px;
    border-radius: 12px;
  }

  .exercise-actions {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .exercise-actions .btn {
    width: 100%;
    min-height: 36px;
  }
}
.list-group-item.d-flex.align-items-center > .flex-grow-1 > div.row > .col {
  padding: 2px 6px !important;
  margin: 0 !important;
}

/* Add more left padding to the info (middle) column in the workout log */
/* Add more left padding to the info (middle) column in the workout log */
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
.panel-body {
  margin-bottom: 0;
}
.list-group-item.d-flex.align-items-center {
  padding-top: 6px !important;
  padding-bottom: 6px !important;
  margin-bottom: 2px !important;
}
/* 10% bigger icons and buttons for log actions */
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
</style>