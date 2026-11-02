<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";
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
const loginDiagnosticContext = ref(null);
const appVersion = import.meta.env.VITE_APP_VERSION || '0.69.0';
const isDev = import.meta.env.DEV;
const localHostnames = new Set(['localhost', '127.0.0.1']);
const isLocalhostFrontend = localHostnames.has(String(window.location.hostname || '').toLowerCase());
const canShowDevDiagnostics = isDev && isLocalhostFrontend;
const GENERIC_AUTH_ERROR_MESSAGE = 'Incorrect email or password. Please try again.';
const googleClientId = ref('');
const googleButtonHost = ref(null);
const isGoogleAvailable = ref(false);
const isGoogleLoading = ref(false);
const googleTestUnlinkEnabled = ref(false);
const isUnlinkingGoogleTestUser = ref(false);
const googleTestUnlinkMessage = ref('');
const showGoogleLinkModal = ref(false);
const googleLinkEmail = ref('');
const pendingGoogleCredential = ref('');
const googleLinkPassword = ref('');
const isGoogleLinkPasswordVisible = ref(false);
const isLinkingGoogleAccount = ref(false);
const googleLinkError = ref('');

let googleScriptPromise;

const loadGoogleIdentityScript = () => {
  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }

  if (googleScriptPromise) {
    return googleScriptPromise;
  }

  googleScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[data-wa-google-gsi="true"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Failed to load Google Identity Services script.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.waGoogleGsi = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services script.'));
    document.head.appendChild(script);
  });

  return googleScriptPromise;
};

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
  const fallbackText = String(fallbackMessage || '').toLowerCase();
  const looksLikeCredentialFailure =
    fallbackText.includes('invalid credentials') ||
    fallbackText.includes('invalid username') ||
    fallbackText.includes('invalid password') ||
    fallbackText.includes('incorrect password') ||
    fallbackText.includes('user not found') ||
    fallbackText.includes('no user') ||
    fallbackText.includes('authentication failed');

  if (!status && String(fallbackMessage || '').toLowerCase().includes('could not reach the local api server')) {
    return fallbackMessage;
  }

  if (looksLikeCredentialFailure) {
    return GENERIC_AUTH_ERROR_MESSAGE;
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
    const looksSensitive =
      lowerFallback.includes('stack') ||
      lowerFallback.includes('sqlstate') ||
      lowerFallback.includes('select ') ||
      lowerFallback.includes('insert ') ||
      lowerFallback.includes('authorization:') ||
      lowerFallback.includes('set-cookie:');
    if (looksSensitive) {
      return 'Sign-in failed: server error. Please try again.';
    }
    if (lowerFallback.includes('login succeeded') || lowerFallback.includes('session cookie')) {
      return fallbackMessage;
    }
  }

  if (status === 404) {
    return 'Sign-in failed: endpoint not found (404).';
  }

  if (status === 401 || status === 403) {
    return GENERIC_AUTH_ERROR_MESSAGE;
  }

  if (status && status >= 500) {
    return `Sign-in failed: server error (${status}).`;
  }

  if (!status) {
    return fallbackMessage || 'Sign-in failed: network/session issue detected.';
  }

  return fallbackMessage || `Sign-in failed (${status}).`;
};

const sanitizeDiagnosticText = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return 'n/a';

  const redacted = raw
    .replace(/(password|passwd|pwd)\s*[=:]\s*[^\s,;]+/gi, '$1=[redacted]')
    .replace(/(token|access_token|refresh_token|id_token)\s*[=:]\s*[^\s,;]+/gi, '$1=[redacted]')
    .replace(/(authorization)\s*[:=]\s*[^\n]+/gi, '$1: [redacted]')
    .replace(/(cookie|set-cookie)\s*[:=]\s*[^\n]+/gi, '$1: [redacted]')
    .replace(/(secret|api[_-]?key|private[_-]?key)\s*[=:]\s*[^\s,;]+/gi, '$1=[redacted]');

  const firstLine = redacted.split(/\r?\n/)[0]?.trim() || 'n/a';
  return firstLine.slice(0, 500);
};

