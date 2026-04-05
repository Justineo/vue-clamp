<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { ArrowUpRight, Ellipsis } from "@lucide/vue";
import { siGithub } from "simple-icons";
import { InlineClamp, LineClamp, WrapClamp } from "vue-clamp";
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

function lineToggleLabel(expanded: boolean, rtl: boolean): string {
  if (rtl) {
    return expanded ? "أقل" : "المزيد";
  }

  return expanded ? "Less" : "More";
}

function lineBadgeLabel(rtl: boolean): string {
  return rtl ? "مميز" : "Featured";
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

type SurfaceKey = "line" | "inline" | "wrap";
type WrapDemoItem = {
  id: string;
  label: string;
  tone?: "neutral" | "accent" | "success" | "warm";
  avatar?: string;
};

const activeSurface = ref<SurfaceKey>("line");
const referenceTabsAnchorRef = ref<HTMLElement | null>(null);
const surfaceOptions = [
  {
    description: "Multiline browser-fit clamp for previews, cards, and expandable copy.",
    label: "LineClamp",
    value: "line",
  },
  {
    description: "Native single-line clamp for filenames, paths, and email addresses.",
    label: "InlineClamp",
    value: "inline",
  },
  {
    description: "Wrapped atomic-item clamp for labels, filters, and selected-value lists.",
    label: "WrapClamp",
    value: "wrap",
  },
] as const;

const heroTaglineWordCatalog = {
  line: ["messages", "excerpts", "summaries"],
  inline: ["filenames", "emails", "paths"],
  wrap: ["tags", "filters", "chips"],
} as const;
type HeroTaglineCategory = keyof typeof heroTaglineWordCatalog;
type HeroTaglineWord = (typeof heroTaglineWordCatalog)[HeroTaglineCategory][number];

function shuffleItems<T>(items: readonly T[]): T[] {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = shuffled[index];
    shuffled[index] = shuffled[swapIndex]!;
    shuffled[swapIndex] = current!;
  }

  return shuffled;
}

function createHeroTaglineWidthMap(): Record<HeroTaglineWord, number> {
  return Object.fromEntries(
    Object.values(heroTaglineWordCatalog)
      .flat()
      .map((word) => [word, 0]),
  ) as Record<HeroTaglineWord, number>;
}

function createHeroTaglineWords(): HeroTaglineWord[] {
  const categories = Object.keys(heroTaglineWordCatalog) as HeroTaglineCategory[];
  const shuffledPools = Object.fromEntries(
    categories.map((category) => [category, shuffleItems(heroTaglineWordCatalog[category])]),
  ) as Record<HeroTaglineCategory, HeroTaglineWord[]>;

  const rounds = Math.max(...categories.map((category) => shuffledPools[category].length));
  const words: HeroTaglineWord[] = [];

  for (let roundIndex = 0; roundIndex < rounds; roundIndex += 1) {
    const roundCategories = shuffleItems(
      categories.filter((category) => roundIndex < shuffledPools[category].length),
    );

    for (const category of roundCategories) {
      const word = shuffledPools[category][roundIndex];
      if (word) {
        words.push(word);
      }
    }
  }

  return words;
}

function shouldScrollReferenceTabsIntoView(target: HTMLElement): boolean {
  const { top } = target.getBoundingClientRect();

  return top < 0 || top > window.innerHeight;
}

function scrollReferenceTabsToTop(): void {
  const target = referenceTabsAnchorRef.value;
  if (!target || !shouldScrollReferenceTabsIntoView(target)) {
    return;
  }

  window.scrollTo({
    top: target.getBoundingClientRect().top + window.scrollY,
  });
}

function isSurfaceKey(value: string): value is SurfaceKey {
  return value === "line" || value === "inline" || value === "wrap";
}

function updateActiveSurface(surface: string): void {
  if (!isSurfaceKey(surface)) {
    return;
  }

  activeSurface.value = surface;

  void nextTick(() => {
    scrollReferenceTabsToTop();
  });
}

const heroTaglineWords = createHeroTaglineWords();
const defaultHeroTaglineWord = heroTaglineWords[0] ?? heroTaglineWordCatalog.line[0];

const heroTaglineTextStart = "Clamping";
const heroTaglineTextEnd = "in Vue.";
const heroTaglineExpandedPadding = 8;
const heroTaglineTiming = {
  collapsedHold: 380,
  expandedHold: 2240,
  swapSettle: 220,
  transition: 1320,
} as const;
const heroTaglineWord = ref<HeroTaglineWord>(defaultHeroTaglineWord);
const heroTaglineWidth = ref<number | null>(null);
const heroTaglineCollapsed = ref(false);
const heroTaglineMeasured = ref(false);
const heroTaglinePaused = ref(false);
const heroTaglineReducedMotion = ref(false);
const heroTaglineShellRef = ref<HTMLElement | null>(null);
const heroTaglineMeasureRef = ref<HTMLElement | null>(null);
const heroTaglineExpandedWidths = ref<Record<HeroTaglineWord, number>>(createHeroTaglineWidthMap());
const heroTaglineCollapsedWidth = ref(0);

let heroTaglineTimer: number | null = null;
let heroTaglineMotionQuery: MediaQueryList | null = null;
let heroTaglineResizeObserver: ResizeObserver | null = null;
let heroTaglineFontsReady = false;
let heroTaglineMounted = false;

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

