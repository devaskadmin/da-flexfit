<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import DateDropDown from '@/components/DropDownDate.vue';
import 'bootstrap/dist/css/bootstrap.min.css';
import { CTabs, CTab, CTabContent, CTabPanel, CTabList } from '@coreui/vue';

// --- Search / Filters / Results state ---
const foodSearchQuery = ref('');
const foodSearchResults = ref([]);
const foodSearchLoading = ref(false);
const foodSearchError = ref('');
const foodSearchPerformed = ref(false);

const categorySearch = ref('');
const brandSearch = ref('');
const labelSearch = ref('');

const categoryFilters = ref([]);
const brandFilters = ref([]);
const labelFilters = ref([]);

const categories = ref([]);
const brands = ref([]);
const labels = ref([]);
const categoriesPage = ref(1);
const brandsPage = ref(1);
const labelsPage = ref(1);
const pageSize = 2000;

const foodPage = ref(1);
const resultsPerPage = ref(8);
const foodPageSize = ref(resultsPerPage.value);

const showFilters = ref(false);
const pageTab = ref('results');

// --- Product detail state ---
const ShowFoodSearch = ref(true);
const currentProduct = ref(null);
const productLoading = ref(false);
const productError = ref('');

// --- Date picker ---
const selectedDateRaw = ref(new Date());
const selectedDate = computed(() => {
  const d = selectedDateRaw.value instanceof Date ? selectedDateRaw.value : new Date(selectedDateRaw.value);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${month}/${day}/${year}`;
});

// --- Utility helpers ---
const sortByMostScanned = (products) => {
  return [...products].sort((a, b) => {
    const aScanned = a.popularity_key || a.times_scanned || 0;
    const bScanned = b.popularity_key || b.times_scanned || 0;
    if (bScanned !== aScanned) return bScanned - aScanned;
    return (a.product_name || '').localeCompare(b.product_name || '');
  });
};

const _formatField = (field) => {
  if (!field) return 'N/A';
  if (Array.isArray(field)) return field.map(f => String(f).replace(/^.*:/, '').replace(/-/g, ' ')).join(', ');
  return String(field).replace(/^.*:/, '').replace(/-/g, ' ');
};

// --- Fetch helpers ---
const fetchCategories = async () => {
  try {
    const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/openfoodfacts-get-category`);
    const data = await res.json();
    categories.value = Array.isArray(data) ? data : [];
  } catch (e) { categories.value = []; }
};
const fetchBrands = async () => {
  try {
    const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/openfoodfacts-get-brandname`);
    const data = await res.json();
    brands.value = Array.isArray(data) ? data : [];
  } catch (e) { brands.value = []; }
};
const fetchLabels = async () => {
  try {
    const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/openfoodfacts-get-labels`);
    const data = await res.json();
    labels.value = Array.isArray(data) ? data : [];
  } catch (e) { labels.value = []; }
};

const fetchAllFoods = async () => {
  foodSearchError.value = '';
  foodSearchLoading.value = true;
  foodSearchPerformed.value = false;
  foodSearchResults.value = [];
  try {
    const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/openfoodfacts-search?query=a`);
    if (!res.ok) {
      const txt = await res.text().catch(() => null);
      throw new Error(txt || 'Error loading Nutrition');
    }
    const data = await res.json();
    foodSearchResults.value = Array.isArray(data.products) ? sortByMostScanned(data.products) : [];
    foodSearchPerformed.value = true;
  } catch (err) {
    foodSearchError.value = err.message || 'Error fetching foods.';
    foodSearchResults.value = [];
    foodSearchPerformed.value = true;
  } finally { foodSearchLoading.value = false; }
};

const searchFood = async () => {
  if (!foodSearchQuery.value && !categoryFilters.value.length && !brandFilters.value.length && !labelFilters.value.length) {
    await fetchAllFoods();
    return;
  }
  foodSearchError.value = '';
  foodSearchLoading.value = true;
  foodSearchPerformed.value = false;
  foodSearchResults.value = [];
  foodPage.value = 1;
  try {
    const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/openfoodfacts-search?query=${encodeURIComponent(foodSearchQuery.value)}`);
    if (!res.ok) {
      const txt = await res.text().catch(() => null);
      throw new Error(txt || 'Error loading Nutrition data');
    }
    const data = await res.json();
    foodSearchResults.value = Array.isArray(data.products) ? sortByMostScanned(data.products) : [];
    foodSearchPerformed.value = true;
  } catch (err) {
    foodSearchError.value = err.message || 'Error searching food.';
    foodSearchResults.value = [];
    foodSearchPerformed.value = true;
  } finally { foodSearchLoading.value = false; }
};

onMounted(() => {
  // ensure selected date defaults to today on page load
  selectedDateRaw.value = new Date();
  fetchCategories();
  fetchBrands();
  fetchLabels();
  fetchAllFoods();
});

// --- Filtered lists (searchable lists) ---
const filteredCategories = computed(() => {
  let list = Array.isArray(categories.value) ? categories.value : [];
  if (categorySearch.value) list = list.filter(c => c && c.toLowerCase().includes(categorySearch.value.toLowerCase()));
  return list.slice(0, categoriesPage.value * pageSize);
});
const filteredBrands = computed(() => {
  let list = Array.isArray(brands.value) ? brands.value : [];
  if (brandSearch.value) list = list.filter(b => b && b.toLowerCase().includes(brandSearch.value.toLowerCase()));
  return list.slice(0, brandsPage.value * pageSize);
});
const filteredLabels = computed(() => {
  let list = Array.isArray(labels.value) ? labels.value : [];
  if (labelSearch.value) list = list.filter(l => l && l.toLowerCase().includes(labelSearch.value.toLowerCase()));
  return list.slice(0, labelsPage.value * pageSize);
});

