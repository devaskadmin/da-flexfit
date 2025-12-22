<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import DateDropDown from '@/components/DropDownDate.vue';
import 'bootstrap/dist/css/bootstrap.min.css';
import { CTabs, CTab, CTabContent, CTabPanel, CTabList } from '@coreui/vue';

/* =========================================================
   State
========================================================= */
// Search / Filters / Results
const foodSearchQuery = ref('');
const selectedStore = ref('');                // <-- NEW: store filter (text)
const foodSearchResults = ref([]);
const foodSearchLoading = ref(false);
const foodSearchError = ref('');
const foodSearchPerformed = ref(false);

// filter search boxes (left tabs)
const categorySearch = ref('');
const brandSearch = ref('');
const labelSearch = ref('');

// active filters (chips)
const categoryFilters = ref([]);
const brandFilters = ref([]);
const labelFilters = ref([]);

// Filter lists
const categories = ref([]);
const brands = ref([]);
const labels = ref([]);
const categoriesPage = ref(1);
const brandsPage = ref(1);
const labelsPage = ref(1);
const pageSize = 2000;

// Pagination for results
const foodPage = ref(1);
const resultsPerPage = ref(6);
const foodPageSize = ref(resultsPerPage.value);

// UI controls
const showFilters = ref(false);
const pageTab = ref('results');

// Product detail
const ShowFoodSearch = ref(true);
const currentProduct = ref(null);
const productLoading = ref(false);
const productError = ref('');

// Date
const selectedDateRaw = ref(new Date());
const selectedDate = computed(() => {
  const d = selectedDateRaw.value instanceof Date ? selectedDateRaw.value : new Date(selectedDateRaw.value);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${month}/${day}/${year}`;
});

// Debug
const debugFrontend = false;
const offApiUrl = ref(''); // populated from backend (if you choose to expose it)

/* =========================================================
   Helpers
========================================================= */
const sortByMostScanned = (products) => {
  return [...products].sort((a, b) => {
    const aScanned = a.unique_scans_n || 0;
    const bScanned = b.unique_scans_n || 0;
    if (bScanned !== aScanned) return bScanned - aScanned;
    return (a.product_name || '').localeCompare(b.product_name || '');
  });
};

// Replace "en:walmart" -> "walmart", "en:organic" -> "organic", etc.
const stripTagPrefix = (s) => String(s).replace(/^.*?:/, '');
const _formatField = (field) => {
  if (!field) return 'N/A';
  if (Array.isArray(field)) return field.map(f => stripTagPrefix(f).replace(/-/g, ' ')).join(', ');
  return stripTagPrefix(String(field)).replace(/-/g, ' ');
};

/* =========================================================
   Backend fetchers
========================================================= */
const fetchCategories = async () => {
  try {
    const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/openfoodfacts-get-category`);
    const data = await res.json();
    categories.value = Array.isArray(data) ? sortByMostScanned(data) : [];
  } catch { categories.value = []; }
};
const fetchBrands = async () => {
  try {
    const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/openfoodfacts-get-brandname`);
    const data = await res.json();
    brands.value = Array.isArray(data) ? sortByMostScanned(data) : [];
  } catch { brands.value = []; }
};
const fetchLabels = async () => {
  try {
    const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/openfoodfacts-get-labels`);
    const data = await res.json();
    labels.value = Array.isArray(data) ? sortByMostScanned(data) : [];
  } catch { labels.value = []; }
};

