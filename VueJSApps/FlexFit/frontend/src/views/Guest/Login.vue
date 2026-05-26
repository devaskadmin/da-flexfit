<script setup>
import { ref } from "vue";
import axios from "axios";
import { useRouter } from "vue-router";
import { API_BASE } from '@/config/env';
import { isDemoMode } from '@/config/appConfig';
import { useAuth } from '@/composable/useAuth';

const router = useRouter();
const { fetchUser } = useAuth();

const username = ref("");
const password = ref("");
const isPasswordShow = ref(false);
const rememberMe = ref(false);
const errorMsg = ref("");
const loginDiagnostics = ref("");
const diagnosticsCopied = ref(false);
const showDiagnosticsModal = ref(false);
const isSubmitting = ref(false);
const isConnectionLimitError = ref(false);
const isDbAuthError = ref(false);
const appVersion = import.meta.env.VITE_APP_VERSION || '0.69.0';
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
  cookieDetected = null,
  cookieSentBack = null,
  corsPassed = null,
  sameSiteValue = null,
  secureFlag = null,
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
    `- cookieDetected: ${cookieDetected === null ? 'unknown' : cookieDetected}`,
    `- cookieSentBack: ${cookieSentBack === null ? 'unknown' : cookieSentBack}`,
    `- corsPassed: ${corsPassed === null ? 'unknown' : corsPassed}`,
    `- sameSiteValue: ${sameSiteValue ?? 'unknown'}`,
    `- secureFlag: ${secureFlag === null ? 'unknown' : secureFlag}`,
    `- Reason: ${reason || 'none'}`,
    `- Server Message: ${apiMessage || 'none'}`,
    `- Network Message: ${networkMessage || 'none'}`,
  ].join('\n');
};

