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
    return next(); // Allow navigation without authentication
  }

  try {
    const response = await axios.get('http://localhost:5000/session', { withCredentials: true });

    if (!response.data.loggedIn) {
      // ✅ Fix: ONLY redirect to login if not already there
      if (to.name !== 'login') {
        console.log("not logged in");
        return next({ name: 'login' });
      }
    } else {
      // ✅ Fix: Prevent re-directing logged-in users to login
      if (to.name === 'login') {
        return next({ name: 'dashboard_index' }); // Change to the actual dashboard route
      }
    }

    next(); // Allow navigation if everything is fine
  } catch (error) {
    console.error("Session check error:", error);
    next(); // Allow the user to proceed without breaking
  }
});

export default router;