const splitHeroTagline: InlineClampSplit = (text) => {
  for (const word of heroTaglineWords) {
    if (text === `${heroTaglineTextStart} ${word} ${heroTaglineTextEnd}`) {
      return {
        start: heroTaglineTextStart,
        body: ` ${word} `,
        end: heroTaglineTextEnd,
      };
    }
  }

  return {
    body: text,
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

const wrapTabItems = [
  { id: "overview", label: "Overview" },
  { id: "roadmap", label: "Roadmap" },
  { id: "releases", label: "Releases" },
  { id: "analytics", label: "Analytics" },
  { id: "billing", label: "Billing" },
  { id: "team", label: "Team access" },
  { id: "audit", label: "Audit log" },
] as const satisfies readonly WrapDemoItem[];

const wrapTabItemsAr = [
  { id: "overview", label: "نظرة عامة" },
  { id: "roadmap", label: "الخارطة" },
  { id: "releases", label: "الإصدارات" },
  { id: "analytics", label: "التحليلات" },
  { id: "billing", label: "الفوترة" },
  { id: "team", label: "صلاحيات الفريق" },
  { id: "audit", label: "سجل التدقيق" },
] as const satisfies readonly WrapDemoItem[];

const wrapInviteeItems = [
  { id: "maya", label: "Maya Chen", avatar: "MC" },
  { id: "sam", label: "Sam Rivera", avatar: "SR" },
  { id: "nina", label: "Nina Patel", avatar: "NP" },
  { id: "alex", label: "Alex Kim", avatar: "AK" },
  { id: "morgan", label: "Morgan Lee", avatar: "ML" },
  { id: "diego", label: "Diego Ruiz", avatar: "DR" },
  { id: "sofia", label: "Sofia Park", avatar: "SP" },
] as const satisfies readonly WrapDemoItem[];

const wrapInviteeItemsAr = [
  { id: "maya", label: "مايا تشن", avatar: "MC" },
  { id: "sam", label: "سام ريفيرا", avatar: "SR" },
  { id: "nina", label: "نينا باتيل", avatar: "NP" },
  { id: "alex", label: "أليكس كيم", avatar: "AK" },
  { id: "morgan", label: "مورغان لي", avatar: "ML" },
  { id: "diego", label: "دييغو رويز", avatar: "DR" },
  { id: "sofia", label: "صوفيا بارك", avatar: "SP" },
] as const satisfies readonly WrapDemoItem[];

const selectedWrapTab6 = ref("overview");
const wrapTabsMenuOpen6 = ref(false);
const wrapTabsTriggerRef6 = ref<HTMLElement | null>(null);
const wrapTabsMenuRef6 = ref<HTMLElement | null>(null);
const wrapWidth6 = ref(360);
const wrapRtl6 = ref(false);
const wrapHeight7 = ref("58px");
const wrapWidth7 = ref(420);
const wrapRtl7 = ref(false);
const wrapExpanded7 = ref(false);

const wrapTabItems6 = computed(() => {
  return wrapRtl6.value ? wrapTabItemsAr : wrapTabItems;
});

const wrapInviteeItems7 = computed(() => {
  return wrapRtl7.value ? wrapInviteeItemsAr : wrapInviteeItems;
});

function wrapToggleLabel(expanded: boolean, rtl = false): string {
  if (rtl) {
    return expanded ? "أقل" : "المزيد";
  }

  return expanded ? "Less" : "More";
}

function wrapInviteePrefixLabel(rtl: boolean): string {
  return rtl ? "المراجعون" : "Reviewers";
}

function wrapTabsTriggerLabel(rtl: boolean): string {
  return rtl ? "إظهار التبويبات المخفية" : "Show hidden tabs";
}

function heroTaglineWordIndex(word: HeroTaglineWord): number {
  return heroTaglineWords.indexOf(word);
}

function heroTaglineText(): string {
  return `${heroTaglineTextStart} ${heroTaglineWord.value} ${heroTaglineTextEnd}`;
}

function heroTaglineMeasuredText(word: HeroTaglineWord): string {
  return `${heroTaglineTextStart} ${word} ${heroTaglineTextEnd}`;
}

function clearHeroTaglineTimer(): void {
  if (heroTaglineTimer !== null) {
    clearTimeout(heroTaglineTimer);
    heroTaglineTimer = null;
  }
}

function scheduleHeroTagline(delay: number, callback: () => void): void {
  clearHeroTaglineTimer();
  heroTaglineTimer = window.setTimeout(callback, delay);
}

async function waitForFonts(): Promise<void> {
  await document.fonts?.ready;
}

function measureWidth(selector: string): number | null {
  const element = heroTaglineMeasureRef.value?.querySelector(selector);

  return element instanceof HTMLElement ? element.getBoundingClientRect().width : null;
}

function measureMinWidth(selector: string): number | null {
  const element = heroTaglineMeasureRef.value?.querySelector(selector);

  if (!(element instanceof HTMLElement)) {
    return null;
  }

  const minWidth = Number.parseFloat(getComputedStyle(element).minWidth);
  return Number.isFinite(minWidth) ? minWidth : null;
}

function measureHeroTaglineWidths(): void {
  const measuredExpandedWidths = createHeroTaglineWidthMap();

  for (const word of heroTaglineWords) {
    measuredExpandedWidths[word] =
      Math.ceil(measureWidth(`[data-measure-word="${word}"]`) ?? 0) + heroTaglineExpandedPadding;
  }

  const startWidth = measureWidth('[data-measure-part="start"]') ?? 0;
  const endWidth = measureWidth('[data-measure-part="end"]') ?? 0;
  const ellipsisWidth = measureWidth('[data-measure-part="ellipsis"]') ?? 0;
  const bodyMinWidth = measureMinWidth('.hero-tagline-measure-item [data-part="body"]') ?? 0;
  const collapsedBodyWidth = Math.max(ellipsisWidth, bodyMinWidth);

  heroTaglineExpandedWidths.value = measuredExpandedWidths;
  heroTaglineCollapsedWidth.value = Math.ceil(startWidth + endWidth + collapsedBodyWidth);
  heroTaglineMeasured.value = true;
}

function syncHeroTaglineWidth(): void {
  if (!heroTaglineMeasured.value) {
    heroTaglineWidth.value = null;
    return;
  }

  heroTaglineWidth.value = heroTaglineCollapsed.value
    ? heroTaglineCollapsedWidth.value
    : heroTaglineExpandedWidths.value[heroTaglineWord.value];
}

function setHeroTaglineWord(word: HeroTaglineWord): void {
  heroTaglineWord.value = word;
  heroTaglineCollapsed.value = false;
  syncHeroTaglineWidth();
}

function collapseHeroTagline(): void {
  heroTaglineCollapsed.value = true;
  syncHeroTaglineWidth();
}

function animateHeroTagline(index: number): void {
  if (heroTaglineReducedMotion.value || heroTaglinePaused.value || !heroTaglineMeasured.value) {
    return;
  }

  const word = heroTaglineWords.at(index % heroTaglineWords.length) ?? defaultHeroTaglineWord;
  setHeroTaglineWord(word);

  scheduleHeroTagline(heroTaglineTiming.expandedHold, () => {
    if (heroTaglineReducedMotion.value || heroTaglinePaused.value) {
      return;
    }

    collapseHeroTagline();

    scheduleHeroTagline(heroTaglineTiming.transition, () => {
      if (heroTaglineReducedMotion.value || heroTaglinePaused.value) {
        return;
      }

      const nextWord =
        heroTaglineWords.at((index + 1) % heroTaglineWords.length) ?? defaultHeroTaglineWord;
      scheduleHeroTagline(heroTaglineTiming.collapsedHold, () => {
        if (heroTaglineReducedMotion.value || heroTaglinePaused.value) {
          return;
        }

        heroTaglineWord.value = nextWord;

        scheduleHeroTagline(heroTaglineTiming.swapSettle, () => {
          if (heroTaglineReducedMotion.value || heroTaglinePaused.value) {
            return;
          }

          heroTaglineCollapsed.value = false;
          syncHeroTaglineWidth();

          scheduleHeroTagline(heroTaglineTiming.transition, () => {
            if (heroTaglineReducedMotion.value || heroTaglinePaused.value) {
              return;
            }

            animateHeroTagline(index + 1);
          });
        });
      });
    });
  });
}

function startHeroTagline(reset = false): void {
  if (heroTaglineReducedMotion.value || heroTaglinePaused.value || !heroTaglineMeasured.value) {
    return;
  }

  clearHeroTaglineTimer();
  const startIndex = reset ? 0 : Math.max(heroTaglineWordIndex(heroTaglineWord.value), 0);
  animateHeroTagline(startIndex);
}

function pauseHeroTagline(): void {
  heroTaglinePaused.value = true;
  clearHeroTaglineTimer();
}

function resumeHeroTagline(): void {
  if (heroTaglineReducedMotion.value) {
    return;
  }

  heroTaglinePaused.value = false;
  startHeroTagline();
}

function handleHeroTaglineFocusOut(event: FocusEvent): void {
  const currentTarget = event.currentTarget;
  if (!(currentTarget instanceof HTMLElement)) {
    return;
  }

  const relatedTarget = event.relatedTarget;
  if (relatedTarget instanceof Node && currentTarget.contains(relatedTarget)) {
    return;
  }

  resumeHeroTagline();
}

function applyHeroTaglineMotionPreference(matches: boolean): void {
  heroTaglineReducedMotion.value = matches;

  if (matches) {
    clearHeroTaglineTimer();
    setHeroTaglineWord(defaultHeroTaglineWord);
    return;
  }

  startHeroTagline(true);
}

function handleHeroTaglineMotionChange(event: MediaQueryListEvent): void {
  applyHeroTaglineMotionPreference(event.matches);
}

function selectWrapTab6(id: string): void {
  selectedWrapTab6.value = id;
  wrapTabsMenuOpen6.value = false;
}

function isSelectedWrapTabHidden6(hiddenItems: readonly WrapDemoItem[]): boolean {
  return hiddenItems.some((item) => item.id === selectedWrapTab6.value);
}

function closeWrapTabsMenu6(): void {
  wrapTabsMenuOpen6.value = false;
}

function toggleWrapTabsMenu6(): void {
  wrapTabsMenuOpen6.value = !wrapTabsMenuOpen6.value;
}

function handleWrapTabsPointerDown(event: PointerEvent): void {
  if (!wrapTabsMenuOpen6.value) {
    return;
  }

  const target = event.target;
  if (!(target instanceof Node)) {
    return;
  }

  if (wrapTabsTriggerRef6.value?.contains(target) || wrapTabsMenuRef6.value?.contains(target)) {
    return;
  }

  closeWrapTabsMenu6();
}

function handleWrapTabsKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    closeWrapTabsMenu6();
  }
}