// Default fetch – quick “show something” list
const fetchAllFoods = async () => {
  foodSearchError.value = '';
  foodSearchLoading.value = true;
  foodSearchPerformed.value = false;
  foodSearchResults.value = [];
  offApiUrl.value = '';
  try {
    const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/openfoodfacts-search?query=${encodeURIComponent(foodSearchQuery.value || 'chicken')}`);
    if (!res.ok) {
      const txt = await res.text().catch(() => null);
      throw new Error(txt || 'Error loading Nutrition');
    }
    const data = await res.json();
    offApiUrl.value = data && data.request_url ? data.request_url : '';
    if (debugFrontend && offApiUrl.value) console.log('OpenFoodFacts Nutrition URL:', offApiUrl.value);
    // Sort by popularity
    foodSearchResults.value = Array.isArray(data.products) ? sortByMostScanned(data.products) : [];
    foodSearchPerformed.value = true;
  } catch (err) {
    foodSearchError.value = err.message || 'Error fetching foods.';
    foodSearchResults.value = [];
    foodSearchPerformed.value = true;
  } finally { foodSearchLoading.value = false; }
};

const searchFood = async () => {
  const hasAnyFilter =
    !!foodSearchQuery.value ||
    !!selectedStore.value ||
    categoryFilters.value.length ||
    brandFilters.value.length ||
    labelFilters.value.length;

  if (!hasAnyFilter) {
    await fetchAllFoods(); // fallback
    return;
  }

  foodSearchError.value = '';
  foodSearchLoading.value = true;
  foodSearchPerformed.value = false;
  foodSearchResults.value = [];
  foodPage.value = 1;
  offApiUrl.value = '';

  try {
    let url = `${import.meta.env.VITE_API_BASE}/api/openfoodfacts-search?`;
    const q = new URLSearchParams();
    if (foodSearchQuery.value) q.set('query', foodSearchQuery.value);
    if (selectedStore.value) q.set('store', selectedStore.value);
    url += q.toString();

    const res = await fetch(url);
    if (!res.ok) throw new Error(await res.text().catch(() => 'Error loading Nutrition data'));
    const data = await res.json();
    offApiUrl.value = data?.request_url || '';
    if (debugFrontend && offApiUrl.value) console.log('OpenFoodFacts Nutrition URL:', offApiUrl.value);

    // Always sort by popularity
    foodSearchResults.value = Array.isArray(data.products) ? sortByMostScanned(data.products) : [];
    foodSearchPerformed.value = true;
  } catch (err) {
    foodSearchError.value = err.message || 'Error searching food.';
    foodSearchResults.value = [];
    foodSearchPerformed.value = true;
  } finally {
    foodSearchLoading.value = false;
  }
};

onMounted(() => {
  selectedDateRaw.value = new Date();
  fetchCategories();
  fetchBrands();
  fetchLabels();
  fetchAllFoods();
});

/* =========================================================
   Filtered lists (left tabs)
========================================================= */
const filteredCategories = computed(() => {
  let list = Array.isArray(categories.value) ? categories.value : [];
  if (categorySearch.value) list = list.filter(c => c?.toLowerCase().includes(categorySearch.value.toLowerCase()));
  return list.slice(0, categoriesPage.value * pageSize);
});
const filteredBrands = computed(() => {
  let list = Array.isArray(brands.value) ? brands.value : [];
  if (brandSearch.value) list = list.filter(b => b?.toLowerCase().includes(brandSearch.value.toLowerCase()));
  return list.slice(0, brandsPage.value * pageSize);
});
const filteredLabels = computed(() => {
  let list = Array.isArray(labels.value) ? labels.value : [];
  if (labelSearch.value) list = list.filter(l => l?.toLowerCase().includes(labelSearch.value.toLowerCase()));
  return list.slice(0, labelsPage.value * pageSize);
});

watch(categorySearch, () => { categoriesPage.value = 1; });
watch(brandSearch,    () => { brandsPage.value = 1; });
watch(labelSearch,    () => { labelsPage.value = 1; });
watch(showFilters,    (v) => { if (v) pageTab.value = 'FoodCategories'; });

watch(pageTab, (v) => {
  console.log('pageTab changed:', v);
  console.log('Tab order:', {
    results: 'Food Results',
    addeditfood: 'Add/Edit Food',
    mynutrition: 'My Nutrition Log',
    mynutritionfav: 'My Favorite Foods'
  });
});

/* =========================================================
   Results filtering + pagination (client-side)
========================================================= */
const displayedFoods = computed(() => {
  const list = Array.isArray(foodSearchResults.value) ? foodSearchResults.value : [];
  const q = foodSearchQuery.value?.trim().toLowerCase();

  return list.filter(product => {
    // name filter
    if (q) {
      const name = (product.product_name || product.generic_name || '') + '';
      if (!name.toLowerCase().includes(q)) return false;
    }
    // category filter
    if (categoryFilters.value.length) {
      const catField = product.categories || product.categories_tags || product.category || '';
      const catString = Array.isArray(catField) ? catField.join(' ').toLowerCase() : String(catField || '').toLowerCase();
      if (!categoryFilters.value.some(f => catString.includes(String(f || '').toLowerCase()))) return false;
    }
    // brand filter
    if (brandFilters.value.length) {
      const brandField = product.brands || product.brands_tags || '';
      const brandString = Array.isArray(brandField) ? brandField.join(' ').toLowerCase() : String(brandField || '').toLowerCase();
      if (!brandFilters.value.some(f => brandString.includes(String(f || '').toLowerCase()))) return false;
    }
    // label filter
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
const hasMoreFoods = computed(() =>
  (displayedFoods.value.length || 0) > (displayedFoodsPaginated.value.length || 0)
);

// reset pagination whenever key filters change
watch(
  [() => categoryFilters.value.length, () => brandFilters.value.length, () => labelFilters.value.length, () => foodSearchQuery.value],
  () => { foodPage.value = 1; }
);
watch(resultsPerPage, (v) => { foodPageSize.value = Number(v) || 8; foodPage.value = 1; });

/* =========================================================
   Selected chips + handlers
========================================================= */
const selectedFilters = computed(() => {
  const arr = [];
  for (const v of categoryFilters.value || []) arr.push({ type: 'FoodCategories', value: v });
  for (const v of brandFilters.value || [])     arr.push({ type: 'FoodBrands',     value: v });
  for (const v of labelFilters.value || [])     arr.push({ type: 'FoodLabels',     value: v });
  if (selectedStore.value) arr.push({ type: 'Store', value: selectedStore.value }); // <-- show store chip
  return arr.slice(0, 8);
});

const removeFilter = (type, value) => {
  if (type === 'FoodCategories') categoryFilters.value = (categoryFilters.value || []).filter(x => x !== value);
  if (type === 'FoodBrands')     brandFilters.value    = (brandFilters.value    || []).filter(x => x !== value);
  if (type === 'FoodLabels')     labelFilters.value    = (labelFilters.value    || []).filter(x => x !== value);
  if (type === 'Store' && selectedStore.value === value) selectedStore.value = '';
};

const selectCategory = async (cat) => {
  if (!categoryFilters.value.includes(cat) && categoryFilters.value.length < 8) categoryFilters.value.push(cat);
  categoriesPage.value = 1;
  if (!foodSearchResults.value.length) await fetchAllFoods();
};
const selectBrand = async (b) => {
  if (!brandFilters.value.includes(b) && brandFilters.value.length < 8) brandFilters.value.push(b);
  brandsPage.value = 1;
  if (!foodSearchResults.value.length) await fetchAllFoods();
};
const selectLabel = async (l) => {
  if (!labelFilters.value.includes(l) && labelFilters.value.length < 8) labelFilters.value.push(l);
  labelsPage.value = 1;
  if (!foodSearchResults.value.length) await fetchAllFoods();
};

const clearFilters = async () => {
  foodSearchQuery.value = '';
  selectedStore.value = '';
  categorySearch.value = '';
  brandSearch.value = '';
  labelSearch.value = '';
  categoryFilters.value = [];
  brandFilters.value = [];
  labelFilters.value = [];
  categoriesPage.value = 1;
  brandsPage.value = 1;
  labelsPage.value = 1;
  foodPage.value = 1;
  await Promise.all([fetchCategories(), fetchBrands(), fetchLabels(), fetchAllFoods()]);
};

/* =========================================================
   Product details + nutrients
========================================================= */
const getProductCategories = (product) => {
  const field = product.categories || product.categories_tags || product.category || '';
  return _formatField(field);
};
const getProductLabels = (product) => {
  const field = product.labels || product.labels_tags || '';
  return _formatField(field);
};

// Determine item source (local vs OFF)
const getFoodSource = (food) => {
  if (!food) return 'Local';
  const src = String(food.source || '').toLowerCase();
  if (src && src !== 'local') return 'External';
  const url = String(food.off_url || food.url || '').toLowerCase();
  if (url.includes('openfoodfacts')) return 'External';
  if ((food.code || food.id) && !food._id) return 'External';
  return 'Local';
};

const truncateCategory = (catStr) => {
  if (!catStr) return catStr;
  try {
    const parts = catStr.split(',').map(p => p.trim()).filter(Boolean);
    return parts.length <= 3 ? parts.join(', ') : parts.slice(0, 3).join(', ') + '...';
  } catch { return catStr; }
};

const viewProduct = async (food) => {
  const code = food.code || food._id || food.id || (food.code_tags && food.code_tags[0]);
  if (!code) { currentProduct.value = { product: food }; ShowFoodSearch.value = false; return; }
  productLoading.value = true; productError.value = '';
  try {
    const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/openfoodfacts-product?code=${encodeURIComponent(code)}`);
    if (!res.ok) throw new Error(await res.text().catch(()=> 'Failed to load product'));
    const data = await res.json();
    currentProduct.value = data;
    ShowFoodSearch.value = false;
  } catch (err) {
    productError.value = err.message || 'Failed to load product';
    currentProduct.value = { product: food };
    ShowFoodSearch.value = false;
  } finally {
    productLoading.value = false;
  }
};
const backToSearch = () => { currentProduct.value = null; ShowFoodSearch.value = true; 
  pageTab.value = 'results';
  ShowFoodSearch.value = true;
  console.log(pageTab.value);
};

