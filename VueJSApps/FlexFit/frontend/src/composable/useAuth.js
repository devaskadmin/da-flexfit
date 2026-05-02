// AUTHENTICATION
// Module-level refs act as shared singleton state — one fetch, many consumers.
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

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

export function useAuth() {
  const router = useRouter();

  const fetchUser = async () => {
    try {
      const res = await fetch(import.meta.env.VITE_API_BASE + '/api/session', {
        credentials: 'include',
      });
      const data = await res.json();
      user.value = data.loggedIn ? data.user : null;
    } catch (err) {
      console.error('Session check failed:', err);
      user.value = null;
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
    if (logoutInProgress.value) {
      console.log('[LOGOUT DEBUG] logout already in progress, skipping');
      return;
    }

    console.log('[LOGOUT DEBUG] logout clicked');
    logoutInProgress.value = true;

    try {
      console.log('[LOGOUT DEBUG] clearing local auth state');
      
      // Clear frontend state FIRST (immediate)
      user.value = null;
      
      // Clear all storage
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      sessionStorage.clear();

      // Try backend logout with timeout (non-blocking)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.warn('[LOGOUT DEBUG] backend logout timed out after 3s, continuing');
        controller.abort();
      }, 3000);

      try {
        const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: 'POST',
          credentials: 'include',
          signal: controller.signal,
        });
        console.log('[LOGOUT DEBUG] backend logout successful');
      } catch (err) {
        // Backend logout failed or timed out - that's OK, continue
        console.warn('[LOGOUT DEBUG] backend logout failed or timed out, continuing local logout', err.message);
      } finally {
        clearTimeout(timeoutId);
      }

      // Redirect to login (immediate)
      console.log('[LOGOUT DEBUG] redirecting to login');
      await router.replace({ name: 'login' });
      
    } finally {
      // Reset flag after a short delay to allow redirect
      setTimeout(() => {
        logoutInProgress.value = false;
      }, 500);
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
