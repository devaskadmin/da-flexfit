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

export function useAuth() {
  const router = useRouter();

  const fetchUser = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/session`, {
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
    if (logoutInProgress.value) return;

    logoutInProgress.value = true;

    try {
      // Clear frontend state FIRST (immediate)
      user.value = null;

      // Clear all auth-related storage keys
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

      // Try backend logout with timeout (non-blocking)
      // Backend endpoint is POST /api/logout (mounted via app.use('/api', auth.js))
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      try {
        await fetch(`${API_BASE}/api/logout`, {
          method: 'POST',
          credentials: 'include',
          signal: controller.signal,
        });
      } catch (err) {
        // Backend logout failed or timed out - that's OK, continue with local logout
        if (err.name !== 'AbortError') {
          console.error('[Logout] Backend logout error:', err.message);
        }
      } finally {
        clearTimeout(timeoutId);
      }

      // Redirect to login
      await router.replace({ name: 'login' });

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
