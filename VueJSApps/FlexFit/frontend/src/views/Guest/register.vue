<script setup>
import { ref, watch, computed, onMounted } from "vue";
import axios from "axios";
import { useRouter, useRoute } from "vue-router";
import { API_BASE } from '@/config/env';


const router = useRouter();
const route = useRoute();

const firstName = ref("");
const lastName = ref("");
const username = ref("");
const password = ref("");
const confirmPassword = ref("");
const isPasswordShow = ref(false);
const isConfirmPasswordShow = ref(false);
const agreed = ref(false);
const hasReadTerms = ref(false);

const errorMsg = ref("");
const successMsg = ref("");



const loading = ref(false);

//LIVE PASSWORD FEEDBACK TOOL
const passwordStrength = ref('');
const passwordChecks = ref({
  length: false,
  uppercase: false,
  number: false,
  specialChar: false,
});

const showStrengthMeter = computed(() => password.value.length > 0);

const passwordStrengthClass = computed(() => {
  if (passwordStrength.value === 'Weak') return 'text-danger';
  if (passwordStrength.value === 'Medium') return 'text-warning';
  if (passwordStrength.value === 'Strong') return 'text-success';
  return '';
});

watch(password, (value) => {
  passwordChecks.value.length = value.length >= 8;
  passwordChecks.value.uppercase = /[A-Z]/.test(value);
  passwordChecks.value.number = /\d/.test(value);
  passwordChecks.value.specialChar = /[!@#$%^&*(),.?":{}|<>]/.test(value);

  const passed = Object.values(passwordChecks.value).filter(v => v).length;
  passwordStrength.value =
    passed <= 1 ? 'Weak' :
    passed <= 3 ? 'Medium' :
    'Strong';
});

//Live Password Feedback Tool

const register = async () => {
  errorMsg.value = "";
  successMsg.value = "";
  loading.value = true;

  if (!hasReadTerms.value) {
    errorMsg.value = "You must read the Terms & Policy before registering.";
    loading.value = false;
    return;
  }

  if (!agreed.value) {
    errorMsg.value = "You must agree to the Terms & Policy.";
    loading.value = false;
    return;
  }

  if (password.value !== confirmPassword.value) {
    errorMsg.value = "Passwords do not match.";
    loading.value = false;
    return;
  }

  //PW Strength test
  const isStrongPassword = (pw) => {
  const strongPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
  return strongPattern.test(pw);
};


//Strength test
if (!isStrongPassword(password.value)) {
  errorMsg.value =
    "Password must be at least 8 characters long and include a number, uppercase letter, and special character.";
  loading.value = false;
  return;
}



  try {
    const response = await axios.post(`${API_BASE}/api/register`, {
      firstName: firstName.value,
      lastName: lastName.value,
      username: username.value,
      password: password.value,
    });

    successMsg.value = response.data.message || "Registration successful!";
    setTimeout(() => {
      router.push({ name: "login" });
    }, 2000);
  } catch (error) {
    errorMsg.value = error.response?.data?.error || error.message || "Registration failed.";
  } finally {
    loading.value = false;
  }
};

const goToTerms = () => {
  router.push({ name: 'terms_policy' });
};

onMounted(() => {
  if (route.query.termsAccepted === '1') {
    hasReadTerms.value = true;
    agreed.value = true;
    router.replace({ name: 'register' });
  }
});




</script>

<template>
  <div class="login-body auth-card">
    <div class="top d-flex justify-content-between align-items-center auth-header">
      <div class="logo auth-logo-wrap">
        <img src="@/assets/images/flex-fitlogo-transparent.png" alt="Logo">
      </div>
      <router-link to="/"><i class="fa-duotone fa-house-chimney"></i></router-link>
    </div>

    <div class="bottom auth-content">
      <h3 class="panel-title panel-title-form auth-title">User Registration</h3>
      <form @submit.prevent="register" class="auth-form">
        <div class="input-group mb-3 input-group-rounded auth-form-group">
          <span class="input-group-text auth-input-icon"><i class="fa-regular fa-user"></i></span>
          <input v-model="firstName" type="text" class="form-control form-control-rounded auth-input" placeholder="First Name" required>
        </div>
        <div class="input-group mb-3 input-group-rounded auth-form-group">
          <span class="input-group-text auth-input-icon"><i class="fa-regular fa-user"></i></span>
          <input v-model="lastName" type="text" class="form-control form-control-rounded auth-input" placeholder="Last Name">
        </div>
        <div class="input-group mb-3 input-group-rounded auth-form-group">
          <span class="input-group-text auth-input-icon"><i class="fa-regular fa-envelope"></i></span>
          <input v-model="username" type="email" class="form-control form-control-rounded auth-input" placeholder="Email" required>
        </div>
        <div class="input-group mb-3 input-group-rounded auth-form-group">
          <span class="input-group-text auth-input-icon"><i class="fa-regular fa-lock"></i></span>
          <input v-model="password" :type="isPasswordShow ? 'text' : 'password'" class="form-control form-control-rounded auth-input" placeholder="Password" required>
          <button type="button" class="auth-password-toggle" :aria-label="isPasswordShow ? 'Hide password' : 'Show password'" @click="isPasswordShow = !isPasswordShow">
            <i class="fa-duotone" :class="[isPasswordShow ? 'fa-eye-slash':'fa-eye']"></i>
          </button>
        </div>
        <div class="input-group mb-2 input-group-rounded auth-form-group">
          <span class="input-group-text auth-input-icon"><i class="fa-regular fa-lock"></i></span>
          <input v-model="confirmPassword" :type="isConfirmPasswordShow ? 'text' : 'password'" class="form-control form-control-rounded auth-input" placeholder="Confirm Password" required>
          <button type="button" class="auth-password-toggle" :aria-label="isConfirmPasswordShow ? 'Hide confirm password' : 'Show confirm password'" @click="isConfirmPasswordShow = !isConfirmPasswordShow">
            <i class="fa-duotone" :class="[isConfirmPasswordShow ? 'fa-eye-slash':'fa-eye']"></i>
          </button>
        </div>


<div class="mt-2 auth-subtitle" v-if="showStrengthMeter">
  <p class="mb-1">Password strength: <strong :class="passwordStrengthClass">{{ passwordStrength }}</strong></p>
  <ul class="mb-0">
    <li :class="{ 'text-success': passwordChecks.length }">Min 8 characters</li>
    <li :class="{ 'text-success': passwordChecks.uppercase }">1 uppercase letter</li>
    <li :class="{ 'text-success': passwordChecks.number }">1 number</li>
    <li :class="{ 'text-success': passwordChecks.specialChar }">1 special character</li>
  </ul>
</div>


        <div class="d-flex justify-content-end mb-3 auth-subtitle auth-checkbox-row">
          <div class="form-check">
            <input class="form-check-input" type="checkbox" v-model="agreed" id="agreeCheckbox" :disabled="!hasReadTerms" required>
            <label class="form-check-label terms-label" for="agreeCheckbox">
              I agree
              <button type="button" class="terms-link" @click.stop="goToTerms">Terms & Policy</button>
            </label>
          </div>
        </div>
          <button class="btn btn-primary w-100 login-btn auth-button" :disabled="loading || !hasReadTerms || !agreed">
  {{ loading ? 'Registering...' : 'Sign Up' }}







</button>

        
      </form>

      <div class="other-option mt-2 auth-subtitle auth-footer">
        <p class="mb-0 auth-text">Already have an account? 
          <router-link to="/login" class="auth-link">Login</router-link>
        </p>
      </div>

      <div v-if="errorMsg" class="alert alert-danger mt-3">{{ errorMsg }}</div>
      <div v-if="successMsg" class="alert alert-success mt-3">{{ successMsg }}</div>
    </div>
  </div>
</template>

<style scoped>
.light-theme .main-content .login-body {
    background: rgba(255, 255, 255, 1);
    border: 1px solid black;
}

.login-body {
  border: 8px solid rgba(0, 0, 0, 0.25) !important;
  border-radius: 10px !important;
  background: rgba(255, 255, 255, 0.95) !important;
  padding: 22px !important;
  width: 100%;
  max-width: 430px;
  margin: 0 auto;
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

/* Input Group Rounded Borders */
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

.terms-label {
  color: rgba(0, 0, 0, 0.8) !important;
  font-size: 0.85rem;
}

.terms-link {
  border: 0;
  background: transparent;
  color: rgba(0, 0, 0, 0.8);
  text-decoration: underline;
  padding: 0;
  margin-left: 4px;
  font-size: 0.85rem;
}

.terms-link:hover {
  color: #000;
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

.auth-header {
  margin-bottom: 4px;
}

.auth-logo-wrap img {
  max-height: 38px;
  width: auto;
}

.auth-title {
  margin-top: 2px;
  margin-bottom: 10px;
}

.auth-subtitle,
.auth-subtitle p,
.auth-subtitle li {
  font-size: 0.84rem;
}

.auth-subtitle ul {
  padding-left: 1rem;
}

.auth-button {
  min-height: 40px;
  padding-top: 8px;
  padding-bottom: 8px;
  font-size: 0.92rem;
  border-radius: 8px;
}

.auth-checkbox-row {
  margin-top: 4px;
}

.auth-footer {
  margin-top: 10px;
}

</style>
