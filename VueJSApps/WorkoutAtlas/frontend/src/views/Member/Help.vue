<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

const goBack = () => {
  router.back()
}
</script>

<template>
  <div class="help-container">
    <div class="help-header">
      <div class="help-title">
        <h1>Help & Support</h1>
        <p>Find answers to common questions and get support</p>
      </div>
    </div>

    <div class="help-content">
      <div class="help-section">
        <h2>Getting Started</h2>
        <div class="help-items">
          <div class="help-item">
            <h3>Dashboard Overview</h3>
            <p>Learn how to navigate the WorkoutAtlas dashboard and access key features.</p>
          </div>
          <div class="help-item">
            <h3>Creating a Workout</h3>
            <p>Step-by-step guide to creating your first workout plan.</p>
          </div>
          <div class="help-item">
            <h3>Nutrition Tracking</h3>
            <p>How to log meals and track your daily nutrition intake.</p>
          </div>
        </div>
      </div>

      <div class="help-section">
        <h2>Account & Settings</h2>
        <div class="help-items">
          <div class="help-item">
            <h3>Profile Management</h3>
            <p>Update your profile information, avatar, and personal details.</p>
          </div>
          <div class="help-item">
            <h3>Privacy & Security</h3>
            <p>Information about data security, password management, and privacy settings.</p>
          </div>
          <div class="help-item">
            <h3>Preferences</h3>
            <p>Customize your app preferences and notification settings.</p>
          </div>
        </div>
      </div>

      <div class="help-section">
        <h2>Troubleshooting</h2>
        <div class="help-items">
          <div class="help-item">
            <h3>Common Issues</h3>
            <p>Solutions to frequently encountered problems.</p>
          </div>
          <div class="help-item">
            <h3>Contact Support</h3>
            <p>Reach out to our support team for additional assistance.</p>
          </div>
        </div>
      </div>
    </div>

    <div class="help-footer">
      <button @click="goBack" class="btn-back">
        <i class="fa-light fa-arrow-left"></i> Back
      </button>
    </div>
  </div>
</template>

<style scoped>
.help-container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
}

.help-header {
  margin-bottom: 40px;
  text-align: center;
  padding: 40px 20px;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(99, 102, 241, 0.1));
  border-radius: 12px;
}

.help-title h1 {
  font-size: 32px;
  font-weight: 700;
  margin: 0 0 8px 0;
}

.help-title p {
  font-size: 16px;
  color: #8b97b2;
  margin: 0;
}

.help-content {
  margin-bottom: 40px;
}

.help-section {
  margin-bottom: 40px;
}

.help-section h2 {
  font-size: 22px;
  font-weight: 600;
  margin-bottom: 20px;
  color: #c8d4f0;
}

.help-items {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
}

.help-item {
  background: rgba(17, 33, 67, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 20px;
  transition: all 0.3s ease;
}

.help-item:hover {
  background: rgba(17, 33, 67, 0.8);
  border-color: rgba(59, 130, 246, 0.3);
  transform: translateY(-2px);
}

.help-item h3 {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: #ffffff;
}

.help-item p {
  font-size: 14px;
  color: #8b97b2;
  margin: 0;
  line-height: 1.5;
}

.help-footer {
  text-align: center;
  padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.btn-back {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 24px;
  background: rgba(59, 130, 246, 0.2);
  border: 1px solid rgba(59, 130, 246, 0.3);
  color: #3b82f6;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-back:hover {
  background: rgba(59, 130, 246, 0.3);
  border-color: rgba(59, 130, 246, 0.5);
}

/* Light theme support */
body.light-theme .help-header {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.05), rgba(99, 102, 241, 0.05));
}

body.light-theme .help-title h1 {
  color: #1a202c;
}

body.light-theme .help-title p {
  color: #718096;
}

body.light-theme .help-section h2 {
  color: #2d3748;
}

body.light-theme .help-item {
  background: rgba(59, 130, 246, 0.03);
  border-color: rgba(59, 130, 246, 0.1);
}

body.light-theme .help-item:hover {
  background: rgba(59, 130, 246, 0.08);
}

body.light-theme .help-item h3 {
  color: #1a202c;
}

body.light-theme .help-item p {
  color: #718096;
}

body.light-theme .help-footer {
  border-color: rgba(0, 0, 0, 0.1);
}

@media (max-width: 768px) {
  .help-container {
    padding: 12px;
  }

  .help-header {
    padding: 24px 12px;
    margin-bottom: 24px;
  }

  .help-title h1 {
    font-size: 24px;
  }

  .help-items {
    grid-template-columns: 1fr;
  }
}
</style>
