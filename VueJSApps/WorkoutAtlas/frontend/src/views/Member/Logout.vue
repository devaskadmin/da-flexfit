<script setup>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAuth, fetchSessionSnapshot } from '@/composable/useAuth';

const router = useRouter();
const { user, logout: authLogout, logoutInProgress } = useAuth();
const username = ref(""); // ✅ Store logged-in username
const logoutMessage = ref("");
const showNotification = ref(false);
const showConfirmation = ref(true); // ✅ Show confirmation first
const logoutError = ref("");

// ✅ Fetch the logged-in user from session (shares the router guard's /api/session request)
const fetchUserSession = async () => {
  try {
    const { data } = await fetchSessionSnapshot();

    if (data?.loggedIn && data.user) {
      username.value = data.user.username;
    } else {
      router.push({ name: "login" });
    }
  } catch (error) {
    // A transient request failure must not dismiss the confirmation (the session is still active).
    console.error("❌ Session fetch error:", error);
    username.value = user.value?.username || "";
  }
};

// ✅ Logout Function - uses shared logout from useAuth
const logout = async () => {
  logoutError.value = "";
  logoutMessage.value = username.value ? `Signing out, ${username.value}...` : "Signing out...";
  showNotification.value = true;
  showConfirmation.value = false;

  // Shared logout handles session termination, state clearing and redirect.
  // On failure it stays on this page so success is never reported for a failed logout.
  const loggedOut = await authLogout({ stayOnFailure: true });

  if (!loggedOut) {
    showNotification.value = false;
    showConfirmation.value = true;
    logoutError.value = "Logout failed. You are still signed in. Please try again.";
  }
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
        <p>Are you sure you want to log out<template v-if="username">, <strong>{{ username }}</strong></template>?</p>
        <p v-if="logoutError" class="logout-error" role="alert">{{ logoutError }}</p>
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
  position: fixed;
  inset: 0;
  z-index: 1800;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100vw;
  min-height: 100vh;
  height: 100dvh;
  padding:
    max(24px, calc(24px + env(safe-area-inset-top, 0px)))
    max(16px, calc(16px + env(safe-area-inset-right, 0px)))
    max(24px, calc(24px + env(safe-area-inset-bottom, 0px)))
    max(16px, calc(16px + env(safe-area-inset-left, 0px)));
  background: rgba(5, 7, 12, 0.62);
  box-sizing: border-box;
  overflow: auto;
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

.logout-body .logout-error {
  margin-top: 12px;
  color: #FCA5A5;
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
