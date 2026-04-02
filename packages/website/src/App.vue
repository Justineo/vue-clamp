<script setup lang="ts">
import { computed, ref } from "vue";
import { Clamp } from "vue-clamp";
import { createHighlighterCoreSync } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import vue from "shiki/langs/vue.mjs";
import shellscript from "shiki/langs/shellscript.mjs";
import css from "shiki/langs/css.mjs";
import html from "shiki/langs/html.mjs";
import js from "shiki/langs/javascript.mjs";
import ts from "shiki/langs/typescript.mjs";
import vitesseDark from "shiki/themes/vitesse-dark.mjs";
import vitesseLight from "shiki/themes/vitesse-light.mjs";

const shiki = createHighlighterCoreSync({
  themes: [vitesseLight, vitesseDark],
  langs: [vue, shellscript, css, html, js, ts],
  engine: createJavaScriptRegexEngine(),
});

const text =
  "Vue (pronounced /vju\u02D0/, like view) is a progressive framework for building user interfaces. Unlike other monolithic frameworks, Vue is designed from the ground up to be incrementally adoptable. The core library is focused on the view layer only, and is easy to pick up and integrate with other libraries or existing projects. On the other hand, Vue is also perfectly capable of powering sophisticated Single-Page Applications when used in combination with modern tooling and supporting libraries.";

// Demo 1: max-lines + after slot toggle
const lines1 = ref(3);
const width1 = ref(480);
const hyphens1 = ref(false);
const rtl1 = ref(false);

// Demo 2: max-height + before slot + external expanded
const height2 = ref("calc(48px + 12em)");
const width2 = ref(480);
const hyphens2 = ref(false);
const rtl2 = ref(false);
const expanded2 = ref(false);

// Demo 3: clampchange event
const lines3 = ref(5);
const width3 = ref(480);
const hyphens3 = ref(false);
const rtl3 = ref(false);
const clamped3 = ref(false);

// Demo 4: ellipsis + location
const lines4 = ref(5);
const width4 = ref(480);
const hyphens4 = ref(false);
const rtl4 = ref(false);
const ellipsis4 = ref("\u2026");
const location4 = ref<"start" | "middle" | "end">("end");

type PkgManager = "vp" | "npm" | "pnpm" | "yarn" | "agent";

const pkgManager = ref<PkgManager>("npm");

const pkgManagers: { id: PkgManager; label: string }[] = [
  { id: "vp", label: "vp" },
  { id: "npm", label: "npm" },
  { id: "pnpm", label: "pnpm" },
  { id: "yarn", label: "yarn" },
  { id: "agent", label: "agent" },
];

const installCommand = computed(() => {
  switch (pkgManager.value) {
    case "vp":
      return "vp add vue-clamp";
    case "npm":
      return "npm install vue-clamp";
    case "pnpm":
      return "pnpm add vue-clamp";
    case "yarn":
      return "yarn add vue-clamp";
    case "agent":
      return "Install the vue-clamp package into this project";
  }
});

const codeExample = [
  "<script setup>",
  "import { Clamp } from 'vue-clamp'",
  "",
  "const text = 'Some very very long text content.'",
  "<" + "/script>",
  "",
  "<template>",
  '  <Clamp autoresize :max-lines="3" :text="text" />',
  "</template>",
].join("\n");

const highlightedInstall = computed(() => {
  if (pkgManager.value === "agent") {
    return null;
  }
  return shiki.codeToHtml(installCommand.value, {
    lang: "shellscript",
    theme: "vitesse-light",
  });
});

const highlightedCode = computed(() => {
  return shiki.codeToHtml(codeExample, {
    lang: "vue",
    theme: "vitesse-light",
  });
});
</script>

