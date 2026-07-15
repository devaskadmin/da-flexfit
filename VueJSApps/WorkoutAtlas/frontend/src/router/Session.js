///Session
import axios from "axios";
import router from "@/router/index"; // Import the Vue Router instance
import { API_BASE } from '@/config/env';

axios.get(`${API_BASE}/api/session`, { withCredentials: true })
  .then(response => {
    if (!response.data.loggedIn) {
      router.push({ name: 'login' });  // Redirect to login if not logged in
    }
  })
  .catch(error => {
    console.error("Session check failed:", error);
  });