/**
 * WorkoutAtlas App Configuration
 * Central place to read environment-level settings exposed via Vite.
 */

/** @type {'demo' | 'production' | string} */
export const operatingMode = (import.meta.env.VITE_OPERATING_MODE || 'production').toLowerCase().trim();

/** True when the app is running in demo/showcase mode. */
export const isDemoMode = operatingMode === 'demo';

export default { operatingMode, isDemoMode };
