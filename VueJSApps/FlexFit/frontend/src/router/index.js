import { createRouter, createWebHistory } from 'vue-router';
import appRoutes from "@/router/routing";
import axios from "axios";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [...appRoutes],
});

// ✅ Load environment variables
const DEBUG_NO_AUTH = import.meta.env.VITE_DEBUG_NO_AUTH === "true";
const API_BASE = import.meta.env.VITE_API_BASE;

console.log("🔗 Router using backend:", API_BASE);
console.log("🛠️ DEBUG_NO_AUTH is", DEBUG_NO_AUTH);

// ✅ Route Guard (Check session unless in debug mode)
router.beforeEach(async (to, from, next) => {
  if (DEBUG_NO_AUTH) {
    console.warn("🚀 DEBUG MODE: Bypassing authentication");
    return next();
  }

  // ✅ Allow access to public pages without authentication
  const publicPages = [
    'login', 
    'registration', 
    'reset_password'];
    
  const authRequired = !publicPages.includes(to.name);

  try {
    const response = await axios.get(`${API_BASE}/api/session`, { withCredentials: true });

    if (!response.data.loggedIn && authRequired) {
      console.log("❌ Not logged in, redirecting to login");
      return next({ name: 'login' });
    }

    if (response.data.loggedIn && to.name === 'login') {
      console.log("✅ Already logged in, redirecting to dashboard");
      return next({ name: 'dashboard_index' });
    }

    next();
  } catch (error) {
    console.error("❌ Session check error:", error);
    next(); // Fallback: allow navigation
  }
});

export default router;