<template>
  <div class="page">
    <!-- Hero -->
    <header class="hero">
      <h1 class="hero-title">&lt;vue-clamp&gt;</h1>
      <p class="hero-tagline">Clamping multiline text with ease.</p>
      <nav class="hero-links">
        <a
          class="link-github"
          href="https://github.com/Justineo/vue-clamp"
          target="_blank"
          rel="noopener"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path
              d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
            />
          </svg>
          GitHub
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            aria-hidden="true"
          >
            <path d="M3.5 1.5h7v7M10.5 1.5L1.5 10.5" />
          </svg>
        </a>
      </nav>
    </header>

    <!-- Features -->
    <section class="section">
      <h2 class="section-title" id="features"><a href="#features">#</a> Features</h2>
      <ul class="features-list">
        <li>Clamps text with max lines and/or max height. No need to specify line height.</li>
        <li>Automatically updates upon layout change.</li>
        <li>The clamped text can be expanded/collapsed.</li>
        <li>Customizable and responsive content before/after clamped text.</li>
        <li>Place ellipsis at the end, middle, or the start of the clamped text.</li>
      </ul>
    </section>

    <!-- Demos -->
    <section class="section">
      <h2 class="section-title" id="demo"><a href="#demo">#</a> Demo</h2>

      <!-- Demo 1: max-lines + after slot toggle -->
      <div class="demo-block">
        <div class="demo-label">max-lines / slot <code>after</code> / toggle</div>
        <div class="demo-controls">
          <label class="control">
            <span class="control-label">Max lines</span>
            <input
              v-model.number="lines1"
              class="control-input"
              type="number"
              min="1"
              max="8"
              step="1"
            />
          </label>
          <label class="control">
            <span class="control-label">Width</span>
            <span class="control-row">
              <input
                v-model.number="width1"
                data-testid="demo-1-width"
                class="control-range"
                type="range"
                min="240"
                max="600"
              />
              <span class="control-value">{{ width1 }}px</span>
            </span>
          </label>
          <div class="control-row">
            <label class="control-check">
              <input v-model="hyphens1" type="checkbox" />
              <span>CSS Hyphens</span>
            </label>
            <label class="control-check">
              <input v-model="rtl1" type="checkbox" />
              <span>RTL</span>
            </label>
          </div>
        </div>
        <div class="demo-preview">
          <Clamp
            :class="{ hyphens: hyphens1, rtl: rtl1 }"
            data-testid="demo-1-clamp"
            :text="text"
            :max-lines="lines1"
            autoresize
            :style="{ width: `${width1}px`, maxWidth: '100%' }"
          >
            <template #after="{ toggle, expanded, clamped }">
              <button v-if="expanded || clamped" class="toggle-btn" @click="toggle">
                {{ expanded ? "Collapse" : "Expand" }}
              </button>
            </template>
          </Clamp>
        </div>
      </div>

      <!-- Demo 2: max-height + before slot + external expanded -->
      <div class="demo-block">
        <div class="demo-label">max-height / slot <code>before</code> / external control</div>
        <div class="demo-controls">
          <label class="control">
            <span class="control-label">Max height</span>
            <input v-model="height2" class="control-input" />
          </label>
          <label class="control">
            <span class="control-label">Width</span>
            <span class="control-row">
              <input
                v-model.number="width2"
                class="control-range"
                type="range"
                min="240"
                max="600"
              />
              <span class="control-value">{{ width2 }}px</span>
            </span>
          </label>
          <div class="control-row">
            <label class="control-check">
              <input v-model="hyphens2" type="checkbox" />
              <span>CSS Hyphens</span>
            </label>
            <label class="control-check">
              <input v-model="rtl2" type="checkbox" />
              <span>RTL</span>
            </label>
            <label class="control-check">
              <input v-model="expanded2" type="checkbox" />
              <span>Expanded</span>
            </label>
          </div>
        </div>
        <div class="demo-preview">
          <Clamp
            :class="{ hyphens: hyphens2, rtl: rtl2 }"
            :text="text"
            :max-height="height2"
            v-model:expanded="expanded2"
            autoresize
            :style="{ width: `${width2}px`, maxWidth: '100%' }"
          >
            <template #before>
              <span class="badge">Featured</span>
            </template>
          </Clamp>
        </div>
      </div>

      <!-- Demo 3: clampchange event -->
      <div class="demo-block">
        <div class="demo-label"><code>clampchange</code> event</div>
        <div class="demo-controls">
          <label class="control">
            <span class="control-label">Max lines</span>
            <input
              v-model.number="lines3"
              class="control-input"
              type="number"
              min="1"
              max="8"
              step="1"
            />
          </label>
          <label class="control">
            <span class="control-label">Width</span>
            <span class="control-row">
              <input
                v-model.number="width3"
                class="control-range"
                type="range"
                min="240"
                max="600"
              />
              <span class="control-value">{{ width3 }}px</span>
            </span>
          </label>
          <div class="control-row">
            <label class="control-check">
              <input v-model="hyphens3" type="checkbox" />
              <span>CSS Hyphens</span>
            </label>
            <label class="control-check">
              <input v-model="rtl3" type="checkbox" />
              <span>RTL</span>
            </label>
          </div>
        </div>
        <div class="demo-preview">
          <Clamp
            :class="{ hyphens: hyphens3, rtl: rtl3 }"
            :text="text"
            :max-lines="lines3"
            autoresize
            :style="{ width: `${width3}px`, maxWidth: '100%' }"
            @clampchange="clamped3 = $event"
          />
          <p class="clamp-status">
            Clamped:
            <strong :class="clamped3 ? 'status-yes' : 'status-no'">{{
              clamped3 ? "Yes" : "No"
            }}</strong>
          </p>
        </div>
      </div>

      <!-- Demo 4: ellipsis + location -->
      <div class="demo-block">
        <div class="demo-label">ellipsis / location</div>
        <div class="demo-controls">
          <label class="control">
            <span class="control-label">Location</span>
            <span class="control-row">
              <label class="control-radio">
                <input v-model="location4" type="radio" value="start" />
                <span>Start</span>
              </label>
              <label class="control-radio">
                <input v-model="location4" type="radio" value="middle" />
                <span>Middle</span>
              </label>
              <label class="control-radio">
                <input v-model="location4" type="radio" value="end" />
                <span>End</span>
              </label>
            </span>
          </label>
          <label class="control">
            <span class="control-label">Ellipsis</span>
            <input v-model="ellipsis4" class="control-input" maxlength="6" />
          </label>
          <label class="control">
            <span class="control-label">Max lines</span>
            <input
              v-model.number="lines4"
              class="control-input"
              type="number"
              min="1"
              max="8"
              step="1"
            />
          </label>
          <label class="control">
            <span class="control-label">Width</span>
            <span class="control-row">
              <input
                v-model.number="width4"
                class="control-range"
                type="range"
                min="240"
                max="600"
              />
              <span class="control-value">{{ width4 }}px</span>
            </span>
          </label>
          <div class="control-row">
            <label class="control-check">
              <input v-model="hyphens4" type="checkbox" />
              <span>CSS Hyphens</span>
            </label>
            <label class="control-check">
              <input v-model="rtl4" type="checkbox" />
              <span>RTL</span>
            </label>
          </div>
        </div>
        <div class="demo-preview">
          <Clamp
            :class="{ hyphens: hyphens4, rtl: rtl4 }"
            :text="text"
            :max-lines="lines4"
            :location="location4"
            :ellipsis="ellipsis4"
            autoresize
            :style="{ width: `${width4}px`, maxWidth: '100%' }"
          >
            <template #after="{ toggle, expanded, clamped }">
              <button v-if="expanded || clamped" class="toggle-btn" @click="toggle">
                {{ expanded ? "Collapse" : "Expand" }}
              </button>
            </template>
          </Clamp>
        </div>
      </div>
    </section>

    <!-- Usage -->
    <section class="section">
      <h2 class="section-title" id="usage"><a href="#usage">#</a> Usage</h2>

      <h3 class="subsection-title">Installation</h3>
      <div class="install-block">
        <div class="install-tabs">
          <button
            v-for="pm in pkgManagers"
            :key="pm.id"
            class="install-tab"
            :class="{ active: pkgManager === pm.id }"
            @click="pkgManager = pm.id"
          >
            {{ pm.label }}
          </button>
        </div>
        <div
          v-if="highlightedInstall"
          class="shiki-wrap shiki-wrap--install"
          v-html="highlightedInstall"
        />
        <pre
          v-else
          class="code-block code-block--install code-block--prompt"
        ><code>{{ installCommand }}</code></pre>
      </div>

      <h3 class="subsection-title">Example</h3>
      <div class="shiki-wrap" v-html="highlightedCode" />
    </section>

    <!-- API -->
    <section class="section">
      <h2 class="section-title" id="api"><a href="#api">#</a> API</h2>

      <h3 class="subsection-title">Props</h3>
      <div class="api-table-wrap">
        <table class="api-table">
          <thead>
            <tr>
              <th>Prop</th>
              <th>Type</th>
              <th>Default</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>as</code></td>
              <td><code>string</code></td>
              <td><code>'div'</code></td>
              <td>The tag name of the generated root element.</td>
            </tr>
            <tr>
              <td><code>autoresize</code></td>
              <td><code>boolean</code></td>
              <td><code>false</code></td>
              <td>Whether to observe the root element's size.</td>
            </tr>
            <tr>
              <td><code>text</code></td>
              <td><code>string</code></td>
              <td><code>''</code></td>
              <td>The text content to clamp.</td>
            </tr>
            <tr>
              <td><code>max-lines</code></td>
              <td><code>number</code></td>
              <td>--</td>
              <td>The max number of lines that can be displayed.</td>
            </tr>
            <tr>
              <td><code>max-height</code></td>
              <td><code>number | string</code></td>
              <td>--</td>
              <td>
                The max height of the root element. Numbers are converted to <code>px</code>;
                strings are used directly as CSS.
              </td>
            </tr>
            <tr>
              <td><code>ellipsis</code></td>
              <td><code>string</code></td>
              <td><code>'...'</code></td>
              <td>The ellipsis string displayed when text is clamped.</td>
            </tr>
            <tr>
              <td><code>location</code></td>
              <td><code>'start' | 'middle' | 'end'</code></td>
              <td><code>'end'</code></td>
              <td>Where the ellipsis is placed within the text.</td>
            </tr>
            <tr>
              <td><code>expanded</code></td>
              <td><code>boolean</code></td>
              <td><code>false</code></td>
              <td>Whether the clamped area is expanded. Supports <code>v-model</code>.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 class="subsection-title">Slots</h3>
      <div class="api-table-wrap">
        <table class="api-table">
          <thead>
            <tr>
              <th>Slot</th>
              <th>Scope</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>before</code></td>
              <td><code>{ expand, collapse, toggle, clamped, expanded }</code></td>
              <td>Content displayed before the clamped text.</td>
            </tr>
            <tr>
              <td><code>after</code></td>
              <td><code>{ expand, collapse, toggle, clamped, expanded }</code></td>
              <td>Content displayed after the clamped text.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 class="subsection-title">Events</h3>
      <div class="api-table-wrap">
        <table class="api-table">
          <thead>
            <tr>
              <th>Event</th>
              <th>Payload</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>clampchange</code></td>
              <td><code>(clamped: boolean)</code></td>
              <td>Emitted when the clamp state changes.</td>
            </tr>
            <tr>
              <td><code>update:expanded</code></td>
              <td><code>(expanded: boolean)</code></td>
              <td>Emitted when the expanded state changes.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Footer -->
    <footer class="footer">
      <p>
        Made by
        <a href="https://github.com/Justineo" target="_blank" rel="noopener">@Justineo</a>
        and
        <a
          href="https://github.com/Justineo/vue-clamp/graphs/contributors"
          target="_blank"
          rel="noopener"
          >contributors</a
        >.
      </p>
    </footer>
  </div>