onMounted(() => {
  heroTaglineMounted = true;
  document.addEventListener("pointerdown", handleWrapTabsPointerDown);
  document.addEventListener("keydown", handleWrapTabsKeydown);

  heroTaglineMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  heroTaglineResizeObserver = new ResizeObserver(() => {
    if (!heroTaglineFontsReady) {
      syncHeroTaglineWidth();
      return;
    }

    measureHeroTaglineWidths();
    syncHeroTaglineWidth();
  });

  if (heroTaglineShellRef.value) {
    heroTaglineResizeObserver.observe(heroTaglineShellRef.value);
  }

  heroTaglineMotionQuery.addEventListener("change", handleHeroTaglineMotionChange);

  void (async () => {
    await waitForFonts();

    if (!heroTaglineMounted) {
      return;
    }

    heroTaglineFontsReady = true;
    measureHeroTaglineWidths();
    syncHeroTaglineWidth();
    applyHeroTaglineMotionPreference(heroTaglineMotionQuery?.matches ?? false);
  })();
});

onBeforeUnmount(() => {
  heroTaglineFontsReady = false;
  heroTaglineMounted = false;
  document.removeEventListener("pointerdown", handleWrapTabsPointerDown);
  document.removeEventListener("keydown", handleWrapTabsKeydown);

  clearHeroTaglineTimer();
  heroTaglineMotionQuery?.removeEventListener("change", handleHeroTaglineMotionChange);
  heroTaglineResizeObserver?.disconnect();
});

type PkgManager = "vp" | "npm" | "pnpm" | "yarn" | "bun" | "agent";

const pkgManager = ref<PkgManager>("npm");

