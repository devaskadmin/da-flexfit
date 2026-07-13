<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import axios from "axios";
import { useRouter } from "vue-router";
import { API_BASE } from '@/config/env';
import { isDemoMode } from '@/config/appConfig';

const router = useRouter();

const DRAFT_KEY = 'flexfit_register_wizard_draft';

const currentStep = ref(1);
const loading = ref(false);
const tiersLoading = ref(false);
const errorMsg = ref("");
const successMsg = ref("");
const showTermsModal = ref(false);
const termsReachedBottom = ref(false);
const isPasswordShow = ref(false);
const isConfirmPasswordShow = ref(false);

const touched = reactive({
  firstName: false,
  lastName: false,
  username: false,
  password: false,
  confirmPassword: false,
});

// membershipType = membership/billing/profile tier (not used for menu access control)
const form = reactive({
  membershipType: '',
  subscriptionPlanKey: '',
  subscriptionTierId: '',
  firstName: '',
  lastName: '',
  username: '',
  password: '',
  confirmPassword: '',
  agreed: false,
  hasReadTerms: false,
});

const subscriptionTiers = ref([]);
const planCarouselIndex = ref(0);

const FALLBACK_TIERS = [
  { id: 1, name: 'Free', slug: 'free', price_monthly: 0, price_yearly: 0 },
  { id: 2, name: 'Pro', slug: 'pro', price_monthly: 9.99, price_yearly: 99.99 },
  { id: 3, name: 'Trainer', slug: 'trainer', price_monthly: 19.99, price_yearly: 199.99 },
];

const PLAN_DEFINITIONS = [
  {
    key: 'free',
    name: 'Free',
    priceLabel: '$0/month',
    description: 'Great for getting started with your fitness routine.',
    icon: 'fa-regular fa-star',
    features: [
      'Basic workout logging',
      'Basic progress tracking',
      'Standard exercise access',
    ],
  },
  {
    key: 'pro',
    name: 'Pro',
    priceLabel: '$9.99/month',
    description: 'Built for committed users who want deeper fitness insights.',
    icon: 'fa-regular fa-bolt',
    features: [
      'Advanced workout tools',
      'Enhanced progress tracking',
      'Nutrition insights',
      'Premium features',
    ],
  },
  {
    key: 'trainer',
    name: 'Trainer',
    priceLabel: '$19.99/month',
    description: 'Designed for coaching workflows and client management.',
    icon: 'fa-regular fa-dumbbell',
    features: [
      'Client management',
      'Program building',
      'Progress review tools',
      'Trainer-focused features',
    ],
  },
];

const accountTypeOptions = computed(() => {
  const base = [
    {
      value: 'User',
      title: 'User',
      description: 'Track workouts, view progress, and manage your fitness journey.',
      icon: 'fa-regular fa-user',
    },
    {
      value: 'Trainer',
      title: 'Trainer',
      description: 'Manage clients, guide programs, and support training goals.',
      icon: 'fa-regular fa-dumbbell',
    },
  ];

  if (isDemoMode) {
    base.push({
      value: 'Admin',
      title: 'Admin',
      description: 'Demo-only access for platform administration and review.',
      icon: 'fa-regular fa-shield-check',
    });
  }

  return base;
});

const tiersForLookup = computed(() => (subscriptionTiers.value.length ? subscriptionTiers.value : FALLBACK_TIERS));

const normalizeTierName = (value) => String(value || '').trim().toLowerCase();

const resolveTierIdForPlan = (planKey) => {
  const rows = tiersForLookup.value || [];

  const findByNames = (names = []) => {
    const lowered = names.map((n) => normalizeTierName(n));
    return rows.find((row) => lowered.includes(normalizeTierName(row.slug)) || lowered.includes(normalizeTierName(row.name)));
  };

  if (planKey === 'free') {
    const freeTier = findByNames(['free']);
    return freeTier?.id ?? null;
  }

  if (planKey === 'pro') {
    const proTier = findByNames(['pro']);
    return proTier?.id ?? null;
  }

  if (planKey === 'trainer') {
    const trainerTier = findByNames(['trainer', 'elite']);
    return trainerTier?.id ?? null;
  }

  return null;
};

const subscriptionPlanOptions = computed(() => {
  return PLAN_DEFINITIONS.map((plan) => {
    const tierId = resolveTierIdForPlan(plan.key);
    return {
      ...plan,
      tierId,
      available: tierId !== null,
    };
  });
});

const activeSubscriptionPlan = computed(() => subscriptionPlanOptions.value[planCarouselIndex.value] || null);

const selectedSubscriptionTier = computed(() => {
  return subscriptionPlanOptions.value.find((plan) => plan.key === form.subscriptionPlanKey) || null;
});

const selectedSubscriptionLabel = computed(() => {
  if (selectedSubscriptionTier.value?.name) {
    return selectedSubscriptionTier.value.name;
  }

  if (form.subscriptionTierId) {
    const tier = tiersForLookup.value.find((row) => Number(row.id) === Number(form.subscriptionTierId));
    if (tier?.name) return tier.name;
  }

  return 'Not selected';
});

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const strongPasswordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

