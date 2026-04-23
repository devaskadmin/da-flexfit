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

  return {
    // State
    user,
    role,
    // Role booleans
    isTrainer,
    isAdministrator,
    // Sidebar helpers
    canViewTrainerMenu,
    canViewAdministratorMenu,
    // Actions
    fetchUser,
    requireAuth,
  };
}
