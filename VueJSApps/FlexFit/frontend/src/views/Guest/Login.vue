<script setup>
import { ref } from "vue";
import axios from "axios";
import { useRouter } from "vue-router";
import { API_BASE } from '@/config/env';

const router = useRouter();

const username = ref("");
const password = ref("");
const isPasswordShow = ref(false);
const rememberMe = ref(false);
const errorMsg = ref("");
const loginDiagnostics = ref("");
const diagnosticsCopied = ref(false);
const showDiagnosticsModal = ref(false);
const isSubmitting = ref(false);
const appVersion = import.meta.env.VITE_APP_VERSION || '0.68.3';
const isDev = import.meta.env.DEV;

const isSafariBrowser = () => {
  const ua = navigator.userAgent || '';
  const isSafari = /Safari/i.test(ua);
  const isOtherBrowser = /(Chrome|CriOS|FxiOS|EdgiOS|Edg|OPR|Opera|SamsungBrowser|Android)/i.test(ua);
  return isSafari && !isOtherBrowser;
};

const buildSafariLoginFailureMessage = ({
  reason = 'Login did not complete.',
  status,
  apiMessage,
  networkMessage,
} = {}) => {
  const detailLines = [
    `Safari sign-in issue detected. ${reason}`,
    '',
    'Details:',
    `- API Base: ${API_BASE}`,
    `- HTTP Status: ${status ?? 'none'}`,
    `- Server Message: ${apiMessage || 'none'}`,
    `- Network Message: ${networkMessage || 'none'}`,
    '',
    'Safari troubleshooting steps:',
    '1) iPhone/iPad: Settings > Safari',
    '2) Turn OFF "Prevent Cross-Site Tracking"',
    '3) Confirm cookies are allowed (not blocked)',
    '4) Tap "Clear History and Website Data"',
    '5) Close Safari completely, reopen, and sign in again',
    '',
    'If this still fails, test the same account in Chrome/Edge on the same device to confirm Safari cookie restrictions.',
  ];

  return detailLines.join('\n');
};

const buildLoginDiagnostics = ({
  reason,
  status,
  apiMessage,
  networkMessage,
  loginSucceeded = false,
  sessionCookiePersisted = null,
  sessionVerificationPassed = false,
} = {}) => {
  const userAgent = navigator.userAgent || 'unknown';
  const origin = window.location.origin || 'unknown';
  const now = new Date().toISOString();

  return [
    'FlexFit Login Diagnostics',
    `- Timestamp: ${now}`,
    `- Browser: ${userAgent}`,
    `- Is Safari: ${isSafariBrowser()}`,
    `- Cookies Enabled: ${navigator.cookieEnabled}`,
    `- App Origin: ${origin}`,
    `- API Base: ${API_BASE}`,
    `- HTTP Status: ${status ?? 'none'}`,
    `- loginSucceeded: ${loginSucceeded}`,
    `- sessionCookiePersisted: ${sessionCookiePersisted === null ? 'unknown' : sessionCookiePersisted}`,
    `- sessionVerificationPassed: ${sessionVerificationPassed}`,
    `- Reason: ${reason || 'none'}`,
    `- Server Message: ${apiMessage || 'none'}`,
    `- Network Message: ${networkMessage || 'none'}`,
  ].join('\n');
};

const buildCompactLoginMessage = ({ status, fallbackMessage } = {}) => {
  if (fallbackMessage) {
    const lowerFallback = String(fallbackMessage).toLowerCase();
    if (lowerFallback.includes('login succeeded') || lowerFallback.includes('session cookie')) {
      return fallbackMessage;
    }
  }

  if (status === 404) {
    return 'Sign-in failed: endpoint not found (404).';
  }

  if (status === 401) {
    return 'Sign-in failed: invalid username or password.';
  }

  if (status && status >= 500) {
    return `Sign-in failed: server error (${status}).`;
  }

  if (!status) {
    return fallbackMessage || 'Sign-in failed: network/session issue detected.';
  }

  return fallbackMessage || `Sign-in failed (${status}).`;
};

const openDiagnosticsModal = () => {
  showDiagnosticsModal.value = true;
};

const closeDiagnosticsModal = () => {
  showDiagnosticsModal.value = false;
};