const passwordChecks = computed(() => ({
  length: form.password.length >= 8,
  uppercase: /[A-Z]/.test(form.password),
  number: /\d/.test(form.password),
  specialChar: /[!@#$%^&*(),.?":{}|<>\-_+=/\\[\]~`]/.test(form.password),
}));

const showStrengthMeter = computed(() => form.password.length > 0);

const passwordStrength = computed(() => {
  const passed = Object.values(passwordChecks.value).filter(Boolean).length;
  if (passed <= 1) return 'Weak';
  if (passed <= 3) return 'Medium';
  return 'Strong';
});

const passwordStrengthClass = computed(() => {
  if (passwordStrength.value === 'Weak') return 'text-danger';
  if (passwordStrength.value === 'Medium') return 'text-warning';
  if (passwordStrength.value === 'Strong') return 'text-success';
  return '';
});

const isEmailValid = computed(() => emailPattern.test(String(form.username || '').trim()));
const isPasswordStrong = computed(() => strongPasswordPattern.test(form.password));
const passwordsMatch = computed(() => form.confirmPassword.length > 0 && form.password === form.confirmPassword);
const hasRequiredInfo = computed(() => {
  return Boolean(
    String(form.firstName || '').trim() &&
    String(form.lastName || '').trim() &&
    String(form.username || '').trim() &&
    String(form.password || '').trim() &&
    String(form.confirmPassword || '').trim()
  );
});

const stepOneValid = computed(() => Boolean(form.membershipType));
const stepTwoValid = computed(() => Boolean(form.subscriptionPlanKey && form.subscriptionTierId));
const stepThreeValid = computed(() => hasRequiredInfo.value && isEmailValid.value && isPasswordStrong.value && passwordsMatch.value);
const canSubmit = computed(() => stepThreeValid.value && form.agreed && !loading.value);
const maxAccessibleStep = computed(() => {
  if (stepOneValid.value && stepTwoValid.value) return 3;
  if (stepOneValid.value) return 2;
  return 1;
});
const stepperSteps = computed(() => ([
  { number: 1, label: 'Account' },
  { number: 2, label: 'Subscription' },
  { number: 3, label: 'Info' },
]));
const progressPercent = computed(() => {
  if (currentStep.value <= 1) return 0;
  if (currentStep.value === 2) return 50;
  return 100;
});

const firstNameError = computed(() => touched.firstName && !String(form.firstName || '').trim() ? 'First name is required.' : '');
const lastNameError = computed(() => touched.lastName && !String(form.lastName || '').trim() ? 'Last name is required.' : '');
const emailError = computed(() => {
  if (!touched.username) return '';
  if (!String(form.username || '').trim()) return 'Email is required.';
  if (!isEmailValid.value) return 'Enter a valid email address.';
  return '';
});
const passwordError = computed(() => {
  if (!touched.password) return '';
  if (!form.password) return 'Password is required.';
  if (!isPasswordStrong.value) return 'Use 8+ characters with uppercase, number, and special character.';
  return '';
});
const confirmPasswordError = computed(() => {
  if (!touched.confirmPassword) return '';
  if (!form.confirmPassword) return 'Confirm your password.';
  if (!passwordsMatch.value) return 'Passwords do not match.';
  return '';
});

const saveDraft = () => {
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
    currentStep: currentStep.value,
    form: { ...form },
  }));
};

const clearDraft = () => sessionStorage.removeItem(DRAFT_KEY);

const restoreDraft = () => {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    const draft = JSON.parse(raw);

    Object.assign(form, {
      membershipType: draft?.form?.membershipType ?? '',
      subscriptionPlanKey: draft?.form?.subscriptionPlanKey ?? '',
      subscriptionTierId: draft?.form?.subscriptionTierId ?? '',
      firstName: draft?.form?.firstName ?? '',
      lastName: draft?.form?.lastName ?? '',
      username: draft?.form?.username ?? '',
      password: draft?.form?.password ?? '',
      confirmPassword: draft?.form?.confirmPassword ?? '',
      agreed: draft?.form?.agreed ?? false,
      hasReadTerms: draft?.form?.hasReadTerms ?? false,
    });

    if (!isDemoMode && form.membershipType === 'Admin') {
      form.membershipType = '';
    }

    if (!form.subscriptionPlanKey && form.subscriptionTierId) {
      const matchedPlan = subscriptionPlanOptions.value.find((plan) => Number(plan.tierId) === Number(form.subscriptionTierId));
      if (matchedPlan) {
        form.subscriptionPlanKey = matchedPlan.key;
      }
    }

    const restoreIndex = subscriptionPlanOptions.value.findIndex((plan) => plan.key === form.subscriptionPlanKey);
    planCarouselIndex.value = restoreIndex >= 0 ? restoreIndex : 0;

    const requestedStep = Number(draft?.currentStep || 1);
    if (requestedStep >= 3 && form.membershipType && form.subscriptionTierId) {
      currentStep.value = 3;
    } else if (requestedStep >= 2 && form.membershipType) {
      currentStep.value = 2;
    } else {
      currentStep.value = 1;
    }
  } catch {
    clearDraft();
  }
};

watch(
  () => ({ currentStep: currentStep.value, ...form }),
  saveDraft,
  { deep: true }
);

const markAccountInfoTouched = () => {
  touched.firstName = true;
  touched.lastName = true;
  touched.username = true;
  touched.password = true;
  touched.confirmPassword = true;
};

const selectMembershipType = (value) => {
  form.membershipType = value;
  errorMsg.value = '';
};

const selectSubscriptionTier = (value) => {
  const plan = subscriptionPlanOptions.value.find((item) => item.key === value);
  if (!plan || !plan.available) return;
  form.subscriptionPlanKey = plan.key;
  form.subscriptionTierId = plan.tierId;
  errorMsg.value = '';
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
  errorMsg.value = '';
};

const goToNextStep = () => {
  if (!stepOneValid.value) return;
  goToStep(2);
};

const goToAccountInfoStep = () => {
  if (!stepTwoValid.value) return;
  goToStep(3);
};

const openTermsModal = () => {
  showTermsModal.value = true;
  termsReachedBottom.value = false;
};

const closeTermsModal = () => {
  showTermsModal.value = false;
};

const onTermsScroll = (event) => {
  const el = event.target;
  termsReachedBottom.value = el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
};

const agreeToTerms = () => {
  if (!termsReachedBottom.value) return;
  form.hasReadTerms = true;
  form.agreed = true;
  closeTermsModal();
};

const handleTermsCheckboxClick = (event) => {
  if (!form.hasReadTerms) {
    event.preventDefault();
    openTermsModal();
  }
};

const register = async () => {
  if (loading.value) return;

  errorMsg.value = '';
  successMsg.value = '';
  markAccountInfoTouched();

  if (!stepOneValid.value) {
    currentStep.value = 1;
    errorMsg.value = 'Select an account type to continue.';
    return;
  }

  if (!stepTwoValid.value) {
    currentStep.value = 2;
    errorMsg.value = 'Select a subscription type to continue.';
    return;
  }

  if (!stepThreeValid.value) {
    currentStep.value = 3;
    errorMsg.value = 'Complete all required fields and fix validation errors.';
    return;
  }

  if (!form.agreed) {
    errorMsg.value = 'You must agree to the Terms & Policy before registering.';
    return;
  }

  loading.value = true;

  try {
    const response = await axios.post(`${API_BASE}/api/register`, {
      firstName: String(form.firstName || '').trim(),
      lastName: String(form.lastName || '').trim(),
      username: String(form.username || '').trim(),
      password: form.password,
      membershipType: form.membershipType,
      subscriptionTierId: Number(form.subscriptionTierId),
    });

    clearDraft();
    successMsg.value = response.data.message || 'Registration successful!';
    setTimeout(() => {
      router.push({ name: 'login' });
    }, 1500);
  } catch (error) {
    errorMsg.value = error.response?.data?.error || error.message || 'Registration failed.';
  } finally {
    loading.value = false;
  }
};

