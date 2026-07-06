<script setup>
import {sidebarDropdownManage} from "@/composable/manageSidebarMenu";

const props = defineProps(['isCollapsed','isTwoColumnMenu','isSidebarMini','isSubMenuCollapsed', 'closeMainLeftSidebar'])
import {computed, onMounted, ref, watchEffect} from "vue";
import {useRoute} from "vue-router";
import SidebarMenuComponent from "@/components/template/menu/SidebarMenuComponent.vue";
import {vClickOutside} from "@/composable/outsideClicker";
import {mainSidebarBg, useSidebarCurrentBG} from "@/composable/mainSidebarBackgroundSetting"
import {sidebarMenus} from "@/components/sidebarMenu"
import {currentNavbarSize, hoverableMenu, hoverableSidebar, hoverableOutSidebar} from "@/composable/navbarSizeSetting"

import {layoutPosition} from "@/composable/navPositionSetting";
import { userHasWorkouts, checkUserWorkoutStatus } from '@/composable/workoutStatusManager'
import { useAuth } from '@/composable/useAuth'

// IMPORTANT:
// Menu access control is now based ONLY on the user's resolved role (RBAC) from user_roles/roles.
// membershipType is NOT used for menu permissions. It is only for billing/profile tier.

const route = useRoute();
const currentRoute = ref('');
const isSubmenus = ref(false);

const openedMenu = ref(null);
const hasSavedWorkoutPlan = userHasWorkouts;
const authStore = useAuth()

const sidebarUser = computed(() => authStore.user?.value || authStore.user || null)

const safeParseStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}')
  } catch {
    return {}
  }
}

const normalizeRoleValue = (candidate) => {
  const value = String(candidate || '').trim().toLowerCase()
  if (value === 'administrator') return 'admin'
  return value
}

// role = RBAC/access control
// membershipType = membership/billing/profile tier
const normalizedRole = computed(() =>
  normalizeRoleValue(
    authStore.user?.value?.role ||
    authStore.user?.value?.roleSlug ||
    authStore.user?.value?.role_slug ||
    authStore.user?.value?.user_role ||
    authStore.user?.role ||
    authStore.user?.roleSlug ||
    authStore.user?.role_slug ||
    authStore.user?.user_role ||
    authStore.currentUser?.role ||
    authStore.currentUser?.roleSlug ||
    authStore.currentUser?.role_slug ||
    authStore.currentUser?.user_role ||
    localStorage.getItem('role') ||
    localStorage.getItem('userRole') ||
    safeParseStoredUser()?.role ||
    safeParseStoredUser()?.roleSlug ||
    safeParseStoredUser()?.role_slug ||
    safeParseStoredUser()?.user_role ||
    ''
  )
)

const isAdmin = computed(() => normalizedRole.value === 'admin')
const isTrainer = computed(() => normalizedRole.value === 'trainer')
const isUser = computed(() => normalizedRole.value === 'user')
<<<<<<< HEAD:VueJSApps/WorkoutAtlas/frontend/src/components/MainSidebarComponent.vue
const isMember = computed(() => normalizedRole.value === 'member')