const backToResults = () => {
  pageTab.value = 'results';
  ShowFoodSearch.value = true;
  console.log(pageTab.value);
};

const productNutrients = computed(() => {
  const p = currentProduct.value?.product;
  if (!p || !p.nutriments) return [];
  const n = p.nutriments || {};
  const keys = [
    { key: 'energy-kcal', label: 'Energy (kcal)' },
    { key: 'fat',         label: 'Fat' },
    { key: 'saturated-fat', label: 'Saturated fat' },
    { key: 'carbohydrates', label: 'Carbohydrates' },
    { key: 'sugars',        label: 'Sugars' },
    { key: 'fiber',         label: 'Fiber' },
    { key: 'proteins',      label: 'Proteins' },
    { key: 'salt',          label: 'Salt' }
  ];
  return keys
    .map(k => {
      const per100 = n[`${k.key}_100g`] ?? n[`${k.key}_100ml`] ?? null;
      const perServing = n[`${k.key}_serving`] ?? null;
      const unit = n[`${k.key}_unit`] ?? n[`${k.key}_100g_unit`] ?? '';
      return { label: k.label, per100, perServing, unit };
    })
    .filter(r => r.per100 !== null || r.perServing !== null);
});

const formatNutrient = (val, unit) => {
  if (val === null || typeof val === 'undefined') return '-';
  return `${val}${unit ? ' ' + unit : ''}`;
};

