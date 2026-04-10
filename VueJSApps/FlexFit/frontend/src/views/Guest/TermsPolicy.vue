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
</script>

<template>
  <div class="container login-center-wrap">
    <div class="d-flex justify-content-center align-items-center">
      <div class="login-body">
        <div class="top d-flex justify-content-between align-items-center">
          <div class="logo">
            <img src="@/assets/images/flex-fitlogo-transparent.png" alt="Logo">
          </div>
          <router-link :to="{ name: 'register' }"><i class="fa-duotone fa-house-chimney"></i></router-link>
        </div>

        <div class="bottom">
          <h3 class="panel-title panel-title-form">Terms and Service</h3>

          <div class="terms-scroll-box" @scroll="onTermsScroll">
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

          <div v-if="reachedBottom" class="agree-box mt-3">
            <button type="button" class="btn btn-primary w-100" @click="agreeAndReturn">Agree</button>
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
  border: 8px solid rgba(0, 0, 0, 0.25) !important;
  border-radius: 12px !important;
  background: rgba(255, 255, 255, 0.95) !important;
  padding: 24px !important;
  width: 100%;
  max-width: 620px;
}

.panel-title-form {
  color: #000;
  font-weight: 600;
  margin: 12px 0 16px;
  text-align: center;
}

.terms-scroll-box {
  border: 2px solid rgba(13, 153, 255, 0.5);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.85);
  padding: 16px;
  height: 260px;
  overflow-y: auto;
  color: rgba(0, 0, 0, 0.85);
  line-height: 1.5;
}

.agree-box {
  border: 2px solid rgba(13, 153, 255, 0.35);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.75);
  padding: 10px;
}
</style>
