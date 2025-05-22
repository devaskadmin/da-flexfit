<script setup>
import { ref } from "vue";

const uploadedFiles = ref([]);
const handleFileUpload = (event) => {
  const files = event.target.files;
  for (let i = 0; i < files.length; i++) {
    uploadedFiles.value.push({
      name: files[i].name,
      size: (files[i].size / 1024).toFixed(2) + " KB",
      type: files[i].type,
    });
  }
};
</script>

<template>
  <div class="panel">
    <div class="panel-header">
      <h5>Upload Pictures</h5>
      <div class="btn-box">
        <label for="file-upload" class="btn btn-sm btn-primary">Upload</label>
        <input
          type="file"
          id="file-upload"
          accept="image/*"
          multiple
          @change="handleFileUpload"
          style="display: none"
        />
      </div>
    </div>
    <div class="panel-body">
      <div v-if="uploadedFiles.length === 0" class="text-muted">
        No pictures uploaded yet.
      </div>
      <ul v-else class="list-group">
        <li v-for="(file, index) in uploadedFiles" :key="index" class="list-group-item">
          <strong>{{ file.name }}</strong> - {{ file.size }} - {{ file.type }}
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.panel {
  border: 1px solid #ddd;
  border-radius: 5px;
  padding: 20px;
}

.list-group-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  border: 1px solid #f0f0f0;
  border-radius: 4px;
  margin-bottom: 5px;
}
</style>
