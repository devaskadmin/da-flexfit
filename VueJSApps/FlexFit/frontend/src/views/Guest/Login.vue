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
            <div v-if="errorMsg" class="alert alert-danger mb-3 login-error-alert-compact">
              <div class="fw-semibold">{{ errorMsg }}</div>
              <div class="small mt-1">Login diagnostics available.</div>
            </div>
            <button
              v-if="errorMsg"
              type="button"
              class="btn btn-outline-light w-100 mb-3"
              @click="openDiagnosticsModal"
            >
              View Login Diagnostics
            </button>


            <button class="btn btn-primary w-100 login-btn" :disabled="isSubmitting">
              {{ isSubmitting ? 'Signing in...' : 'Sign in' }}
            </button>
            <button type="button" class="btn btn-secondary w-100 mt-2" :disabled="isSubmitting" @click="tempLoginBypass">Temp Login Bypass (Demo)</button>

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



          <!-- Registration row -->
          <div class="other-option mt-3">
            <p class="mb-0 text-white">Don't have an account?</p>
            <p class="mb-0">
              <router-link to="/register" class="text-white text-decoration-underline">Click here to sign up.</router-link>
            </p>
          </div>

          <!-- Version row -->
          <div class="other-option mt-2">
            <p class="mb-0 text-white">Version: {{ appVersion }}</p>
            <p class="mb-0">
              <a href="/changelog.html" class="text-white text-decoration-underline" target="_blank" rel="noopener noreferrer">Developer Change Log Notes</a>
            </p>
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
}


.login-body {
  max-width: 480px;
  width: 100%;
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

.password-show:hover {
  color: #0D99FF;
}

.login-error-alert-compact {
  text-align: left !important;
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