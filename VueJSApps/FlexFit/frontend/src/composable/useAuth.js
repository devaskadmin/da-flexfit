//AUTHENTICATION
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const user = ref(null);

export function useAuth() {
  const router = useRouter();

  const fetchUser = async () => {
    try {
      const res = await fetch(import.meta.env.VITE_API_BASE + '/api/session', {
        credentials: 'include'
      });
      const data = await res.json();
      user.value = data.loggedIn ? data.user : null;
    } catch (err) {
      console.error('Session check failed:', err);
      user.value = null;
    }
  };

  
  const requireAuth = async () => {
    await fetchUser();
    if (!user.value) {
      router.push({ name: 'login' });
    }
  };

  return { user, fetchUser, requireAuth };
}
