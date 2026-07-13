<script setup>
const props = defineProps(['isSidebarActive', 'closeSidebar'])
import { onMounted, ref } from "vue"
import {vClickOutside} from "@/composable/outsideClicker";
import { API_BASE } from '@/config/env';
import { getDefaultTheme, sanitizeTheme } from '@/composable/manageThemeSetting';

import NavPositionComponent from "@/components/template/layoutSetting/NavPositionComponent.vue";
import ThemeDirectionComponent from "@/components/template/layoutSetting/ThemeDirectionComponent.vue";
import PrimaryColorComponent from "@/components/template/layoutSetting/PrimaryColorComponent.vue";
import ThemeColorComponent from "@/components/template/layoutSetting/ThemeColorComponent.vue";
import NavbarSizeComponent from "@/components/template/layoutSetting/NavbarSizeComponent.vue";
import SidebarBackgroundComponent from "@/components/template/layoutSetting/SidebarBackgroundComponent.vue";
import MainBackgroundComponent from "@/components/template/layoutSetting/MainBackgroundComponent.vue";
import MainPreloaderComponent from "@/components/template/layoutSetting/MainPreloaderComponent.vue";

const layoutSettings = ref([
  {key: 'nav_position', component: NavPositionComponent, title: 'Nav Position', collapsed: false},
  {key: 'theme_direction', component: ThemeDirectionComponent, title: 'Theme Direction', collapsed: false},
  {key: 'primary_color', component: PrimaryColorComponent, title: 'Primary Color', collapsed: false},
  {key: 'theme_color', component: ThemeColorComponent, title: 'Theme Color', collapsed: false},
  {key: 'navbar_size', component: NavbarSizeComponent, title: 'Navbar Size', collapsed: false},
  {key: 'sidebar_background', component: SidebarBackgroundComponent, title: 'Sidebar Background', collapsed: false},
  {key: 'main_background', component: MainBackgroundComponent, title: 'Main Background', collapsed: false},
  {key: 'main_preloader', component: MainPreloaderComponent, title: 'Main Preloader', collapsed: false},
])

const collapsed = ref(false)
const saveStatus = ref('')
const saveError = ref('')
const hideThemeSidebarToggle = ref(localStorage.getItem('hideThemeSidebar') === 'true')

const handleClickOutside = (() => {
  props.closeSidebar();
})

const toggleCollapse = ((index) => {
  layoutSettings.value[index].collapsed = !layoutSettings.value[index].collapsed;
})

const collectThemeConfig = () => ({
  navPosition: localStorage.getItem('layoutPosition') || 'vertical',
  themeDirection: localStorage.getItem('layoutDirection') || 'ltr',
  primaryColor: localStorage.getItem('selectedStyleSheet') || import.meta.env.VITE_DEFAULT_COLOR || 'blue-color',
  themeColor: sanitizeTheme(localStorage.getItem('currentActiveTheme') || getDefaultTheme()),
  navbarSize: localStorage.getItem('sidebarHover') ? 'expand' : localStorage.getItem('sidebarSmall') ? 'small' : 'default',
  sidebarBackground: localStorage.getItem('navbackgroundImage') || '',
  mainBackground: localStorage.getItem('mainBackgroundImage') || '',
  preloaderEnabled: localStorage.getItem('preloaderEnabled') !== 'false',
  hideThemeSidebar: !!hideThemeSidebarToggle.value,
});

const loadPersistedThemeVisibility = async () => {
  try {
    const response = await fetch(`${API_BASE}/api/user-profile-settings`, {
      credentials: 'include',
    })
    if (!response.ok) return

    const data = await response.json()
    const settings = data?.settings || {}
    const cfgHide = settings?.themeConfig?.hideThemeSidebar
    const displayHide = settings?.display?.hideThemeSidebar

    if (typeof cfgHide === 'boolean') {
      hideThemeSidebarToggle.value = cfgHide
    } else if (typeof displayHide === 'boolean') {
      hideThemeSidebarToggle.value = displayHide
    }

    localStorage.setItem('hideThemeSidebar', String(!!hideThemeSidebarToggle.value))
  } catch (_) {
    // keep local fallback
  }
}

const saveThemeSettings = async () => {
  saveStatus.value = 'saving'
  saveError.value = ''

  localStorage.setItem('hideThemeSidebar', String(!!hideThemeSidebarToggle.value))

  const themeConfig = collectThemeConfig()

  try {
    const response = await fetch(`${API_BASE}/api/user-profile-settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        settings: {
          themeConfig,
          display: {
            hideThemeSidebar: themeConfig.hideThemeSidebar,
          },
        },
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err?.error || 'Failed to save theme settings')
    }

    window.dispatchEvent(new CustomEvent('ff-theme-settings-updated', { detail: themeConfig }))
    saveStatus.value = 'saved'
    setTimeout(() => {
      saveStatus.value = ''
    }, 2200)
  } catch (error) {
    saveStatus.value = ''
    saveError.value = error?.message || 'Unable to save theme settings.'
  }
}

onMounted(() => {
  loadPersistedThemeVisibility()
})

</script>

<template>
  <div v-click-outside="handleClickOutside" class="right-sidebar" :class="{ active: isSidebarActive }" @click.stop>
    <button class="right-bar-close" @click="closeSidebar"><i class="fa-light fa-angle-right"></i></button>
    <div class="sidebar-title">
      <h3>Layout Settings</h3>
    </div>
    <div class="sidebar-body scrollable">
      <template v-for="(setting, index) in layoutSettings">
        <component :is="setting.component" :setting="setting" :index="index" :toggleCollapse="toggleCollapse"></component>
      </template>

      <div class="layout-save-wrap">
        <label class="layout-hide-toggle">
          <input type="checkbox" v-model="hideThemeSidebarToggle" />
          <span>Hide - Theming side menu advanced theming config</span>
        </label>

        <button class="btn btn-primary w-100" :disabled="saveStatus==='saving'" @click="saveThemeSettings">
          {{ saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : 'Save Layout Settings' }}
        </button>
        <div v-if="saveError" class="layout-save-error">{{ saveError }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.layout-save-wrap {
  position: sticky;
  bottom: 0;
  background: inherit;
  padding-top: 12px;
  margin-top: 10px;
}

.layout-save-error {
  margin-top: 8px;
  color: #dc3545;
  font-size: 12px;
}

.layout-hide-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 12px;
}

</style>