const setLoginError = ({
  fallbackMessage,
  reason,
  status,
  apiMessage,
  networkMessage,
  loginSucceeded = false,
  sessionCookiePersisted = null,
  sessionVerificationPassed = false,
  safariDetailed = false,
}) => {
  const isSafari = isSafariBrowser();
  const compactMessage = buildCompactLoginMessage({ status, fallbackMessage });
  const detailedMessage = safariDetailed && isSafari
    ? buildSafariLoginFailureMessage({ reason, status, apiMessage, networkMessage })
    : (fallbackMessage || 'No additional details.');

  errorMsg.value = compactMessage;
  loginDiagnostics.value = `${buildLoginDiagnostics({
    reason,
    status,
    apiMessage,
    networkMessage,
    loginSucceeded,
    sessionCookiePersisted,
    sessionVerificationPassed,
  })}\n\nVisible Error:\n${compactMessage}\n\nDetailed Error:\n${detailedMessage}`;
  showDiagnosticsModal.value = false;
};

const copyLoginDiagnostics = async () => {
  try {
    await navigator.clipboard.writeText(loginDiagnostics.value || errorMsg.value || 'No diagnostics available.');
    diagnosticsCopied.value = true;
    setTimeout(() => {
      diagnosticsCopied.value = false;
    }, 2500);
  } catch {
    diagnosticsCopied.value = false;
  }
};

const devLog = (...args) => {
  if (isDev) {
    console.debug('[auth/login]', ...args);
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helps mobile/Safari where session cookie can be visible a moment after /login response.
const waitForSessionReady = async (maxAttempts = 5, waitMs = 250) => {
  const sessionUrl = `${API_BASE}/api/session`;
  let lastStatus = null;
  let lastNote = '';
  let lastHasSessionCookie = null;

  console.log('[FlexFit Session Verify] URL:', sessionUrl);
  console.log('[FlexFit Session Verify] withCredentials:', true);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      devLog('Session verification request', {
        url: sessionUrl,
        withCredentials: true,
        attempt,
      });

      const sessionRes = await axios.get(sessionUrl, {
        withCredentials: true,
        headers: { 'Cache-Control': 'no-cache' },
      });

      lastStatus = sessionRes?.status ?? null;
      lastHasSessionCookie = sessionRes?.data?.diagnostics?.hasSessionCookie ?? null;
      lastNote = sessionRes?.data?.diagnostics?.note || '';

      if (sessionRes?.data?.loggedIn === true) {
        return {
          passed: true,
          status: sessionRes?.status ?? null,
          hasSessionCookie: sessionRes?.data?.diagnostics?.hasSessionCookie ?? true,
          note: sessionRes?.data?.diagnostics?.note || 'Session verification succeeded.',
        };
      }
    } catch (err) {
      lastStatus = err?.response?.status ?? null;
      lastHasSessionCookie = err?.response?.data?.diagnostics?.hasSessionCookie ?? lastHasSessionCookie;
      lastNote = err?.response?.data?.diagnostics?.note || err?.message || lastNote;

      // Retry until attempts are exhausted.
    }

    if (attempt < maxAttempts) {
      await sleep(waitMs);
    }
  }
  return {
    passed: false,
    status: lastStatus,
    hasSessionCookie: lastHasSessionCookie,
    note: lastNote || 'Session verification did not pass after login.',
  };
};

const goToDashboard = async () => {
  devLog('Routing to dashboard');
  await router.replace({ name: "dashboard_index" });
};

