<script setup>
import { defineProps, defineEmits, computed } from 'vue';
import DatePicker from "vue-datepicker-next";

// Props and emit
const props = defineProps(['modelValue']);
const emit = defineEmits(['update:modelValue']);

// 2-way computed binding to sync with parent
const date = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

// Shortcuts
const shortcuts = [
  {
    text: "Today",
    onClick: () => new Date(),
  },
  {
    text: "Yesterday",
    onClick: () => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return d;
    },
  },
  {
    text: "Last 7 Days (Start)",
    onClick: () => {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return d;
    },
  },
  {
    text: "This Month (1st)",
    onClick: () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  },
  {
    text: "This Year (Jan 1)",
    onClick: () => new Date(new Date().getFullYear(), 0, 1),
  },
];

// Date format
const formatter = {
  stringify: (date) => {
    const d = new Date(date);
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
  },
  parse: (str) => {
    const [month, day, year] = str.split("/").map(Number);
    return new Date(year, month - 1, day);
  },
};
</script>

<template>
  <div class="input-group dashboard-filter justify-content-end">
    <DatePicker
      v-model:value="date"
      :shortcuts="shortcuts"
      :formatter="formatter"
      placeholder="Select date"
      class="form-control full-datepicker"
    />
  </div>
</template>

<style scoped>
.full-datepicker {
  min-width: 350px;
  max-width: 600px;
  font-size: 14px;
}

:deep(.mx-datepicker-popup) {
  display: flex;
  width: auto !important;
  min-width: 400px;
}

:deep(.mx-datepicker-sidebar) {
  min-width: 300px;
  padding-right: 12px;
}

:deep(.mx-datepicker-content) {
  min-width: 300px;
}
</style>
