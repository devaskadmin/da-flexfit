<script setup>
   //Import libaries
   import { ref, reactive, computed, onMounted, watch } from "vue";
   import DateDropDown from "@/components/DropDownDate.vue"; // not template folder
   import '@fortawesome/fontawesome-free/css/all.min.css';
   
   // ---- VARIABLES ----
   const allExercises = ref([]);
   const selectedExercise = ref(null);
   const workoutType = ref("Strength");
   const selectedMuscleGroup = ref("All");
   const selectedEquipment = ref("All");
   const searchExercise = ref("");
   const workoutList = ref([]);
   
   const exercise = reactive({
     sets: "",
     reps: "",
     weight: "",
     duration: "",
     ImageGallery: "[]", // fallback
   });
   
   // ---- FILTER EXERCISES ----
   const filteredExercises = computed(() => {
     let list = allExercises.value;
     if (selectedMuscleGroup.value !== "All") {
       list = list.filter(ex => ex.MuscleGroup === selectedMuscleGroup.value);
     }
     if (selectedEquipment.value !== "All") {
       list = list.filter(ex => ex.Equipment === selectedEquipment.value);
     }
     if (searchExercise.value) {
       const term = searchExercise.value.toLowerCase();
       list = list.filter(ex => ex.ExerciseTitle.toLowerCase().includes(term));
     }
     return list;
   });
   
   // ---- GET MUSCLE GROUPS + EQUIPMENT ----
   const muscleGroups = computed(() => {
     const groups = new Set(allExercises.value.map(ex => ex.MuscleGroup));
     return ["All", ...groups];
   });
   const equipmentList = computed(() => {
     const groups = new Set(allExercises.value.map(ex => ex.Equipment));
     return ["All", ...groups];
   });
   // ---- GET MUSCLE GROUPS + EQUIPMENT ----
   
   // ---- IMAGE GALLERY FOR EXCERCISE ---
   watch(selectedExercise, (title) => {
     const match = allExercises.value.find((ex) => ex.ExerciseTitle === title);
     if (match) {
       exercise.ImageGallery = match.ImageGallery || "[]";
     } else {
       exercise.ImageGallery = "[]";
     }
   });
   
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


    if (workoutType.value === "Strength") {
    if (!exercise.sets || !exercise.reps || !exercise.weight || !selectedExercise.value) {
      addError.value = "Please select an excerise below, fill in Sets, Reps, and Weight for strength exercises.";
      return;
    }
  }
  const duration = exercise.duration || (exercise.hours === 0 && exercise.minutes === 0 ? 1 : (exercise.hours || 0) * 60 + (exercise.minutes || 0));

  workoutList.value.push({
    name: selectedExercise.value,
    sets: exercise.sets,
    reps: exercise.reps,
    weight: exercise.weight,
    duration: duration,
    date: selectedDate.value,
    image: selectedImage.value,
    calories: duration * 10,  // simple calc
    distance: 2.0,            // placeholder
    speed: 6.5,               // placeholder
    type: workoutType.value
  });

  //exercise.sets = "";
  //exercise.reps = "";
  //exercise.weight = "";
  //exercise.duration = "";
};


