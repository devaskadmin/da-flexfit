<script setup>
const NutritionLogs = [
  { date: "Nov 23", meal: "Breakfast", details: "Oatmeal, Banana, Coffee", calories: "320 kcal" },
  { date: "Nov 23", meal: "Lunch", details: "Grilled Chicken Salad, Water", calories: "450 kcal" },
  { date: "Nov 23", meal: "Snack", details: "Protein Bar, Green Tea", calories: "200 kcal" },
  { date: "Nov 23", meal: "Dinner", details: "Salmon, Quinoa, Steamed Vegetables", calories: "500 kcal" },
];
</script>

<template>
  <div class="panel">
    <div class="panel-header">
      <h5>Nutrition Log</h5>
      <div class="btn-box">
        <a href="#" class="btn btn-sm btn-primary">Add Meal</a>
      </div>
    </div>
    <div class="panel-body">
      <div class="table-responsive">
        <table class="table table-hover table-Nutrition">
          <thead>
            <tr>
              <th>Date</th>
              <th>Meal</th>
              <th>Details</th>
              <th>Calories</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(log, index) in NutritionLogs" :key="index">
              <td>{{ log.date }}</td>
              <td>{{ log.meal }}</td>
              <td>{{ log.details }}</td>
              <td>{{ log.calories }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
