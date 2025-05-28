<script setup>
import { ref, reactive, computed, onMounted, watch } from "vue";
import DateRangePicker from "@/components/template/DateRangePicker.vue";

const allExercises = ref([]);
const selectedExercise = ref(null);
const workoutType = ref("Strength");

const exercise = reactive({
  sets: "",
  reps: "",
  weight: "",
  duration: "",
  ImageGallery: "[]", // fallback
});

const workoutList = ref([]);

// Fetch exercises
onMounted(async () => {
  const res = await fetch("http://localhost:5000/api/exercises");
  allExercises.value = await res.json();



  
});

// When user selects an exercise, update exercise.ImageGallery
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

const addExercise = () => {
  workoutList.value.push({
    name: selectedExercise.value,
    sets: exercise.sets,
    reps: exercise.reps,
    weight: exercise.weight,
    duration: exercise.duration,
  });

  exercise.sets = "";
  exercise.reps = "";
  exercise.weight = "";
  exercise.duration = "";
};

const estimatedCalories = computed(() => {
  if (workoutType.value === "Cardio") {
    return exercise.duration ? exercise.duration * 10 : 0;
  } else {
    return exercise.sets && exercise.reps
      ? exercise.sets * exercise.reps * 0.5
      : 0;
  }
});
</script>



<template>
  <div class="container mt-8">
    <div v-if="galleryImages.length" class="row g-2 text-center">
      <div class="col-md-6" v-if="galleryImages[0]">
        <img :src="`/assets/Excerises/${galleryImages[0]}`"
             @error="e => e.target.src = '/assets/fallback.jpg'"
             class="img-fluid rounded border" />
        <p class="small mt-2 text-muted">/assets/Excerises/{{ galleryImages[0] }}</p>
      </div>
      <div class="col-md-6" v-if="galleryImages[1]">
        <img :src="`/assets/Excerises/${galleryImages[1]}`"
             @error="e => e.target.src = '/assets/fallback.jpg'"
             class="img-fluid rounded border" />
        <p class="small mt-2 text-muted">/assets/Excerises/{{ galleryImages[1] }}</p>
      </div>
    </div>
  </div>
</template>
