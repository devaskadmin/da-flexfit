<script setup>
const props = defineProps({
  total: {
    type: Object,
    required: true,
  },
});
</script>

<template>
  <section class="macro-summary panel panel-bg">
    <div class="macro-summary__head">
      <h3>Daily Summary</h3>
    </div>

    <div class="macro-summary__grid">
      <article class="macro-calories">
        <span><span class="macro-emoji">🔥</span> Calories</span>
        <strong>{{ total.calories || 0 }}</strong>
      </article>
      <article class="macro-protein">
        <span><span class="macro-emoji">🥩</span> Protein</span>
        <strong>{{ total.protein || 0 }}g</strong>
      </article>
      <article class="macro-carbs">
        <span><span class="macro-emoji">🌾</span> Carbs</span>
        <strong>{{ total.carbs || 0 }}g</strong>
      </article>
      <article class="macro-fat">
        <span><span class="macro-emoji">🥑</span> Fat</span>
        <strong>{{ total.fat || 0 }}g</strong>
      </article>
    </div>
  </section>
</template>

<style scoped>
.macro-summary {
  border: 1.5px solid var(--ff-border-strong, var(--border-color));
  border-radius: 14px;
  padding: 14px;
}

.macro-summary__head h3 {
  margin: 0;
  color: var(--text-color);
  font-size: 1rem;
}

.macro-summary__head p {
  margin: 4px 0 0;
  color: var(--text-color-secondary);
  font-size: 0.82rem;
}

.macro-summary__grid {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.macro-summary__grid article {
  border: 1.5px solid var(--ff-border-soft, var(--border-color));
  border-radius: 10px;
  padding: 10px;
  display: grid;
  gap: 4px;
}

.macro-summary__grid span {
  color: var(--text-color-secondary);
  font-size: 0.75rem;
}

.macro-summary__grid strong {
  color: var(--text-color);
  font-size: 1.02rem;
}

/* ─────────────────────────────────────────────────────
   RESPONSIVE - 768px  (v0.81.10 compact summary)
───────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .macro-summary {
    padding: 10px;
    border-radius: 12px;
  }

  .macro-summary__head {
    margin-bottom: 6px;
  }

  .macro-summary__head h3 {
    font-size: 0.9rem;
  }

  .macro-summary__head p {
    display: none; /* hide subtitle on mobile to save space */
  }

  .macro-summary__grid {
    margin-top: 8px;
    gap: 8px;
  }

  .macro-summary__grid article {
    min-height: 72px;
    padding: 10px;
    border-radius: 12px;
    margin-bottom: 0;
  }

  .macro-summary__grid strong {
    font-size: 1.2rem;
    font-weight: 700;
  }

  .macro-summary__grid span {
    font-size: 0.8rem;
  }
}
</style>