const foodSearchErrorDisplay = computed(() => {
  const e = foodSearchError.value;
  if (!e) return '';
  try { JSON.parse(e); return 'Error loading nutrition'; } catch {
    const s = String(e).toLowerCase();
    if (s.includes('openfoodfacts') || s.includes('failed to fetch')) return 'Error loading nutrition';
    return e;
  }
});

/* =========================================================
   Add/Edit Food form (local save)
========================================================= */
const addEditForm = ref({
  barcode_code: '', product_name: '', generic_name: '', brand_name: '', quantity: '',
  category_tags: '', label_tags: '', ingredients_text: '', allergens: '', traces: '',
  additives_tags: '', packaging: '', serving_size_text: '', nutriscore_grade: '',
  nova_group: null, image_front_url: '', image_nutrition_url: '', image_thumb_url: '',
  off_url: '', source: 'openfoodfacts', last_modified_ts: '',
  nutriments: {
    energy_kcal_100g: '', fat_100g: '', saturated_fat_100g: '',
    carbohydrates_100g: '', sugars_100g: '', fiber_100g: '',
    proteins_100g: '', salt_100g: '', sodium_100g: ''
  }
});
const addEditLoading = ref(false);
const addEditError = ref('');
const addEditSuccess = ref('');

const resetAddEditForm = () => {
  addEditForm.value = {
    barcode_code: '', product_name: '', generic_name: '', brand_name: '', quantity: '',
    category_tags: '', label_tags: '', ingredients_text: '', allergens: '', traces: '',
    additives_tags: '', packaging: '', serving_size_text: '', nutriscore_grade: '',
    nova_group: null, image_front_url: '', image_nutrition_url: '', image_thumb_url: '',
    off_url: '', source: 'openfoodfacts', last_modified_ts: '',
    nutriments: {
      energy_kcal_100g: '', fat_100g: '', saturated_fat_100g: '',
      carbohydrates_100g: '', sugars_100g: '', fiber_100g: '',
      proteins_100g: '', salt_100g: '', sodium_100g: ''
    }
  };
  addEditError.value = ''; addEditSuccess.value = '';
};

