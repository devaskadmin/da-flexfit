<script setup>
import { computed, onMounted, ref } from 'vue';
import DateDropDown from '@/components/DropDownDate.vue';
import NutritionFoodCard from '@/components/nutrition-workspace/NutritionFoodCard.vue';
import NutritionMacroSummary from '@/components/nutrition-workspace/NutritionMacroSummary.vue';
import NutritionLogList from '@/components/nutrition-workspace/NutritionLogList.vue';

const STORAGE_KEY_LOG = 'flexfit_nutrition_log';
const STORAGE_KEY_FAV = 'flexfit_nutrition_favorites';
const STORAGE_KEY_CUSTOM = 'flexfit_nutrition_custom_foods';

const tabs = [
  { key: 'search', label: 'Food Search' },
  { key: 'addEdit', label: 'Add/Edit Food' },
  { key: 'log', label: 'My Nutrition Log' },
  { key: 'favorites', label: 'Favorite Foods' },
];

const activeTab = ref('search');
const selectedDateRaw = ref(new Date());

const selectedDateISO = computed(() => {
  const d = selectedDateRaw.value instanceof Date ? selectedDateRaw.value : new Date(selectedDateRaw.value);
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
});

const foodSearchQuery = ref('');
const selectedCategory = ref('All');
const selectedBrand = ref('All');
const foodSearchResults = ref([]);
const searchLoading = ref(false);
const searchError = ref('');
const didSearch = ref(false);

const categories = ref(['All']);
const brands = ref(['All']);

const nutritionLog = ref([]);
const favoriteFoods = ref([]);
const customFoods = ref([]);

const detailsFood = ref(null);
const detailsOpen = ref(false);

const addEditForm = ref({
  id: '',
  name: '',
  brand: '',
  image: '',
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
});

const toFoodModel = (product) => {
  const nutriments = product.nutriments || {};
  return {
    id: String(product.code || product.id || product._id || Math.random().toString(36).slice(2, 10)),
    name: product.product_name || product.generic_name || product.name || 'Unknown food',
    brand: product.brands || product.brand_name || 'No brand',
    image: product.image_front_url || product.image_url || product.image_small_url || product.image_thumb_url || '',
    calories: Number(nutriments['energy-kcal_100g'] ?? nutriments['energy-kcal'] ?? product.calories ?? 0) || 0,
    protein: Number(nutriments.proteins_100g ?? nutriments.proteins ?? product.protein ?? 0) || 0,
    carbs: Number(nutriments.carbohydrates_100g ?? nutriments.carbohydrates ?? product.carbs ?? 0) || 0,
    fat: Number(nutriments.fat_100g ?? nutriments.fat ?? product.fat ?? 0) || 0,
    source: product.source || 'api',
    raw: product,
  };
};

const hydrateStorage = () => {
  try {
    nutritionLog.value = JSON.parse(localStorage.getItem(STORAGE_KEY_LOG) || '[]');
    favoriteFoods.value = JSON.parse(localStorage.getItem(STORAGE_KEY_FAV) || '[]');
    customFoods.value = JSON.parse(localStorage.getItem(STORAGE_KEY_CUSTOM) || '[]');
  } catch {
    nutritionLog.value = [];
    favoriteFoods.value = [];
    customFoods.value = [];
  }
};

const saveStorage = () => {
  localStorage.setItem(STORAGE_KEY_LOG, JSON.stringify(nutritionLog.value));
  localStorage.setItem(STORAGE_KEY_FAV, JSON.stringify(favoriteFoods.value));
  localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(customFoods.value));
};

const loadCategories = async () => {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_BASE}/api/openfoodfacts-get-category`);
    const data = await response.json();
    categories.value = ['All', ...(Array.isArray(data) ? data.slice(0, 300) : [])];
  } catch {
    categories.value = ['All'];
  }
};

const loadBrands = async () => {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_BASE}/api/openfoodfacts-get-brandname`);
    const data = await response.json();
    brands.value = ['All', ...(Array.isArray(data) ? data.slice(0, 300) : [])];
  } catch {
    brands.value = ['All'];
  }
};

const searchFood = async () => {
  const query = foodSearchQuery.value.trim();
  if (!query) {
    searchError.value = 'Enter a food name to search.';
    didSearch.value = true;
    foodSearchResults.value = [];
    return;
  }

  searchLoading.value = true;
  didSearch.value = false;
  searchError.value = '';

  try {
    const response = await fetch(`${import.meta.env.VITE_API_BASE}/api/openfoodfacts-search?query=${encodeURIComponent(query)}`);
    if (!response.ok) {
      throw new Error('Unable to load foods from API.');
    }

    const data = await response.json();
    const products = Array.isArray(data?.products) ? data.products : [];
    foodSearchResults.value = products.map(toFoodModel);
    didSearch.value = true;
  } catch (error) {
    searchError.value = error.message || 'Search failed.';
    foodSearchResults.value = [];
    didSearch.value = true;
  } finally {
    searchLoading.value = false;
  }
};