const pkgManagers: { id: PkgManager; label: string }[] = [
  { id: "vp", label: "vp" },
  { id: "npm", label: "npm" },
  { id: "pnpm", label: "pnpm" },
  { id: "yarn", label: "yarn" },
  { id: "bun", label: "bun" },
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
    case "bun":
      return "bun add vue-clamp";
    case "agent":
      return "Add the npm package `vue-clamp` to this project.";
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

const wrapCodeExample = [
  '<script setup lang="ts">',
  "import { ref } from 'vue'",
  "import { WrapClamp } from 'vue-clamp'",
  "",
  "const expanded = ref(false)",
  "const labels = [",
  "  { id: 'perf', label: 'Performance' },",
  "  { id: 'a11y', label: 'Accessibility' },",
  "  { id: 'docs', label: 'Docs' },",
  "  { id: 'qa', label: 'Needs QA' },",
  "]",
  "<" + "/script>",
  "",
  "<template>",
  '  <WrapClamp v-model:expanded="expanded" :items="labels" item-key="id" :max-lines="2">',
  '    <template #item="{ item }">',
  '      <span class="tag">{{ item.label }}</span>',
  "    </template>",
  '    <template #after="{ expanded, clamped, hiddenItems, toggle }">',
  '      <button v-if="expanded || clamped" type="button" @click="toggle">',
  `        {{ expanded ? 'Less' : \`+\${hiddenItems.length} more\` }}`,
  "      </button>",
  "    </template>",
  "  </WrapClamp>",
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

const highlightedWrapCode = computed(() => {
  return shiki.codeToHtml(wrapCodeExample, {
    lang: "vue",
    theme: websiteShikiTheme.name,
  });
});
</script>

<template>
  <div class="page" lang="en">
    <!-- Hero -->
    <header class="hero">
      <div class="hero-copy">
        <h1 class="hero-title">&lt;vue-clamp&gt;</h1>
        <p class="sr-only">
          Clamping messages, excerpts, summaries, filenames, emails, paths, tags, filters, and chips
          in Vue.
        </p>
        <div
          ref="heroTaglineShellRef"
          class="hero-tagline-shell"
          aria-hidden="true"
          @mouseenter="pauseHeroTagline"
          @mouseleave="resumeHeroTagline"
          @focusin="pauseHeroTagline"
          @focusout="handleHeroTaglineFocusOut"
        >
          <span
            class="hero-tagline-frame"
            :style="{
              '--hero-tagline-transition': heroTaglineMeasured
                ? `${heroTaglineTiming.transition}ms`
                : '0ms',
              width: heroTaglineWidth === null ? undefined : `${heroTaglineWidth}px`,
            }"
          >
            <InlineClamp
              :text="heroTaglineText()"
              :split="splitHeroTagline"
              as="span"
              class="hero-tagline hero-tagline-live"
              style="width: 100%"
            />
          </span>
        </div>
        <div ref="heroTaglineMeasureRef" class="hero-tagline-measure" aria-hidden="true">
          <InlineClamp
            v-for="word in heroTaglineWords"
            :key="word"
            :data-measure-word="word"
            :text="heroTaglineMeasuredText(word)"
            :split="splitHeroTagline"
            as="span"
            class="hero-tagline hero-tagline-measure-item"
          />
          <div class="hero-tagline-measure-parts">
            <span class="hero-tagline-measure-text" data-measure-part="start">
              {{ heroTaglineTextStart }}
            </span>
            <span class="hero-tagline-measure-text" data-measure-part="end">
              {{ heroTaglineTextEnd }}
            </span>
            <span class="hero-tagline-measure-text" data-measure-part="ellipsis">…</span>
          </div>
        </div>
        <nav class="hero-links" aria-label="Project links">
          <a
            class="hero-link"
            href="https://github.com/Justineo/vue-clamp"
            target="_blank"
            rel="noopener"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path :d="siGithub.path" fill="currentColor" />
            </svg>
            GitHub
            <ArrowUpRight :size="11" :stroke-width="1.75" aria-hidden="true" />
          </a>
          <span class="hero-link-separator" aria-hidden="true">/</span>
          <a
            class="hero-link"
            href="https://npmx.dev/package/vue-clamp"
            target="_blank"
            rel="noopener"
          >
            <svg
              class="hero-link-mark hero-link-mark-npmx"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <rect class="hero-link-mark-bg" x="1.5" y="1.5" width="21" height="21" rx="4" />
              <rect class="hero-link-mark-dot" x="5.25" y="14.5" width="3" height="3" rx="0.75" />
              <path class="hero-link-mark-slash" d="M16.5 5.5H18.6L13.25 18.5H11.1L16.5 5.5Z" />
            </svg>
            npmx
            <ArrowUpRight :size="11" :stroke-width="1.75" aria-hidden="true" />
          </a>
        </nav>
      </div>
    </header>

    <!-- Features -->
    <section class="section">
      <h2 class="section-title" id="features"><a href="#features">#</a> Choose a surface</h2>
      <ul class="features-list">
        <li>
          <code>LineClamp</code> for previews, cards, lists, and expandable copy that should follow
          real browser wrapping.
        </li>
        <li>
          <code>InlineClamp</code> for one-line labels where the start or end should stay visible,
          such as filenames, paths, and email addresses.
        </li>
        <li>
          <code>WrapClamp</code> for wrapped chips, filters, invitees, and token rails where each
          item must stay whole.
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
      <div class="reference-root" data-reference-shell>
        <h2 class="section-title reference-title" id="components">
          <a href="#components">#</a> Components
        </h2>
        <div ref="referenceTabsAnchorRef" class="reference-tabs-anchor" aria-hidden="true"></div>
        <div class="reference-tabs-row">
          <ComponentTabs
            :model-value="activeSurface"
            aria-label="Component tabs"
            :options="surfaceOptions"
            @update:modelValue="updateActiveSurface"
          />
        </div>

        <div class="reference-body">
          <section class="reference-section" data-reference-panel="demo">
            <h3 class="subsection-title">Demo</h3>

            <template v-if="activeSurface === 'line'">
              <div class="demo-surface">
                <div class="demo-example-list">
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
                      <div class="demo-output width-guide" :style="{ width: `${width1}px` }">
                        <LineClamp
                          class="demo-clamp"
                          :class="{ hyphens: hyphens1, rtl: rtl1 }"
                          :text="lineDemoText(rtl1)"
                          :max-lines="lines1"
                          :style="{ width: `${width1}px`, maxWidth: '100%' }"
                        >
                          <template #after="{ toggle, expanded, clamped }">
                            <button v-if="expanded || clamped" class="toggle-btn" @click="toggle">
                              {{ lineToggleLabel(expanded, rtl1) }}
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
                        :style="{ width: `${width2}px` }"
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
                            <span class="badge">{{ lineBadgeLabel(rtl2) }}</span>
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
                      <div class="demo-output width-guide" :style="{ width: `${width3}px` }">
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
                      <div class="demo-output width-guide" :style="{ width: `${width4}px` }">
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
                              {{ lineToggleLabel(expanded, rtl4) }}
                            </button>
                          </template>
                        </LineClamp>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <div v-else-if="activeSurface === 'inline'" class="demo-surface" data-demo="inline">
              <div class="demo-shared-controls">
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

              <div class="demo-example-list">
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
                          :style="{ width: `${inlineWidth5}px` }"
                        >
                          <InlineClamp class="demo-inline" :text="example.text" />
                        </div>
                      </div>
                      <div class="comparison-panel" data-inline-mode="split">
                        <div class="comparison-label">Split</div>
                        <div
                          class="demo-output width-guide"
                          :style="{ width: `${inlineWidth5}px` }"
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
            </div>

            <div v-else class="demo-surface" data-demo="wrap">
              <div class="demo-example-list">
                <div class="demo-block" data-wrap-example="tabs">
                  <div class="demo-label">
                    tabs / fixed one-line / hidden items in <code>after</code>
                  </div>
                  <div class="demo-controls">
                    <label class="control">
                      <span class="control-label">Width</span>
                      <span class="control-row">
                        <input
                          v-model.number="wrapWidth6"
                          class="control-range"
                          type="range"
                          min="240"
                          max="600"
                        />
                        <span class="control-value">{{ wrapWidth6 }}px</span>
                      </span>
                    </label>
                    <div class="control-row">
                      <label class="control-check">
                        <input v-model="wrapRtl6" type="checkbox" />
                        <span>RTL</span>
                      </label>
                    </div>
                  </div>
                  <div class="demo-preview">
                    <div class="demo-output width-guide" :style="{ width: `${wrapWidth6}px` }">
                      <WrapClamp
                        class="demo-wrap wrap-tabs"
                        :class="{ rtl: wrapRtl6 }"
                        :items="wrapTabItems6"
                        item-key="id"
                        :max-lines="1"
                      >
                        <template #item="{ item }">
                          <button
                            class="wrap-tab"
                            :class="{ active: item.id === selectedWrapTab6 }"
                            type="button"
                            role="tab"
                            :aria-selected="item.id === selectedWrapTab6"
                            @click="selectWrapTab6(item.id)"
                          >
                            {{ item.label }}
                          </button>
                        </template>
                        <template #after="{ clamped, hiddenItems }">
                          <span
                            v-if="clamped"
                            class="wrap-tabs-after"
                            :class="{ 'is-active': isSelectedWrapTabHidden6(hiddenItems) }"
                          >
                            <button
                              class="wrap-tab-trigger"
                              data-wrap-tabs-trigger
                              type="button"
                              ref="wrapTabsTriggerRef6"
                              :aria-expanded="wrapTabsMenuOpen6"
                              :aria-label="wrapTabsTriggerLabel(wrapRtl6)"
                              @click="toggleWrapTabsMenu6"
                            >
                              <Ellipsis :size="16" :stroke-width="2" aria-hidden="true" />
                            </button>
                            <Teleport to="body">
                              <div
                                v-if="wrapTabsMenuOpen6"
                                ref="wrapTabsMenuRef6"
                                class="wrap-tabs-menu"
                                data-wrap-tabs-menu
                              >
                                <button
                                  v-for="item in hiddenItems"
                                  :key="item.id"
                                  class="wrap-tabs-menu-item"
                                  :class="{ active: item.id === selectedWrapTab6 }"
                                  type="button"
                                  :aria-pressed="item.id === selectedWrapTab6"
                                  @click="selectWrapTab6(item.id)"
                                >
                                  {{ item.label }}
                                </button>
                              </div>
                            </Teleport>
                          </span>
                        </template>
                      </WrapClamp>
                    </div>
                  </div>
                </div>

                <div class="demo-block" data-wrap-example="invitees">
                  <div class="demo-label">
                    max-height / slot <code>before</code> / expandable selection
                  </div>
                  <div class="demo-controls">
                    <label class="control">
                      <span class="control-label">Max height</span>
                      <input v-model="wrapHeight7" class="control-input" />
                    </label>
                    <label class="control">
                      <span class="control-label">Width</span>
                      <span class="control-row">
                        <input
                          v-model.number="wrapWidth7"
                          class="control-range"
                          type="range"
                          min="260"
                          max="560"
                        />
                        <span class="control-value">{{ wrapWidth7 }}px</span>
                      </span>
                    </label>
                    <div class="control-row">
                      <label class="control-check">
                        <input v-model="wrapExpanded7" type="checkbox" />
                        <span>Expanded</span>
                      </label>
                      <label class="control-check">
                        <input v-model="wrapRtl7" type="checkbox" />
                        <span>RTL</span>
                      </label>
                    </div>
                  </div>
                  <div class="demo-preview">
                    <div
                      class="demo-output width-guide height-guide"
                      :style="{ width: `${wrapWidth7}px` }"
                    >
                      <WrapClamp
                        class="demo-wrap"
                        :class="{ rtl: wrapRtl7 }"
                        :items="wrapInviteeItems7"
                        item-key="id"
                        :max-height="wrapHeight7"
                        v-model:expanded="wrapExpanded7"
                        :style="{ width: `${wrapWidth7}px`, maxWidth: '100%' }"
                      >
                        <template #before>
                          <span class="wrap-prefix" data-wrap-prefix>{{
                            wrapInviteePrefixLabel(wrapRtl7)
                          }}</span>
                        </template>
                        <template #item="{ item }">
                          <span class="wrap-pill wrap-person">
                            <span v-if="item.avatar" class="wrap-avatar">{{ item.avatar }}</span>
                            {{ item.label }}
                          </span>
                        </template>
                        <template #after="{ expanded, clamped, toggle }">
                          <button
                            v-if="expanded || clamped"
                            class="wrap-pill wrap-summary wrap-summary-button"
                            data-wrap-toggle
                            type="button"
                            @click="toggle"
                          >
                            {{ wrapToggleLabel(expanded, wrapRtl7) }}
                          </button>
                        </template>
                      </WrapClamp>
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
              v-else-if="activeSurface === 'inline'"
              :code="inlineCodeExample"
              :html="highlightedInlineCode"
              label="InlineClamp example"
              block-id="inline-example"
            />
            <CodeBlock
              v-else
              :code="wrapCodeExample"
              :html="highlightedWrapCode"
              label="WrapClamp example"
              block-id="wrap-example"
            />
          </section>

          <section class="reference-section" data-reference-panel="api">
            <template v-if="activeSurface === 'line'">
              <p class="api-summary" data-api-summary="line">
                Use for real multiline text where the browser decides wrapping. Pick
                <code>max-lines</code> for text-driven limits or <code>max-height</code> for
                layout-driven limits.
              </p>

              <section class="api-group">
                <h3 class="subsection-title">Props</h3>
                <div class="api-list">
                  <div class="api-entry">
                    <div class="api-entry-header">
                      <div class="api-entry-name"><code>as</code></div>
                      <div class="api-entry-meta">
                        <span class="api-meta-pair">
                          <span class="api-meta-label">Type</span>
                          <code>string</code>
                        </span>
                        <span class="api-meta-pair">
                          <span class="api-meta-label">Default</span>
                          <code>'div'</code>
                        </span>
                      </div>
                    </div>
                    <p class="api-entry-copy">Root tag name.</p>
                  </div>
                  <div class="api-entry">
                    <div class="api-entry-header">
                      <div class="api-entry-name"><code>text</code></div>
                      <div class="api-entry-meta">
                        <span class="api-meta-pair">
                          <span class="api-meta-label">Type</span>
                          <code>string</code>
                        </span>
                        <span class="api-meta-pair">
                          <span class="api-meta-label">Default</span>
                          <code>''</code>
                        </span>
                      </div>
                    </div>
                    <p class="api-entry-copy">Source string to clamp.</p>
                  </div>
                  <div class="api-entry">
                    <div class="api-entry-header">
                      <div class="api-entry-name"><code>max-lines</code></div>
                      <div class="api-entry-meta">
                        <span class="api-meta-pair">
                          <span class="api-meta-label">Type</span>
                          <code>number</code>
                        </span>
                      </div>
                    </div>
                    <p class="api-entry-copy">Maximum number of visible lines.</p>
                  </div>
                  <div class="api-entry">
                    <div class="api-entry-header">
                      <div class="api-entry-name"><code>max-height</code></div>
                      <div class="api-entry-meta">
                        <span class="api-meta-pair">
                          <span class="api-meta-label">Type</span>
                          <code>number | string</code>
                        </span>
                      </div>
                    </div>
                    <p class="api-entry-copy">
                      Maximum visible height. Numbers use <code>px</code>.
                    </p>
                  </div>
                  <div class="api-entry">
                    <div class="api-entry-header">
                      <div class="api-entry-name"><code>ellipsis</code></div>
                      <div class="api-entry-meta">
                        <span class="api-meta-pair">
                          <span class="api-meta-label">Type</span>
                          <code>string</code>
                        </span>
                        <span class="api-meta-pair">
                          <span class="api-meta-label">Default</span>
                          <code>'…'</code>
                        </span>
                      </div>
                    </div>
                    <p class="api-entry-copy">Ellipsis inserted into clamped text.</p>
                  </div>
                  <div class="api-entry">
                    <div class="api-entry-header">
                      <div class="api-entry-name"><code>location</code></div>
                      <div class="api-entry-meta">
                        <span class="api-meta-pair">
                          <span class="api-meta-label">Type</span>
                          <code>number | 'start' | 'middle' | 'end'</code>
                        </span>
                        <span class="api-meta-pair">
                          <span class="api-meta-label">Default</span>
                          <code>'end'</code>
                        </span>
                      </div>
                    </div>
                    <p class="api-entry-copy">
                      Ellipsis position. Keywords map to <code>0</code>, <code>0.5</code>, and
                      <code>1</code>.
                    </p>
                  </div>
                  <div class="api-entry">
                    <div class="api-entry-header">
                      <div class="api-entry-name"><code>expanded</code></div>
                      <div class="api-entry-meta">
                        <span class="api-meta-pair">
                          <span class="api-meta-label">Type</span>
                          <code>boolean</code>
                        </span>
                        <span class="api-meta-pair">
                          <span class="api-meta-label">Default</span>
                          <code>false</code>
                        </span>
                      </div>
                    </div>
                    <p class="api-entry-copy">
                      Shows the full text. Supports <code>v-model</code>.
                    </p>
                  </div>
                </div>
              </section>

              <section class="api-group">
                <h3 class="subsection-title">Slots</h3>
                <div class="api-list">
                  <div class="api-entry">
                    <div class="api-entry-header">
                      <div class="api-entry-name"><code>before</code></div>
                    </div>
                    <div class="api-entry-copy">
                      <p>Leading inline content measured with the text flow.</p>
                      <dl class="api-detail-list">
                        <div class="api-detail-item">
                          <dt class="api-detail-term">Slot props</dt>
                          <dd class="api-detail-desc">
                            <dl class="api-subdetail-list">
                              <div class="api-subdetail-item">
                                <dt class="api-subdetail-term">
                                  <code>expand: () =&gt; void</code>
                                </dt>
                                <dd class="api-subdetail-desc">Expands to the full text.</dd>
                              </div>
                              <div class="api-subdetail-item">
                                <dt class="api-subdetail-term">
                                  <code>collapse: () =&gt; void</code>
                                </dt>
                                <dd class="api-subdetail-desc">Returns to the clamped state.</dd>
                              </div>
                              <div class="api-subdetail-item">
                                <dt class="api-subdetail-term">
                                  <code>toggle: () =&gt; void</code>
                                </dt>
                                <dd class="api-subdetail-desc">
                                  Switches between expanded and collapsed.
                                </dd>
                              </div>
                              <div class="api-subdetail-item">
                                <dt class="api-subdetail-term"><code>clamped: boolean</code></dt>
                                <dd class="api-subdetail-desc">
                                  Whether the collapsed output is truncated.
                                </dd>
                              </div>
                              <div class="api-subdetail-item">
                                <dt class="api-subdetail-term"><code>expanded: boolean</code></dt>
                                <dd class="api-subdetail-desc">
                                  Whether the full text is currently shown.
                                </dd>
                              </div>
                            </dl>
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                  <div class="api-entry">
                    <div class="api-entry-header">
                      <div class="api-entry-name"><code>after</code></div>
                    </div>
                    <div class="api-entry-copy">
                      <p>Trailing inline content, usually toggle UI.</p>
                      <dl class="api-detail-list">
                        <div class="api-detail-item">
                          <dt class="api-detail-term">Slot props</dt>
                          <dd class="api-detail-desc">Same as <code>before</code>.</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </div>
              </section>

              <section class="api-group">
                <h3 class="subsection-title">Events</h3>
                <div class="api-list">
                  <div class="api-entry">
                    <div class="api-entry-header">
                      <div class="api-entry-name"><code>clampchange</code></div>
                      <div class="api-entry-meta">
                        <span class="api-meta-pair">
                          <span class="api-meta-label">Payload</span>
                          <code>(clamped: boolean)</code>
                        </span>
                      </div>
                    </div>
                    <p class="api-entry-copy">Emitted when truncation turns on or off.</p>
                  </div>
                  <div class="api-entry">
                    <div class="api-entry-header">
                      <div class="api-entry-name"><code>update:expanded</code></div>
                      <div class="api-entry-meta">
                        <span class="api-meta-pair">
                          <span class="api-meta-label">Payload</span>
                          <code>(expanded: boolean)</code>
                        </span>
                      </div>
                    </div>
                    <p class="api-entry-copy">Emitted when expansion changes.</p>
                  </div>
                </div>
              </section>
            </template>

            <template v-else-if="activeSurface === 'inline'">
              <p class="api-summary" data-api-summary="inline">
                Use for single-line text where the start or end should stay visible. It has no slots
                or events, and <code>split(text)</code> should stay pure because only
                <code>body</code> shrinks.
              </p>

              <section class="api-group">
                <h3 class="subsection-title">Props</h3>
                <div class="api-list">
                  <div class="api-entry">
                    <div class="api-entry-header">
                      <div class="api-entry-name"><code>as</code></div>
                      <div class="api-entry-meta">
                        <span class="api-meta-pair">
                          <span class="api-meta-label">Type</span>
                          <code>string</code>
                        </span>
                        <span class="api-meta-pair">
                          <span class="api-meta-label">Default</span>
                          <code>'span'</code>
                        </span>
                      </div>
                    </div>
                    <p class="api-entry-copy">Root tag name.</p>
                  </div>
                  <div class="api-entry">
                    <div class="api-entry-header">
                      <div class="api-entry-name"><code>text</code></div>
                      <div class="api-entry-meta">
                        <span class="api-meta-pair">
                          <span class="api-meta-flag">required</span>
                        </span>
                        <span class="api-meta-pair">
                          <span class="api-meta-label">Type</span>
                          <code>string</code>
                        </span>
                      </div>
                    </div>
                    <p class="api-entry-copy">Full one-line source text.</p>
                  </div>
                  <div class="api-entry">
                    <div class="api-entry-header">
                      <div class="api-entry-name"><code>split</code></div>
                      <div class="api-entry-meta">
                        <span class="api-meta-pair">
                          <span class="api-meta-label">Type</span>
                          <code>(text: string) =&gt; { start?, body, end? }</code>
                        </span>
                      </div>
                    </div>
                    <div class="api-entry-copy">
                      <p>
                        Optional splitter for dividing one line into fixed and shrinkable parts.
                      </p>
                      <dl class="api-detail-list">
                        <div class="api-detail-item">
                          <dt class="api-detail-term">Return fields</dt>
                          <dd class="api-detail-desc">
                            <dl class="api-subdetail-list">
                              <div class="api-subdetail-item">
                                <dt class="api-subdetail-term"><code>start?: string</code></dt>
                                <dd class="api-subdetail-desc">Optional fixed leading segment.</dd>
                              </div>
                              <div class="api-subdetail-item">
                                <dt class="api-subdetail-term">
                                  <code>body: string</code>
                                  <span class="api-meta-flag">required</span>
                                </dt>
                                <dd class="api-subdetail-desc">Required shrinkable segment.</dd>
                              </div>
                              <div class="api-subdetail-item">
                                <dt class="api-subdetail-term"><code>end?: string</code></dt>
                                <dd class="api-subdetail-desc">Optional fixed trailing segment.</dd>
                              </div>
                            </dl>
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </div>
              </section>
            </template>

            <template v-else>
              <p class="api-summary" data-api-summary="wrap">
                Use for wrapped items that must stay whole. Render each visible item through
                <code>item</code>, and use <code>after</code> for <code>+N</code>,
                <code>More</code>, or <code>Less</code> UI.
              </p>

              <section class="api-group">
                <h3 class="subsection-title">Props</h3>
                <div class="api-list">
                  <div class="api-entry">
                    <div class="api-entry-header">
                      <div class="api-entry-name"><code>as</code></div>
                      <div class="api-entry-meta">
                        <span class="api-meta-pair">
                          <span class="api-meta-label">Type</span>
                          <code>string</code>
                        </span>
                        <span class="api-meta-pair">
                          <span class="api-meta-label">Default</span>
                          <code>'div'</code>
                        </span>
                      </div>
                    </div>
                    <p class="api-entry-copy">Root tag name.</p>
                  </div>
                  <div class="api-entry">
                    <div class="api-entry-header">
                      <div class="api-entry-name"><code>items</code></div>
                      <div class="api-entry-meta">
                        <span class="api-meta-pair">
                          <span class="api-meta-label">Type</span>
                          <code>readonly T[]</code>
                        </span>
                        <span class="api-meta-pair">
                          <span class="api-meta-label">Default</span>
                          <code>[]</code>
                        </span>
                      </div>
                    </div>
                    <div class="api-entry-copy">
                      <p>
                        Ordered source items. Each item stays whole. <code>T</code> is inferred from
                        <code>items</code>, so slot props like <code>item</code> and
                        <code>hiddenItems</code> use the same shape.
                      </p>
                    </div>
                  </div>
                  <div class="api-entry">
                    <div class="api-entry-header">
                      <div class="api-entry-name"><code>item-key</code></div>
                      <div class="api-entry-meta">
                        <span class="api-meta-pair">
                          <span class="api-meta-label">Type</span>
                          <code>string | (item, index) =&gt; string | number</code>
                        </span>
                      </div>
                    </div>
                    <p class="api-entry-copy">
                      Stable key resolver for custom item rendering. With a string key such as
                      <code>'id'</code>, each <code>T</code> should expose that field as a string or
                      number. A function receives <code>(item: T, index: number)</code> and returns
                      a string or number key.
                    </p>
                  </div>
                  <div class="api-entry">
                    <div class="api-entry-header">
                      <div class="api-entry-name"><code>max-lines</code></div>
                      <div class="api-entry-meta">
                        <span class="api-meta-pair">
                          <span class="api-meta-label">Type</span>
                          <code>number</code>
                        </span>
                      </div>
                    </div>
                    <p class="api-entry-copy">Maximum number of visible wrapped lines.</p>
                  </div>
                  <div class="api-entry">
                    <div class="api-entry-header">
                      <div class="api-entry-name"><code>max-height</code></div>
                      <div class="api-entry-meta">
                        <span class="api-meta-pair">
                          <span class="api-meta-label">Type</span>
                          <code>number | string</code>
                        </span>
                      </div>
                    </div>
                    <p class="api-entry-copy">
                      Maximum visible height. Numbers use <code>px</code>.
                    </p>
                  </div>
                  <div class="api-entry">
                    <div class="api-entry-header">
                      <div class="api-entry-name"><code>expanded</code></div>
                      <div class="api-entry-meta">
                        <span class="api-meta-pair">
                          <span class="api-meta-label">Type</span>
                          <code>boolean</code>
                        </span>
                        <span class="api-meta-pair">
                          <span class="api-meta-label">Default</span>
                          <code>false</code>
                        </span>
                      </div>
                    </div>
                    <p class="api-entry-copy">
                      Shows the full item list. Supports <code>v-model</code>.
                    </p>
                  </div>
                </div>
              </section>

              <section class="api-group">
                <h3 class="subsection-title">Slots</h3>
                <div class="api-list">
                  <div class="api-entry">
                    <div class="api-entry-header">
                      <div class="api-entry-name"><code>item</code></div>
                    </div>
                    <div class="api-entry-copy">
                      <p>Renders each visible source item.</p>
                      <dl class="api-detail-list">
                        <div class="api-detail-item">
                          <dt class="api-detail-term">Slot props</dt>
                          <dd class="api-detail-desc">
                            <dl class="api-subdetail-list">
                              <div class="api-subdetail-item">
                                <dt class="api-subdetail-term"><code>item: T</code></dt>
                                <dd class="api-subdetail-desc">
                                  Current visible item, using the same <code>T</code> shape as
                                  <code>items</code>.
                                </dd>
                              </div>
                              <div class="api-subdetail-item">
                                <dt class="api-subdetail-term"><code>index: number</code></dt>
                                <dd class="api-subdetail-desc">Zero-based visible index.</dd>
                              </div>
                            </dl>
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                  <div class="api-entry">
                    <div class="api-entry-header">
                      <div class="api-entry-name"><code>before</code></div>
                    </div>
                    <div class="api-entry-copy">
                      <p>Leading atomic content measured with the wrapped item flow.</p>
                      <dl class="api-detail-list">
                        <div class="api-detail-item">
                          <dt class="api-detail-term">Slot props</dt>
                          <dd class="api-detail-desc">
                            <dl class="api-subdetail-list">
                              <div class="api-subdetail-item">
                                <dt class="api-subdetail-term">
                                  <code>expand: () =&gt; void</code>
                                </dt>
                                <dd class="api-subdetail-desc">Expands to the full item list.</dd>
                              </div>
                              <div class="api-subdetail-item">
                                <dt class="api-subdetail-term">
                                  <code>collapse: () =&gt; void</code>
                                </dt>
                                <dd class="api-subdetail-desc">
                                  Returns to the clamped item list.
                                </dd>
                              </div>
                              <div class="api-subdetail-item">
                                <dt class="api-subdetail-term">
                                  <code>toggle: () =&gt; void</code>
                                </dt>
                                <dd class="api-subdetail-desc">
                                  Switches between expanded and collapsed.
                                </dd>
                              </div>
                              <div class="api-subdetail-item">
                                <dt class="api-subdetail-term"><code>clamped: boolean</code></dt>
                                <dd class="api-subdetail-desc">
                                  Whether any items are currently hidden.
                                </dd>
                              </div>
                              <div class="api-subdetail-item">
                                <dt class="api-subdetail-term"><code>expanded: boolean</code></dt>
                                <dd class="api-subdetail-desc">
                                  Whether the full item list is shown.
                                </dd>
                              </div>
                              <div class="api-subdetail-item">
                                <dt class="api-subdetail-term">
                                  <code>hiddenItems: readonly T[]</code>
                                </dt>
                                <dd class="api-subdetail-desc">
                                  Hidden items in original order, using the same
                                  <code>T</code> shape as <code>items</code>.
                                </dd>
                              </div>
                            </dl>
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                  <div class="api-entry">
                    <div class="api-entry-header">
                      <div class="api-entry-name"><code>after</code></div>
                    </div>
                    <div class="api-entry-copy">
                      <p>Trailing atomic content, usually <code>+N</code> or toggle UI.</p>
                      <dl class="api-detail-list">
                        <div class="api-detail-item">
                          <dt class="api-detail-term">Slot props</dt>
                          <dd class="api-detail-desc">Same as <code>before</code>.</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </div>
              </section>

              <section class="api-group">
                <h3 class="subsection-title">Events</h3>
                <div class="api-list">
                  <div class="api-entry">
                    <div class="api-entry-header">
                      <div class="api-entry-name"><code>clampchange</code></div>
                      <div class="api-entry-meta">
                        <span class="api-meta-pair">
                          <span class="api-meta-label">Payload</span>
                          <code>(clamped: boolean)</code>
                        </span>
                      </div>
                    </div>
                    <p class="api-entry-copy">Emitted when truncation turns on or off.</p>
                  </div>
                  <div class="api-entry">
                    <div class="api-entry-header">
                      <div class="api-entry-name"><code>update:expanded</code></div>
                      <div class="api-entry-meta">
                        <span class="api-meta-pair">
                          <span class="api-meta-label">Payload</span>
                          <code>(expanded: boolean)</code>
                        </span>
                      </div>
                    </div>
                    <p class="api-entry-copy">Emitted when expansion changes.</p>
                  </div>
                </div>
              </section>
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
@import url("https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@500;600;700&display=swap");

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
}

