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
  <div class="login-body">
    <div class="top d-flex justify-content-between align-items-center">
      <div class="logo">
        <img src="@/assets/images/flex-fitlogo-transparent.png" alt="Logo">
      </div>
      <router-link to="/"><i class="fa-duotone fa-house-chimney"></i></router-link>
    </div>

    <div class="bottom">
      <h3 class="panel-title panel-title-form">User Registration</h3>
      <form @submit.prevent="register">
        <div class="input-group mb-25 input-group-rounded">
          <input v-model="firstName" type="text" class="form-control form-control-rounded" placeholder="First Name" required>
          <span class="input-group-text"><i class="fa-regular fa-user"></i></span>
        </div>
        <div class="input-group mb-25 input-group-rounded">
          <input v-model="lastName" type="text" class="form-control form-control-rounded" placeholder="Last Name">
          <span class="input-group-text"><i class="fa-regular fa-user"></i></span>
        </div>
        <div class="input-group mb-25 input-group-rounded">
          <input v-model="username" type="email" class="form-control form-control-rounded" placeholder="Email" required>
          <span class="input-group-text"><i class="fa-regular fa-envelope"></i></span>
        </div>
        <div class="input-group mb-25 input-group-rounded">
          <input v-model="password" type="password" class="form-control form-control-rounded" placeholder="Password" required>
          <span class="input-group-text"><i class="fa-regular fa-lock"></i></span>
        </div>
        <div class="input-group mb-20 input-group-rounded">
          <input v-model="confirmPassword" type="password" class="form-control form-control-rounded" placeholder="Confirm Password" required>
          <span class="input-group-text"><i class="fa-regular fa-lock"></i></span>
        </div>


<div class="mt-2" v-if="showStrengthMeter">
  <p>Password strength: <strong :class="passwordStrengthClass">{{ passwordStrength }}</strong></p>
  <ul class="fs-14">
    <li :class="{ 'text-success': passwordChecks.length }">Min 8 characters</li>
    <li :class="{ 'text-success': passwordChecks.uppercase }">1 uppercase letter</li>
    <li :class="{ 'text-success': passwordChecks.number }">1 number</li>
    <li :class="{ 'text-success': passwordChecks.specialChar }">1 special character</li>
  </ul>
</div>


        <div class="d-flex justify-content-end mb-25">
          <div class="form-check">
            <input class="form-check-input" type="checkbox" v-model="agreed" id="agreeCheckbox" :disabled="!hasReadTerms" required>
            <label class="form-check-label terms-label" for="agreeCheckbox">
              I agree
              <button type="button" class="terms-link" @click.stop="goToTerms">Terms & Policy</button>
            </label>
          </div>
        </div>
        <button class="btn btn-primary w-100 login-btn" :disabled="loading || !hasReadTerms || !agreed">
  {{ loading ? 'Registering...' : 'Sign Up' }}







</button>

        
      </form>

      <div class="other-option mt-3">
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
  border-radius: 12px !important;
  background: rgba(255, 255, 255, 0.95) !important;
  padding: 40px !important;
}
.panel-title {
  color: white;
}

.panel-title-form {
  color: #000000;
  font-weight: 600;
  margin-bottom: 20px;
  text-align: center;
}

/* Input Group Rounded Borders */
.input-group-rounded {
  display: flex;
  align-items: center;
  border: 2px solid rgba(13, 153, 255, 0.5);
  border-radius: 10px;
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
  padding: 12px 15px !important;
}

.input-group-rounded .input-group-text {
  border: none !important;
  border-right: 1px solid rgba(13, 153, 255, 0.3) !important;
  background: transparent !important;
  border-radius: 0 !important;
  padding: 0 12px !important;
  min-width: auto !important;
}

.terms-label {
  color: rgba(0, 0, 0, 0.8) !important;
}

.terms-link {
  border: 0;
  background: transparent;
  color: rgba(0, 0, 0, 0.8);
  text-decoration: underline;
  padding: 0;
  margin-left: 4px;
}

.terms-link:hover {
  color: #000;
}

.auth-text {
  color: rgba(0, 0, 0, 0.75);
}

.auth-link {
  color: rgba(0, 0, 0, 0.85);
  text-decoration: underline;
}

</style>
