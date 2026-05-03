<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import Stats from "stats.js";

const hostRef = ref<HTMLElement | null>(null);
let animationFrameId: number | null = null;
let stats: Stats | null = null;

function stop(): void {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

onMounted(() => {
  const host = hostRef.value;
  if (!host) {
    return;
  }

  stats = new Stats();
  stats.showPanel(0);
  Object.assign(stats.dom.style, {
    cursor: "default",
    left: "auto",
    opacity: "1",
    pointerEvents: "none",
    position: "relative",
    top: "auto",
    zIndex: "auto",
  });
  host.replaceChildren(stats.dom);

  const update = () => {
    stats?.update();
    animationFrameId = requestAnimationFrame(update);
  };

  animationFrameId = requestAnimationFrame(update);
});

onBeforeUnmount(() => {
  stop();
  stats?.dom.remove();
  stats = null;
});
</script>

<template>
  <div
    ref="hostRef"
    class="fps-meter-panel"
    data-fps-meter
    role="img"
    aria-label="FPS monitor"
  ></div>
</template>

<style scoped>
.fps-meter-panel {
  display: grid;
  place-items: center;
  overflow: hidden;
  inline-size: 80px;
  block-size: 48px;
  border-radius: 6px;
  background: #020617;
  pointer-events: none;
}

.fps-meter-panel :deep(div) {
  overflow: hidden;
  border-radius: 6px;
}

.fps-meter-panel :deep(canvas) {
  display: block;
}
</style>