//REMOVE excerise
const removeWorkout = (index) => {
  workoutList.value.splice(index, 1);
};
//Remove Excerise


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
   
   
   
   
   //Saved 
   const saveWorkout = async () => {
     if (!selectedDate.value) {
       alert("Please select a workout date.");
       return;
     }
   
     for (const workout of workoutList.value) {
       try {
         const res = await fetch(import.meta.env.VITE_API_BASE + '/api/workout-log', {
           method: 'POST',
           credentials: 'include',
           headers: {
             'Content-Type': 'application/json'
           },
           body: JSON.stringify({
             ExerciseTitle: workout.name,
             ExerciseType: workoutType.value,
             Reps: workout.reps,
             Sets: workout.sets,
             Weight: workout.weight,
             Duration: workout.duration,
             WorkoutDate: selectedDate.value
           })
         });
   
         const data = await res.json();
         if (!res.ok) throw new Error(data.error || "Unknown error");
   
         console.log("✅ Workout saved:", workout.name);
       } catch (err) {
         console.error("❌ Failed to save workout:", err);
       }
     }
   
     alert("✅ All workouts saved!");
     workoutList.value = []; // Clear after save
   };
   //------------------
   
   
   
   
   
   
   
   
   
   //USER ID
   const userId = ref(null);
   
   //Async function to pass data from front end to backend
   onMounted(async () => {
   
     //Fetch exercises
     const res = await fetch("http://localhost:5000/api/get-exercises");
     allExercises.value = await res.json();
   
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
     //USER ID
   });
   
   
   //DATE FUNCTION--
   // Use Date object for selected date
   // Use Date object for selected date
   const selectedDateRaw = ref(new Date());
   
   // Computed: Format the date as d/m/yyyy (e.g., 6/5/2025)   
   const selectedDate = computed(() => {
     const d = selectedDateRaw.value;
     console.log("Selected raw date:", d.getMonth()); // logs the actual Date object
     return `${d.getDate()+1}/${d.getDate()}/${d.getFullYear()}`;
   });
   
   
   
   
   // Pagination List view
   const displayLimit = ref(2); // default number to show
   const displayedExercises = computed(() => filteredExercises.value.slice(0, displayLimit.value));
   
   const itemsPerPage = ref(2); // user-defined number
   const currentPage = ref(1); // start from 1
   
   
   const getFirstImage = (gallery) => {
     try {
       const images = JSON.parse(gallery);
       return images.length > 0 ? images[0] : 'fallback.jpg';
     } catch {
       return 'fallback.jpg';
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
     scrollToLogWorkout();
   };
   
   const scrollToLogWorkout = () => {
     const logWorkoutEl = document.getElementById('log-workout-form');
     if (logWorkoutEl) {
       logWorkoutEl.scrollIntoView({ behavior: 'smooth' });
     }
   };
   
   

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
   
   
   //End of Selected Excerise
   
   
   //Edit Excerise
   const editingExercise = ref(null); // holds the selected exercise to edit
   const showEditForm = ref(false); // controls form visibility
   
   const workoutTypeOptions = ["Strength", "Cardio"];
   const recordingTypeOptions = ["Sets & Reps", "Time", "Distance", "Custom"];
   
   
   const editExercise = (exercise) => {
     editingExercise.value = { ...exercise }; // Clone the selected exercise
   };
   
   const startEditing = (exercise) => {
     editingExercise.value = { ...exercise }; // shallow copy to edit safely
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
       const response = await fetch(import.meta.env.VITE_API_BASE + `/api/get-exercise/${editingExercise.value.ExerciseID}`, {
         method: "PUT",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify(editingExercise.value)
       });
   
       const result = await response.json();
       if (!response.ok) throw new Error(result.error || "Update failed");
   
       // Refresh exercise list
       const res = await fetch("http://localhost:5000/api/get-exercises");
       allExercises.value = await res.json();
   
       alert("✅ Exercise updated successfully!");
       showEditForm.value = false;
     } catch (err) {
       console.error("❌ Error updating exercise:", err);
       alert("Failed to update exercise.");
     }
   };   
   
   //End of Edit Excerise
   
</script>
<template>
   <div class="dashboard-breadcrumb mb-25">
      <h2>Log Workout</h2>
      SelectDate:
      <DateDropDown v-model="selectedDate" />
   </div>

  <!--PAGE CONTAINER -->
  <div class="container mt-8 container-block">
      <div class="panel">
         <!--Start of panel-->
         <div class="panel-header">
            <!-- Panel Header-->
            
              <h4>Search Exercises</h4>
            <!--End of container-->
         </div>
         <!--end of panel header-->
         <div class="panel-body">
            <!--Start of panel body-->
            <!--Start of Row-->
            <div class="row g-2">
               <!-- Search Exercise -->
               <div class="col-md-12">
                  
                  <input v-model="searchExercise" type="text" class="form-control" placeholder="Search exercise by name" />
               </div>
               <!--End of Select Excerise-->
               <!--Start of filter ROW-->
               <div class="row g-3">
                  <h4>Filter</h4>
               </div>
               <!--End of Filter row-->
               <!--Start of row-->
               <div class="col-md-4">
                  <!-- Workout Type -->
                  <label class="form-label">Workout Type</label>
                  <select v-model="workoutType" class="form-select">
                     <option value="Strength">Strength</option>
                     <option value="Cardio">Cardio</option>
                  </select>
                  <!-- Workout type-->
               </div>
               <!-- Muscle Group Filter -->
               <div class="col-md-4">
                  <label class="form-label">Muscle Group</label>
                  <select v-model="selectedMuscleGroup" class="form-select">
                     <option v-for="group in muscleGroups" :key="group" :value="group">
                        {{ group }}
                     </option>
                  </select>
               </div>
               <!-- Muscle Group Filter -->
               <!-- Equipment Filter -->
               <div class="col-md-4">
                  <label class="form-label">Equipment</label>
                  <select v-model="selectedEquipment" class="form-select">
                     <option v-for="equip in equipmentList" :key="equip" :value="equip">
                        {{ equip }}
                     </option>
                  </select>
               </div>
               <!-- Equiment Filter-->
            </div>
            <!--End of Row-->
         </div>
      </div>
      <!--End of Panel-->
  </div>
  <!--End of SEARCH excerises-->

  <!--Workout Summary container -->
  <div class="container mt-8 container-block">
         <div class="panel">
            <!--Start of panel-->

            <div v-if="addError" class="alert alert-danger mt-2">
  {{ addError }}