</template>

<style>
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
}

:root {
  --c-bg: #ffffff;
  --c-bg-soft: #f9f9fb;
  --c-bg-mute: #f3f3f6;
  --c-text: #1a1a2e;
  --c-text-2: #5c5c6f;
  --c-text-3: #8e8ea0;
  --c-border: #e5e5ec;
  --c-border-dark: #d0d0da;
  --c-accent: #7c3aed;
  --c-accent-soft: #ede9fe;
  --c-accent-text: #5b21b6;
  --c-code-bg: #f4f4f8;
  --c-success: #16a34a;
  --c-muted: #9ca3af;
  --font-body:
    Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif;
  --font-mono:
    "JetBrains Mono", "Fira Code", "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  --radius: 6px;
  --radius-lg: 8px;
}

html {
  font-family: var(--font-body);
  font-size: 15px;
  line-height: 1.6;
  color: var(--c-text);
  background: var(--c-bg);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  margin: 0;
}

a {
  color: var(--c-accent);
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

code {
  font-family: var(--font-mono);
  font-size: 0.875em;
  background: var(--c-code-bg);
  padding: 0.15em 0.4em;
  border-radius: 3px;
  color: var(--c-accent-text);
}

pre code {
  background: none;
  padding: 0;
  color: inherit;
}
</style>

<style scoped>
.page {
  max-width: 640px;
  margin: 0 auto;
  padding: 0 24px 48px;
}

/* Hero */

.hero {
  padding: 56px 0 40px;
  border-bottom: 1px solid var(--c-border);
}

.hero-title {
  font-family: var(--font-mono);
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
  color: var(--c-text);
}

.hero-tagline {
  margin-top: 8px;
  font-size: 1.05rem;
  color: var(--c-text-2);
}

.hero-links {
  margin-top: 16px;
  display: flex;
  gap: 12px;
}

.link-github {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--c-text);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  transition:
    border-color 0.15s,
    color 0.15s;
}

