import { ref } from 'vue';
const defaultColor =  import.meta.env.VITE_DEFAULT_COLOR

export const colors = ref([]);
export const selectedStyleSheet = ref(localStorage.getItem('selectedStyleSheet') || defaultColor);

export const setStyleSheet = (color) => {
    selectedStyleSheet.value = color;
    if (localStorage.getItem('selectedStyleSheet') !== String(color)) {
        localStorage.setItem('selectedStyleSheet', color);
    }
    // You might need to adjust this part based on how you are applying the style sheet
    const colorStyleLink = document.getElementById('primaryColor');
    if (!colorStyleLink) return;
    // Set the 'href' attribute to the new CSS file path. Re-assigning an unchanged href makes the
    // browser re-resolve the stylesheet on every protected navigation, so only write on change.
    const stylesheetUrl = new URL(`/src/assets/css/${color}.css`, import.meta.url).href;
    if (colorStyleLink.href !== stylesheetUrl) {
        colorStyleLink.href = stylesheetUrl;
    }
};