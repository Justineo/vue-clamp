<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { Check, Copy, X } from "@lucide/vue";

const props = withDefaults(
  defineProps<{
    code: string;
    html?: string | null;
    label: string;
    embedded?: boolean;
    blockId?: string;
  }>(),
  {
    embedded: false,
    html: null,
  },
);

type CopyState = "idle" | "copied" | "failed";

const copyState = ref<CopyState>("idle");
let resetTimer: number | undefined;

const buttonLabel = computed(() => {
  if (copyState.value === "copied") {
    return "Copied";
  }

  if (copyState.value === "failed") {
    return "Failed";
  }

  return "Copy";
});

const buttonTitle = computed(() => {
  if (copyState.value === "copied") {
    return `${props.label} copied`;
  }

  if (copyState.value === "failed") {
    return `Unable to copy ${props.label.toLowerCase()}`;
  }

  return `Copy ${props.label.toLowerCase()}`;
});

function scheduleReset(): void {
  if (resetTimer) {
    window.clearTimeout(resetTimer);
  }

  resetTimer = window.setTimeout(() => {
    copyState.value = "idle";
    resetTimer = undefined;
  }, 1800);
}

function copyWithFallback(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "absolute";
  textarea.style.left = "-99999px";
  document.body.append(textarea);
  textarea.select();

  try {
    return document.execCommand("copy");
  } finally {
    textarea.remove();
  }
}

async function copyCode(): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(props.code);
    } else if (!copyWithFallback(props.code)) {
      throw new Error("copy failed");
    }

    copyState.value = "copied";
  } catch {
    copyState.value = "failed";
  }

  scheduleReset();
}

onBeforeUnmount(() => {
  if (resetTimer) {
    window.clearTimeout(resetTimer);
  }
});
</script>

<template>
  <div class="code-wrap" :class="{ embedded }" :data-code-block="blockId">
    <button
      class="copy-button"
      type="button"
      :data-copy-button="blockId ?? 'code'"
      :data-copy-state="copyState"
      :aria-label="buttonTitle"
      :title="buttonTitle"
      @click="copyCode"
    >
      <Copy v-if="copyState === 'idle'" class="copy-icon" :size="14" aria-hidden="true" />
      <Check v-else-if="copyState === 'copied'" class="copy-icon" :size="14" aria-hidden="true" />
      <X v-else class="copy-icon" :size="14" aria-hidden="true" />
      <span class="sr-only">{{ buttonLabel }}</span>
    </button>
    <div v-if="html" class="shiki-wrap" v-html="html" />
    <pre v-else class="code-block"><code>{{ code }}</code></pre>
  </div>
</template>

<style scoped>
.code-wrap {
  position: relative;
}

.copy-button {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  line-height: 0;
  color: var(--c-text-2);
  background: color-mix(in srgb, var(--c-bg) 88%, transparent);
  border: 1px solid var(--c-border);
  border-radius: 6px;
  backdrop-filter: blur(10px);
  cursor: pointer;
  transition:
    border-color 0.15s,
    color 0.15s,
    background 0.15s;
}

.copy-button:hover {
  color: var(--c-text);
  border-color: var(--c-border-dark);
}

.copy-button:focus-visible {
  outline: none;
  border-color: var(--c-accent);
  color: var(--c-accent-text);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--c-accent) 18%, transparent);
}

.copy-button[data-copy-state="copied"] {
  color: var(--c-accent-text);
  border-color: color-mix(in srgb, var(--c-accent) 45%, var(--c-border));
  background: color-mix(in srgb, var(--c-accent-soft) 78%, var(--c-bg));
}

.copy-button[data-copy-state="failed"] {
  color: #b42318;
  border-color: color-mix(in srgb, #b42318 35%, var(--c-border));
  background: color-mix(in srgb, #b42318 10%, var(--c-bg));
}

.copy-icon {
  width: 14px;
  height: 14px;
  flex: none;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.code-block {
  margin: 0;
  padding: 14px 16px;
  font-size: 0.84rem;
  font-family: var(--font-mono);
  line-height: 1.65;
  background: var(--c-bg-soft);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  overflow-x: auto;
  color: var(--c-text);
}

.code-block code {
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  background: none;
  padding: 0;
  color: inherit;
}

.shiki-wrap :deep(pre.shiki) {
  margin: 0;
  padding: 14px 16px;
  font-size: 0.84rem;
  font-family: var(--font-mono);
  line-height: 1.65;
  background: var(--c-bg-soft) !important;
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  overflow-x: auto;
}

.shiki-wrap :deep(pre.shiki code) {
  font-family: inherit;
  font-size: inherit;
  background: none;
  padding: 0;
  color: inherit;
}

.embedded .code-block,
.embedded .shiki-wrap :deep(pre.shiki) {
  border: none;
  border-radius: 0;
}

.embedded .copy-button {
  top: 8px;
  right: 8px;
}
</style>