const canViewTrainerMenu = computed(() =>
  isAdmin.value || isTrainer.value || isUser.value || isMember.value || !normalizedRole.value
=======

const canViewTrainerMenu = computed(() =>
  isAdmin.value || isTrainer.value
>>>>>>> origin/0.84-Mobile:VueJSApps/FlexFit/frontend/src/components/MainSidebarComponent.vue
)

const canViewAdminMenu = computed(() =>
  isAdmin.value
)



const shouldRenderMenuItem = (menu) => {
  if (!menu?.requiresWorkoutLists && !menu?.requiresUnlock) return true
  return hasSavedWorkoutPlan.value
}

const findMenuByName = ((name) => {
  if (layoutPosition.value === 'twoColumn') {
    const sidebarDropdownMenus = document.querySelectorAll('.sidebar-dropdown-menu.collapse.show');
    sidebarDropdownMenus.forEach(menu => {
      menu.classList.remove('show');
    });
  } else {
    openedMenu.value = null
    for (let i = 0; i < sidebarMenus.value.length; i++) {
      const section = sidebarMenus.value[i]

      if (section.menu_name === 'Trainer' && !canViewTrainerMenu.value) continue
      if (section.menu_name === 'Administrator' && !canViewAdminMenu.value) continue

      let menu = section;
      for (let j = 0; j < menu.menus.length; j++) {
        let subMenu = menu.menus[j];
        if (subMenu.name === name && subMenu.sub_menus) {
          openedMenu.value = subMenu.sub_menus
          return subMenu.sub_menus;
        }
      }
    }
    return null;
  }

})

const checkSubMenus = ((array) => {
  for (let item of array) {
      if (item.sub_menus) {
          return true;
      } else if (Array.isArray(item.sub_menus) && checkSubMenus(item.sub_menus)) {
          return true;
      }
    }
    return false;
})

const closeToggleMenu = (() => {
  if(openedMenu.value && openedMenu.value.length > 0) {
    isSubmenus.value = checkSubMenus(openedMenu.value)
  }
  const sidebarDropdownMenus = document.querySelectorAll('.sidebar-dropdown-menu.collapse.show');
  if (layoutPosition.value !== 'horizontal' || props.isCollapsed) {
    sidebarDropdownMenus.forEach(menu => {
      if(!isSubmenus.value && layoutPosition.value !== 'twoColumn') {
        menu.classList.remove('show');
      }
    });
  }
})

const closeAllDropdownMenu = (() => {
  sidebarDropdownManage()
})

const horizontalMenuEnabled = computed(() => {
  return layoutPosition.value === 'horizontal';
})

watchEffect(() => {
  currentRoute.value = route.name;
  if (props.isCollapsed){
    sidebarDropdownManage()
  }
});

onMounted(() => {
  useSidebarCurrentBG();
  checkUserWorkoutStatus(); // Check workout status from global composable
  authStore.fetchUser();
  console.log('Sidebar role debug:', { normalizedRole: normalizedRole.value, isAdmin: isAdmin.value, isTrainer: isTrainer.value })
})
</script>

<template>
  <div class="main-sidebar"
   :class="{
      'collapsed sub-menu-collapsed': isCollapsed, 'two-column-menu collapsed': isTwoColumnMenu, 'sidebar-mini': isSidebarMini,
      'sub-menu-collapsed': isSubMenuCollapsed, 'hoverable': currentNavbarSize === 'expand',
      'sidebar-hover hoverable': hoverableMenu,
      'open-sub horizontal-menu': horizontalMenuEnabled,
      'two-column-menu collapsed': layoutPosition === 'twoColumn',
      'flush-menu': layoutPosition === 'flushMenu'
    }"
   :style="`background-image: url(${mainSidebarBg})`"
   @mouseenter="hoverableSidebar"
   @mouseleave="hoverableOutSidebar"
  >

  
    <div v-click-outside="closeMainLeftSidebar" class="main-menu">








<<<<<<< HEAD:VueJSApps/WorkoutAtlas/frontend/src/components/MainSidebarComponent.vue
      <div class="sidebar-menu" :id="horizontalMenuEnabled ? 'accordionExample' : 'testAccordionExample'" style="overflow-y: scroll;">
=======
      <div class="sidebar-menu wa-sidebar-scroll" :id="horizontalMenuEnabled ? 'accordionExample' : 'testAccordionExample'">