watch(categorySearch, () => { categoriesPage.value = 1; });
watch(brandSearch, () => { brandsPage.value = 1; });
watch(labelSearch, () => { labelsPage.value = 1; });

// set active tab to FoodCategories when Show Filters toggle is turned on
watch(showFilters, (v) => { if (v) pageTab.value = 'FoodCategories'; });

// --- Displayed foods and pagination ---
const displayedFoods = computed(() => {
  const list = Array.isArray(foodSearchResults.value) ? foodSearchResults.value : [];
  const q = foodSearchQuery.value && String(foodSearchQuery.value).trim().toLowerCase();
  return list.filter(product => {
    if (q) {
      const name = (product.product_name || product.generic_name || '') + '';
      if (!name.toLowerCase().includes(q)) return false;
    }
    if (categoryFilters.value.length) {
      const catField = product.categories || product.categories_tags || product.category || '';
      const catString = Array.isArray(catField) ? catField.join(' ').toLowerCase() : String(catField || '').toLowerCase();
      if (!categoryFilters.value.some(f => catString.includes(String(f || '').toLowerCase()))) return false;
    }
    if (brandFilters.value.length) {
      const brandField = product.brands || product.brands_tags || '';
      const brandString = Array.isArray(brandField) ? brandField.join(' ').toLowerCase() : String(brandField || '').toLowerCase();
      if (!brandFilters.value.some(f => brandString.includes(String(f || '').toLowerCase()))) return false;
    }
    if (labelFilters.value.length) {
      const labelField = product.labels || product.labels_tags || '';
      const labelString = Array.isArray(labelField) ? labelField.join(' ').toLowerCase() : String(labelField || '').toLowerCase();
      if (!labelFilters.value.some(f => labelString.includes(String(f || '').toLowerCase()))) return false;
    }
    return true;
  });
});

const displayedFoodsPaginated = computed(() => {
  const list = Array.isArray(displayedFoods.value) ? displayedFoods.value : [];
  return list.slice(0, foodPage.value * foodPageSize.value);
});

const loadMoreFoods = () => {
  const total = displayedFoods.value.length || 0;
  const shown = foodPage.value * foodPageSize.value;
  if (shown < total) foodPage.value++;
};

const hasMoreFoods = computed(() => (displayedFoods.value.length || 0) > (displayedFoodsPaginated.value.length || 0));

watch([() => categoryFilters.value.length, () => brandFilters.value.length, () => labelFilters.value.length, () => foodSearchQuery.value], () => { foodPage.value = 1; });
watch(resultsPerPage, (v) => { foodPageSize.value = Number(v) || 8; foodPage.value = 1; });

const selectedFilters = computed(() => {
  const arr = [];
  for (const v of categoryFilters.value || []) arr.push({ type: 'FoodCategories', value: v });
  for (const v of brandFilters.value || []) arr.push({ type: 'FoodBrands', value: v });
  for (const v of labelFilters.value || []) arr.push({ type: 'FoodLabels', value: v });
  return arr.slice(0, 8);
});

const removeFilter = (type, value) => {
  if (type === 'FoodCategories') categoryFilters.value = (categoryFilters.value || []).filter(x => x !== value);
  if (type === 'FoodBrands') brandFilters.value = (brandFilters.value || []).filter(x => x !== value);
  if (type === 'FoodLabels') labelFilters.value = (labelFilters.value || []).filter(x => x !== value);
};

const selectCategory = async (cat) => { if (!categoryFilters.value.includes(cat) && categoryFilters.value.length < 8) categoryFilters.value.push(cat); categoriesPage.value = 1; if (!foodSearchResults.value.length) await fetchAllFoods(); };
const selectBrand = async (b) => { if (!brandFilters.value.includes(b) && brandFilters.value.length < 8) brandFilters.value.push(b); brandsPage.value = 1; if (!foodSearchResults.value.length) await fetchAllFoods(); };
const selectLabel = async (l) => { if (!labelFilters.value.includes(l) && labelFilters.value.length < 8) labelFilters.value.push(l); labelsPage.value = 1; if (!foodSearchResults.value.length) await fetchAllFoods(); };

const clearFilters = async () => {
  foodSearchQuery.value = ''; categorySearch.value = ''; brandSearch.value = ''; labelSearch.value = ''; categoryFilters.value = []; brandFilters.value = []; labelFilters.value = []; categoriesPage.value = 1; brandsPage.value = 1; labelsPage.value = 1; foodPage.value = 1; await Promise.all([fetchCategories(), fetchBrands(), fetchLabels(), fetchAllFoods()]);
};

const getProductCategories = (product) => {
  const field = product.categories || product.categories_tags || product.category || '';
  return _formatField(field);
};
const getProductLabels = (product) => {
  const field = product.labels || product.labels_tags || '';
  return _formatField(field);
};
// --- New: determine source for displayed food items ---
const getFoodSource = (food) => {
  if (!food) return 'Local';
  // If there's an explicit source flag or an OpenFoodFacts url, treat as External
  const src = String(food.source || '').toLowerCase();
  if (src && src !== 'local') return 'External';
  const url = String(food.off_url || food.url || '').toLowerCase();
  if (url.includes('openfoodfacts')) return 'External';
  // if item has an OpenFoodFacts barcode/code but no local id, assume external
  if ((food.code || food.id) && !food._id) return 'External';
  return 'Local';
};

