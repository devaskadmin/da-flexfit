import { ref } from 'vue';
const defaultDirection =  import.meta.env.VITE_DEFAULT_DIRECTION;

export const layoutDirection = ref(localStorage.getItem('layoutDirection') || defaultDirection);

export const setRtl = () => {
    layoutDirection.value = 'rtl';
    localStorage.setItem('layoutDirection', 'rtl');

    const rtlStyleLink = document.getElementById('rtlStyle');
    if (rtlStyleLink) {
        rtlStyleLink.href = new URL('/src/assets/css/rtl-style.css', import.meta.url);
    }
};

export const setLtr = () => {
    layoutDirection.value = 'ltr';
    localStorage.setItem('layoutDirection', 'ltr');
    const rtlStyleLink = document.getElementById('rtlStyle');
    // Do not set href="" on a stylesheet link; browsers resolve it to the current
    // route (e.g. /login) and log a strict MIME error for non-CSS HTML responses.
    if (rtlStyleLink) {
        rtlStyleLink.removeAttribute('href');
    }
};