>>>>>>> origin/0.84-Mobile:VueJSApps/FlexFit/frontend/src/components/MainSidebarComponent.vue
          <li
            v-for="(sidebar, index) in sidebarMenus"
            :key="`section-${index}-${sidebar.menu_name}`"
            class="sidebar-item"
            :class="[horizontalMenuEnabled ? 'dropdown': '']"
          >
            <template v-if="sidebar.menu_name === 'Trainer'">
            <template v-if="canViewTrainerMenu">
            <template v-if="horizontalMenuEnabled">
              <a role="button" :class="['sidebar-link-group-title', 'has-sub', !horizontalMenuEnabled && 'sidebar-section-header', !horizontalMenuEnabled && 'app-header-gradient']" :id="'parentDropdownMenu'+index" :data-bs-toggle="[horizontalMenuEnabled ? 'dropdown' : '']" data-bs-auto-close="outside" aria-expanded="false">
                {{ $t(sidebar.menu_name) }}
              </a>
            </template>
            <template v-else>
              <a role="button" :class="['sidebar-link-group-title', 'has-sub', !horizontalMenuEnabled && 'sidebar-section-header', !horizontalMenuEnabled && 'app-header-gradient']" data-bs-toggle="collapse" :href="`#collapseExample-${index}`" aria-expanded="false" :aria-controls="'collapseExample-'+index">
                {{ $t(sidebar.menu_name) }}
              </a>
            </template>



            <template v-if="sidebar.menus">





              <ul class="sidebar-link-group" :class="[horizontalMenuEnabled ? 'dropdown-menu' : 'show']" :aria-labelledby="[horizontalMenuEnabled ? 'parentDropdownMenu'+index  : '']" :id="[horizontalMenuEnabled ? 'AppDropDownId'+index : `collapseExample-${index}`]" data-bs-parent="#testAccordionExample">
                <template v-for="(menu, mIndex) in sidebar.menus" :key="`${index}-${mIndex}-${menu.name}`">
                <li v-if="shouldRenderMenuItem(menu)" class="sidebar-dropdown-item">
                  <template v-if="menu.link_name">
                    <router-link
                      :to="{ name: `${menu.link_name}` }"
                      class="sidebar-link"
                      :class="[sidebar.linkClass || '', {active : currentRoute === menu.link_name }]"
                    >
                      <span class="nav-icon"><i :class="menu.icon"></i></span><span class="sidebar-txt">{{ $t(menu.name) }}</span>
                    </router-link>
                  </template>
                  <template v-if="menu.sub_menus">
                    <template v-if="horizontalMenuEnabled">
                    <a role="button" class="sidebar-link has-sub" :id="'parentSubDropdownMenu'+index" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false">
                      <span v-if="menu.icon" class="nav-icon"><i :class="menu.icon"></i></span><span class="sidebar-txt">{{ $t(menu.name) }}</span>
                    </a>
                    </template>
                    <template v-else>
                      <a role="button" class="sidebar-link has-sub" data-bs-toggle="collapse" :href="`#subCollapseMenu-${mIndex}-${index}`" aria-expanded="false" :aria-controls="`subCollapseMenu-${mIndex}-${index}`" @click="findMenuByName(menu.name)">
                        <span v-if="menu.icon" class="nav-icon"><i :class="menu.icon"></i></span><span class="sidebar-txt">{{ $t(menu.name) }}</span>
                      </a>
                    </template>
                  </template>
                  <ul v-click-outside="closeToggleMenu" class="sidebar-dropdown-menu collapse" :class="[horizontalMenuEnabled ? 'dropdown-menu' : '', openedMenu === menu.name ? 'd-block' : '', (layoutPosition === 'twoColumn' && index === 1) ? 'show' : '']" :id="[horizontalMenuEnabled ? `subDropDownId-${mIndex}-${index}` : `subCollapseMenu-${mIndex}-${index}`]" :aria-labelledby="[horizontalMenuEnabled ? `parentSubDropdownMenu-${mIndex}-${index}`  : '']">
                    <li v-for="(sub_menu, sIndex) in menu.sub_menus" class="sidebar-dropdown-item">
                      <template v-if="sub_menu.link_name">
                        <router-link :to="{ name: `${sub_menu.link_name}` }" class="sidebar-link" :class="{active : currentRoute === sub_menu.link_name }">
                          <span v-if="sub_menu.icon" class="nav-icon"><i :class="sub_menu.icon"></i></span><span :class="{'sidebar-txt': (currentNavbarSize !== 'small' && layoutPosition !== 'twoColumn')}">{{ sub_menu.name }}</span>
                        </router-link>
                      </template>
                      <template v-else>
                        <router-link to="#" class="sidebar-link" :class="{active : currentRoute === sub_menu.link_name }">
                          <span v-if="sub_menu.icon" class="nav-icon"><i v-if="sub_menu.icon" :class="sub_menu.icon"></i></span> <span :class="{'sidebar-txt': currentNavbarSize !== 'small'}">{{ sub_menu.name }}</span>
                        </router-link>
                      </template>
                      <template v-if="sub_menu.sub_menus">
                        <template v-if="horizontalMenuEnabled">
                          <a role="button" class="sidebar-link has-sub" :id="'parentSubDropdownMenu'+index" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false" @click="findMenuByName(sub_menu.name)">
                            <span v-if="sub_menu.icon" class="nav-icon"><i :class="sub_menu.icon"></i></span> <span class="sidebar-txt">{{ $t(sub_menu.name) }}</span>
                          </a>
                        </template>
                        <template v-else>
                        <a role="button" class="sidebar-link has-sub" data-bs-toggle="collapse" :href="`#subCollapseMenu-${mIndex}-${index}-${sIndex}`" aria-expanded="false" :aria-controls="`subCollapseMenu-${mIndex}-${index}-${sIndex}`" @click="findMenuByName(sub_menu.name)">
                          <span v-if="sub_menu.icon" class="nav-icon"><i :class="sub_menu.icon"></i></span>
                          <span :class="{'sidebar-txt': currentNavbarSize !== 'small'}">{{ sub_menu.name }}</span>
                        </a>
                        </template>
                      </template>
                      <SidebarMenuComponent
                          v-if="sub_menu.sub_menus && sub_menu.sub_menus.length > 0"
                          :horizontalMenuEnabled="horizontalMenuEnabled"
                          :sub_menu="sub_menu"
                          :menuIndexs="`${mIndex}-${index}-${sIndex}`"
                          :currentRoute="currentRoute"
                          :toggleMenu="findMenuByName"
                          :openedMenu="openedMenu"
                          :isCollapsed="isCollapsed"
                          :closeAllDropdownMenu="closeAllDropdownMenu"
                      />
                    </li>
                  </ul>
                </li>
                </template>
              </ul>
            </template>
            </template>
            </template>
            <template v-else-if="sidebar.menu_name === 'Administrator'">
            <template v-if="canViewAdminMenu">
            <template v-if="horizontalMenuEnabled">
              <a role="button" :class="['sidebar-link-group-title', 'has-sub', !horizontalMenuEnabled && 'sidebar-section-header', !horizontalMenuEnabled && 'app-header-gradient']" :id="'parentDropdownMenu'+index" :data-bs-toggle="[horizontalMenuEnabled ? 'dropdown' : '']" data-bs-auto-close="outside" aria-expanded="false">
                {{ $t(sidebar.menu_name) }}
              </a>
            </template>
            <template v-else>
              <a role="button" :class="['sidebar-link-group-title', 'has-sub', !horizontalMenuEnabled && 'sidebar-section-header', !horizontalMenuEnabled && 'app-header-gradient']" data-bs-toggle="collapse" :href="`#collapseExample-${index}`" aria-expanded="false" :aria-controls="'collapseExample-'+index">
                {{ $t(sidebar.menu_name) }}
              </a>
            </template>

            <template v-if="sidebar.menus">
              <ul class="sidebar-link-group" :class="[horizontalMenuEnabled ? 'dropdown-menu' : 'show']" :aria-labelledby="[horizontalMenuEnabled ? 'parentDropdownMenu'+index  : '']" :id="[horizontalMenuEnabled ? 'AppDropDownId'+index : `collapseExample-${index}`]" data-bs-parent="#testAccordionExample">
                <template v-for="(menu, mIndex) in sidebar.menus" :key="`${index}-${mIndex}-${menu.name}`">
                <li v-if="shouldRenderMenuItem(menu)" class="sidebar-dropdown-item">
                  <template v-if="menu.link_name">
                    <router-link
                      :to="{ name: `${menu.link_name}` }"
                      class="sidebar-link"
                      :class="[sidebar.linkClass || '', {active : currentRoute === menu.link_name }]"
                    >
                      <span class="nav-icon"><i :class="menu.icon"></i></span><span class="sidebar-txt">{{ $t(menu.name) }}</span>
                    </router-link>
                  </template>
                  <template v-if="menu.sub_menus">
                    <template v-if="horizontalMenuEnabled">
                    <a role="button" class="sidebar-link has-sub" :id="'parentSubDropdownMenu'+index" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false">
                      <span v-if="menu.icon" class="nav-icon"><i :class="menu.icon"></i></span><span class="sidebar-txt">{{ $t(menu.name) }}</span>
                    </a>
                    </template>
                    <template v-else>
                      <a role="button" class="sidebar-link has-sub" data-bs-toggle="collapse" :href="`#subCollapseMenu-${mIndex}-${index}`" aria-expanded="false" :aria-controls="`subCollapseMenu-${mIndex}-${index}`" @click="findMenuByName(menu.name)">
                        <span v-if="menu.icon" class="nav-icon"><i :class="menu.icon"></i></span><span class="sidebar-txt">{{ $t(menu.name) }}</span>
                      </a>
                    </template>
                  </template>
                  <ul v-click-outside="closeToggleMenu" class="sidebar-dropdown-menu collapse" :class="[horizontalMenuEnabled ? 'dropdown-menu' : '', openedMenu === menu.name ? 'd-block' : '', (layoutPosition === 'twoColumn' && index === 1) ? 'show' : '']" :id="[horizontalMenuEnabled ? `subDropDownId-${mIndex}-${index}` : `subCollapseMenu-${mIndex}-${index}`]" :aria-labelledby="[horizontalMenuEnabled ? `parentSubDropdownMenu-${mIndex}-${index}`  : '']">
                    <li v-for="(sub_menu, sIndex) in menu.sub_menus" class="sidebar-dropdown-item">
                      <template v-if="sub_menu.link_name">
                        <router-link :to="{ name: `${sub_menu.link_name}` }" class="sidebar-link" :class="{active : currentRoute === sub_menu.link_name }">
                          <span v-if="sub_menu.icon" class="nav-icon"><i :class="sub_menu.icon"></i></span><span :class="{'sidebar-txt': (currentNavbarSize !== 'small' && layoutPosition !== 'twoColumn')}">{{ sub_menu.name }}</span>
                        </router-link>
                      </template>
                      <template v-else>
                        <router-link to="#" class="sidebar-link" :class="{active : currentRoute === sub_menu.link_name }">
                          <span v-if="sub_menu.icon" class="nav-icon"><i v-if="sub_menu.icon" :class="sub_menu.icon"></i></span> <span :class="{'sidebar-txt': currentNavbarSize !== 'small'}">{{ sub_menu.name }}</span>
                        </router-link>
                      </template>
                      <template v-if="sub_menu.sub_menus">
                        <template v-if="horizontalMenuEnabled">
                          <a role="button" class="sidebar-link has-sub" :id="'parentSubDropdownMenu'+index" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false" @click="findMenuByName(sub_menu.name)">
                            <span v-if="sub_menu.icon" class="nav-icon"><i :class="sub_menu.icon"></i></span> <span class="sidebar-txt">{{ $t(sub_menu.name) }}</span>
                          </a>
                        </template>
                        <template v-else>
                        <a role="button" class="sidebar-link has-sub" data-bs-toggle="collapse" :href="`#subCollapseMenu-${mIndex}-${index}-${sIndex}`" aria-expanded="false" :aria-controls="`subCollapseMenu-${mIndex}-${index}-${sIndex}`" @click="findMenuByName(sub_menu.name)">
                          <span v-if="sub_menu.icon" class="nav-icon"><i :class="sub_menu.icon"></i></span>
                          <span :class="{'sidebar-txt': currentNavbarSize !== 'small'}">{{ sub_menu.name }}</span>
                        </a>
                        </template>
                      </template>
                      <SidebarMenuComponent
                          v-if="sub_menu.sub_menus && sub_menu.sub_menus.length > 0"
                          :horizontalMenuEnabled="horizontalMenuEnabled"
                          :sub_menu="sub_menu"
                          :menuIndexs="`${mIndex}-${index}-${sIndex}`"
                          :currentRoute="currentRoute"
                          :toggleMenu="findMenuByName"
                          :openedMenu="openedMenu"
                          :isCollapsed="isCollapsed"
                          :closeAllDropdownMenu="closeAllDropdownMenu"
                      />
                    </li>
                  </ul>
                </li>
                </template>
              </ul>
            </template>
            </template>
            </template>
            <template v-else>
            <template v-if="horizontalMenuEnabled">
              <a role="button" :class="['sidebar-link-group-title', 'has-sub', !horizontalMenuEnabled && 'sidebar-section-header', !horizontalMenuEnabled && 'app-header-gradient']" :id="'parentDropdownMenu'+index" :data-bs-toggle="[horizontalMenuEnabled ? 'dropdown' : '']" data-bs-auto-close="outside" aria-expanded="false">
                {{ $t(sidebar.menu_name) }}
              </a>
            </template>
            <template v-else>
              <a role="button" :class="['sidebar-link-group-title', 'has-sub', !horizontalMenuEnabled && 'sidebar-section-header', !horizontalMenuEnabled && 'app-header-gradient']" data-bs-toggle="collapse" :href="`#collapseExample-${index}`" aria-expanded="false" :aria-controls="'collapseExample-'+index">
                {{ $t(sidebar.menu_name) }}
              </a>
            </template>

            <template v-if="sidebar.menus">
              <ul class="sidebar-link-group" :class="[horizontalMenuEnabled ? 'dropdown-menu' : 'show']" :aria-labelledby="[horizontalMenuEnabled ? 'parentDropdownMenu'+index  : '']" :id="[horizontalMenuEnabled ? 'AppDropDownId'+index : `collapseExample-${index}`]" data-bs-parent="#testAccordionExample">
                <template v-for="(menu, mIndex) in sidebar.menus" :key="`${index}-${mIndex}-${menu.name}`">
                <li v-if="shouldRenderMenuItem(menu)" class="sidebar-dropdown-item">
                  <template v-if="menu.link_name">
                    <router-link
                      :to="{ name: `${menu.link_name}` }"
                      class="sidebar-link"
                      :class="[sidebar.linkClass || '', {active : currentRoute === menu.link_name }]"
                    >
                      <span class="nav-icon"><i :class="menu.icon"></i></span><span class="sidebar-txt">{{ $t(menu.name) }}</span>
                    </router-link>
                  </template>
                  <template v-if="menu.sub_menus">
                    <template v-if="horizontalMenuEnabled">
                    <a role="button" class="sidebar-link has-sub" :id="'parentSubDropdownMenu'+index" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false">
                      <span v-if="menu.icon" class="nav-icon"><i :class="menu.icon"></i></span><span class="sidebar-txt">{{ $t(menu.name) }}</span>
                    </a>
                    </template>
                    <template v-else>
                      <a role="button" class="sidebar-link has-sub" data-bs-toggle="collapse" :href="`#subCollapseMenu-${mIndex}-${index}`" aria-expanded="false" :aria-controls="`subCollapseMenu-${mIndex}-${index}`" @click="findMenuByName(menu.name)">
                        <span v-if="menu.icon" class="nav-icon"><i :class="menu.icon"></i></span><span class="sidebar-txt">{{ $t(menu.name) }}</span>
                      </a>
                    </template>
                  </template>
                  <ul v-click-outside="closeToggleMenu" class="sidebar-dropdown-menu collapse" :class="[horizontalMenuEnabled ? 'dropdown-menu' : '', openedMenu === menu.name ? 'd-block' : '', (layoutPosition === 'twoColumn' && index === 1) ? 'show' : '']" :id="[horizontalMenuEnabled ? `subDropDownId-${mIndex}-${index}` : `subCollapseMenu-${mIndex}-${index}`]" :aria-labelledby="[horizontalMenuEnabled ? `parentSubDropdownMenu-${mIndex}-${index}`  : '']">
                    <li v-for="(sub_menu, sIndex) in menu.sub_menus" class="sidebar-dropdown-item">
                      <template v-if="sub_menu.link_name">
                        <router-link :to="{ name: `${sub_menu.link_name}` }" class="sidebar-link" :class="{active : currentRoute === sub_menu.link_name }">
                          <span v-if="sub_menu.icon" class="nav-icon"><i :class="sub_menu.icon"></i></span><span :class="{'sidebar-txt': (currentNavbarSize !== 'small' && layoutPosition !== 'twoColumn')}">{{ sub_menu.name }}</span>
                        </router-link>
                      </template>
                      <template v-else>
                        <router-link to="#" class="sidebar-link" :class="{active : currentRoute === sub_menu.link_name }">
                          <span v-if="sub_menu.icon" class="nav-icon"><i v-if="sub_menu.icon" :class="sub_menu.icon"></i></span> <span :class="{'sidebar-txt': currentNavbarSize !== 'small'}">{{ sub_menu.name }}</span>
                        </router-link>
                      </template>
                      <template v-if="sub_menu.sub_menus">
                        <template v-if="horizontalMenuEnabled">
                          <a role="button" class="sidebar-link has-sub" :id="'parentSubDropdownMenu'+index" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false" @click="findMenuByName(sub_menu.name)">
                            <span v-if="sub_menu.icon" class="nav-icon"><i :class="sub_menu.icon"></i></span> <span class="sidebar-txt">{{ $t(sub_menu.name) }}</span>
                          </a>
                        </template>
                        <template v-else>
                        <a role="button" class="sidebar-link has-sub" data-bs-toggle="collapse" :href="`#subCollapseMenu-${mIndex}-${index}-${sIndex}`" aria-expanded="false" :aria-controls="`subCollapseMenu-${mIndex}-${index}-${sIndex}`" @click="findMenuByName(sub_menu.name)">
                          <span v-if="sub_menu.icon" class="nav-icon"><i :class="sub_menu.icon"></i></span>
                          <span :class="{'sidebar-txt': currentNavbarSize !== 'small'}">{{ sub_menu.name }}</span>
                        </a>
                        </template>
                      </template>
                      <SidebarMenuComponent
                          v-if="sub_menu.sub_menus && sub_menu.sub_menus.length > 0"
                          :horizontalMenuEnabled="horizontalMenuEnabled"
                          :sub_menu="sub_menu"
                          :menuIndexs="`${mIndex}-${index}-${sIndex}`"
                          :currentRoute="currentRoute"
                          :toggleMenu="findMenuByName"
                          :openedMenu="openedMenu"
                          :isCollapsed="isCollapsed"
                          :closeAllDropdownMenu="closeAllDropdownMenu"
                      />
                    </li>
                  </ul>
                </li>
                </template>
              </ul>
            </template>
            </template>
          </li>