const truncateCategory = (catStr) => {
  if (!catStr) return catStr;
  try { const parts = catStr.split(',').map(p => p.trim()).filter(Boolean); return parts.length <= 3 ? parts.join(', ') : parts.slice(0,3).join(', ') + '...'; } catch (e) { return catStr; }
};

// --- Product detail view ---
const viewProduct = async (food) => {
  const code = food.code || food._id || food.id || (food.code_tags && food.code_tags[0]);
  if (!code) { currentProduct.value = { product: food }; ShowFoodSearch.value = false; return; }
  productLoading.value = true; productError.value = '';
  try {
    const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/openfoodfacts-product?code=${encodeURIComponent(code)}`);
    if (!res.ok) { const txt = await res.text().catch(()=>null); throw new Error(txt || 'Failed to load product'); }
    const data = await res.json(); currentProduct.value = data; ShowFoodSearch.value = false;
  } catch (err) { productError.value = err.message || 'Failed to load product'; currentProduct.value = { product: food }; ShowFoodSearch.value = false; }
  finally { productLoading.value = false; }
};
const backToSearch = () => { currentProduct.value = null; ShowFoodSearch.value = true; };

const productNutrients = computed(() => {
  const p = currentProduct.value && currentProduct.value.product; if (!p || !p.nutriments) return [];
  const n = p.nutriments || {};
  const keys = [ { key: 'energy-kcal', label: 'Energy (kcal)' }, { key: 'fat', label: 'Fat' }, { key: 'saturated-fat', label: 'Saturated fat' }, { key: 'carbohydrates', label: 'Carbohydrates' }, { key: 'sugars', label: 'Sugars' }, { key: 'fiber', label: 'Fiber' }, { key: 'proteins', label: 'Proteins' }, { key: 'salt', label: 'Salt' } ];
  return keys.map(k => { const per100 = n[`${k.key}_100g`] ?? n[`${k.key}_100ml`] ?? null; const perServing = n[`${k.key}_serving`] ?? null; const unit = n[`${k.key}_unit`] ?? n[`${k.key}_100g_unit`] ?? ''; return { label: k.label, per100, perServing, unit }; }).filter(r => r.per100 !== null || r.perServing !== null);
});
const formatNutrient = (val, unit) => { if (val === null || typeof val === 'undefined') return '-'; return `${val}${unit ? ' ' + unit : ''}`; };

const foodSearchErrorDisplay = computed(() => {
  const e = foodSearchError.value; if (!e) return ''; try { JSON.parse(e); return 'Error loading nutrion'; } catch (_) { const s = String(e).toLowerCase(); if (s.includes('openfoodfacts') || s.includes('failed to fetch')) return 'Error loading nutrion'; return e; }
});

// --- Add/Edit Food form ---
const addEditForm = ref({ barcode_code: '', product_name: '', generic_name: '', brand_name: '', quantity: '', category_tags: '', label_tags: '', ingredients_text: '', allergens: '', traces: '', additives_tags: '', packaging: '', serving_size_text: '', nutriscore_grade: '', nova_group: null, image_front_url: '', image_nutrition_url: '', image_thumb_url: '', off_url: '', source: 'openfoodfacts', last_modified_ts: '', nutriments: { energy_kcal_100g: '', fat_100g: '', saturated_fat_100g: '', carbohydrates_100g: '', sugars_100g: '', fiber_100g: '', proteins_100g: '', salt_100g: '', sodium_100g: '' } });
const addEditLoading = ref(false); const addEditError = ref(''); const addEditSuccess = ref('');

const resetAddEditForm = () => { addEditForm.value = { barcode_code: '', product_name: '', generic_name: '', brand_name: '', quantity: '', category_tags: '', label_tags: '', ingredients_text: '', allergens: '', traces: '', additives_tags: '', packaging: '', serving_size_text: '', nutriscore_grade: '', nova_group: null, image_front_url: '', image_nutrition_url: '', image_thumb_url: '', off_url: '', source: 'openfoodfacts', last_modified_ts: '', nutriments: { energy_kcal_100g: '', fat_100g: '', saturated_fat_100g: '', carbohydrates_100g: '', sugars_100g: '', fiber_100g: '', proteins_100g: '', salt_100g: '', sodium_100g: '' } }; addEditError.value = ''; addEditSuccess.value = ''; };

const populateFromOFF = (product) => {
  if (!product) return; const n = product.nutriments || {};
  addEditForm.value.barcode_code = product.code || ''; addEditForm.value.product_name = product.product_name || product.name || ''; addEditForm.value.generic_name = product.generic_name || ''; addEditForm.value.brand_name = product.brands || (product.brands_tags && product.brands_tags.join(', ')) || ''; addEditForm.value.quantity = product.quantity || ''; addEditForm.value.category_tags = Array.isArray(product.categories_tags) ? product.categories_tags.join(', ') : (product.categories || ''); addEditForm.value.label_tags = Array.isArray(product.labels_tags) ? product.labels_tags.join(', ') : (product.labels || ''); addEditForm.value.ingredients_text = product.ingredients_text || product.ingredients_text_debug || ''; addEditForm.value.allergens = product.allergens || ''; addEditForm.value.traces = product.traces || ''; addEditForm.value.additives_tags = Array.isArray(product.additives_tags) ? product.additives_tags.join(', ') : ''; addEditForm.value.packaging = product.packaging || ''; addEditForm.value.serving_size_text = product.serving_size || ''; addEditForm.value.nutriscore_grade = product.nutrition_grades || ''; addEditForm.value.nova_group = product.nova_group || null; addEditForm.value.image_front_url = product.image_front_url || product.image_front_thumb_url || ''; addEditForm.value.image_nutrition_url = product.image_nutrition_url || ''; addEditForm.value.image_thumb_url = product.image_small_url || ''; addEditForm.value.off_url = product.url || ''; addEditForm.value.last_modified_ts = product.last_modified_t ? new Date(product.last_modified_t * 1000).toISOString() : ''; addEditForm.value.nutriments.energy_kcal_100g = n['energy-kcal_100g'] ?? n['energy-kcal'] ?? ''; addEditForm.value.nutriments.fat_100g = n['fat_100g'] ?? n['fat'] ?? ''; addEditForm.value.nutriments.saturated_fat_100g = n['saturated-fat_100g'] ?? n['saturated-fat'] ?? ''; addEditForm.value.nutriments.carbohydrates_100g = n['carbohydrates_100g'] ?? n['carbohydrates'] ?? ''; addEditForm.value.nutriments.sugars_100g = n['sugars_100g'] ?? n['sugars'] ?? ''; addEditForm.value.nutriments.fiber_100g = n['fiber_100g'] ?? n['fiber'] ?? ''; addEditForm.value.nutriments.proteins_100g = n['proteins_100g'] ?? n['proteins'] ?? ''; addEditForm.value.nutriments.salt_100g = n['salt_100g'] ?? n['salt'] ?? ''; addEditForm.value.nutriments.sodium_100g = n['sodium_100g'] ?? n['sodium'] ?? '';
};

const lookupOFFByBarcode = async () => {
  addEditError.value = ''; addEditSuccess.value = ''; const code = addEditForm.value.barcode_code && String(addEditForm.value.barcode_code).trim(); if (!code) { addEditError.value = 'Please enter a barcode to lookup.'; return; }
  addEditLoading.value = true;
  try {
    const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/openfoodfacts-product?code=${encodeURIComponent(code)}`);
    if (!res.ok) { const txt = await res.text().catch(() => null); throw new Error(txt || 'Failed to lookup product'); }
    const data = await res.json(); if (data && data.product) { populateFromOFF(data.product); addEditSuccess.value = 'Imported from OpenFoodFacts'; } else { addEditError.value = 'No product found for that barcode.'; }
  } catch (err) { addEditError.value = err.message || 'Lookup failed'; } finally { addEditLoading.value = false; }
};