const loadSubscriptionTiers = async () => {
  tiersLoading.value = true;

  try {
    const response = await axios.get(`${API_BASE}/api/register-tiers`);
    subscriptionTiers.value = Array.isArray(response.data) ? response.data : [];
  } catch {
    subscriptionTiers.value = FALLBACK_TIERS;
  } finally {
    if (form.subscriptionPlanKey) {
      const plan = subscriptionPlanOptions.value.find((item) => item.key === form.subscriptionPlanKey);
      if (plan?.available) {
        form.subscriptionTierId = plan.tierId;
      } else {
        form.subscriptionPlanKey = '';
        form.subscriptionTierId = '';
      }
    }

    tiersLoading.value = false;
  }
};

onMounted(() => {
  restoreDraft();
  loadSubscriptionTiers();
});
</script>

<template>
  <div class="login-body auth-card" :class="{ 'step2-compact': currentStep === 2, 'step3-form': currentStep === 3 }">
    <div class="top d-flex justify-content-between align-items-center auth-header">
      <div class="logo auth-logo-wrap">
        <img src="@/assets/images/flex-fitlogo-transparent.png" alt="Logo">
      </div>
      <router-link to="/"><i class="fa-duotone fa-house-chimney"></i></router-link>
    </div>

    <div class="bottom auth-content">
      <h3 class="panel-title panel-title-form auth-title">User Registration</h3>

      <div class="wizard-progress" aria-label="Registration steps">
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

      <form @submit.prevent="register" class="auth-form">
        <transition name="step-slide" mode="out-in">
          <section v-if="currentStep === 1" key="step-1" class="wizard-panel">
            <p class="wizard-subtitle">Choose the type of WorkoutAtlas account you want to create.</p>

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
              <router-link to="/login" class="btn btn-outline-secondary auth-button auth-button-back step1-back-link">
                Back
              </router-link>
              <button type="button" class="btn btn-primary auth-button" :disabled="!stepOneValid" @click="goToNextStep">
                Next
              </button>
            </div>
          </section>

          <section v-else-if="currentStep === 2" key="step-2" class="wizard-panel wizard-panel-step2">
            <h4 class="subscription-step-title">Choose Your Subscription</h4>

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
              <span class="subscription-indicator-count">{{ planCarouselIndex + 1 }} of {{ subscriptionPlanOptions.length }}</span>
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

            <div class="wizard-actions wizard-actions-step2">
              <button type="button" class="btn btn-outline-secondary auth-button auth-button-back" @click="goToStep(1)">
                Back
              </button>
              <button type="button" class="btn btn-primary auth-button" :disabled="!stepTwoValid" @click="goToAccountInfoStep">
                Next
              </button>
            </div>
          </section>

          <section v-else key="step-3" class="wizard-panel wizard-panel-step3">
            <p class="wizard-subtitle">Enter your account details and confirm your agreement to continue.</p>

            <div class="d-grid gap-2 mb-2 step3-summary-grid">
              <div class="selected-account-pill mb-0">
                <span class="selected-account-label">Account Type</span>
                <span class="selected-account-value">{{ form.membershipType }}</span>
              </div>
              <div class="selected-account-pill mb-0">
                <span class="selected-account-label">Subscription Type</span>
                <span class="selected-account-value">{{ selectedSubscriptionLabel }}</span>
              </div>
            </div>

            <div class="step3-fields-grid">
              <div class="step3-field-block">
                <div class="input-group mb-2 input-group-rounded auth-form-group">
                  <span class="input-group-text auth-input-icon"><i class="fa-regular fa-user"></i></span>
                  <input v-model="form.firstName" type="text" class="form-control form-control-rounded auth-input" placeholder="First Name" @blur="touched.firstName = true" required>
                </div>
                <div v-if="firstNameError" class="auth-field-error">{{ firstNameError }}</div>
              </div>

              <div class="step3-field-block">
                <div class="input-group mb-2 input-group-rounded auth-form-group">
                  <span class="input-group-text auth-input-icon"><i class="fa-regular fa-user"></i></span>
                  <input v-model="form.lastName" type="text" class="form-control form-control-rounded auth-input" placeholder="Last Name" @blur="touched.lastName = true" required>
                </div>
                <div v-if="lastNameError" class="auth-field-error">{{ lastNameError }}</div>
              </div>

              <div class="step3-field-block step3-field-block-full">
                <div class="input-group mb-2 input-group-rounded auth-form-group">
                  <span class="input-group-text auth-input-icon"><i class="fa-regular fa-envelope"></i></span>
                  <input v-model="form.username" type="email" class="form-control form-control-rounded auth-input" placeholder="Email" @blur="touched.username = true" required>
                </div>
                <div v-if="emailError" class="auth-field-error">{{ emailError }}</div>
              </div>

              <div class="step3-field-block">
                <div class="input-group mb-2 input-group-rounded auth-form-group">
                  <span class="input-group-text auth-input-icon"><i class="fa-regular fa-lock"></i></span>
                  <input v-model="form.password" :type="isPasswordShow ? 'text' : 'password'" class="form-control form-control-rounded auth-input" placeholder="Password" @blur="touched.password = true" required>
                  <button type="button" class="auth-password-toggle" :aria-label="isPasswordShow ? 'Hide password' : 'Show password'" @click="isPasswordShow = !isPasswordShow">
                    <i class="fa-duotone" :class="[isPasswordShow ? 'fa-eye-slash':'fa-eye']"></i>
                  </button>
                </div>
                <div v-if="passwordError" class="auth-field-error">{{ passwordError }}</div>
              </div>

              <div class="step3-field-block">
                <div class="input-group mb-2 input-group-rounded auth-form-group">
                  <span class="input-group-text auth-input-icon"><i class="fa-regular fa-lock"></i></span>
                  <input v-model="form.confirmPassword" :type="isConfirmPasswordShow ? 'text' : 'password'" class="form-control form-control-rounded auth-input" placeholder="Confirm Password" @blur="touched.confirmPassword = true" required>
                  <button type="button" class="auth-password-toggle" :aria-label="isConfirmPasswordShow ? 'Hide confirm password' : 'Show confirm password'" @click="isConfirmPasswordShow = !isConfirmPasswordShow">
                    <i class="fa-duotone" :class="[isConfirmPasswordShow ? 'fa-eye-slash':'fa-eye']"></i>
                  </button>
                </div>
                <div v-if="confirmPasswordError" class="auth-field-error">{{ confirmPasswordError }}</div>
              </div>
            </div>

            <div class="mt-2 auth-subtitle auth-password-strength" v-if="showStrengthMeter">
              <p class="mb-1">Password strength: <strong :class="passwordStrengthClass">{{ passwordStrength }}</strong></p>
              <ul class="mb-0">
                <li :class="{ 'text-success': passwordChecks.length }">Min 8 characters</li>
                <li :class="{ 'text-success': passwordChecks.uppercase }">1 uppercase letter</li>
                <li :class="{ 'text-success': passwordChecks.number }">1 number</li>
                <li :class="{ 'text-success': passwordChecks.specialChar }">1 special character</li>
              </ul>
            </div>

            <div class="terms-box">
              <div class="form-check terms-check-row">
                <input
                  id="agreeCheckbox"
                  v-model="form.agreed"
                  class="form-check-input"
                  type="checkbox"
                  :disabled="!form.hasReadTerms"
                  @click="handleTermsCheckboxClick"
                >
                <label class="form-check-label terms-label" for="agreeCheckbox">
                  I agree to
                  <button type="button" class="terms-link" @click.stop="openTermsModal">Terms &amp; Policy</button>
                </label>
              </div>
              <p class="terms-hint mb-0">
                <span v-if="form.hasReadTerms">You can uncheck this box before submitting if needed.</span>
                <span v-else>Review the Terms &amp; Policy in the modal to enable agreement.</span>
              </p>
            </div>

            <div v-if="errorMsg" class="alert alert-danger mt-3 mb-2">{{ errorMsg }}</div>
            <div v-if="successMsg" class="alert alert-success mt-3 mb-2">{{ successMsg }}</div>

            <div class="wizard-actions wizard-actions-step3">
              <button type="button" class="btn btn-outline-secondary auth-button auth-button-back" :disabled="loading" @click="goToStep(2)">
                Back
              </button>
              <button class="btn btn-primary auth-button" :disabled="!canSubmit">
                <span v-if="loading" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                {{ loading ? 'Creating Account...' : 'Sign Up' }}
              </button>
            </div>
          </section>
        </transition>
      </form>

      <div class="other-option mt-2 auth-subtitle auth-footer">
        <p class="mb-0 auth-text">Already have an account?
          <router-link to="/login" class="auth-link">Login</router-link>
        </p>
      </div>
    </div>

    <div v-if="showTermsModal" class="terms-modal-backdrop" @click.self="closeTermsModal">
      <div class="terms-modal" role="dialog" aria-modal="true" aria-label="Terms and Policy">
        <div class="terms-modal-header">
          <h5 class="mb-0">Terms &amp; Policy</h5>
          <button type="button" class="btn-close" aria-label="Close" @click="closeTermsModal"></button>
        </div>

        <div class="terms-modal-body" @scroll="onTermsScroll">
          <p><strong>Welcome to WorkoutAtlas.</strong> Please review the following terms before creating your account.</p>
          <p>By using WorkoutAtlas, you agree to provide accurate account information, keep your credentials secure, and use the platform in accordance with applicable laws and acceptable-use expectations.</p>
          <p>Your account type determines available features and access. Demo-only administrative access is intended strictly for testing and internal review scenarios.</p>
          <p>Fitness content, schedules, and recommendations available through WorkoutAtlas are intended for informational purposes and do not replace professional medical advice.</p>
          <p>You are responsible for reviewing your workouts, training plans, and personal profile details before relying on any in-app recommendations.</p>
          <p>We may store account information necessary to operate the service, support authentication, and improve product reliability and onboarding flows.</p>
          <p>Passwords must meet security requirements to help protect your account. You should never share your credentials with other users.</p>
          <p>Abuse of demo access, attempts to bypass security controls, or misuse of role-based features may result in removal of access.</p>
          <p>By continuing, you confirm that you understand WorkoutAtlas is evolving and that some features may change as the product improves.</p>
          <p>Continue scrolling to the end of these terms to enable the agreement button.</p>
          <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Cras fermentum orci at nibh dignissim, vitae vulputate nunc porta. Integer accumsan, velit ut cursus vehicula, magna libero pulvinar nunc, non commodo augue velit et massa.</p>
          <p>Vivamus luctus, est sed blandit imperdiet, risus eros pellentesque nibh, in congue est lacus sed augue. Nullam sed arcu quis neque porttitor vestibulum. In hac habitasse platea dictumst.</p>
          <p>Morbi sit amet mauris id ipsum pretium gravida. Suspendisse quis ullamcorper lorem. Fusce varius hendrerit orci, a luctus turpis tincidunt at. Donec ut ultrices erat.</p>
          <p>Ut semper viverra tortor, ac gravida dui cursus a. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Sed a lorem sed lacus pulvinar faucibus.</p>
        </div>

        <div class="terms-modal-footer">
          <button type="button" class="btn btn-outline-secondary auth-button auth-button-back" @click="closeTermsModal">Close</button>
          <button type="button" class="btn btn-primary auth-button" :disabled="!termsReachedBottom" @click="agreeToTerms">Agree</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.light-theme .main-content .login-body {
  background: rgba(255, 255, 255, 1);
  border: 1px solid black;
}

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

