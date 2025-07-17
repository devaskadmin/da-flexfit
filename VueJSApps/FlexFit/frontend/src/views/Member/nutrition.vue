<script setup>
import { ref } from "vue";

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
    const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/openfoodfacts-search?query=${encodeURIComponent(foodSearchQuery.value)}`);
    const data = await res.json();
    if (data.products && Array.isArray(data.products)) {
      foodSearchResults.value = data.products;
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
        <h4>Nutrition Log</h4>
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
                <li v-for="food in foodSearchResults" :key="food.id" class="list-group-item d-flex justify-content-between align-items-center">
                  <div>
                    <strong>{{ food.product_name }}</strong>
                    <div class="small text-muted">{{ food.brands }}</div>
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