.link-github:hover {
  border-color: var(--c-border-dark);
  color: var(--c-accent);
  text-decoration: none;
}

/* Sections */

.section {
  padding: 32px 0;
  border-bottom: 1px solid var(--c-border);
}

.section-title {
  font-size: 1.15rem;
  font-weight: 600;
  margin-bottom: 16px;
  letter-spacing: -0.01em;
}

.section-title a {
  color: var(--c-text-3);
  margin-right: 4px;
  font-weight: 400;
}

.section-title a:hover {
  color: var(--c-accent);
  text-decoration: none;
}

.subsection-title {
  font-size: 0.9rem;
  font-weight: 600;
  margin-top: 20px;
  margin-bottom: 8px;
  color: var(--c-text-2);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

/* Features */

.features-list {
  list-style: none;
  padding: 0;
}

.features-list li {
  position: relative;
  padding-left: 16px;
  font-size: 0.9rem;
  color: var(--c-text-2);
  line-height: 1.7;
}

.features-list li::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0.65em;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--c-border-dark);
}

/* Demo blocks */

.demo-block {
  margin-bottom: 20px;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.demo-block:last-child {
  margin-bottom: 0;
}

.demo-label {
  padding: 8px 14px;
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--c-text-3);
  background: var(--c-bg-soft);
  border-bottom: 1px solid var(--c-border);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.demo-label code {
  font-size: 0.78rem;
  text-transform: none;
  letter-spacing: 0;
}

.demo-controls {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-bottom: 1px solid var(--c-border);
  background: var(--c-bg);
}

.control {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.8rem;
}

.control-label {
  flex-shrink: 0;
  width: 72px;
  color: var(--c-text-2);
  font-weight: 500;
}

.control-input {
  flex: 1;
  max-width: 180px;
  height: 28px;
  padding: 0 8px;
  font-size: 0.8rem;
  font-family: var(--font-mono);
  border: 1px solid var(--c-border);
  border-radius: 4px;
  background: var(--c-bg);
  color: var(--c-text);
  outline: none;
  transition: border-color 0.15s;
}

.control-input:focus {
  border-color: var(--c-accent);
}

.control-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.control-range {
  flex: 1;
  max-width: 140px;
  height: 4px;
  appearance: none;
  background: var(--c-bg-mute);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}

.control-range::-webkit-slider-thumb {
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--c-accent);
  border: 2px solid var(--c-bg);
  box-shadow: 0 0 0 1px var(--c-border-dark);
  cursor: pointer;
}