.login-body.step2-compact .auth-header {
  margin-bottom: 2px;
}

.login-body.step2-compact .auth-title {
  margin-top: 4px;
  margin-bottom: 8px;
}

.login-body.step2-compact .wizard-progress {
  margin-bottom: 10px;
  padding-top: 0;
}

.login-body.step2-compact .wizard-panel-step2 {
  min-height: auto;
}

.login-body.step2-compact .wizard-panel-step2 .subscription-step-title {
  margin: 0 0 2px;
}

.login-body.step2-compact .wizard-panel-step2 .wizard-subtitle {
  margin-bottom: 8px;
}

.login-body.step2-compact .wizard-panel-step2 .selected-account-pill {
  margin-bottom: 10px;
  padding-top: 6px;
  padding-bottom: 6px;
}

.login-body.step2-compact .wizard-panel-step2 .subscription-carousel-wrap {
  margin-top: 0;
  margin-bottom: 8px;
}

.login-body.step2-compact .wizard-panel-step2 .subscription-card {
  padding: 12px 10px;
}

.login-body.step2-compact .wizard-panel-step2 .subscription-feature-list {
  margin: 8px 0;
}

.login-body.step2-compact .wizard-panel-step2 .subscription-indicator-wrap {
  margin-top: 4px;
  gap: 4px;
}

