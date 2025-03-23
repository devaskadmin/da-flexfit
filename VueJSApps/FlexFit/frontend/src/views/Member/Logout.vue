<script setup>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import axios from "axios";

const router = useRouter();
const username = ref(""); // ✅ Store logged-in username
const logoutMessage = ref("");
const showNotification = ref(false);
const showConfirmation = ref(true); // ✅ Show confirmation first

// 🔹 Load Backend API URL from `.env` file
const API_BASE = import.meta.env.VITE_API_BASE;

console.log(`🔗 Logout page using backend: ${API_BASE}`);

// ✅ Fetch the logged-in user from session
const fetchUserSession = async () => {
  try {
    const response = await axios.get(`${API_BASE}/api/session`, { withCredentials: true });

    if (response.data.loggedIn && response.data.user) {
      username.value = response.data.user.username;
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

// ✅ Logout Function
const logout = async () => {
  try {
    await axios.post(`${API_BASE}/api/logout`, {}, { withCredentials: true });
    console.log("✅ Logout successful");

    // ✅ Show logout message
    logoutMessage.value = `You have successfully logged out, ${username.value}.`;
    showNotification.value = true;
    showConfirmation.value = false;

    // ✅ Wait before redirecting to login
    setTimeout(() => {
      showNotification.value = false;
      router.push({ name: "login" });
    }, 2000);
  } catch (error) {
    console.error("❌ Logout failed:", error);
    logoutMessage.value = "Logout failed. Please try again.";
    showNotification.value = true;
  }
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
          <button @click="logout" class="btn btn-danger">Logout</button>
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
