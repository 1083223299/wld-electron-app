<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import AppTopbar from '../../components/AppTopbar.vue';

const route = useRoute();
const currentTitle = computed(() => route.meta?.title || '工作台');
</script>

<template>
  <AppTopbar :title="currentTitle" />
</template>
