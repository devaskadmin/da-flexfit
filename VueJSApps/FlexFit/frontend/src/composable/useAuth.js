// AUTHENTICATION
// Module-level refs act as shared singleton state — one fetch, many consumers.
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

/** Raw session user object from /api/session */
const user = ref(null);

/**
 * Normalize any role value coming from the API into one of three canonical slugs:
 *   'admin' | 'trainer' | 'user'
 *
 * API may return:
 *   roleSlug: 'admin' | 'trainer' | 'member' | 'user'
 *   role:     'Admin' | 'Trainer' | 'User'
 *   membershipType: 'Admin' | 'Trainer' | 'User'
 */
const normalizeRoleSlug = (candidate) => {
  const v = String(candidate || '').trim().toLowerCase();
  if (v === 'admin' || v === 'administrator') return 'admin';
  if (v === 'trainer') return 'trainer';
  return 'user'; // covers 'member', 'user', ''
};

/**
 * Derived role slug — always one of 'admin' | 'trainer' | 'user'.
 * Reads from the most-specific field first (roleSlug > role > membershipType).
 */
const roleSlug = computed(() => {
  const u = user.value;
  if (!u) return 'user';
  return normalizeRoleSlug(u.roleSlug || u.role || u.membershipType);
});

/** Convenience booleans for template/composable consumers */
const isAdmin   = computed(() => roleSlug.value === 'admin');
const isTrainer = computed(() => roleSlug.value === 'trainer');
const isUser    = computed(() => roleSlug.value === 'user');

/** Sidebar visibility helpers */
const canViewTrainerMenu       = computed(() => isAdmin.value || isTrainer.value);
const canViewAdministratorMenu = computed(() => isAdmin.value);

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
    roleSlug,
    // Role booleans
    isAdmin,
    isTrainer,
    isUser,
    // Sidebar helpers
    canViewTrainerMenu,
    canViewAdministratorMenu,
    // Actions
    fetchUser,
    requireAuth,
  };
}
