<script setup>
import {onMounted, ref} from "vue";
import CrmStatsComponent from "@/components/template/crm-dashboard/CrmStatsComponent.vue";
import BalanceOverviewChartComponent from "@/components/template/crm-dashboard/BalanceOverviewChartComponent.vue";
import RecentProjectsComponent from "@/components/template/crm-dashboard/RecentProjectsComponent.vue";
import UpcomingActivitiesComponent from "@/components/template/crm-dashboard/UpcomingActivitiesComponent.vue";
import PendingWorksComponent from "@/components/template/crm-dashboard/PendingWorksComponent.vue";
import InvoicesComponent from "@/components/template/crm-dashboard/InvoicesComponent.vue";
import MyTasksComponent from "@/components/template/crm-dashboard/MyTasksComponent.vue";
import CrmNoticeBoardComponent from "@/components/template/crm-dashboard/CrmNoticeBoardComponent.vue";
import WorksDeadlinesComponent from "@/components/template/crm-dashboard/WorksDeadlinesComponent.vue";
import DateRangePicker from "@/components/template/DateRangePicker.vue";

onMounted(() => {
})
</script>

<template>
  <div class="dashboard-breadcrumb mb-25">
    <h2>{{ $t('dashboard.crm_dashboard') }}</h2>
    <DateRangePicker />
  </div>
  <CrmStatsComponent />
  <div class="row">
    <BalanceOverviewChartComponent />
    <RecentProjectsComponent />
    <UpcomingActivitiesComponent />
    <PendingWorksComponent />
    <InvoicesComponent />
    <MyTasksComponent />
    <CrmNoticeBoardComponent />
    <WorksDeadlinesComponent />
  </div>
</template>

<style scoped>

</style>