import { createRouter, createWebHistory } from 'vue-router';
import appRoutes from "@/router/routing";
import axios from "axios";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [...appRoutes],
});

// Ensure environment variable is read correctly
const DEBUG_NO_AUTH = import.meta.env.VITE_DEBUG_NO_AUTH === "true";

router.beforeEach(async (to, from, next) => {
  if (DEBUG_NO_AUTH) {
    console.warn("🚀 DEBUG MODE: Bypassing authentication");
    return next();
  }

  try {
    const response = await axios.get('http://localhost:5000/api/session', { withCredentials: true });

    const isLoggedIn = response.data.loggedIn;

    // Allow unauthenticated access only to login and register
    const publicPages = ['login', 'register', 'reset_password'];

    if (!isLoggedIn && !publicPages.includes(to.name)) {
      return next({ name: 'login' });
    }

    // Prevent logged-in users from visiting login/register
    if (isLoggedIn && publicPages.includes(to.name)) {
      return next({ name: 'dashboard_index' });
    }

    next(); // Allow navigation
  } catch (error) {
    console.error("Session check error:", error);
    next(); // Fail open rather than block routing
  }
});


export default router;