const filteredResults = computed(() => {
  return foodSearchResults.value.filter((food) => {
    const inCategory = selectedCategory.value === 'All' || JSON.stringify(food.raw || {}).toLowerCase().includes(selectedCategory.value.toLowerCase());
    const inBrand = selectedBrand.value === 'All' || String(food.brand || '').toLowerCase().includes(selectedBrand.value.toLowerCase());
    return inCategory && inBrand;
  });
});

const selectedDateLogs = computed(() => nutritionLog.value.filter((entry) => entry.date === selectedDateISO.value));

const macroSummary = computed(() => {
  return selectedDateLogs.value.reduce(
    (acc, item) => {
      acc.calories += Number(item.calories || 0);
      acc.protein += Number(item.protein || 0);
      acc.carbs += Number(item.carbs || 0);
      acc.fat += Number(item.fat || 0);
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
});

const isFavorite = (foodId) => favoriteFoods.value.some((f) => f.id === foodId);

const addFoodToLog = (food) => {
  nutritionLog.value.unshift({ ...food, id: `${food.id}-${Date.now()}`, date: selectedDateISO.value });
  saveStorage();
};

const removeLogEntry = (entryId) => {
  nutritionLog.value = nutritionLog.value.filter((entry) => entry.id !== entryId);
  saveStorage();
};

const toggleFavorite = (food) => {
  if (isFavorite(food.id)) {
    favoriteFoods.value = favoriteFoods.value.filter((f) => f.id !== food.id);
  } else {
    favoriteFoods.value.unshift(food);
  }
  saveStorage();
};

const openDetails = async (food) => {
  const code = String(food.id || '').split('-')[0];
  if (!code) {
    detailsFood.value = food;
    detailsOpen.value = true;
    return;
  }

  try {
    const response = await fetch(`${import.meta.env.VITE_API_BASE}/api/openfoodfacts-product?code=${encodeURIComponent(code)}`);
    if (!response.ok) throw new Error('Unable to load details');
    const data = await response.json();
    detailsFood.value = toFoodModel(data?.product || food.raw || food);
  } catch {
    detailsFood.value = food;
  } finally {
    detailsOpen.value = true;
  }
};

const openEdit = (food) => {
  addEditForm.value = {
    id: food.id || '',
    name: food.name || '',
    brand: food.brand || '',
    image: food.image || '',
    calories: Number(food.calories || 0),
    protein: Number(food.protein || 0),
    carbs: Number(food.carbs || 0),
    fat: Number(food.fat || 0),
  };
  activeTab.value = 'addEdit';
};

const resetAddEdit = () => {
  addEditForm.value = {
    id: '',
    name: '',
    brand: '',
    image: '',
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  };
};

const saveCustomFood = () => {
  const payload = {
    id: addEditForm.value.id || `custom-${Date.now()}`,
    name: addEditForm.value.name.trim(),
    brand: addEditForm.value.brand.trim(),
    image: addEditForm.value.image.trim(),
    calories: Number(addEditForm.value.calories || 0),
    protein: Number(addEditForm.value.protein || 0),
    carbs: Number(addEditForm.value.carbs || 0),
    fat: Number(addEditForm.value.fat || 0),
    source: 'custom',
  };

  if (!payload.name) return;

  const index = customFoods.value.findIndex((f) => f.id === payload.id);
  if (index === -1) customFoods.value.unshift(payload);
  else customFoods.value.splice(index, 1, payload);

  saveStorage();
  resetAddEdit();
  activeTab.value = 'search';
};

const removeCustomFood = (id) => {
  customFoods.value = customFoods.value.filter((f) => f.id !== id);
  saveStorage();
};

onMounted(async () => {
  hydrateStorage();
  await Promise.all([loadCategories(), loadBrands()]);
});
</script>

<template>
  <div class="app-page-shell">
  <div class="app-page-canvas app-inner-shell">
  <div class="nutrition-workspace">
    <section class="builder-hero ff-page-header app-header-gradient">
      <div class="builder-hero__content">
        <h2>Nutrition Workspace</h2>
        <p>Search, review, and log foods in one workflow.</p>
      </div>
      <div class="builder-hero__meta">
        <DateDropDown v-model="selectedDateRaw" compact />
      </div>
    </section>

    <div class="workspace-layout">
      <main class="workspace-main panel-bg">
        <nav class="workspace-tabs">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            type="button"
            :class="{ active: activeTab === tab.key }"
            @click="activeTab = tab.key"
          >
            {{ tab.label }}
          </button>
        </nav>

        <section v-if="activeTab === 'search'" class="workspace-section">
          <div class="search-controls">
            <input v-model="foodSearchQuery" type="text" placeholder="Search food by name" @keyup.enter="searchFood" />
            <select v-model="selectedCategory">
              <option v-for="category in categories" :key="category" :value="category">{{ category }}</option>
            </select>
            <select v-model="selectedBrand">
              <option v-for="brand in brands" :key="brand" :value="brand">{{ brand }}</option>
            </select>
            <button type="button" class="btn-search" @click="searchFood">Search</button>
          </div>

          <p v-if="searchError" class="state-msg err">{{ searchError }}</p>
          <p v-if="searchLoading" class="state-msg">Searching foods...</p>
          <p v-if="didSearch && !searchLoading && filteredResults.length === 0" class="state-msg">No foods found.</p>

          <div class="food-grid" v-if="filteredResults.length">
            <NutritionFoodCard
              v-for="food in filteredResults"
              :key="food.id"
              :food="food"
              :is-favorite="isFavorite(food.id)"
              @add="addFoodToLog"
              @edit="openEdit"
              @favorite="toggleFavorite"
              @details="openDetails"
            />
          </div>
        </section>

        <section v-else-if="activeTab === 'addEdit'" class="workspace-section">
          <div class="add-edit-grid">
            <article class="form-card">
              <h3>Add / Edit Food</h3>
              <p>Create custom food entries or edit copied API entries.</p>

              <div class="form-grid">
                <label><span>Food Name</span><input v-model="addEditForm.name" type="text" placeholder="e.g., Greek Yogurt" /></label>
                <label><span>Brand</span><input v-model="addEditForm.brand" type="text" placeholder="e.g., Chobani" /></label>
                <label><span>Image URL</span><input v-model="addEditForm.image" type="text" placeholder="https://..." /></label>
                <label><span>Calories</span><input v-model.number="addEditForm.calories" type="number" min="0" /></label>
                <label><span>Protein (g)</span><input v-model.number="addEditForm.protein" type="number" min="0" /></label>
                <label><span>Carbs (g)</span><input v-model.number="addEditForm.carbs" type="number" min="0" /></label>
                <label><span>Fat (g)</span><input v-model.number="addEditForm.fat" type="number" min="0" /></label>
              </div>

              <div class="form-actions">
                <button type="button" class="btn-save" @click="saveCustomFood">Save Food</button>
                <button type="button" class="btn-clear" @click="resetAddEdit">Clear</button>
              </div>
            </article>

            <article class="form-card">
              <h3>Custom Foods</h3>
              <p>Saved entries for quick reuse.</p>
              <div v-if="customFoods.length === 0" class="state-msg">No custom foods yet.</div>
              <div v-else class="custom-list">
                <NutritionFoodCard
                  v-for="food in customFoods"
                  :key="food.id"
                  :food="food"
                  compact
                  :is-favorite="isFavorite(food.id)"
                  @add="addFoodToLog"
                  @edit="openEdit"
                  @favorite="toggleFavorite"
                  @details="openDetails"
                />
                <button v-for="food in customFoods" :key="`remove-${food.id}`" type="button" class="btn-remove-custom" @click="removeCustomFood(food.id)">
                  Remove {{ food.name }}
                </button>
              </div>
            </article>
          </div>
        </section>

        <section v-else-if="activeTab === 'log'" class="workspace-section">
          <NutritionLogList :entries="selectedDateLogs" @remove="removeLogEntry" />
        </section>

        <section v-else class="workspace-section">
          <div v-if="favoriteFoods.length === 0" class="state-msg">No favorite foods yet.</div>
          <div v-else class="food-grid">
            <NutritionFoodCard
              v-for="food in favoriteFoods"
              :key="food.id"
              :food="food"
              :is-favorite="true"
              @add="addFoodToLog"
              @edit="openEdit"
              @favorite="toggleFavorite"
              @details="openDetails"
            />
          </div>
        </section>
      </main>

      <aside class="workspace-side">
        <NutritionMacroSummary :total="macroSummary" />
      </aside>
    </div>

    <div v-if="detailsOpen" class="details-overlay" @click.self="detailsOpen = false">
      <article class="details-modal panel-bg">
        <h3>{{ detailsFood?.name }}</h3>
        <p>{{ detailsFood?.brand }}</p>
        <div class="details-macros">
          <span>{{ detailsFood?.calories || 0 }} kcal</span>
          <span>Protein {{ detailsFood?.protein || 0 }}g</span>
          <span>Carbs {{ detailsFood?.carbs || 0 }}g</span>
          <span>Fat {{ detailsFood?.fat || 0 }}g</span>
        </div>
        <button type="button" @click="detailsOpen = false">Close</button>
      </article>
    </div>
  </div>
  </div>
  </div>
</template>

<style scoped>
.nutrition-workspace {
  --ff-border-strong: rgba(148, 163, 184, 0.48);
  --ff-border-soft: rgba(148, 163, 184, 0.34);
  display: grid;
  gap: 14px;
}
.builder-hero { border: 1.5px solid var(--ff-border-strong); border-radius: 16px; display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; }
.builder-hero h2 { margin: 0; color: #ffffff; }
.builder-hero p { margin: 4px 0 0; color: #cbd5e1; }
.builder-hero__meta { display: flex; align-items: center; justify-content: flex-end; }
.workspace-layout { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 14px; }
.workspace-main { border: 1.5px solid var(--ff-border-strong); border-radius: 16px; padding: 14px; }
.workspace-tabs { display: flex; flex-wrap: wrap; gap: 8px; border-bottom: 1.5px solid var(--ff-border-soft); padding-bottom: 10px; }
.workspace-tabs button { border: 1.5px solid var(--ff-border-soft); background: transparent; color: var(--text-color); border-radius: 999px; padding: 6px 12px; font-size: 0.82rem; font-weight: 600; }
.workspace-tabs button.active { border-color: #4f46e5; color: #a5b4fc; background: rgba(79, 70, 229, 0.18); }
.workspace-section { margin-top: 12px; }
.search-controls { display: grid; grid-template-columns: 2fr 1fr 1fr auto; gap: 8px; }
.search-controls input, .search-controls select { border: 1.5px solid var(--ff-border-soft); background: var(--main-color); color: var(--text-color); border-radius: 10px; padding: 9px 10px; }
.btn-search { border: none; background: #2563eb; color: #fff; border-radius: 10px; padding: 9px 12px; font-weight: 700; }
.food-grid { margin-top: 12px; display: grid; gap: 10px; }
.state-msg { margin-top: 12px; border: 1.5px dashed var(--ff-border-soft); border-radius: 10px; color: var(--text-color-secondary); padding: 12px; }
.state-msg.err { color: #fca5a5; border-color: #7f1d1d; }
.add-edit-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.form-card { border: 1.5px solid var(--ff-border-soft); border-radius: 12px; padding: 12px; }
.form-card h3 { margin: 0; color: var(--text-color); font-size: 1rem; }
.form-card p { margin: 4px 0 10px; color: var(--text-color-secondary); font-size: 0.82rem; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.form-grid label { display: grid; gap: 4px; }
.form-grid span { color: var(--text-color-secondary); font-size: 0.74rem; }
.form-grid input { border: 1.5px solid var(--ff-border-soft); background: var(--main-color); color: var(--text-color); border-radius: 8px; padding: 8px 9px; }
.form-actions { margin-top: 10px; display: flex; gap: 8px; }
.btn-save, .btn-clear { border: none; border-radius: 8px; padding: 8px 12px; font-weight: 700; }
.btn-save { background: #16a34a; color: #fff; }
.btn-clear { background: #374151; color: #fff; }
.custom-list { display: grid; gap: 8px; }
.btn-remove-custom { border: 1px dashed #fca5a5; background: transparent; color: #fca5a5; border-radius: 8px; padding: 7px 10px; text-align: left; }
.workspace-side { display: grid; align-content: start; gap: 10px; }
.details-overlay { position: fixed; inset: 0; background: rgba(2, 6, 23, 0.65); display: grid; place-items: center; padding: 16px; z-index: 1200; }
.details-modal { width: min(460px, 100%); border: 1.5px solid var(--ff-border-strong); border-radius: 14px; padding: 14px; }
.details-modal h3 { margin: 0; color: var(--text-color); }
.details-modal p { margin: 4px 0 10px; color: var(--text-color-secondary); }
.details-macros { display: grid; gap: 6px; color: var(--text-color); }
.details-modal button { margin-top: 12px; border: none; background: #374151; color: #fff; border-radius: 8px; padding: 8px 12px; }
:global(body.light-theme) .nutrition-workspace {
  --ff-border-strong: rgba(15, 23, 42, 0.28);
  --ff-border-soft: rgba(15, 23, 42, 0.22);
}
@media (max-width: 1100px) { .workspace-layout { grid-template-columns: 1fr; } .workspace-side { order: -1; } }
@media (max-width: 768px) {
  .search-controls, .add-edit-grid, .form-grid { grid-template-columns: 1fr; }
  .builder-hero__meta { width: 100%; justify-content: flex-start; }
}
</style>
