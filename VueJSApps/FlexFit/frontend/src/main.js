import './styles/design-system.css'
import 'bootstrap'
import '@popperjs/core'

import '@/assets/vendor/css/all.min.css'
import 'overlayscrollbars/overlayscrollbars.css';
import '@/assets/vendor/css/bootstrap.min.css'
import '@/assets/vendor/css/jquery.uploader.css'
import '@/assets/vendor/css/dropzone.min.css'
import '@/assets/vendor/css/material-icon.css'
import 'vue-datepicker-next/index.css';
import '@/assets/css/style.css'
import '@/assets/css/mobile.css'
// import '@/assets/scss/style.scss'

import VueSweetalert2 from 'vue-sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import ToastPlugin from 'vue-toast-notification';
import 'vue-toast-notification/dist/theme-bootstrap.css';
import AOS from 'aos'
import 'aos/dist/aos.css'

import i18n from "./i18n"
import axios from 'axios'

import {createApp, inject} from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'

import router from './router';

axios.defaults.withCredentials = true;

const app = createApp(App)

const removeLegacyDebugArtifacts = () => {
	if (typeof document === 'undefined') return;

	const appRoot = document.getElementById('app');
	if (!appRoot) return;

	const isLegacyDebugNode = (node) => {
		if (!(node instanceof Element)) return false;

		const text = `${node.id || ''} ${node.className || ''} ${node.getAttribute('data-testid') || ''} ${node.getAttribute('aria-label') || ''}`.toLowerCase();
		const src = `${node.getAttribute('src') || ''} ${node.getAttribute('href') || ''}`.toLowerCase();

		const hasLegacyKeywords = /maricopa|\bpit\b|homeless|sheltered|unsheltered|matplotlib|debug|test|plot|chart/.test(text)
			|| /data:image\/|base64/.test(src);

		const isVisualDebugTag = ['IMG', 'CANVAS', 'IFRAME', 'SVG', 'FIGURE'].includes(node.tagName);

		return hasLegacyKeywords || isVisualDebugTag;
	};

	// Remove stray elements injected outside #app (common cause of content appearing above the app shell).
	Array.from(document.body.children)
		.filter((child) => child !== appRoot && isLegacyDebugNode(child))
		.forEach((child) => child.remove());
};

removeLegacyDebugArtifacts();


import 'bootstrap/dist/css/bootstrap.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'

app.use(i18n);
app.use(ToastPlugin);
app.use(createPinia());
app.use(router);
app.use(VueSweetalert2);


app.mount('#app', AOS.init());
