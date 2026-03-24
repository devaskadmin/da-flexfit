<script setup>
const props = defineProps({
  entries: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['remove']);
</script>

<template>
  <section class="log-list panel-bg">
    <header>
      <h3>My Nutrition Log</h3>
      <p>Track what you logged for the selected day.</p>
    </header>

    <div v-if="entries.length === 0" class="empty">
      No foods logged for this date yet.
    </div>

    <ul v-else>
      <li v-for="entry in entries" :key="entry.id">
        <div class="left">
          <strong>{{ entry.name }}</strong>
          <span>{{ entry.brand || 'No brand' }}</span>
          <small>
            {{ entry.calories || 0 }} kcal • P {{ entry.protein || 0 }}g • C {{ entry.carbs || 0 }}g • F {{ entry.fat || 0 }}g
          </small>
        </div>
        <button type="button" @click="emit('remove', entry.id)">Remove</button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.log-list {
  border: 1px solid var(--border-color);
  border-radius: 14px;
  padding: 14px;
}

.log-list header h3 {
  margin: 0;
  color: var(--text-color);
  font-size: 1rem;
}

.log-list header p {
  margin: 4px 0 0;
  color: var(--text-color-secondary);
  font-size: 0.82rem;
}

.log-list ul {
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 8px;
}

.log-list li {
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.left {
  display: grid;
  gap: 3px;
}

.left strong {
  color: var(--text-color);
  font-size: 0.9rem;
}

.left span,
.left small {
  color: var(--text-color-secondary);
}

.log-list button {
  border: 1px solid #fca5a5;
  color: #fca5a5;
  background: transparent;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 0.75rem;
}

.empty {
  margin-top: 12px;
  border: 1px dashed var(--border-color);
  border-radius: 10px;
  color: var(--text-color-secondary);
  padding: 14px;
  text-align: center;
}
</style>