const populateFromOFF = (product) => {
  if (!product) return;
  const n = product.nutriments || {};
  addEditForm.value.barcode_code = product.code || '';
  addEditForm.value.product_name = product.product_name || product.name || '';
  addEditForm.value.generic_name = product.generic_name || '';
  addEditForm.value.brand_name = product.brands || (product.brands_tags && product.brands_tags.join(', ')) || '';
  addEditForm.value.quantity = product.quantity || '';
  addEditForm.value.category_tags = Array.isArray(product.categories_tags) ? product.categories_tags.join(', ') : (product.categories || '');
  addEditForm.value.label_tags = Array.isArray(product.labels_tags) ? product.labels_tags.join(', ') : (product.labels || '');
  addEditForm.value.ingredients_text = product.ingredients_text || product.ingredients_text_debug || '';
  addEditForm.value.allergens = product.allergens || '';
  addEditForm.value.traces = product.traces || '';
  addEditForm.value.additives_tags = Array.isArray(product.additives_tags) ? product.additives_tags.join(', ') : '';
  addEditForm.value.packaging = product.packaging || '';
  addEditForm.value.serving_size_text = product.serving_size || '';
  addEditForm.value.nutriscore_grade = product.nutrition_grades || '';
  addEditForm.value.nova_group = product.nova_group || null;
  addEditForm.value.image_front_url = product.image_front_url || product.image_front_thumb_url || '';
  addEditForm.value.image_nutrition_url = product.image_nutrition_url || '';
  addEditForm.value.image_thumb_url = product.image_small_url || '';
  addEditForm.value.off_url = product.url || '';
  addEditForm.value.last_modified_ts = product.last_modified_t ? new Date(product.last_modified_t * 1000).toISOString() : '';
  addEditForm.value.nutriments.energy_kcal_100g = n['energy-kcal_100g'] ?? n['energy-kcal'] ?? '';
  addEditForm.value.nutriments.fat_100g = n['fat_100g'] ?? n['fat'] ?? '';
  addEditForm.value.nutriments.saturated_fat_100g = n['saturated-fat_100g'] ?? n['saturated-fat'] ?? '';
  addEditForm.value.nutriments.carbohydrates_100g = n['carbohydrates_100g'] ?? n['carbohydrates'] ?? '';
  addEditForm.value.nutriments.sugars_100g = n['sugars_100g'] ?? n['sugars'] ?? '';
  addEditForm.value.nutriments.fiber_100g = n['fiber_100g'] ?? n['fiber'] ?? '';
  addEditForm.value.nutriments.proteins_100g = n['proteins_100g'] ?? n['proteins'] ?? '';
  addEditForm.value.nutriments.salt_100g = n['salt_100g'] ?? n['salt'] ?? '';
  addEditForm.value.nutriments.sodium_100g = n['sodium_100g'] ?? n['sodium'] ?? '';
};

const lookupOFFByBarcode = async () => {
  addEditError.value = ''; addEditSuccess.value = '';
  const code = addEditForm.value.barcode_code?.trim();
  if (!code) { addEditError.value = 'Please enter a barcode to lookup.'; return; }
  addEditLoading.value = true;
  try {
    const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/openfoodfacts-product?code=${encodeURIComponent(code)}`);
    if (!res.ok) throw new Error(await res.text().catch(() => 'Failed to lookup product'));
    const data = await res.json();
    if (data?.product) { populateFromOFF(data.product); addEditSuccess.value = 'Imported from OpenFoodFacts'; }
    else { addEditError.value = 'No product found for that barcode.'; }
  } catch (err) {
    addEditError.value = err.message || 'Lookup failed';
  } finally {
    addEditLoading.value = false;
  }
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
    const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/food-items`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(await res.text().catch(() => 'Failed to save food item'));
    addEditSuccess.value = 'Saved food item.';
  } catch (err) { addEditError.value = err.message || 'Save failed.'; }
  finally { addEditLoading.value = false; }
};