const buildNetworkTroubleshooting = ({ hasNoResponse, networkMessage = '', status } = {}) => {
  if (!hasNoResponse && status) {
    return '';
  }

  const lowerNetwork = String(networkMessage || '').toLowerCase();
  if (lowerNetwork.includes('cors')) {
    return 'CORS/network issue detected. Verify backend CORS origin includes this frontend origin and that the API server is reachable.';
  }

  return 'Network/API connectivity issue detected. Verify backend is running, API URL is correct, and browser devtools show no CORS blocks.';
};

const updateDiagnosticContext = ({
  status,
  code,
  apiEndpoint = '/api/login',
  apiMessage,
  networkMessage,
  requestId,
  hasNoResponse = false,
  troubleshooting = '',
} = {}) => {
  loginDiagnosticContext.value = {
    statusCode: status ?? 'none',
    errorCode: sanitizeDiagnosticText(code || 'n/a'),
    endpoint: apiEndpoint,
    timestamp: new Date().toISOString(),
    environment: canShowDevDiagnostics ? 'localhost development (Vite DEV)' : 'production-safe mode',
    backendInfo: sanitizeDiagnosticText(apiMessage),
    networkInfo: sanitizeDiagnosticText(networkMessage),
    requestId: sanitizeDiagnosticText(requestId || 'n/a'),
    hasNoResponse: Boolean(hasNoResponse),
    troubleshooting: sanitizeDiagnosticText(troubleshooting),
  };
};

const serverDiagnostics = ref(null);
const diagnosticsLoading = ref(false);

const fetchServerDiagnostics = async () => {
  if (!canShowDevDiagnostics) {
    serverDiagnostics.value = null;
    diagnosticsLoading.value = false;
    return;
  }

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
  if (!canShowDevDiagnostics) return;
  showDiagnosticsModal.value = true;
  fetchServerDiagnostics();
};

const closeDiagnosticsModal = () => {
  showDiagnosticsModal.value = false;
  serverDiagnostics.value = null;
};

