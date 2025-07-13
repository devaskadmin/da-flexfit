<script setup>
import { ref } from "vue";
import { searchFoodFatSecret } from "@/api/nutrition";

const foodSearchQuery = ref("");
const foodSearchResults = ref([]);
const foodSearchLoading = ref(false);
const foodSearchError = ref("");
const foodSearchPerformed = ref(false);

const searchFood = async () => {
  foodSearchError.value = "";
  foodSearchLoading.value = true;
  foodSearchPerformed.value = false;
  foodSearchResults.value = [];
  try {
    // Call backend utility (which handles all FatSecret API logic server-side)
    const data = await searchFoodFatSecret(foodSearchQuery.value);
    if (data && data.foods && Array.isArray(data.foods.food)) {
      foodSearchResults.value = data.foods.food;
    } else {
      foodSearchResults.value = [];
    }
    foodSearchPerformed.value = true;
  } catch (err) {
    foodSearchError.value = err.message || "Error searching food.";
    foodSearchResults.value = [];
    foodSearchPerformed.value = true;
  } finally {
    foodSearchLoading.value = false;
  }
};
</script>

<template>
  <div class="container mt-8">
    <div class="panel">
      <div class="panel-header">
        <h4>Nutrition Search</h4>
      </div>
      <div class="panel-body">
        <div class="row">
          <div class="col-md-12">
            <label class="form-label">Search Food</label>
            <div class="input-group mb-3">
              <input v-model="foodSearchQuery" type="text" class="form-control" placeholder="Search for food (e.g. chicken, apple, rice)" @keyup.enter="searchFood" />
              <button class="btn btn-primary" @click="searchFood" :disabled="foodSearchLoading">Search</button>
            </div>
            <div v-if="foodSearchLoading" class="text-center my-2">
              <span>Loading...</span>
            </div>
            <div v-if="foodSearchError" class="alert alert-danger">{{ foodSearchError }}</div>
            <div v-if="foodSearchResults.length > 0">
              <h5>Results</h5>
              <ul class="list-group">
                <li v-for="food in foodSearchResults" :key="food.food_id" class="list-group-item d-flex justify-content-between align-items-center">
                  <div>
                    <strong>{{ food.food_name }}</strong>
                    <div class="small text-muted">{{ food.food_description }}</div>
                  </div>
                </li>
              </ul>
            </div>
            <div v-if="foodSearchResults.length === 0 && foodSearchPerformed && !foodSearchLoading" class="text-muted">No results found.</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel {
  border: 1px solid #ddd;
  border-radius: 5px;
  padding: 15px;
}
</style>