.control-value {
  font-size: 0.75rem;
  font-family: var(--font-mono);
  color: var(--c-text-3);
  min-width: 44px;
  text-align: right;
}

.control-check,
.control-radio {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.8rem;
  color: var(--c-text-2);
  cursor: pointer;
  user-select: none;
}

.control-check input,
.control-radio input {
  accent-color: var(--c-accent);
}

.demo-preview {
  padding: 16px 14px;
  background: var(--c-bg-soft);
  line-height: 1.8;
  font-size: 0.9rem;
}

/* Toggle button inside demos */

.toggle-btn {
  display: inline;
  margin-left: 4px;
  padding: 1px 8px;
  font-size: 0.75rem;
  font-weight: 500;
  font-family: var(--font-body);
  color: var(--c-accent);
  background: var(--c-accent-soft);
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  transition:
    background 0.15s,
    border-color 0.15s;
  vertical-align: baseline;
  line-height: 1.6;
}

.toggle-btn:hover {
  background: transparent;
  border-color: var(--c-accent);
}

/* Badge */

.badge {
  display: inline-block;
  padding: 1px 8px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--c-accent);
  background: var(--c-accent-soft);
  border-radius: 999px;
  margin-right: 6px;
  vertical-align: baseline;
  line-height: 1.6;
}