.login-body.step2-compact .wizard-panel-step2 .wizard-actions-step2 {
  margin-top: 8px;
}

.login-body.step2-compact .other-option.auth-footer {
  margin-top: 6px !important;
}

.login-body.step3-form {
  padding: 18px 20px 16px !important;
  max-height: none;
  overflow-y: visible;
  overflow-x: visible;
}

.login-body.step3-form .auth-header {
  margin-bottom: 0;
}

.login-body.step3-form .top.auth-header .logo.auth-logo-wrap {
  padding-bottom: 0 !important;
  margin-bottom: 0 !important;
}

.login-body.step3-form .top.auth-header .logo.auth-logo-wrap img {
  margin: 0 auto 5px !important;
}

.login-body.step3-form .auth-content {
  padding-top: 5px;
}

.login-body.step3-form .auth-title {
  margin-top: 0;
}

.login-body.step3-form .wizard-panel-step3 {
  min-height: auto;
}

.login-body.step3-form .wizard-panel-step3 .wizard-subtitle {
  margin-bottom: 10px;
}

.login-body.step3-form .wizard-panel-step3 .step3-summary-grid {
  gap: 8px !important;
  margin-bottom: 8px !important;
}

.login-body.step3-form .wizard-panel-step3 .selected-account-pill {
  margin-bottom: 0;
}

.login-body.step3-form .wizard-panel-step3 .step3-fields-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0;
}

.login-body.step3-form .wizard-panel-step3 .step3-field-block {
  min-width: 0;
}

.login-body.step3-form .wizard-panel-step3 .step3-field-block .auth-field-error {
  margin-top: -2px;
}

.login-body.step3-form .wizard-panel-step3 .auth-form-group {
  background: #252E48 !important;
  border: 1px solid rgba(145, 160, 200, 0.32) !important;
  border-radius: 12px !important;
  min-height: 52px;
  margin-bottom: 6px !important;
}

.login-body.step3-form .wizard-panel-step3 .auth-form-group:focus-within {
  border-color: #2F6BFF !important;
  box-shadow: 0 0 0 3px rgba(47, 107, 255, 0.22);
}

.login-body.step3-form .wizard-panel-step3 .auth-input-icon,
.login-body.step3-form .wizard-panel-step3 .auth-input,
.login-body.step3-form .wizard-panel-step3 .auth-password-toggle {
  background: #252E48 !important;
  color: #F7F9FF !important;
}

.login-body.step3-form .wizard-panel-step3 .auth-input-icon {
  border-right: 1px solid rgba(145, 160, 200, 0.32) !important;
}

.login-body.step3-form .wizard-panel-step3 .auth-input {
  min-height: 52px;
  border: 0 !important;
  box-shadow: none !important;
  font-family: inherit;
  font-size: 16px;
  font-weight: 500;
  color: #F7F9FF !important;
}

.login-body.step3-form .wizard-panel-step3 .auth-input::placeholder {
  font-family: inherit;
  font-size: 16px;
  font-weight: 500;
  color: #A8B4CA !important;
  opacity: 1;
}

.login-body.step3-form .wizard-panel-step3 .auth-password-toggle {
  border-left: 1px solid rgba(145, 160, 200, 0.32) !important;
  border-radius: 0 !important;
  min-height: 52px;
  padding: 0 12px;
}

.login-body.step3-form .wizard-panel-step3 .auth-password-toggle:hover {
  color: #DCE5FF !important;
}

.login-body.step3-form .wizard-panel-step3 .auth-password-strength {
  margin-top: 2px;
  margin-bottom: 10px;
}

.login-body.step3-form .wizard-panel-step3 .terms-box {
  background: #F5F8FC;
  border: 1px solid #C9D9EA;
  color: #1B2444;
  margin-top: 8px;
  padding: 10px 12px;
}

