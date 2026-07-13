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
  padding: 18px 20px 16px !important;
  width: 100%;
  max-width: 430px;
}

.panel-title-form {
  color: #1B2444;
  font-weight: 700;
  font-size: 1.2rem;
  margin-bottom: 8px;
  text-align: center;
}

.input-group-rounded {
  display: flex;
  align-items: center;
  border: 1px solid rgba(145, 160, 200, 0.32) !important;
  border-radius: 12px !important;
  overflow: hidden;
  transition: all 0.3s ease;
  background: #252E48 !important;
}

.input-group-rounded:focus-within {
  border-color: #2F6BFF !important;
  box-shadow: 0 0 0 3px rgba(47, 107, 255, 0.22);
}

.form-control-rounded {
  border: none !important;
  border-radius: 0 !important;
  flex: 1;
  padding: 10px 12px !important;
  min-height: 52px;
  font-size: 16px;
  font-weight: 500;
  background: #252E48 !important;
  color: #F7F9FF !important;
  box-shadow: none !important;
}

.form-control-rounded::placeholder {
  color: #A8B4CA !important;
  opacity: 1;
}

.input-group-rounded .input-group-text {
  border: none !important;
  border-right: 1px solid rgba(145, 160, 200, 0.32) !important;
  background: #252E48 !important;
  padding: 0 10px !important;
  min-width: auto !important;
  font-size: 0.9rem;
  color: #F7F9FF !important;
}

.auth-header {
  margin-bottom: 2px;
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
  width: 260px !important;
  max-width: 70% !important;
  height: auto !important;
  display: block;
  margin: 0 auto 8px !important;
  object-fit: contain;
}

.auth-subtitle {
  color: rgba(0, 0, 0, 0.68);
  font-size: 0.84rem;
  line-height: 1.4;
  text-align: center;
}

.auth-content {
  padding-top: 4px;
}

.auth-title {
  color: #1B2444 !important;
  font-weight: 700 !important;
  margin-top: 0;
  margin-bottom: 8px !important;
}

.auth-button {
  min-height: 44px;
  padding-top: 8px;
  padding-bottom: 8px;
  font-size: 0.9rem;
  border-radius: 8px;
}

.auth-button-secondary {
  background: #FFFFFF !important;
  border: 2px solid #C9D9EA !important;
  color: #1B2444 !important;
  box-shadow: none !important;
}

.auth-button-secondary:hover {
  background: #F5F8FF !important;
  border-color: #AFCBE7 !important;
  color: #1B2444 !important;
}

.auth-action-row .btn.btn-primary {
  background: #2F6BFF !important;
  color: #FFFFFF !important;
  border: none !important;
  background-image: none !important;
  box-shadow: none !important;
}

.auth-action-row .btn.btn-primary:hover:not(:disabled) {
  background: #2459D8 !important;
}

.auth-action-row .btn.btn-primary:disabled {
  background: #8F9BB5 !important;
  color: #E8EDF5 !important;
  border: none !important;
  opacity: 1;
}

.auth-action-row {
  margin-top: 6px;
}

.auth-footer {
  margin-top: 8px;
  text-align: center;
}

.auth-form-group {
  margin-bottom: 6px !important;
}

.auth-form {
  margin-top: 0;
}

.auth-header > a {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
}

@media (min-width: 768px) {
  .login-body {
    max-width: 440px;
    padding: 18px 20px 16px !important;
  }
}

@media (max-width: 767.98px) {
  .login-center-wrap {
    padding: 14px 12px;
  }

  .login-body {
    padding: 14px 14px 12px !important;
  }

  .auth-logo-wrap img {
    width: 220px !important;
    max-width: 80% !important;
    margin: 0 auto 6px;
  }

  .auth-title {
    margin-bottom: 6px;
  }

  .auth-subtitle {
    margin-bottom: 10px !important;
  }

  .auth-form-group {
    margin-bottom: 5px !important;
  }

  .auth-action-row {
    margin-top: 4px;
  }

  .auth-footer {
    margin-top: 6px;
  }
}

@media (max-width: 767.98px) {
  .login-body .top.auth-header .logo.auth-logo-wrap img {
    width: 220px !important;
    max-width: 80% !important;
    margin: 0 auto 6px !important;
  }
}
</style>
