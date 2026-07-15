import {ref} from 'vue';
const THEME_STORAGE_KEY = 'currentActiveTheme';
const DEFAULT_THEME = 'dark-theme';
const ALLOWED_THEMES = new Set(['dark-theme', 'light-theme', 'blue-theme']);

export const getDefaultTheme = () => DEFAULT_THEME;

export const sanitizeTheme = (theme) => {
    return ALLOWED_THEMES.has(theme) ? theme : DEFAULT_THEME;
};

export const syncThemePreference = () => {
    const normalizedTheme = sanitizeTheme(localStorage.getItem(THEME_STORAGE_KEY));
    localStorage.setItem(THEME_STORAGE_KEY, normalizedTheme);
    return normalizedTheme;
};

export const currentActiveTheme = ref(syncThemePreference());

export const changeCurrentTheme = (theme) => {
    const normalizedTheme = sanitizeTheme(theme);
    localStorage.setItem(THEME_STORAGE_KEY, normalizedTheme);
    currentActiveTheme.value = normalizedTheme;
}

export const toggleTheme = () => {
    const nextTheme = currentActiveTheme.value === 'light-theme' ? 'dark-theme' : 'light-theme';
    changeCurrentTheme(nextTheme);
}
