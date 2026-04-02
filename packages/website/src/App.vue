<script setup lang="ts">
import { computed, ref } from "vue";
import { InlineClamp, LineClamp } from "vue-clamp";
import ComponentTabs from "./ComponentTabs.vue";
import CodeBlock from "./CodeBlock.vue";
import { createHighlighterCoreSync } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import vue from "shiki/langs/vue.mjs";
import shellscript from "shiki/langs/shellscript.mjs";
import css from "shiki/langs/css.mjs";
import html from "shiki/langs/html.mjs";
import js from "shiki/langs/javascript.mjs";
import ts from "shiki/langs/typescript.mjs";
import { websiteShikiTheme } from "./shiki-theme";

import type { InlineClampSplit, LineClampLocation } from "vue-clamp";

const shiki = createHighlighterCoreSync({
  themes: [websiteShikiTheme],
  langs: [vue, shellscript, css, html, js, ts],
  engine: createJavaScriptRegexEngine(),
});

const text =
  "Vue (pronounced /vju\u02D0/, like view) is a progressive framework for building user interfaces. Unlike other monolithic frameworks, Vue is designed from the ground up to be incrementally adoptable. The core library is focused on the view layer only, and is easy to pick up and integrate with other libraries or existing projects. On the other hand, Vue is also perfectly capable of powering sophisticated Single-Page Applications when used in combination with modern tooling and supporting libraries.";
const arabicText =
  "فيو 3 إطار تدريجي لبناء واجهات المستخدم، وقد صُمم ليكون سهل التبنّي بشكل متدرج داخل المشاريع المختلفة. تركز المكتبة الأساسية على طبقة العرض فقط، لكنها قادرة أيضًا على تشغيل تطبيقات أكثر تعقيدًا عند استخدامها مع أدوات حديثة ومكتبات مساندة. في هذا المثال نعرض نصًا عربيًا مع Vue 3 وبعض الكلمات اللاتينية مثل SPA لاختبار الالتفاف والاقتطاع في اتجاه من اليمين إلى اليسار.";

function lineDemoText(rtl: boolean): string {
  return rtl ? arabicText : text;
}

// Demo 1: max-lines + after slot toggle
const lines1 = ref(3);
const width1 = ref(480);
const hyphens1 = ref(true);
const rtl1 = ref(false);

// Demo 2: max-height + before slot + external expanded
const height2 = ref("calc(36px + 6em)");
const width2 = ref(480);
const hyphens2 = ref(true);
const rtl2 = ref(false);
const expanded2 = ref(false);

// Demo 3: clampchange event
const lines3 = ref(6);
const width3 = ref(480);
const hyphens3 = ref(true);
const rtl3 = ref(false);
const clamped3 = ref(false);

// Demo 4: ellipsis + location
const lines4 = ref(5);
const width4 = ref(480);
const hyphens4 = ref(true);
const rtl4 = ref(false);
const ellipsis4 = ref("\u2026");
const locationRatio4 = ref(1);
const locationPresets4 = [
  { label: "Start", ratio: 0, value: "start" as const },
  { label: "Middle", ratio: 0.5, value: "middle" as const },
  { label: "End", ratio: 1, value: "end" as const },
] as const;

const selectedLocationPreset4 = computed(() => {
  const preset = locationPresets4.find(
    (candidate) => Math.abs(locationRatio4.value - candidate.ratio) < 0.001,
  );

  return preset?.value ?? null;
});

const location4 = computed<LineClampLocation>(() => {
  return selectedLocationPreset4.value ?? locationRatio4.value;
});

function selectLocationPreset4(ratio: number): void {
  locationRatio4.value = ratio;
}

type SurfaceKey = "line" | "inline";

const activeSurface = ref<SurfaceKey>("line");
const surfaceOptions = [
  {
    description: "Multiline browser-fit clamp with slots, expansion, and ratio-based ellipsis.",
    label: "LineClamp",
    value: "line",
  },
  {
    description: "Native single-line clamp with optional split(text) semantics for fixed edges.",
    label: "InlineClamp",
    value: "inline",
  },
] as const;

const inlineWidth5 = ref(280);
const commonImageExtensions = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif"] as const;

