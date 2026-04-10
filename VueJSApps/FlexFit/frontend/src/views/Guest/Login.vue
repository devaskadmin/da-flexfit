<script setup>
import { onMounted, ref } from "vue";
import axios from "axios";
import { useRouter } from "vue-router";
import { API_BASE } from '@/config/env';

const router = useRouter();

const username = ref("");
const password = ref("");
const isPasswordShow = ref(false);
const rememberMe = ref(false);
const errorMsg = ref("");
const dbStatus = ref("checking");
const isSubmitting = ref(false);
const appVersion = import.meta.env.VITE_APP_VERSION || '0.68';

const checkDatabaseStatus = async () => {
  try {
    const response = await axios.get(`${API_BASE}/api/db-status`, { withCredentials: true });
    dbStatus.value = response?.data?.connected ? "connected" : "disconnected";
  } catch (error) {
    dbStatus.value = "disconnected";
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helps mobile/Safari where session cookie can be visible a moment after /login response.
const waitForSessionReady = async (maxAttempts = 5, waitMs = 250) => {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const sessionRes = await axios.get(`${API_BASE}/api/session`, {
        withCredentials: true,
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (sessionRes?.data?.loggedIn === true) {
        return true;
      }
    } catch (_) {
      // Retry until attempts are exhausted.
    }

    if (attempt < maxAttempts) {
      await sleep(waitMs);
    }
  }
  return false;
};

const goToDashboard = async () => {
  await router.replace({ name: "dashboard_index" });
};

// 🔹 Login Function
const login = async () => {
  if (isSubmitting.value) return;

  isSubmitting.value = true;
  errorMsg.value = "";

  const safeUsername = String(username.value || "").trim();
  const safePassword = String(password.value || "");

  try {
    const response = await axios.post(
      `${API_BASE}/api/login`,
      {
        username: safeUsername,
        password: safePassword,
        rememberMe: !!rememberMe.value,
      },
      { withCredentials: true }
    );

    if (response?.data?.requiresPasswordReset === true) {
      const sessionReady = await waitForSessionReady();
      if (!sessionReady) {
        errorMsg.value = "Login succeeded, but session was not ready. Please tap Sign in again.";
        return;
      }
      await router.replace({ name: 'update_password' });
      return;
    }

    if (response?.data?.message === "Login successful") {
      const sessionReady = await waitForSessionReady();
      if (!sessionReady) {
        errorMsg.value = "Login succeeded, but session was not ready. Please tap Sign in again.";
        return;
      }
      await goToDashboard();
      return;
    }

    errorMsg.value = response?.data?.message || response?.data?.error || "Login failed. Try again.";
  } catch (error) {
    errorMsg.value =
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      "Error: incorrect username and/or password.";
  } finally {
    isSubmitting.value = false;
  }
};

// 🔹 Temp Login Bypass Function
const tempLoginBypass = async () => {
  if (isSubmitting.value) return;

  username.value = "demo@demo.com";
  password.value = "demo";
  isSubmitting.value = true;
  errorMsg.value = "";

  try {
    const response = await axios.post(
      `${API_BASE}/api/tmp-login`,
      {
        username: username.value,
        password: password.value,
        rememberMe: !!rememberMe.value,
      },
      { withCredentials: true }
    );

    if (response?.data?.requiresPasswordReset === true) {
      const sessionReady = await waitForSessionReady();
      if (!sessionReady) {
        errorMsg.value = "Login succeeded, but session was not ready. Please try again.";
        return;
      }
      await router.replace({ name: 'update_password' });
      return;
    }

    if (response?.data?.message === "Login successful") {
      const sessionReady = await waitForSessionReady();
      if (!sessionReady) {
        errorMsg.value = "Login succeeded, but session was not ready. Please try again.";
        return;
      }
      await goToDashboard();
      return;
    }

    errorMsg.value = response?.data?.message || response?.data?.error || "Login failed. Try again.";
  } catch (error) {
    errorMsg.value =
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      "Error: incorrect username and/or password.";
  } finally {
    isSubmitting.value = false;
  }
};

onMounted(() => {
  checkDatabaseStatus();
});

</script>

<template>
  <div class="container login-center-wrap">
    <div class="d-flex justify-content-center align-items-center">
      <div class="login-body">
        <div class="top d-flex justify-content-between align-items-center">
          <div class="logo">
            <img src="@/assets/images/flex-fitlogo-transparent.png" alt="Logo">
          </div>
          <router-link :to="{ name: 'dashboard_index' }"><i class="fa-duotone fa-house-chimney"></i></router-link>
        </div>
        <div class="bottom">
          <h3 class="panel-title panel-title-form">Login</h3>
          <form @submit.prevent="login">
            <div class="input-group mb-25 input-group-rounded">
              <span class="input-group-text"><i class="fa-regular fa-user"></i></span>
              <input v-model="username" type="text" class="form-control form-control-rounded" placeholder="Username or email address" required>
            </div>
            <div class="input-group mb-20 input-group-rounded">
              <span class="input-group-text"><i class="fa-regular fa-lock"></i></span>
              <input v-model="password" :type="[isPasswordShow ? 'text' : 'password']" class="form-control form-control-rounded" placeholder="Password" required>
              <a role="button" class="password-show" @click="isPasswordShow = !isPasswordShow"><i class="fa-duotone" :class="[isPasswordShow ? 'fa-eye-slash':'fa-eye']"></i></a>
            </div>
            <div class="d-flex justify-content-between mb-25">
              <div class="form-check">
                <input v-model="rememberMe" class="form-check-input" type="checkbox" id="loginCheckbox">
                <label class="form-check-label text-white" for="loginCheckbox">
                  Remember Me
                </label>
              </div>
              <router-link :to="{ name: 'reset_password' }" class="text-white fs-14">Forgot Password?</router-link>

              
            </div>



            <div v-if="errorMsg" class="alert alert-danger text-center mb-3">
  {{ errorMsg }}
</div>


            <button class="btn btn-primary w-100 login-btn" :disabled="isSubmitting">
              {{ isSubmitting ? 'Signing in...' : 'Sign in' }}
            </button>
            <button type="button" class="btn btn-secondary w-100 mt-2" :disabled="isSubmitting" @click="tempLoginBypass">Temp Login Bypass (Demo)</button>

            <div class="db-status mt-3 p-2 text-center rounded"
                 :class="dbStatus === 'connected' ? 'db-ok' : dbStatus === 'disconnected' ? 'db-down' : 'db-checking'">
              Database status:
              <strong>{{ dbStatus === 'checking' ? 'checking...' : dbStatus }}</strong>
            </div>
          </form>
          
          
          
          <div class="other-option">
            <p>Or continue with</p>
            <div class="social-box d-flex justify-content-center gap-20">
              <a href="#"><i class="fa-brands fa-facebook-f"></i></a>
              <a href="#"><i class="fa-brands fa-twitter"></i></a>
              <a href="#"><i class="fa-brands fa-google"></i></a>
              <a href="#"><i class="fa-brands fa-instagram"></i></a>
            </div>
          </div>



          <!-- Forgot password link (requested placement) -->
          <div class="other-option mt-3">
            <p class="mb-0 text-white">
              <router-link :to="{ name: 'reset_password' }" class="text-white text-decoration-underline">Forgot Password?</router-link>
            </p>
          </div>

          <!-- Registration link -->
<div class="other-option mt-3">
        <p class="mb-0 text-white">Don't have an account? 
          <router-link to="/register" class="text-white text-decoration-underline">Click here to sign up.</router-link>
        </p>
      </div>

      <div class="other-option mt-2">
        <p class="mb-0 text-white version-row">
          <span>Version: {{ appVersion }}</span>
          <a href="/changelog.html" class="text-white text-decoration-underline" target="_blank" rel="noopener noreferrer">Developer Change Log Notes</a>
        </p>
      </div>





        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-center-wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}


.login-body {
  border: 12px solid rgba(0, 0, 0, 0.08) !important;
  border-radius: 12px !important;
  background: rgba(255, 255, 255, 0.95) !important;
  padding: 40px !important;   
}

.login-body {
  border-radius: 10px;
  background: #f3f3f3;

  /* OUTER soft shadow */
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.1),   /* thin outer border */
    0 4px 10px rgba(0, 0, 0, 0.15); /* drop shadow */

  padding: 40px;
}


.light-theme .main-content .login-body {
  background: rgba(255, 255, 255, 1);
  border: 1px solid black;
}

.panel-title-form {
  color: #A9B4CC;
  font-weight: 600;
  margin-bottom: 20px;
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

.password-show {
  border: none !important;
  border-left: 2px solid rgba(13, 153, 255, 0.2) !important;
  background: transparent !important;
  padding: 0 10px;
  display: flex;
  align-items: center;
  cursor: pointer;
  color: #A9B4CC;
}

.version-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}

.password-show:hover {
  color: #0D99FF;
}

.db-status {
  font-size: 0.9rem;
}

.db-ok {
  background: rgba(25, 135, 84, 0.15);
  border: 1px solid rgba(25, 135, 84, 0.45);
  color: #198754;
}

.db-down {
  background: rgba(220, 53, 69, 0.15);
  border: 1px solid rgba(220, 53, 69, 0.45);
  color: #dc3545;
}

.db-checking {
  background: rgba(108, 117, 125, 0.15);
  border: 1px solid rgba(108, 117, 125, 0.45);
  color: #6c757d;
}
</style>