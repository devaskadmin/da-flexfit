<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const reachedBottom = ref(false);

const onTermsScroll = (event) => {
  const el = event.target;
  const isAtBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
  reachedBottom.value = isAtBottom;
};

const agreeAndReturn = async () => {
  await router.push({ name: 'register', query: { termsAccepted: '1' } });
};

const goBack = async () => {
  await router.push({ name: 'register' });
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
          <router-link :to="{ name: 'register' }"><i class="fa-duotone fa-house-chimney"></i></router-link>
        </div>

        <div class="bottom auth-content">
          <h3 class="panel-title panel-title-form auth-title">Terms and Service</h3>
          <p class="auth-subtitle">Please review the terms below. Scroll to the end to enable agreement.</p>

          <div class="terms-scroll-box terms-container" @scroll="onTermsScroll">
            <p>These are the terms and conditions.</p>
            <p>These are the terms and conditions.</p>
            <p>These are the terms and conditions.</p>
            <p>These are the terms and conditions.</p>
            <p>These are the terms and conditions.</p>
            <p>These are the terms and conditions.</p>
            <p>These are the terms and conditions.</p>
            <p>These are the terms and conditions.</p>
            <p>These are the terms and conditions.</p>
            <p>These are the terms and conditions.</p>
            <p>These are the terms and conditions.</p>
            <p>These are the terms and conditions.</p>
            <p>These are the terms and conditions.</p>
          </div>

          <div class="d-flex gap-2 mt-2 auth-action-row">
            <button type="button" class="btn btn-danger w-50 auth-button auth-button-danger" @click="goBack">Back</button>
            <button type="button" class="btn btn-primary w-50 auth-button" :disabled="!reachedBottom" @click="agreeAndReturn">Agree</button>
          </div>
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
  padding: 20px !important;
  width: 100%;
  max-width: 430px;
}

.panel-title-form {
  color: #000;
  font-weight: 600;
  font-size: 1.15rem;
  margin: 8px 0 6px;
  text-align: center;
}

.auth-subtitle {
  font-size: 0.84rem;
  color: rgba(0, 0, 0, 0.66);
  text-align: center;
  margin-bottom: 10px;
}

.terms-scroll-box {
  border: 1.5px solid rgba(13, 153, 255, 0.5);
  border-radius: 9px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(250, 252, 255, 0.9));
  padding: 12px;
  height: 220px;
  overflow-y: auto;
  color: rgba(0, 0, 0, 0.85);
  line-height: 1.45;
  font-size: 0.9rem;
}

.terms-container p {
  margin-bottom: 0.55rem;
}

.auth-header {
  margin-bottom: 8px;
}

.auth-logo-wrap img {
  max-height: 32px;
  width: auto;
}

.auth-button {
  min-height: 40px;
  padding-top: 8px;
  padding-bottom: 8px;
  font-size: 0.9rem;
  border-radius: 8px;
}

.auth-button-danger {
  background: #dc3545;
  border-color: #dc3545;
  color: #fff;
}

.auth-button-danger:hover {
  background: #bf2f3d;
  border-color: #bf2f3d;
}

.auth-action-row {
  padding-top: 2px;
}
</style>