const saveFoodItem = async () => {
  addEditError.value = ''; addEditSuccess.value = ''; addEditLoading.value = true;
  try {
    const payload = {
      barcode_code: addEditForm.value.barcode_code,
      product_name: addEditForm.value.product_name,
      generic_name: addEditForm.value.generic_name,
      brand_name: addEditForm.value.brand_name,
      quantity: addEditForm.value.quantity,
      category_tags: (addEditForm.value.category_tags || '').split(',').map(s=>s.trim()).filter(Boolean),
      label_tags: (addEditForm.value.label_tags || '').split(',').map(s=>s.trim()).filter(Boolean),
      ingredients_text: addEditForm.value.ingredients_text,
      allergens: addEditForm.value.allergens,
      traces: addEditForm.value.traces,
      additives_tags: (addEditForm.value.additives_tags || '').split(',').map(s=>s.trim()).filter(Boolean),
      packaging: addEditForm.value.packaging,
      serving_size_text: addEditForm.value.serving_size_text,
      nutriscore_grade: addEditForm.value.nutriscore_grade,
      nova_group: addEditForm.value.nova_group,
      image_front_url: addEditForm.value.image_front_url,
      image_nutrition_url: addEditForm.value.image_nutrition_url,
      image_thumb_url: addEditForm.value.image_thumb_url,
      off_url: addEditForm.value.off_url,
      source: addEditForm.value.source,
      nutriments: addEditForm.value.nutriments,
    };
    const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/food-items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) { const txt = await res.text().catch(() => null); throw new Error(txt || 'Failed to save food item'); }
    addEditSuccess.value = 'Saved food item.';
  } catch (err) { addEditError.value = err.message || 'Save failed.'; } finally { addEditLoading.value = false; }
};

// --- New: favorites + edit handlers ---
const favoriteCodes = ref(new Set());

const getFoodCode = (food) => {
  return String(food?.code || food?._id || food?.id || '');
};
const isFavorited = (food) => {
  const c = getFoodCode(food);
  return c && favoriteCodes.value.has(c);
};
const toggleFavorite = (food) => {
  const c = getFoodCode(food);
  if (!c) return;
  if (favoriteCodes.value.has(c)) favoriteCodes.value.delete(c);
  else favoriteCodes.value.add(c);
  // ensure reactivity for Set changes
  favoriteCodes.value = new Set(favoriteCodes.value);
};

// --- New helpers to populate Add/Edit form from any food object ---
const getFirstString = (val) => {
  if (val === null || typeof val === 'undefined') return '';
  if (Array.isArray(val)) return val.join(', ');
  return String(val);
};
const getNutriment = (n, keys) => {
  if (!n) return '';
  for (const k of keys) {
    if (typeof n[k] !== 'undefined' && n[k] !== null) return n[k];
  }
  return '';
};