.login-body.step3-form .wizard-panel-step3 .terms-check-row {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.login-body.step3-form .wizard-panel-step3 .terms-check-row .form-check-input {
  margin-top: 0;
  width: 22px;
  height: 22px;
  min-width: 22px;
  min-height: 22px;
  border-radius: 4px;
  border: 1.5px solid #6F819C;
  background: #FFFFFF;
  accent-color: #2F6BFF;
}

.login-body.step3-form .wizard-panel-step3 .terms-label,
.login-body.step3-form .wizard-panel-step3 .terms-hint {
  font-family: inherit;
  color: #1B2444 !important;
}

.login-body.step3-form .wizard-panel-step3 .terms-label {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  font-size: 0.95rem;
  line-height: 1.25;
}

.login-body.step3-form .wizard-panel-step3 .terms-link {
  color: #1B2444;
}

.login-body.step3-form .wizard-panel-step3 .terms-link:hover {
  color: #0E1C42;
}

.login-body.step3-form .wizard-panel-step3 .wizard-actions-step3 {
  margin-top: 10px;
}

.login-body.step3-form .wizard-panel-step3 .wizard-actions-step3 .auth-button-back {
  background: #FFFFFF;
  color: #1B2444;
  border: 2px solid #C9D9EA;
  background-image: none !important;
  box-shadow: none !important;
}

.login-body.step3-form .wizard-panel-step3 .wizard-actions-step3 .auth-button-back:hover:not(:disabled) {
  background: #F5F8FF;
  border-color: #AFCBE7;
  color: #1B2444;
}

.login-body.step3-form .wizard-panel-step3 .wizard-actions-step3 .btn.btn-primary {
  background: #2F6BFF !important;
  color: #FFFFFF !important;
  border: none !important;
  background-image: none !important;
  box-shadow: none !important;
}

.login-body.step3-form .wizard-panel-step3 .wizard-actions-step3 .btn.btn-primary:hover:not(:disabled) {
  background: #2459D8 !important;
}

.login-body.step3-form .wizard-panel-step3 .wizard-actions-step3 .btn.btn-primary:disabled {
  background: #8F9BB5 !important;
  color: #E8EDF5 !important;
  border: none !important;
  opacity: 1;
}

.login-body.step3-form .auth-footer {
  margin-top: 8px;
}

@media (max-width: 767.98px) {
  .login-body.step3-form {
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
    margin-top: 0;
    margin-bottom: 0;
    padding: 10px 10px calc(22px + env(safe-area-inset-bottom, 0px)) !important;
  }

  .login-body.step3-form .auth-content {
    padding-top: 2px;
  }

  .login-body.step3-form .auth-title {
    margin-bottom: 6px;
  }

  .login-body.step3-form .wizard-progress {
    margin-bottom: 6px;
  }

  .login-body.step3-form .wizard-step {
    gap: 6px;
  }

  .login-body.step3-form .wizard-step-number {
    width: 24px;
    height: 24px;
    font-size: 0.76rem;
  }

  .login-body.step3-form .wizard-step-text {
    font-size: 0.68rem;
    line-height: 1.05;
  }

  .login-body.step3-form .wizard-progress-track {
    top: 13px;
    left: 34px;
    right: 34px;
  }

  .login-body.step3-form .wizard-panel-step3 .wizard-subtitle {
    margin-bottom: 4px;
    font-size: 0.78rem;
    line-height: 1.2;
  }

  .login-body.step3-form .wizard-panel-step3 .step3-summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 4px !important;
    margin-bottom: 4px !important;
  }

  .login-body.step3-form .wizard-panel-step3 .selected-account-pill {
    padding: 7px 8px;
  }

  .login-body.step3-form .top.auth-header .logo.auth-logo-wrap img {
    width: 164px !important;
    max-width: 64% !important;
    margin: 0 auto 4px !important;
  }

  .login-body.step3-form .wizard-panel-step3 .auth-form-group {
    min-height: 48px;
    margin-bottom: 2px !important;
  }

  .login-body.step3-form .wizard-panel-step3 .auth-input,
  .login-body.step3-form .wizard-panel-step3 .auth-password-toggle {
    min-height: 48px;
  }

  .login-body.step3-form .wizard-panel-step3 .auth-field-error {
    margin-bottom: 3px;
    font-size: 0.72rem;
  }

  .login-body.step3-form .wizard-panel-step3 .auth-password-strength {
    margin-top: 0;
    margin-bottom: 5px;
    font-size: 0.76rem;
  }

  .login-body.step3-form .wizard-panel-step3 .terms-box {
    margin-top: 4px;
    padding: 6px 8px;
  }

  .login-body.step3-form .wizard-panel-step3 .terms-check-row {
    gap: 7px;
    margin-bottom: 3px;
  }

  .login-body.step3-form .wizard-panel-step3 .terms-check-row .form-check-input {
    width: 20px;
    height: 20px;
    min-width: 20px;
    min-height: 20px;
  }

  .login-body.step3-form .wizard-panel-step3 .terms-label {
    font-size: 0.84rem;
    line-height: 1.15;
  }

  .login-body.step3-form .wizard-panel-step3 .terms-hint {
    font-size: 0.74rem;
    line-height: 1.15;
  }

  .login-body.step3-form .wizard-panel-step3 .wizard-actions-step3 {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin-top: 6px;
    margin-bottom: max(14px, calc(14px + env(safe-area-inset-bottom, 0px)));
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }

  .login-body.step3-form .wizard-panel-step3 .wizard-actions-step3 .auth-button-back,
  .login-body.step3-form .wizard-panel-step3 .wizard-actions-step3 .btn.btn-primary {
    min-height: 48px;
    width: 100%;
  }

  .login-body.step3-form .auth-footer {
    margin-top: 4px !important;
    margin-bottom: max(6px, env(safe-area-inset-bottom, 0px));
    padding-top: 0;
  }

  .login-body.step3-form .auth-footer .auth-text,
  .login-body.step3-form .auth-footer .auth-link {
    font-size: 14px;
    line-height: 1.15;
  }
}

@media (min-width: 768px) {
  .login-body.step3-form {
    max-width: 620px;
    padding: 16px 18px 14px !important;
  }

  .login-body.step3-form .auth-title {
    margin-bottom: 8px;
  }

  .login-body.step3-form .wizard-progress {
    margin-bottom: 10px;
    padding-top: 0;
  }

  .login-body.step3-form .wizard-panel-step3 .wizard-subtitle {
    margin-bottom: 8px;
  }

  .login-body.step3-form .wizard-panel-step3 .step3-summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px !important;
    margin-bottom: 8px !important;
  }

  .login-body.step3-form .wizard-panel-step3 .step3-fields-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 12px;
    row-gap: 6px;
  }

  .login-body.step3-form .wizard-panel-step3 .step3-field-block-full,
  .login-body.step3-form .wizard-panel-step3 .auth-password-strength,
  .login-body.step3-form .wizard-panel-step3 .terms-box,
  .login-body.step3-form .wizard-panel-step3 .alert,
  .login-body.step3-form .wizard-panel-step3 .wizard-actions-step3 {
    grid-column: 1 / -1;
  }

  .login-body.step3-form .wizard-panel-step3 .auth-form-group {
    margin-bottom: 2px !important;
  }

  .login-body.step3-form .wizard-panel-step3 .auth-field-error {
    margin-bottom: 2px;
  }

  .login-body.step3-form .wizard-panel-step3 .auth-password-strength {
    margin-top: 0;
    margin-bottom: 8px;
  }

  .login-body.step3-form .wizard-panel-step3 .terms-box {
    margin-top: 6px;
    padding: 9px 12px;
  }

  .login-body.step3-form .wizard-panel-step3 .wizard-actions-step3 {
    margin-top: 8px;
    margin-bottom: 0;
  }

  .login-body.step3-form .auth-footer {
    margin-top: 6px;
  }
}

.login-body.step3-form .auth-footer .auth-text {
  font-family: inherit;
  font-size: 16px;
  font-weight: 500;
  color: #5F6B7C !important;
}

