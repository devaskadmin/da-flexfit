<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { API_BASE } from '@/config/env';
import { isDemoMode } from '@/config/appConfig';
import { useAuth } from '@/composable/useAuth';
import loginLogo from '@/assets/logo/login-logo.png';
import apiClient from '@/services/apiClient';

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
const appVersion = import.meta.env.VITE_APP_VERSION || '0.84.42';
const isDev = import.meta.env.DEV;

const isSafariBrowser = () => {
  const ua = navigator.userAgent || '';
  const isSafari = /Safari/i.test(ua);
  const isOtherBrowser = /(Chrome|CriOS|FxiOS|EdgiOS|Edg|OPR|Opera|SamsungBrowser|Android)/i.test(ua);
  return isSafari && !isOtherBrowser;
};

const getParentDomain = (hostname = '') => {
  const parts = String(hostname || '').toLowerCase().split('.').filter(Boolean);
  if (parts.length < 2) return hostname;
  return `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
};

const detectCrossSiteArchitecture = () => {
  try {
    const appHost = new URL(window.location.origin).hostname;
    const apiHost = new URL(API_BASE).hostname;
    const appParent = getParentDomain(appHost);
    const apiParent = getParentDomain(apiHost);
    return {
      appHost,
      apiHost,
      appParent,
      apiParent,
      isCrossSiteParentDomain: appParent !== apiParent,
    };
  } catch (_) {
    return {
      appHost: 'unknown',
      apiHost: 'unknown',
      appParent: 'unknown',
      apiParent: 'unknown',
      isCrossSiteParentDomain: false,
    };
  }
};

const buildSafariLoginFailureMessage = ({
  reason = 'Login did not complete.',
  status,
  apiMessage,
  networkMessage,
} = {}) => {
  const arch = detectCrossSiteArchitecture();
  const detailLines = [
    `Safari sign-in issue detected. ${reason}`,
    '',
    'Details:',
    `- API Base: ${API_BASE}`,
    `- App Host: ${arch.appHost}`,
    `- API Host: ${arch.apiHost}`,
    `- App Parent Domain: ${arch.appParent}`,
    `- API Parent Domain: ${arch.apiParent}`,
    `- HTTP Status: ${status ?? 'none'}`,
    `- Server Message: ${apiMessage || 'none'}`,
    `- Network Message: ${networkMessage || 'none'}`,
    '',
  ];

  if (arch.isCrossSiteParentDomain) {
    detailLines.push(
      'Cross-site cookie architecture detected.',
      'Use custom same-site domains for production: workoutatlas.com and api.workoutatlas.com.'
    );
  } else {
    detailLines.push(
      'Use production custom domains with shared parent domain and COOKIE_DOMAIN=.workoutatlas.com for stable Safari auth persistence.'
    );
  }

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
  const arch = detectCrossSiteArchitecture();

  return [
    'WorkoutAtlas Login Diagnostics',
    `- Timestamp: ${now}`,
    `- Browser: ${userAgent}`,
    `- Is Safari: ${isSafariBrowser()}`,
    `- Cookies Enabled: ${navigator.cookieEnabled}`,
    `- App Origin: ${origin}`,
    `- API Base: ${API_BASE}`,
    `- App Parent Domain: ${arch.appParent}`,
    `- API Parent Domain: ${arch.apiParent}`,
    `- Cross-site Parent Domains: ${arch.isCrossSiteParentDomain}`,
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
    ...(arch.isCrossSiteParentDomain
      ? [
          '- Architecture Notice: Cross-site cookie architecture detected.',
          '- Production Fix: Use custom same-site domains workoutatlas.com and api.workoutatlas.com.',
        ]
      : []),
  ].join('\n');
};

const buildCompactLoginMessage = ({ status, fallbackMessage, code = '' } = {}) => {
  if (!status && String(fallbackMessage || '').toLowerCase().includes('could not reach the local api server')) {
    return fallbackMessage;
  }

  if (code === 'ER_ACCESS_DENIED_ERROR') {
    return 'Database connection failed. The WorkoutAtlas server reached the database but authentication was rejected. Please verify environment variables: DB_HOST, DB_USER, DB_PASSWORD, DB_DATABASE.';
  }
  if (code === 'ECONNREFUSED') {
    return 'Database offline. Sign-in is unavailable until the database server is reachable.';
  }
  if (code === 'ETIMEDOUT' || code === 'ECONNRESET') {
    return 'Database unavailable. The connection timed out. Please retry in a moment.';
  }
  if (String(fallbackMessage || '').includes('ER_TOO_MANY_USER_CONNECTIONS')) {
    return 'WorkoutAtlas database connection limit reached. The hosting provider rejected additional database connections. Please wait a minute and retry.';
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
    const res = await apiClient.get('/api/debug/login-diagnostics');
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

// Wait briefly then run one explicit session verification check.
const waitForSessionReady = async () => {
  const sessionUrl = '/api/session/check';

  await sleep(500);

  try {
    const sessionRes = await apiClient.get(sessionUrl, {
      headers: { 'Cache-Control': 'no-cache' },
    });

    console.log('Session check response:', sessionRes?.data || null);

    return {
      passed: sessionRes?.data?.authenticated === true,
      status: sessionRes?.status ?? null,
      hasSessionCookie: sessionRes?.data?.cookiePresent ?? null,
      note: sessionRes?.data?.authenticated ? 'Session verification succeeded.' : 'Session verification failed.',
      diagnostics: sessionRes?.data || {},
    };
  } catch (err) {
    console.log('Session check response error:', err?.response?.data || err?.message || null);

    return {
      passed: false,
      status: err?.response?.status ?? null,
      hasSessionCookie: err?.response?.data?.cookiePresent ?? null,
      note: err?.response?.data?.message || err?.message || 'Session verification failed.',
      diagnostics: err?.response?.data || {},
    };
  }
};

const goToDashboard = async () => {
  devLog('Routing to dashboard');
  await router.replace({ name: "dashboard_index" });
};

// Login Function
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

    const response = await apiClient.post(
      '/api/login',
      {
        username: safeUsername,
        password: safePassword,
        rememberMe: !!rememberMe.value,
      }
    );

    if (response?.data?.requiresPasswordReset === true) {
      devLog('Login requires password reset');
      const sessionState = await waitForSessionReady();
      if (!sessionState?.passed) {
        const d = sessionState?.diagnostics || {};
        setLoginError({
          fallbackMessage: 'Session persistence issue',
          reason: 'Session persistence issue after successful authentication.',
          status: sessionState?.status,
          apiMessage: sessionState?.note || 'Login successful, but session verification failed.',
          loginSucceeded: true,
          sessionCookiePersisted: sessionState?.hasSessionCookie,
          sessionVerificationPassed: false,
          cookieDetected: d.cookiePresent ?? null,
          cookieSentBack: d.cookiePresent ?? null,
          corsPassed: d.diagnostics?.corsResult ?? null,
          sameSiteValue: d.diagnostics?.sameSiteValue ?? null,
          secureFlag: d.diagnostics?.secureFlag ?? null,
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
          fallbackMessage: 'Session persistence issue',
          reason: 'Session persistence issue after successful authentication.',
          status: sessionState?.status,
          apiMessage: sessionState?.note || response?.data?.message,
          loginSucceeded: true,
          sessionCookiePersisted: sessionState?.hasSessionCookie,
          sessionVerificationPassed: false,
          cookieDetected: d.cookiePresent ?? null,
          cookieSentBack: d.cookiePresent ?? null,
          corsPassed: d.diagnostics?.corsResult ?? null,
          sameSiteValue: d.diagnostics?.sameSiteValue ?? null,
          secureFlag: d.diagnostics?.secureFlag ?? null,
          safariDetailed: true,
        });
        return;
      }
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
    const rawData = error?.response?.data;
    const hasNoResponse = !error?.response;
    const apiMessage =
      (typeof rawData === 'object' && rawData !== null
        ? (rawData.message || rawData.error || null)
        : null) ||
      (hasNoResponse
        ? 'WorkoutAtlas could not reach the local API server. Verify that the backend is running and that the API URL is correct.'
        : 'Server error during sign-in. Please try again.');
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
        : hasNoResponse
        ? 'No HTTP response was received from the API server.'
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

// Demo Login: prefill credentials and reuse existing login()
const DEMO_ACCOUNTS = {
  user: { email: 'user@demo.com', password: '-^LtH1kqJrDn' },
  trainer: { email: 'trainer@demo.com', password: '-^LtH1kqJrDn' },
  admin: { email: 'admin@demo.com', password: '-^LtH1kqJrDn' },
};

const demoLogin = async (role) => {
  const account = DEMO_ACCOUNTS[role];
  if (!account) return;
  username.value = account.email;
  password.value = account.password;
  rememberMe.value = true;
  await login();
};
</script>

<template>
  <main class="wa-login" role="main" aria-label="WorkoutAtlas login">
    <section class="wa-login__card login-card" aria-label="Sign in card">
      <router-link
        class="wa-home-btn login-home-button"
        :to="{ name: 'dashboard_index' }"
        aria-label="Return to home"
      >
        <i class="fa-duotone fa-house-chimney"></i>
      </router-link>

      <header class="wa-brand">
        <img
          :src="loginLogo"
          alt="WorkoutAtlas"
          class="wa-brand__logo"
        />
      </header>

      <section class="wa-welcome" aria-label="Welcome section">
        <h1 class="login-title">Welcome back!</h1>
        <p class="login-subtitle">Log in to continue your fitness journey.</p>
      </section>

      <form @submit.prevent="login" class="wa-form login-form" :aria-busy="isSubmitting ? 'true' : 'false'">
        <label class="wa-input login-input" for="wa-username-input">
          <span class="wa-input__icon" aria-hidden="true">
            <i class="fa-regular fa-user"></i>
          </span>
          <input
            id="wa-username-input"
            v-model="username"
            type="text"
            placeholder="Username or email address"
            autocomplete="username email"
            autocapitalize="none"
            spellcheck="false"
            inputmode="email"
            required
            aria-label="Username or email address"
          >
        </label>

        <label class="wa-input login-input" for="wa-password-input">
          <span class="wa-input__icon" aria-hidden="true">
            <i class="fa-regular fa-lock"></i>
          </span>
          <input
            id="wa-password-input"
            v-model="password"
            :type="[isPasswordShow ? 'text' : 'password']"
            placeholder="Password"
            autocomplete="current-password"
            autocapitalize="none"
            spellcheck="false"
            required
            aria-label="Password"
          >
          <button
            type="button"
            class="wa-input__toggle"
            @click="isPasswordShow = !isPasswordShow"
            :aria-label="isPasswordShow ? 'Hide password' : 'Show password'"
            :aria-pressed="isPasswordShow ? 'true' : 'false'"
          >
            <i class="fa-duotone" :class="[isPasswordShow ? 'fa-eye-slash' : 'fa-eye']"></i>
          </button>
        </label>

        <div class="wa-row wa-row--between login-options-row">
          <label class="wa-remember" for="loginCheckbox">
            <input v-model="rememberMe" id="loginCheckbox" type="checkbox">
            <span>Remember Me</span>
          </label>
          <router-link :to="{ name: 'reset_password' }" class="wa-link forgot-password">Forgot Password?</router-link>
        </div>

        <div v-if="errorMsg" class="wa-error" role="alert" aria-live="assertive">
          <div class="wa-error__title">{{ errorMsg }}</div>
          <div class="wa-error__hint">Login diagnostics available.</div>
        </div>

        <div v-if="errorMsg" class="wa-diagnostics-row">
          <button
            type="button"
            class="wa-secondary-btn"
            @click="openDiagnosticsModal"
          >
            <i class="fa-regular fa-magnifying-glass"></i>
            <span>View Login Diagnostics</span>
          </button>
        </div>

        <button class="wa-primary-btn login-submit" :disabled="isSubmitting" aria-label="Sign in">
          <span>{{ isSubmitting ? 'Signing In...' : 'Sign In' }}</span>
          <i class="fa-regular fa-arrow-right-long" aria-hidden="true"></i>
        </button>

        <template v-if="isDemoMode">
          <div class="wa-divider login-divider"><span>Demo Accounts</span></div>
          <div class="wa-demo-grid demo-account-list">
            <button type="button" class="wa-demo-btn wa-demo-btn--user demo-account-button" :disabled="isSubmitting" @click="demoLogin('user')">
              <i class="fa-regular fa-user"></i>
              <span>User Login</span>
            </button>
            <button type="button" class="wa-demo-btn wa-demo-btn--trainer demo-account-button" :disabled="isSubmitting" @click="demoLogin('trainer')">
              <i class="fa-regular fa-dumbbell"></i>
              <span>Trainer Login</span>
            </button>
            <button type="button" class="wa-demo-btn wa-demo-btn--admin demo-account-button" :disabled="isSubmitting" @click="demoLogin('admin')">
              <i class="fa-regular fa-shield-check"></i>
              <span>Admin Login</span>
            </button>
          </div>
        </template>
      </form>

      <div class="wa-divider login-divider"><span>Or Continue With</span></div>
      <div class="wa-social social-login-list" aria-label="Social sign in options">
        <a href="#" class="social-login-button" aria-label="Continue with Facebook"><i class="fa-brands fa-facebook-f"></i></a>
        <a href="#" class="social-login-button" aria-label="Continue with Twitter"><i class="fa-brands fa-twitter"></i></a>
        <a href="#" class="social-login-button" aria-label="Continue with Google"><i class="fa-brands fa-google"></i></a>
        <a href="#" class="social-login-button" aria-label="Continue with Instagram"><i class="fa-brands fa-instagram"></i></a>
      </div>

      <p class="wa-signup login-footer">
        Don't have an account?
        <router-link to="/register">Sign up here</router-link>
      </p>

      <p class="wa-version login-footer">
        Version: {{ appVersion }}
        <span aria-hidden="true">•</span>
        <a href="/changelog.html" target="_blank" rel="noopener noreferrer">Change Log</a>
      </p>

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
            <div v-if="isConnectionLimitError" class="login-diag-conn-limit">
              <p class="login-diag-conn-title">Database server connection limit reached.</p>
              <p class="login-diag-conn-sub">WorkoutAtlas login succeeded but database resources were unavailable.</p>
              <p class="login-diag-conn-error">Error: <code>ER_TOO_MANY_USER_CONNECTIONS</code></p>
              <p class="login-diag-conn-suggestions">Suggestions:</p>
              <ul class="login-diag-conn-list">
                <li>Wait 1-2 minutes</li>
                <li>Retry login</li>
                <li>Contact administrator</li>
              </ul>
            </div>

            <div v-if="isDbAuthError" class="login-diag-conn-limit">
              <p class="login-diag-conn-title">Database authentication failed.</p>
              <p class="login-diag-conn-sub">The WorkoutAtlas server reached the database but authentication was rejected.</p>
              <p class="login-diag-conn-error">Error: <code>ER_ACCESS_DENIED_ERROR</code></p>
              <p class="login-diag-conn-suggestions">Please verify these environment variables:</p>
              <ul class="login-diag-conn-list">
                <li><code>DB_HOST</code></li>
                <li><code>DB_USER</code></li>
                <li><code>DB_PASSWORD</code></li>
                <li><code>DB_DATABASE</code></li>
              </ul>
              <p class="login-diag-conn-sub">This is not a browser or cookie issue.</p>
            </div>

            <div v-if="diagnosticsLoading" class="login-diag-loading">Loading diagnostics...</div>

            <template v-else-if="serverDiagnostics">
              <div v-if="!serverDiagnostics.enabled" class="login-diag-contact">
                <i class="fa-regular fa-circle-info login-diag-contact-icon"></i>
                {{ serverDiagnostics.message || 'Contact administrator for details.' }}
              </div>

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
    </section>
  </main>
</template>

<style scoped>
:global(html),
:global(body),
:global(#app) {
  width: 100%;
  min-height: 100%;
  margin: 0;
  padding: 0;
  background: #000;
}

.wa-login {
  --wa-bg: #0b0f17;
  --wa-surface: #121a26;
  --wa-card: rgba(10, 13, 17, 0.80);
  --wa-primary: #2563eb;
  --wa-success: #22c55e;
  --wa-danger: #ef4444;
  --wa-border: #6b7280;
  --wa-text: #f8fafc;
  --wa-text-subtle: #9ca3af;

  position: relative;
  isolation: isolate;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  min-height: 100vh;
  min-height: 100svh;
  min-height: 100dvh;
  padding:
    max(16px, env(safe-area-inset-top))
    16px
    max(16px, env(safe-area-inset-bottom));
  overflow-x: hidden;
  background: var(--wa-bg);
}

.wa-login::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -2;
  background-image: url('@/assets/images/login-background.jpg');
  background-size: cover;
  background-position: center center;
  background-repeat: no-repeat;
  background-color: #000;
}

.wa-login::after {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -1;
  background: linear-gradient(
    180deg,
    rgba(1, 8, 18, 0.72),
    rgba(1, 8, 18, 0.88)
  );
}

.wa-login__card {
  width: min(100%, 420px);
  margin: auto;
  position: relative;
  z-index: 1;
  padding: clamp(10px, 2.2vw, 14px);
  border-radius: 4px;
  border: 1px solid #6b7280;
  background: rgba(10, 13, 17, 0.80);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  animation: wa-fade-up 360ms ease both;
}

.wa-home-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border-radius: 0;
  border: 1px solid #6b7280;
  background: #000000;
  transition: transform 180ms ease, background 180ms ease, border-color 180ms ease;
}

.wa-home-btn:hover {
  transform: translateY(-1px);
  background: rgba(37, 99, 235, 0.25);
  border-color: rgba(96, 165, 250, 0.9);
}

.wa-home-btn:active {
  transform: scale(0.97);
}

.wa-brand {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  margin: 0 0 6px;
}

.wa-brand__logo {
  display: block;
  width: clamp(108px, 35vw, 148px);
  max-width: 100%;
  height: auto;
  object-fit: contain;
  margin: 0 auto;
}

.wa-welcome {
  text-align: center;
  margin-bottom: 6px;
}

.wa-welcome h1 {
  margin: 0;
  color: var(--wa-text);
  font-size: clamp(1.5rem, 5vw, 2rem);
  line-height: 1.08;
  font-weight: 800;
}

.wa-welcome p {
  margin: 4px 0 0;
  color: var(--wa-text-subtle);
  font-size: clamp(0.9rem, 2.8vw, 1rem);
}

.wa-form {
  display: grid;
  gap: 10px;
  width: 100%;
}

.wa-input {
  display: grid;
  grid-template-columns: 40px 1fr auto;
  align-items: center;
  min-height: 52px;
  border-radius: 0;
  border: 1px solid #6b7280;
  background: #000000;
  overflow: hidden;
  transition: border-color 180ms ease, box-shadow 180ms ease;
}

.wa-input:focus-within {
  border-color: rgba(96, 165, 250, 0.95);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.28);
}

.wa-input__icon {
  width: 40px;
  height: 100%;
  display: grid;
  place-items: center;
  color: #3b82f6;
  border-radius: 0;
  border-left: 1px solid #6b7280;
  font-size: 1rem;
}

.wa-input input {
  width: 100%;
  height: 100%;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--wa-text);
  font-size: 0.98rem;
  padding: 0 10px 0 9px;
  outline: none;
}

.wa-input input::placeholder {
  color: rgba(156, 163, 175, 0.8);
}

.wa-input__toggle {
  appearance: none;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--wa-text-subtle);
  height: 100%;
  width: 42px;
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: color 150ms ease, background 150ms ease;
}

.wa-input__toggle:hover {
  color: #cbd5e1;
  background: rgba(37, 99, 235, 0.12);
}

.wa-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.wa-row--between {
  justify-content: space-between;
  margin-top: 0;
  margin-bottom: 0;
}

.wa-remember {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--wa-text);
  font-size: 0.9rem;
  cursor: pointer;
}

.wa-remember input {
  width: 19px;
  height: 19px;
  border-radius: 2px;
  border: 1.5px solid #3b82f6;
  background: transparent;
  accent-color: var(--wa-primary);
}

.wa-link {
  color: #3b82f6;
  text-decoration: none;
  font-weight: 600;
  font-size: 0.88rem;
}

.wa-link:hover {
  color: #60a5fa;
}

.wa-error {
  border: 1px solid rgba(239, 68, 68, 0.55);
  border-radius: 0;
  background: rgba(127, 29, 29, 0.22);
  padding: 10px 12px;
  color: #fecaca;
}

.wa-error__title {
  font-weight: 700;
}

.wa-error__hint {
  margin-top: 2px;
  font-size: 0.82rem;
}

.wa-diagnostics-row {
  display: flex;
  justify-content: center;
}

.wa-secondary-btn {
  border: 1px solid rgba(252, 211, 77, 0.95);
  background: rgba(120, 53, 15, 0.2);
  color: #fcd34d;
  border-radius: 0;
  min-height: 40px;
  padding: 0 12px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: transform 150ms ease, background 150ms ease;
}

.wa-secondary-btn:hover {
  background: rgba(120, 53, 15, 0.3);
}

.wa-secondary-btn:active {
  transform: scale(0.98);
}

.wa-primary-btn {
  width: 100%;
  min-height: 54px;
  border-radius: 0;
  border: 0;
  margin-top: 0;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-size: clamp(1.18rem, 3.8vw, 1.28rem);
  font-weight: 800;
  color: var(--wa-text);
  background: linear-gradient(90deg, #1d4ed8 0%, #2563eb 42%, #1e40af 100%);
  box-shadow: 0 14px 36px rgba(37, 99, 235, 0.35);
  transition: transform 180ms ease, box-shadow 180ms ease, filter 180ms ease;
}

.wa-primary-btn i {
  font-size: 1.05rem;
}

.wa-primary-btn:hover:not(:disabled) {
  filter: brightness(1.05);
  transform: translateY(-1px);
}

.wa-primary-btn:active:not(:disabled) {
  transform: scale(0.99);
}

.wa-primary-btn:disabled {
  cursor: not-allowed;
  opacity: 0.7;
  filter: saturate(0.7);
}

.wa-divider {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 10px 0 6px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.73rem;
  color: var(--wa-text-subtle);
  justify-content: center;
}

.wa-divider::before,
.wa-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, rgba(156, 163, 175, 0.05) 0%, rgba(156, 163, 175, 0.45) 50%, rgba(156, 163, 175, 0.05) 100%);
}

.wa-demo-grid {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(118px, 1fr));
  gap: 8px;
}

.wa-demo-btn {
  min-height: 44px;
  border-radius: 0;
  border: 1px solid transparent;
  background: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  font-weight: 700;
  font-size: 0.88rem;
  padding: 0 10px;
  white-space: nowrap;
  transition: transform 160ms ease, background 160ms ease;
}

.wa-demo-btn:active {
  transform: scale(0.98);
}

.wa-demo-btn:disabled {
  opacity: 0.55;
}

.wa-demo-btn--user {
  border-color: rgba(59, 130, 246, 0.8);
  color: #60a5fa;
}

.wa-demo-btn--user:hover {
  background: rgba(30, 58, 138, 0.25);
}

.wa-demo-btn--trainer {
  border-color: rgba(34, 197, 94, 0.8);
  color: #4ade80;
}

.wa-demo-btn--trainer:hover {
  background: rgba(20, 83, 45, 0.28);
}

.wa-demo-btn--admin {
  border-color: rgba(239, 68, 68, 0.8);
  color: #fb923c;
}

.wa-demo-btn--admin:hover {
  background: rgba(124, 45, 18, 0.28);
}

.wa-social {
  width: 100%;
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}

.wa-social a {
  width: 48px;
  height: 48px;
  border-radius: 0;
  border: 1px solid var(--wa-border);
  background: rgba(15, 23, 42, 0.62);
  color: #60a5fa;
  display: grid;
  place-items: center;
  text-decoration: none;
  font-size: 1.2rem;
  transition: transform 180ms ease, border-color 180ms ease, background 180ms ease;
}

.wa-social a:hover {
  transform: translateY(-1px);
  background: rgba(37, 99, 235, 0.18);
  border-color: rgba(96, 165, 250, 0.72);
}

.wa-signup,
.wa-version {
  width: 100%;
  text-align: center;
  margin: 0;
  color: var(--wa-text-subtle);
}

.wa-signup {
  font-size: 0.86rem;
  margin-bottom: 2px;
}

.wa-signup a,
.wa-version a {
  color: #3b82f6;
  text-decoration: none;
  font-weight: 700;
}

.wa-signup a:hover,
.wa-version a:hover {
  color: #60a5fa;
}

.wa-version {
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.wa-form > *,
.wa-divider,
.wa-social,
.wa-signup,
.wa-version {
  animation: wa-fade-up 420ms ease both;
}

.wa-form > *:nth-child(1) { animation-delay: 70ms; }
.wa-form > *:nth-child(2) { animation-delay: 95ms; }
.wa-form > *:nth-child(3) { animation-delay: 120ms; }
.wa-form > *:nth-child(4) { animation-delay: 145ms; }

@keyframes wa-fade-up {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

:focus-visible {
  outline: 3px solid rgba(96, 165, 250, 0.95);
  outline-offset: 2px;
}

@media (min-width: 520px) {
  .wa-login {
    padding:
      max(16px, env(safe-area-inset-top))
      16px
      max(16px, env(safe-area-inset-bottom));
  }

  .wa-login__card {
    width: min(100%, 420px);
    padding: clamp(10px, 2.2vw, 14px);
  }

  .wa-demo-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 600px) {
  .wa-login {
    justify-content: flex-start;
    padding-left: 12px;
    padding-right: 12px;
  }

  .wa-login__card,
  .login-card {
    width: min(100%, 420px);
    max-width: 420px;
    padding: 8px 9px 10px;
    border-radius: 4px;
  }

  .wa-form,
  .login-form,
  .login-options-row,
  .demo-account-list,
  .social-login-list,
  .login-footer,
  .wa-divider,
  .login-divider,
  .wa-diagnostics-row {
    width: 100%;
  }

  .wa-brand {
    margin-bottom: 5px;
  }

  .wa-brand__logo {
    width: 48%;
    max-width: 110px;
    height: auto;
    margin: 0 auto;
    object-fit: contain;
  }

  .login-title {
    margin: 5px 0 2px;
    font-size: 22px;
    line-height: 1.15;
  }

  .login-subtitle {
    margin: 0 0 8px;
    font-size: 13px;
    line-height: 1.3;
  }

  .wa-form,
  .login-form {
    gap: 7px;
  }

  .wa-input,
  .login-input {
    min-height: 46px;
    border-radius: 0;
    grid-template-columns: 38px 1fr auto;
  }

  .wa-input .wa-input__icon,
  .login-input .wa-input__icon {
    width: 38px;
    min-width: 38px;
    font-size: 0.92rem;
  }

  .wa-input input,
  .login-input input {
    min-height: 46px;
    padding: 8px 10px 8px 8px;
    font-size: 14px;
  }

  .wa-input__toggle {
    width: 40px;
  }

  .wa-row--between,
  .login-options-row {
    margin: 6px 0;
    gap: 8px;
    font-size: 13px;
  }

  .wa-remember,
  .login-options-row .wa-remember,
  .forgot-password,
  .wa-link {
    font-size: 13px;
  }

  .wa-remember input {
    width: 17px;
    height: 17px;
  }

  .wa-primary-btn,
  .login-submit {
    min-height: 48px;
    margin-top: 4px;
    border-radius: 0;
    font-size: 18px;
  }

  .wa-divider,
  .login-divider {
    margin: 10px 0 6px;
  }

  .wa-divider span,
  .login-divider span {
    font-size: 11px;
    letter-spacing: 0.08em;
  }

  .wa-demo-grid,
  .demo-account-list {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }

  .wa-demo-btn,
  .demo-account-button {
    min-height: 42px;
    padding: 6px 4px;
    border-radius: 0;
    font-size: 11px;
    gap: 5px;
  }

  .wa-demo-btn i,
  .demo-account-button i {
    width: 15px;
    height: 15px;
    font-size: 0.85rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .wa-social,
  .social-login-list {
    gap: 8px;
    margin-bottom: 6px;
  }

  .wa-social a,
  .social-login-button {
    width: 40px;
    height: 40px;
    border-radius: 0;
    font-size: 1rem;
  }

  .wa-signup,
  .wa-version,
  .login-footer {
    margin-top: 8px;
    gap: 4px;
    font-size: 12px;
  }

  .wa-version {
    margin-top: 4px;
  }

  .wa-home-btn,
  .login-home-button {
    width: 34px;
    height: 34px;
    min-width: 34px;
    min-height: 34px;
    top: 8px;
    right: 8px;
    border-radius: 0;
    padding: 0;
  }

  .login-home-button i,
  .login-home-button svg {
    width: 17px;
    height: 17px;
    font-size: 17px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .wa-login::before {
    background-position: 58% center;
  }
}

@media (max-width: 480px) {
  .wa-login {
    padding-left: 10px;
    padding-right: 10px;
  }

  .wa-brand__logo {
    max-width: 130px;
  }

  .wa-login__card,
  .login-card {
    width: min(100%, 420px);
    max-width: 420px;
    padding: 8px 9px 10px;
  }
}

@media (max-width: 360px) {
  .wa-brand__logo {
    width: 135px;
    max-width: 48vw;
  }
}

@media (max-width: 340px) {
  .wa-demo-grid,
  .demo-account-list {
    grid-template-columns: 1fr;
  }
}

@media (min-width: 768px) {
  .wa-brand__logo {
    width: 175px;
  }
}

@media (min-width: 1024px) {
  .wa-login__card {
    width: min(100%, 420px);
    border-radius: 4px;
    padding: clamp(10px, 2.2vw, 14px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .wa-login__card,
  .wa-form > *,
  .wa-divider,
  .wa-social,
  .wa-signup,
  .wa-version,
  .wa-primary-btn,
  .wa-home-btn,
  .wa-social a,
  .wa-demo-btn,
  .wa-secondary-btn {
    animation: none !important;
    transition: none !important;
  }
}

.login-diagnostics-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 23, 0.76);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 16px;
}

.login-diagnostics-modal {
  width: min(92vw, 680px);
  max-height: 82vh;
  background: #111827;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 14px;
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
  background: rgba(148, 163, 184, 0.08);
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
  color: #e2e8f0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

.login-diag-loading {
  color: #93c5fd;
  font-size: 0.84rem;
  padding: 10px 0;
  text-align: center;
}

.login-diag-contact {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 12px 14px;
  color: #e2e8f0;
  font-size: 0.86rem;
  margin-bottom: 10px;
}

.login-diag-contact-icon {
  color: #60a5fa;
  font-size: 1rem;
  flex-shrink: 0;
}

.login-diag-section {
  margin-bottom: 14px;
}

.login-diag-section-title {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #60a5fa;
  margin-bottom: 6px;
  padding-bottom: 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.login-diag-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  padding: 3px 0;
  font-size: 0.81rem;
  color: #dbeafe;
}

.login-diag-row span {
  color: #93c5fd;
  flex-shrink: 0;
}

.login-diag-row code {
  background: rgba(255, 255, 255, 0.08);
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 0.78rem;
  color: #e2e8f0;
  word-break: break-all;
}

.login-diag-client-details {
  margin-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 8px;
}

.login-diag-client-details summary {
  font-size: 0.78rem;
  color: #60a5fa;
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
  color: #e2e8f0;
  margin: 0 0 6px;
}

.login-diag-conn-error {
  font-size: 0.82rem;
  color: #e2e8f0;
  margin: 0 0 8px;
}

.login-diag-conn-error code {
  background: rgba(255, 255, 255, 0.08);
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 0.8rem;
  color: #ffb3ab;
}

.login-diag-conn-suggestions {
  font-size: 0.82rem;
  font-weight: 600;
  color: #bfdbfe;
  margin: 0 0 4px;
}

.login-diag-conn-list {
  margin: 0;
  padding-left: 18px;
  font-size: 0.82rem;
  color: #e2e8f0;
  line-height: 1.7;
}
</style>
