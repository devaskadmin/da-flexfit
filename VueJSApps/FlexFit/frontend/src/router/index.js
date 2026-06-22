import { createRouter, createWebHistory } from 'vue-router';
import appRoutes from "@/router/routing";
import axios from "axios";
import { API_BASE } from '@/config/env';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [...appRoutes],
});

const DEBUG_NO_AUTH = import.meta.env.VITE_DEBUG_NO_AUTH === "true";
const IS_LOCALHOST = typeof window !== 'undefined' && ["localhost", "127.0.0.1"].includes(window.location.hostname);

const publicPages = ['login', 'register', 'reset_password', 'terms_policy'];
const errorPages = ['error_400', 'error_403', 'error_404', 'error_408', 'error_500', 'error_503', 'error_504'];
const alwaysAllowedPages = new Set([...publicPages, ...errorPages]);
const adminOnlyPages = new Set(['admin_users', 'admin_roles', 'admin_test_roles', 'admin_tools']);

const safeParseStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
};

const normalizeRoleSlug = (candidate) => {
  const value = String(candidate || '').trim().toLowerCase();
  if (value === 'administrator') return 'admin';
  return value;
};

router.beforeEach(async (to, from, next) => {
  if (DEBUG_NO_AUTH && IS_LOCALHOST) {
    console.warn("🚀 DEBUG MODE: Bypassing authentication");
    return next();
  }

  if (alwaysAllowedPages.has(to.name)) {
    return next();
  }

  try {
    const [sessionResult, dbStatusResult] = await Promise.allSettled([
      axios.get(`${API_BASE}/api/session`, { withCredentials: true }),
      axios.get(`${API_BASE}/api/db-status`, { withCredentials: true }),
    ]);

    const isLoggedIn = sessionResult.status === 'fulfilled' && sessionResult.value?.data?.loggedIn === true;
    const requiresPasswordReset = sessionResult.status === 'fulfilled' && sessionResult.value?.data?.requiresPasswordReset === true;
    const isDatabaseConnected = dbStatusResult.status === 'fulfilled' && dbStatusResult.value?.data?.connected === true;
    const sessionUser = sessionResult.status === 'fulfilled' ? sessionResult.value?.data?.user : null;
    const storedUser = safeParseStoredUser();

    const resolvedRoleSlug = normalizeRoleSlug(
      sessionUser?.roleSlug ||
      sessionUser?.role_slug ||
      sessionUser?.role ||
      sessionUser?.user_role ||
      localStorage.getItem('role') ||
      localStorage.getItem('userRole') ||
      storedUser?.role ||
      storedUser?.roleSlug ||
      storedUser?.role_slug ||
      storedUser?.user_role
    );

    // Enforce login-first UX for protected routes.
    if (!isLoggedIn) {
      // If backend/database cannot be validated and user is not logged in, fail closed.
      if (!isDatabaseConnected) {
        return next({ name: 'error_404' });
      }
      return next({ name: 'login' });
    }

    // Force reset-password flow for temporary-password sessions.
    if (requiresPasswordReset && to.name !== 'update_password') {
      return next({ name: 'update_password' });
    }

    // If reset is not required anymore, prevent navigating back to update screen.
    if (!requiresPasswordReset && to.name === 'update_password') {
      return next({ name: 'dashboard_index' });
    }

    if (adminOnlyPages.has(to.name) && resolvedRoleSlug !== 'admin') {
      return next({ name: 'error_403' });
    }

    next(); // Allow navigation for valid authenticated session
  } catch (error) {
    console.error("Session check error:", error);
    next({ name: 'error_404' });
  }
});


export default router;
