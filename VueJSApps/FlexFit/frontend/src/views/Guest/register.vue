<script setup>
import { ref, watch, computed } from "vue";
import axios from "axios";
import { useRouter } from "vue-router";


const router = useRouter();

// Near top of file
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const firstName = ref("");
const lastName = ref("");
const username = ref("");
const password = ref("");
const confirmPassword = ref("");
const agreed = ref(false);

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




</script>

<template>
  <h3 class="panel-title">User Registration</h3>
  <div class="login-body login-body-2">
    <div class="top d-flex justify-content-between align-items-center">
      <div class="logo">
        <img src="@/assets/images/flex-fitlogo-transparent.png" alt="Logo">
      </div>
      <router-link to="/"><i class="fa-duotone fa-house-chimney"></i></router-link>
    </div>

    <div class="bottom">
      <form @submit.prevent="register">
        <div class="input-group mb-25">
          <input v-model="firstName" type="text" class="form-control" placeholder="First Name" required>
          <span class="input-group-text"><i class="fa-regular fa-user"></i></span>
        </div>
        <div class="input-group mb-25">
          <input v-model="lastName" type="text" class="form-control" placeholder="Last Name" required>
          <span class="input-group-text"><i class="fa-regular fa-user"></i></span>
        </div>
        <div class="input-group mb-25">
          <input v-model="username" type="email" class="form-control" placeholder="Email" required>
          <span class="input-group-text"><i class="fa-regular fa-envelope"></i></span>
        </div>
        <div class="input-group mb-25">
          <input v-model="password" type="password" class="form-control" placeholder="Password" required>
          <span class="input-group-text"><i class="fa-regular fa-lock"></i></span>
        </div>
        <div class="input-group mb-20">
          <input v-model="confirmPassword" type="password" class="form-control" placeholder="Confirm Password" required>
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
            <input class="form-check-input" type="checkbox" v-model="agreed" id="agreeCheckbox">
            <label class="form-check-label text-white" for="agreeCheckbox">
              I agree <a href="#" class="text-white text-decoration-underline">Terms & Policy</a>
            </label>
          </div>
        </div>
        <button class="btn btn-primary w-100 login-btn" :disabled="loading">
  {{ loading ? 'Registering...' : 'Sign Up' }}







</button>

        
      </form>

      <div class="other-option mt-3">
        <p class="mb-0 text-white">Already have an account? 
          <router-link to="/login" class="text-white text-decoration-underline">Login</router-link>
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
.panel-title {
  color: white;
}

.login-body-2 {
  background-image: url('/src/assets/images/login-background.jpg');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

</style>
