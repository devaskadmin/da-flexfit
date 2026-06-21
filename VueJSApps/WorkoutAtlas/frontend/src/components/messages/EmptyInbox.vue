<template>
  <div class="empty-inbox panel panel-bg">
    <div class="empty-icon" aria-hidden="true">
      <i class="fa-light fa-inbox"></i>
    </div>
    <h5>No messages found.</h5>
    <p>Messages from your trainer and administrators will appear here.</p>
  </div>
</template>

<style scoped>
.empty-inbox {
  display: grid;
  place-items: center;
  text-align: center;
  gap: 10px;
  padding: 32px 20px;
  border: 1px dashed var(--border-color);
}

.empty-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 1.4rem;
  color: var(--text-color-secondary);
  border: 1px solid var(--border-color);
  background: var(--main-color);
}

h5 {
  margin: 0;
  color: var(--text-color);
}

p {
  margin: 0;
  color: var(--text-color-secondary);
  max-width: 460px;
}
</style>
