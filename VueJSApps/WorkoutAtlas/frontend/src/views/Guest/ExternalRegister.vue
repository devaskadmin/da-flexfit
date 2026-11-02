<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import axios from 'axios';
import { useRouter } from 'vue-router';
import { useAuth } from '@/composable/useAuth';
import { API_BASE } from '@/config/env';
import { getAccountTypeOptions } from '@/config/accountTypeOptions';
import {
  FALLBACK_SUBSCRIPTION_TIERS,
  buildSubscriptionPlanOptions,
  getAllowedPlanKeysForAccountType,
} from '@/config/subscriptionPlans';

const currentStep = ref(1);
const tiersLoading = ref(false);
const completionLoading = ref(false);
const completionError = ref('');
const subscriptionTiers = ref([]);
const planCarouselIndex = ref(0);
const subscriptionSelectionByType = reactive({});
const form = reactive({
  membershipType: '',
  subscriptionPlanKey: '',
  subscriptionTierId: '',
});

const { user, fetchUser, logout, logoutInProgress } = useAuth();
const router = useRouter();

const stepperSteps = computed(() => ([
  { number: 1, label: 'Account' },
  { number: 2, label: 'Subscription' },
]));

const progressPercent = computed(() => (currentStep.value === 1 ? 0 : 100));
const maxAccessibleStep = computed(() => (form.membershipType ? 2 : 1));
const accountTypeOptions = computed(() => getAccountTypeOptions(false));
const signedInEmail = computed(() => String(user.value?.username || '').trim());
const allowedPlanKeys = computed(() => getAllowedPlanKeysForAccountType(form.membershipType));
const tiersForLookup = computed(() => (subscriptionTiers.value.length ? subscriptionTiers.value : FALLBACK_SUBSCRIPTION_TIERS));
const subscriptionPlanOptions = computed(() => {
  return buildSubscriptionPlanOptions(tiersForLookup.value, allowedPlanKeys.value);
});
const activeSubscriptionPlan = computed(() => subscriptionPlanOptions.value[planCarouselIndex.value] || null);
const stepTwoValid = computed(() => {
  return Boolean(form.membershipType && form.subscriptionPlanKey && form.subscriptionTierId);
});

const selectMembershipType = (value) => {
  form.membershipType = value;
};

const selectSubscriptionTier = (planKey) => {
  const plan = subscriptionPlanOptions.value.find((item) => item.key === planKey);
  if (!plan || !plan.available) return;
  form.subscriptionPlanKey = plan.key;
  form.subscriptionTierId = plan.tierId;

  const typeKey = String(form.membershipType || '').trim().toLowerCase();
  if (typeKey) {
    subscriptionSelectionByType[typeKey] = {
      subscriptionPlanKey: plan.key,
      subscriptionTierId: plan.tierId,
    };
  }
};

const goToPreviousPlan = () => {
  if (planCarouselIndex.value <= 0) return;
  planCarouselIndex.value -= 1;
};

const goToNextPlanSlide = () => {
  if (planCarouselIndex.value >= subscriptionPlanOptions.value.length - 1) return;
  planCarouselIndex.value += 1;
};

const goToPlanByIndex = (index) => {
  if (index < 0 || index >= subscriptionPlanOptions.value.length) return;
  planCarouselIndex.value = index;
};

const goToStep = (step) => {
  if (step > maxAccessibleStep.value) return;
  currentStep.value = step;
  completionError.value = '';
};

const goToNextStep = () => {
  if (!form.membershipType) return;

  const typeKey = String(form.membershipType || '').trim().toLowerCase();
  const cachedSelection = subscriptionSelectionByType[typeKey];
  if (cachedSelection?.subscriptionPlanKey) {
    const matchedPlan = subscriptionPlanOptions.value.find(
      (plan) => plan.key === cachedSelection.subscriptionPlanKey && plan.available
    );

    if (matchedPlan) {
      form.subscriptionPlanKey = matchedPlan.key;
      form.subscriptionTierId = matchedPlan.tierId;
      const matchedIndex = subscriptionPlanOptions.value.findIndex((plan) => plan.key === matchedPlan.key);
      planCarouselIndex.value = matchedIndex >= 0 ? matchedIndex : 0;
    }
  }

  currentStep.value = 2;
  completionError.value = '';
};

const handleLogout = async () => {
  await logout();
};

