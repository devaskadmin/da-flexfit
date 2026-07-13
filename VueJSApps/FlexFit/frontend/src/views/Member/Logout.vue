<script setup>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAuth } from '@/composable/useAuth';
import { API_BASE } from '@/config/env';

const router = useRouter();
const { user, logout: authLogout, logoutInProgress } = useAuth();
const username = ref(""); // ✅ Store logged-in username
const logoutMessage = ref("");
const showNotification = ref(false);
const showConfirmation = ref(true); // ✅ Show confirmation first

// ✅ Fetch the logged-in user from session
const fetchUserSession = async () => {
  try {
    const response = await fetch(`${API_BASE}/api/session`, { credentials: 'include' });
    const data = await response.json();

    if (data.loggedIn && data.user) {
      username.value = data.user.username;
    } else {
      router.push({ name: "login" });
    }
  } catch (error) {
    console.error("❌ Session fetch error:", error);
    router.push({ name: "login" });
  }
};

// ✅ Logout Function - uses shared logout from useAuth
const logout = async () => {
  // Show brief notification
  logoutMessage.value = `Signing out, ${username.value}...`;
  showNotification.value = true;
  showConfirmation.value = false;

  // Use shared logout function (handles everything)
  await authLogout();
};

// ✅ Cancel Logout - Redirects back to home without logging out
const cancelLogout = () => {
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
  min-height: 100vh;
  height: 100dvh;
  padding: 24px 16px;
  background: rgba(5, 7, 12, 0.62);
}

.logout-body {
  width: min(100%, 560px);
  background: var(--wa-panel-bg, #1B2444);
  border: 1px solid var(--wa-border, rgba(145, 160, 200, 0.24));
  border-radius: 16px;
  box-shadow: 0 18px 45px rgba(0, 0, 0, 0.35);
  padding: 28px;
  text-align: center;
}

.logout-body .panel-title {
  margin: 0 0 10px;
  color: var(--wa-text-primary, #F7F9FF);
}

.logout-body p {
  margin: 0;
  color: var(--wa-text-secondary, #C7D0E3);
}

.logout-body strong {
  color: var(--wa-text-primary, #F7F9FF);
}

.button-group {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-top: 18px;
}

.logout-body .btn {
  min-height: 44px;
  padding: 10px 18px;
  border-radius: 12px;
  font-weight: 600;
}

.logout-body .btn-danger {
  background: var(--wa-action-red, #C73A46) !important;
  color: #FFFFFF !important;
  border: 1px solid transparent !important;
}

.logout-body .btn-danger:hover {
  background: var(--wa-action-red-hover, #A92F39) !important;
}

.logout-body .btn-danger:active {
  background: var(--wa-action-red-hover, #A92F39) !important;
  transform: translateY(1px);
}

.logout-body .btn-secondary {
  background: var(--wa-neutral-bg, #252E48) !important;
  color: var(--wa-text-primary, #F7F9FF) !important;
  border: 1px solid var(--wa-border, rgba(145, 160, 200, 0.24)) !important;
}

.logout-body .btn-secondary:hover {
  background: var(--wa-neutral-hover, #333E5E) !important;
}

.logout-body .btn:focus-visible {
  outline: 2px solid rgba(199, 208, 227, 0.92);
  outline-offset: 2px;
}

.logout-body .btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.notification {
  background: rgba(37, 46, 72, 0.62);
  color: var(--wa-text-muted, #8F9BB5);
  border: 1px solid var(--wa-border, rgba(145, 160, 200, 0.24));
  padding: 10px;
  border-radius: 10px;
  text-align: center;
  margin-top: 15px;
}

@media (max-width: 520px) {
  .logout-body {
    padding: 22px 16px;
  }

  .button-group {
    flex-direction: column;
    align-items: stretch;
  }

  .logout-body .btn {
    width: 100%;
  }
}
</style>