const fillAddEditFromFood = (food) => {
  resetAddEditForm();
  if (!food) return;
  addEditForm.value.barcode_code = getFirstString(food.code || food.barcode_code || food.id || food._id);
  addEditForm.value.product_name = getFirstString(food.product_name || food.name || food.product || '');
  addEditForm.value.generic_name = getFirstString(food.generic_name || '');
  addEditForm.value.brand_name = getFirstString(food.brands || (food.brands_tags && food.brands_tags.join(', ')) || food.brand_name || '');
  addEditForm.value.quantity = getFirstString(food.quantity || '');
  addEditForm.value.category_tags = Array.isArray(food.categories_tags) ? food.categories_tags.join(', ') : getFirstString(food.categories || food.category || '');
  addEditForm.value.label_tags = Array.isArray(food.labels_tags) ? food.labels_tags.join(', ') : getFirstString(food.labels || '');
  addEditForm.value.ingredients_text = getFirstString(food.ingredients_text || food.ingredients || '');
  addEditForm.value.allergens = getFirstString(food.allergens || '');
  addEditForm.value.traces = getFirstString(food.traces || '');
  addEditForm.value.additives_tags = Array.isArray(food.additives_tags) ? food.additives_tags.join(', ') : getFirstString(food.additives_tags || '');
  addEditForm.value.packaging = getFirstString(food.packaging || '');
  addEditForm.value.serving_size_text = getFirstString(food.serving_size || food.serving_size_text || '');
  addEditForm.value.nutriscore_grade = getFirstString(food.nutrition_grades || food.nutriscore_grade || '');
  addEditForm.value.nova_group = (typeof food.nova_group !== 'undefined') ? food.nova_group : null;
  addEditForm.value.image_front_url = getFirstString(food.image_front_url || food.image_front_thumb_url || food.image_small_url || food.image_url || '');
  addEditForm.value.image_nutrition_url = getFirstString(food.image_nutrition_url || '');
  addEditForm.value.image_thumb_url = getFirstString(food.image_thumb_url || food.image_small_url || '');
  addEditForm.value.off_url = getFirstString(food.off_url || food.url || '');
  addEditForm.value.source = getFirstString(food.source || (getFoodSource(food).toLowerCase() === 'external' ? 'openfoodfacts' : 'local'));
  addEditForm.value.last_modified_ts = food.last_modified_t ? new Date(Number(food.last_modified_t) * 1000).toISOString() : (food.last_modified_ts || '');

  const n = food.nutriments || food.nutrients || {};
  addEditForm.value.nutriments.energy_kcal_100g = getNutriment(n, ['energy-kcal_100g','energy-kcal','energy_kcal_100g','energy_kcal','energy']) || '';
  addEditForm.value.nutriments.fat_100g = getNutriment(n, ['fat_100g','fat']) || '';
  addEditForm.value.nutriments.saturated_fat_100g = getNutriment(n, ['saturated-fat_100g','saturated-fat','saturated_fat_100g','saturated_fat']) || '';
  addEditForm.value.nutriments.carbohydrates_100g = getNutriment(n, ['carbohydrates_100g','carbohydrates']) || '';
  addEditForm.value.nutriments.sugars_100g = getNutriment(n, ['sugars_100g','sugars']) || '';
  addEditForm.value.nutriments.fiber_100g = getNutriment(n, ['fiber_100g','fiber']) || '';
  addEditForm.value.nutriments.proteins_100g = getNutriment(n, ['proteins_100g','proteins']) || '';
  addEditForm.value.nutriments.salt_100g = getNutriment(n, ['salt_100g','salt']) || '';
  addEditForm.value.nutriments.sodium_100g = getNutriment(n, ['sodium_100g','sodium']) || '';
};

// Replace editFood to populate form and switch to Add/Edit tab
const editFood = async (food) => {
  fillAddEditFromFood(food);
  pageTab.value = 'addeditfood';
};
</script>