const completeExternalRegistration = async () => {
  if (completionLoading.value || !stepTwoValid.value) return;

  completionLoading.value = true;
  completionError.value = '';

  try {
    await axios.post(
      `${API_BASE}/api/ext-register/complete`,
      {
        membershipType: form.membershipType,
        subscriptionTierId: Number(form.subscriptionTierId),
      },
      {
        withCredentials: true,
      }
    );

    await fetchUser();
    await router.replace({ name: 'dashboard_index' });
  } catch (error) {
    completionError.value = error?.response?.data?.error || 'Failed to complete registration.';
  } finally {
    completionLoading.value = false;
  }
};

const loadSubscriptionTiers = async () => {
  tiersLoading.value = true;

  try {
    const response = await axios.get(`${API_BASE}/api/register-tiers`);
    subscriptionTiers.value = Array.isArray(response.data) ? response.data : [];
  } catch {
    subscriptionTiers.value = FALLBACK_SUBSCRIPTION_TIERS;
  } finally {
    tiersLoading.value = false;
  }
};

watch(
  () => form.membershipType,
  () => {
    const typeKey = String(form.membershipType || '').trim().toLowerCase();
    const currentPlans = subscriptionPlanOptions.value;
    const cachedSelection = subscriptionSelectionByType[typeKey];

    if (cachedSelection?.subscriptionPlanKey) {
      const cachedPlan = currentPlans.find((plan) => plan.key === cachedSelection.subscriptionPlanKey && plan.available);
      if (cachedPlan) {
        form.subscriptionPlanKey = cachedPlan.key;
        form.subscriptionTierId = cachedPlan.tierId;
      }
    }

    const selectedPlan = currentPlans.find((plan) => plan.key === form.subscriptionPlanKey && plan.available);

    if (!selectedPlan) {
      form.subscriptionPlanKey = '';
      form.subscriptionTierId = '';
    }

    const selectedIndex = currentPlans.findIndex((plan) => plan.key === form.subscriptionPlanKey);
    planCarouselIndex.value = selectedIndex >= 0 ? selectedIndex : 0;
  }
);

watch(
  subscriptionPlanOptions,
  (plans) => {
    if (!plans.length) {
      planCarouselIndex.value = 0;
      form.subscriptionPlanKey = '';
      form.subscriptionTierId = '';
      return;
    }

    if (planCarouselIndex.value > plans.length - 1) {
      planCarouselIndex.value = plans.length - 1;
    }

    if (form.subscriptionPlanKey) {
      const selectedPlan = plans.find((plan) => plan.key === form.subscriptionPlanKey && plan.available);
      if (selectedPlan) {
        form.subscriptionTierId = selectedPlan.tierId;
      } else {
        form.subscriptionPlanKey = '';
        form.subscriptionTierId = '';
      }
    }
  },
  { immediate: true }
);

onMounted(async () => {
  await fetchUser();
  await loadSubscriptionTiers();
});
</script>

