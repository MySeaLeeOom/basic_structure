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
      <div class="hero-background" />
      <div class="hero-content">
        <h1 class="hero-title">{{ homeGreeting }}</h1>

        <div class="reactive-stack">
          <article class="reactive-card reactive-card--definition">
            <h2 class="card-title">{{ t('home.definition.word') }}</h2>
            <p class="card-ipa">{{ t('home.definition.ipa') }}</p>
            <p class="card-copy">{{ t('home.definition.meaning') }}</p>
            <p class="card-copy">{{ t('home.definition.metaphor') }}</p>
          </article>

          <article class="reactive-card reactive-card--welcome">
            <h3 class="card-header">{{ t('home.welcome.title') }}</h3>
            <p class="card-copy">{{ t('home.welcome.body') }}</p>
          </article>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-page {
  width: 100%;
  height: 100%;
  display: flex;
}

.home-hero {
  position: relative;
  flex: 1;
  width: 100%;
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
  background-image:
    linear-gradient(125deg, rgba(230, 240, 245, 0.42) 0%, rgba(242, 247, 252, 0.12) 52%, rgba(215, 230, 244, 0.45) 100%),
    url('/home-bg.jpg');
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
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

.hero-content {
  position: relative;
  z-index: 10;
  width: min(94vw, 64rem);
  padding: 0 1rem;
  text-align: center;
  transform: translateY(-7vh);
}

.hero-title {
  font-size: clamp(1.9rem, 4.2vw, 3rem);
  line-height: 1.15;
  font-weight: 700;
  letter-spacing: 0.01em;
  color: #ffffff;
  margin: 0 0 1.4rem;
  text-shadow:
    0 8px 28px rgba(0, 0, 0, 0.45),
    0 2px 10px rgba(0, 0, 0, 0.35);
}

.reactive-stack {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
  gap: 1.2rem;
  width: 100%;
}

.reactive-card {
  position: relative;
  overflow: hidden;
  text-align: start;
  color: rgba(244, 249, 255, 0.95);
  border: 1px solid rgba(209, 231, 255, 0.36);
  background:
    linear-gradient(132deg, rgba(216, 236, 255, 0.26), rgba(179, 212, 243, 0.12));
  backdrop-filter: blur(16px) saturate(135%);
  box-shadow:
    0 18px 40px rgba(2, 14, 26, 0.33),
    inset 0 1px 0 rgba(255, 255, 255, 0.45);
  border-radius: 18px;
  animation: cardFloat 9s ease-in-out infinite;
  transition: transform 220ms ease, box-shadow 220ms ease;
}

.reactive-card::before {
  content: '';
  position: absolute;
  inset: -15% -20% auto auto;
  width: 65%;
  height: 75%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0) 68%);
  transform: rotate(15deg);
  pointer-events: none;
  animation: sheenDrift 12s linear infinite;
}

.reactive-card:hover {
  transform: translateY(-4px);
  box-shadow:
    0 24px 48px rgba(2, 14, 26, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.55);
}

.reactive-card--definition {
  padding: 1.35rem 1.5rem;
  animation-delay: -1.2s;
}

.reactive-card--welcome {
  padding: 1.2rem 1.4rem;
  animation-delay: -4.2s;
}

.card-title {
  margin: 0;
  font-size: clamp(1.35rem, 3vw, 1.9rem);
  line-height: 1.15;
  letter-spacing: 0.01em;
  color: #ffffff;
  text-transform: lowercase;
}

.card-ipa {
  margin: 0.2rem 0 0.8rem;
  font-size: 0.95rem;
  color: rgba(221, 239, 255, 0.92);
}

.card-header {
  margin: 0 0 0.65rem;
  font-size: clamp(1.1rem, 2.6vw, 1.45rem);
  color: #ffffff;
}

.card-copy {
  margin: 0.45rem 0 0;
  line-height: 1.5;
  color: rgba(233, 245, 255, 0.95);
}

@media (max-width: 768px) {
  .hero-content {
    width: min(94vw, 32rem);
    padding: 0 1rem;
    transform: translateY(-4vh);
  }

  .hero-title {
    font-size: clamp(1.3rem, 7.2vw, 2rem);
    letter-spacing: 0.008em;
    margin-bottom: 1rem;
  }

  .reactive-card {
    border-radius: 14px;
  }

  .reactive-card--definition,
  .reactive-card--welcome {
    padding: 1rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .reactive-card,
  .reactive-card::before {
    animation: none;
  }
}

@keyframes cardFloat {
  0%,
  100% {
    translate: 0 0;
  }
  50% {
    translate: 0 -5px;
  }
}

@keyframes sheenDrift {
  0% {
    transform: rotate(15deg) translateX(0);
  }
  50% {
    transform: rotate(15deg) translateX(-10%);
  }
  100% {
    transform: rotate(15deg) translateX(0);
  }
}
</style>

<!-- Unscoped: dark-mode overrides need to reach .dark on <html> -->
<style>
.dark .home-page .hero-background {
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

.dark .home-page .hero-title {
  color: #ffffff;
  text-shadow:
    0 10px 32px rgba(0, 0, 0, 0.6),
    0 3px 12px rgba(0, 0, 0, 0.45);
}

.dark .home-page .reactive-card {
  border-color: rgba(176, 208, 238, 0.3);
  background:
    linear-gradient(132deg, rgba(36, 58, 82, 0.42), rgba(20, 33, 50, 0.28));
}
</style>
