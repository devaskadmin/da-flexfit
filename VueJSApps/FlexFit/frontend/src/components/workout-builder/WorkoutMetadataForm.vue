<script setup>
const props = defineProps({
  metadata: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(['update:metadata']);

const updateField = (field, value) => {
  emit('update:metadata', {
    ...props.metadata,
    [field]: value,
  });
};
</script>

<template>
  <section class="builder-section">
    <div class="builder-section__head">
      <h3>Workout Details</h3>
      <p>Set the workout context before adding exercises.</p>
    </div>

    <div class="builder-grid">
      <label class="builder-field builder-field--wide">
        <span>Workout Name</span>
        <input
          :value="metadata.name"
          type="text"
          placeholder="e.g., Upper Body Power"
          @input="updateField('name', $event.target.value)"
        />
      </label>

      <label class="builder-field builder-field--wide">
        <span>Description</span>
        <textarea
          :value="metadata.description"
          rows="3"
          placeholder="Goal, pacing, or notes for this workout"
          @input="updateField('description', $event.target.value)"
        />
      </label>

      <label class="builder-field">
        <span>Workout Type</span>
        <select :value="metadata.type" @change="updateField('type', $event.target.value)">
          <option value="Strength">Strength</option>
          <option value="Cardio">Cardio</option>
          <option value="Hybrid">Hybrid</option>
          <option value="Mobility">Mobility</option>
        </select>
      </label>

      <label class="builder-field">
        <span>Estimated Duration (min)</span>
        <input
          :value="metadata.estimatedDuration"
          type="number"
          min="1"
          placeholder="45"
          @input="updateField('estimatedDuration', Number($event.target.value || 0))"
        />
      </label>
    </div>
  </section>
</template>

<style scoped>
.builder-section {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 18px;
}

.builder-section__head h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: #0f172a;
}

.builder-section__head p {
  margin: 5px 0 0;
  color: #64748b;
}

.builder-grid {
  margin-top: 14px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.builder-field {
  display: grid;
  gap: 6px;
}

.builder-field--wide {
  grid-column: span 2;
}

.builder-field span {
  font-size: 0.85rem;
  font-weight: 600;
  color: #334155;
}

.builder-field input,
.builder-field select,
.builder-field textarea {
  border: 1px solid #d1d5db;
  border-radius: 10px;
  background: #f8fafc;
  padding: 10px 12px;
  color: #0f172a;
}

.builder-field textarea {
  resize: vertical;
}

@media (max-width: 768px) {
  .builder-grid {
    grid-template-columns: 1fr;
  }

  .builder-field--wide {
    grid-column: span 1;
  }
}
</style>
