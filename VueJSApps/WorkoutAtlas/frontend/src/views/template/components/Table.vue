<script setup>
import {onMounted, ref} from "vue";
import DashboardBreadcrumb from "@/components/template/DashboardBreadcrumb.vue";
import DefaultTableComponent from "@/components/template/tables/DefaultTableComponent.vue";
import StripedRowsTableComponent from "@/components/template/tables/StripedRowsTableComponent.vue";
import StripedColumnsTableComponent from "@/components/template/tables/StripedColumnsTableComponent.vue";
import ColorsTableComponent from "@/components/template/tables/ColorsTableComponent.vue";
import HoverableTableComponent from "@/components/template/tables/HoverableTableComponent.vue";
import BorderedTableComponent from "@/components/template/tables/BorderedTableComponent.vue";
import BorderColorTableComponent from "@/components/template/tables/BorderColorTableComponent.vue";
import WithoutBordersTableComponent from "@/components/template/tables/WithoutBordersTableComponent.vue";
import DefaultDataTableComponent from "@/components/template/tables/DefaultDataTableComponent.vue";
import DataTableBodyScrollComponent from "@/components/template/tables/DataTableBodyScrollComponent.vue";
import CustomizedDataTableComponent from "@/components/template/tables/CustomizedDataTableComponent.vue";

onMounted(() => {
})
</script>

<template>
<DashboardBreadcrumb>
  <template #title>Tables</template>
</DashboardBreadcrumb>
  <div class="row">
    <div class="col-12">
      <div class="panel">
        <div class="panel-header">
          <h5>Basic Tables</h5>
        </div>
        <div class="panel-body">
          <div class="row g-3">
            <DefaultTableComponent />
            <StripedRowsTableComponent />
            <StripedColumnsTableComponent />
            <ColorsTableComponent />
            <HoverableTableComponent />
            <BorderedTableComponent />
            <BorderColorTableComponent />
            <WithoutBordersTableComponent />
          </div>
        </div>
      </div>
    </div>
    <div class="col-12">
      <div class="panel">
        <div class="panel-header">
          <h5>Data Tables</h5>
        </div>
        <div class="panel-body">
          <div class="row g-3">
            <DefaultDataTableComponent />
            <DataTableBodyScrollComponent />
            <CustomizedDataTableComponent />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>

</style>