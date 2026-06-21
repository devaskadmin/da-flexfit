<script setup>
const upcomingActivities = [
  { name: "Yoga Class", date: "Nov 26", time: "10:00 AM - 11:00 AM" },
  { name: "HIIT Session", date: "Nov 27", time: "6:00 PM - 7:00 PM" },
  { name: "Personal Training", date: "Nov 28", time: "8:00 AM - 9:00 AM" },
  { name: "Nutrition Workshop", date: "Dec 1", time: "12:00 PM - 1:30 PM" },
];
</script>

<template>
  <div class="panel">
    <div class="panel-header">
      <h5>Upcoming Activities</h5>
      <div class="btn-box">
        <a href="#" class="btn btn-sm btn-primary">View All</a>
      </div>
    </div>
    <div class="panel-body">
      <div class="table-responsive">
        <table class="table table-hover table-activity">
          <tbody>
            <tr v-for="(activity, index) in upcomingActivities" :key="index">
              <td>
                <div class="activity-box">
                  <div class="date-box">
                    <span>{{ new Date(activity.date).getDate() }}</span>
                    <span>{{ new Date(activity.date).toLocaleString('default', { month: 'short' }) }}</span>
                  </div>
                  <div class="part-txt">
                    <span>{{ activity.name }}</span>
                    <span>{{ activity.time }}</span>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
