<script setup>
const props = defineProps({
  food: { type: Object, required: true },
  compact: { type: Boolean, default: false },
  isFavorite: { type: Boolean, default: false },
});

const emit = defineEmits(['add', 'edit', 'favorite', 'details']);

const fallbackImage = 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=600&auto=format&fit=crop&q=60';
</script>

<template>
  <article class="food-card panel-bg" :class="{ compact }">
    <img :src="food.image || fallbackImage" :alt="food.name" loading="lazy" />

    <div class="food-card__content">
      <h4>{{ food.name }}</h4>
      <p class="food-card__brand">{{ food.brand || 'No brand' }}</p>

      <div class="food-card__macros">
        <span>{{ food.calories || 0 }} kcal</span>
        <span>P {{ food.protein || 0 }}g</span>
        <span>C {{ food.carbs || 0 }}g</span>
        <span>F {{ food.fat || 0 }}g</span>
      </div>
    </div>

    <div class="food-card__actions">
      <button type="button" class="btn-add" @click="emit('add', food)">Add</button>
      <button type="button" @click="emit('edit', food)">Edit</button>
      <button type="button" @click="emit('favorite', food)">{{ isFavorite ? '★' : '☆' }}</button>
      <button type="button" @click="emit('details', food)">Details</button>
    </div>
  </article>
</template>

<style scoped>
.food-card {
  border: 1.5px solid var(--ff-border-soft, var(--border-color));
  border-radius: 14px;
  overflow: hidden;
  display: grid;
  grid-template-columns: 92px 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 10px;
}

.food-card.compact {
  grid-template-columns: 72px 1fr auto;
}

.food-card img {
  width: 100%;
  height: 82px;
  object-fit: cover;
  border-radius: 10px;
}

.food-card.compact img {
  height: 62px;
}

.food-card__content h4 {
  margin: 0;
  color: var(--text-color);
  font-size: 0.95rem;
  line-height: 1.3;
}

.food-card__brand {
  margin: 4px 0 0;
  color: var(--text-color-secondary);
  font-size: 0.78rem;
}

.food-card__macros {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.food-card__macros span {
  background: rgba(99, 102, 241, 0.15);
  color: #a5b4fc;
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 0.72rem;
  font-weight: 600;
}

.food-card__actions {
  display: grid;
  gap: 6px;
}

.food-card__actions button {
  border: 1.5px solid var(--ff-border-soft, var(--border-color));
  background: transparent;
  color: var(--text-color);
  border-radius: 8px;
  font-size: 0.76rem;
  font-weight: 600;
  padding: 6px 10px;
}

.food-card__actions .btn-add {
  border-color: #16a34a;
  color: #4ade80;
}

@media (max-width: 768px) {
  .food-card {
    grid-template-columns: 1fr;
  }

  .food-card img {
    height: 160px;
  }

  .food-card__actions {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
