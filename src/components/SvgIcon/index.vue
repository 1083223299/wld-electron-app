<script setup>
import { computed } from 'vue';

const props = defineProps({
  iconClass: { type: String, required: true },
  className: { type: String, default: '' },
});

const isExt = computed(() => /^https?:\/\//.test(props.iconClass));
const iconName = computed(() => `#icon-${props.iconClass}`);
const svgClass = computed(() => (props.className ? `svg-icon ${props.className}` : 'svg-icon'));
const styleExternalIcon = computed(() => ({
  mask: `url(${props.iconClass}) no-repeat 50% 50%`,
  '-webkit-mask': `url(${props.iconClass}) no-repeat 50% 50%`,
}));
</script>

<template>
  <div v-if="isExt" :style="styleExternalIcon" class="svg-external-icon svg-icon" />
  <svg v-else :class="svgClass" aria-hidden="true">
    <use :xlink:href="iconName" />
  </svg>
</template>

<style scoped>
.svg-icon {
  width: 1.6em;
  height: 1.6em;
  fill: currentColor;
  overflow: hidden;
}

.svg-external-icon {
  background-color: currentColor;
  mask-size: cover !important;
  display: inline-block;
}
</style>