const splitImageFile: InlineClampSplit = (text) => {
  const extension = commonImageExtensions.find((candidate) =>
    text.toLowerCase().endsWith(candidate),
  );

  return extension
    ? {
        body: text.slice(0, -extension.length),
        end: text.slice(-extension.length),
      }
    : {
        body: text,
      };
};

const splitEmail: InlineClampSplit = (text) => {
  const atIndex = text.indexOf("@");

  return atIndex === -1
    ? {
        body: text,
      }
    : {
        body: text.slice(0, atIndex),
        end: text.slice(atIndex),
      };
};

const splitPath: InlineClampSplit = (text) => {
  const slashIndex = text.lastIndexOf("/") + 1;
  const dotIndex = text.lastIndexOf(".");

  return slashIndex <= 0 || dotIndex <= slashIndex
    ? {
        body: text,
      }
    : {
        start: text.slice(0, slashIndex),
        body: text.slice(slashIndex, dotIndex),
        end: text.slice(dotIndex),
      };
};

const inlineExamples = [
  {
    id: "file-list",
    label: "file list / common image extensions",
    split: splitImageFile,
    text: "summer-campaign-panorama-final.jpeg",
  },
  {
    id: "email",
    label: "email / keep domain visible",
    split: splitEmail,
    text: "release.notifications.digest@acme.dev",
  },
  {
    id: "path",
    label: "path / keep prefix + extension visible",
    split: splitPath,
    text: "~/screenshots/interface-preview-for-share.png",
  },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  split: InlineClampSplit;
  text: string;
}>;

type PkgManager = "vp" | "npm" | "pnpm" | "yarn" | "agent";

const pkgManager = ref<PkgManager>("npm");

const pkgManagers: { id: PkgManager; label: string }[] = [
  { id: "vp", label: "vp" },
  { id: "npm", label: "npm" },
  { id: "pnpm", label: "pnpm" },
  { id: "yarn", label: "yarn" },
  { id: "agent", label: "agent" },
];

const componentGuideRows = [
  {
    label: "Layout",
    line: "Browser-fit multiline clamp.",
    inline: "Native single-line clamp.",
  },
  {
    label: "Best for",
    line: "Paragraphs, excerpts, cards, and expandable UI.",
    inline: "Filenames, emails, IDs, and paths.",
  },
  {
    label: "Semantics",
    line: "Supports before/after slots around the clamped text.",
    inline: "Uses split(text) to keep fixed visible edges.",
  },
  {
    label: "Control",
    line: "Supports location, expansion, and clampchange.",
    inline: "No slots, events, or instance API.",
  },
] as const;

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

const lineCodeExample = [
  '<script setup lang="ts">',
  "import { ref } from 'vue'",
  "import { LineClamp } from 'vue-clamp'",
  "",
  "const expanded = ref(false)",
  "const text = 'A long line of text that should be clamped after three lines.'",
  "<" + "/script>",
  "",
  "<template>",
  '  <LineClamp v-model:expanded="expanded" :text="text" :max-lines="3">',
  '    <template #after="{ clamped, toggle }">',
  '      <button v-if="clamped" type="button" @click="toggle">',
  `        {{ expanded ? 'Less' : 'More' }}`,
  "      </button>",
  "    </template>",
  "  </LineClamp>",
  "</template>",
].join("\n");

const inlineCodeExample = [
  '<script setup lang="ts">',
  "import { InlineClamp } from 'vue-clamp'",
  "",
  "const file = 'summer-campaign-panorama-final.jpeg'",
  "",
  "const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif']",
  "",
  "const splitImageFile = (text: string) => {",
  "  const extension = imageExtensions.find((candidate) =>",
  "    text.toLowerCase().endsWith(candidate),",
  "  )",
  "",
  "  return extension",
  "    ? {",
  "        body: text.slice(0, -extension.length),",
  "        end: text.slice(-extension.length),",
  "      }",
  "    : { body: text }",
  "}",
  "<" + "/script>",
  "",
  "<template>",
  '  <InlineClamp :text="file" :split="splitImageFile" />',
  "</template>",
].join("\n");

const highlightedInstall = computed(() => {
  if (pkgManager.value === "agent") {
    return null;
  }
  return shiki.codeToHtml(installCommand.value, {
    lang: "shellscript",
    theme: websiteShikiTheme.name,
  });
});

