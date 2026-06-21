<script setup>
import {onMounted, ref} from "vue";

import EcommarceStatsComponent from "@/components/template/ecommerce-dashboard/EcommarceStatsComponent.vue";
import SalesAnalyticsChartComponent from "@/components/template/ecommerce-dashboard/SalesAnalyticsChartComponent.vue";
import SocialMediaVisitorComponent from "@/components/template/ecommerce-dashboard/SocialMediaVisitorComponent.vue";
import NewCustomersComponent from "@/components/template/ecommerce-dashboard/NewCustomersComponent.vue";
import RecentOrdersComponent from "@/components/template/ecommerce-dashboard/RecentOrdersComponent.vue";
import DateRangePicker from "@/components/template/DateRangePicker.vue";

onMounted(() => {

})
</script>

<template>
  <div class="dashboard-breadcrumb mb-25">
    <h2>{{ $t('dashboard.ecommerce_dashboard') }}</h2>
    <DateRangePicker />
  </div>
  <EcommarceStatsComponent />
  <div class="row">
    <SalesAnalyticsChartComponent />
    <SocialMediaVisitorComponent />
    <NewCustomersComponent />
    <RecentOrdersComponent />
  </div>
</template>

<style scoped>
</style>