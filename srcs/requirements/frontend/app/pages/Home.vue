<script setup lang="ts">
import { computed } from 'vue';
import { useAuthStore } from '@/stores/authStore';
import { useUiI18n } from '~/composables/useUiI18n';

const { t } = useUiI18n();
const authStore = useAuthStore();

const homeGreeting = computed(() => {
  if (authStore.isAuthenticated && authStore.user?.loginName) {
    return t('nav.helloUser', { name: authStore.user.loginName });
  }
  return t('home.greeting');
});
</script>

<template>
  <div class="home-page">
    <div class="home-hero">
      <div class="hero-background"></div>
      <div class="hero-content">
        <h1 class="hero-title">{{ homeGreeting }}</h1>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-page {
  width: 100%;
  height: 100%;
  min-height: 100%;
  display: flex;
}

.home-hero {
  position: relative;
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 100%;
  overflow: hidden;
  display: grid;
  place-items: center;
  isolation: isolate;
}

.hero-background {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: -1;
  pointer-events: none;
  /* Light mode base */
  background-image:
    linear-gradient(125deg, rgba(230, 240, 245, 0.42) 0%, rgba(242, 247, 252, 0.12) 52%, rgba(215, 230, 244, 0.45) 100%),
    url('/home-bg.jpg');
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
  /* Glossy + blurry look */
  filter:
    brightness(0.92)
    contrast(1.2)
    saturate(1.08)
    blur(4px)
    hue-rotate(8deg);
  transform: scale(1.04);
}

.hero-background::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 18% 16%, rgba(255, 255, 255, 0.52) 0%, rgba(255, 255, 255, 0) 42%),
    radial-gradient(circle at 84% 12%, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0) 36%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.04) 48%, rgba(0, 0, 0, 0.1) 100%);
}

.hero-background::after {
  content: '';
  position: absolute;
  inset: 0;
  backdrop-filter: blur(3px);
  background: rgba(255, 255, 255, 0.06);
}

/* Dark mode: silvery, cooler overlay */
.dark .hero-background {
  background-image:
    linear-gradient(120deg, rgba(172, 188, 206, 0.45) 0%, rgba(188, 204, 222, 0.14) 55%, rgba(155, 170, 188, 0.52) 100%),
    url('/home-bg.jpg');
  filter:
    brightness(0.35)
    contrast(1.45)
    saturate(0.9)
    blur(4px)
    hue-rotate(186deg);
}

.hero-content {
  position: relative;
  z-index: 10;
  width: min(92vw, 52rem);
  padding: 0 1rem;
  text-align: center;
}

.hero-title {
  font-size: clamp(1.75rem, 3.6vw, 2.75rem);
  line-height: 1.15;
  font-weight: 700;
  letter-spacing: 0.01em;
  color: #ffffff;
  margin: 0;
  text-shadow:
    0 8px 28px rgba(0, 0, 0, 0.45),
    0 2px 10px rgba(0, 0, 0, 0.35);
}

.dark .hero-title {
  color: #ffffff;
  text-shadow:
    0 10px 32px rgba(0, 0, 0, 0.6),
    0 3px 12px rgba(0, 0, 0, 0.45);
}

@media (max-width: 768px) {
  .hero-content {
    width: min(94vw, 32rem);
    padding: 0 1rem;
  }

  .hero-title {
    font-size: clamp(1.3rem, 7.2vw, 2rem);
    letter-spacing: 0.008em;
  }
}

</style>

