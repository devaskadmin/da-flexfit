<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'

const props = defineProps({
  metadata: {
    type: Object,
    required: true,
  },
  planTypeOptions: {
    type: Array,
    default: () => [],
  },
  categoryOptions: {
    type: Array,
    default: () => [
      'Weight Loss',
      'Strength',
      'Muscle Building',
      'Cardio',
      'General Fitness',
      'Beginner',
    ],
  },
  canEditPlanType: {
    type: Boolean,
    default: true,
  },
  planTypeDisplayLabel: {
    type: String,
    default: '',
  },
  showConvertPlanTypeButton: {
    type: Boolean,
    default: false,
  },
  convertPlanTypeDisabled: {
    type: Boolean,
    default: false,
  },
  convertPlanTypeLoading: {
    type: Boolean,
    default: false,
  },
  convertPlanTypeDisabledReason: {
    type: String,
    default: '',
  },
  goalOptions: {
    type: Array,
    default: () => [],
  },
  loadingGoals: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['update:metadata', 'create-goal', 'convert-plan-type']);

const visiblePlanTypeOptions = computed(() => {
  return (Array.isArray(props.planTypeOptions) ? props.planTypeOptions : [])
    .map((option) => ({
      value: String(option?.value || '').trim(),
      label: String(option?.label || '').trim(),
      disabled: Boolean(option?.disabled),
    }))
    .filter((option) => option.value && option.label);
});

const workoutGoalChips = [
  'Lose Weight',
  'Build Muscle',
  'Gain Strength',
  'Improve Endurance',
  'Stay in Shape',
  'Improve Mobility',
  'General Fitness',
  'Other',
];

const goalChipVariants = {
  'Lose Weight': 'green',
  'Build Muscle': 'blue',
  'Gain Strength': 'blue',
  'Improve Endurance': 'green',
  'Stay in Shape': 'green',
  'Improve Mobility': 'blue',
  'General Fitness': 'blue',
  Other: 'red',
};

const categoryOptionList = computed(() => {
  const currentValue = String(props.metadata?.category || '').trim();
  const availableOptions = Array.isArray(props.categoryOptions) && props.categoryOptions.length
    ? props.categoryOptions.map((option) => String(option || '').trim()).filter(Boolean)
    : [
        'Weight Loss',
        'Strength',
        'Muscle Building',
        'Cardio',
        'General Fitness',
        'Beginner',
      ];

  const merged = [...new Set([...availableOptions, ...(currentValue ? [currentValue] : [])])];
  return merged.filter(Boolean);
});

const selectedGoals = computed(() => (Array.isArray(props.metadata?.goals) ? props.metadata.goals : []));
const goalPickerOpen = ref(false);
const goalPickerDraftId = ref('');
const goalTagsMenuOpen = ref(false);
const goalTagsMenuOpenUp = ref(false);
const goalTagsMenuRef = ref(null);
const goalTagsTriggerRef = ref(null);
const goalTagOptionRefs = ref([]);
const goalTargetDateInput = ref(null);

const personalGoalOptions = computed(() => {
  const source = Array.isArray(props.goalOptions) ? props.goalOptions : [];
  return source.filter((option) => String(option?.value || '').trim() !== '');
});

const selectedPersonalGoalOption = computed(() => {
  const selectedGoalId = String(props.metadata?.goalId || '').trim();
  if (!selectedGoalId) return null;

  return personalGoalOptions.value.find((option) => String(option?.value || '').trim() === selectedGoalId) || null;
});

const selectedPersonalGoalDisplay = computed(() => {
  if (!selectedPersonalGoalOption.value) {
    return 'No Goal';
  }
  return String(selectedPersonalGoalOption.value?.displayName || selectedPersonalGoalOption.value?.label || 'Selected Goal').trim() || 'Selected Goal';
});

const selectedGoalsSummary = computed(() => {
  if (!selectedGoals.value.length) {
    return 'Select Goal Tags';
  }
  return selectedGoals.value.join(', ');
});

const formatGoalContextDate = (rawDate) => {
  const raw = String(rawDate || '').trim();
  if (!raw) return 'N/A';
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T00:00:00`)
    : new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const selectedGoalContext = computed(() => {
  const selectedGoalId = String(props.metadata?.goalId || '').trim();
  if (!selectedGoalId) return null;

  const selectedOption = (Array.isArray(props.goalOptions) ? props.goalOptions : [])
    .find((option) => String(option?.value || '').trim() === selectedGoalId);

  if (String(selectedOption?.goalType || '').trim() === 'exercise_weight') {
    return {
      exerciseName: String(selectedOption?.exerciseName || 'Exercise').trim() || 'Exercise',
      targetValue: Number(selectedOption?.targetValue || 0),
      targetUnit: String(selectedOption?.targetUnit || 'lb').trim() || 'lb',
      targetDate: String(selectedOption?.targetDate || '').trim(),
      status: 'active',
    };
  }

  const fallback = props.metadata?.goalContext;
  if (fallback && typeof fallback === 'object' && String(fallback?.goalType || '').trim() === 'exercise_weight') {
    return {
      exerciseName: String(fallback?.exerciseName || 'Exercise').trim() || 'Exercise',
      targetValue: Number(fallback?.targetValue || 0),
      targetUnit: String(fallback?.targetUnit || 'lb').trim() || 'lb',
      targetDate: String(fallback?.targetDate || '').trim(),
      status: String(fallback?.status || '').trim().toLowerCase(),
    };
  }

  return null;
});

const shouldShowPersonalGoalAssociation = computed(() => {
  const planType = String(props.metadata?.planType || '').trim().toLowerCase();
  return !['global', 'featured', 'community_shared'].includes(planType);
});

const hasObjectiveField = computed(() => Object.prototype.hasOwnProperty.call(props.metadata || {}, 'objective'));
const hasGoalField = computed(() => Object.prototype.hasOwnProperty.call(props.metadata || {}, 'goal'));

const updateMetadata = (patch) => {
  emit('update:metadata', {
    ...props.metadata,
    ...patch,
  });
};

const updateField = (field, value) => {
  updateMetadata({ [field]: value });
};

const triggerConvertPlanType = () => {
  emit('convert-plan-type');
};

const openGoalPicker = () => {
  goalPickerDraftId.value = String(props.metadata?.goalId || '').trim();
  goalPickerOpen.value = true;
};

const closeGoalPicker = () => {
  goalPickerOpen.value = false;
};

const selectGoalCandidate = (goalId) => {
  goalPickerDraftId.value = String(goalId || '').trim();
};

const applyGoalPickerSelection = () => {
  updateField('goalId', String(goalPickerDraftId.value || '').trim());
  closeGoalPicker();
};

const clearSelectedGoal = () => {
  updateField('goalId', '');
  closeGoalPicker();
};

const handleCreateGoalRequest = () => {
  emit('create-goal');
};

const openGoalTargetDatePicker = () => {
  const inputEl = goalTargetDateInput.value;
  if (!inputEl) return;

  inputEl.focus({ preventScroll: true });

  if (typeof inputEl.showPicker === 'function') {
    try {
      inputEl.showPicker();
      return;
    } catch {
      // Fallback for browsers that gate showPicker() behind transient user activation checks.
    }
  }

  inputEl.click();
};

const isGoalSelected = (goal) => selectedGoals.value.includes(goal);

const getGoalOptionToneClass = (goal) => {
  const variant = goalChipVariants[goal] || 'blue';
  return `goal-tag-select__option--${variant}`;
};

const toggleGoal = (goal) => {
  const nextGoals = new Set(selectedGoals.value);

  if (nextGoals.has(goal)) {
    nextGoals.delete(goal);
    const patch = { goals: Array.from(nextGoals) };
    if (goal === 'Other') {
      patch.otherGoal = '';
    }
    updateMetadata(patch);
    return;
  }

  nextGoals.add(goal);
  updateMetadata({ goals: Array.from(nextGoals) });
};

const setGoalOptionRef = (el, index) => {
  if (!el) return;
  goalTagOptionRefs.value[index] = el;
};

const focusGoalOption = (index) => {
  const bounded = Math.max(0, Math.min(workoutGoalChips.length - 1, index));
  nextTick(() => {
    goalTagOptionRefs.value[bounded]?.focus();
  });
};

const updateGoalTagsMenuPlacement = () => {
  const host = goalTagsMenuRef.value;
  if (!host) return;

  const rect = host.getBoundingClientRect();
  const availableBelow = window.innerHeight - rect.bottom;
  const availableAbove = rect.top;
  goalTagsMenuOpenUp.value = availableBelow < 220 && availableAbove > availableBelow;
};

const openGoalTagsMenu = async () => {
  updateGoalTagsMenuPlacement();
  goalTagsMenuOpen.value = true;

  const firstSelected = workoutGoalChips.findIndex((goal) => isGoalSelected(goal));
  focusGoalOption(firstSelected >= 0 ? firstSelected : 0);
};

const closeGoalTagsMenu = (restoreFocus = false) => {
  goalTagsMenuOpen.value = false;
  if (restoreFocus) {
    nextTick(() => {
      goalTagsTriggerRef.value?.focus();
    });
  }
};

const toggleGoalTagsMenu = () => {
  if (goalTagsMenuOpen.value) {
    closeGoalTagsMenu(true);
    return;
  }
  openGoalTagsMenu();
};

const handleGoalTagsTriggerKeydown = (event) => {
  if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    if (!goalTagsMenuOpen.value) {
      openGoalTagsMenu();
    } else {
      focusGoalOption(0);
    }
  }

  if (event.key === 'Escape' && goalTagsMenuOpen.value) {
    event.preventDefault();
    closeGoalTagsMenu(true);
  }
};

const handleGoalTagsMenuKeydown = (event) => {
  const currentIndex = workoutGoalChips.findIndex((goal, index) => goalTagOptionRefs.value[index] === document.activeElement);

  if (event.key === 'Escape') {
    event.preventDefault();
    closeGoalTagsMenu(true);
    return;
  }

  if (event.key === 'Tab') {
    closeGoalTagsMenu(false);
    return;
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    focusGoalOption(currentIndex < 0 ? 0 : Math.min(workoutGoalChips.length - 1, currentIndex + 1));
    return;
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault();
    focusGoalOption(currentIndex <= 0 ? 0 : currentIndex - 1);
    return;
  }

  if (event.key === 'Home') {
    event.preventDefault();
    focusGoalOption(0);
    return;
  }

  if (event.key === 'End') {
    event.preventDefault();
    focusGoalOption(workoutGoalChips.length - 1);
  }
};

const onDocumentPointerDown = (event) => {
  if (!goalTagsMenuOpen.value) return;
  const host = goalTagsMenuRef.value;
  if (host && !host.contains(event.target)) {
    closeGoalTagsMenu(false);
  }
};

const onDocumentKeydown = (event) => {
  if (event.key === 'Escape' && goalPickerOpen.value) {
    event.preventDefault();
    closeGoalPicker();
    return;
  }

  if (event.key === 'Escape' && goalTagsMenuOpen.value) {
    event.preventDefault();
    closeGoalTagsMenu(true);
  }
};

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown);
  document.addEventListener('keydown', onDocumentKeydown);
  window.addEventListener('resize', updateGoalTagsMenuPlacement);
});

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown);
  document.removeEventListener('keydown', onDocumentKeydown);
  window.removeEventListener('resize', updateGoalTagsMenuPlacement);
});

</script>

<template>
  <div class="builder-metadata-layout">
    <div class="builder-grid">
      <div class="metadata-section metadata-section--plan-info">
        <div class="metadata-section__header">Workout Plan Information</div>
        <div class="metadata-section__body">
          <slot name="plan-cover" />

          <label class="builder-field builder-field--row">
            <span>Plan Name <span class="label-required-star" aria-hidden="true">*</span></span>
            <input
              :value="metadata.name"
              type="text"
              placeholder="e.g., Upper Body Power"
              @input="updateField('name', $event.target.value)"
            />
          </label>

          <label v-if="visiblePlanTypeOptions.length" class="builder-field builder-field--row">
            <span>Workout Plan Type <span class="label-required-star" aria-hidden="true">*</span></span>
            <select
              v-if="canEditPlanType"
              :value="metadata.planType || ''"
              @change="updateField('planType', $event.target.value)"
            >
              <option
                v-for="option in visiblePlanTypeOptions"
                :key="`plan-type-${option.value}`"
                :value="option.value"
                :disabled="option.disabled"
              >
                {{ option.label }}
              </option>
            </select>
            <div v-else class="plan-type-readonly-row">
              <span class="plan-type-readonly-row__label">{{ planTypeDisplayLabel || 'Unknown' }}</span>
              <button
                v-if="showConvertPlanTypeButton"
                type="button"
                class="goal-selector-inline__btn goal-selector-inline__btn--select wa-btn--blue plan-type-readonly-row__button"
                :disabled="convertPlanTypeDisabled || convertPlanTypeLoading"
                :title="convertPlanTypeDisabled && convertPlanTypeDisabledReason ? convertPlanTypeDisabledReason : ''"
                @click="triggerConvertPlanType"
              >
                {{ convertPlanTypeLoading ? 'Loading...' : 'Convert to Another Plan Type' }}
              </button>
              <small
                v-if="showConvertPlanTypeButton && convertPlanTypeDisabled && convertPlanTypeDisabledReason"
                class="plan-type-readonly-row__help"
              >
                {{ convertPlanTypeDisabledReason }}
              </small>
            </div>
          </label>

          <div class="plan-info-two-col" role="group" aria-label="Plan Information detail fields">
            <label class="builder-field builder-field--row">
              <span>Workout Type <span class="label-required-star" aria-hidden="true">*</span></span>
              <select :value="metadata.type" @change="updateField('type', $event.target.value)">
                <option value="Strength">Strength</option>
                <option value="Cardio">Cardio</option>
                <option value="Hybrid">Hybrid</option>
                <option value="Mobility">Mobility</option>
              </select>
            </label>

            <label class="builder-field builder-field--row">
              <span>Goal Category <span class="label-required-star" aria-hidden="true">*</span></span>
              <select :value="String(metadata.category || '')" @change="updateField('category', $event.target.value)">
                <option value="">Select a category</option>
                <option v-for="option in categoryOptionList" :key="`category-${option}`" :value="option">
                  {{ option }}
                </option>
              </select>
            </label>

            <label class="builder-field builder-field--duration builder-field--row">
              <span>Est. Session Time</span>
              <input
                :value="metadata.estimatedDuration"
                type="number"
                min="1"
                placeholder="45"
                @input="updateField('estimatedDuration', Number($event.target.value || 0))"
              />
            </label>

            <label class="builder-field builder-field--row">
              <span>Plan Duration (Weeks)</span>
              <input
                :value="metadata.planDurationWeeks == null || metadata.planDurationWeeks === undefined || metadata.planDurationWeeks === '' ? '' : Number(metadata.planDurationWeeks)"
                type="number"
                min="1"
                step="1"
                inputmode="numeric"
                placeholder="e.g. 8"
                @input="updateField('planDurationWeeks', $event.target.value === '' ? null : Number($event.target.value))"
              />
            </label>
          </div>

          <label class="builder-field builder-field--wide">
            <span>Description</span>
            <textarea
              :value="metadata.description"
              rows="2"
              placeholder="Overview of this workout plan"
              @input="updateField('description', $event.target.value)"
            />
          </label>
        </div>
      </div>

      <div class="metadata-section metadata-section--goals">
        <div class="metadata-section__header">Objectives &amp; Goals</div>
        <div class="metadata-section__body">
          <div v-if="hasObjectiveField || hasGoalField" class="goal-info-two-col" role="group" aria-label="Objective and goal fields">
            <label v-if="hasObjectiveField" class="builder-field builder-field--row">
              <span>Objective</span>
              <input
                :value="metadata.objective || ''"
                type="text"
                placeholder="Plan objective"
                @input="updateField('objective', $event.target.value)"
              />
            </label>

            <label v-if="hasGoalField" class="builder-field builder-field--row">
              <span>Goal</span>
              <input
                :value="metadata.goal || ''"
                type="text"
                placeholder="Plan goal"
                @input="updateField('goal', $event.target.value)"
              />
            </label>
          </div>

          <label v-if="shouldShowPersonalGoalAssociation" class="builder-field builder-field--row">
            <span>Goal</span>
            <div class="goal-selector-inline">
              <input
                :value="selectedPersonalGoalDisplay"
                class="goal-selector-inline__selected"
                type="text"
                readonly
                aria-label="Selected personal goal"
              />
              <button
                type="button"
                class="goal-selector-inline__btn goal-selector-inline__btn--select wa-btn--blue"
                :disabled="loadingGoals"
                @click="openGoalPicker"
              >
                Select Goal
              </button>
              <button
                type="button"
                class="goal-selector-inline__btn goal-selector-inline__btn--new wa-btn--green"
                @click="handleCreateGoalRequest"
              >
                + New Goal
              </button>
            </div>
            <small class="builder-field__hint">
              {{ loadingGoals ? 'Loading active goals...' : 'Manage goal details in Profile > My Goals.' }}
            </small>
            <div v-if="selectedGoalContext" class="goal-context-note" role="note" aria-live="polite">
              <strong>Exercise Goal Context:</strong>
              {{ selectedGoalContext.exerciseName }} target {{ selectedGoalContext.targetValue }} {{ selectedGoalContext.targetUnit }} by {{ formatGoalContextDate(selectedGoalContext.targetDate) }}.
              <span v-if="selectedGoalContext.status === 'archived'"> This linked goal is archived.</span>
              <span class="goal-context-note__subtle"> This does not modify per-exercise Target Weight values in the schedule.</span>
            </div>
          </label>

          <div v-if="goalPickerOpen" class="goal-picker-modal" role="dialog" aria-modal="true" aria-label="Select personal goal">
            <button type="button" class="goal-picker-modal__backdrop" aria-label="Close goal selector" @click="closeGoalPicker"></button>
            <div class="goal-picker-modal__panel">
              <div class="goal-picker-modal__header">
                <h4>Select Personal Goal</h4>
                <button type="button" class="goal-picker-modal__close" aria-label="Close" @click="closeGoalPicker">✕</button>
              </div>

              <div class="goal-picker-modal__list" role="listbox" aria-label="Personal goals">
                <button
                  type="button"
                  class="goal-picker-row"
                  :class="{ 'goal-picker-row--selected': goalPickerDraftId === '' }"
                  role="option"
                  :aria-selected="goalPickerDraftId === '' ? 'true' : 'false'"
                  @click="selectGoalCandidate('')"
                >
                  <div class="goal-picker-row__name">No Goal</div>
                  <div class="goal-picker-row__date">Clear selected goal</div>
                </button>

                <button
                  v-for="option in personalGoalOptions"
                  :key="`goal-picker-${String(option.value)}`"
                  type="button"
                  class="goal-picker-row"
                  :class="{ 'goal-picker-row--selected': goalPickerDraftId === String(option.value || '').trim() }"
                  role="option"
                  :aria-selected="goalPickerDraftId === String(option.value || '').trim() ? 'true' : 'false'"
                  @click="selectGoalCandidate(String(option.value || ''))"
                >
                  <div class="goal-picker-row__name">{{ option.displayName || option.label }}</div>
                  <div class="goal-picker-row__date">Target Date: {{ option.targetDateLabel || 'N/A' }}</div>
                </button>
              </div>

              <div class="goal-picker-modal__actions">
                <button type="button" class="goal-picker-modal__action goal-picker-modal__action--cancel" @click="closeGoalPicker">Cancel</button>
                <button type="button" class="goal-picker-modal__action goal-picker-modal__action--clear" @click="clearSelectedGoal">No Goal</button>
                <button type="button" class="goal-picker-modal__action goal-picker-modal__action--select" @click="applyGoalPickerSelection">Select</button>
              </div>
            </div>
          </div>

          <div class="goals-grid" role="group" aria-label="Goal tags and target date">
            <label class="builder-field builder-field--row builder-field--goal-date">
              <span>Plan Goal Target Date</span>
              <div class="goal-date-input-wrap">
                <input
                  ref="goalTargetDateInput"
                  :value="metadata.goalTargetDate || ''"
                  type="date"
                  @input="updateField('goalTargetDate', $event.target.value ? $event.target.value : null)"
                />
                <span class="goal-date-visual-icon" aria-hidden="true" @click="openGoalTargetDatePicker"></span>
              </div>
            </label>

            <div ref="goalTagsMenuRef" class="builder-field builder-field--wide builder-field--goals">
              <span>Goal Tags</span>
              <div class="goal-tag-select" @keydown="handleGoalTagsMenuKeydown">
                <button
                  ref="goalTagsTriggerRef"
                  type="button"
                  class="goal-tag-select__trigger"
                  aria-haspopup="listbox"
                  :aria-expanded="goalTagsMenuOpen ? 'true' : 'false'"
                  aria-label="Goal Tags multi-select"
                  @click="toggleGoalTagsMenu"
                  @keydown="handleGoalTagsTriggerKeydown"
                >
                  <span class="goal-tag-select__summary">{{ selectedGoalsSummary }}</span>
                  <span class="goal-tag-select__chevron" aria-hidden="true">▾</span>
                </button>

                <div
                  v-if="goalTagsMenuOpen"
                  class="goal-tag-select__menu"
                  :class="{ 'goal-tag-select__menu--up': goalTagsMenuOpenUp }"
                  role="listbox"
                  aria-multiselectable="true"
                  aria-label="Goal Tags options"
                >
                  <button
                    v-for="(goal, goalIndex) in workoutGoalChips"
                    :key="goal"
                    :ref="(el) => setGoalOptionRef(el, goalIndex)"
                    type="button"
                    class="goal-tag-select__option"
                    :class="[getGoalOptionToneClass(goal), { 'goal-tag-select__option--selected': isGoalSelected(goal) }]"
                    role="option"
                    :aria-selected="isGoalSelected(goal) ? 'true' : 'false'"
                    @click="toggleGoal(goal)"
                  >
                    <span class="goal-tag-select__check" aria-hidden="true">{{ isGoalSelected(goal) ? '✓' : '' }}</span>
                    <span>{{ goal }}</span>
                  </button>
                </div>
              </div>
              <label v-if="isGoalSelected('Other')" class="builder-field builder-field--other-goal">
                <span class="builder-field__hint">Optional: specify another goal</span>
                <input
                  :value="metadata.otherGoal || ''"
                  type="text"
                  placeholder="Enter another goal"
                  @input="updateField('otherGoal', $event.target.value)"
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.builder-metadata-layout {
  display: grid;
  gap: 10px;
  width: 100%;
  min-width: 0;
  overflow: visible;
}

.builder-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  min-width: 0;
}

.metadata-section {
  display: grid;
  gap: 6px;
  padding-top: 8px;
  border-top: 1px solid rgba(150, 180, 220, 0.26);
}

.metadata-section:first-child {
  border-top: 0;
  padding-top: 0;
}

.metadata-section__header {
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #b7cde8;
  line-height: 1.25;
  padding-bottom: 2px;
}

.metadata-section--plan-info .metadata-section__header {
  color: #9bd2ff;
}

.metadata-section--goals .metadata-section__header {
  color: #f59e0b;
}

.metadata-section__body {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.builder-field-group--meta-row {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(180px, 0.7fr);
  gap: 10px;
  min-width: 0;
}

.plan-info-two-col {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  min-width: 0;
}

.goal-info-two-col {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.goals-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.plan-info-two-col > .builder-field--row {
  grid-column: auto;
}

.builder-field {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.builder-field--row,
.builder-field--wide,
.builder-field--goal-date,
.builder-field--goals {
  grid-column: 1 / -1;
  grid-template-columns: 1fr;
  row-gap: 4px;
  align-items: start;
}

.builder-inline-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: end;
}

.builder-field--duration {
  width: 100%;
}

.builder-field span {
  font-size: 0.72rem;
  font-weight: 700;
  color: #dfeaf9;
  line-height: 1.3;
}

.label-required-star {
  color: #ef4444;
  font-weight: 800;
}

.builder-field--row > span,
.builder-field--wide > span,
.builder-field--goal-date > span,
.builder-field--goals > span {
  margin: 0;
  align-self: start;
}

.builder-field--row > input,
.builder-field--row > select,
.builder-field--row > textarea,
.builder-field--wide > textarea,
.builder-field--wide > input,
.builder-field--wide > select,
.builder-field--goal-date > input,
.builder-field--goal-date > select,
.builder-field--goals > .goal-tag-select {
  grid-column: 1;
  width: 100%;
  min-width: 0;
}

.builder-field--row > .builder-field__hint,
.builder-field--row > .goal-context-note,
.builder-field--wide > .builder-field__hint,
.builder-field--wide > .goal-context-note,
.builder-field--goal-date > .builder-field__hint,
.builder-field--goal-date > .goal-context-note,
.builder-field--goals > .builder-field__hint,
.builder-field--goals > .goal-context-note {
  grid-column: 1;
  margin-top: 1px;
}

.builder-field__hint {
  font-size: 0.68rem;
  color: #9bb4d0;
  line-height: 1.25;
}

.goal-context-note {
  margin-top: 4px;
  border: 1px solid rgba(147, 197, 253, 0.45);
  background: rgba(14, 48, 78, 0.7);
  color: #dfeeff;
  border-radius: 6px;
  padding: 7px 9px;
  font-size: 0.74rem;
  line-height: 1.35;
}

.goal-context-note__subtle {
  display: block;
  margin-top: 2px;
  color: #b8d9ff;
}

.builder-field input,
.builder-field select,
.builder-field textarea {
  width: 100%;
  border: 1px solid rgba(148, 163, 184, 0.5);
  border-radius: 6px;
  background: linear-gradient(180deg, rgba(15, 28, 46, 0.9), rgba(11, 22, 34, 0.92));
  min-height: 34px;
  padding: 6px 10px;
  color: #ecf6ff;
  font-size: 0.84rem;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.08);
}

.builder-field input::placeholder,
.builder-field textarea::placeholder {
  color: rgba(191, 218, 255, 0.7);
}

.builder-field input:focus,
.builder-field select:focus,
.builder-field textarea:focus {
  outline: none;
  border-color: #60a5fa;
  box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.18);
  background: rgba(11, 22, 34, 0.96);
}

.builder-field input[type='date'] {
  color-scheme: dark;
  cursor: pointer;
}

.builder-field input[type='date']::-webkit-calendar-picker-indicator {
  position: absolute;
  top: 0;
  right: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  display: none !important;
  opacity: 0 !important;
  cursor: pointer;
  background: transparent;
  -webkit-filter: none !important;
  filter: none !important;
}

.builder-field--goal-date input[type='date'] {
  padding-right: 40px;
  position: relative;
}

.builder-field--goal-date input[type='date']::-webkit-calendar-picker-indicator {
  position: absolute;
  top: 0;
  right: 0;
  width: 44px;
  height: 100%;
  margin: 0;
  padding: 0;
  display: block !important;
  opacity: 0 !important;
  -webkit-filter: none !important;
  filter: none !important;
  cursor: pointer;
}

.goal-date-input-wrap {
  grid-column: 1;
  position: relative;
  width: 100%;
  min-width: 0;
}

.goal-date-visual-icon {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 18px;
  height: 18px;
  pointer-events: auto;
  cursor: pointer;
  z-index: 3;
  background-repeat: no-repeat;
  background-size: 18px 18px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23FFFFFF' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3.5' y='5.5' width='17' height='15' rx='2.5'/%3E%3Cline x1='3.5' y1='10' x2='20.5' y2='10'/%3E%3Cline x1='8' y1='3.5' x2='8' y2='7.5'/%3E%3Cline x1='16' y1='3.5' x2='16' y2='7.5'/%3E%3C/svg%3E");
}

.goal-selector-inline {
  grid-column: 1;
  width: 100%;
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 6px;
  align-items: stretch;
}

.goal-selector-inline__selected {
  width: 100%;
  min-width: 0;
  border: 1px solid rgba(148, 163, 184, 0.5);
  border-radius: 5px;
  background: linear-gradient(180deg, rgba(15, 28, 46, 0.9), rgba(11, 22, 34, 0.92));
  min-height: 34px;
  padding: 6px 9px;
  color: #ecf6ff;
  font-size: 0.8rem;
}

.goal-selector-inline__btn {
  min-height: 34px;
  border-radius: var(--wa-btn-radius, 6px);
  color: #ffffff;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0 10px;
  white-space: nowrap;
  transition: background-color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, color 0.18s ease;
}

.goal-selector-inline__btn:focus-visible {
  outline: none;
}

.plan-type-readonly-row {
  grid-column: 1;
  width: 100%;
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 6px;
  align-items: center;
}

.plan-type-readonly-row__label {
  min-height: 34px;
  padding: 6px 10px;
  border: 1px solid rgba(148, 163, 184, 0.5);
  border-radius: 6px;
  background: linear-gradient(180deg, rgba(15, 28, 46, 0.9), rgba(11, 22, 34, 0.92));
  color: #ecf6ff;
  font-size: 0.82rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
}

.plan-type-readonly-row__button {
  min-height: 34px;
  padding: 0 10px;
  white-space: nowrap;
}

.plan-type-readonly-row__help {
  grid-column: 1 / -1;
  margin: 0;
  color: #bfdbfe;
  font-size: 0.72rem;
  line-height: 1.3;
}

.goal-picker-modal {
  position: fixed;
  inset: 0;
  z-index: 2100;
  display: grid;
  place-items: center;
  padding: 14px;
}

.goal-picker-modal__backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  background: rgba(2, 6, 23, 0.62);
}

.goal-picker-modal__panel {
  position: relative;
  width: min(640px, calc(100vw - 28px));
  max-height: min(72vh, 560px);
  border-radius: 6px;
  border: 1px solid rgba(148, 163, 184, 0.42);
  background: linear-gradient(180deg, #0f2036, #0c1a2c);
  box-shadow: 0 22px 40px rgba(2, 6, 23, 0.55);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  overflow: hidden;
}

.goal-picker-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.3);
}

.goal-picker-modal__header h4 {
  margin: 0;
  color: #ffffff;
  font-size: 0.9rem;
  font-weight: 700;
}

.goal-picker-modal__close {
  width: 32px;
  height: 32px;
  min-width: 32px;
  min-height: 32px;
  padding: 0;
  border: 1px solid var(--wa-btn-danger-border, #dc2626);
  border-radius: 5px;
  background: var(--wa-btn-danger, #3b1d2b);
  color: #ffffff;
  font-size: 16px;
  font-weight: 700;
  line-height: 1;
  display: inline-grid;
  place-items: center;
  flex: 0 0 auto;
  cursor: pointer;
  transition: background-color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

.goal-picker-modal__close:hover {
  background: var(--wa-btn-danger-hover, #512334);
  border-color: var(--wa-btn-danger-border, #dc2626);
}

.goal-picker-modal__close:focus-visible {
  outline: none;
  border-color: var(--wa-btn-danger-border, #dc2626);
  box-shadow: var(--wa-btn-danger-focus, 0 0 0 4px rgba(220, 38, 38, 0.24));
}

.goal-picker-modal__list {
  padding: 10px 12px;
  overflow: auto;
  display: grid;
  gap: 6px;
}

.goal-picker-row {
  width: 100%;
  text-align: left;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 5px;
  background: #172338;
  color: #ffffff;
  padding: 8px 10px;
  display: grid;
  gap: 2px;
}

.goal-picker-row:nth-child(2n) {
  background: #22314b;
}

.goal-picker-row--selected {
  border-color: rgba(37, 99, 235, 0.82);
  box-shadow: inset 0 0 0 1px rgba(59, 130, 246, 0.34);
}

.goal-picker-row__name {
  font-size: 0.8rem;
  font-weight: 700;
  line-height: 1.25;
  white-space: normal;
  overflow-wrap: anywhere;
}

.goal-picker-row__date {
  color: #c7dbf7;
  font-size: 0.72rem;
  line-height: 1.25;
}

.goal-picker-modal__actions {
  padding: 10px 12px;
  border-top: 1px solid rgba(148, 163, 184, 0.3);
  display: flex;
  justify-content: flex-end;
  gap: 7px;
}

.goal-picker-modal__action {
  min-height: 32px;
  border-radius: 5px;
  border: 1px solid rgba(148, 163, 184, 0.45);
  background: rgba(30, 41, 59, 0.55);
  color: #ffffff;
  padding: 0 10px;
  font-size: 0.75rem;
  font-weight: 700;
}

.goal-picker-modal__action--select {
  border-color: rgba(59, 130, 246, 0.75);
  background: rgba(37, 99, 235, 0.65);
}

.goal-picker-modal__action--clear {
  border-color: rgba(148, 163, 184, 0.6);
  background: rgba(71, 85, 105, 0.55);
}

.builder-field textarea {
  min-height: 60px;
  resize: vertical;
}

.goal-tag-select {
  position: relative;
  width: 100%;
}

.goal-tag-select__trigger {
  width: 100%;
  min-height: 34px;
  border: 1px solid rgba(148, 163, 184, 0.5);
  border-radius: 6px;
  background: linear-gradient(180deg, rgba(15, 28, 46, 0.9), rgba(11, 22, 34, 0.92));
  color: #ecf6ff;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 6px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 7px;
  text-align: left;
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.08);
}

.goal-tag-select__trigger:focus-visible {
  outline: none;
  border-color: #60a5fa;
  box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.18);
}

.goal-tag-select__summary {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.goal-tag-select__chevron {
  color: #bfdbfe;
  font-size: 0.76rem;
  line-height: 1;
  flex: 0 0 auto;
}

.goal-tag-select__menu {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 6px);
  z-index: 20;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  max-height: 228px;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 8px;
  border: 1px solid rgba(148, 163, 184, 0.45);
  border-radius: 6px;
  background: rgba(10, 18, 30, 0.98);
  box-shadow: 0 14px 28px rgba(2, 6, 23, 0.45);
}

.goal-tag-select__menu--up {
  top: auto;
  bottom: calc(100% + 6px);
}

.goal-tag-select__option {
  appearance: none;
  width: 100%;
  min-height: 34px;
  padding: 5px 8px;
  border: 1px solid rgba(118, 147, 182, 0.34);
  border-radius: 5px;
  background: #172338;
  color: #e5f0ff;
  font-size: 0.76rem;
  font-weight: 600;
  text-align: left;
  display: grid;
  grid-template-columns: 14px minmax(0, 1fr);
  align-items: center;
  gap: 7px;
  line-height: 1.2;
}

.goal-tag-select__option:nth-child(2n) {
  background: #22314b;
}

.goal-tag-select__option:hover {
  border-color: rgba(147, 197, 253, 0.58);
}

.goal-tag-select__option:focus-visible {
  outline: none;
  border-color: #60a5fa;
  box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.22);
}

.goal-tag-select__check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  height: 12px;
  border: 1px solid rgba(191, 219, 254, 0.55);
  border-radius: 2px;
  background: rgba(15, 23, 42, 0.62);
  color: transparent;
  font-size: 0.64rem;
  line-height: 1;
  font-weight: 800;
}

.goal-tag-select__option--selected.goal-tag-select__option--blue {
  background: rgba(37, 99, 235, 0.2);
  border-color: rgba(37, 99, 235, 0.8);
}

.goal-tag-select__option--selected.goal-tag-select__option--green {
  background: rgba(22, 163, 74, 0.2);
  border-color: rgba(22, 163, 74, 0.8);
}

.goal-tag-select__option--selected.goal-tag-select__option--red {
  background: rgba(220, 38, 38, 0.2);
  border-color: rgba(220, 38, 38, 0.8);
}

.goal-tag-select__option--selected {
  color: #ffffff;
}

.goal-tag-select__option--selected .goal-tag-select__check {
  color: #ffffff;
}

.goal-tag-select__option--selected.goal-tag-select__option--blue .goal-tag-select__check {
  border-color: #2563eb;
  background: #2563eb;
}

.goal-tag-select__option--selected.goal-tag-select__option--green .goal-tag-select__check {
  border-color: #16a34a;
  background: #16a34a;
}

.goal-tag-select__option--selected.goal-tag-select__option--red .goal-tag-select__check {
  border-color: #dc2626;
  background: #dc2626;
}

.builder-field--other-goal {
  margin-top: 2px;
}

.builder-field--goals > .builder-field--other-goal {
  grid-column: 1;
}

.builder-field--other-goal .builder-field__hint {
  margin-top: 2px;
}

@media (min-width: 769px) {
  .builder-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .metadata-section--plan-info,
  .metadata-section--goals {
    grid-column: 1;
  }

  .builder-field--duration {
    width: auto;
  }

  .plan-info-two-col {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 10px;
    row-gap: 8px;
    align-items: start;
  }

  .goal-info-two-col {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 10px;
    row-gap: 8px;
  }

  .goal-info-two-col > .builder-field--row,
  .goals-grid > .builder-field--goals,
  .goals-grid > .builder-field--goal-date {
    grid-column: auto;
  }

  .goals-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 10px;
    row-gap: 8px;
    align-items: start;
  }

  .builder-field--goal-date {
    align-self: start;
  }

  .builder-field--goal-date .goal-date-input-wrap {
    align-self: center;
  }

  .plan-info-two-col .builder-field--row > input,
  .plan-info-two-col .builder-field--row > select {
    width: 100%;
  }
}

@media (max-width: 768px) {
  .builder-metadata-layout {
    gap: 6px;
    min-width: 0;
    width: 100%;
  }

  .builder-grid {
    gap: 8px;
    min-width: 0;
  }

  .metadata-section {
    gap: 6px;
    padding-top: 6px;
  }

  .metadata-section__header {
    font-size: 0.68rem;
    letter-spacing: 0.07em;
  }

  .metadata-section__body {
    gap: 6px;
  }

  .builder-field-group--meta-row {
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .plan-info-two-col {
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .goals-grid {
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .builder-field {
    gap: 3px;
    min-width: 0;
  }

  .builder-field--row,
  .builder-field--wide,
  .builder-field--goal-date,
  .builder-field--goals {
    grid-template-columns: 1fr;
    align-items: start;
  }

  .builder-field span {
    font-size: 0.68rem;
    line-height: 1.35;
  }

  .builder-field__hint {
    font-size: 0.65rem;
    line-height: 1.3;
  }

  .goal-context-note {
    font-size: 0.7rem;
    padding: 6px 8px;
    border-radius: 6px;
  }

  .builder-field input,
  .builder-field select,
  .builder-field textarea {
    min-height: 40px;
    padding: 8px 10px;
    font-size: 0.8rem;
    border-radius: 6px;
  }

  .builder-field textarea {
    min-height: 54px;
  }

  .goal-tag-select__trigger {
    min-height: 40px;
    padding: 8px 10px;
    font-size: 0.8rem;
  }

  .goal-selector-inline {
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .plan-type-readonly-row {
    grid-template-columns: 1fr;
  }

  .goal-selector-inline__selected,
  .goal-selector-inline__btn,
  .plan-type-readonly-row__label,
  .plan-type-readonly-row__button {
    min-height: 38px;
    font-size: 0.78rem;
  }

  .goal-picker-modal {
    align-items: flex-start;
    padding-top: 20px;
    padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 90px);
  }

  .goal-picker-modal__panel {
    width: min(100%, 520px);
    max-height: min(62vh, 500px);
  }

  .goal-picker-modal__close {
    width: 40px;
    height: 40px;
    min-width: 40px;
    min-height: 40px;
    font-size: 16px;
  }

  .goal-tag-select__menu {
    grid-template-columns: 1fr;
    gap: 5px;
    max-height: min(40vh, 216px);
    padding: 7px;
  }

  .goal-tag-select__option {
    min-height: 32px;
    font-size: 0.74rem;
    border-radius: 5px;
  }
}

@media (max-width: 480px) {
  .builder-metadata-layout {
    gap: 4px;
  }

  .builder-grid {
    gap: 6px;
  }

  .builder-field {
    gap: 3px;
  }

  .builder-field--row,
  .builder-field--wide,
  .builder-field--goal-date,
  .builder-field--goals {
    grid-template-columns: 1fr;
  }

  .builder-field span {
    font-size: 0.7rem;
  }

  .builder-field__hint {
    font-size: 0.65rem;
  }

  .builder-field input,
  .builder-field select,
  .builder-field textarea {
    min-height: 38px;
    font-size: 0.8rem;
    padding: 7px 9px;
    border-radius: 5px;
  }

  .goal-tag-select__menu {
    max-height: min(38vh, 204px);
  }
}

@media (max-width: 390px) {
  .goal-tag-select__menu {
    max-height: min(36vh, 192px);
  }

  .goal-picker-modal {
    padding-top: 14px;
    padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 94px);
  }

  .goal-picker-modal__panel {
    max-height: min(58vh, 460px);
  }
}
</style>