<template>
  <div class="login-body auth-card" :class="{ 'step2-compact': currentStep === 2 }">
    <div class="top d-flex justify-content-between align-items-center auth-header">
      <div class="logo auth-logo-wrap">
        <img src="@/assets/images/flex-fitlogo-transparent.png" alt="Logo">
      </div>
      <router-link to="/"><i class="fa-duotone fa-house-chimney"></i></router-link>
    </div>

    <div class="bottom auth-content">
      <h3 class="panel-title panel-title-form auth-title">Complete Your Registration</h3>

      <div class="wizard-progress" aria-label="External registration steps">
        <div class="wizard-progress-track" aria-hidden="true">
          <div class="wizard-progress-fill" :style="{ width: `${progressPercent}%` }"></div>
        </div>

        <div class="wizard-steps-row">
          <button
            v-for="step in stepperSteps"
            :key="step.number"
            type="button"
            class="wizard-step"
            :class="{
              active: currentStep === step.number,
              complete: currentStep > step.number,
              locked: step.number > maxAccessibleStep,
            }"
            :disabled="step.number > maxAccessibleStep"
            @click="goToStep(step.number)"
          >
            <span class="wizard-step-number">
              <i v-if="currentStep > step.number" class="fa-solid fa-check"></i>
              <span v-else>{{ step.number }}</span>
            </span>
            <span class="wizard-step-text">{{ step.label }}</span>
          </button>
        </div>
      </div>

      <transition name="step-slide" mode="out-in">
        <section v-if="currentStep === 1" key="step-1" class="wizard-panel">
          <div class="signed-in-pill">
            <span class="signed-in-label">Signed in as:</span>
            <span class="signed-in-email">{{ signedInEmail || 'Unavailable' }}</span>
          </div>

          <p class="wizard-subtitle">Choose the type of WorkoutAtlas account you want to use.</p>

          <div class="account-type-grid">
            <button
              v-for="option in accountTypeOptions"
              :key="option.value"
              type="button"
              class="account-type-card"
              :class="{ selected: form.membershipType === option.value }"
              @click="selectMembershipType(option.value)"
            >
              <div class="account-type-card-icon">
                <i :class="option.icon"></i>
              </div>
              <div class="account-type-card-body">
                <div class="account-type-card-title">{{ option.title }}</div>
                <div class="account-type-card-text">{{ option.description }}</div>
              </div>
              <div class="account-type-card-check">
                <i class="fa-solid fa-circle-check"></i>
              </div>
            </button>
          </div>

          <div class="wizard-actions wizard-actions-step1">
            <button type="button" class="btn btn-outline-secondary auth-button auth-button-back" @click="handleLogout" :disabled="logoutInProgress">
              {{ logoutInProgress ? 'Signing out...' : 'Logout / Cancel' }}
            </button>
            <button type="button" class="btn btn-primary auth-button" :disabled="!form.membershipType" @click="goToNextStep">
              Next
            </button>
          </div>
        </section>

        <section v-else key="step-2" class="wizard-panel wizard-panel-step2">
          <h4 class="subscription-step-title">Subscription</h4>

          <div class="signed-in-pill">
            <span class="signed-in-label">Signed in as:</span>
            <span class="signed-in-email">{{ signedInEmail || 'Unavailable' }}</span>
          </div>

          <div class="selected-account-pill">
            <span class="selected-account-label">Account Type</span>
            <span class="selected-account-value">{{ form.membershipType }}</span>
          </div>

          <div class="subscription-carousel-wrap">
            <button
              type="button"
              class="subscription-arrow"
              :disabled="planCarouselIndex === 0"
              aria-label="Previous subscription"
              @click="goToPreviousPlan"
            >
              <i class="fa-solid fa-chevron-left"></i>
            </button>

            <transition name="subscription-card-fade" mode="out-in">
              <div v-if="activeSubscriptionPlan" :key="activeSubscriptionPlan.key" class="subscription-card" :class="{ selected: form.subscriptionPlanKey === activeSubscriptionPlan.key }">
                <div class="subscription-card-icon">
                  <i :class="activeSubscriptionPlan.icon"></i>
                </div>
                <div class="subscription-card-name">{{ activeSubscriptionPlan.name }}</div>
                <div class="subscription-card-price">{{ activeSubscriptionPlan.priceLabel }}</div>
                <div class="subscription-card-description">{{ activeSubscriptionPlan.description }}</div>

                <ul class="subscription-feature-list">
                  <li v-for="feature in activeSubscriptionPlan.features" :key="feature">{{ feature }}</li>
                </ul>

                <button
                  type="button"
                  class="btn btn-primary auth-button subscription-select-btn"
                  :class="{ 'is-selected': form.subscriptionPlanKey === activeSubscriptionPlan.key }"
                  :disabled="!activeSubscriptionPlan.available"
                  @click="selectSubscriptionTier(activeSubscriptionPlan.key)"
                >
                  {{ form.subscriptionPlanKey === activeSubscriptionPlan.key ? 'Selected' : 'Select Plan' }}
                </button>

                <div v-if="!activeSubscriptionPlan.available" class="auth-subtitle text-center mt-2">
                  This plan is currently unavailable.
                </div>
              </div>

              <div v-else key="no-plan" class="subscription-card selected">
                <div class="subscription-card-description">No plans available.</div>
              </div>
            </transition>

            <button
              type="button"
              class="subscription-arrow"
              :disabled="planCarouselIndex >= subscriptionPlanOptions.length - 1"
              aria-label="Next subscription"
              @click="goToNextPlanSlide"
            >
              <i class="fa-solid fa-chevron-right"></i>
            </button>
          </div>

          <div class="subscription-indicator-wrap">
            <span class="subscription-indicator-count">{{ Math.min(planCarouselIndex + 1, Math.max(subscriptionPlanOptions.length, 1)) }} of {{ subscriptionPlanOptions.length }}</span>
            <div class="subscription-dots">
              <button
                v-for="(plan, index) in subscriptionPlanOptions"
                :key="plan.key"
                type="button"
                class="subscription-dot"
                :class="{ active: index === planCarouselIndex }"
                :aria-label="`View ${plan.name} plan`"
                @click="goToPlanByIndex(index)"
              ></button>
            </div>
          </div>

          <div v-if="tiersLoading" class="auth-subtitle text-center mt-2">Loading subscription tiers...</div>
          <div v-if="completionError" class="alert alert-danger mt-2 mb-0">{{ completionError }}</div>

          <div class="wizard-actions wizard-actions-step2">
            <button type="button" class="btn btn-outline-secondary auth-button auth-button-back" @click="handleLogout" :disabled="logoutInProgress">
              {{ logoutInProgress ? 'Signing out...' : 'Logout / Cancel' }}
            </button>
            <button type="button" class="btn btn-outline-secondary auth-button auth-button-back" @click="goToStep(1)">
              Back
            </button>
            <button type="button" class="btn btn-primary auth-button" :disabled="!stepTwoValid || completionLoading" @click="completeExternalRegistration">
              {{ completionLoading ? 'Completing...' : 'Complete Registration' }}
            </button>
          </div>
        </section>
      </transition>
    </div>
  </div>