// 🔹 Login Function
const login = async () => {
  if (isSubmitting.value) return;

  isSubmitting.value = true;
  errorMsg.value = "";
  loginDiagnostics.value = "";
  diagnosticsCopied.value = false;
  showDiagnosticsModal.value = false;

  const safeUsername = String(username.value || "").trim();
  const safePassword = String(password.value || "");

  try {
    devLog('Submitting login request', { username: safeUsername, rememberMe: !!rememberMe.value });

    const loginUrl = `${API_BASE}/api/login`;
    console.log('[FlexFit Login] API_BASE:', API_BASE);
    console.log('[FlexFit Login] URL:', loginUrl);
    console.log('[FlexFit Login] withCredentials:', true);

    const response = await axios.post(
      loginUrl,
      {
        username: safeUsername,
        password: safePassword,
        rememberMe: !!rememberMe.value,
      },
      { withCredentials: true }
    );

    if (response?.data?.requiresPasswordReset === true) {
      devLog('Login requires password reset');
      const sessionState = await waitForSessionReady();
      if (!sessionState?.passed) {
        setLoginError({
          fallbackMessage: 'Login succeeded, but the session cookie was not available for follow-up requests.',
          reason: 'Session persistence issue after successful authentication.',
          status: sessionState?.status,
          apiMessage: sessionState?.note || 'Login successful, but session verification failed.',
          loginSucceeded: true,
          sessionCookiePersisted: sessionState?.hasSessionCookie,
          sessionVerificationPassed: false,
          safariDetailed: true,
        });
        return;
      }
      await router.replace({ name: 'update_password' });
      return;
    }

    if (response?.data?.message === "Login successful") {
      devLog('Login successful response received');
      const sessionState = await waitForSessionReady();
      if (!sessionState?.passed) {
        setLoginError({
          fallbackMessage: 'Login succeeded, but the session cookie was not available for follow-up requests.',
          reason: 'Session persistence issue after successful authentication.',
          status: sessionState?.status,
          apiMessage: sessionState?.note || response?.data?.message,
          loginSucceeded: true,
          sessionCookiePersisted: sessionState?.hasSessionCookie,
          sessionVerificationPassed: false,
          safariDetailed: true,
        });
        return;
      }
      await goToDashboard();
      return;
    }

    devLog('Login rejected by API payload', response?.data || null);
    const payloadMessage = response?.data?.message || response?.data?.error || "Login failed. Try again.";
    setLoginError({
      fallbackMessage: payloadMessage,
      reason: 'The server rejected this sign-in request.',
      apiMessage: payloadMessage,
      safariDetailed: true,
    });
  } catch (error) {
    devLog('Login request failed', {
      status: error?.response?.status,
      data: error?.response?.data,
      message: error?.message,
    });
    const apiMessage =
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      'Sign-in request failed before authentication could complete.';
    setLoginError({
      fallbackMessage: apiMessage,
      reason: 'Browser could not complete sign-in request.',
      status: error?.response?.status,
      apiMessage,
      networkMessage: error?.message,
      loginSucceeded: false,
      sessionCookiePersisted: null,
      sessionVerificationPassed: false,
      safariDetailed: true,
    });
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
  loginDiagnostics.value = "";
  diagnosticsCopied.value = false;
  showDiagnosticsModal.value = false;

  try {
    devLog('Submitting demo login request');

    const demoLoginUrl = `${API_BASE}/api/login`;
    console.log('[FlexFit Demo Login] API_BASE:', API_BASE);
    console.log('[FlexFit Demo Login] URL:', demoLoginUrl);
    console.log('[FlexFit Demo Login] withCredentials:', true);

    const response = await axios.post(
      demoLoginUrl,
      {
        username: username.value,
        password: password.value,
        rememberMe: !!rememberMe.value,
      },
      { withCredentials: true }
    );

    if (response?.data?.requiresPasswordReset === true) {
      devLog('Demo login requires password reset');
      const sessionState = await waitForSessionReady();
      if (!sessionState?.passed) {
        setLoginError({
          fallbackMessage: 'Login succeeded, but the session cookie was not available for follow-up requests.',
          reason: 'Session persistence issue after successful demo authentication.',
          status: sessionState?.status,
          apiMessage: sessionState?.note || 'Login successful, but session verification failed.',
          loginSucceeded: true,
          sessionCookiePersisted: sessionState?.hasSessionCookie,
          sessionVerificationPassed: false,
          safariDetailed: true,
        });
        return;
      }
      await router.replace({ name: 'update_password' });
      return;
    }

    if (response?.data?.message === "Login successful") {
      devLog('Demo login successful response received');
      const sessionState = await waitForSessionReady();
      if (!sessionState?.passed) {
        setLoginError({
          fallbackMessage: 'Login succeeded, but the session cookie was not available for follow-up requests.',
          reason: 'Session persistence issue after successful demo authentication.',
          status: sessionState?.status,
          apiMessage: sessionState?.note || response?.data?.message,
          loginSucceeded: true,
          sessionCookiePersisted: sessionState?.hasSessionCookie,
          sessionVerificationPassed: false,
          safariDetailed: true,
        });
        return;
      }
      await goToDashboard();
      return;
    }

    devLog('Demo login rejected by API payload', response?.data || null);
    const payloadMessage = response?.data?.message || response?.data?.error || "Login failed. Try again.";
    setLoginError({
      fallbackMessage: payloadMessage,
      reason: 'The server rejected this demo sign-in request.',
      apiMessage: payloadMessage,
      safariDetailed: true,
    });
  } catch (error) {
    devLog('Demo login request failed', {
      status: error?.response?.status,
      data: error?.response?.data,
      message: error?.message,
    });
    const apiMessage =
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      'Demo sign-in request failed before authentication could complete.';
    setLoginError({
      fallbackMessage: apiMessage,
      reason: 'Browser could not complete demo sign-in request.',
      status: error?.response?.status,
      apiMessage,
      networkMessage: error?.message,
      loginSucceeded: false,
      sessionCookiePersisted: null,
      sessionVerificationPassed: false,
      safariDetailed: true,
    });
  } finally {
    isSubmitting.value = false;
  }
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
          <router-link :to="{ name: 'dashboard_index' }"><i class="fa-duotone fa-house-chimney"></i></router-link>
        </div>

        <div class="bottom auth-content auth-column">
          <h3 class="panel-title panel-title-form auth-title">Login</h3>

          <form @submit.prevent="login" class="auth-form">
            <div class="input-group input-group-rounded auth-form-group">
              <span class="input-group-text auth-input-icon"><i class="fa-regular fa-user"></i></span>
              <input v-model="username" type="text" class="form-control form-control-rounded auth-input" placeholder="Username or email address" required>
            </div>

            <div class="input-group input-group-rounded auth-form-group">
              <span class="input-group-text auth-input-icon"><i class="fa-regular fa-lock"></i></span>
              <input v-model="password" :type="[isPasswordShow ? 'text' : 'password']" class="form-control form-control-rounded auth-input" placeholder="Password" required>
              <button type="button" class="password-show auth-password-toggle" @click="isPasswordShow = !isPasswordShow" :aria-label="isPasswordShow ? 'Hide password' : 'Show password'">
                <i class="fa-duotone" :class="[isPasswordShow ? 'fa-eye-slash' : 'fa-eye']"></i>
              </button>
            </div>

            <div class="d-flex justify-content-between align-items-center auth-subtitle auth-checkbox-row">
              <div class="form-check">
                <input v-model="rememberMe" class="form-check-input" type="checkbox" id="loginCheckbox">
                <label class="form-check-label text-white" for="loginCheckbox">Remember Me</label>
              </div>
              <router-link :to="{ name: 'reset_password' }" class="text-white fs-14">Forgot Password?</router-link>
            </div>

            <div v-if="errorMsg" class="alert alert-danger login-error-alert-compact">
              <div class="fw-semibold">{{ errorMsg }}</div>
              <div class="small mt-1">Login diagnostics available.</div>
            </div>

            <button
              v-if="errorMsg"
              type="button"
              class="btn btn-outline-light w-100 auth-button auth-button-outline"
              @click="openDiagnosticsModal"
            >
              View Login Diagnostics
            </button>

            <button class="btn btn-primary w-100 login-btn auth-button" :disabled="isSubmitting">
              {{ isSubmitting ? 'Signing in...' : 'Sign in' }}
            </button>
            <button type="button" class="btn btn-secondary w-100 auth-button auth-button-secondary" :disabled="isSubmitting" @click="tempLoginBypass">Temp Login Bypass (Demo)</button>
          </form>

          <div class="other-option auth-social-row">
            <p>Or continue with</p>
            <div class="social-box d-flex justify-content-center gap-20">
              <a href="#"><i class="fa-brands fa-facebook-f"></i></a>
              <a href="#"><i class="fa-brands fa-twitter"></i></a>
              <a href="#"><i class="fa-brands fa-google"></i></a>
              <a href="#"><i class="fa-brands fa-instagram"></i></a>
            </div>
          </div>

          <div class="other-option auth-footer auth-footer-row">
            <p class="mb-0 text-white">Don't have an account? <router-link to="/register" class="text-white text-decoration-underline">Click here to sign up.</router-link></p>
          </div>

          <div class="other-option auth-footer auth-footer-row">
            <p class="mb-0 text-white">Version: {{ appVersion }} - <a href="/changelog.html" class="text-white text-decoration-underline" target="_blank" rel="noopener noreferrer">Change Log</a></p>
          </div>
        </div>
      </div>

      <div
        v-if="showDiagnosticsModal"
        class="login-diagnostics-backdrop"
        @click.self="closeDiagnosticsModal"
      >
        <div class="login-diagnostics-modal" role="dialog" aria-modal="true" aria-label="Login diagnostics">
          <div class="login-diagnostics-header">
            <h5 class="mb-0">Login Diagnostics</h5>
            <button type="button" class="btn-close btn-close-white" aria-label="Close" @click="closeDiagnosticsModal"></button>
          </div>
          <div class="login-diagnostics-body">
            <pre class="login-diagnostics-pre">{{ loginDiagnostics }}</pre>
          </div>
          <div class="login-diagnostics-footer">
            <button type="button" class="btn btn-outline-light btn-sm" @click="copyLoginDiagnostics">
              {{ diagnosticsCopied ? 'Diagnostics Copied' : 'Copy Diagnostics' }}
            </button>
            <button type="button" class="btn btn-primary btn-sm" @click="closeDiagnosticsModal">Close</button>
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
  padding: 16px 12px;
}


.login-body {
  max-width: 430px;
  width: 100%;
  border: 8px solid rgba(0, 0, 0, 0.08) !important;
  border-radius: 10px !important;
  background: rgba(255, 255, 255, 0.95) !important;
  padding: 20px !important;
}

.login-body {
  border-radius: 10px;
  background: #f3f3f3;

  /* OUTER soft shadow */
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.1),   /* thin outer border */
    0 3px 10px rgba(0, 0, 0, 0.12); /* drop shadow */

  padding: 20px;
}