</div>

            <div class="panel-header">
              <h4>Log Excerise</h4>
            </div>
            <!-- Strength / Cardio Inputs -->
            <div id="log-workout-form" class="row g-3 mt-3">
               
               <div class="col-md-4">
               <img
                  v-if="selectedImage !== 'fallback.jpg'"
                  :src="selectedImage"
                  alt="Selected Exercise"
                  class="img-fluid workout-log-img"
                  />
                </div>

              <div class="col-md-8">
               <h5><b>Selected Excerise Name: </b> {{ selectedExercise }}</h5>

               <!-- Sets -->
               <div class="d-flex" v-if="workoutType === 'Strength'">
                  <div class="sel-ex-input">
                  Sets:
                 </div> 

                 <div >
                  <input v-model.number="exercise.sets" type="number" class="form-control" min="1" />
                 </div>
               </div>

               
               <!-- Reps -->
               <div class="d-flex" v-if="workoutType === 'Strength'">
                  <div class="sel-ex-input">
                    Reps:
                  </div> 
 
                  <div>
                    <input v-model.number="exercise.reps" type="number" class="form-control" min="1" />
                  </div>
               </div>








               <!-- LBS -->
               <div class="d-flex" v-if="workoutType === 'Strength'">


                <div class="sel-ex-input">
                  Weight (lbs):
                  </div>

                  <div>
                  <input v-model.number="exercise.weight" type="number" class="form-control" min="1" />
                  </div>

               </div>















               <!-- Cardio duration -->
               <div class="d-flex">
                  <div class="sel-ex-input">Duration:</div>
                  <div class="input-group">
                     <input v-model.number="exercise.hours" type="number" class="form-control" min="0" placeholder="hrs" />
                     <span class="input-group-text">:</span>
                     <input v-model.number="exercise.minutes" type="number" class="form-control" min="0" max="59" placeholder="min" />
                  
                  
                    </div>
               </div>
               <!-- Add Exercise Button -->
               <div class="d-flex">                   
                  <button @click="addExercise" class="btn btn-primary">Log Exercise</button>
               </div>
            </div>
            </div><!--End of rightColumn-->
            <!--End of row-->

            <!--edit Excerise-->
            <div class="row g-3 mt-3">
               <div v-if="showEditForm" id="editExerciseForm" class="panel mt-4">
                  <div class="panel-header">
                     <h4>Edit Exercise</h4>
                  </div>
                  <div class="panel-body row g-3">
                     <div class="col-md-12">
                        <label class="form-label">Exercise Name</label>
                        <input v-model="editingExercise.ExerciseTitle" class="form-control" />
                     </div>
                     <div class="col-md-6">
                        <label class="form-label">Workout Type</label>
                        <select v-model="editingExercise.WorkoutType" class="form-select">
                           <option v-for="type in workoutTypeOptions" :key="type" :value="type">{{ type }}</option>
                        </select>
                     </div>
                     <div class="col-md-6">
                        <label class="form-label">Recording Type</label>
                        <select v-model="editingExercise.RecordingType" class="form-select">
                           <option v-for="type in recordingTypeOptions" :key="type" :value="type">{{ type }}</option>
                        </select>
                     </div>
                     <div class="col-md-6">
                        <label class="form-label">Equipment</label>
                        <input v-model="editingExercise.Equipment" class="form-control" />
                     </div>
                     <div class="col-md-6">
                        <label class="form-label">Muscle Group</label>
                        <input v-model="editingExercise.MuscleGroup" class="form-control" />
                     </div>
                     <div class="col-md-12">
                        <label class="form-label">Instructions</label>
                        <textarea v-model="editingExercise.Instructions" class="form-control instructions" rows="=3" />
                     </div>
                     <!-- Cardio Fields 
                        <div class="col-md-12">
                          <hr><h4>Cardio</h4><hr>
                          
                        </div>
                        <div class="col-md-4">
                          <label class="form-label">Duration (min)</label>
                          <input type="number" v-model.number="editingExercise.Duration" class="form-control" />
                        </div>
                        <div class="col-md-4">
                          <label class="form-label">Calories</label>
                          <input type="number" v-model.number="editingExercise.Calories" class="form-control" />
                        </div>
                        <div class="col-md-3">
                          <label class="form-label">Distance (miles)</label>
                          <input type="number" v-model.number="editingExercise.Distance" class="form-control" />
                        </div>
                        <div class="col-md-3">
                          <label class="form-label">Speed (mph)</label>
                          <input type="number" v-model.number="editingExercise.Speed" class="form-control" />
                        </div>
                        <div class="col-md-3">
                          <label class="form-label">Laps/Reps</label>
                          <input type="number" v-model.number="editingExercise['Laps-Reps']" class="form-control" />
                        </div>
                        -->
                     <div class="col-12 mt-3">
                        <button class="btn btn-success" @click="saveEditedExercise">Save Changes</button>
                        <button class="btn btn-outline-secondary ms-2" @click="showEditForm = false">Cancel</button>
                     </div>
                  </div>
               </div>
            </div>
            <!-- Edit Excerise-->