/* Clamp status */

.clamp-status {
  margin-top: 8px;
  font-size: 0.8rem;
  color: var(--c-text-3);
}

.status-yes {
  color: var(--c-accent);
}

.status-no {
  color: var(--c-success);
}

/* Hyphens / RTL */

:deep(.hyphens) {
  hyphens: auto;
}

:deep(.rtl) {
  direction: rtl;
}

:deep(.rtl) .toggle-btn {
  margin-left: 0;
  margin-right: 4px;
}

:deep(.rtl) .badge {
  margin-right: 0;
  margin-left: 6px;
}

/* Code blocks */

.code-block {
  margin: 0;
  padding: 14px 16px;
  font-size: 0.9rem;
  font-family: var(--font-mono);
  line-height: 1.65;
  background: var(--c-bg-soft);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  overflow-x: auto;
  color: var(--c-text);
}

/* Install block */

.install-block {
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  overflow: hidden;
}

.install-block .code-block {
  border: none;
  border-radius: 0;
}

.install-tabs {
  display: flex;
  background: var(--c-bg-soft);
  border-bottom: 1px solid var(--c-border);
}

.install-tab {
  padding: 6px 14px;
  font-size: 0.78rem;
  font-family: var(--font-mono);
  font-weight: 500;
  color: var(--c-text-3);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition:
    color 0.15s,
    border-color 0.15s;
}

.install-tab:hover {
  color: var(--c-text-2);
}

.install-tab.active {
  color: var(--c-accent);
  border-bottom-color: var(--c-accent);
}

.code-block--prompt code {
  font-family: var(--font-body);
  font-style: italic;
  color: var(--c-text-2);
}

/* API tables */

.api-table-wrap {
  overflow-x: auto;
  margin-top: 4px;
  margin-bottom: 16px;
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
}

.api-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
}

.api-table th {
  text-align: left;
  font-weight: 600;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--c-text-3);
  background: var(--c-bg-soft);
  padding: 8px 12px;
  border-bottom: 1px solid var(--c-border);
}

.api-table td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--c-border);
  color: var(--c-text-2);
  vertical-align: top;
}

.api-table tr:last-child td {
  border-bottom: none;
}

.api-table code {
  font-size: 0.78rem;
  white-space: nowrap;
}

/* Footer */

.footer {
  padding: 32px 0 0;
  text-align: center;
  font-size: 0.8rem;
  color: var(--c-text-3);
}

.footer a {
  color: var(--c-text-2);
  font-weight: 500;
}

.footer a:hover {
  color: var(--c-accent);
}

/* Shiki */

.shiki-wrap :deep(pre.shiki) {
  margin: 0;
  padding: 14px 16px;
  font-size: 0.9rem;
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

.shiki-wrap--install :deep(pre.shiki) {
  border: none;
  border-radius: 0;
}
</style>