* {
  scrollbar-width: thin;
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
  --focus-ring: 0 0 0 3px color-mix(in srgb, var(--c-accent) 18%, transparent);
  --focus-ring-subtle: 0 0 0 2px color-mix(in srgb, var(--c-accent) 22%, transparent);
  --font-body: Geist, "Segoe UI", "Helvetica Neue", Arial, sans-serif;
  --font-mono:
    "Geist Mono", "JetBrains Mono", "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  --radius: 6px;
  --radius-lg: 8px;
  --demo-range-width: 140px;
}

html {
  font-family: var(--font-body);
  font-size: 15px;
  line-height: 1.6;
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
  color: var(--c-text);
  background: var(--c-bg);
  scroll-behavior: smooth;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  margin: 0;
  scroll-behavior: smooth;
}

@media (prefers-reduced-motion: reduce) {
  html,
  body {
    scroll-behavior: auto;
  }
}

a {
  color: var(--c-accent);
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

a:focus-visible {
  outline: none;
  border-radius: 4px;
  box-shadow: var(--focus-ring);
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
  padding: 42px 0 28px;
  border-bottom: 1px solid var(--c-border);
}

.hero-copy {
  max-width: 620px;
}

.hero-title {
  margin: 0;
  font-family: var(--font-mono);
  font-size: clamp(2.1rem, 5.5vw, 2.9rem);
  font-weight: 600;
  letter-spacing: -0.045em;
  line-height: 1;
  color: var(--c-text);
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

.hero-tagline-shell {
  margin-top: 20px;
  width: 100%;
  max-width: 100%;
}

.hero-tagline-frame {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  vertical-align: top;
  transition: width var(--hero-tagline-transition, 1120ms) cubic-bezier(0.2, 0.9, 0.28, 1);
}

.hero-tagline {
  display: inline-flex;
  font-size: clamp(0.98rem, 2.2vw, 1.26rem);
  font-weight: 700;
  letter-spacing: -0.035em;
  line-height: 1.24;
  color: var(--c-text);
}

.hero-tagline-live {
  width: 100%;
}

.hero-tagline-measure {
  position: absolute;
  left: -9999px;
  top: 0;
  visibility: hidden;
  pointer-events: none;
  display: grid;
  gap: 4px;
}

.hero-tagline-measure-item {
  width: auto;
  max-width: none;
  transition: none;
}

.hero-tagline-measure-parts {
  display: flex;
  align-items: baseline;
  gap: 0;
}

.hero-tagline-measure-text {
  font-size: clamp(0.98rem, 2.2vw, 1.26rem);
  font-weight: 700;
  letter-spacing: -0.035em;
  line-height: 1.24;
  white-space: nowrap;
}

.hero-tagline :deep([data-part="start"]),
.hero-tagline :deep([data-part="end"]) {
  color: var(--c-text);
}

.hero-tagline :deep([data-part="body"]) {
  color: var(--c-accent-text);
}

.hero-links {
  margin-top: 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  font-size: 0.78rem;
}

.hero-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0;
  font-size: inherit;
  font-weight: 600;
  color: var(--c-text-2);
  border: none;
  border-radius: 0;
  background: transparent;
  transition: color 0.15s;
}

.hero-link-mark {
  display: block;
  flex: none;
}

.hero-link-mark-npmx .hero-link-mark-bg {
  fill: currentColor;
}

.hero-link-mark-npmx .hero-link-mark-dot {
  fill: color-mix(in srgb, currentColor 48%, var(--c-bg));
}

.hero-link-mark-npmx .hero-link-mark-slash {
  fill: var(--c-bg);
}

.hero-link:hover {
  color: var(--c-accent);
  text-decoration: none;
}

.hero-link:focus-visible {
  color: var(--c-accent);
  box-shadow: var(--focus-ring);
}

.hero-link-separator {
  color: var(--c-text-3);
}

/* Sections */

.section {
  padding: 32px 0;
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

.reference-tabs-anchor {
  block-size: 0;
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

.demo-surface {
  display: flex;
  flex-direction: column;
}

.demo-shared-controls {
  padding-bottom: 4px;
}

.demo-shared-controls .demo-controls {
  padding-bottom: 0;
}

.demo-example-list {
  display: flex;
  flex-direction: column;
}

.demo-block {
  margin-bottom: 0;
  padding: 18px 0 20px;
}

.demo-block:first-child {
  padding-top: 0;
}

.demo-block + .demo-block {
  border-top: 1px solid var(--c-border);
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
  box-shadow: var(--focus-ring);
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

.control-range:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
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

.control-check:focus-within,
.control-radio:focus-within {
  color: var(--c-text);
  border-radius: 999px;
  box-shadow: var(--focus-ring-subtle);
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

.control-pill:focus-visible {
  outline: none;
  color: var(--c-accent-text);
  border-color: var(--c-accent);
  box-shadow: var(--focus-ring);
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
}

:deep(.demo-clamp) {
  display: block;
  width: 100%;
  max-width: 100%;
  line-height: 1.8;
}

:deep(.width-guide) {
  border-inline-end-color: rgba(208, 208, 218, 0.95);
}

:deep(.height-guide) {
  border-block-end-color: rgba(208, 208, 218, 0.95);
}

:deep(.demo-inline) {
  display: block;
  max-width: 100%;
  line-height: 1.6;
}

:deep(.demo-wrap) {
  display: block;
  width: 100%;
  max-width: 100%;
  line-height: 1.5;
}

:deep(.demo-wrap [data-part="content"]) {
  align-items: flex-start;
  gap: 8px;
}

:deep(.demo-inline [data-part="start"]) {
  color: var(--c-text-3);
}

:deep(.demo-inline [data-part="end"]) {
  color: var(--c-accent-text);
}

.wrap-pill,
.wrap-prefix,
.wrap-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  min-height: 28px;
  padding: 0 10px;
  font-size: 0.8rem;
  font-weight: 500;
  white-space: nowrap;
  border: 1px solid var(--c-border);
  border-radius: 999px;
  background: var(--c-bg-soft);
  color: var(--c-text);
}

.wrap-pill[data-tone="accent"] {
  border-color: #d9ccff;
  background: #f4f0ff;
  color: var(--c-accent-text);
}

.wrap-pill[data-tone="success"] {
  border-color: #cdebd6;
  background: #f1faf4;
  color: #137a36;
}

.wrap-pill[data-tone="warm"] {
  border-color: #f3d8bd;
  background: #fff5ea;
  color: #a55a19;
}

.wrap-prefix {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--c-text-2);
  background: var(--c-bg);
}

.wrap-summary {
  color: var(--c-accent-text);
  background: var(--c-accent-soft);
  border-color: #d9ccff;
}

.wrap-tab {
  font-family: inherit;
  color: var(--c-text-2);
  background: transparent;
  cursor: pointer;
  transition:
    background 0.15s,
    border-color 0.15s,
    color 0.15s,
    transform 0.15s;
}

.wrap-tabs {
  overflow: visible;
  border-bottom: 1px solid var(--c-border);
}

.wrap-tabs :deep([data-part="content"]) {
  align-items: stretch;
  gap: 2px;
}

.wrap-tabs .wrap-tab {
  min-height: 34px;
  padding-inline: 10px;
  border-color: transparent;
  border-width: 0 0 2px;
  border-radius: 0;
  background: transparent;
}

.wrap-tabs .wrap-tab:hover {
  color: var(--c-text);
}

.wrap-tabs .wrap-tab.active {
  color: var(--c-accent-text);
  border-color: var(--c-accent);
}

.wrap-tabs-after {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  border-bottom: 2px solid transparent;
}

.wrap-tabs-after.is-active {
  border-color: var(--c-accent);
}

.wrap-tab-trigger {
  anchor-name: --wrap-tabs-trigger;
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
  width: 24px;
  height: 24px;
  justify-content: center;
  padding-inline: 0;
  line-height: 0;
  color: var(--c-text-3);
  border: none;
  border-radius: 8px;
  background: transparent;
}

.wrap-tabs-after.is-active .wrap-tab-trigger {
  color: var(--c-accent-text);
}

.wrap-tab-trigger:hover,
.wrap-tab-trigger[aria-expanded="true"] {
  color: var(--c-accent-text);
  background: rgba(124, 58, 237, 0.06);
}

.wrap-tabs .wrap-tab:focus-visible,
.wrap-tab-trigger:focus-visible {
  outline: none;
  color: var(--c-accent-text);
  background: rgba(124, 58, 237, 0.06);
  box-shadow: var(--focus-ring);
}

.wrap-tabs-menu {
  position: fixed;
  position-anchor: --wrap-tabs-trigger;
  top: calc(anchor(bottom) + 8px);
  left: anchor(left);
  min-width: 220px;
  padding: 8px;
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  border-radius: 12px;
  box-shadow: 0 18px 38px rgba(18, 20, 28, 0.14);
  z-index: 20;
}

.wrap-tabs-menu-item {
  display: flex;
  width: 100%;
  padding: 7px 10px;
  font-size: 0.8rem;
  font-family: inherit;
  color: var(--c-text-2);
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
}

.wrap-tabs-menu-item.active {
  color: var(--c-accent-text);
  background: rgba(124, 58, 237, 0.08);
}

.wrap-tabs-menu-item + .wrap-tabs-menu-item {
  margin-top: 2px;
}

.wrap-tabs-menu-item:hover {
  background: var(--c-bg-soft);
  color: var(--c-text);
}

.wrap-tabs-menu-item:focus-visible {
  outline: none;
  background: var(--c-bg-soft);
  color: var(--c-text);
  box-shadow: var(--focus-ring-subtle);
}

.wrap-summary-button {
  font-family: inherit;
  cursor: pointer;
  transition:
    background 0.15s,
    border-color 0.15s,
    color 0.15s;
}

.wrap-summary-button:hover {
  background: #f6f3ff;
  border-color: var(--c-accent);
}

.wrap-summary-button:focus-visible,
.toggle-btn:focus-visible,
.install-tab:focus-visible {
  outline: none;
  border-color: var(--c-accent);
  color: var(--c-accent-text);
  box-shadow: var(--focus-ring);
}

.wrap-person {
  padding-inline-start: 5px;
}

.wrap-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: var(--c-text);
  color: var(--c-bg);
  font-size: 0.63rem;
  font-weight: 700;
  letter-spacing: 0.02em;
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

/* API reference */

.api-summary {
  margin: 0 0 18px;
  font-size: 0.82rem;
  line-height: 1.6;
  color: var(--c-text-2);
}

.api-group + .api-group {
  margin-top: 16px;
}

.api-group > .subsection-title {
  margin-bottom: 8px;
}

.api-list {
  margin: 0;
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  overflow: hidden;
}

.api-entry + .api-entry {
  border-top: 1px solid var(--c-border);
}

.api-entry {
  padding: 12px 14px;
  display: grid;
  gap: 6px;
}

.api-entry-header {
  display: grid;
  gap: 4px;
}

.api-entry-name {
  font-size: 0.86rem;
  font-weight: 600;
  color: var(--c-text);
  min-width: 0;
}

.api-entry-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 14px;
}

.api-meta-pair {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}

.api-meta-label {
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--c-text-3);
}

.api-meta-flag {
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--c-accent-text);
}