.login-body.step3-form .auth-footer .auth-link {
  font-family: inherit;
  font-size: 16px;
  font-weight: 600;
  color: #2F6BFF;
  text-decoration: none;
}

.login-body.step3-form .auth-footer .auth-link:hover,
.login-body.step3-form .auth-footer .auth-link:focus-visible {
  text-decoration: underline;
}

.panel-title {
  color: white;
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

.auth-logo-wrap {
  width: 100%;
  display: flex;
  justify-content: center;
}

.login-body .top.auth-header {
  height: auto !important;
  min-height: 0 !important;
  padding: 0 !important;
}

.login-body .top.auth-header .logo.auth-logo-wrap {
  width: 100% !important;
  max-width: none !important;
  display: block;
  margin: 0 auto;
}

.login-body .top.auth-header .logo.auth-logo-wrap img {
  width: 300px !important;
  max-width: 70% !important;
  height: auto !important;
  display: block;
  margin: 0 auto 20px;
  object-fit: contain;
  transform: none !important;
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
  transition: all 0.22s ease;
  position: relative;
  z-index: 1;
}

.wizard-step.active .wizard-step-number,
.wizard-step.complete .wizard-step-number {
  background: #0D99FF;
  border-color: #0D99FF;
  color: #fff;
}

.wizard-step-text {
  font-size: 0.82rem;
  font-weight: 600;
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

.wizard-step-text {
  font-size: 0.78rem;
  font-weight: 600;
  text-align: center;
  line-height: 1.15;
}

.wizard-panel {
  min-height: 460px;
}

.wizard-subtitle {
  font-size: 0.84rem;
  color: rgba(0, 0, 0, 0.66);
  text-align: center;
  margin-bottom: 14px;
}

.subscription-step-title {
  text-align: center;
  font-size: 1rem;
  font-weight: 700;
  margin: 0 0 4px;
  color: rgba(0, 0, 0, 0.82);
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

.account-type-card:focus-visible {
  outline: 3px solid rgba(47, 107, 255, 0.42);
  outline-offset: 2px;
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

.selected-account-pill {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border: 1px solid rgba(13, 153, 255, 0.2);
  background: rgba(13, 153, 255, 0.06);
  border-radius: 10px;
  padding: 8px 10px;
  margin-bottom: 10px;
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

.input-group-rounded {
  display: flex;
  align-items: center;
  border: 1.5px solid rgba(13, 153, 255, 0.5);
  border-radius: 9px;
  overflow: hidden;
  transition: all 0.3s ease;
  padding: 0;
  background: transparent;
}

.input-group-rounded:focus-within {
  border-color: #0D99FF;
  box-shadow: 0 0 0 4px rgba(13, 153, 255, 0.25);
}

.form-control-rounded {
  border: none !important;
  border-radius: 0 !important;
  flex: 1;
  padding: 10px 12px !important;
  min-height: 42px;
  font-size: 0.92rem;
}

.input-group-rounded .input-group-text {
  border: none !important;
  border-right: 1px solid rgba(13, 153, 255, 0.3) !important;
  background: transparent !important;
  border-radius: 0 !important;
  padding: 0 10px !important;
  min-width: auto !important;
  font-size: 0.9rem;
}

.auth-password-toggle {
  border: none !important;
  border-left: 1px solid rgba(13, 153, 255, 0.3) !important;
  background: transparent !important;
  color: #74819e;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 10px;
  min-height: 42px;
  cursor: pointer;
}

.auth-password-toggle:hover {
  color: #0D99FF;
}

.auth-form-group {
  margin-bottom: 4px !important;
}

.auth-field-error {
  color: #c0392b;
  font-size: 0.76rem;
  margin: 0 0 8px 4px;
}

.auth-subtitle,
.auth-subtitle p,
.auth-subtitle li {
  font-size: 0.84rem;
}

.auth-subtitle ul {
  padding-left: 1rem;
}

.auth-password-strength {
  margin-bottom: 12px;
}

.terms-box {
  border: 1px solid rgba(13, 153, 255, 0.18);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.65);
  padding: 10px 12px;
  margin-top: 10px;
}

.terms-check-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.terms-check-row .form-check-input {
  margin-top: 0;
  flex-shrink: 0;
}

.terms-label {
  color: rgba(0, 0, 0, 0.8) !important;
  font-size: 0.85rem;
}

.terms-link {
  border: 0;
  background: transparent;
  color: rgba(0, 0, 0, 0.82);
  text-decoration: underline;
  padding: 0;
  margin-left: 4px;
  font-size: 0.85rem;
}

.terms-link:hover {
  color: #000;
}

.terms-hint {
  color: rgba(0, 0, 0, 0.58);
  font-size: 0.76rem;
}

.wizard-actions {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 10px;
  margin-top: 14px;
}

.wizard-actions-single {
  grid-template-columns: 1fr;
}

.wizard-actions-step1 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.auth-button {
  min-height: 40px;
  padding-top: 8px;
  padding-bottom: 8px;
  font-size: 0.92rem;
  border-radius: 8px;
}

.wizard-actions .btn.btn-primary,
.wizard-actions-single .btn.btn-primary {
  background: #2F6BFF !important;
  color: #FFFFFF !important;
  border: none !important;
}

.wizard-actions .btn.btn-primary:hover:not(:disabled),
.wizard-actions-single .btn.btn-primary:hover:not(:disabled) {
  background: #2459D8 !important;
  border: none !important;
}

.wizard-actions .btn.btn-primary:disabled,
.wizard-actions-single .btn.btn-primary:disabled {
  background: #596782 !important;
  color: #C7D0E3 !important;
  border: none !important;
  opacity: 0.75;
  cursor: not-allowed;
}

.wizard-actions .btn.btn-primary:focus-visible,
.wizard-actions-single .btn.btn-primary:focus-visible {
  outline: 3px solid rgba(47, 107, 255, 0.42);
  outline-offset: 2px;
}

.wizard-actions .btn.btn-primary,
.wizard-actions-single .btn.btn-primary {
  background: #2F6BFF;
  border-color: #2F6BFF;
  color: #FFFFFF;
}

.wizard-actions .btn.btn-primary:hover:not(:disabled),
.wizard-actions-single .btn.btn-primary:hover:not(:disabled) {
  background: #2459D8;
  border-color: #2459D8;
}

.wizard-actions .btn.btn-primary:disabled,
.wizard-actions-single .btn.btn-primary:disabled {
  background: #8F9BB5;
  border-color: #8F9BB5;
  color: #E8EDF5;
  opacity: 0.65;
  cursor: not-allowed;
}

.auth-button-back {
  border-color: rgba(58, 79, 118, 0.24);
}

.wizard-actions-step2 .auth-button-back {
  background: #FFFFFF;
  border: 2px solid #C9D9EA;
  color: #1B2444;
  box-shadow: none !important;
}

.wizard-actions-step1 .auth-button-back {
  background: #FFFFFF;
  border: 2px solid #C9D9EA;
  color: #1B2444;
  box-shadow: none !important;
}

.wizard-actions-step1 .auth-button-back:hover:not(:disabled) {
  background: #F5F8FF;
  border-color: #2F6BFF;
  color: #1B2444;
}

.step1-back-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
}

.wizard-actions-step2 .auth-button-back:hover:not(:disabled) {
  background: #F5F8FF;
  border-color: #2F6BFF;
  color: #1B2444;
}

.wizard-actions-step2 .btn.btn-primary {
  background: #2F6BFF !important;
  color: #FFFFFF !important;
  border: none !important;
  background-image: none !important;
  box-shadow: none !important;
}

.wizard-actions-step2 .btn.btn-primary:hover:not(:disabled) {
  background: #2459D8 !important;
}

.wizard-actions-step2 .btn.btn-primary:disabled {
  background: #8F9BB5 !important;
  color: #E8EDF5 !important;
  opacity: 0.7;
  cursor: not-allowed;
}

.auth-text {
  color: rgba(0, 0, 0, 0.75);
  font-size: 0.85rem;
}

.auth-link {
  color: rgba(0, 0, 0, 0.85);
  text-decoration: underline;
  font-size: 0.85rem;
}

.auth-footer {
  margin-top: 10px;
}

.terms-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(7, 23, 57, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 2000;
}

.terms-modal {
  width: min(92vw, 620px);
  max-height: 82vh;
  background: rgba(255, 255, 255, 0.98);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.22);
  display: flex;
  flex-direction: column;
}

.terms-modal-header,
.terms-modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(13, 153, 255, 0.14);
}

.terms-modal-footer {
  border-bottom: 0;
  border-top: 1px solid rgba(13, 153, 255, 0.14);
}

.terms-modal-body {
  padding: 16px;
  overflow-y: auto;
  font-size: 0.9rem;
  line-height: 1.5;
  color: rgba(0, 0, 0, 0.82);
}

.terms-modal-body p + p {
  margin-top: 0.9rem;
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
  .wizard-actions-step1 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .login-body {
    padding: 18px !important;
  }

  .login-body .top.auth-header .logo.auth-logo-wrap {
    width: 100% !important;
    max-width: none !important;
  }

  .login-body .top.auth-header .logo.auth-logo-wrap img {
    width: 240px !important;
    max-width: 85% !important;
    height: auto !important;
    display: block;
    margin: 0 auto 20px;
    object-fit: contain;
    transform: none !important;
  }

  .login-body.step2-compact {
    padding: 14px 14px 12px !important;
  }

  .login-body.step2-compact .wizard-panel-step2 .subscription-carousel-wrap {
    margin-bottom: 6px;
  }

  .login-body.step2-compact .wizard-panel-step2 .wizard-actions-step2 {
    margin-top: 6px;
  }

  .login-body.step3-form {
    padding: 10px 10px calc(22px + env(safe-area-inset-bottom, 0px)) !important;
    max-height: none;
    overflow-y: visible;
    overflow-x: visible;
  }

  .login-body.step3-form .auth-header {
    margin-bottom: 0;
  }

  .login-body.step3-form .top.auth-header .logo.auth-logo-wrap {
    padding-bottom: 0 !important;
    margin-bottom: 0 !important;
  }

  .login-body.step3-form .auth-content {
    padding-top: 2px;
  }

  .login-body.step3-form .auth-title {
    margin-top: 0;
    margin-bottom: 6px;
  }

  .login-body.step3-form .wizard-progress {
    margin-bottom: 6px;
    padding-top: 0;
  }

  .login-body.step3-form .wizard-panel-step3 .wizard-subtitle {
    margin-bottom: 4px;
    font-size: 0.78rem;
    line-height: 1.2;
  }

  .login-body.step3-form .wizard-panel-step3 .step3-summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 4px !important;
    margin-bottom: 4px !important;
  }

  .login-body.step3-form .wizard-panel-step3 .auth-form-group {
    min-height: 48px;
    margin-bottom: 2px !important;
  }

  .login-body.step3-form .wizard-panel-step3 .auth-input,
  .login-body.step3-form .wizard-panel-step3 .auth-password-toggle {
    min-height: 48px;
  }

  .login-body.step3-form .wizard-panel-step3 .auth-field-error {
    margin-bottom: 3px;
    font-size: 0.72rem;
  }

  .login-body.step3-form .wizard-panel-step3 .auth-password-strength {
    margin-bottom: 5px;
    font-size: 0.76rem;
  }

  .login-body.step3-form .wizard-panel-step3 .terms-box {
    margin-top: 4px;
    padding: 6px 8px;
  }

  .login-body.step3-form .wizard-panel-step3 .wizard-actions-step3 {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin-top: 6px;
    margin-bottom: max(14px, calc(14px + env(safe-area-inset-bottom, 0px)));
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }

  .login-body.step3-form .auth-footer {
    margin-top: 4px !important;
    margin-bottom: max(6px, env(safe-area-inset-bottom, 0px));
    padding-top: 0;
  }

  .login-body.step3-form .top.auth-header .logo.auth-logo-wrap img {
    width: 164px !important;
    max-width: 64% !important;
    height: auto !important;
    margin: 0 auto 4px !important;
  }

  .login-body.step3-form .logo.auth-logo-wrap {
    width: 100% !important;
    max-width: none !important;
    justify-content: center !important;
  }

  .wizard-panel {
    min-height: auto;
  }

  .wizard-step-text {
    font-size: 0.76rem;
  }

  .wizard-progress-track {
    left: 28px;
    right: 28px;
  }

  .wizard-actions:not(.wizard-actions-step1) {
    grid-template-columns: 1fr;
  }

  .account-type-card {
    grid-template-columns: 36px 1fr 22px;
    padding: 10px;
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
