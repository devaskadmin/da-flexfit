<script setup>
import { ref } from "vue";
import DatePicker from "vue-datepicker-next";

// Reactive date range (default today)
const date = ref([new Date(), new Date()]);

// Custom formatter for d/m/yyyy
const formatter = {
  stringify: (value) => {
    if (Array.isArray(value)) {
      const [start, end] = value;
      const format = (d) =>
        `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
      return `${format(start)} - ${format(end)}`;
    } else {
      const d = new Date(value);
      return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
    }
  },
  parse: (str) => {
    const parts = str.split(" - ");
    const parseDate = (s) => {
      const [month, day, year] = s.split("/").map(Number);
      return new Date(year, month - 1, day);
    };
    return parts.length === 2 ? [parseDate(parts[0]), parseDate(parts[1])] : parseDate(str);
  }
};



// Range-based shortcuts
const shortcuts = [
  {
    text: "Today",
    onClick() {
      const today = new Date();
      return [today, today];
    },
  },
  {
    text: "Yesterday",
    onClick() {
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      return [yesterday, today];
    },
  },
  {
    text: "Last 7 Days",
    onClick() {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 6);
      return [start, end];
    },
  },
  {
    text: "This Week",
    onClick() {
      const start = new Date();
      start.setDate(start.getDate() - start.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return [start, end];
    },
  },
  {
    text: "This Month",
    onClick() {
      const end = new Date();
      const start = new Date(end.getFullYear(), end.getMonth(), 1);
      return [start, end];
    },
  },
  {
    text: "Last Month",
    onClick() {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return [start, end];
    },
  },
  {
    text: "This Year",
    onClick() {
      const end = new Date();
      const start = new Date(end.getFullYear(), 0, 1);
      return [start, end];
    },
  },
];
</script>

<template>
  <div class="input-group dashboard-filter justify-content-end">
    <DatePicker
      v-model:value="date"
      :shortcuts="shortcuts"
      :formatter="formatter"
      range
      placeholder="Select date range"
      class="form-control full-datepicker"
    />
  </div>
</template>

<style scoped lang="scss">
.full-datepicker {
  min-width: 350px;
  max-width: 600px;
  font-size: 14px;
}

/* Flex popup layout */
:deep(.mx-datepicker-popup) {
  display: flex;
  width: auto !important;
  min-width: 400px;
}

/* Sidebar and calendar width */
:deep(.mx-datepicker-sidebar) {
  min-width: 300px;
  padding-right: 12px;
}

:deep(.mx-datepicker-content) {
  min-width: 300px;
}

</style>
