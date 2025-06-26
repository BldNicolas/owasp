<template>
  <div v-if="article">
    <h1>{{ article.title }}</h1>
    <p>{{ article.content }}</p>
    <router-link :to="{ name: 'EditArticle', params: { id }}">Edit</router-link>
  </div>
  <p v-else>Loading…</p>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../services/api'

const props = defineProps({
  id: {
    type: String,
    required: true
  }
})

const article = ref(null)

onMounted(async () => {
  try {
    const res = await api.get(`/articles/${props.id}`)
    article.value = res.data
  } catch {
    article.value = null
  }
})
</script>