<template>

  <div class="container mt-8">
    <div class="panel">
      <div class="panel-header">
        <h4>Nutrition Log</h4>
      
      <div class="ms-3">
        SelectedDate: {{ selectedDate }}
      </div>

      <div class="ms-3">
        <DateDropDown v-model="selectedDateRaw" />
      </div>
      <!-- Show Filters toggle removed from here -->
    </div>

    <div class="panel-body">
      <div class="row">
        <div class="col-md-12">

          <div class="input-group mb-3">
            <!-- Top area: search input with Show Filters toggle moved here -->
            <div class="d-flex justify-content-between align-items-center mb-3 w-100">
              <!-- SHOW FILTERS: placed to the left of the search input as requested -->
              <div class="me-3 d-flex align-items-center">
                <label class="me-2 mb-0">Show Filters</label>
                <div class="form-check form-switch mb-0">
                  <input id="showFiltersSwitch" class="form-check-input toggle-red" type="checkbox" role="switch" v-model="showFilters" />
                </div>
              </div>

              <div class="input-group flex-grow-1">
                <input v-model="foodSearchQuery" @keyup.enter="searchFood" type="text" class="form-control" placeholder="Search foods (press Enter)" />
                <button class="btn btn-primary" type="button" @click="searchFood">Search</button>
              </div>
            </div>
          </div>

    <!-- Filters / categories / brands / labels tabs -->
    <CTabs v-if="showFilters" v-model="pageTab" :activeItemKey="pageTab">
      <CTabList variant="tabs">
        <CTab itemKey="FoodCategories"> Food Categories</CTab>
        <CTab itemKey="FoodBrands">Brands</CTab>
        <CTab itemKey="FoodLabels">Labels</CTab>
      </CTabList>
      
      <CTabContent>
        <CTabPanel class="p-3" itemKey="FoodCategories">
          <div class="mt-3">
          <label class="form-label">Search By Category:</label>
          <input v-model="categorySearch" type="text" class="form-control mb-2" placeholder="e.g. Beverages, Snacks" />
          <div class="border rounded p-2">
            <span class="fw-bold">Categories</span>
            <div class="filter-box">
              <ul class="list-group list-group-flush">
                <li v-for="cat in filteredCategories" :key="cat" role="button" class="list-group-item py-1 clickable" @click="selectCategory(cat)">{{ cat }}</li>
              </ul>
            </div>
          </div>
        </div>

        </CTabPanel>
        <CTabPanel class="p-3" itemKey="FoodBrands">
                <div class="mt-3">
          <label class="form-label">Search By Brand:</label>
          <input v-model="brandSearch" type="text" class="form-control mb-2" placeholder="Brand name" />
          <div class="border rounded p-2">
            <span class="fw-bold">Brand Names</span>
            <div class="filter-box">
              <ul class="list-group list-group-flush">
                <li v-for="brand in filteredBrands" :key="brand" role="button" class="list-group-item py-1 clickable" @click="selectBrand(brand)">{{ brand }}</li>
              </ul>
            </div>
          </div>
        </div>
        </CTabPanel>
        <CTabPanel class="p-3" itemKey="FoodLabels">
                <div class="mt-3">
          <label class="form-label">Search By Labels:</label>
          <input v-model="labelSearch" type="text" class="form-control mb-2" placeholder="e.g. Organic, Gluten-Free" />
          <div class="border rounded p-2">
            <span class="fw-bold">Labels</span>
            <div class="filter-box">
              <ul class="list-group list-group-flush">
                <li v-for="label in filteredLabels" :key="label" role="button" class="list-group-item py-1 clickable" @click="selectLabel(label)">{{ label }}</li>
              </ul>
            </div>
          </div></div>
        </CTabPanel>
      </CTabContent>

    </CTabs>

    <!-- Selected filters and clear button -->
    <div class="row my-3 align-items-center">
      <div class="col-md-8">
        <div v-if="selectedFilters.length > 0" class="selected-filters">
          <span v-for="chip in selectedFilters" :key="chip.type+chip.value" class="chip">
            <strong>{{ chip.type }}:</strong>&nbsp;{{ chip.value }}
            <span class="remove" @click="removeFilter(chip.type, chip.value)">&times;</span>
          </span>
        </div>
      </div>
      <div class="col-md-4 text-end">
        <button class="btn btn-secondary" @click="clearFilters">Clear Search</button>
      </div>
    </div>

    <!-- Page tabs: results / addedit / mynutrition -->
    <CTabs v-model="pageTab" :activeItemKey="pageTab">
      <CTabList variant="tabs">
        <CTab itemKey="results">Food Results</CTab>
        <CTab itemKey="addeditfood">Add/Edit Food</CTab>
        <CTab itemKey="mynutrition">My Nutrition Log</CTab>
        <CTab itemKey="mynutritionfav">My Favorite Foods</CTab>
      </CTabList>
      
      <CTabContent>
        <CTabPanel itemKey="results" class="p-3">


          <!-- Product detail view -->
          <div v-if="!ShowFoodSearch" class="mt-3">
            <button class="btn btn-link mb-3" @click="backToSearch">← Back to results</button>
            <div v-if="productLoading">Loading product...</div>
            <div v-else>
              <div v-if="productError" class="alert alert-danger">{{ productError }}</div>
              <div v-if="currentProduct && currentProduct.product">
                <div class="card">
                  <div class="card-body">
                    <h4>{{ currentProduct.product.product_name || currentProduct.product.name }}</h4>
                    <div class="row">
                      <div class="col-md-4 text-center">
                        <img :src="currentProduct.product.image_url || currentProduct.product.image_front_thumb_url" alt="product" style="max-width:100%;height:auto;" />
                      </div>
                      <div class="col-md-8">
                        <p><strong>Brands:</strong> {{ currentProduct.product.brands }}</p>
                        <p><strong>Quantity:</strong> {{ currentProduct.product.quantity }}</p>
                        <p><strong>Categories:</strong> {{ currentProduct.product.categories }}</p>
                        <p><strong>Labels:</strong> {{ currentProduct.product.labels }}</p>
                        <p><strong>Stores:</strong> {{ currentProduct.product.stores }}</p>
                        <p><strong>Countries where sold:</strong> {{ currentProduct.product.countries }}</p>
                        <p><strong>Barcode:</strong> {{ currentProduct.product.code }}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div v-if="productNutrients.length > 0" class="mt-4">
                  <h5>Nutrition facts</h5>
                  <div class="table-responsive">
                    <table class="table table-sm">
                      <thead>
                        <tr>
                          <th>Nutrient</th>
                          <th>Per 100 g / 100 ml</th>
                          <th>Per serving</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="row in productNutrients" :key="row.label">
                          <td>{{ row.label }}</td>
                          <td>{{ formatNutrient(row.per100, row.unit) }}</td>
                          <td>{{ formatNutrient(row.perServing, row.unit) }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Results gallery -->
          <div v-if="ShowFoodSearch && displayedFoods.length > 0">
            <h5>Results</h5>
            <div class="row gx-3 gy-4">
              <div v-for="food in displayedFoodsPaginated" :key="food.id || food._id || food.code" class="col-12 col-sm-6 col-lg-3">
                <div class="card h-100" style="position:relative;">
                  <div class="card-body d-flex flex-column clickable" @click="viewProduct(food)" style="cursor:pointer;">
                    <!-- header row: title on left, icons on right -->
                    <div class="d-flex w-100 align-items-start mb-2">
                      <div class="me-2">
                        <h6 class="card-title mb-0 text-start">{{ food.product_name }}</h6>
                      </div>
                      <div class="card-actions ms-auto">
                        <button class="btn btn-sm btn-outline-secondary action-btn bookmark-btn" :title="isFavorited(food) ? 'Unbookmark' : 'Bookmark'" @click.stop="toggleFavorite(food)">
                          <svg v-if="isFavorited(food)" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#e74c3c"><path d="M6 2h12v20l-6-3-6 3z"/></svg>
                          <svg v-else xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2h12v20l-6-3-6 3z"/></svg>
                        </button>
                        <button class="btn btn-sm btn-outline-secondary action-btn edit-btn" title="Edit" @click.stop="editFood(food)">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21v-3l11-11 3 3L6 21H3z"/><path d="M14 7l3 3"/></svg>
                        </button>
                        <button class="btn btn-sm btn-primary action-btn plus-btn" @click.stop="viewProduct(food)">+</button>
                      </div>
                    </div>
                    

                    

                    <img v-if="food.image_front_thumb_url" :src="food.image_front_thumb_url" alt="food image" class="food-thumb mb-2" />
                    <img v-else src="https://via.placeholder.com/144?text=No+Image" alt="no image" class="food-thumb mb-2" />
                    <div class="w-100 text-start">
                      <div class="small text-muted"><strong>Brand Name:</strong> {{ food.brands }}</div>
                      <div class="small text-muted"><strong>Category:</strong> {{ truncateCategory(getProductCategories(food)) }}</div>
                      <div class="small text-muted"><strong>Food Label:</strong> {{ getProductLabels(food) }}</div>
                      <!-- New: Source label -->
                      <div class="small text-muted"><strong>Source:</strong> {{ getFoodSource(food) }}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="text-center my-3">
              <button v-if="hasMoreFoods" class="btn btn-primary" @click="loadMoreFoods">Load More Foods</button>
            </div>
          </div>

          <div v-if="displayedFoods.length === 0 && foodSearchPerformed && !foodSearchLoading" class="text-center">
            <div class="p-4" style="text-align: left">
              <h5>Error</h5>
              <p>No Data found</p>
            </div>
          </div>
        </CTabPanel>

        <CTabPanel itemKey="addeditfood" class="p-3">
          <div class="p-3">
            <div class="row" style="padding-bottom:10px; margin-top:-10px;">
                <div class="d-flex gap-2">
                    <button class="btn btn-primary" :disabled="addEditLoading" @click="saveFoodItem">Save</button>
                    <button class="btn btn-secondary" type="button" @click="resetAddEditForm">Reset</button>
                  </div>
            </div>
            <div class="row">
             

              <div class="col-12 col-lg-6">
               
                <div class="panel">
                  <h5>Add / Edit Food</h5>

                  <div v-if="addEditLoading" class="alert alert-info">Working...</div>
                  <div v-if="addEditError" class="alert alert-danger">{{ addEditError }}</div>
                  <div v-if="addEditSuccess" class="alert alert-success">{{ addEditSuccess }}</div>

                  <div class="mb-3">
                    <label class="form-label">Barcode</label>
                    <div class="input-group">
                      <input v-model="addEditForm.barcode_code" type="text" class="form-control" placeholder="Enter barcode" />
                      <button class="btn btn-outline-primary" type="button" @click="lookupOFFByBarcode">Lookup</button>
                    </div>
                    <small class="text-muted">Lookup product data from OpenFoodFacts by barcode.</small>
                  </div>

                  <div class="mb-3">
                    <label class="form-label">Product Name</label>
                    <input v-model="addEditForm.product_name" type="text" class="form-control" />
                  </div>

                  <div class="mb-3">
                    <label class="form-label">Brand Name</label>
                    <input v-model="addEditForm.brand_name" type="text" class="form-control" />
                  </div>

                  <div class="mb-3">
                    <label class="form-label">Quantity</label>
                    <input v-model="addEditForm.quantity" type="text" class="form-control" />
                  </div>

                  <div class="mb-3">
                    <label class="form-label">Categories (comma separated)</label>
                    <input v-model="addEditForm.category_tags" type="text" class="form-control" />
                  </div>

                  <div class="mb-3">
                    <label class="form-label">Labels (comma separated)</label>
                    <input v-model="addEditForm.label_tags" type="text" class="form-control" />
                  </div>

                  <div class="mb-3">
                    <label class="form-label">Serving Size</label>
                    <input v-model="addEditForm.serving_size_text" type="text" class="form-control" />
                  </div>

                  <div class="mb-3">
                    <label class="form-label">NutriScore</label>
                    <input v-model="addEditForm.nutriscore_grade" type="text" class="form-control" />
                  </div>

                  <div class="mb-3">
                    <label class="form-label">Image URL (front)</label>
                    <input v-model="addEditForm.image_front_url" type="text" class="form-control" />
                  </div>

                  <div class="mb-3">
                    <label class="form-label">Image URL (nutrition)</label>
                    <input v-model="addEditForm.image_nutrition_url" type="text" class="form-control" />
                  </div>

                  <div class="mb-3">
                    <label class="form-label">Ingredients</label>
                    <textarea v-model="addEditForm.ingredients_text" rows="3" class="form-control"></textarea>
                  </div>

                  <div class="mb-3">
                    <label class="form-label">Allergens / Traces</label>
                    <input v-model="addEditForm.allergens" type="text" class="form-control mb-1" placeholder="Allergens (text)" />
                    <input v-model="addEditForm.traces" type="text" class="form-control" placeholder="Traces (text)" />
                  </div>

                  
                </div>
              </div>

              <div class="col-12 col-lg-6">
                <div class="panel">
                  <h5>Nutrition (per 100g)</h5>
                  <div class="row">
                    <div class="col-6 mb-2" v-for="(label, key) in {
                      'energy_kcal_100g':'Energy (kcal)',
                      'fat_100g':'Fat',
                      'saturated_fat_100g':'Saturated fat',
                      'carbohydrates_100g':'Carbohydrates',
                      'sugars_100g':'Sugars',
                      'fiber_100g':'Fiber',
                      'proteins_100g':'Proteins',
                      'salt_100g':'Salt',
                      'sodium_100g':'Sodium'
                    }">
                      <label class="form-label">{{ label }}</label>
                      <input v-model="addEditForm.nutriments[key]" type="text" class="form-control" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CTabPanel>

        <CTabPanel itemKey="mynutrition" class="p-3">
          <div class="p-4">
            <h5>My Nutrition Log</h5>
            <p>This is your nutrition log overview.</p>
          </div>
        </CTabPanel>

         <CTabPanel itemKey="mynutritionfav" class="p-3">
          <div class="p-4">
            <h5>My Favorite Foods</h5>
            <p>This is your list of favorite foods.</p>
          </div>
        </CTabPanel>
      </CTabContent>
    </CTabs>
  
  </div>
