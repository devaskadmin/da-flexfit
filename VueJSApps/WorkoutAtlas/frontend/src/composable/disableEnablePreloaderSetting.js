import { ref, computed, onMounted, onUnmounted } from 'vue';

export const disableLoader = ref(null);
export const enableLoader = ref(null);
export const preloader = ref(null);

export const disableLoaderClickHandler = () => {
    preloader.value = false;
    localStorage.setItem('preloaderEnabled', 'false');
};

export const enableLoaderClickHandler = () => {
    preloader.value = true;
    localStorage.setItem('preloaderEnabled', 'true');
    setTimeout(() => {
        preloader.value = false;
    }, 3000)
    // preloader.value.style.animation = 'fadein 0.1s, fadeout 2s';
};

export const useDisableEnablePreloader = (() => {
    disableLoader.value.addEventListener('click', disableLoaderClickHandler);
    enableLoader.value.addEventListener('click', enableLoaderClickHandler);
});

const savedPreloader = localStorage.getItem('preloaderEnabled');
if (savedPreloader === null) {
    preloader.value = true;
} else {
    preloader.value = savedPreloader !== 'false';
}