const highlightedLineCode = computed(() => {
  return shiki.codeToHtml(lineCodeExample, {
    lang: "vue",
    theme: websiteShikiTheme.name,
  });
});

const highlightedInlineCode = computed(() => {
  return shiki.codeToHtml(inlineCodeExample, {
    lang: "vue",
    theme: websiteShikiTheme.name,
  });
});
</script>

<template>
  <div class="page" lang="en">
    <!-- Hero -->
    <header class="hero">
      <h1 class="hero-title">&lt;vue-clamp&gt;</h1>
      <p class="hero-tagline">LineClamp and InlineClamp for Vue 3 text truncation.</p>
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
        <li>
          <code>LineClamp</code> handles browser-fit multiline truncation with slots, expansion
          state, and either <code>max-lines</code> or <code>max-height</code>.
        </li>
        <li>
          <code>LineClamp</code> places ellipsis with <code>start</code>, <code>middle</code>,
          <code>end</code>, or any numeric ratio between <code>0</code> and <code>1</code>.
        </li>
        <li>
          <code>InlineClamp</code> stays native and single-line, with optional
          <code>split(text)</code> semantics for fixed visible edges.
        </li>
      </ul>
    </section>

    <section class="section">
      <h2 class="section-title" id="installation"><a href="#installation">#</a> Installation</h2>
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
        <CodeBlock
          :code="installCommand"
          :html="highlightedInstall"
          label="installation command"
          block-id="install"
          embedded
        />
      </div>
    </section>

    <section class="section">
      <h2 class="section-title" id="choose"><a href="#choose">#</a> Choose a Component</h2>
      <p class="section-lead">
        Use <code>LineClamp</code> when wrapped text needs browser-fit clamping. Use
        <code>InlineClamp</code> when one line should stay native and a meaningful edge must stay
        visible.
      </p>
      <div class="api-table-wrap guide-table-wrap">
        <table class="api-table guide-table">
          <thead>
            <tr>
              <th></th>
              <th><code>LineClamp</code></th>
              <th><code>InlineClamp</code></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in componentGuideRows" :key="row.label">
              <td>{{ row.label }}</td>
              <td>{{ row.line }}</td>
              <td>{{ row.inline }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="section-note">Both components are exported from <code>vue-clamp</code>.</p>
    </section>

    <section class="section">
      <div class="reference-root" data-reference-shell>
        <h2 class="section-title reference-title" id="components">
          <a href="#components">#</a> Components
        </h2>
        <div class="reference-tabs-row">
          <ComponentTabs
            v-model="activeSurface"
            aria-label="Component tabs"
            :options="surfaceOptions"
          />
        </div>

        <div class="reference-body">
          <section class="reference-section" data-reference-panel="demo">
            <h3 class="subsection-title">Demo</h3>

            <template v-if="activeSurface === 'line'">
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
                  <div
                    class="demo-output width-guide"
                    :style="{ width: `${width1}px`, maxWidth: '100%' }"
                  >
                    <LineClamp
                      class="demo-clamp"
                      :class="{ hyphens: hyphens1, rtl: rtl1 }"
                      :text="lineDemoText(rtl1)"
                      :max-lines="lines1"
                      :style="{ width: `${width1}px`, maxWidth: '100%' }"
                    >
                      <template #after="{ toggle, expanded, clamped }">
                        <button v-if="expanded || clamped" class="toggle-btn" @click="toggle">
                          {{ expanded ? "Collapse" : "Expand" }}
                        </button>
                      </template>
                    </LineClamp>
                  </div>
                </div>
              </div>

              <!-- Demo 2: max-height + before slot + external expanded -->
              <div class="demo-block">
                <div class="demo-label">
                  max-height / slot <code>before</code> / external control
                </div>
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
                  <div
                    class="demo-output width-guide height-guide"
                    :style="{ width: `${width2}px`, maxWidth: '100%' }"
                  >
                    <LineClamp
                      class="demo-clamp"
                      :class="{ hyphens: hyphens2, rtl: rtl2 }"
                      :text="lineDemoText(rtl2)"
                      :max-height="height2"
                      v-model:expanded="expanded2"
                      :style="{ width: `${width2}px`, maxWidth: '100%' }"
                    >
                      <template #before>
                        <span class="badge">Featured</span>
                      </template>
                    </LineClamp>
                  </div>
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
                  <div
                    class="demo-output width-guide"
                    :style="{ width: `${width3}px`, maxWidth: '100%' }"
                  >
                    <LineClamp
                      class="demo-clamp"
                      :class="{ hyphens: hyphens3, rtl: rtl3 }"
                      :text="lineDemoText(rtl3)"
                      :max-lines="lines3"
                      :style="{ width: `${width3}px`, maxWidth: '100%' }"
                      @clampchange="clamped3 = $event"
                    />
                  </div>
                  <p class="clamp-status">
                    Clamped:
                    <strong :class="clamped3 ? 'status-yes' : 'status-no'">{{
                      clamped3 ? "Yes" : "No"
                    }}</strong>
                  </p>
                </div>
              </div>

              <!-- Demo 4: ellipsis + location -->
              <div class="demo-block" data-demo="location">
                <div class="demo-label">ellipsis / location keywords + ratios</div>
                <div class="demo-controls">
                  <div class="control stacked-control">
                    <span class="control-label">Location</span>
                    <span class="control-stack">
                      <span class="control-pills" role="group" aria-label="Location presets">
                        <button
                          v-for="preset in locationPresets4"
                          :key="preset.value"
                          class="control-pill"
                          :class="{ active: selectedLocationPreset4 === preset.value }"
                          :data-location-preset="preset.value"
                          type="button"
                          :aria-pressed="selectedLocationPreset4 === preset.value"
                          @click="selectLocationPreset4(preset.ratio)"
                        >
                          {{ preset.label }}
                        </button>
                      </span>
                    </span>
                  </div>
                  <div class="control stacked-control">
                    <span class="control-label">Ratio</span>
                    <span class="control-stack">
                      <span class="control-row">
                        <input
                          v-model.number="locationRatio4"
                          data-location-ratio-slider
                          class="control-range"
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                        />
                        <span class="control-value">{{ locationRatio4.toFixed(2) }}</span>
                      </span>
                    </span>
                  </div>
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
                        data-location-width-slider
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
                  <div
                    class="demo-output width-guide"
                    :style="{ width: `${width4}px`, maxWidth: '100%' }"
                  >
                    <LineClamp
                      class="demo-clamp"
                      :class="{ hyphens: hyphens4, rtl: rtl4 }"
                      :text="lineDemoText(rtl4)"
                      :max-lines="lines4"
                      :location="location4"
                      :ellipsis="ellipsis4"
                      :style="{ width: `${width4}px`, maxWidth: '100%' }"
                    >
                      <template #after="{ toggle, expanded, clamped }">
                        <button v-if="expanded || clamped" class="toggle-btn" @click="toggle">
                          {{ expanded ? "Collapse" : "Expand" }}
                        </button>
                      </template>
                    </LineClamp>
                  </div>
                </div>
              </div>
            </template>

            <div v-else data-demo="inline">
              <div class="demo-block">
                <div class="demo-label">native one-line clamp / optional <code>split()</code></div>
                <div class="demo-controls">
                  <label class="control">
                    <span class="control-label">Width</span>
                    <span class="control-row">
                      <input
                        v-model.number="inlineWidth5"
                        data-inline-width-slider
                        class="control-range"
                        type="range"
                        min="160"
                        max="280"
                      />
                      <span class="control-value">{{ inlineWidth5 }}px</span>
                    </span>
                  </label>
                </div>
              </div>

              <div
                v-for="example in inlineExamples"
                :key="example.id"
                class="demo-block"
                :data-inline-example="example.id"
              >
                <div class="demo-label">{{ example.label }}</div>
                <div class="demo-preview">
                  <div class="comparison-grid">
                    <div class="comparison-panel" data-inline-mode="plain">
                      <div class="comparison-label">Plain</div>
                      <div
                        class="demo-output width-guide"
                        :style="{ width: `${inlineWidth5}px`, maxWidth: '100%' }"
                      >
                        <InlineClamp class="demo-inline" :text="example.text" />
                      </div>
                    </div>
                    <div class="comparison-panel" data-inline-mode="split">
                      <div class="comparison-label">Split</div>
                      <div
                        class="demo-output width-guide"
                        :style="{ width: `${inlineWidth5}px`, maxWidth: '100%' }"
                      >
                        <InlineClamp
                          class="demo-inline"
                          :text="example.text"
                          :split="example.split"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section class="reference-section" data-reference-panel="example">
            <h3 class="subsection-title">Example</h3>
            <CodeBlock
              v-if="activeSurface === 'line'"
              :code="lineCodeExample"
              :html="highlightedLineCode"
              label="LineClamp example"
              block-id="line-example"
            />
            <CodeBlock
              v-else
              :code="inlineCodeExample"
              :html="highlightedInlineCode"
              label="InlineClamp example"
              block-id="inline-example"
            />
          </section>

          <section class="reference-section" data-reference-panel="api">
            <template v-if="activeSurface === 'line'">
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
                        The max height of the root element. Numbers are converted to
                        <code>px</code>; strings are used directly as CSS.
                      </td>
                    </tr>
                    <tr>
                      <td><code>ellipsis</code></td>
                      <td><code>string</code></td>
                      <td><code>'…'</code></td>
                      <td>The ellipsis string displayed when text is clamped.</td>
                    </tr>
                    <tr>
                      <td><code>location</code></td>
                      <td><code>number | 'start' | 'middle' | 'end'</code></td>
                      <td><code>'end'</code></td>
                      <td>
                        Where the ellipsis is placed within the text. Keyword aliases map to numeric
                        ratios: <code>start</code> → <code>0</code>, <code>middle</code> →
                        <code>0.5</code>, <code>end</code> → <code>1</code>.
                      </td>
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

              <h3 class="subsection-title">Notes</h3>
              <ul class="notes-list" data-api-notes="line">
                <li>
                  <code>text</code> is the source string. <code>before</code> and
                  <code>after</code> render around it, but they are not part of the clamped source
                  text.
                </li>
                <li>
                  Use <code>max-lines</code> for line-based layouts, or <code>max-height</code>
                  when the visible height comes from surrounding UI.
                </li>
                <li>
                  <code>location="end"</code> and the numeric ratio <code>1</code> can use a native
                  CSS fast path for the collapsed one-line default-ellipsis case.
                </li>
                <li>
                  <code>before</code> and <code>after</code> are measured as atomic inline boxes, so
                  they work best as concise inline content.
                </li>
              </ul>
            </template>

            <template v-else>
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
                      <td><code>'span'</code></td>
                      <td>The tag name of the generated root element.</td>
                    </tr>
                    <tr>
                      <td><code>text</code></td>
                      <td><code>string</code></td>
                      <td>--</td>
                      <td>The full one-line source text.</td>
                    </tr>
                    <tr>
                      <td><code>split</code></td>
                      <td><code>(text: string) =&gt; { start?, body, end? }</code></td>
                      <td>--</td>
                      <td>
                        Optional semantic splitter. <code>body</code> is the only shrinking segment;
                        <code>start</code> and <code>end</code> stay fixed.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 class="subsection-title">split() Result</h3>
              <div class="api-table-wrap">
                <table class="api-table">
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th>Required</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><code>start</code></td>
                      <td>No</td>
                      <td>Fixed leading segment.</td>
                    </tr>
                    <tr>
                      <td><code>body</code></td>
                      <td>Yes</td>
                      <td>The only shrinkable segment.</td>
                    </tr>
                    <tr>
                      <td><code>end</code></td>
                      <td>No</td>
                      <td>Fixed trailing segment.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <h3 class="subsection-title">Notes</h3>
              <ul class="notes-list" data-api-notes="inline">
                <li>
                  <code>InlineClamp</code> is native-only and single-line-only. It does not expose
                  slots, events, or an instance API.
                </li>
                <li>
                  <code>InlineClamp</code> is best for one-line text where the start or end must
                  remain visible, such as filenames, emails, and paths.
                </li>
                <li>
                  <code>split(text)</code> should be pure and synchronous. <code>body</code> is
                  always the only shrinking segment.
                </li>
                <li>
                  Because it stays native, <code>InlineClamp</code> does not rewrite text and does
                  not provide expansion state, events, or slot hooks.
                </li>
              </ul>
            </template>
          </section>
        </div>
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
  --demo-range-width: 140px;
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
  max-width: 720px;
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

.section-lead {
  margin-top: 12px;
  font-size: 0.9rem;
  color: var(--c-text-2);
}

.section-note {
  margin-top: 6px;
  font-size: 0.8rem;
  color: var(--c-text-3);
}

/* Features */

.features-list {
  list-style: none;
  padding: 0;
  display: grid;
  gap: 10px;
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

/* Reference layout */

.reference-root {
  display: flex;
  flex-direction: column;
}

.reference-tabs-row {
  position: sticky;
  top: -1px;
  z-index: 8;
  background: var(--c-bg);
}

.reference-body {
  display: flex;
  flex-direction: column;
  margin-top: 18px;
}

.reference-section {
  padding-top: 0;
}

.reference-section + .reference-section {
  margin-top: 22px;
  padding-top: 22px;
  border-top: 1px solid var(--c-border);
}

.reference-section > .subsection-title {
  margin-top: 0;
}

/* Demo blocks */

.demo-block {
  margin-bottom: 0;
  padding: 18px 0 20px;
  border-top: 1px solid var(--c-border);
}

.demo-block:first-child {
  padding-top: 0;
  border-top: none;
}

.demo-label {
  margin-bottom: 10px;
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--c-text-3);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.demo-label code {
  font-size: 0.78rem;
  text-transform: none;
  letter-spacing: 0;
}

.demo-controls {
  padding: 0 0 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.control {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.8rem;
}

.stacked-control {
  align-items: flex-start;
}

.control-label {
  flex-shrink: 0;
  width: 72px;
  color: var(--c-text-2);
  font-weight: 500;
}

.control-stack {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.control-hint {
  font-size: 0.75rem;
  color: var(--c-text-3);
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

.control-input:focus-visible {
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
  max-width: var(--demo-range-width);
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

.control-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.control-pill {
  min-width: 60px;
  padding: 4px 10px;
  font-size: 0.75rem;
  font-weight: 500;
  font-family: var(--font-body);
  color: var(--c-text-2);
  background: var(--c-bg-soft);
  border: 1px solid var(--c-border);
  border-radius: 999px;
  cursor: pointer;
  transition:
    border-color 0.15s,
    background 0.15s,
    color 0.15s;
}

.control-pill:hover {
  border-color: var(--c-border-dark);
  color: var(--c-text);
}

.control-pill.active {
  color: var(--c-accent-text);
  background: var(--c-accent-soft);
  border-color: var(--c-accent);
}

.demo-preview {
  padding: 14px;
  background: var(--c-bg-soft);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  font-size: 0.9rem;
}

.comparison-grid {
  display: grid;
  gap: 12px;
}

.comparison-panel {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.comparison-panel + .comparison-panel {
  padding-top: 12px;
  border-top: 1px solid var(--c-border);
}

.comparison-label {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--c-text-3);
}

.demo-output {
  min-width: 0;
  padding: 8px 10px;
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  overflow: hidden;
  box-shadow: var(--guide-shadow-x, none), var(--guide-shadow-y, none);
}

:deep(.demo-clamp) {
  display: block;
  width: 100%;
  max-width: 100%;
  line-height: 1.8;
}

:deep(.width-guide) {
  --guide-shadow-x: inset -1px 0 0 rgba(208, 208, 218, 0.95);
}

:deep(.height-guide) {
  --guide-shadow-y: inset 0 -1px 0 rgba(208, 208, 218, 0.95);
}

:deep(.demo-inline) {
  display: block;
  max-width: 100%;
  line-height: 1.6;
}

:deep(.demo-inline [data-inline-start]) {
  color: var(--c-text-3);
}

:deep(.demo-inline [data-inline-end]) {
  color: var(--c-accent-text);
}

@media (min-width: 640px) {
  .comparison-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }

  .comparison-panel + .comparison-panel {
    padding-top: 0;
    padding-left: 14px;
    border-top: none;
    border-left: 1px solid var(--c-border);
  }
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
  -webkit-hyphens: auto;
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

/* Install block */

.install-block {
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  overflow: hidden;
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

.guide-table th:first-child,
.guide-table td:first-child {
  width: 110px;
  white-space: nowrap;
}

.api-table code {
  font-size: 0.78rem;
  white-space: nowrap;
}

.notes-list {
  margin: 8px 0 0;
  padding-left: 18px;
  display: grid;
  gap: 8px;
  font-size: 0.84rem;
  color: var(--c-text-2);
}

.notes-list li {
  line-height: 1.7;
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
</style>