/* =========================================================
   Favorites (client-only stub for now)
========================================================= */
const favoriteCodes = ref(new Set());
const getFoodCode = (food) => String(food?.code || food?._id || food?.id || '');
const isFavorited = (food) => {
  const c = getFoodCode(food);
  return c && favoriteCodes.value.has(c);
};
const toggleFavorite = (food) => {
  const c = getFoodCode(food);
  if (!c) return;
  if (favoriteCodes.value.has(c)) favoriteCodes.value.delete(c);
  else favoriteCodes.value.add(c);
  favoriteCodes.value = new Set(favoriteCodes.value); // force reactivity
};

// Fill Add/Edit from any product row
const getFirstString = (val) => (val == null ? '' : Array.isArray(val) ? val.join(', ') : String(val));
const getNutriment = (n, keys) => {
  if (!n) return '';
  for (const k of keys) if (n[k] != null) return n[k];
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
const editFood = async (food) => { fillAddEditFromFood(food); pageTab.value = 'addeditfood'; };

/* =========================================================
   Navigation
========================================================= */
const goToFavoritesTab = () => {
  pageTab.value = 'mynutritionfav';
  ShowFoodSearch.value = true;
  console.log(pageTab.value);
};


</script>

<template>


<!--End of BreadCrumb-->
  <div class="dashboard-breadcrumb mb-25">
    <h2>Nutrition Log</h2>
    <div>SelectedDate: {{ selectedDate }}</div>
        <DateDropDown v-model="selectedDateRaw" />
  </div>


  <div class="container mt-8">
    <div class="panel">
      <div class="panel-header d-flex align-items-center gap-3 flex-wrap">
        <h4 class="mb-0">Nutrition Log</h4>        
      </div>

      <div class="panel-body">

        <!-- Top Search Row -->
        <div class="row g-3 mb-3">
          <div class="d-flex justify-content-between align-items-center mb-3 w-100">
            <div class="input-group flex-grow-1">
              <input v-model="foodSearchQuery" @keyup.enter="searchFood" type="text" class="form-control" placeholder="Search foods by keyword (contains, e.g. bears, gummi bears)" />
              <button class="btn btn-primary ms-2" type="button" @click="searchFood">Search</button>
              <button class="btn btn-secondary ms-2" type="button" @click="clearFilters">Clear Search</button>
            </div>
          </div>
        </div>

        <!-- Filters tabs -->
        <CTabs v-if="showFilters" v-model="pageTab" :activeItemKey="pageTab">
          <CTabList variant="tabs">
            <CTab itemKey="FoodCategories">Food Categories</CTab>
            <CTab itemKey="FoodBrands">Brands</CTab>
            <CTab itemKey="FoodLabels">Labels</CTab>
          </CTabList>
          <CTabContent>
            <CTabPanel class="p-3" itemKey="FoodCategories">
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
            </CTabPanel>

            <CTabPanel class="p-3" itemKey="FoodBrands">
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
            </CTabPanel>

            <CTabPanel class="p-3" itemKey="FoodLabels">
              <label class="form-label">Search By Labels:</label>
              <input v-model="labelSearch" type="text" class="form-control mb-2" placeholder="e.g. Organic, Gluten-Free" />
              <div class="border rounded p-2">
                <span class="fw-bold">Labels</span>
                <div class="filter-box">
                  <ul class="list-group list-group-flush">
                    <li v-for="label in filteredLabels" :key="label" role="button" class="list-group-item py-1 clickable" @click="selectLabel(label)">{{ label }}</li>
                  </ul>
                </div>
              </div>
            </CTabPanel>
          </CTabContent>
        </CTabs>

        <!-- Selected filters and clear -->
        <div class="row my-3 align-items-center">
          <div class="col-md-8">
            <div v-if="selectedFilters.length" class="selected-filters">
              <span v-for="chip in selectedFilters" :key="chip.type + chip.value" class="chip">
                <strong>{{ chip.type }}:</strong>&nbsp;{{ chip.value }}
                <span class="remove" @click="removeFilter(chip.type, chip.value)">&times;</span>
              </span>
            </div>
          </div>
          
        </div>

        <!-- Tabs: Results / AddEdit / MyNutrition / Favorites -->
        <CTabs v-model="pageTab" :activeItemKey="pageTab">
          <CTabList variant="tabs">
            <CTab itemKey="results">Food Results</CTab>
            <CTab itemKey="addeditfood">Add/Edit Food</CTab>
            <CTab itemKey="mynutrition">My Nutrition Log</CTab>
            <CTab itemKey="mynutritionfav">My Favorite Foods</CTab>
          </CTabList>
          <CTabContent>
            <!-- Results -->
            <CTabPanel itemKey="results" class="p-3">
              <!-- Product detail view -->
               
              <div v-if="!ShowFoodSearch" class="mt-3">
                
                <div v-if="productLoading">Loading product...</div>
                <div v-else>
                  <div v-if="productError" class="alert alert-danger">{{ productError }}</div>
                  <div v-if="currentProduct?.product">
                    <div class="card">
                      <div class="card-body">
                        <h4>{{ currentProduct.product.product_name || currentProduct.product.name }}</h4>
                        <div class="row">
                          <div class="col-md-4 text-center">
                            
                            <img
  :src="food.image_front_thumb_url || food.image_small_url || food.image_front_url || 'https://via.placeholder.com/144?text=No+Image'"
  alt="food image"
  class="food-thumb mb-2"
/>
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

                    <div v-if="productNutrients.length" class="mt-4">
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
              <div v-if="ShowFoodSearch && displayedFoods.length">
                <h5>Results</h5>
                <div class="row gx-3 gy-4">
                  <div v-for="food in displayedFoodsPaginated" :key="food.id || food._id || food.code" class="col-12 col-sm-6 col-lg-4">
                    <div class="card h-100 clickable" style="position:relative; cursor:pointer;" @click="viewProduct(food)">
                      <div class="card-body d-flex flex-column">
                        <h6 class="card-title mb-0 text-start">{{ food.product_name }}</h6>
                        <div class="d-flex gap-2 mb-2" style="margin-top:10px">
                          <button class="btn btn-sm btn-outline-secondary action-btn bookmark-btn" title="Bookmark" @click.stop="goToFavoritesTab">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#e74c3c"><path d="M6 2h12v20l-6-3-6 3z"/></svg>
                          </button>
                          <button class="btn btn-sm btn-outline-secondary action-btn edit-btn" title="Edit" @click.stop="editFood(food)">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#0d6efd"><path d="M3 17.25V21h3.75l11.06-11.06-3.75-3.75L3 17.25zm14.71-12.04a1.003 1.003 0 0 1 0 1.42l-1.83 1.83-3.75-3.75 1.83-1.83a1.003 1.003 0 0 1 1.42 0l2.33 2.33z"/></svg>
                          </button>
                          <button class="btn btn-sm btn-outline-primary action-btn plus-btn" title="Add" @click.stop="pageTab = 'mynutrition'">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#198754"><path d="M12 5v14m7-7H5" stroke="#198754" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                          </button>
                        </div>
                        <img v-if="food.image_front_url" :src="food.image_front_url" alt="food image" class="food-thumb mb-2" />
                        <img v-else-if="food.image_small_url" :src="food.image_small_url" alt="food image" class="food-thumb mb-2" />
                        <img v-else src="https://via.placeholder.com/144?text=No+Image" alt="no image" class="food-thumb mb-2" />
                        <div class="w-100 text-start">
                          <div class="small text-muted"><strong>Brand Name:</strong> {{ food.brands }}</div>
                          <div class="small text-muted"><strong>Category:</strong> {{ truncateCategory(getProductCategories(food)) }}</div>
                          <div class="small text-muted"><strong>Food Label:</strong> {{ getProductLabels(food) }}</div>
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
                <div class="p-4 text-start">
                  <h5>{{ foodSearchErrorDisplay || 'No Data found' }}</h5>
                  <p v-if="!foodSearchErrorDisplay">Try a different search or clear filters.</p>
                </div>
              </div>
            </CTabPanel>

            <!-- Add/Edit -->
            <CTabPanel itemKey="addeditfood" class="p-3">
              <div class="p-3">
                <div class="row" style="padding-bottom:10px; margin-top:-10px;">
                  <button class="btn btn-link mb-3" @click="backToResults">← Back to results</button>
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
                        <div
                          class="col-6 mb-2"
                          v-for="(label, key) in {
                            'energy_kcal_100g':'Energy (kcal)',
                            'fat_100g':'Fat',
                            'saturated_fat_100g':'Saturated fat',
                            'carbohydrates_100g':'Carbohydrates',
                            'sugars_100g':'Sugars',
                            'fiber_100g':'Fiber',
                            'proteins_100g':'Proteins',
                            'salt_100g':'Salt',
                            'sodium_100g':'Sodium'
                          }"
                          :key="key"
                        >
                          <label class="form-label">{{ label }}</label>
                          <input v-model="addEditForm.nutriments[key]" type="text" class="form-control" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CTabPanel>

            <!-- My Nutrition -->
            <CTabPanel itemKey="mynutrition" class="p-3">
              <button class="btn btn-link mb-3" @click="backToSearch">← Back to results</button>
              <div class="p-4">
                <h5>My Nutrition Log</h5>
                <p>This is your nutrition log overview.</p>
              </div>
            </CTabPanel>

            <!-- Favorites -->
            <CTabPanel itemKey="mynutritionfav" class="p-3">
              <button class="btn btn-link mb-3" @click="backToSearch">← Back to results</button>
              <div class="p-4">
                <h5>My Favorite Foods</h5>
                <p>This is your list of favorite foods.</p>
              </div>
            </CTabPanel>
          </CTabContent>
        </CTabs>
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
.filter-box { height: 140px; overflow-y: auto; }
.selected-filters { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.chip {
  display: inline-flex; align-items: center; gap: 8px;
  background: #f1f8ff; border: 1px solid #cfe8ff;
  padding: 6px 10px; border-radius: 20px; font-size: 0.9rem;
}
.chip .remove { margin-left: 6px; cursor: pointer; font-weight: 600; }

/* Tabs look */
.nav.nav-tabs, .c-tabs .nav, .c-tabs .nav-tabs {
  background: #272e38; border: none; border-radius: 0;
}
.nav.nav-tabs .nav-link,
.nav.nav-tabs .nav-link.active,
.c-tabs .nav .nav-link,
.c-tabs .nav .nav-link.active {
  border: none; padding: 14px 20px; color: #fff; background: #272e38;
}
.nav.nav-tabs .nav-link.active::after {
  content: "";
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: -15px;
  border: 15px solid transparent;
  border-top-color: #e74c3c;
  margin-top: 0;
}
.c-tabs .nav .nav-link.active {
  position: relative;
}
.tab-content {
  background: #fdfdfd;
  line-height: 25px;
  border: 1px solid #ddd;
  border-top: 5px solid #e74c3c;
  border-bottom: 5px solid #e74c3c;
  padding: 30px 25px;
  margin-top: 0;
}

/* Toggle styling */
.form-check-input.toggle-red:checked { background-color: #e74c3c; border-color: #e74c3c; }
.form-check-input.toggle-red:focus { box-shadow: 0 0 0 0.25rem rgba(231,76,60,0.25); }

/* Cards */
.food-thumb {
  width: 180px; /* increased from 144px (25% larger) */
  height: 180px; /* increased from 144px */
  object-fit: contain;
  border-radius: 6px;
  background: #fff;
  padding: 9px;
  box-shadow: 0 0 0 1px rgba(0,0,0,0.04) inset;
  display: block;      /* make block so margin auto centers */
  margin: 0 auto 0.5rem; /* center images and keep small bottom gap */
}
.card-actions { display: inline-flex; gap: 6px; align-items: center; }
.card-actions .action-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; padding: 0; border-radius: 6px;
}
.card-actions .plus-btn { background-color: #0d6efd; color: #fff; border: none; }
.card-actions .bookmark-btn svg { width: 14px; height: 14px; }
</style>