const handleModalEscape = (event) => {
  if (event.key === 'Escape' && showDiagnosticsModal.value) {
    closeDiagnosticsModal();
  }
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
  requestId = '',
  endpoint = '/api/login',
  hasNoResponse = false,
  troubleshooting = '',
}) => {
  isDbAuthError.value = code === 'ER_ACCESS_DENIED_ERROR';
  const isSafari = isSafariBrowser();
  const compactMessage = buildCompactLoginMessage({ status, fallbackMessage, code });
  const detailedMessage = safariDetailed && isSafari
    ? buildSafariLoginFailureMessage({ reason, status, apiMessage, networkMessage })
    : (fallbackMessage || 'No additional details.');

  errorMsg.value = compactMessage;
  updateDiagnosticContext({
    status,
    code,
    apiEndpoint: endpoint,
    apiMessage,
    networkMessage,
    requestId,
    hasNoResponse,
    troubleshooting,
  });
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

const completeSuccessfulAuthFlow = async (responseData, fallbackMessage = 'Sign-in failed. Try again.') => {
  if (responseData?.requiresPasswordReset === true) {
    devLog('Auth requires password reset');
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
      return false;
    }
    await router.replace({ name: 'update_password' });
    return true;
  }

  if (!responseData?.user) {
    setLoginError({
      fallbackMessage,
      reason: 'The server rejected this sign-in request.',
      apiMessage: fallbackMessage,
      safariDetailed: true,
    });
    return false;
  }

  const sessionState = await waitForSessionReady();
  if (!sessionState?.passed) {
    const d = sessionState?.diagnostics || {};
    setLoginError({
      fallbackMessage: 'Session persistence issue',
      reason: 'Session persistence issue after successful authentication.',
      status: sessionState?.status,
      apiMessage: sessionState?.note || responseData?.message || 'Authentication succeeded, but session verification failed.',
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
    return false;
  }

  await fetchUser();
  await goToDashboard();
  return true;
};

const resetGoogleLinkState = () => {
  showGoogleLinkModal.value = false;
  googleLinkEmail.value = '';
  pendingGoogleCredential.value = '';
  googleLinkPassword.value = '';
  isGoogleLinkPasswordVisible.value = false;
  isLinkingGoogleAccount.value = false;
  googleLinkError.value = '';
};

const cancelGoogleLink = () => {
  resetGoogleLinkState();
};

const submitGoogleLinkConfirmation = async () => {
  if (isLinkingGoogleAccount.value) {
    return;
  }

  const safeCredential = String(pendingGoogleCredential.value || '').trim();
  const safePassword = String(googleLinkPassword.value || '');

  if (!safeCredential || !safePassword) {
    googleLinkError.value = 'Enter your WorkoutAtlas password to connect this Google account.';
    return;
  }

  isLinkingGoogleAccount.value = true;
  googleLinkError.value = '';

  try {
    const response = await apiClient.post('/api/auth/google', {
      credential: safeCredential,
      confirmLink: true,
      linkPassword: safePassword,
    });

    resetGoogleLinkState();
    await completeSuccessfulAuthFlow(response?.data, 'Google sign-in failed after linking. Try again.');
  } catch (confirmErr) {
    const confirmData = confirmErr?.response?.data;
    const code = String(confirmData?.code || '').trim();

    if (code === 'GOOGLE_LINK_PASSWORD_UNAVAILABLE') {
      googleLinkError.value = 'This account has no local WorkoutAtlas password to verify. Sign in with your existing linked method or contact support.';
      return;
    }

    if (confirmErr?.response?.status === 401 || confirmErr?.response?.status === 403) {
      googleLinkError.value = 'Incorrect WorkoutAtlas password.';
      return;
    }

    const confirmMessage =
      (typeof confirmData === 'object' && confirmData !== null
        ? (confirmData.message || confirmData.error || null)
        : null) ||
      'Google linking failed. Please try again.';

    googleLinkError.value = confirmMessage;
  } finally {
    isLinkingGoogleAccount.value = false;
  }
};

const handleGoogleSignInCredential = async (credential) => {
  const safeCredential = String(credential || '').trim();
  if (!safeCredential || isSubmitting.value || isGoogleLoading.value) {
    return;
  }

  isGoogleLoading.value = true;
  errorMsg.value = "";
  loginDiagnostics.value = "";
  loginDiagnosticContext.value = null;
  diagnosticsCopied.value = false;
  showDiagnosticsModal.value = false;
  isConnectionLimitError.value = false;
  isDbAuthError.value = false;

  try {
    const response = await apiClient.post('/api/auth/google', { credential: safeCredential });
    await completeSuccessfulAuthFlow(response?.data, 'Google sign-in failed. Try again.');
  } catch (error) {
    const rawData = error?.response?.data;
    const requiresLinkConfirmation = Boolean(rawData?.linkRequired) || String(rawData?.code || '').trim() === 'GOOGLE_LINK_CONFIRM_REQUIRED';

    if (requiresLinkConfirmation) {
      pendingGoogleCredential.value = safeCredential;
      googleLinkEmail.value = String(rawData?.email || username.value || '').trim();
      googleLinkPassword.value = '';
      googleLinkError.value = '';
      isGoogleLinkPasswordVisible.value = false;
      showGoogleLinkModal.value = true;
      return;
    }

    const apiMessage =
      (typeof rawData === 'object' && rawData !== null
        ? (rawData.message || rawData.error || null)
        : null) ||
      'Google sign-in failed. Please try again.';

    setLoginError({
      fallbackMessage: apiMessage,
      reason: 'Google sign-in request was rejected.',
      status: error?.response?.status,
      apiMessage,
      networkMessage: error?.message,
      loginSucceeded: false,
      sessionCookiePersisted: null,
      sessionVerificationPassed: false,
      safariDetailed: true,
      endpoint: '/api/auth/google',
    });
  } finally {
    isGoogleLoading.value = false;
  }
};

const unlinkGoogleTestUser = async () => {
  if (!isDev || !googleTestUnlinkEnabled.value || isUnlinkingGoogleTestUser.value) {
    return;
  }

  const shouldProceed = window.confirm('Unlink Google from the configured local test user account?');
  if (!shouldProceed) {
    return;
  }

  isUnlinkingGoogleTestUser.value = true;
  googleTestUnlinkMessage.value = '';

  try {
    const response = await apiClient.post('/api/auth/google/test-unlink');
    const message = String(response?.data?.message || '').trim() || 'Google test user unlinked successfully.';
    googleTestUnlinkMessage.value = message;
    await fetchUser();
  } catch (error) {
    const apiMessage = String(error?.response?.data?.error || '').trim();
    googleTestUnlinkMessage.value = apiMessage || 'Google test user unlink failed.';
  } finally {
    isUnlinkingGoogleTestUser.value = false;
  }
};

const loadGoogleClientId = async () => {
  try {
    const response = await apiClient.get('/api/config/google');
    const configuredClientId = String(response?.data?.clientId || '').trim();
    googleTestUnlinkEnabled.value = Boolean(response?.data?.googleTestUnlinkEnabled);
    googleClientId.value = configuredClientId;
    return configuredClientId;
  } catch (err) {
    googleTestUnlinkEnabled.value = Boolean(err?.response?.data?.googleTestUnlinkEnabled);
    googleClientId.value = '';
    return '';
  }
};

const renderGoogleButton = async () => {
  const configuredClientId = googleClientId.value || await loadGoogleClientId();

  if (!configuredClientId) {
    isGoogleAvailable.value = false;
    return;
  }

  try {
    await loadGoogleIdentityScript();
    await nextTick();

    const googleApi = window.google?.accounts?.id;
    if (!googleApi || !googleButtonHost.value) {
      isGoogleAvailable.value = false;
      return;
    }

    googleApi.initialize({
      client_id: configuredClientId,
      callback: (response) => {
        const credential = response?.credential;
        handleGoogleSignInCredential(credential);
      },
      auto_select: false,
      cancel_on_tap_outside: true,
    });

    googleButtonHost.value.innerHTML = '';
    googleApi.renderButton(googleButtonHost.value, {
      theme: 'outline',
      size: 'large',
      type: 'standard',
      text: 'signin_with',
      shape: 'rectangular',
      width: 320,
    });

    isGoogleAvailable.value = true;
  } catch (_err) {
    isGoogleAvailable.value = false;
  }
};

onMounted(async () => {
  window.addEventListener('keydown', handleModalEscape);
  await loadGoogleClientId();
  await renderGoogleButton();
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleModalEscape);
});

// Login Function
const login = async () => {
  if (isSubmitting.value) return;

  isSubmitting.value = true;
  errorMsg.value = "";
  loginDiagnostics.value = "";
  loginDiagnosticContext.value = null;
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

    if (response?.data?.requiresPasswordReset === true || response?.data?.user) {
      await completeSuccessfulAuthFlow(response?.data, 'Login failed. Try again.');
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
    const requestId =
      error?.response?.headers?.['x-request-id'] ||
      error?.response?.headers?.['x-correlation-id'] ||
      rawData?.requestId ||
      rawData?.request_id ||
      '';
    const troubleshooting = buildNetworkTroubleshooting({
      hasNoResponse,
      networkMessage: error?.message,
      status: error?.response?.status,
    });
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
      requestId,
      endpoint: '/api/login',
      hasNoResponse,
      troubleshooting,
    });
    if ((isConnLimit || isDbAuth) && canShowDevDiagnostics) {
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

        <div class="wa-password-group login-password-group">
          <label class="wa-input login-input wa-input--password" for="wa-password-input">
            <span class="wa-input__icon" aria-hidden="true">
              <i class="fa-solid fa-lock"></i>
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
        </div>

        <div class="wa-row wa-row--between login-options-row">
          <label class="wa-remember" for="loginCheckbox">
            <input v-model="rememberMe" id="loginCheckbox" type="checkbox">
            <span>Remember Me</span>
          </label>
          <router-link :to="{ name: 'reset_password' }" class="wa-link forgot-password">Forgot Password?</router-link>
        </div>

        <div v-if="errorMsg" class="wa-error" role="alert" aria-live="assertive">
          <div class="wa-error__title">
            <span class="wa-error__icon" aria-hidden="true">
              <i class="fa-solid fa-triangle-exclamation"></i>
            </span>
            <span class="wa-error__text">{{ errorMsg }}</span>
          </div>
        </div>

        <div v-if="errorMsg && canShowDevDiagnostics" class="wa-diagnostics-row">
          <button
            type="button"
            class="wa-diagnostics-link"
            @click="openDiagnosticsModal"
          >
            <i class="fa-solid fa-screwdriver-wrench" aria-hidden="true"></i>
            <span>Developer diagnostics</span>
          </button>
        </div>

        <button class="wa-primary-btn login-submit" :disabled="isSubmitting" aria-label="Sign in">
          <span>{{ isSubmitting ? 'Signing In...' : 'Sign In' }}</span>
          <i class="fa-solid fa-right-to-bracket" aria-hidden="true"></i>
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

      <div class="wa-divider login-divider"><span>Or</span></div>
      <p class="wa-google-test-label">TEST Sign in with Google</p>
      <div class="wa-social social-login-list" aria-label="Google sign in option">
        <div
          ref="googleButtonHost"
          class="wa-google-button-host"
          v-show="isGoogleAvailable"
          aria-label="TEST Sign in with Google"
        ></div>
        <button
          v-show="!isGoogleAvailable"
          type="button"
          class="wa-google-unavailable"
          disabled
          aria-label="Google sign in unavailable"
        >
          TEST Sign in with Google (Configuration Pending)
        </button>
      </div>
      <div
        v-if="isDev && googleTestUnlinkEnabled"
        class="wa-google-test-controls"
      >
        <button
          type="button"
          class="wa-secondary-btn wa-google-test-unlink-btn"
          :disabled="isUnlinkingGoogleTestUser"
          @click="unlinkGoogleTestUser"
        >
          {{ isUnlinkingGoogleTestUser ? 'Unlinking Google Test User...' : 'Unlink Google Test User' }}
        </button>
        <p v-if="googleTestUnlinkMessage" class="wa-google-test-message">{{ googleTestUnlinkMessage }}</p>
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
        v-if="showGoogleLinkModal"
        class="login-google-link-backdrop"
        @click.self="cancelGoogleLink"
      >
        <div class="login-google-link-modal" role="dialog" aria-modal="true" aria-label="Existing WorkoutAtlas account found">
          <div class="login-google-link-header">
            <h5 class="mb-0">Existing WorkoutAtlas Account Found</h5>
            <button type="button" class="btn-close btn-close-white" aria-label="Close" @click="cancelGoogleLink"></button>
          </div>

          <div class="login-google-link-body">
            <p class="google-link-message">We found an existing WorkoutAtlas account using:</p>
            <p class="google-link-email">{{ googleLinkEmail || 'unknown account' }}</p>
            <p class="google-link-message">To connect your Google account, confirm your existing WorkoutAtlas password.</p>

            <label class="wa-input login-input wa-input--password" for="wa-google-link-password-input">
              <span class="wa-input__icon" aria-hidden="true">
                <i class="fa-solid fa-lock"></i>
              </span>
              <input
                id="wa-google-link-password-input"
                v-model="googleLinkPassword"
                :type="isGoogleLinkPasswordVisible ? 'text' : 'password'"
                placeholder="WorkoutAtlas Password"
                autocomplete="current-password"
                autocapitalize="none"
                spellcheck="false"
                :disabled="isLinkingGoogleAccount"
                @keyup.enter="submitGoogleLinkConfirmation"
              >
              <button
                type="button"
                class="wa-input__toggle"
                @click="isGoogleLinkPasswordVisible = !isGoogleLinkPasswordVisible"
                :aria-label="isGoogleLinkPasswordVisible ? 'Hide password' : 'Show password'"
                :aria-pressed="isGoogleLinkPasswordVisible ? 'true' : 'false'"
                :disabled="isLinkingGoogleAccount"
              >
                <i class="fa-duotone" :class="[isGoogleLinkPasswordVisible ? 'fa-eye-slash' : 'fa-eye']"></i>
              </button>
            </label>

            <div v-if="googleLinkError" class="google-link-error" role="alert">{{ googleLinkError }}</div>
          </div>

          <div class="login-google-link-footer">
            <button type="button" class="btn btn-outline-light btn-sm" :disabled="isLinkingGoogleAccount" @click="cancelGoogleLink">
              Cancel
            </button>
            <button type="button" class="btn btn-primary btn-sm" :disabled="isLinkingGoogleAccount || !googleLinkPassword" @click="submitGoogleLinkConfirmation">
              {{ isLinkingGoogleAccount ? 'Connecting...' : 'Connect Google Account' }}
            </button>
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
                <div class="login-diag-section" v-if="loginDiagnosticContext">
                  <div class="login-diag-section-title">Request Details</div>
                  <div class="login-diag-row"><span>HTTP Status</span><code>{{ loginDiagnosticContext.statusCode }}</code></div>
                  <div class="login-diag-row"><span>Error Type/Code</span><code>{{ loginDiagnosticContext.errorCode }}</code></div>
                  <div class="login-diag-row"><span>API Endpoint</span><code>{{ loginDiagnosticContext.endpoint }}</code></div>
                  <div class="login-diag-row"><span>Request Timestamp</span><code>{{ loginDiagnosticContext.timestamp }}</code></div>
                  <div class="login-diag-row"><span>Environment</span><code>{{ loginDiagnosticContext.environment }}</code></div>
                  <div class="login-diag-row"><span>Request ID</span><code>{{ loginDiagnosticContext.requestId }}</code></div>
                  <div class="login-diag-row"><span>Backend Error</span><code>{{ loginDiagnosticContext.backendInfo }}</code></div>
                  <div class="login-diag-row"><span>Network Error</span><code>{{ loginDiagnosticContext.networkInfo }}</code></div>
                </div>

                <div class="login-diag-section" v-if="loginDiagnosticContext?.troubleshooting && loginDiagnosticContext?.hasNoResponse">
                  <div class="login-diag-section-title">Network/CORS Troubleshooting</div>
                  <p class="login-diag-help">{{ loginDiagnosticContext.troubleshooting }}</p>
                </div>

                <div class="login-diag-section">
                  <div class="login-diag-section-title">Environment Snapshot</div>
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

.wa-brand,
.wa-welcome,
.wa-demo-grid,
.wa-social,
.wa-signup,
.wa-version {
  margin-left: auto;
  margin-right: auto;
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

.wa-form > .wa-input,
.wa-form > .wa-password-group,
.wa-form > .login-options-row,
.wa-form > .login-submit {
  width: 100%;
}

.wa-input {
  width: 100%;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: 40px 1fr auto;
  align-items: center;
  min-height: 52px;
  border-radius: 12px;
  border: 1px solid rgba(145, 160, 200, 0.32);
  background: #252E48;
  overflow: hidden;
  transition: border-color 180ms ease, box-shadow 180ms ease;
}

.wa-password-group {
  width: 100%;
  display: grid;
  gap: 6px;
}

.wa-input--password {
  grid-template-columns: 40px 1fr 42px;
}

.wa-input:focus-within {
  border-color: #2F6BFF;
  box-shadow: 0 0 0 3px rgba(47, 107, 255, 0.22);
}

.wa-input__icon {
  width: 40px;
  height: 100%;
  display: grid;
  place-items: center;
  color: #8F9BB5;
  background: transparent;
  border-right: 1px solid rgba(145, 160, 200, 0.18);
  font-size: 1rem;
}

.wa-input input {
  appearance: none;
  -webkit-appearance: none;
  width: 100%;
  min-width: 0;
  height: 100%;
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  color: #F7F9FF;
  font-size: 0.98rem;
  padding: 0 12px;
  outline: none !important;
  -webkit-appearance: none;
  background-clip: padding-box;
}

.wa-input input:focus,
.wa-input input:focus-visible,
.wa-input input:active {
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  outline: none !important;
}

.wa-input input::placeholder {
  color: #8F9BB5;
  opacity: 1;
}

.wa-input__toggle {
  appearance: none;
  -webkit-appearance: none;
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  color: #8F9BB5;
  height: 100%;
  width: 42px;
  min-width: 42px;
  display: grid;
  place-items: center;
  cursor: pointer;
  border-left: 1px solid rgba(145, 160, 200, 0.18) !important;
  box-shadow: none !important;
  outline: none !important;
  transition: color 150ms ease;
  align-self: stretch;
}

.wa-input__toggle:hover {
  color: #F7F9FF;
}

.wa-input__toggle:focus,
.wa-input__toggle:focus-visible,
.wa-input__toggle:active {
  border: 0 !important;
  border-left: 1px solid rgba(145, 160, 200, 0.18) !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  outline: none !important;
}

.wa-input__toggle--row:focus,
.wa-input__toggle--row:focus-visible,
.wa-input__toggle--row:active {
  border: 1px solid rgba(145, 160, 200, 0.3) !important;
  background: rgba(37, 46, 72, 0.55) !important;
}

.wa-input__toggle:focus-visible {
  outline: 2px solid rgba(96, 165, 250, 0.95);
  outline-offset: -2px;
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

.login-options-row {
  width: 100%;
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
  border: 1px solid #7f1d1d;
  border-radius: 8px;
  background: #991b1b;
  padding: 7px 10px;
  color: #ffffff;
}

.wa-error__title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  line-height: 1.35;
}

.wa-error__icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #111827;
  border: 1px solid #000000;
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}

.wa-error__icon i {
  font-size: 0.68rem;
  line-height: 1;
}

.wa-error__text {
  color: #ffffff;
  font-size: 0.86rem;
  font-weight: 500;
  word-break: break-word;
}

.wa-error__hint {
  margin-top: 2px;
  font-size: 0.82rem;
}

.wa-diagnostics-row {
  display: flex;
  justify-content: flex-start;
  margin-top: -2px;
}

.wa-diagnostics-link {
  appearance: none;
  border: 0;
  background: transparent;
  color: #94a3b8;
  font-size: 0.77rem;
  font-weight: 600;
  line-height: 1.2;
  padding: 0;
  min-height: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  text-decoration: underline;
  text-decoration-color: rgba(148, 163, 184, 0.42);
  text-underline-offset: 2px;
  transition: color 150ms ease, text-decoration-color 150ms ease;
}

.wa-diagnostics-link i {
  font-size: 0.76rem;
  color: #8fa1ba;
}

.wa-diagnostics-link:hover {
  color: #bfdbfe;
  text-decoration-color: rgba(191, 219, 254, 0.62);
}

.wa-diagnostics-link:focus-visible {
  outline: 2px solid rgba(96, 165, 250, 0.72);
  outline-offset: 2px;
  border-radius: 4px;
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
  justify-items: center;
}

.wa-demo-btn {
  min-height: 44px;
  width: 100%;
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

.wa-google-test-label {
  width: 100%;
  margin: 0 0 4px;
  text-align: center;
  color: #93c5fd;
  font-size: 0.84rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.wa-google-button-host {
  width: 100%;
  display: flex;
  justify-content: center;
}

.wa-google-test-controls {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
}

.wa-google-test-unlink-btn {
  width: min(100%, 320px);
}

.wa-google-test-message {
  width: min(100%, 320px);
  margin: 0;
  text-align: center;
  color: #bfdbfe;
  font-size: 0.8rem;
}

.wa-google-unavailable {
  width: min(100%, 320px);
  min-height: 42px;
  border: 1px solid var(--wa-border);
  background: rgba(15, 23, 42, 0.62);
  color: var(--wa-text-subtle);
  font-size: 0.88rem;
  font-weight: 600;
  border-radius: 0;
  cursor: not-allowed;
  opacity: 0.9;
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
    border-radius: 12px;
    grid-template-columns: 38px 1fr auto;
  }

  .wa-input--password {
    grid-template-columns: 38px 1fr 40px;
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

  .wa-google-unavailable {
    width: 100%;
    max-width: 320px;
    min-height: 40px;
    font-size: 0.82rem;
  }

  .wa-google-test-label {
    font-size: 0.8rem;
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
    background-position: center center;
  }

  .wa-login::after {
    background: linear-gradient(
      180deg,
      rgba(1, 8, 18, 0.62),
      rgba(1, 8, 18, 0.78)
    );
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
  .wa-google-unavailable,
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

.login-google-link-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 23, 0.76);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2100;
  padding: 16px;
}

.login-google-link-modal {
  width: min(92vw, 560px);
  max-height: 84vh;
  background: #111827;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.login-google-link-header,
.login-google-link-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  background: rgba(148, 163, 184, 0.08);
}

.login-google-link-body {
  padding: 14px;
  display: grid;
  gap: 10px;
}

.google-link-message {
  margin: 0;
  color: #dbeafe;
  font-size: 0.9rem;
}

.google-link-email {
  margin: 0;
  color: #60a5fa;
  font-size: 0.96rem;
  font-weight: 700;
  word-break: break-word;
}

.google-link-error {
  border: 1px solid rgba(239, 68, 68, 0.5);
  border-radius: 8px;
  background: rgba(127, 29, 29, 0.22);
  color: #fecaca;
  padding: 9px 10px;
  font-size: 0.82rem;
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

.login-diag-help {
  margin: 0;
  font-size: 0.83rem;
  line-height: 1.45;
  color: #dbeafe;
  background: rgba(37, 99, 235, 0.12);
  border: 1px solid rgba(96, 165, 250, 0.35);
  border-radius: 8px;
  padding: 10px;
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
