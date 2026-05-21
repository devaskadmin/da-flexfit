<script setup>
import { ref } from "vue";
import vueApexcharts from "vue3-apexcharts";


const balanceOverviewSeries = ref([
  {
    name: "Stock",
    color: "#0D99FF",
    data: [31, 40, 28, 51, 42, 109, 100, 40, 28, 51, 42, 109],
  },
  {
    name: "Order",
    color: "#a9b4cc",
    data: [11, 32, 45, 32, 34, 52, 41, 32, 45, 32, 34, 52],
  },
]);

const balanceOverviewOptions = ref({
  chart: {
    height: 360, // Adjusted height for better fit
    type: "bar",
    stacked: true,
    toolbar: {
      show: false,
    },
  },
  dataLabels: {
    enabled: false,
  },
  stroke: {
    width: 0,
    curve: "smooth",
  },
  xaxis: {
    fill: "#FFFFFF",
    type: "datetime",
    categories: [
      "2022-12-19T00:00:00.000Z",
      "2022-12-20T00:00:00.000Z",
      "2022-12-21T00:00:00.000Z",
      "2022-12-22T00:00:00.000Z",
      "2022-12-23T00:00:00.000Z",
      "2022-12-24T00:00:00.000Z",
      "2022-12-25T00:00:00.000Z",
      "2022-12-26T00:00:00.000Z",
      "2022-12-27T00:00:00.000Z",
      "2022-12-28T00:00:00.000Z",
      "2022-12-29T00:00:00.000Z",
      "2022-12-30T00:00:00.000Z",
    ],
    labels: {
      datetimeFormatter: {
        month: "MMMM",
      },
    },
    axisBorder: {
      show: false,
    },
    axisTicks: {
      show: false,
    },
  },
  grid: {
    borderColor: "#334652",
    strokeDashArray: 3,
    xaxis: {
      lines: {
        show: true,
      },
    },
    padding: {
      bottom: 15,
    },
  },
  responsive: [
    {
      breakpoint: 1199,
      options: {
        chart: {
          height: 340,
        },
      },
    },
    {
      breakpoint: 991,
      options: {
        chart: {
          height: 300,
        },
      },
    },
    {
      breakpoint: 479,
      options: {
        chart: {
          height: 250,
        },
      },
    },
  ],
});
</script>

<template>
  <div class="panel chart-panel-1">
    <div class="panel-header d-flex justify-content-between align-items-center">
      <h5>Workouts Logged</h5>
      <div class="btn-box">
        <button class="btn btn-sm btn-outline-primary">Week</button>
        <button class="btn btn-sm btn-outline-primary">Month</button>
        <button class="btn btn-sm btn-outline-primary">Year</button>
      </div>
    </div>
    <div class="panel-body">
      <vueApexcharts
        type="bar"
        height="360"
        :options="balanceOverviewOptions"
        :series="balanceOverviewSeries"
      ></vueApexcharts>
    </div>
  </div>
</template>

<style scoped>
.panel {
  margin-bottom: 4px;
}

/* Compact Week/Month/Year buttons on mobile */
@media (max-width: 768px) {
  .panel-header {
    padding: 6px 8px;
  }

  .panel-body {
    padding: 5px 6px;
  }

  .btn-box {
    display: flex;
    gap: 4px;
  }

  .btn-box .btn {
    height: 26px;
    padding: 1px 7px;
    font-size: 0.7rem;
    line-height: 1.2;
  }
}

@media (max-width: 480px) {
  .panel-header {
    padding: 5px 6px;
  }

  .panel-body {
    padding: 4px 5px;
  }

  .btn-box .btn {
    height: 24px;
    padding: 1px 5px;
    font-size: 0.66rem;
  }
}

@media (max-width: 430px) {
  .btn-box .btn {
    height: 23px;
    padding: 0px 4px;
    font-size: 0.62rem;
  }
}

@media (max-width: 390px) {
  .panel-header {
    padding: 3px 5px;
  }

  .panel-body {
    padding: 3px 4px;
  }

  .btn-box .btn {
    height: 21px;
    padding: 0px 3px;
    font-size: 0.58rem;
  }
}
</style>