</template>

<style scoped>
.login-body {
  position: relative;
  border: 8px solid rgba(0, 0, 0, 0.25) !important;
  border-radius: 10px !important;
  background: rgba(255, 255, 255, 0.95) !important;
  padding: 22px !important;
  width: 100%;
  max-width: 430px;
  margin: 0 auto;
  overflow: hidden;
}

.login-body.step2-compact {
  padding: 18px 20px !important;
}

.panel-title-form {
  color: #000000;
  font-weight: 600;
  font-size: 1.2rem;
  margin-bottom: 12px;
  text-align: center;
}

.auth-header {
  position: relative;
  justify-content: center !important;
  margin-bottom: 4px;
}

.auth-header > a {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
}

.login-body .top.auth-header .logo.auth-logo-wrap img {
  width: 300px !important;
  max-width: 70% !important;
  height: auto !important;
  display: block;
  margin: 0 auto 20px;
  object-fit: contain;
}

.auth-title {
  color: #1B2444 !important;
  font-weight: 700;
  margin-top: 6px;
  margin-bottom: 14px;
}

.wizard-progress {
  position: relative;
  margin-bottom: 16px;
  padding-top: 2px;
}

.wizard-progress-track {
  position: absolute;
  left: 40px;
  right: 40px;
  top: 16px;
  height: 2px;
  background: rgba(13, 153, 255, 0.18);
  border-radius: 999px;
  overflow: hidden;
}

.wizard-progress-fill {
  height: 100%;
  background: #0D99FF;
  border-radius: inherit;
  transition: width 0.28s ease;
}

