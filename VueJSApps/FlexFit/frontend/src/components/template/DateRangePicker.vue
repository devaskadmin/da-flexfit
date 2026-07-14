<script setup>
import { ref, watch } from "vue";
import DatePicker from "vue-datepicker-next";

const emit = defineEmits(['change']);

// Reactive date range (default today)
const date = ref([new Date(), new Date()]);

// Emit ISO date strings whenever range changes
watch(date, (val) => {
  if (Array.isArray(val) && val[0] && val[1]) {
    const fmt = (d) => d.toISOString().slice(0, 10);
    emit('change', [fmt(val[0]), fmt(val[1])]);
  }
});

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
      class="full-datepicker"
    />
  </div>
</template>

<style scoped lang="scss">
.input-group.dashboard-filter {
  background: transparent !important;
  border: 0 !important;
  padding: 0 !important;
}

.full-datepicker {
  width: min(100%, 600px);
  min-width: 0;
  max-width: 600px;
  font-size: 14px;
}

:deep(.mx-input),
:deep(.mx-icon-calendar),
:deep(.mx-icon-clear) {
  background: var(--wa-shell-surface-elevated, #131f31) !important;
  border: 1px solid var(--wa-shell-border, rgba(148, 163, 184, 0.2)) !important;
  color: var(--wa-shell-text, #e9f0fb) !important;
}

:deep(.mx-input::placeholder) {
  color: var(--wa-shell-text-muted, #9bacc2) !important;
}

:deep(.mx-datepicker-main),
:deep(.mx-datepicker-sidebar),
:deep(.mx-datepicker-content),
:deep(.mx-datepicker-popup) {
  background: var(--wa-shell-surface-elevated, #131f31) !important;
  border-color: var(--wa-shell-border, rgba(148, 163, 184, 0.2)) !important;
  color: var(--wa-shell-text, #e9f0fb) !important;
}

:deep(.mx-datepicker-sidebar) {
  border-right: 1px solid var(--wa-shell-divider, rgba(148, 163, 184, 0.16)) !important;
}

/* ── Mobile: full-width date picker ── */
@media (max-width: 768px) {
  .full-datepicker {
    min-width: 0 !important;
    width: 100% !important;
    max-width: 100% !important;
    font-size: 13px;
    box-sizing: border-box;
    overflow: hidden;
  }

  .input-group.dashboard-filter {
    width: 100% !important;
    max-width: 100% !important;
    overflow: hidden;
    box-sizing: border-box;
    justify-content: flex-start !important;
  }

  /* Actual input field */
  :deep(.mx-input-wrapper) {
    width: 100%;
    max-width: 100%;
    position: relative;
    box-sizing: border-box;
    overflow: hidden;
  }

  :deep(.mx-input) {
    width: 100% !important;
    max-width: 100% !important;
    height: 32px !important;
    line-height: 32px !important;
    padding-left: 10px !important;
    padding-right: 36px !important;
    font-size: 0.78rem !important;
    box-sizing: border-box !important;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Calendar icon — pin to right, do not clip */
  :deep(.mx-icon-calendar),
  :deep(.mx-icon-clear) {
    right: 8px !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    position: absolute !important;
    width: 20px !important;
    height: 20px !important;
    font-size: 14px !important;
    line-height: 1 !important;
  }
}

@media (max-width: 480px) {
  :deep(.mx-input) {
    height: 30px !important;
    line-height: 30px !important;
    font-size: 0.73rem !important;
    padding-left: 8px !important;
    padding-right: 32px !important;
  }

  :deep(.mx-icon-calendar),
  :deep(.mx-icon-clear) {
    right: 6px !important;
    font-size: 12px !important;
    width: 18px !important;
    height: 18px !important;
  }
}

@media (max-width: 390px) {
  :deep(.mx-input) {
    height: 28px !important;
    line-height: 28px !important;
    font-size: 0.69rem !important;
    padding-left: 7px !important;
    padding-right: 30px !important;
  }

  :deep(.mx-icon-calendar),
  :deep(.mx-icon-clear) {
    right: 5px !important;
    font-size: 11px !important;
    width: 16px !important;
    height: 16px !important;
  }
}

/* Flex popup layout */
:deep(.mx-datepicker-popup) {
  display: flex;
  width: auto !important;
  min-width: 400px;
}

@media (max-width: 768px) {
  :deep(.mx-datepicker-popup) {
    min-width: 0 !important;
    width: min(100vw - 24px, 100%) !important;
    max-width: 100vw !important;
  }

  :deep(.mx-datepicker-sidebar),
  :deep(.mx-datepicker-content) {
    min-width: 0 !important;
  }
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
