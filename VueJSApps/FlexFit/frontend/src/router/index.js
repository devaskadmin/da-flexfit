//Vue Routing Library
import { createRouter, createWebHistory } from 'vue-router';

//Imports and manages routes
import appRoutes from "@/router/routing";
import "./Session"; // Import the session check; 
import axios from "axios";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [...appRoutes],
})

// Environment variable check for bypassing authentication
const DEBUG_NO_AUTH = import.meta.env.DEBUG_NO_AUTH;

router.beforeEach(async (to, from, next) => {
  if (DEBUG_NO_AUTH) {
    console.warn("🚀 DEBUG MODE: Bypassing authentication");
    return next(); // Allow navigation without authentication
  }

  try {
    const response = await axios.get('http://localhost:6000/session', { withCredentials: true });

    if (!response.data.loggedIn && to.name !== 'login') {
      return next({ name: 'login' }); // Redirect to login if not authenticated
    }

    next(); // Allow navigation if authenticated
  } catch (error) {
    console.error("Session check error:", error);
    next({ name: 'login' });
  }
});

export default router