const buildCompactLoginMessage = ({ status, fallbackMessage, code = '' } = {}) => {
  if (code === 'ER_ACCESS_DENIED_ERROR') {
    return 'Database connection failed. The FlexFit server reached the database but authentication was rejected. Please verify Render environment variables: DB_HOST, DB_USER, DB_PASSWORD, DB_DATABASE.';
  }
  if (code === 'ECONNREFUSED') {
    return 'Database offline. Sign-in is unavailable until the database server is reachable.';
  }
  if (code === 'ETIMEDOUT' || code === 'ECONNRESET') {
    return 'Database unavailable. The connection timed out. Please retry in a moment.';
  }
  if (String(fallbackMessage || '').includes('ER_TOO_MANY_USER_CONNECTIONS')) {
    return 'FlexFit database connection limit reached. The hosting provider rejected additional database connections. Please wait a minute and retry.';
  }

  if (
    String(fallbackMessage || '').toLowerCase().includes('session store') ||
    String(fallbackMessage || '').includes('ECONNRESET') ||
    String(fallbackMessage || '').includes('ECONNREFUSED')
  ) {
    return 'Sign-in failed: session service temporarily unavailable. Please wait a moment and retry.';
  }

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

const serverDiagnostics = ref(null);
const diagnosticsLoading = ref(false);

const fetchServerDiagnostics = async () => {
  diagnosticsLoading.value = true;
  try {
    const res = await axios.get(`${API_BASE}/api/debug/login-diagnostics`, { withCredentials: true });
    serverDiagnostics.value = res.data || null;
  } catch {
    serverDiagnostics.value = { enabled: false, message: 'Contact administrator for details.' };
  } finally {
    diagnosticsLoading.value = false;
  }
};

const openDiagnosticsModal = () => {
  showDiagnosticsModal.value = true;
  fetchServerDiagnostics();
};

const closeDiagnosticsModal = () => {
  showDiagnosticsModal.value = false;
  serverDiagnostics.value = null;
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
  code = '',
}) => {
  isDbAuthError.value = code === 'ER_ACCESS_DENIED_ERROR';
  const isSafari = isSafariBrowser();
  const compactMessage = buildCompactLoginMessage({ status, fallbackMessage, code });
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
  let lastDiagnostics = {};

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
      lastDiagnostics = sessionRes?.data?.diagnostics || {};

      if (sessionRes?.data?.loggedIn === true) {
        return {
          passed: true,
          status: sessionRes?.status ?? null,
          hasSessionCookie: sessionRes?.data?.diagnostics?.hasSessionCookie ?? true,
          note: sessionRes?.data?.diagnostics?.note || 'Session verification succeeded.',
          diagnostics: lastDiagnostics,
        };
      }
    } catch (err) {
      lastStatus = err?.response?.status ?? null;
      lastHasSessionCookie = err?.response?.data?.diagnostics?.hasSessionCookie ?? lastHasSessionCookie;
      lastNote = err?.response?.data?.diagnostics?.note || err?.message || lastNote;
      lastDiagnostics = err?.response?.data?.diagnostics || lastDiagnostics;

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
    diagnostics: lastDiagnostics,
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
  isConnectionLimitError.value = false;
  isDbAuthError.value = false;

  const safeUsername = String(username.value || "").trim();
  const safePassword = String(password.value || "");

  try {
    devLog('Submitting login request', { username: safeUsername, rememberMe: !!rememberMe.value });

    const loginUrl = `${API_BASE}/api/login`;
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
        const d = sessionState?.diagnostics || {};
        setLoginError({
          fallbackMessage: 'Login succeeded, but the session cookie was not available for follow-up requests.',
          reason: 'Session persistence issue after successful authentication.',
          status: sessionState?.status,
          apiMessage: sessionState?.note || 'Login successful, but session verification failed.',
          loginSucceeded: true,
          sessionCookiePersisted: sessionState?.hasSessionCookie,
          sessionVerificationPassed: false,
          cookieDetected: d.cookieDetected ?? null,
          cookieSentBack: d.cookieSentBack ?? null,
          corsPassed: d.corsPassed ?? null,
          sameSiteValue: d.sameSiteValue ?? null,
          secureFlag: d.secureFlag ?? null,
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
        const d = sessionState?.diagnostics || {};
        setLoginError({
          fallbackMessage: 'Login succeeded, but the session cookie was not available for follow-up requests.',
          reason: 'Session persistence issue after successful authentication.',
          status: sessionState?.status,
          apiMessage: sessionState?.note || response?.data?.message,
          loginSucceeded: true,
          sessionCookiePersisted: sessionState?.hasSessionCookie,
          sessionVerificationPassed: false,
          cookieDetected: d.cookieDetected ?? null,
          cookieSentBack: d.cookieSentBack ?? null,
          corsPassed: d.corsPassed ?? null,
          sameSiteValue: d.sameSiteValue ?? null,
          secureFlag: d.secureFlag ?? null,
          safariDetailed: true,
        });
        return;
      }
      // Hydrate the auth store before navigating so user/role are available immediately
      await fetchUser();
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
    // The global error handler on the backend always returns { error, code }.
    // Older route-level errors return { error } or { message }.
    // error?.response?.data may be a string if Express returned HTML (shouldn't
    // happen now that we have the global handler, but guard anyway).
    const rawData = error?.response?.data;
    const apiMessage =
      (typeof rawData === 'object' && rawData !== null
        ? (rawData.message || rawData.error || null)
        : null) ||
      'Server error during sign-in. Please try again.';
    const errorCode = typeof rawData === 'object' ? (rawData.code || '') : '';
    const isConnLimit =
      String(apiMessage).includes('ER_TOO_MANY_USER_CONNECTIONS') ||
      errorCode === 'ER_TOO_MANY_USER_CONNECTIONS';
    const isSessionStore =
      String(apiMessage).toLowerCase().includes('session store') ||
      ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT'].includes(errorCode);
    const isDbAuth = errorCode === 'ER_ACCESS_DENIED_ERROR';
    if (isConnLimit) {
      isConnectionLimitError.value = true;
    }
    setLoginError({
      fallbackMessage: apiMessage,
      reason: isDbAuth
        ? 'Database credentials were rejected by MySQL. Verify Render environment variables.'
        : isConnLimit
        ? 'Database connection limit reached on hosting provider.'
        : isSessionStore
        ? 'Session store temporarily unavailable.'
        : 'Browser could not complete sign-in request.',
      status: error?.response?.status,
      apiMessage,
      networkMessage: error?.message,
      loginSucceeded: false,
      sessionCookiePersisted: null,
      sessionVerificationPassed: false,
      code: errorCode,
      safariDetailed: !isConnLimit && !isDbAuth,
    });
    if (isConnLimit || isDbAuth) {
      openDiagnosticsModal();
    }
  } finally {
    isSubmitting.value = false;
  }
};

// 🔹 Demo Login — prefill credentials and reuse existing login()
const DEMO_ACCOUNTS = {
  user:    { email: 'user@demo.com',    password: '-^LtH1kqJrDn' },
  trainer: { email: 'trainer@demo.com', password: '-^LtH1kqJrDn' },
  admin:   { email: 'admin@demo.com',   password: '-^LtH1kqJrDn' },
};

const demoLogin = async (role) => {
  const account = DEMO_ACCOUNTS[role];
  if (!account) return;
  username.value  = account.email;
  password.value  = account.password;
  rememberMe.value = true;
  await login();
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

            <div v-if="errorMsg" class="login-diagnostics-row">
              <button
                type="button"
                class="btn auth-button auth-button-outline"
                @click="openDiagnosticsModal"
              >
                <i class="fa-regular fa-magnifying-glass me-1"></i> View Login Diagnostics
              </button>
            </div>

            <button class="btn btn-primary w-100 login-btn auth-button" :disabled="isSubmitting">
              {{ isSubmitting ? 'Signing in...' : 'Sign in' }}
            </button>

            <!-- Demo mode buttons — only visible when VITE_OPERATING_MODE=demo -->
            <template v-if="isDemoMode">
              <div class="demo-divider">
                <span>Demo Accounts</span>
              </div>
              <div class="demo-buttons-row">
                <button type="button" class="btn demo-btn demo-btn-user" :disabled="isSubmitting" @click="demoLogin('user')">User Login</button>
                <button type="button" class="btn demo-btn demo-btn-trainer" :disabled="isSubmitting" @click="demoLogin('trainer')">Trainer Login</button>
                <button type="button" class="btn demo-btn demo-btn-admin" :disabled="isSubmitting" @click="demoLogin('admin')">Admin Login</button>
              </div>
            </template>
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
            <!-- Connection limit banner -->
            <div v-if="isConnectionLimitError" class="login-diag-conn-limit">
              <p class="login-diag-conn-title">Database server connection limit reached.</p>
              <p class="login-diag-conn-sub">FlexFit login succeeded but database resources were unavailable.</p>
              <p class="login-diag-conn-error">Error: <code>ER_TOO_MANY_USER_CONNECTIONS</code></p>
              <p class="login-diag-conn-suggestions">Suggestions:</p>
              <ul class="login-diag-conn-list">
                <li>Wait 1–2 minutes</li>
                <li>Retry login</li>
                <li>Contact administrator</li>
              </ul>
            </div>

            <!-- DB auth error banner -->
            <div v-if="isDbAuthError" class="login-diag-conn-limit">
              <p class="login-diag-conn-title">Database authentication failed.</p>
              <p class="login-diag-conn-sub">The FlexFit server reached the database but authentication was rejected.</p>
              <p class="login-diag-conn-error">Error: <code>ER_ACCESS_DENIED_ERROR</code></p>
              <p class="login-diag-conn-suggestions">Please verify these Render environment variables:</p>
              <ul class="login-diag-conn-list">
                <li><code>DB_HOST</code></li>
                <li><code>DB_USER</code></li>
                <li><code>DB_PASSWORD</code></li>
                <li><code>DB_DATABASE</code></li>
              </ul>
              <p class="login-diag-conn-sub">This is not a browser or cookie issue.</p>
            </div>

            <!-- Server diagnostics -->
            <div v-if="diagnosticsLoading" class="login-diag-loading">Loading diagnostics…</div>

            <template v-else-if="serverDiagnostics">
              <!-- DEBUG disabled: show contact message only -->
              <div v-if="!serverDiagnostics.enabled" class="login-diag-contact">
                <i class="fa-regular fa-circle-info login-diag-contact-icon"></i>
                {{ serverDiagnostics.message || 'Contact administrator for details.' }}
              </div>

              <!-- DEBUG enabled: structured sections -->
              <template v-else>
                <div class="login-diag-section">
                  <div class="login-diag-section-title">Environment</div>
                  <div class="login-diag-row"><span>Node Mode</span><code>{{ serverDiagnostics.environment?.nodeEnv }}</code></div>
                  <div class="login-diag-row"><span>Debug Enabled</span><code>{{ serverDiagnostics.environment?.debug }}</code></div>
                  <div class="login-diag-row"><span>Frontend Configured</span><code>{{ serverDiagnostics.environment?.frontendConfigured }}</code></div>
                  <div class="login-diag-row"><span>CORS Configured</span><code>{{ serverDiagnostics.environment?.corsConfigured }}</code></div>
                  <div class="login-diag-row"><span>Secure Cookies</span><code>{{ serverDiagnostics.environment?.sessionCookieSecure }}</code></div>
                </div>

                <div class="login-diag-section">
                  <div class="login-diag-section-title">Database</div>
                  <div class="login-diag-row"><span>Host Configured</span><code>{{ serverDiagnostics.database?.hostConfigured }}</code></div>
                  <div class="login-diag-row"><span>DB Configured</span><code>{{ serverDiagnostics.database?.databaseConfigured }}</code></div>
                  <div class="login-diag-row"><span>User Configured</span><code>{{ serverDiagnostics.database?.userConfigured }}</code></div>
                  <div class="login-diag-row"><span>Port</span><code>{{ serverDiagnostics.database?.port }}</code></div>
                </div>

                <div class="login-diag-section">
                  <div class="login-diag-section-title">Server</div>
                  <div class="login-diag-row"><span>Timestamp</span><code>{{ serverDiagnostics.server?.timestamp }}</code></div>
                  <div class="login-diag-row"><span>Uptime</span><code>{{ serverDiagnostics.server?.uptime }}s</code></div>
                  <div class="login-diag-row"><span>Heap Used</span><code>{{ Math.round((serverDiagnostics.server?.memory?.heapUsed || 0) / 1024 / 1024) }} MB</code></div>
                  <div class="login-diag-row"><span>Platform</span><code>{{ serverDiagnostics.server?.platform }}</code></div>
                </div>
              </template>
            </template>

            <!-- Client-side diagnostics (always shown for copy) -->
            <details class="login-diag-client-details">
              <summary>Client diagnostics</summary>
              <pre class="login-diagnostics-pre">{{ loginDiagnostics }}</pre>
            </details>
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

/* ── Login diagnostics button row ── */
.login-diagnostics-row {
  display: flex;
  justify-content: center;
  margin-top: 12px;
  margin-bottom: 12px;
}

/* ── Diagnostics button — amber, defeats Bootstrap ── */
button.auth-button-outline,
.auth-button-outline {
  background: #fff8e1 !important;
  color: #8a5300 !important;
  border: 2px solid #ffb300 !important;
  opacity: 1 !important;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  font-weight: 700;
  border-radius: 10px;
  padding: 8px 20px;
  transition: background 0.2s ease, transform 0.2s ease;
}

button.auth-button-outline:hover,
.auth-button-outline:hover {
  background: #fff3c4 !important;
  transform: translateY(-1px);
}

button.auth-button-outline:disabled,
.auth-button-outline:disabled {
  opacity: 0.75 !important;
}

.auth-button-secondary {
  border-color: rgba(58, 79, 118, 0.85);
  background-color: rgba(58, 79, 118, 0.9);
}

.auth-password-toggle {
  appearance: none;
}

/* ── Demo mode buttons ─────────────────────────────────────── */
.demo-divider {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 10px 0 6px;
  font-size: 0.75rem;
  color: #A9B4CC;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.demo-divider::before,
.demo-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(169, 180, 204, 0.35);
}

.demo-buttons-row {
  display: flex;
  gap: 6px;
  width: 100%;
}

.demo-btn {
  flex: 1;
  min-height: 36px;
  font-size: 0.78rem;
  font-weight: 600;
  border-radius: 8px;
  padding: 5px 4px;
  letter-spacing: 0.01em;
  transition: opacity 0.2s, transform 0.1s;
}
.demo-btn:active { transform: scale(0.97); }
.demo-btn:disabled { opacity: 0.55; }

.demo-btn-user {
  background: rgba(13, 153, 255, 0.15);
  border: 1.5px solid rgba(13, 153, 255, 0.55);
  color: #0D99FF;
}
.demo-btn-user:hover { background: rgba(13, 153, 255, 0.25); }

.demo-btn-trainer {
  background: rgba(32, 201, 151, 0.12);
  border: 1.5px solid rgba(32, 201, 151, 0.55);
  color: #20c997;
}
.demo-btn-trainer:hover { background: rgba(32, 201, 151, 0.22); }

.demo-btn-admin {
  background: rgba(253, 126, 20, 0.12);
  border: 1.5px solid rgba(253, 126, 20, 0.55);
  color: #fd7e14;
}
.demo-btn-admin:hover { background: rgba(253, 126, 20, 0.22); }

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

/* ── Diagnostics modal: loading / contact-admin ── */
.login-diag-loading {
  color: #a9c4ff;
  font-size: 0.84rem;
  padding: 10px 0;
  text-align: center;
}

.login-diag-contact {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 8px;
  padding: 12px 14px;
  color: #d7e4ff;
  font-size: 0.86rem;
  margin-bottom: 10px;
}

.login-diag-contact-icon {
  color: #7ba8ff;
  font-size: 1rem;
  flex-shrink: 0;
}

/* ── Diagnostics modal: structured sections ── */
.login-diag-section {
  margin-bottom: 14px;
}

.login-diag-section-title {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #7ba8ff;
  margin-bottom: 6px;
  padding-bottom: 4px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}

.login-diag-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  padding: 3px 0;
  font-size: 0.81rem;
  color: #c5d6f5;
}

.login-diag-row span {
  color: #8aa8d8;
  flex-shrink: 0;
}

.login-diag-row code {
  background: rgba(255,255,255,0.08);
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 0.78rem;
  color: #d7e4ff;
  word-break: break-all;
}

/* ── Client diagnostics collapsible ── */
.login-diag-client-details {
  margin-top: 12px;
  border-top: 1px solid rgba(255,255,255,0.08);
  padding-top: 8px;
}

.login-diag-client-details summary {
  font-size: 0.78rem;
  color: #7ba8ff;
  cursor: pointer;
  user-select: none;
  margin-bottom: 6px;
}

.login-diag-conn-limit {
  background: rgba(220, 80, 60, 0.12);
  border: 1px solid rgba(220, 80, 60, 0.4);
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 12px;
}
.login-diag-conn-title {
  font-weight: 700;
  font-size: 0.92rem;
  color: #ff8a7a;
  margin: 0 0 4px;
}
.login-diag-conn-sub {
  font-size: 0.83rem;
  color: #d7e4ff;
  margin: 0 0 6px;
}
.login-diag-conn-error {
  font-size: 0.82rem;
  color: #d7e4ff;
  margin: 0 0 8px;
}
.login-diag-conn-error code {
  background: rgba(255,255,255,0.08);
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 0.8rem;
  color: #ffb3ab;
}
.login-diag-conn-suggestions {
  font-size: 0.82rem;
  font-weight: 600;
  color: #a9c4ff;
  margin: 0 0 4px;
}
.login-diag-conn-list {
  margin: 0;
  padding-left: 18px;
  font-size: 0.82rem;
  color: #d7e4ff;
  line-height: 1.7;
}

</style>