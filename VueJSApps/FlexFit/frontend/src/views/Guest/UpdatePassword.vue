<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import { API_BASE } from '@/config/env';

const router = useRouter();
const newPassword = ref('');
const confirmPassword = ref('');
const loading = ref(false);
const errorMsg = ref('');
const successMsg = ref('');

const checkResetSession = async () => {
  try {
    const response = await axios.get(`${API_BASE}/api/session`, { withCredentials: true });
    if (!response?.data?.loggedIn) {
      await router.replace({ name: 'login' });
      return;
    }

    if (!response?.data?.requiresPasswordReset) {
      await router.replace({ name: 'dashboard_index' });
    }
  } catch (_) {
    await router.replace({ name: 'login' });
  }
};

const completeReset = async () => {
  errorMsg.value = '';
  successMsg.value = '';
  loading.value = true;

  try {
    const response = await axios.post(
      `${API_BASE}/api/reset-password/complete`,
      {
        newPassword: String(newPassword.value || ''),
        confirmPassword: String(confirmPassword.value || ''),
      },
      { withCredentials: true }
    );

    successMsg.value = response?.data?.message || 'Password updated successfully.';
    setTimeout(async () => {
      await router.replace({ name: 'dashboard_index' });
    }, 800);
  } catch (error) {
    errorMsg.value =
      error?.response?.data?.error ||
      error?.response?.data?.message ||
      'Failed to update password.';
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  checkResetSession();
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
          <router-link :to="{ name: 'login' }"><i class="fa-duotone fa-house-chimney"></i></router-link>
        </div>

        <div class="bottom">
          <h3 class="panel-title panel-title-form">Reset Password</h3>

          <form @submit.prevent="completeReset">
            <div class="input-group mb-25 input-group-rounded">
              <span class="input-group-text"><i class="fa-regular fa-lock"></i></span>
              <input v-model="newPassword" type="password" class="form-control form-control-rounded" placeholder="New Password" required>
            </div>

            <div class="input-group mb-25 input-group-rounded">
              <span class="input-group-text"><i class="fa-regular fa-lock"></i></span>
              <input v-model="confirmPassword" type="password" class="form-control form-control-rounded" placeholder="Confirm New Password" required>
            </div>

            <button type="submit" class="btn btn-primary w-100" :disabled="loading">
              {{ loading ? 'Updating...' : 'Update Password' }}
            </button>
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
