<script setup>
const props = defineProps(['onNavCloseClick', 'isExpanded', 'toggleSidebar', 'profileToggleSidebar'])
import {onMounted, ref, onUnmounted, watchEffect, computed} from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import Tr from "@/i18n/translation"
import {toggleTheme, currentActiveTheme} from "@/composable/manageThemeSetting.js"
import {layoutPosition} from "@/composable/navPositionSetting";

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000'
const router = useRouter()

const isFullScreen = ref(false);
const lightThemeLogo = new URL('/src/assets/images/flex-fitlogo-light.JPG', import.meta.url)
const darkThemeLogo = new URL('/src/assets/images/flex-fitlogo-dark.JPG', import.meta.url)

const toggleFullscreen = () => {
  let elem = document.documentElement;

  if (!document.fullscreenElement && !document.mozFullScreenElement &&
      !document.webkitFullscreenElement && !document.msFullscreenElement) {
    if (elem.requestFullscreen) {
      elem.requestFullscreen();
    } else if (elem.msRequestFullscreen) {
      elem.msRequestFullscreen();
    } else if (elem.mozRequestFullScreen) {
      elem.mozRequestFullScreen();
    } else if (elem.webkitRequestFullscreen) {
      elem.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  }

  isFullScreen.value = !isFullScreen.value;
};

const { t, locale } = useI18n()
const supportedLocales = Tr.supportedLocales

const switchLanguage = async (event) => {
  const newLocale = event.target.value
  await Tr.switchLanguage(newLocale)
}

const isMobileExpanded = ref(false)
const isMobile = ref(false)

const windowWidth = ref(window.innerWidth)
const windowHeight = ref(window.innerHeight)

const handleResize = () => {
  windowWidth.value = window.innerWidth
  windowHeight.value = window.innerHeight
}

const checkScreenSize = (() => {
  isMobile.value = windowWidth.value >= 320 && windowWidth.value <= 991;
})

const toggleHeader = (() => {
  isMobileExpanded.value = !isMobileExpanded.value;
})

const isLightTheme = computed(() => {
  return currentActiveTheme.value === 'light-theme';
})

const unreadCount = ref(0)
const unreadBadge = computed(() => (unreadCount.value > 9 ? '9+' : String(unreadCount.value)))
let unreadPollTimer = null

const loadUnreadCount = async () => {
  try {
    const response = await fetch(`${API_BASE}/api/notifications/unread-count`, {
      credentials: 'include',
    })

    if (!response.ok) return
    const data = await response.json()
    unreadCount.value = Number(data?.unreadCount || 0)
  } catch {
    unreadCount.value = 0
  }
}

const openNotifications = () => {
  router.push({ name: 'notifications' })
}

watchEffect(() => {
  window.addEventListener('resize', checkScreenSize());
  checkScreenSize();
})

onMounted(() => {
  Tr.switchLanguage(Tr.guessDefaultLocale());
  document.getElementById('btnFullscreen').addEventListener('click', toggleFullscreen);

  window.addEventListener('resize', handleResize)
  loadUnreadCount()
  unreadPollTimer = setInterval(loadUnreadCount, 60000)
})

const themeIconClass = computed(() => {
  return isLightTheme.value ? 'fa-light fa-cloud-moon' : 'fa-light fa-sun-bright';
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (unreadPollTimer) {
    clearInterval(unreadPollTimer)
  }
})
</script>

<template>
  <div class="header" :class="{ expanded: isExpanded, 'expanded-in-mobile': isMobileExpanded }">
    <div class="row g-0 align-items-center">
      <div class="col-xxl-6 col-xl-5 col-4 d-flex align-items-center gap-20">
        <div class="main-logo d-lg-block d-none">
          <div class="logo-big">
            <router-link :to="{name: 'dashboard_index'}">
              <img :src="[isLightTheme ? lightThemeLogo : darkThemeLogo]" alt="Logo">
            </router-link>
          </div>
          <div class="logo-small">
            <router-link :to="{name: 'dashboard_index'}">
              <img src="@/assets/images/logo-small.png" alt="Logo">
            </router-link>
          </div>
        </div>
        <div v-if="layoutPosition !== 'horizontal'" class="nav-close-btn">
          <button id="navClose" @click="onNavCloseClick"><i class="fa-light fa-bars-sort"></i></button>
        </div>
      </div>
      <div class="col-4 d-lg-none">
        <div class="mobile-logo">
          <router-link :to="{name: 'dashboard_index'}">
            <img :src="[isLightTheme ? lightThemeLogo : darkThemeLogo]" alt="Logo">
          </router-link>
        </div>
      </div>
      <div class="col-xxl-6 col-xl-7 col-lg-8 col-4">
        <div class="header-right-btns d-flex justify-content-end align-items-center">
          <div class="header-collapse-group" :class="[isMobileExpanded ? 'd-block' : '']">
            <div class="header-right-btns d-flex justify-content-end align-items-center p-0">
              <form class="header-form">
                <input type="search" name="search" placeholder="Search..." required>
                <button type="submit"><i class="fa-solid fa-magnifying-glass"></i></button>
              </form>
              <div class="header-right-btns d-flex justify-content-end align-items-center p-0">
                <div class="lang-select">
                  <span>{{ $t('nav.language') }}:</span>
                  <select @change="switchLanguage">
                    <option
                    v-for="sLocale in supportedLocales"
                    :key="`locale-${sLocale}`"
                    :value="sLocale"
                    :selected="locale === sLocale"
                  >
                    {{ t(`locale.${sLocale}`) }}
                  </option>
                  </select>
                </div>
                <div class="header-btn-box">
                  <button class="header-btn" id="messageDropdown" data-bs-toggle="dropdown" aria-expanded="false">
                    <i class="fa-light fa-comment-dots"></i>
                    <span class="badge bg-danger">3</span>
                  </button>
                  <ul class="message-dropdown dropdown-menu" aria-labelledby="messageDropdown">
                    <li>
                      <a href="#" class="d-flex">
                        <div class="avatar">
                          <img src="@/assets/images/avatar.png" alt="image">
                        </div>
                        <div class="msg-txt">
                          <span class="name">Archer Cowie</span>
                          <span class="msg-short">There are many variations of passages of Lorem Ipsum.</span>
                          <span class="time">2 Hours ago</span>
                        </div>
                      </a>
                    </li>
                    <li>
                      <a href="#" class="d-flex">
                        <div class="avatar">
                          <img src="@/assets/images/avatar-2.png" alt="image">
                        </div>
                        <div class="msg-txt">
                          <span class="name">Cody Rodway</span>
                          <span class="msg-short">There are many variations of passages of Lorem Ipsum.</span>
                          <span class="time">2 Hours ago</span>
                        </div>
                      </a>
                    </li>
                    <li>
                      <a href="#" class="d-flex">
                        <div class="avatar">
                          <img src="@/assets/images/avatar-3.png" alt="image">
                        </div>
                        <div class="msg-txt">
                          <span class="name">Zane Bain</span>
                          <span class="msg-short">There are many variations of passages of Lorem Ipsum.</span>
                          <span class="time">2 Hours ago</span>
                        </div>
                      </a>
                    </li>
                    <li>
                      <a href="#" class="show-all-btn">Show all message</a>
                    </li>
                  </ul>
                </div>
                <div class="header-btn-box">
                  <button class="header-btn" @click="openNotifications" title="Notifications" aria-label="Open notifications">
                    <i class="fa-light fa-bell animate"></i>
                    <span v-if="unreadCount > 0" class="badge bg-danger">{{ unreadBadge }}</span>
                  </button>
                </div>
                <button class="header-btn fullscreen-btn" id="btnFullscreen" @click="toggleFullscreen">
                  <i :class="isFullScreen ? 'fa-light fa-compress' : 'fa-light fa-expand'"></i>
                </button>
                <button class="header-btn theme-color-btn" @click="toggleTheme"><i :class="themeIconClass"></i></button>
              </div>
            </div>
          </div>
          <button class="header-btn header-collapse-group-btn d-lg-none" @click="toggleHeader"><i class="fa-light fa-ellipsis-vertical"></i></button>
          <button class="header-btn theme-settings-btn d-lg-none" @click="toggleSidebar"><i class="fa-light fa-gear"></i></button>
          <div class="header-btn-box profile-btn-box">
            <button class="profile-btn" data-bs-toggle="dropdown" aria-expanded="false">
              <img src="@/assets/images/admin.png" alt="image">
            </button>
            <ul class="dropdown-menu profile-dropdown-menu">
              <li>
                <div class="dropdown-txt text-center">
                  <p class="mb-0">Shaikh Abu Dardah</p>
                  <span class="d-block">Web Developer</span>
                  <div class="d-flex justify-content-center">
                    <div class="form-check pt-3">
                      <input class="form-check-input" type="checkbox" id="seeProfileAsSidebar" @change="profileToggleSidebar">
                      <label class="form-check-label" for="seeProfileAsSidebar">See as sidebar</label>
                    </div>
                  </div>
                </div>
              </li>
              <li><router-link class="dropdown-item" :to="{ name: 'view_profile' }"><span class="dropdown-icon"><i class="fa-regular fa-circle-user"></i></span> Profile</router-link></li>
              <li><router-link class="dropdown-item" :to="{ name: 'chat' }"><span class="dropdown-icon"><i class="fa-regular fa-message-lines"></i></span> Message</router-link></li>
              <li><router-link class="dropdown-item" :to="{ name: 'crm_task' }"><span class="dropdown-icon"><i class="fa-regular fa-calendar-check"></i></span> Taskboard</router-link></li>
              <li><a class="dropdown-item" href="#"><span class="dropdown-icon"><i class="fa-regular fa-circle-question"></i></span> Help</a></li>
              <li><hr class="dropdown-divider"></li>
              <li><router-link class="dropdown-item" :to="{ name: 'edit_profile' }"><span class="dropdown-icon"><i class="fa-regular fa-gear"></i></span> Settings</router-link></li>
              <li><router-link class="dropdown-item" :to="{ name: 'logout' }"><span class="dropdown-icon"><i class="fa-regular fa-arrow-right-from-bracket"></i></span> Logout</router-link></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>

</style>