<script setup>
import { computed, onMounted, ref } from 'vue';
import NutritionFoodCard from '@/components/nutrition-workspace/NutritionFoodCard.vue';
import NutritionLogList from '@/components/nutrition-workspace/NutritionLogList.vue';

const STORAGE_KEY_LOG = 'flexfit_nutrition_log';
const STORAGE_KEY_FAV = 'flexfit_nutrition_favorites';
const STORAGE_KEY_CUSTOM = 'flexfit_nutrition_custom_foods';

const selectedDateRaw = ref(new Date());
const logOpen = ref(true);
const favoritesOpen = ref(false);
const addEditOpen = ref(false);

const selectedDateISO = computed(() => {
  const d = selectedDateRaw.value instanceof Date ? selectedDateRaw.value : new Date(selectedDateRaw.value);
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
});

const selectedDateInput = computed({
  get: () => selectedDateISO.value,
  set: (val) => {
    const d = new Date(val + 'T00:00:00');
    if (!isNaN(d.getTime())) selectedDateRaw.value = d;
  },
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
  addEditOpen.value = true;
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
  addEditOpen.value = false;
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

    <!-- ── Hero: title + inline macro cards + date ── -->
    <section class="builder-hero ff-page-header app-header-gradient">
      <h2>Nutrition Workspace</h2>

      <div class="hero-macro-grid">
        <div class="hero-macro-card hero-macro-calories">
          <span class="hero-macro-icon">🔥</span>
          <div>
            <strong>{{ macroSummary.calories || 0 }}</strong>
            <span>Calories</span>
          </div>
        </div>
        <div class="hero-macro-card hero-macro-protein">
          <span class="hero-macro-icon">🥩</span>
          <div>
            <strong>{{ macroSummary.protein || 0 }}g</strong>
            <span>Protein</span>
          </div>
        </div>
        <div class="hero-macro-card hero-macro-carbs">
          <span class="hero-macro-icon">🌾</span>
          <div>
            <strong>{{ macroSummary.carbs || 0 }}g</strong>
            <span>Carbs</span>
          </div>
        </div>
        <div class="hero-macro-card hero-macro-fat">
          <span class="hero-macro-icon">🥑</span>
          <div>
            <strong>{{ macroSummary.fat || 0 }}g</strong>
            <span>Fat</span>
          </div>
        </div>
      </div>

      <div class="nutrition-date-wrapper">
        <span class="nutrition-date-label">Select Date</span>
        <div class="nutrition-date-container">
          <input
            type="date"
            v-model="selectedDateInput"
            class="nutrition-date-input"
          />
          <span class="nutrition-calendar-icon" aria-hidden="true">📅</span>
        </div>
      </div>
    </section>

    <!-- ── Search card ── -->
    <div class="search-card">
      <div class="search-controls">
        <input v-model="foodSearchQuery" type="text" placeholder="Search food by name..." @keyup.enter="searchFood" />
        <select v-model="selectedCategory">
          <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
        </select>
        <select v-model="selectedBrand">
          <option v-for="brand in brands" :key="brand" :value="brand">{{ brand }}</option>
        </select>
        <button type="button" class="btn-search" @click="searchFood">
          <i class="fa-solid fa-magnifying-glass"></i> Search Foods
        </button>
      </div>
    </div>

    <p v-if="searchError" class="state-msg err">{{ searchError }}</p>
    <p v-if="searchLoading" class="state-msg">Searching foods...</p>
    <p v-if="didSearch && !searchLoading && filteredResults.length === 0" class="state-msg">No foods found.</p>

    <div v-if="filteredResults.length" class="food-grid">
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

    <!-- ── Today's Log (collapsible) ── -->
    <div class="collapsible-section">
      <button type="button" class="section-toggle" @click="logOpen = !logOpen">
        <span>📋 Today's Entries<small v-if="selectedDateLogs.length"> ({{ selectedDateLogs.length }})</small></span>
        <i :class="logOpen ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'"></i>
      </button>
      <div v-show="logOpen" class="section-body">
        <NutritionLogList :entries="selectedDateLogs" @remove="removeLogEntry" />
      </div>
    </div>

    <!-- ── Favorite Foods (collapsible) ── -->
    <div class="collapsible-section">
      <button type="button" class="section-toggle" @click="favoritesOpen = !favoritesOpen">
        <span>⭐ Favorite Foods<small v-if="favoriteFoods.length"> ({{ favoriteFoods.length }})</small></span>
        <i :class="favoritesOpen ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'"></i>
      </button>
      <div v-show="favoritesOpen" class="section-body">
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
      </div>
    </div>

    <!-- ── Add / Edit Custom Food (collapsible) ── -->
    <div class="collapsible-section">
      <button type="button" class="section-toggle" @click="addEditOpen = !addEditOpen">
        <span>✏️ {{ addEditForm.id ? 'Edit Food' : 'Add Custom Food' }}</span>
        <i :class="addEditOpen ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'"></i>
      </button>
      <div v-show="addEditOpen" class="section-body">
        <div class="add-edit-grid">
          <article class="form-card">
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
          <article v-if="customFoods.length" class="form-card">
            <h3>Custom Foods</h3>
            <div class="custom-list">
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
              <button
                v-for="food in customFoods"
                :key="`remove-${food.id}`"
                type="button"
                class="btn-remove-custom"
                @click="removeCustomFood(food.id)"
              >
                Remove {{ food.name }}
              </button>
            </div>
          </article>
        </div>
      </div>
    </div>

    <!-- ── Details modal ── -->
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

/* ── Hero ── */
.builder-hero {
  border: 1.5px solid var(--ff-border-strong);
  border-radius: 18px;
  min-height: 140px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.builder-hero h2 {
  margin: 0;
  color: #fff;
  font-size: 1.45rem;
  font-weight: 700;
}

.hero-macro-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.hero-macro-card {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-left: 4px solid rgba(255, 255, 255, 0.25);
}

.hero-macro-calories { border-left-color: #ff8a00; }
.hero-macro-protein  { border-left-color: #3a86ff; }
.hero-macro-carbs    { border-left-color: #43aa8b; }
.hero-macro-fat      { border-left-color: #ff5d73; }

.hero-macro-icon {
  font-size: 1.4rem;
  line-height: 1;
  flex-shrink: 0;
}

.hero-macro-card strong {
  display: block;
  color: #fff;
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.1;
}

.hero-macro-card span {
  display: block;
  color: rgba(255, 255, 255, 0.75);
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.nutrition-date-wrapper {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
  box-sizing: border-box;
}

.nutrition-date-label {
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.nutrition-date-container {
  position: relative;
  width: 100%;
  max-width: 320px;
  display: flex;
  align-items: center;
}

.nutrition-date-input {
  width: 100%;
  height: 52px;
  padding-left: 14px;
  padding-right: 52px;
  border-radius: 12px;
  background: #ffffff;
  color: #1e293b;
  font-size: 14px;
  font-weight: 600;
  border: 1px solid #d6dce8;
  box-sizing: border-box;
  cursor: pointer;
}

.nutrition-date-input::-webkit-calendar-picker-indicator {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  z-index: 4;
}

.nutrition-calendar-icon {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 18px;
  opacity: 1;
  z-index: 5;
  pointer-events: none;
  line-height: 1;
}

/* ── Search card ── */
.search-card {
  background: var(--main-color, #fff);
  border: 1.5px solid var(--ff-border-strong);
  border-radius: 16px;
  padding: 14px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.search-controls {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr auto;
  gap: 8px;
}

.search-controls input,
.search-controls select {
  border: 1.5px solid var(--ff-border-soft);
  background: var(--main-color);
  color: var(--text-color);
  border-radius: 10px;
  padding: 9px 10px;
  height: 44px;
  font-size: 0.88rem;
}

.btn-search {
  border: none;
  background: #2563eb;
  color: #fff;
  border-radius: 12px;
  padding: 0 18px;
  font-weight: 700;
  font-size: 0.95rem;
  height: 44px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.btn-search:hover { background: #1d4ed8; }

/* ── Food grid ── */
.food-grid {
  display: grid;
  gap: 10px;
}

/* ── State messages ── */
.state-msg {
  border: 1.5px dashed var(--ff-border-soft);
  border-radius: 10px;
  color: var(--text-color-secondary);
  padding: 12px;
  font-size: 0.88rem;
}

.state-msg.err {
  color: #fca5a5;
  border-color: #7f1d1d;
}

/* ── Collapsible sections ── */
.collapsible-section {
  background: var(--main-color, #fff);
  border: 1.5px solid var(--ff-border-strong);
  border-radius: 16px;
  overflow: hidden;
}

.section-toggle {
  width: 100%;
  padding: 14px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: transparent;
  border: none;
  cursor: pointer;
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--text-color);
  text-align: left;
  transition: background 0.15s;
}

.section-toggle:hover { background: rgba(0, 0, 0, 0.02); }

.section-toggle small {
  font-weight: 500;
  color: var(--text-color-secondary);
  margin-left: 4px;
}

.section-toggle i {
  color: #64748b;
  font-size: 0.85rem;
  flex-shrink: 0;
}

.section-body {
  padding: 0 14px 14px;
  border-top: 1px solid var(--ff-border-soft);
}

/* ── Add / Edit form ── */
.add-edit-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  padding-top: 12px;
}

.form-card {
  border: 1.5px solid var(--ff-border-soft);
  border-radius: 12px;
  padding: 12px;
}

.form-card h3 {
  margin: 0 0 10px;
  color: var(--text-color);
  font-size: 0.95rem;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.form-grid label { display: grid; gap: 4px; }

.form-grid span {
  color: var(--text-color-secondary);
  font-size: 0.74rem;
}

.form-grid input {
  border: 1.5px solid var(--ff-border-soft);
  background: var(--main-color);
  color: var(--text-color);
  border-radius: 8px;
  padding: 8px 9px;
  height: 38px;
}

.form-actions {
  margin-top: 10px;
  display: flex;
  gap: 8px;
}

.btn-save, .btn-clear {
  border: none;
  border-radius: 8px;
  padding: 8px 14px;
  font-weight: 700;
  font-size: 0.88rem;
  cursor: pointer;
}

.btn-save  { background: #16a34a; color: #fff; }
.btn-clear { background: #374151; color: #fff; }

.custom-list { display: grid; gap: 8px; }

.btn-remove-custom {
  border: 1px dashed #fca5a5;
  background: transparent;
  color: #fca5a5;
  border-radius: 8px;
  padding: 7px 10px;
  text-align: left;
  cursor: pointer;
  font-size: 0.82rem;
}

/* ── Details modal ── */
.details-overlay {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 23, 0.65);
  display: grid;
  place-items: center;
  padding: 16px;
  z-index: 1200;
}

.details-modal {
  width: min(460px, 100%);
  border: 1.5px solid var(--ff-border-strong);
  border-radius: 14px;
  padding: 16px;
}

.details-modal h3 { margin: 0; color: var(--text-color); }
.details-modal p  { margin: 4px 0 10px; color: var(--text-color-secondary); }

.details-macros {
  display: grid;
  gap: 6px;
  color: var(--text-color);
}

.details-modal button {
  margin-top: 12px;
  border: none;
  background: #374151;
  color: #fff;
  border-radius: 8px;
  padding: 8px 14px;
  cursor: pointer;
}

:global(body.light-theme) .nutrition-workspace {
  --ff-border-strong: rgba(15, 23, 42, 0.28);
  --ff-border-soft: rgba(15, 23, 42, 0.22);
}

/* ──────────────────────────────────────────────────
   MOBILE ≤ 768px  (v0.81.15 Nutrition Mobile Cleanup)
────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .nutrition-workspace {
    gap: 10px;
  }

  /* Hero: compact */
  .builder-hero {
    min-height: auto;
    padding: 16px !important;
    border-radius: 16px !important;
    gap: 12px;
    overflow: hidden;
  }

  .builder-hero h2 {
    font-size: 1.3rem !important;
  }

  /* Date wrapper: full-width on mobile */
  .nutrition-date-wrapper {
    width: 100%;
  }

  .nutrition-date-container {
    max-width: 100%;
  }

  .nutrition-date-input {
    max-width: 100%;
    width: 100%;
    height: 48px;
    font-size: 0.88rem;
  }

  /* Macros: 2×2 grid */
  .hero-macro-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .hero-macro-card {
    padding: 8px 10px;
    border-radius: 10px;
    gap: 8px;
  }

  .hero-macro-icon { font-size: 1.15rem; }

  .hero-macro-card strong { font-size: 1.05rem; }

  .hero-macro-card span { font-size: 0.65rem; }

  /* Search: stacked column */
  .search-card {
    padding: 12px;
    border-radius: 14px;
  }

  .search-controls {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .search-controls input,
  .search-controls select {
    height: 42px;
    font-size: 0.88rem;
  }

  .btn-search {
    width: 100%;
    height: 46px;
    justify-content: center;
  }

  /* Collapsible sections */
  .section-toggle {
    padding: 12px 14px;
    font-size: 0.9rem;
  }

  .section-body {
    padding: 0 12px 12px;
  }

  /* Add/Edit: single column */
  .add-edit-grid,
  .form-grid {
    grid-template-columns: 1fr;
  }

  /* Food grid: tighter */
  .food-grid { gap: 8px; }
}

/* ──────────────────────────────────────────────────
   SMALL PHONES ≤ 480px
────────────────────────────────────────────────── */
@media (max-width: 480px) {
  .builder-hero h2  { font-size: 1.15rem !important; }
  .hero-macro-card strong { font-size: 0.95rem; }
  .hero-macro-icon  { font-size: 1rem; }
}
</style>