</div></div></div></div>






</template>



<style scoped>
/* Panel and container styles */
.panel {
  border: 1px solid #ddd;
  border-radius: 5px;
  padding: 15px;
}
.container-block {
  margin-top: 10px;
}

/* Tab nav styles (kept in sync with exercises.vue) */
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
  left: -20%;
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

/* Additional selectors to cover Bootstrap/CoreUI rendered markup */
.nav.nav-tabs{
  border: none;
  color: #fff;
  background: #272e38;
  border-radius: 0;
}
.nav.nav-tabs .nav-link,
.nav.nav-tabs .nav-link.active {
  border: none;
  padding: 18px 25px;
  color: #fff;
  background: #272e38;
  border-radius: 0;
}
.nav.nav-tabs .nav-link.active::after,
nav > div a.nav-item.nav-link.active:after {
  content: "";
  position: relative;
  bottom: -60px;
  left: -40%;
  border: 15px solid transparent;
  border-top-color: #e74c3c;
}
.nav.nav-tabs .nav-link:hover,
.nav.nav-tabs .nav-link:focus {
  background: #e74c3c;
  color: #fff;
  transition: background 0.2s linear;
}

/* CoreUI tab list wrapper selectors (fallback) */
.c-tabs .nav,
.c-tabs .nav-tabs {
  background: #272e38;
}
.c-tabs .nav .nav-link {
  color: #fff;
  padding: 14px 20px;
}
.c-tabs .nav .nav-link.active {
  background: #272e38;
}

