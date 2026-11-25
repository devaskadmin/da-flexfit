// AUTHENTICATION
// Module-level refs act as shared singleton state — one fetch, many consumers.
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { API_BASE } from '@/config/env';

/** Raw session user object from /api/session */
const user = ref(null);

/** Normalize role value to one of: 'user' | 'trainer' | 'administrator' */
const normalizeRole = (candidate) => {
  const v = String(candidate || '').trim().toLowerCase();
  if (v === 'admin' || v === 'administrator') return 'administrator';
  if (v === 'trainer') return 'trainer';
  return 'user';
};

/** Derived canonical role for the authenticated user. */
const role = computed(() => {
  const u = user.value;
  if (!u) return 'user';
  return normalizeRole(u.role || u.roleSlug);
});

/** Convenience booleans for template/composable consumers */
const isTrainer = computed(() => role.value === 'trainer' || role.value === 'administrator');
const isAdministrator = computed(() => role.value === 'administrator');

/** Sidebar visibility helpers */
const canViewTrainerMenu = computed(() => isTrainer.value);
const canViewAdministratorMenu = computed(() => isAdministrator.value);

/** Logout in progress flag to prevent duplicate calls */
const logoutInProgress = ref(false);

/**
 * Session request sharing (a3 performance pass).
 * - Near-simultaneous callers share ONE /api/session request instead of each issuing their own
 *   (the backend does a role lookup plus a users SELECT per call).
 * - Nothing is cached: a request is only shared while it is still pending and was started
 *   less than SESSION_SHARE_WINDOW_MS ago. Every later call performs a fresh request.
 * - A response is applied to `user` only if no logout/auth reset happened since the request
 *   started (epoch) and no newer response was already applied (seq), so a late response can
 *   never restore authentication state after logout or overwrite newer state.
 */
const SESSION_SHARE_WINDOW_MS = 500;
let sessionEpoch = 0;
let sessionSeq = 0;
let lastAppliedSessionSeq = 0;
let pendingSession = null;

const invalidateSessionRequests = () => {
  sessionEpoch += 1;
  pendingSession = null;
};

const startOrShareSessionRequest = () => {
  const now = Date.now();
  if (
    pendingSession &&
    pendingSession.epoch === sessionEpoch &&
    now - pendingSession.startedAt < SESSION_SHARE_WINDOW_MS
  ) {
    return pendingSession;
  }

  const entry = { epoch: sessionEpoch, seq: ++sessionSeq, startedAt: now, promise: null };
  entry.promise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/session`, { credentials: 'include' });
      const data = await res.json();
      return { ok: res.ok, status: res.status, data };
    } finally {
      if (pendingSession === entry) pendingSession = null;
    }
  })();
  pendingSession = entry;
  return entry;
};

/**
 * Raw session response ({ ok, status, data }) from the shared /api/session request.
 * Rejects on network/parse failure. Used by the router guard, which makes its own decisions.
 */
export const fetchSessionSnapshot = () => startOrShareSessionRequest().promise;

export function useAuth() {
  const router = useRouter();

  const clearClientAuthState = () => {
    invalidateSessionRequests();
    user.value = null;

    localStorage.removeItem('token');
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    localStorage.removeItem('role');
    localStorage.removeItem('userRole');
    localStorage.removeItem('currentUser');

    sessionStorage.removeItem('token');
    sessionStorage.removeItem('authToken');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('role');
    sessionStorage.removeItem('userRole');
    sessionStorage.removeItem('currentUser');
  };

  const postLogout = async () => {
    const response = await fetch(`${API_BASE}/api/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
      cache: 'no-store',
    });

    return response.ok;
  };

  const verifyLoggedOut = async () => {
    const response = await fetch(`${API_BASE}/api/session`, {
      credentials: 'include',
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return true;
    }

    const data = await response.json().catch(() => ({}));
    return data?.loggedIn !== true;
  };

  const fetchUser = async () => {
    const entry = startOrShareSessionRequest();
    const canApply = () => entry.epoch === sessionEpoch && entry.seq > lastAppliedSessionSeq;

    try {
      const { data } = await entry.promise;
      if (canApply()) {
        lastAppliedSessionSeq = entry.seq;
        user.value = data.loggedIn ? data.user : null;
      }
    } catch (err) {
      console.error('Session check failed:', err);
      if (canApply()) {
        lastAppliedSessionSeq = entry.seq;
        user.value = null;
      }
    }
  };

  const requireAuth = async () => {
    await fetchUser();
    if (!user.value) {
      router.push({ name: 'login' });
    }
  };

  /**
   * Immediate, reliable logout function with timeout protection
   * Clears local state first, then attempts backend logout with timeout
   */
  const logout = async () => {
    // Prevent duplicate logout calls
    if (logoutInProgress.value) return false;

    logoutInProgress.value = true;
    invalidateSessionRequests();

    try {
      let loggedOut = await postLogout();

      if (loggedOut) {
        loggedOut = await verifyLoggedOut();
      }

      // Retry once to handle transient/cached state on some browsers.
      if (!loggedOut) {
        const retried = await postLogout();
        loggedOut = retried && await verifyLoggedOut();
      }

      if (!loggedOut) {
        console.error('[Logout] Session still appears authenticated after logout attempts.');
      }

      clearClientAuthState();

      // Redirect to login
      await router.replace({ name: 'login' });
      return loggedOut;

    } catch (err) {
      console.error('[Logout] Failed to complete logout:', err?.message || err);
      clearClientAuthState();
      await router.replace({ name: 'login' });
      return false;
    } finally {
      setTimeout(() => { logoutInProgress.value = false; }, 500);
    }
  };

  return {
    // State
    user,
    role,
    logoutInProgress,
    // Role booleans
    isTrainer,
    isAdministrator,
    // Sidebar helpers
    canViewTrainerMenu,
    canViewAdministratorMenu,
    // Actions
    fetchUser,
    requireAuth,
    logout,
  };
}