<hr>Workout list:<hr>
            <!--LIST VIEW-->
            <div class="row g-3 mt-3">
               <div class="exercise-list">
                  <div class="exercise-row" v-for="ex in pagedExercises" :key="ex.ExerciseID">
                     <div class="exercise-img">
                        <img
                           :src="`/assets/Excerises/${getFirstImage(ex.ImageGallery)}`"
                           @click="selectExerciseFromList(ex)"
                           class="clickable"
                           />
                     </div>
                     <div class="exercise-info">
                        <h6 class="exercise-title">Excerise: {{ ex.ExerciseTitle }}</h6>
                        <p>ExceriseType: {{ ex.WorkoutType }}</p>
                        <p>MuscleGroup: {{ ex.MuscleGroup }}</p>
                        <p>Equiment: {{ ex.Equipment }}</p>
                        <button class="btn btn-sm btn-outline-primary mt-2" @click="selectExerciseFromList(ex)">
                        Select Exercise
                        </button>
                        <button class="btn btn-sm btn-outline-secondary mt-2" @click="startEditing(ex)">Edit Exercise</button>
                     </div>
                  </div>
                  <div class="text-center mt-3">
                     <button class="btn btn-outline-secondary me-2" @click="prevPage" :disabled="currentPage === 1">Prev</button>
                     <button class="btn btn-outline-dark" @click="nextPage"
                        :disabled="currentPage * itemsPerPage >= filteredExercises.length">Next</button>
                  </div>
                  <p class="text-center small mt-2">
                     Showing {{ (currentPage - 1) * itemsPerPage + 1 }} to
                     {{
                     Math.min(currentPage * itemsPerPage, filteredExercises.length)
                     }} of {{ filteredExercises.length }} exercises
                  </p>
               </div>
            </div>
            <!--LIST VIEW-->
         </div>
         <!--End of panel body-->
      

    
     
      <!-- Workout Summary -->
      <div class="panel-body workout-summary-list">
  <div
    class="list-group-item d-flex align-items-center"
    v-for="(workout, index) in workoutList"
    :key="index"
  >
    <!-- Remove Icon -->
    <i class="fas fa-times text-danger me-3 clickable" @click="removeWorkout(index)"></i>

    <!-- Workout Image -->
    <img :src="workout.image" class="summary-img me-3" />

 
    <!-- Workout Info -->
    <div class="flex-grow-1">
      <div><strong>{{ workout.name }}</strong> ({{ workout.type }})</div>

      <template v-if="workout.type === 'Strength'">
        <div>Sets: {{ workout.sets }} | Reps: {{ workout.reps }} | Weight: {{ workout.weight }} lbs | Duration: {{ workout.duration }} min</div>
      </template>

      <template v-else>
        <div>Duration: {{ workout.duration }} min | Calories: {{ workout.calories }} | Distance: {{ workout.distance }} mi | Speed: {{ workout.speed }} mph</div>
      </template>

      <div class="text-muted small">Date: {{ workout.date }}</div>
    </div>
  </div>