.api-entry-copy {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.6;
  color: var(--c-text-2);
}

.api-entry-copy p {
  margin: 0;
}

.api-detail-list {
  margin: 12px 0 0;
  padding: 0;
  display: grid;
  gap: 12px;
}

.api-detail-item {
  display: grid;
  gap: 6px;
}

.api-detail-term {
  margin: 0;
  display: block;
  font-family: inherit;
  font-size: 0.68rem;
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--c-text-3);
}

.api-detail-desc {
  margin: 0;
  font-family: inherit;
  font-size: 0.82rem;
  line-height: 1.6;
  color: var(--c-text-2);
}

.api-subdetail-list {
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}

.api-subdetail-item {
  display: grid;
  gap: 4px;
}

.api-subdetail-term {
  margin: 0;
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-family: inherit;
  font-size: 0.82rem;
  font-weight: 500;
  line-height: 1.6;
  color: var(--c-text);
}

.api-subdetail-desc {
  margin: 0;
  font-family: inherit;
  font-size: 0.82rem;
  line-height: 1.6;
  color: var(--c-text-2);
}

.api-list code {
  font-size: 0.78rem;
  white-space: normal;
  overflow-wrap: anywhere;
}

@media (min-width: 640px) {
  .api-entry {
    grid-template-columns: minmax(0, 176px) minmax(0, 1fr);
    column-gap: 18px;
    align-items: start;
  }

  .api-entry-header {
    display: contents;
  }

  .api-entry-name {
    grid-column: 1;
    grid-row: 1 / span 2;
    padding-top: 2px;
  }

  .api-entry-meta {
    grid-column: 2;
  }

  .api-entry-copy {
    grid-column: 2;
  }
}

@media (max-width: 639px) {
  .hero-tagline-shell {
    max-width: 100%;
  }

  .demo-preview {
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
  }
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