.light-theme .main-content .login-body {
  background: rgba(255, 255, 255, 1);
  border: 1px solid black;
}

.panel-title-form {
  color: #A9B4CC;
  font-weight: 600;
  font-size: 1.22rem;
  line-height: 1.25;
  margin-bottom: 14px;
}

/* Input Group Rounded Borders */
.input-group-rounded {
  display: flex;
  align-items: center;
  border: 1.5px solid rgba(13, 153, 255, 0.5);
  border-radius: 9px;
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
  padding: 10px 12px !important;
  min-height: 42px;
  font-size: 0.92rem;
}

.input-group-rounded .input-group-text {
  border: none !important;
  border-right: 1px solid rgba(13, 153, 255, 0.3) !important;
  background: transparent !important;
  border-radius: 0 !important;
  padding: 0 10px !important;
  min-width: auto !important;
  font-size: 0.9rem;
}

.password-show {
  border: none !important;
  border-left: 2px solid rgba(13, 153, 255, 0.2) !important;
  background: transparent !important;
  padding: 0 9px;
  display: flex;
  align-items: center;
  cursor: pointer;
  color: #A9B4CC;
  font-size: 0.9rem;
}

.password-show:hover {
  color: #0D99FF;
}

.login-error-alert-compact {
  text-align: left !important;
  font-size: 0.86rem;
  padding: 8px 10px;
}