<<<<<<< HEAD:VueJSApps/WorkoutAtlas/frontend/src/components/MainSidebarComponent.vue
          <li class="help-center sidebar-highlight-card app-header-gradient">
            <h3>Help Center</h3>
            <p>We're an award-winning, forward thinking</p>
            <a href="#" class="btn btn-sm btn-light">Go to Help Center</a>
          </li>
=======
>>>>>>> origin/0.84-Mobile:VueJSApps/FlexFit/frontend/src/components/MainSidebarComponent.vue
      </div>
    </div>
  </div>
</template>

<style scoped>
<<<<<<< HEAD:VueJSApps/WorkoutAtlas/frontend/src/components/MainSidebarComponent.vue
.sidebar-link.admin-light-gray,
.sidebar-link.admin-light-gray .sidebar-txt,
.sidebar-link.admin-light-gray .nav-icon i {
  color: #797979 !important;
=======
.wa-sidebar-scroll {
  overflow-y: auto;
  max-height: calc(100vh - 88px);
}

.sidebar-link.admin-light-gray,
.sidebar-link.admin-light-gray .sidebar-txt,
.sidebar-link.admin-light-gray .nav-icon i {
  color: #9aabbc !important;
>>>>>>> origin/0.84-Mobile:VueJSApps/FlexFit/frontend/src/components/MainSidebarComponent.vue
}

.sidebar-link.admin-light-gray:hover,
.sidebar-link.admin-light-gray:hover .sidebar-txt,
.sidebar-link.admin-light-gray:hover .nav-icon i {
<<<<<<< HEAD:VueJSApps/WorkoutAtlas/frontend/src/components/MainSidebarComponent.vue
  color: #797979 !important;
=======
  color: #c0d0e0 !important;
}

/* ── WorkoutAtlas dark sidebar — always-on overrides ─────── */

/* Root panel */
.main-sidebar {
  --wa-sidebar-surface: var(--wa-shell-sidebar, #0a0f15);
  --wa-sidebar-surface-elevated: var(--wa-shell-surface, #111821);
  --wa-sidebar-border: var(--wa-shell-border, rgba(255, 255, 255, 0.09));
  --wa-sidebar-divider: var(--wa-shell-divider, rgba(255, 255, 255, 0.09));
  --wa-sidebar-text: var(--wa-shell-text, #f8fafc);
  --wa-sidebar-text-secondary: var(--wa-shell-text-secondary, #a5afbd);
  --wa-sidebar-text-muted: var(--wa-shell-text-muted, #748094);
  --wa-sidebar-accent: var(--wa-shell-accent, var(--main-color, #3b82f6));
  --wa-sidebar-accent-soft: var(--wa-shell-accent-soft, color-mix(in srgb, var(--wa-sidebar-accent) 12%, transparent 88%));
  --wa-sidebar-accent-soft-strong: var(--wa-shell-accent-soft-strong, color-mix(in srgb, var(--wa-sidebar-accent) 20%, transparent 80%));
  background-color: var(--wa-sidebar-surface) !important;
}
.main-sidebar::after {
  background: color-mix(in srgb, var(--wa-sidebar-surface) 97%, transparent 3%) !important;
}

/* All generic containers */
.sidebar-menu,
.main-menu,
.sidebar-link-group,
.sidebar-dropdown-menu {
  background: transparent !important;
}
.sidebar-link-group {
  padding-top: 4px !important;
  padding-bottom: 6px !important;
}

/* Section wrappers — no heavy card borders */
.sidebar-item {
  background: transparent !important;
  border-color: transparent !important;
}

/* Section header titles — compact, distinct from nav links */
.sidebar-link-group-title,
.sidebar-link-group-title.sidebar-section-header,
.sidebar-link-group-title.app-header-gradient {
  background: color-mix(in srgb, var(--wa-sidebar-divider) 46%, transparent 54%) !important;
  background-image: none !important;
  color: var(--wa-sidebar-text-muted) !important;
  border-top: 1px solid var(--wa-sidebar-divider) !important;
  border-bottom: 1px solid var(--wa-sidebar-divider) !important;
  min-height: 32px !important;
  padding: 0 14px !important;
  margin-top: 6px !important;
}

/* Override the CSS-variable-driven gradient used by .sidebar-section-header */
.sidebar-link-group-title.sidebar-section-header {
  --ff-page-header-gradient: transparent !important;
  --ff-page-header-bg: color-mix(in srgb, var(--wa-sidebar-divider) 46%, transparent 54%) !important;
}

/* Section header chevron */
.sidebar-link-group-title::after {
  color: var(--wa-sidebar-text-muted) !important;
  opacity: 1 !important;
}

/* Section header text + icon */
.sidebar-link-group-title .sidebar-txt {
  color: var(--wa-sidebar-text-muted) !important;
  font-size: 11px !important;
  text-transform: uppercase !important;
  letter-spacing: 0.07em !important;
  font-weight: 700 !important;
}
.sidebar-link-group-title .nav-icon i {
  color: var(--wa-sidebar-text-muted) !important;
}

/* Inactive nav links */
.sidebar-link {
  background: transparent !important;
  color: var(--wa-sidebar-text-secondary) !important;
  border-left: 3px solid transparent;
  min-height: 40px;
  padding: 0 12px 0 11px;
}
.sidebar-link .sidebar-txt {
  color: var(--wa-sidebar-text-secondary) !important;
}
.sidebar-link .nav-icon i {
  color: color-mix(in srgb, var(--wa-sidebar-text-secondary) 88%, #ffffff 12%) !important;
}

/* Active nav link */
.sidebar-link.active {
  background: var(--wa-sidebar-accent-soft) !important;
  color: color-mix(in srgb, var(--wa-sidebar-accent) 58%, #ffffff 42%) !important;
  border-left: 3px solid var(--wa-sidebar-accent) !important;
}
.sidebar-link.active .sidebar-txt {
  color: color-mix(in srgb, var(--wa-sidebar-accent) 58%, #ffffff 42%) !important;
  font-weight: 600 !important;
}
.sidebar-link.active .nav-icon i {
  color: color-mix(in srgb, var(--wa-sidebar-accent) 58%, #ffffff 42%) !important;
}
.sidebar-link.active::after {
  background: color-mix(in srgb, var(--wa-sidebar-accent) 66%, #ffffff 34%) !important;
}

/* Hover */
.sidebar-link:hover {
  background: color-mix(in srgb, var(--wa-sidebar-divider) 60%, transparent 40%) !important;
  color: var(--wa-sidebar-text) !important;
  border-left-color: color-mix(in srgb, var(--wa-sidebar-text-muted) 65%, transparent 35%);
}
.sidebar-link:hover .sidebar-txt {
  color: var(--wa-sidebar-text) !important;
}
.sidebar-link:hover .nav-icon i {
  color: color-mix(in srgb, var(--wa-sidebar-text) 82%, var(--wa-sidebar-text-muted) 18%) !important;
}

/* Open/expanded submenu parent */
.sidebar-item.open .sidebar-link.has-sub {
  background: var(--wa-sidebar-accent-soft-strong) !important;
  color: color-mix(in srgb, var(--wa-sidebar-accent) 56%, #ffffff 44%) !important;
  border-left: 3px solid color-mix(in srgb, var(--wa-sidebar-accent) 55%, transparent 45%) !important;
}
.sidebar-item.open .sidebar-link.has-sub .nav-icon i {
  color: color-mix(in srgb, var(--wa-sidebar-accent) 56%, #ffffff 44%) !important;
}

/* Two-column dropdown panel */
.sidebar-dropdown-menu {
  background: var(--wa-sidebar-surface-elevated) !important;
  border-color: var(--wa-sidebar-divider) !important;
}

/* Scrollbar — narrow, dark-themed */
.wa-sidebar-scroll::-webkit-scrollbar {
  width: 4px;
}
.wa-sidebar-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.wa-sidebar-scroll::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--wa-sidebar-divider) 80%, transparent 20%);
  border-radius: 2px;
>>>>>>> origin/0.84-Mobile:VueJSApps/FlexFit/frontend/src/components/MainSidebarComponent.vue
}
</style>