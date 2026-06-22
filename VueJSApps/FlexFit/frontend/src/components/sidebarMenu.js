import {ref} from "vue";

export const sidebarMenus = ref([
    {
        menu_name: 'sidebar.dashboard',
        menus: [
            {
                name: 'Home',
                link_name: 'dashboard_index',
                icon: 'fa-solid fa-house'              
            },
            {
                name: 'Workout Builder',
                link_name: 'workout_builder',
                icon: 'fa-solid fa-dumbbell'
            },
            {
                name: 'Workout Log',
                link_name: 'workouts',
                icon: 'fa-solid fa-list-check',
                requiresWorkoutLists: true
            },
            {
                name: 'Exercises Database',
                link_name: 'exercises',
                icon: 'fa-solid fa-database'
            },
            {
                name: 'Nutrition',
                link_name: 'Nutrition',
                icon: 'fa-solid fa-utensils'
            },
            {
                name: 'Settings',
                link_name: 'user_settings',
                icon: 'fa-solid fa-gear'
            },
            {
                name: 'Logout',
                link_name: 'logout',
                icon: 'fa-light fa-calendar'
            },
        ]
    },
    {
        menu_name: 'Trainer',
        menus: [
            {
                name: 'Chat with Trainer',
                link_name: 'dashboard_index',
                icon: 'fa-regular fa-message'
            },
        ]
    },
    {
        menu_name: 'Administrator',
        linkClass: 'admin-light-gray',
        menus: [
            {
                name: 'View Progress',
                link_name: 'progress_stats',
                icon: 'fa-solid fa-chart-line'
            },
            {
                name: 'Upload Picture',
                link_name: 'dashboard_index',
                icon: 'fa-solid fa-images'
            },
            {
                name: 'Scheduling',
                link_name: 'calendar',
                icon: 'fa-light fa-calendar'
            },
            {
                name: 'Users',
                link_name: 'admin_users',
                icon: 'fa-solid fa-users'
            },
            {
                name: 'Roles',
                link_name: 'admin_roles',
                icon: 'fa-solid fa-id-badge'
            },
            {
                name: 'Test Roles',
                link_name: 'admin_test_roles',
                icon: 'fa-solid fa-vial-circle-check'
            },
            {
                name: 'Tools',
                link_name: 'admin_tools',
                icon: 'fa-solid fa-toolbox'
            },
        ]
    },
    
])