/* Nutrition filter and list styles */
.fw-bold {
  padding: 5px !important;
}
.Nutrition-filter {
  display: block;
  margin-left: auto;
  margin-right: auto;
  margin-top: 10px;
  margin-bottom: 10px;
}
.filter-box {
  height: 140px;
  overflow-y: auto;
}

/* Selected filters chips styles */
.selected-filters {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #f1f8ff;
  border: 1px solid #cfe8ff;
  padding: 6px 10px;
  border-radius: 20px;
  font-size: 0.9rem;
}
.chip .remove {
  margin-left: 6px;
  cursor: pointer;
  font-weight: 600;
}

/* Food thumbnail: contain entire image and keep consistent size */
.food-thumb {
  width: 144px;
  height: 144px;
  object-fit: contain;
  border-radius: 6px;
  background: #fff;
  padding: 9px;
  box-shadow: 0 0 0 1px rgba(0,0,0,0.04) inset;
}
.nav-tabs{
  background-color: black;
  color:white;
}

/* plus overlay button on cards */
.plus-overlay{
  position: absolute;
  top: 8px;
  right: 8px;
  width: 32px;
  height: 32px;
}

/* Panel and container styles */
.panel {
  border: 1px solid #ddd;
  border-radius: 5px;
  padding: 15px;
}
.container-block {
  margin-top: 10px;
}

/* (normalized) tab styles already declared above */

.tab {
  overflow: hidden;
  border-bottom: 1px solid #ccc;
  background-color: #f1f1f1;
}
.tab .nav-link {
  background-color: inherit;
  float: left;
  border: none;
  padding: 14px 16px;
  font-size: 17px;
  cursor: pointer;
}
.tab .nav-link.active {
  background-color: #ccc;
}

/* Nutrition filter and list styles */
.fw-bold {
  padding: 5px !important;
}
.nutrition-filter {
  display: block;
  margin-left: auto;
  margin-right: auto;
  margin-top: 10px;
  margin-bottom: 10px;
}
.filter-box {
  height: 140px;
  overflow-y: auto;
}

/* red-styled bootstrap switch when checked */
.form-check-input.toggle-red:checked {
  background-color: #e74c3c;
  border-color: #e74c3c;
}
.form-check-input.toggle-red:focus {
  box-shadow: 0 0 0 0.25rem rgba(231,76,60,0.25);
}

/* action buttons group (bookmark + edit + plus) */
.card-actions{
  position: relative;
  display: inline-flex;
  gap: 6px;
  align-items: center;
}
.card-actions .action-btn{
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border-radius: 6px;
}
/* plus button now shares same sizing */
.card-actions .plus-btn{
  background-color: #0d6efd;
  color: #fff;
  border: none;
  padding: 0;
  width: 32px;
  height: 32px;
  border-radius: 6px;
}
/* ensure bookmark svg is visible and sized */
.card-actions .bookmark-btn svg {
  display: inline-block;
  width: 14px;
  height: 14px;
  color:red;
  vertical-align: middle;
}

/* remove absolute placement from previous plus-overlay rule */
.plus-overlay {
  /* no absolute positioning when used in header; kept for backward compatibility */
  position: static;
  width: 32px;
  height: 32px;
}
</style>