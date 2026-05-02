<script setup>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAuth } from '@/composable/useAuth';

const router = useRouter();
const { user, logout: authLogout, logoutInProgress } = useAuth();
const username = ref(""); // ✅ Store logged-in username
const logoutMessage = ref("");
const showNotification = ref(false);
const showConfirmation = ref(true); // ✅ Show confirmation first

// ✅ Fetch the logged-in user from session
const fetchUserSession = async () => {
  try {
    const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';
    const response = await fetch(`${API_BASE}/api/session`, { credentials: 'include' });
    const data = await response.json();

    if (data.loggedIn && data.user) {
      username.value = data.user.username;
      console.log("✅ Logged-in user:", username.value);
    } else {
      console.log("❌ No user logged in.");
      router.push({ name: "login" }); // Redirect to login if not logged in
    }
  } catch (error) {
    console.error("❌ Session fetch error:", error);
    router.push({ name: "login" });
  }
};

// ✅ Logout Function - uses shared logout from useAuth
const logout = async () => {
  console.log('[LOGOUT DEBUG] Logout.vue logout called');
  
  // Show brief notification
  logoutMessage.value = `Signing out, ${username.value}...`;
  showNotification.value = true;
  showConfirmation.value = false;

  // Use shared logout function (handles everything)
  await authLogout();
};

// ✅ Cancel Logout - Redirects back to home without logging out
const cancelLogout = () => {
  console.log("🚀 Logout canceled. Redirecting to dashboard...");
  router.push({ name: "dashboard_index" });
};

// ✅ Fetch user session when component is mounted
onMounted(fetchUserSession);
</script>

<template>
  <div class="logout-container">
    <div class="logout-body">
      <h3 class="panel-title">Logout</h3>

      <!-- ✅ Show Confirmation Message Before Logging Out -->
      <div v-if="showConfirmation">
        <p>Are you sure you want to log out, <strong>{{ username }}</strong>?</p>
        <div class="button-group">
          <button 
            @click="logout" 
            class="btn btn-danger"
            :disabled="logoutInProgress"
          >
            <span v-if="logoutInProgress">Signing out...</span>
            <span v-else>Logout</span>
          </button>
          <button @click="cancelLogout" class="btn btn-secondary">Cancel</button>
        </div>
      </div>

      
      <!-- ✅ Show Logout Success Message -->
      <div v-if="showNotification" class="notification">
        {{ logoutMessage }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.logout-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
}

.logout-body {
  background: white;
  padding: 20px;
  border-radius: 10px;
  box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1);
  text-align: center;
}

.button-group {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-top: 15px;
}

.notification {
  background-color: #d4edda;
  color: #155724;
  padding: 10px;
  border-radius: 5px;
  text-align: center;
  margin-top: 15px;
}
</style>
