<script setup>
import { ref } from "vue";
import axios from "axios";
import { useRouter } from "vue-router";

const router = useRouter();
const API_BASE = import.meta.env.VITE_API_BASE;

const firstName = ref("");
const lastName = ref("");
const username = ref("");
const password = ref("");
const confirmPassword = ref("");
const agreed = ref(false);

const errorMsg = ref("");
const successMsg = ref("");

const register = async () => {
  errorMsg.value = "";
  successMsg.value = "";

  if (!agreed.value) {
    errorMsg.value = "You must agree to the Terms & Policy.";
    return;
  }

  if (password.value !== confirmPassword.value) {
    errorMsg.value = "Passwords do not match.";
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
    // Optional: redirect after 2 seconds
    setTimeout(() => {
      router.push({ name: "login" });
    }, 2000);
  } catch (error) {
    console.error("❌ Registration error:", error);
    errorMsg.value = error.response?.data?.error || "Registration failed. Try again.";
  }
};
</script>

<template>
  <h3 class="panel-title">Registration</h3>
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
        <div class="d-flex justify-content-end mb-25">
          <div class="form-check">
            <input class="form-check-input" type="checkbox" v-model="agreed" id="agreeCheckbox">
            <label class="form-check-label text-white" for="agreeCheckbox">
              I agree <a href="#" class="text-white text-decoration-underline">Terms & Policy</a>
            </label>
          </div>
        </div>
        <button class="btn btn-primary w-100 login-btn">Sign Up</button>
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