.wizard-steps-row {
  position: relative;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.wizard-step {
  appearance: none;
  border: 0;
  background: transparent;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 0;
  color: rgba(0, 0, 0, 0.5);
  min-width: 0;
  flex: 1;
}

.wizard-step:disabled {
  opacity: 1;
  cursor: default;
}

.wizard-step-number {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1.5px solid rgba(13, 153, 255, 0.35);
  background: rgba(255, 255, 255, 0.96);
  font-weight: 700;
  font-size: 0.85rem;
}

.wizard-step.active .wizard-step-number,
.wizard-step.complete .wizard-step-number {
  background: #0D99FF;
  border-color: #0D99FF;
  color: #fff;
}

.wizard-step-text {
  font-size: 0.78rem;
  font-weight: 600;
  text-align: center;
  line-height: 1.15;
}

.wizard-step.active,
.wizard-step.complete {
  color: rgba(0, 0, 0, 0.82);
}

.wizard-step.locked {
  color: rgba(0, 0, 0, 0.34);
}

.wizard-step.locked .wizard-step-number {
  border-color: rgba(13, 153, 255, 0.2);
  color: rgba(0, 0, 0, 0.45);
}

.wizard-panel {
  min-height: 380px;
}

.wizard-subtitle {
  font-size: 0.84rem;
  color: rgba(0, 0, 0, 0.66);
  text-align: center;
  margin-bottom: 14px;
}

.signed-in-pill {
  display: grid;
  gap: 4px;
  border: 1px solid rgba(13, 153, 255, 0.2);
  background: rgba(13, 153, 255, 0.06);
  border-radius: 10px;
  padding: 8px 10px;
  margin-bottom: 12px;
}

.signed-in-label {
  font-size: 0.76rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(0, 0, 0, 0.55);
  font-weight: 700;
}

.signed-in-email {
  font-size: 0.9rem;
  font-weight: 700;
  color: #0D99FF;
  word-break: break-word;
}

.account-type-grid {
  display: grid;
  gap: 10px;
}

.account-type-card {
  width: 100%;
  border: 2px solid #C9D9EA;
  border-radius: 12px;
  background: #FFFFFF;
  color: #1B2444;
  display: grid;
  grid-template-columns: 40px 1fr 26px;
  gap: 10px;
  align-items: center;
  text-align: left;
  padding: 12px;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease, background 0.18s ease;
}

.account-type-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(47, 107, 255, 0.1);
  border-color: #2F6BFF;
  background: #F5F8FF;
}

.account-type-card.selected {
  border: 2px solid #2F6BFF;
  box-shadow: 0 0 0 4px rgba(47, 107, 255, 0.16);
  background: #EEF4FF;
}

.account-type-card-icon {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  background: rgba(13, 153, 255, 0.11);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #0D99FF;
  font-size: 1rem;
}

.account-type-card-title {
  font-size: 0.96rem;
  font-weight: 700;
  color: #1B2444;
}

.account-type-card-text {
  font-size: 0.78rem;
  color: #1B2444;
  line-height: 1.35;
  margin-top: 2px;
  opacity: 0.82;
}

.account-type-card-check {
  width: 20px;
  height: 20px;
  border-radius: 999px;
  background: rgba(47, 107, 255, 0.12);
  color: rgba(47, 107, 255, 0.35);
  font-size: 1rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.account-type-card.selected .account-type-card-check {
  background: #2F6BFF;
  color: #FFFFFF;
}

.wizard-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 14px;
}

.auth-button {
  min-height: 40px;
  padding-top: 8px;
  padding-bottom: 8px;
  font-size: 0.92rem;
  border-radius: 8px;
}

.wizard-actions .btn.btn-primary {
  background: #2F6BFF !important;
  color: #FFFFFF !important;
  border: none !important;
}

.wizard-actions .btn.btn-primary:hover:not(:disabled) {
  background: #2459D8 !important;
}

.wizard-actions .btn.btn-primary:disabled {
  background: #8F9BB5 !important;
  color: #E8EDF5 !important;
  opacity: 0.7;
}

.auth-button-back {
  background: #FFFFFF;
  border: 2px solid #C9D9EA;
  color: #1B2444;
  box-shadow: none !important;
}

.auth-button-back:hover:not(:disabled) {
  background: #F5F8FF;
  border-color: #2F6BFF;
}

.subscription-step-title {
  text-align: center;
  font-size: 1rem;
  font-weight: 700;
  margin: 0 0 10px;
  color: rgba(0, 0, 0, 0.82);
}

.selected-account-pill {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border: 1px solid rgba(13, 153, 255, 0.2);
  background: rgba(13, 153, 255, 0.06);
  border-radius: 10px;
  padding: 8px 10px;
  margin-bottom: 12px;
}

.selected-account-label {
  font-size: 0.76rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(0, 0, 0, 0.55);
  font-weight: 700;
}

.selected-account-value {
  font-size: 0.88rem;
  font-weight: 700;
  color: #0D99FF;
}

.subscription-carousel-wrap {
  display: grid;
  grid-template-columns: 34px 1fr 34px;
  align-items: center;
  gap: 10px;
  margin-top: 4px;
}

.wizard-panel-step2 .subscription-arrow {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  border: 2px solid #C9D9EA;
  background: #FFFFFF;
  color: #2F6BFF;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  min-width: 44px !important;
  min-height: 44px !important;
  width: 44px !important;
  height: 44px !important;
  padding: 0 !important;
  border-radius: 50% !important;
  background: #252E48 !important;
  border: 1px solid rgba(145, 160, 200, 0.35) !important;
  color: #FFFFFF !important;
}

