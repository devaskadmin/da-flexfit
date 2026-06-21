<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import { API_BASE } from '@/config/env';

const router = useRouter();
const identifier = ref('');
const loading = ref(false);
const errorMsg = ref('');
const successMsg = ref('');

const sendReset = async () => {
  errorMsg.value = '';
  successMsg.value = '';
  loading.value = true;

  try {
    const response = await axios.post(
      `${API_BASE}/api/forgot-password`,
      { identifier: String(identifier.value || '').trim() },
      { withCredentials: true }
    );

    successMsg.value = response?.data?.message || 'Temporary password sent successfully.';
  } catch (error) {
    errorMsg.value =
      error?.response?.data?.error ||
      error?.response?.data?.message ||
      'Unable to process password reset request.';
  } finally {
    loading.value = false;
  }
};

const goBack = async () => {
  await router.push({ name: 'login' });
};
</script>

<template>
  <div class="container login-center-wrap auth-wrapper">
    <div class="d-flex justify-content-center align-items-center">
      <div class="login-body auth-card">
        <div class="top d-flex justify-content-between align-items-center auth-header">
          <div class="logo auth-logo-wrap">
            <img src="@/assets/images/flex-fitlogo-transparent.png" alt="Logo">
          </div>
          <router-link :to="{ name: 'login' }"><i class="fa-duotone fa-house-chimney"></i></router-link>
        </div>

        <div class="bottom auth-content">
          <h3 class="panel-title panel-title-form auth-title">Forgot Password</h3>
          <p class="auth-subtitle mb-3">Enter your username or email and we'll send reset instructions.</p>

          <form @submit.prevent="sendReset" class="auth-form">
            <div class="input-group mb-3 input-group-rounded auth-form-group">
              <span class="input-group-text auth-input-icon"><i class="fa-regular fa-envelope"></i></span>
              <input
                v-model="identifier"
                type="text"
                class="form-control form-control-rounded auth-input"
                placeholder="Username or email"
                required
              >
            </div>

            <div class="d-flex gap-2 auth-form-group auth-action-row">
              <button type="button" class="btn btn-outline-secondary w-50 auth-button auth-button-secondary" :disabled="loading" @click="goBack">Back</button>
              <button type="submit" class="btn btn-primary w-50 auth-button" :disabled="loading">
                {{ loading ? 'Processing...' : 'Reset Password' }}
              </button>
            </div>
          </form>

          <div class="auth-footer">
            <p class="mb-0 auth-subtitle">Remembered your password? <router-link :to="{ name: 'login' }">Sign in</router-link></p>
          </div>

          <div v-if="errorMsg" class="alert alert-danger mt-3 mb-0">{{ errorMsg }}</div>
          <div v-if="successMsg" class="alert alert-success mt-3 mb-0">{{ successMsg }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-center-wrap {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px 12px;
}

.login-body {
  border: 8px solid rgba(0, 0, 0, 0.25) !important;
  border-radius: 10px !important;
  background: rgba(255, 255, 255, 0.95) !important;
  padding: 22px !important;
  width: 100%;
  max-width: 430px;
}

.panel-title-form {
  color: #000;
  font-weight: 600;
  font-size: 1.2rem;
  margin-bottom: 12px;
  text-align: center;
}

.input-group-rounded {
  display: flex;
  align-items: center;
  border: 1.5px solid rgba(13, 153, 255, 0.5);
  border-radius: 9px;
  overflow: hidden;
  transition: all 0.3s ease;
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
  padding: 0 10px !important;
  min-width: auto !important;
  font-size: 0.9rem;
}

.auth-header {
  margin-bottom: 8px;
}

.auth-logo-wrap img {
  max-height: 32px;
  width: auto;
}

.auth-subtitle {
  color: rgba(0, 0, 0, 0.68);
  font-size: 0.84rem;
  line-height: 1.4;
  text-align: center;
}

.auth-button {
  min-height: 40px;
  padding-top: 8px;
  padding-bottom: 8px;
  font-size: 0.9rem;
  border-radius: 8px;
}

.auth-button-secondary {
  border-color: #7b879d;
  color: #5c677d;
}

.auth-button-secondary:hover {
  background: #eef2f8;
  color: #3f4d66;
}

.auth-action-row {
  margin-top: 4px;
}

.auth-footer {
  margin-top: 12px;
  text-align: center;
}
</style>
