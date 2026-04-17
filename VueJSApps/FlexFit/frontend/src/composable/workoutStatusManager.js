import { ref } from 'vue'
import { API_BASE } from '@/config/env'

/**
 * Global composable to manage workout-list visibility status for sidebar.
 * If true, Workout Log should be shown for the current user.
 */

export const userHasWorkouts = ref(false) // workout-log visibility state
export const isCheckingWorkouts = ref(false)

/**
 * Fetch the current user's workout status from the backend
 */
export const checkUserWorkoutStatus = async () => {
  try {
    isCheckingWorkouts.value = true
    const response = await fetch(`${API_BASE}/api/has-saved-workout-list`, {
      credentials: 'include',
    })

    if (!response.ok) {
      console.warn('Failed to check workout status')
      userHasWorkouts.value = false
      return false
    }

    const data = await response.json()
    const unlocked = Boolean(data?.hasWorkoutLists ?? data?.hasSavedWorkoutExerciseList)
    userHasWorkouts.value = unlocked
    return unlocked
  } catch (err) {
    console.error('Error checking workout status:', err)
    userHasWorkouts.value = false
    return false
  } finally {
    isCheckingWorkouts.value = false
  }
}

/**
 * Refresh the workout status
 * Call this after creating a new workout to update the sidebar
 */
export const refreshWorkoutStatus = async () => {
  return await checkUserWorkoutStatus()
}

/**
 * Set the workout status directly (useful if you already have the data)
 * @param {boolean} hasWorkouts - Whether the user has workouts
 */
export const setUserWorkoutStatus = (hasWorkouts) => {
  userHasWorkouts.value = hasWorkouts
}

/**
 * Get the current workout status without fetching
 * @returns {boolean} Whether user has workouts
 */
export const getUserWorkoutStatus = () => {
  return userHasWorkouts.value
}