.wizard-panel-step2 .subscription-arrow:hover:not(:disabled) {
  background: #2F6BFF !important;
  border-color: #2F6BFF !important;
}

.wizard-panel-step2 .subscription-arrow:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.subscription-card {
  width: 100%;
  border: 1.5px solid rgba(13, 153, 255, 0.26);
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(255,255,255,0.92), rgba(245,249,255,0.92));
  padding: 14px 12px;
  text-align: center;
}

.subscription-card.selected {
  border-color: #0D99FF;
  box-shadow: 0 0 0 4px rgba(13, 153, 255, 0.12);
}

.subscription-card-icon {
  width: 42px;
  height: 42px;
  border-radius: 999px;
  background: rgba(13, 153, 255, 0.11);
  color: #0D99FF;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.05rem;
  margin-bottom: 8px;
}

.subscription-card-name {
  font-size: 1rem;
  font-weight: 700;
  color: rgba(0, 0, 0, 0.84);
}

.subscription-card-price {
  font-size: 0.84rem;
  font-weight: 700;
  color: #0D99FF;
  margin-top: 2px;
}

.subscription-card-description {
  font-size: 0.78rem;
  color: rgba(0, 0, 0, 0.64);
  margin-top: 6px;
}

.subscription-feature-list {
  margin: 10px 0;
  padding-left: 18px;
  text-align: left;
  font-size: 0.78rem;
  color: rgba(0, 0, 0, 0.74);
  line-height: 1.35;
}

.subscription-feature-list li + li {
  margin-top: 3px;
}

.subscription-select-btn {
  min-height: 36px;
  font-size: 0.84rem;
}

.wizard-panel-step2 .subscription-select-btn {
  background: #2F6BFF !important;
  color: #FFFFFF !important;
  border: none !important;
  background-image: none !important;
  box-shadow: none !important;
}

.wizard-panel-step2 .subscription-select-btn:hover:not(:disabled) {
  background: #2459D8 !important;
}

.wizard-panel-step2 .subscription-select-btn.is-selected {
  background: #1E9D42 !important;
  box-shadow: none !important;
}

.wizard-panel-step2 .subscription-select-btn.is-selected:hover:not(:disabled) {
  background: #188237 !important;
}

.subscription-indicator-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
}

.subscription-indicator-count {
  font-size: 0.76rem;
  color: rgba(0, 0, 0, 0.55);
}

.wizard-panel-step2 .subscription-dots {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.wizard-panel-step2 .subscription-dot {
  width: 12px !important;
  height: 12px !important;
  min-width: 12px !important;
  min-height: 12px !important;
  padding: 0 !important;
  border-radius: 50% !important;
  border: 0;
  background: #BFDDF5 !important;
  transition: background 0.2s ease;
}

.wizard-panel-step2 .subscription-dot.active {
  background: #2F6BFF !important;
}

.wizard-actions-step2 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.step-slide-enter-active,
.step-slide-leave-active {
  transition: all 0.22s ease;
}

.step-slide-enter-from {
  opacity: 0;
  transform: translateX(14px);
}

.step-slide-leave-to {
  opacity: 0;
  transform: translateX(-14px);
}

.subscription-card-fade-enter-active,
.subscription-card-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.subscription-card-fade-enter-from,
.subscription-card-fade-leave-to {
  opacity: 0;
  transform: translateX(10px);
}

@media (max-width: 576px) {
  .login-body {
    padding: 18px !important;
  }

  .login-body .top.auth-header .logo.auth-logo-wrap img {
    width: 240px !important;
    max-width: 85% !important;
  }

  .wizard-panel {
    min-height: auto;
  }

  .wizard-progress-track {
    left: 28px;
    right: 28px;
  }

  .wizard-step-text {
    font-size: 0.76rem;
  }

  .account-type-card {
    grid-template-columns: 36px 1fr 22px;
    padding: 10px;
  }

  .wizard-actions-step2 {
    grid-template-columns: 1fr;
  }

  .subscription-carousel-wrap {
    grid-template-columns: 30px 1fr 30px;
    gap: 8px;
  }

  .subscription-arrow {
    width: 30px;
    height: 30px;
  }

  .subscription-card {
    padding: 12px 10px;
  }
}
</style>
