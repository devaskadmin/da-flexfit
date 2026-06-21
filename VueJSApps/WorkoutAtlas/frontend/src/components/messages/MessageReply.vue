<script setup>
defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue', 'send'])

const onInput = (event) => {
  emit('update:modelValue', event.target.value)
}

const onSend = () => {
  emit('send')
}
</script>

<template>
  <section class="panel panel-bg reply-box">
    <label class="form-label" for="messageReplyInput">Reply Area</label>
    <textarea
      id="messageReplyInput"
      class="form-control"
      rows="5"
      :value="modelValue"
      placeholder="Type your reply"
      @input="onInput"
    ></textarea>

    <div class="actions">
      <button type="button" class="btn btn-primary btn-sm" :disabled="loading || !modelValue.trim()" @click="onSend">
        {{ loading ? 'Sending...' : 'Send Reply' }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.reply-box {
  border: 1px solid var(--border-color);
  display: grid;
  gap: 10px;
}

.actions {
  display: flex;
  justify-content: flex-end;
}
</style>