</div>

      <!--end of workout summary-->
  </div>
  <!--End of Page container Log Workout-->




   <!--DEBUG PAGE CONTAINER -->
   <div class="container mt-8 container-block">
      <div class="panel">
         <!--Start of panel-->
         <div class="panel-header">
            <!-- Panel Header-->
            
              <h4>Debug</h4>
           </div>
               <!--Displays User id-->
      <div v-if="userId && typeof userId === 'number'">
         Logged in as User ID: {{ userId }}
      </div>
      <div v-else-if="userId === 'Not logged in'">
         You must be logged in.
      </div>
      <div v-else-if="userId === 'Error'">
         Could not fetch user data.
      </div>
      <!--Displays user id-->
      <!--Display selected date-->
      <div class="mb-3">
         <label class="form-label">Workout Date: {{ selectedDate }}</label>
      </div>
      <!--- End select date-->













      
      <div class="container">
              <div class="row">
                <div class="col-xs-12 ">
                  <nav>
                    <div class="nav nav-tabs nav-fill" id="nav-tab" role="tablist">
                      <a class="nav-item nav-link active" id="nav-home-tab" data-toggle="tab" href="#nav-home" role="tab" aria-controls="nav-home" aria-selected="true">Home</a>
                      <a class="nav-item nav-link" id="nav-profile-tab" data-toggle="tab" href="#nav-profile" role="tab" aria-controls="nav-profile" aria-selected="false">Profile</a>
                      <a class="nav-item nav-link" id="nav-contact-tab" data-toggle="tab" href="#nav-contact" role="tab" aria-controls="nav-contact" aria-selected="false">Contact</a>
                      
                    </div>
                  </nav>
                  <div class="tab-content py-3 px-3 px-sm-0" id="nav-tabContent">
                    <div class="tab-pane fade show active" id="nav-home" role="tabpanel" aria-labelledby="nav-home-tab">
                       qui sit. Exercitation mollit sit culpa nisi culpa non adipisicing reprehenderit do dolore. Duis reprehenderit occaecat anim ullamco ad duis occaecat ex.
                    </div>
                    <div class="tab-pane fade" id="nav-profile" role="tabpanel" aria-labelledby="nav-profile-tab">
                      Et et consectetur ipsum labore excepteur est proident excepteur ad velit occaecat qui minim occaecat veniam. Fugiat veniam incididunt anim aliqua enim pariatur veniam sunt est aute sit dolor anim. Velit non irure adipisicing aliqua ullamco irure incididunt irure non esse consectetur nostrud minim non minim occaecat. Amet duis do nisi duis veniam non est eiusmod tempor incididunt tempor dolor ipsum in qui sit. Exercitation mollit sit culpa nisi culpa non adipisicing reprehenderit do dolore. Duis reprehenderit occaecat anim ullamco ad duis occaecat ex.
                    </div>
                    
                  </div>
                
                </div>
              </div>
        </div>









            <!--End of container-->
         
         
      </div>
      <!--End of Panel-->
  </div>
  <!--End of Page Container SEARCH excerises-->





</template>
<style scoped>
   .dashboard-breadcrumb {
   margin-bottom: 20px;
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
   gap: 20px;
   }
   .exercise-row {
   display: flex;
   border: 1px solid black;
   border-color: rgba(0, 0, 0, 0.2) ;
   padding: 10px;
   border-radius: 22px;;
   align-items: flex-start;
   }
   .exercise-img img {
   width: 200px;
   height: 200px;
   object-fit: fill;
   border-top-left-radius: 10%;
   border-bottom-left-radius: 10%;
   }
   .exercise-img {
   margin-right: 20px;
   }
   .exercise-info {
   flex-grow: 1;
   }
   .exercise-title {
   font-weight: bold;
   border-bottom: 1px solid black;
   padding: 4px 6px;
   margin-bottom: 5px;
   }
   .instructions{
   min-height: 250px;
   }
   .container-block{
    margin-top:10px;
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


.summary-img {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 8px;
}

.clickable {
  cursor: pointer;
}





















nav > .nav.nav-tabs{

border: none;
  color:#fff;
  background:#272e38;
  border-radius:0;

}
nav > div a.nav-item.nav-link,
nav > div a.nav-item.nav-link.active
{
border: none;
  padding: 18px 25px;
  color:#fff;
  background:#272e38;
  border-radius:0;
}

nav > div a.nav-item.nav-link.active:after
{
content: "";
position: relative;
bottom: -60px;
left: -10%;
border: 15px solid transparent;
border-top-color: #e74c3c ;
}
.tab-content{
background: #fdfdfd;
  line-height: 25px;
  border: 1px solid #ddd;
  border-top:5px solid #e74c3c;
  border-bottom:5px solid #e74c3c;
  padding:30px 25px;
}

nav > div a.nav-item.nav-link:hover,
nav > div a.nav-item.nav-link:focus
{
border: none;
  background: #e74c3c;
  color:#fff;
  border-radius:0;
  transition:background 0.20s linear;
}
</style>