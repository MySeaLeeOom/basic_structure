<template>
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" :width="size" :height="size" aria-hidden="true">
    <path d="M12 19 Q11 27 10 29 Q16 31 22 29 Q21 27 20 19 Z" fill="#f5e6d3" />
    <path d="M3 17 Q3 6 16 5 Q29 6 29 17 Z" fill="#e03030" />
    <path d="M3 17 Q5 21 16 21 Q27 21 29 17 Z" fill="#f5e6d3" />
    <circle cx="11" cy="11" r="2.2" fill="white" opacity="0.9" class="dot dot-0" />
    <circle cx="20" cy="10" r="2.5" fill="white" opacity="0.9" class="dot dot-1" />
    <circle cx="16" cy="15" r="1.6" fill="white" opacity="0.9" class="dot dot-2" />
    <circle cx="7"  cy="15" r="1.4" fill="white" opacity="0.9" class="dot dot-3" />
    <circle cx="25" cy="14" r="1.5" fill="white" opacity="0.9" class="dot dot-4" />
  </svg>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 64 });
</script>

<style scoped>
/* Each dot is 1 second behind the previous (2π/5 phase offset over 5s period) */
/* .dot {
  transform-box: fill-box;
  transform-origin: center;
  animation: dotPulse 5s ease-in-out infinite;
}
.dot-0 { animation-delay:  0s; }
.dot-1 { animation-delay: -1s; }
.dot-2 { animation-delay: -2s; }
.dot-3 { animation-delay: -3s; }
.dot-4 { animation-delay: -4s; }

@keyframes dotPulse {
  0%   { transform: scale(1.20); }
  25%  { transform: scale(1.45); }
  50%  { transform: scale(1.20); }
  75%  { transform: scale(0.95); }
  100% { transform: scale(1.20); }
} */
/* Mirrors: s = 1.2 + 0.25 * sin(t) → range [0.95, 1.45], starts at 1.2 */
</style>
