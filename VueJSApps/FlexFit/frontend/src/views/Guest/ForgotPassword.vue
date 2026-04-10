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
  <div class="container login-center-wrap">
    <div class="d-flex justify-content-center align-items-center">
      <div class="login-body">
        <div class="top d-flex justify-content-between align-items-center">
          <div class="logo">
            <img src="@/assets/images/flex-fitlogo-transparent.png" alt="Logo">
          </div>
          <router-link :to="{ name: 'login' }"><i class="fa-duotone fa-house-chimney"></i></router-link>
        </div>

        <div class="bottom">
          <h3 class="panel-title panel-title-form">Forgot Password</h3>

          <form @submit.prevent="sendReset">
            <div class="input-group mb-25 input-group-rounded">
              <span class="input-group-text"><i class="fa-regular fa-envelope"></i></span>
              <input
                v-model="identifier"
                type="text"
                class="form-control form-control-rounded"
                placeholder="Username or email"
                required
              >
            </div>

            <div class="d-flex gap-2">
              <button type="button" class="btn btn-outline-secondary w-50" :disabled="loading" @click="goBack">Back</button>
              <button type="submit" class="btn btn-primary w-50" :disabled="loading">
                {{ loading ? 'Processing...' : 'Reset Password' }}
              </button>
            </div>
          </form>

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
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-body {
  border: 8px solid rgba(0, 0, 0, 0.25) !important;
  border-radius: 12px !important;
  background: rgba(255, 255, 255, 0.95) !important;
  padding: 30px !important;
  width: 100%;
  max-width: 620px;
}

.panel-title-form {
  color: #000;
  font-weight: 600;
  margin-bottom: 20px;
  text-align: center;
}

.input-group-rounded {
  display: flex;
  align-items: center;
  border: 2px solid rgba(13, 153, 255, 0.5);
  border-radius: 10px;
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
  padding: 12px 15px !important;
}

.input-group-rounded .input-group-text {
  border: none !important;
  border-right: 1px solid rgba(13, 153, 255, 0.3) !important;
  background: transparent !important;
  padding: 0 12px !important;
  min-width: auto !important;
}
</style>