.auth-header {
  margin-bottom: 4px;
}

.auth-logo-wrap img {
  max-height: 38px;
  width: auto;
}

.auth-title {
  margin-top: 2px;
  margin-bottom: 8px;
}

.auth-content.auth-column {
  width: 100%;
  max-width: 360px;
  margin: 0 auto;
}

.auth-form,
.auth-social-row,
.auth-footer-row {
  width: 100%;
}

.auth-form-group {
  width: 100%;
  margin: 0 0 8px;
}

.auth-subtitle,
.auth-subtitle .form-check-label,
.auth-subtitle a,
.other-option p,
.other-option a {
  font-size: 0.85rem !important;
}

.auth-checkbox-row {
  width: 100%;
  margin: 0 0 10px;
}

.auth-checkbox-row .form-check {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding-left: 0;
}

.auth-checkbox-row .form-check-input {
  margin: 0 !important;
  float: none;
}

.auth-checkbox-row .form-check-label {
  margin: 0;
}

.auth-social-row {
  margin: 8px 0 0;
}

.auth-social-row p {
  margin-bottom: 6px;
}

.auth-social-row .social-box {
  width: 100%;
  gap: 14px !important;
}

.auth-social-row .social-box a {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.auth-social-row .social-box a i {
  font-size: 1.02rem;
}

.auth-button {
  width: 100%;
  min-height: 40px;
  padding-top: 8px;
  padding-bottom: 8px;
  font-size: 0.92rem;
  border-radius: 8px;
}

.auth-form .auth-button + .auth-button {
  margin-top: 8px;
}

.auth-button-outline {
  margin-bottom: 10px;
}

.auth-button-secondary {
  border-color: rgba(58, 79, 118, 0.85);
  background-color: rgba(58, 79, 118, 0.9);
}

.auth-password-toggle {
  appearance: none;
}

.auth-footer {
  margin-top: 6px;
}

.auth-footer-row p {
  width: 100%;
  text-align: center;
  line-height: 1.35;
}

.login-error-alert-compact {
  margin-bottom: 10px;
}

.login-diagnostics-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(7, 23, 57, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 16px;
}

.login-diagnostics-modal {
  width: min(92vw, 680px);
  max-height: 82vh;
  background: #0f1f45;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.login-diagnostics-header,
.login-diagnostics-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.04);
}

.login-diagnostics-body {
  padding: 12px 14px;
  overflow: auto;
}

.login-diagnostics-pre {
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  font-size: 0.78rem;
  line-height: 1.38;
  color: #d7e4ff;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

</style>