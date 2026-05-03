<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { ArrowUpRight, ChevronDown, Ellipsis, Gauge, SlidersHorizontal } from "@lucide/vue";
import { siGithub } from "simple-icons";
import { InlineClamp, LineClamp, RichLineClamp, WrapClamp } from "vue-clamp";
import Alert from "./Alert.vue";
import ComponentTabs from "./ComponentTabs.vue";
import PillControls from "./PillControls.vue";
import {
  horizontalOverlayScrollbarsOptions,
  initBodyOverlayScrollbars,
  overlayScrollbarsDirective,
} from "./overlayScrollbars";

import type { ClampBoundary, InlineClampSplit, LineClampLocation } from "vue-clamp";

const vOverlayScrollbars = overlayScrollbarsDirective;
const horizontalOverlayScrollbars = horizontalOverlayScrollbarsOptions;

const englishText =
  "Vue (pronounced /vju\u02D0/, like view) is a progressive framework for building user interfaces. Unlike other monolithic frameworks, Vue is designed from the ground up to be incrementally adoptable. The core library is focused on the view layer only, and is easy to pick up and integrate with other libraries or existing projects. On the other hand, Vue is also perfectly capable of powering sophisticated Single-Page Applications when used in combination with modern tooling and supporting libraries.";
const chineseText =
  "Vue 是一个用于构建用户界面的渐进式框架。你可以只在页面的一小部分引入它，也可以结合现代工具链把它扩展成完整的单页应用。在这个示例里，我们使用一段较长的中文文本来观察多行截断、换行和省略号在不同宽度下的表现。";
const arabicText =
  "فيو 3 إطار تدريجي لبناء واجهات المستخدم، وقد صُمم ليكون سهل التبنّي بشكل متدرج داخل المشاريع المختلفة. تركز المكتبة الأساسية على طبقة العرض فقط، لكنها قادرة أيضًا على تشغيل تطبيقات أكثر تعقيدًا عند استخدامها مع أدوات حديثة ومكتبات مساندة. في هذا المثال نعرض نصًا عربيًا مع Vue 3 وبعض الكلمات اللاتينية مثل SPA لاختبار الالتفاف والاقتطاع في اتجاه من اليمين إلى اليسار.";
const mixedLanguageText =
  "Design systems move fast: ship once, then verify the same preview with English, 中文标签, العربية, and locale-aware tokens like /docs/getting-started before you freeze the layout.";
const emojiText =
  "Status update ✨ Ship notes are ready, screenshots are approved, and the launch checklist is almost done 🚀 Add a few longer phrases with emoji reactions 😄📦🧪 to see how the clamp behaves.";
const richDemoIconSrc = "/rich-demo-icon.svg";

function richIconImage(src: string): string {
  return `<img alt="" src="${src}" style="width:14px;height:14px;vertical-align:-2px" />`;
}

const richHtmlPresets = [
  {
    id: "release",
    label: "Release note",
    value: `Heads up: ${richIconImage(richDemoIconSrc)} <strong>Friday release 2.4.0</strong> moves to <time datetime="2026-04-11T09:30">09:30</time>. Review the <a href="#components">migration note</a>, keep the <code>&lt;RichLineClamp&gt;</code> fallback banner, and confirm the <mark>billing export</mark> patch before the preview freeze. <span class="rich-chip rich-chip--accent">Blocking</span> <span class="rich-chip">Docs</span> ${richIconImage(richDemoIconSrc)}`,
  },
  {
    id: "editorial",
    label: "Article excerpt",
    value: `Feature essay ${richIconImage(richDemoIconSrc)} · <small class="rich-meta"><time datetime="2026-04-08">Apr 8, 2026</time> · By <a href="#components">Interface <strong>Systems</strong> Desk</a></small><br>The latest review argues that <a href="#components">the refreshed <strong>component tabs</strong> should scroll on narrow screens</a> instead of squeezing every label into one row. It keeps <em>editorial emphasis</em>, the inline badge <span class="rich-chip rich-chip--quiet">analysis</span>, and an <inline-note>editor&rsquo;s note ${richIconImage(richDemoIconSrc)} on the <a href="#components">same <strong>read-more</strong> affordance</a></inline-note> so the excerpt still feels like a styled article.`,
  },
  {
    id: "incident",
    label: "Incident brief",
    value: `Incident brief ${richIconImage(richDemoIconSrc)} <strong>#4721</strong>: API latency spiked after <code>release/2.4.0</code>. Triage owners are <span class="rich-chip">Platform</span>, <span class="rich-chip rich-chip--warm">Billing</span>, and <span class="rich-chip rich-chip--success">Support</span>. Watch <span class="rich-link-run">status-page<wbr>.acme<wbr>.dev</span> and keep the inline ${richIconImage(richDemoIconSrc)} health glyph attached to the summary.`,
  },
] as const;

const lineTextPresets = [
  {
    id: "english",
    label: "English",
    value: englishText,
  },
  {
    id: "chinese",
    label: "中文",
    value: chineseText,
  },
  {
    id: "arabic",
    label: "العربية",
    value: arabicText,
  },
  {
    id: "mixed",
    label: "Mixed",
    value: mixedLanguageText,
  },
  {
    id: "emoji",
    label: "Emoji",
    value: emojiText,
  },
] as const;

const lineTextPresetOptions = lineTextPresets.map((preset) => ({
  buttonAttrs: { "data-line-text-preset": preset.id },
  label: preset.label,
  value: preset.id,
}));

const lineTextInput = ref(englishText);
const selectedLineTextPreset = computed(() => {
  return lineTextPresets.find((preset) => preset.value === lineTextInput.value)?.id ?? null;
});

const clampBoundaryOptions = [
  {
    buttonAttrs: { "data-boundary-option": "grapheme" },
    label: "Grapheme",
    value: "grapheme",
  },
  {
    buttonAttrs: { "data-boundary-option": "word" },
    label: "Word",
    value: "word",
  },
] as const;

function selectLineTextPreset(value: string): void {
  lineTextInput.value = value;
}

function toggleLabel(expanded: boolean, rtl = false): string {
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

// Demo 2: max-height + before slot + external expanded
const height2 = ref("calc(36px + 6em)");
const expanded2 = ref(false);

// Demo 3: clampchange event
const lines3 = ref(6);
const clamped3 = ref(false);

// Demo 4: ellipsis + location
const lines4 = ref(5);
const ellipsis4 = ref("\u2026");
const locationRatio4 = ref(1);
const lineWidth = ref(480);
const lineHyphens = ref(true);
const lineRtl = ref(false);
const lineBoundary = ref<ClampBoundary>("grapheme");
const locationPresets4 = [
  { label: "Start", ratio: 0, value: "start" as const },
  { label: "Middle", ratio: 0.5, value: "middle" as const },
  { label: "End", ratio: 1, value: "end" as const },
] as const;

const locationPresetOptions = locationPresets4.map((preset) => ({
  buttonAttrs: { "data-location-preset": preset.value },
  label: preset.label,
  value: preset.value,
}));

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

// Demo 5: rich html
const richLines5 = ref(3);
const richWidth = ref(420);
const richHyphens = ref(true);
const richBoundary = ref<ClampBoundary>("grapheme");
const richHeight6 = ref("calc(36px + 6em)");
const richExpanded6 = ref(false);
const richLines7 = ref(3);
const richClamped7 = ref(false);
const richHtmlInput = ref<string>(richHtmlPresets[0].value);

const selectedRichHtmlPreset = computed(() => {
  return richHtmlPresets.find((preset) => preset.value === richHtmlInput.value)?.id ?? null;
});

const richHtmlPresetOptions = richHtmlPresets.map((preset) => ({
  buttonAttrs: { "data-rich-preset": preset.id },
  label: preset.label,
  value: preset.id,
}));

function selectRichHtmlPreset(value: string): void {
  richHtmlInput.value = value;
  richExpanded6.value = false;
}

type SurfaceKey = "line" | "rich" | "inline" | "wrap";
type WrapDemoItem = {
  id: string;
  label: string;
  tone?: "neutral" | "accent" | "success" | "warm";
  avatar?: string;
};

const surfaceHashes = {
  line: "line-clamp",
  rich: "rich-line-clamp",
  inline: "inline-clamp",
  wrap: "wrap-clamp",
} as const satisfies Record<SurfaceKey, string>;

function surfaceHash(surface: SurfaceKey): string {
  return `#${surfaceHashes[surface]}`;
}

function surfaceFromHash(hash: string): SurfaceKey | null {
  const normalizedHash = hash.startsWith("#") ? hash.slice(1) : hash;

  if (!normalizedHash) {
    return null;
  }

  if (normalizedHash === surfaceHashes.line) {
    return "line";
  }

  if (normalizedHash === surfaceHashes.rich) {
    return "rich";
  }

  if (normalizedHash === surfaceHashes.inline) {
    return "inline";
  }

  if (normalizedHash === surfaceHashes.wrap) {
    return "wrap";
  }

  return null;
}

function currentSurfaceFromLocation(): SurfaceKey | null {
  if (typeof window === "undefined") {
    return null;
  }

  return surfaceFromHash(window.location.hash);
}

function setSurfaceRouteHash(surface: SurfaceKey): void {
  if (typeof window === "undefined") {
    return;
  }

  const nextHash = surfaceHash(surface);
  if (window.location.hash === nextHash) {
    return;
  }

  window.history.pushState(
    null,
    "",
    `${window.location.pathname}${window.location.search}${nextHash}`,
  );
}

const activeSurface = ref<SurfaceKey>(currentSurfaceFromLocation() ?? "line");
const referenceTabsAnchorRef = ref<HTMLElement | null>(null);
const demoControlsExpanded = ref(false);
const stressPlaygroundOpen = ref(false);
const CodeBlock = defineAsyncComponent(() => import("./CodeBlock.vue"));
const StressPlayground = defineAsyncComponent(() => import("./StressPlayground.vue"));
const surfaceGuideItems = [
  {
    description:
      "Multiline browser-fit clamp for plain text, previews, cards, and expandable copy.",
    guide: "Plain-text multiline clamp for previews, cards, lists, and expandable copy.",
    id: surfaceHashes.line,
    label: "LineClamp",
    value: "line",
  },
  {
    description:
      "Trusted inline rich-html clamp for styled excerpts, links, and mixed inline markup.",
    guide: "Trusted inline HTML clamp for styled excerpts, links, and mixed inline markup.",
    id: surfaceHashes.rich,
    label: "RichLineClamp",
    value: "rich",
  },
  {
    description: "Native single-line clamp for filenames, paths, and email addresses.",
    guide: "Single-line clamp for filenames, paths, and emails when one edge must stay visible.",
    id: surfaceHashes.inline,
    label: "InlineClamp",
    value: "inline",
  },
  {
    description: "Wrapped atomic-item clamp for labels, filters, and selected-value lists.",
    guide: "Wrapped item clamp for tags, filters, invitees, and selected-value lists.",
    id: surfaceHashes.wrap,
    label: "WrapClamp",
    value: "wrap",
  },
] as const;

const surfaceOptions = surfaceGuideItems.map(({ description, id, label, value }) => ({
  description,
  id,
  label,
  value,
}));

const heroTaglineWordCatalog = {
  line: ["messages", "excerpts", "summaries"],
  rich: ["notes", "links", "snippets"],
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
  return value === "line" || value === "rich" || value === "inline" || value === "wrap";
}

function syncActiveSurfaceFromRoute(): boolean {
  const routedSurface = currentSurfaceFromLocation();
  if (!routedSurface) {
    return false;
  }

  if (activeSurface.value !== routedSurface) {
    demoControlsExpanded.value = false;
  }
  activeSurface.value = routedSurface;
  return true;
}

function updateActiveSurface(surface: string): void {
  if (!isSurfaceKey(surface)) {
    return;
  }

  if (activeSurface.value !== surface) {
    demoControlsExpanded.value = false;
    activeSurface.value = surface;
  }
  setSurfaceRouteHash(surface);

  void nextTick(() => {
    scrollReferenceTabsToTop();
  });
}

function handleSurfaceHashChange(): void {
  if (!syncActiveSurfaceFromRoute()) {
    return;
  }

  void nextTick(() => {
    scrollReferenceTabsToTop();
  });
}

const heroTaglineWords = createHeroTaglineWords();
const defaultHeroTaglineWord = heroTaglineWords[0] ?? heroTaglineWordCatalog.line[0];

const heroTaglineTextStart = "Clamping";
const heroTaglineTextEnd = "in Vue.";
const heroTaglineTiming = {
  collapsedHold: 380,
  expandedHold: 2240,
  swapSettle: 220,
  transition: 1320,
} as const;
const heroTaglineExpandedWidthReserve = 80;
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
let pageMounted = false;
let stopBodyOverlayScrollbars = () => {};

const inlineWidth5 = ref(280);
const inlineLocationRatio5 = ref(1);
const inlineBoundary5 = ref<ClampBoundary>("grapheme");
const commonImageExtensions = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif"] as const;

const inlineLocationPresetOptions = locationPresets4.map((preset) => ({
  buttonAttrs: { "data-inline-location-preset": preset.value },
  label: preset.label,
  value: preset.value,
}));

const selectedInlineLocationPreset5 = computed(() => {
  const preset = locationPresets4.find(
    (candidate) => Math.abs(inlineLocationRatio5.value - candidate.ratio) < 0.001,
  );

  return preset?.value ?? null;
});

const inlineLocation5 = computed<LineClampLocation>(() => {
  return selectedInlineLocationPreset5.value ?? inlineLocationRatio5.value;
});

function selectInlineLocationPreset5(ratio: number): void {
  inlineLocationRatio5.value = ratio;
}

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
        start: `${heroTaglineTextStart} `,
        body: word,
        end: ` ${heroTaglineTextEnd}`,
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
const wrapWidth = ref(420);
const wrapRtl = ref(false);
const wrapHeight7 = ref("58px");
const wrapExpanded7 = ref(false);

const wrapTabItems6 = computed(() => {
  return wrapRtl.value ? wrapTabItemsAr : wrapTabItems;
});

const wrapInviteeItems7 = computed(() => {
  return wrapRtl.value ? wrapInviteeItemsAr : wrapInviteeItems;
});

function boundaryLabel(boundary: ClampBoundary): string {
  return boundary === "word" ? "Word" : "Grapheme";
}

function boolFlag(enabled: boolean, label: string): string | null {
  return enabled ? label : null;
}

const demoControlsSummary = computed(() => {
  switch (activeSurface.value) {
    case "line":
      return [
        boundaryLabel(lineBoundary.value),
        `${lineWidth.value}px`,
        boolFlag(lineHyphens.value, "Hyphens"),
        boolFlag(lineRtl.value, "RTL"),
      ]
        .filter((part): part is string => Boolean(part))
        .join(" · ");
    case "rich":
      return [
        boundaryLabel(richBoundary.value),
        `${richWidth.value}px`,
        boolFlag(richHyphens.value, "Hyphens"),
      ]
        .filter((part): part is string => Boolean(part))
        .join(" · ");
    case "inline":
      return [
        selectedInlineLocationPreset5.value ?? inlineLocationRatio5.value.toFixed(2),
        boundaryLabel(inlineBoundary5.value),
        `${inlineWidth5.value}px`,
      ]
        .filter((part): part is string => Boolean(part))
        .join(" · ");
    case "wrap":
      return [`${wrapWidth.value}px`, boolFlag(wrapRtl.value, "RTL")]
        .filter((part): part is string => Boolean(part))
        .join(" · ");
  }
});

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

function measureHeroTaglineWidths(): void {
  const measuredExpandedWidths = createHeroTaglineWidthMap();

  for (const word of heroTaglineWords) {
    const measuredWidth = measureWidth(`[data-measure-word="${word}"]`);
    measuredExpandedWidths[word] =
      measuredWidth === null ? 0 : measuredWidth + heroTaglineExpandedWidthReserve;
  }

  heroTaglineExpandedWidths.value = measuredExpandedWidths;
  heroTaglineCollapsedWidth.value = measureWidth('[data-measure-state="collapsed"]') ?? 0;
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
  pageMounted = true;
  stopBodyOverlayScrollbars = initBodyOverlayScrollbars();
  void loadHighlightedCode();
  document.addEventListener("pointerdown", handleWrapTabsPointerDown);
  document.addEventListener("keydown", handleWrapTabsKeydown);
  window.addEventListener("hashchange", handleSurfaceHashChange);

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

    if (!pageMounted) {
      return;
    }

    heroTaglineFontsReady = true;
    measureHeroTaglineWidths();
    syncHeroTaglineWidth();
    applyHeroTaglineMotionPreference(heroTaglineMotionQuery?.matches ?? false);
  })();

  if (currentSurfaceFromLocation()) {
    void nextTick(() => {
      scrollReferenceTabsToTop();
    });
  }
});

onBeforeUnmount(() => {
  heroTaglineFontsReady = false;
  pageMounted = false;
  highlightRequestId += 1;
  stopBodyOverlayScrollbars();
  document.removeEventListener("pointerdown", handleWrapTabsPointerDown);
  document.removeEventListener("keydown", handleWrapTabsKeydown);
  window.removeEventListener("hashchange", handleSurfaceHashChange);

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

function updateLineTextPreset(value: string): void {
  const preset = lineTextPresets.find((candidate) => candidate.id === value);
  if (preset) {
    selectLineTextPreset(preset.value);
  }
}

function toClampBoundary(value: string): ClampBoundary {
  return value === "word" ? "word" : "grapheme";
}

function updateLineBoundary(value: string): void {
  lineBoundary.value = toClampBoundary(value);
}

function updateRichBoundary(value: string): void {
  richBoundary.value = toClampBoundary(value);
}

function updateInlineBoundary(value: string): void {
  inlineBoundary5.value = toClampBoundary(value);
}

function updateLocationPreset(value: string): void {
  const preset = locationPresets4.find((candidate) => candidate.value === value);
  if (preset) {
    selectLocationPreset4(preset.ratio);
  }
}

function updateInlineLocationPreset(value: string): void {
  const preset = locationPresets4.find((candidate) => candidate.value === value);
  if (preset) {
    selectInlineLocationPreset5(preset.ratio);
  }
}

function updateRichHtmlPreset(value: string): void {
  const preset = richHtmlPresets.find((candidate) => candidate.id === value);
  if (preset) {
    selectRichHtmlPreset(preset.value);
  }
}

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
  "const text =",
  "  'Ship review-ready notes with browser-fit text truncation and keep the toggle inline.'",
  "<" + "/script>",
  "",
  "<template>",
  '  <LineClamp v-model:expanded="expanded" :text="text" :max-lines="2" boundary="word">',
  '    <template #after="{ clamped, toggle }">',
  '      <button v-if="clamped" type="button" @click="toggle">',
  `        {{ expanded ? 'Less' : 'More' }}`,
  "      </button>",
  "    </template>",
  "  </LineClamp>",
  "</template>",
].join("\n");

const richCodeExample = [
  '<script setup lang="ts">',
  "import { ref } from 'vue'",
  "import { RichLineClamp } from 'vue-clamp'",
  "",
  "const expanded = ref(false)",
  "const html =",
  `  '<small class="rich-meta">Feature essay · Apr 8</small><br>Read <a href="/docs">how the <strong>component tabs</strong> now stay scrollable on small screens</a> while the <mark>article excerpt</mark> keeps its inline emphasis.'`,
  "<" + "/script>",
  "",
  "<template>",
  '  <RichLineClamp v-model:expanded="expanded" :html="html" :max-lines="2" boundary="word">',
  '    <template #after="{ clamped, toggle }">',
  '      <button v-if="clamped" type="button" @click="toggle">',
  `        {{ expanded ? 'Less' : 'More' }}`,
  "      </button>",
  "    </template>",
  "  </RichLineClamp>",
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
  '  <InlineClamp :text="file" :split="splitImageFile" location="middle" />',
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

const highlightedInstall = ref<string | null>(null);
const highlightedLineCode = ref<string | null>(null);
const highlightedRichCode = ref<string | null>(null);
const highlightedInlineCode = ref<string | null>(null);
const highlightedWrapCode = ref<string | null>(null);
let highlightRequestId = 0;

async function loadHighlightedCode(): Promise<void> {
  const requestId = (highlightRequestId += 1);
  const { highlightCode } = await import("./highlight");

  if (!pageMounted || requestId !== highlightRequestId) {
    return;
  }

  highlightedInstall.value =
    pkgManager.value === "agent" ? null : highlightCode(installCommand.value, "shellscript");
  highlightedLineCode.value = highlightCode(lineCodeExample, "vue");
  highlightedRichCode.value = highlightCode(richCodeExample, "vue");
  highlightedInlineCode.value = highlightCode(inlineCodeExample, "vue");
  highlightedWrapCode.value = highlightCode(wrapCodeExample, "vue");
}

watch(installCommand, () => {
  if (pageMounted) {
    void loadHighlightedCode();
  }
});
</script>

<template>
  <div class="page" lang="en">
    <!-- Hero -->
    <header class="hero">
      <div class="hero-copy">
        <h1 class="hero-title">&lt;vue-clamp&gt;</h1>
        <p class="sr-only">
          Clamping messages, excerpts, summaries, notes, links, snippets, filenames, emails, paths,
          tags, filters, and chips in Vue.
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
          <div class="hero-tagline-measure-parts">
            <span
              v-for="word in heroTaglineWords"
              :key="`measure-${word}`"
              class="hero-tagline hero-tagline-measure-line"
              :data-measure-word="word"
            >
              <span class="hero-tagline-measure-segment" v-text="`${heroTaglineTextStart} `" />
              <span class="hero-tagline-measure-segment">{{ word }}</span>
              <span class="hero-tagline-measure-segment" v-text="` ${heroTaglineTextEnd}`" />
            </span>
            <span class="hero-tagline hero-tagline-measure-line" data-measure-state="collapsed">
              <span class="hero-tagline-measure-segment" v-text="`${heroTaglineTextStart} `" />
              <span class="hero-tagline-measure-segment">…</span>
              <span class="hero-tagline-measure-segment" v-text="` ${heroTaglineTextEnd}`" />
            </span>
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

    <!-- Surface guide -->
    <section class="section surface-guide-section" id="features" aria-label="Components overview">
      <div class="surface-guide" data-surface-guide>
        <p class="surface-guide-lead">
          <code>vue-clamp</code> ships four focused components for plain text, trusted inline HTML,
          single-line labels, and wrapped item lists.
        </p>

        <ul class="surface-guide-list" data-surface-guide-list>
          <li
            v-for="surface in surfaceGuideItems"
            :key="surface.value"
            class="surface-guide-item"
            :data-surface-guide-item="surface.value"
          >
            <a
              class="surface-guide-card"
              :href="surfaceHash(surface.value)"
              :data-surface-guide-link="surface.value"
            >
              <span class="surface-guide-link">
                <code>{{ surface.label }}</code>
              </span>
              <p class="surface-guide-summary">{{ surface.guide }}</p>
            </a>
          </li>
        </ul>
      </div>
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
          <section class="reference-section" data-reference-panel="overview">
            <h3 class="subsection-title">When to use</h3>
            <template v-if="activeSurface === 'line'">
              <p class="api-summary" data-api-summary="line">
                Use <code>&lt;LineClamp&gt;</code> for real multiline plain text where the browser
                decides wrapping. Pick <code>max-lines</code> for text-driven limits or
                <code>max-height</code> for layout-driven limits, and <code>boundary</code> when
                prose should clamp at whole words.
              </p>
            </template>
            <template v-else-if="activeSurface === 'rich'">
              <p class="api-summary" data-api-summary="rich">
                Use <code>&lt;RichLineClamp&gt;</code> for trusted inline HTML where formatting,
                links, line breaks, and inline media should remain visible. It clamps from the end
                only, with optional word-boundary trimming inside text runs.
              </p>
              <Alert name="rich" title="HTML input contract">
                <ul>
                  <li>
                    Pass trusted HTML. Sanitize untrusted input with the native
                    <a
                      href="https://developer.mozilla.org/en-US/docs/Web/API/HTML_Sanitizer_API"
                      target="_blank"
                      rel="noopener"
                      >HTML Sanitizer API</a
                    >
                    where available, or
                    <a href="https://github.com/cure53/DOMPurify" target="_blank" rel="noopener"
                      >DOMPurify</a
                    >, before binding <code>html</code>.
                  </li>
                  <li>
                    Use sentence-like HTML. <code>&lt;RichLineClamp&gt;</code> can trim through
                    text, formatting tags such as <code>strong</code>, <code>em</code>, and
                    <code>code</code>, links, <code>br</code>/<code>wbr</code>, and leaf custom
                    elements.
                  </li>
                  <li>
                    Atomic inline content stays whole. That includes <code>&lt;img&gt;</code>,
                    inline <code>&lt;svg&gt;</code>, and elements rendered as
                    <code>display: inline-block</code> or <code>display: inline-flex</code>; the
                    component can keep or drop those units, but it does not trim inside them.
                  </li>
                  <li>
                    If rendered content uses block-level layout such as <code>display: block</code>,
                    <code>display: flex</code>, or <code>display: grid</code>, floats, or
                    absolute/fixed positioning, <code>&lt;RichLineClamp&gt;</code> leaves the
                    original HTML unchanged instead of cutting through that layout.
                  </li>
                  <li>
                    For <code>img</code>, reserve space before load with <code>width</code>/
                    <code>height</code> attributes or CSS <code>width</code>, <code>height</code>,
                    or <code>aspect-ratio</code>. The component measures that reserved box and does
                    not wait for the natural image size.
                  </li>
                </ul>
              </Alert>
            </template>
            <template v-else-if="activeSurface === 'inline'">
              <p class="api-summary" data-api-summary="inline">
                Use <code>&lt;InlineClamp&gt;</code> for one-line strings such as filenames, paths,
                and email addresses when the beginning, ending, or both must remain readable. Use
                <code>location</code> to choose how the rewritten body keeps text around the
                ellipsis, and <code>boundary</code> when the shrinkable body is prose-like.
              </p>
            </template>
            <template v-else>
              <p class="api-summary" data-api-summary="wrap">
                Use <code>&lt;WrapClamp&gt;</code> for wrapped items that must stay whole. Render
                each visible item through <code>item</code>, and use <code>after</code> for
                <code>+N</code>, <code>More</code>, or <code>Less</code> UI.
              </p>
            </template>
          </section>

          <section class="reference-section" data-reference-panel="demo">
            <h3 class="subsection-title">Examples</h3>

            <template v-if="activeSurface === 'line'">
              <div class="demo-surface">
                <div class="demo-source-controls">
                  <div class="demo-controls">
                    <div class="control stacked-control line-text-settings shared-control-wide">
                      <span class="control-stack">
                        <PillControls
                          class="control-pills"
                          aria-label="Line demo text presets"
                          button-class="control-pill"
                          :model-value="selectedLineTextPreset"
                          :options="lineTextPresetOptions"
                          @update:modelValue="updateLineTextPreset"
                        />
                        <textarea
                          v-model="lineTextInput"
                          class="control-textarea"
                          data-line-text-input
                          rows="5"
                          aria-label="LineClamp demo text"
                          placeholder="Paste or type text to try in every <LineClamp> example."
                        ></textarea>
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  class="demo-shared-controls"
                  :class="{ 'is-expanded': demoControlsExpanded }"
                  data-shared-controls="line"
                >
                  <button
                    class="demo-controls-toggle"
                    data-demo-controls-toggle
                    type="button"
                    :aria-expanded="demoControlsExpanded"
                    :aria-label="
                      demoControlsExpanded ? 'Collapse demo controls' : 'Expand demo controls'
                    "
                    @click="demoControlsExpanded = !demoControlsExpanded"
                  >
                    <span class="demo-controls-toggle-glyph" aria-hidden="true">
                      <SlidersHorizontal :size="16" :stroke-width="2" />
                    </span>
                    <span class="demo-controls-toggle-copy">
                      <span class="demo-controls-toggle-title">Demo controls</span>
                      <span class="demo-controls-toggle-summary">{{ demoControlsSummary }}</span>
                    </span>
                    <ChevronDown
                      class="demo-controls-toggle-icon"
                      :size="17"
                      :stroke-width="2"
                      aria-hidden="true"
                    />
                  </button>
                  <div class="demo-controls-panel">
                    <div class="demo-controls-panel-inner">
                      <div class="demo-controls">
                        <div class="control stacked-control">
                          <span class="control-label">Boundary</span>
                          <span class="control-stack">
                            <PillControls
                              class="control-pills"
                              aria-label="Line text boundary"
                              button-class="control-pill"
                              :model-value="lineBoundary"
                              :options="clampBoundaryOptions"
                              @update:modelValue="updateLineBoundary"
                            />
                          </span>
                        </div>
                        <label class="control">
                          <span class="control-label">Width</span>
                          <span class="control-row">
                            <input
                              v-model.number="lineWidth"
                              data-line-width-slider
                              class="control-range"
                              type="range"
                              min="240"
                              max="600"
                            />
                            <span class="control-value">{{ lineWidth }}px</span>
                          </span>
                        </label>
                        <div class="control-row shared-checks">
                          <label class="control-check">
                            <input v-model="lineHyphens" data-line-hyphens-toggle type="checkbox" />
                            <span>CSS Hyphens</span>
                          </label>
                          <label class="control-check">
                            <input v-model="lineRtl" data-line-rtl-toggle type="checkbox" />
                            <span>RTL</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

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
                    </div>
                    <div v-overlay-scrollbars="horizontalOverlayScrollbars" class="demo-preview">
                      <div class="demo-output width-guide" :style="{ width: `${lineWidth}px` }">
                        <LineClamp
                          class="demo-clamp"
                          :class="{ hyphens: lineHyphens, rtl: lineRtl }"
                          :text="lineTextInput"
                          :max-lines="lines1"
                          :boundary="lineBoundary"
                          :style="{ width: `${lineWidth}px`, maxWidth: '100%' }"
                        >
                          <template #after="{ toggle, expanded, clamped }">
                            <button v-if="expanded || clamped" class="toggle-btn" @click="toggle">
                              {{ toggleLabel(expanded, lineRtl) }}
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
                      <div class="control-row">
                        <label class="control-check">
                          <input v-model="expanded2" type="checkbox" />
                          <span>Expanded</span>
                        </label>
                      </div>
                    </div>
                    <div v-overlay-scrollbars="horizontalOverlayScrollbars" class="demo-preview">
                      <div
                        class="demo-output width-guide height-guide"
                        :style="{ width: `${lineWidth}px` }"
                      >
                        <LineClamp
                          class="demo-clamp"
                          :class="{ hyphens: lineHyphens, rtl: lineRtl }"
                          :text="lineTextInput"
                          :max-height="height2"
                          :boundary="lineBoundary"
                          v-model:expanded="expanded2"
                          :style="{ width: `${lineWidth}px`, maxWidth: '100%' }"
                        >
                          <template #before>
                            <span class="badge">{{ lineBadgeLabel(lineRtl) }}</span>
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
                    </div>
                    <div v-overlay-scrollbars="horizontalOverlayScrollbars" class="demo-preview">
                      <div class="demo-output width-guide" :style="{ width: `${lineWidth}px` }">
                        <LineClamp
                          class="demo-clamp"
                          :class="{ hyphens: lineHyphens, rtl: lineRtl }"
                          :text="lineTextInput"
                          :max-lines="lines3"
                          :boundary="lineBoundary"
                          :style="{ width: `${lineWidth}px`, maxWidth: '100%' }"
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
                          <PillControls
                            class="control-pills"
                            aria-label="Location presets"
                            button-class="control-pill"
                            :model-value="selectedLocationPreset4"
                            :options="locationPresetOptions"
                            @update:modelValue="updateLocationPreset"
                          />
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
                    </div>
                    <div v-overlay-scrollbars="horizontalOverlayScrollbars" class="demo-preview">
                      <div class="demo-output width-guide" :style="{ width: `${lineWidth}px` }">
                        <LineClamp
                          class="demo-clamp"
                          :class="{ hyphens: lineHyphens, rtl: lineRtl }"
                          :text="lineTextInput"
                          :max-lines="lines4"
                          :location="location4"
                          :ellipsis="ellipsis4"
                          :boundary="lineBoundary"
                          :style="{ width: `${lineWidth}px`, maxWidth: '100%' }"
                        >
                          <template #after="{ toggle, expanded, clamped }">
                            <button v-if="expanded || clamped" class="toggle-btn" @click="toggle">
                              {{ toggleLabel(expanded, lineRtl) }}
                            </button>
                          </template>
                        </LineClamp>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <div v-else-if="activeSurface === 'rich'" class="demo-surface" data-demo="rich">
              <div class="demo-source-controls">
                <div class="demo-controls">
                  <div class="control stacked-control rich-html-settings shared-control-wide">
                    <span class="control-stack">
                      <PillControls
                        class="control-pills"
                        aria-label="Rich HTML presets"
                        button-class="control-pill"
                        :model-value="selectedRichHtmlPreset"
                        :options="richHtmlPresetOptions"
                        @update:modelValue="updateRichHtmlPreset"
                      />
                      <textarea
                        v-model="richHtmlInput"
                        class="control-textarea control-textarea-rich"
                        data-rich-html-input
                        rows="8"
                        aria-label="RichLineClamp demo HTML"
                        placeholder="Paste or type trusted inline HTML to try <RichLineClamp>."
                      ></textarea>
                    </span>
                  </div>
                </div>
              </div>

              <div
                class="demo-shared-controls"
                :class="{ 'is-expanded': demoControlsExpanded }"
                data-shared-controls="rich"
              >
                <button
                  class="demo-controls-toggle"
                  data-demo-controls-toggle
                  type="button"
                  :aria-expanded="demoControlsExpanded"
                  :aria-label="
                    demoControlsExpanded ? 'Collapse demo controls' : 'Expand demo controls'
                  "
                  @click="demoControlsExpanded = !demoControlsExpanded"
                >
                  <span class="demo-controls-toggle-glyph" aria-hidden="true">
                    <SlidersHorizontal :size="16" :stroke-width="2" />
                  </span>
                  <span class="demo-controls-toggle-copy">
                    <span class="demo-controls-toggle-title">Demo controls</span>
                    <span class="demo-controls-toggle-summary">{{ demoControlsSummary }}</span>
                  </span>
                  <ChevronDown
                    class="demo-controls-toggle-icon"
                    :size="17"
                    :stroke-width="2"
                    aria-hidden="true"
                  />
                </button>
                <div class="demo-controls-panel">
                  <div class="demo-controls-panel-inner">
                    <div class="demo-controls">
                      <div class="control stacked-control">
                        <span class="control-label">Boundary</span>
                        <span class="control-stack">
                          <PillControls
                            class="control-pills"
                            aria-label="Rich text boundary"
                            button-class="control-pill"
                            :model-value="richBoundary"
                            :options="clampBoundaryOptions"
                            @update:modelValue="updateRichBoundary"
                          />
                        </span>
                      </div>
                      <label class="control">
                        <span class="control-label">Width</span>
                        <span class="control-row">
                          <input
                            v-model.number="richWidth"
                            data-rich-width-slider
                            class="control-range"
                            type="range"
                            min="240"
                            max="600"
                          />
                          <span class="control-value">{{ richWidth }}px</span>
                        </span>
                      </label>
                      <div class="control-row shared-checks">
                        <label class="control-check">
                          <input v-model="richHyphens" data-rich-hyphens-toggle type="checkbox" />
                          <span>CSS Hyphens</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="demo-example-list">
                <div class="demo-block" data-demo="rich-html" data-rich-example="max-lines">
                  <div class="demo-label">max-lines / slot <code>after</code> / toggle</div>
                  <div class="demo-controls">
                    <label class="control">
                      <span class="control-label">Max lines</span>
                      <input
                        v-model.number="richLines5"
                        class="control-input"
                        type="number"
                        min="1"
                        max="6"
                        step="1"
                      />
                    </label>
                  </div>
                  <div v-overlay-scrollbars="horizontalOverlayScrollbars" class="demo-preview">
                    <div class="demo-output width-guide" :style="{ width: `${richWidth}px` }">
                      <RichLineClamp
                        class="demo-clamp demo-rich-card"
                        :class="{ hyphens: richHyphens }"
                        :html="richHtmlInput"
                        :max-lines="richLines5"
                        :boundary="richBoundary"
                        :style="{ width: `${richWidth}px`, maxWidth: '100%' }"
                      >
                        <template #after="{ toggle, expanded, clamped }">
                          <button v-if="expanded || clamped" class="toggle-btn" @click="toggle">
                            {{ expanded ? "Less" : "More" }}
                          </button>
                        </template>
                      </RichLineClamp>
                    </div>
                    <p class="clamp-status">
                      Trusted or sanitized inline HTML only. <code>&lt;RichLineClamp&gt;</code>
                      makes a best-effort pass across inline-flow markup and always clamps from the
                      end.
                    </p>
                  </div>
                </div>

                <div class="demo-block" data-rich-example="max-height">
                  <div class="demo-label">
                    max-height / slot <code>before</code> / external control
                  </div>
                  <div class="demo-controls">
                    <label class="control">
                      <span class="control-label">Max height</span>
                      <input v-model="richHeight6" class="control-input" />
                    </label>
                    <div class="control-row">
                      <label class="control-check">
                        <input v-model="richExpanded6" type="checkbox" />
                        <span>Expanded</span>
                      </label>
                    </div>
                  </div>
                  <div v-overlay-scrollbars="horizontalOverlayScrollbars" class="demo-preview">
                    <div
                      class="demo-output width-guide height-guide"
                      :style="{ width: `${richWidth}px` }"
                    >
                      <RichLineClamp
                        class="demo-clamp demo-rich-card"
                        :class="{ hyphens: richHyphens }"
                        :html="richHtmlInput"
                        :max-height="richHeight6"
                        :boundary="richBoundary"
                        v-model:expanded="richExpanded6"
                        :style="{ width: `${richWidth}px`, maxWidth: '100%' }"
                      >
                        <template #before>
                          <span class="badge">Featured</span>
                        </template>
                      </RichLineClamp>
                    </div>
                  </div>
                </div>

                <div class="demo-block" data-rich-example="clampchange">
                  <div class="demo-label"><code>clampchange</code> event</div>
                  <div class="demo-controls">
                    <label class="control">
                      <span class="control-label">Max lines</span>
                      <input
                        v-model.number="richLines7"
                        class="control-input"
                        type="number"
                        min="1"
                        max="6"
                        step="1"
                      />
                    </label>
                  </div>
                  <div v-overlay-scrollbars="horizontalOverlayScrollbars" class="demo-preview">
                    <div class="demo-output width-guide" :style="{ width: `${richWidth}px` }">
                      <RichLineClamp
                        class="demo-clamp demo-rich-card"
                        :class="{ hyphens: richHyphens }"
                        :html="richHtmlInput"
                        :max-lines="richLines7"
                        :boundary="richBoundary"
                        :style="{ width: `${richWidth}px`, maxWidth: '100%' }"
                        @clampchange="richClamped7 = $event"
                      />
                    </div>
                    <p class="clamp-status">
                      Clamped:
                      <strong :class="richClamped7 ? 'status-yes' : 'status-no'">{{
                        richClamped7 ? "Yes" : "No"
                      }}</strong>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div v-else-if="activeSurface === 'inline'" class="demo-surface" data-demo="inline">
              <div
                class="demo-shared-controls"
                :class="{ 'is-expanded': demoControlsExpanded }"
                data-shared-controls="inline"
              >
                <button
                  class="demo-controls-toggle"
                  data-demo-controls-toggle
                  type="button"
                  :aria-expanded="demoControlsExpanded"
                  :aria-label="
                    demoControlsExpanded ? 'Collapse demo controls' : 'Expand demo controls'
                  "
                  @click="demoControlsExpanded = !demoControlsExpanded"
                >
                  <span class="demo-controls-toggle-glyph" aria-hidden="true">
                    <SlidersHorizontal :size="16" :stroke-width="2" />
                  </span>
                  <span class="demo-controls-toggle-copy">
                    <span class="demo-controls-toggle-title">Demo controls</span>
                    <span class="demo-controls-toggle-summary">{{ demoControlsSummary }}</span>
                  </span>
                  <ChevronDown
                    class="demo-controls-toggle-icon"
                    :size="17"
                    :stroke-width="2"
                    aria-hidden="true"
                  />
                </button>
                <div class="demo-controls-panel">
                  <div class="demo-controls-panel-inner">
                    <div class="demo-controls">
                      <div class="control stacked-control">
                        <span class="control-label">Location</span>
                        <span class="control-stack">
                          <PillControls
                            class="control-pills"
                            aria-label="Inline location presets"
                            button-class="control-pill"
                            :model-value="selectedInlineLocationPreset5"
                            :options="inlineLocationPresetOptions"
                            @update:modelValue="updateInlineLocationPreset"
                          />
                        </span>
                      </div>
                      <div class="control stacked-control">
                        <span class="control-label">Boundary</span>
                        <span class="control-stack">
                          <PillControls
                            class="control-pills"
                            aria-label="Inline boundary"
                            button-class="control-pill"
                            :model-value="inlineBoundary5"
                            :options="clampBoundaryOptions"
                            @update:modelValue="updateInlineBoundary"
                          />
                        </span>
                      </div>
                      <div class="control stacked-control">
                        <span class="control-label">Ratio</span>
                        <span class="control-stack">
                          <span class="control-row">
                            <input
                              v-model.number="inlineLocationRatio5"
                              data-inline-location-ratio-slider
                              class="control-range"
                              type="range"
                              min="0"
                              max="1"
                              step="0.05"
                            />
                            <span class="control-value">{{ inlineLocationRatio5.toFixed(2) }}</span>
                          </span>
                        </span>
                      </div>
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
                  <div v-overlay-scrollbars="horizontalOverlayScrollbars" class="demo-preview">
                    <div class="comparison-grid">
                      <div class="comparison-panel" data-inline-mode="plain">
                        <div class="comparison-label">Plain</div>
                        <div
                          class="demo-output width-guide"
                          :style="{ width: `${inlineWidth5}px` }"
                        >
                          <InlineClamp
                            class="demo-inline"
                            :text="example.text"
                            :location="inlineLocation5"
                            :boundary="inlineBoundary5"
                          />
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
                            :location="inlineLocation5"
                            :boundary="inlineBoundary5"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-else class="demo-surface" data-demo="wrap">
              <div
                class="demo-shared-controls"
                :class="{ 'is-expanded': demoControlsExpanded }"
                data-shared-controls="wrap"
              >
                <button
                  class="demo-controls-toggle"
                  data-demo-controls-toggle
                  type="button"
                  :aria-expanded="demoControlsExpanded"
                  :aria-label="
                    demoControlsExpanded ? 'Collapse demo controls' : 'Expand demo controls'
                  "
                  @click="demoControlsExpanded = !demoControlsExpanded"
                >
                  <span class="demo-controls-toggle-glyph" aria-hidden="true">
                    <SlidersHorizontal :size="16" :stroke-width="2" />
                  </span>
                  <span class="demo-controls-toggle-copy">
                    <span class="demo-controls-toggle-title">Demo controls</span>
                    <span class="demo-controls-toggle-summary">{{ demoControlsSummary }}</span>
                  </span>
                  <ChevronDown
                    class="demo-controls-toggle-icon"
                    :size="17"
                    :stroke-width="2"
                    aria-hidden="true"
                  />
                </button>
                <div class="demo-controls-panel">
                  <div class="demo-controls-panel-inner">
                    <div class="demo-controls">
                      <label class="control">
                        <span class="control-label">Width</span>
                        <span class="control-row">
                          <input
                            v-model.number="wrapWidth"
                            data-wrap-width-slider
                            class="control-range"
                            type="range"
                            min="240"
                            max="600"
                          />
                          <span class="control-value">{{ wrapWidth }}px</span>
                        </span>
                      </label>
                      <div class="control-row shared-checks">
                        <label class="control-check">
                          <input v-model="wrapRtl" data-wrap-rtl-toggle type="checkbox" />
                          <span>RTL</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="demo-example-list">
                <div class="demo-block" data-wrap-example="tabs">
                  <div class="demo-label">
                    tabs / fixed one-line / hidden items in <code>after</code>
                  </div>
                  <div v-overlay-scrollbars="horizontalOverlayScrollbars" class="demo-preview">
                    <div class="demo-output width-guide" :style="{ width: `${wrapWidth}px` }">
                      <WrapClamp
                        class="demo-wrap wrap-tabs"
                        :class="{ rtl: wrapRtl }"
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
                              :aria-label="wrapTabsTriggerLabel(wrapRtl)"
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
                    <div class="control-row">
                      <label class="control-check">
                        <input v-model="wrapExpanded7" type="checkbox" />
                        <span>Expanded</span>
                      </label>
                    </div>
                  </div>
                  <div v-overlay-scrollbars="horizontalOverlayScrollbars" class="demo-preview">
                    <div
                      class="demo-output width-guide height-guide"
                      :style="{ width: `${wrapWidth}px` }"
                    >
                      <WrapClamp
                        class="demo-wrap"
                        :class="{ rtl: wrapRtl }"
                        :items="wrapInviteeItems7"
                        item-key="id"
                        :max-height="wrapHeight7"
                        v-model:expanded="wrapExpanded7"
                        :style="{ width: `${wrapWidth}px`, maxWidth: '100%' }"
                      >
                        <template #before>
                          <span class="wrap-prefix" data-wrap-prefix>{{
                            wrapInviteePrefixLabel(wrapRtl)
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
                            {{ toggleLabel(expanded, wrapRtl) }}
                          </button>
                        </template>
                      </WrapClamp>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section
            class="reference-section stress-playground-section"
            data-reference-panel="stress"
          >
            <h3 class="subsection-title">Stress playground</h3>
            <div class="stress-playground-row">
              <button
                class="stress-playground-open"
                data-stress-playground-open
                type="button"
                @click="stressPlaygroundOpen = true"
              >
                <Gauge :size="15" :stroke-width="2" aria-hidden="true" />
                <span>Open playground</span>
              </button>
            </div>
            <StressPlayground
              v-if="stressPlaygroundOpen"
              :initial-surface="activeSurface"
              @close="stressPlaygroundOpen = false"
            />
          </section>

          <section class="reference-section" data-reference-panel="example">
            <h3 class="subsection-title">Usage</h3>
            <CodeBlock
              v-if="activeSurface === 'line'"
              :code="lineCodeExample"
              :html="highlightedLineCode"
              label="<LineClamp> example"
              block-id="line-example"
            />
            <CodeBlock
              v-else-if="activeSurface === 'rich'"
              :code="richCodeExample"
              :html="highlightedRichCode"
              label="<RichLineClamp> example"
              block-id="rich-example"
            />
            <CodeBlock
              v-else-if="activeSurface === 'inline'"
              :code="inlineCodeExample"
              :html="highlightedInlineCode"
              label="<InlineClamp> example"
              block-id="inline-example"
            />
            <CodeBlock
              v-else
              :code="wrapCodeExample"
              :html="highlightedWrapCode"
              label="<WrapClamp> example"
              block-id="wrap-example"
            />
          </section>

          <section class="reference-section" data-reference-panel="api">
            <h3 class="subsection-title">API</h3>
            <template v-if="activeSurface === 'line'">
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
                    <p class="api-entry-copy">Plain source string to clamp.</p>
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
                      <div class="api-entry-name"><code>boundary</code></div>
                      <div class="api-entry-meta">
                        <span class="api-meta-pair">
                          <span class="api-meta-label">Type</span>
                          <code>'grapheme' | 'word'</code>
                        </span>
                        <span class="api-meta-pair">
                          <span class="api-meta-label">Default</span>
                          <code>'grapheme'</code>
                        </span>
                      </div>
                    </div>
                    <p class="api-entry-copy">
                      Clamp cut points. Use <code>'word'</code> to avoid partial words.
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

            <template v-else-if="activeSurface === 'rich'">
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
                      <div class="api-entry-name"><code>html</code></div>
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
                    <p class="api-entry-copy">Trusted or sanitized inline HTML source.</p>
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
                    <p class="api-entry-copy">Ellipsis inserted into clamped content.</p>
                  </div>
                  <div class="api-entry">
                    <div class="api-entry-header">
                      <div class="api-entry-name"><code>boundary</code></div>
                      <div class="api-entry-meta">
                        <span class="api-meta-pair">
                          <span class="api-meta-label">Type</span>
                          <code>'grapheme' | 'word'</code>
                        </span>
                        <span class="api-meta-pair">
                          <span class="api-meta-label">Default</span>
                          <code>'grapheme'</code>
                        </span>
                      </div>
                    </div>
                    <p class="api-entry-copy">
                      Text-node cut points. Use <code>'word'</code> to avoid partial words inside
                      rich inline text.
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
                      Shows the full rich content. Supports <code>v-model</code>.
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
                      <p>Leading inline content measured with the rich text flow.</p>
                      <dl class="api-detail-list">
                        <div class="api-detail-item">
                          <dt class="api-detail-term">Slot props</dt>
                          <dd class="api-detail-desc">
                            Same control props as <code>&lt;LineClamp&gt;</code>.
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
                    <p class="api-entry-copy">
                      Text inserted when the shrinkable body is shortened.
                    </p>
                  </div>
                  <div class="api-entry">
                    <div class="api-entry-header">
                      <div class="api-entry-name"><code>location</code></div>
                      <div class="api-entry-meta">
                        <span class="api-meta-pair">
                          <span class="api-meta-label">Type</span>
                          <code>'start' | 'middle' | 'end' | number</code>
                        </span>
                        <span class="api-meta-pair">
                          <span class="api-meta-label">Default</span>
                          <code>'end'</code>
                        </span>
                      </div>
                    </div>
                    <p class="api-entry-copy">
                      Controls how the rewritten <code>body</code> segment keeps text around the
                      ellipsis. Numeric values map from <code>0</code> at the start to
                      <code>1</code> at the end.
                    </p>
                  </div>
                  <div class="api-entry">
                    <div class="api-entry-header">
                      <div class="api-entry-name"><code>boundary</code></div>
                      <div class="api-entry-meta">
                        <span class="api-meta-pair">
                          <span class="api-meta-label">Type</span>
                          <code>'grapheme' | 'word'</code>
                        </span>
                        <span class="api-meta-pair">
                          <span class="api-meta-label">Default</span>
                          <code>'grapheme'</code>
                        </span>
                      </div>
                    </div>
                    <p class="api-entry-copy">
                      Cut points for the rewritten <code>body</code> segment. Use
                      <code>'word'</code> for prose-like one-line labels.
                    </p>
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
                        Optional splitter for dividing one line into fixed parts and a rewritten
                        body.
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
                                <dd class="api-subdetail-desc">Required rewritten segment.</dd>
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
      <p class="footer-copy">
        By
        <a href="https://github.com/Justineo" target="_blank" rel="noopener">@Justineo</a>
        and
        <a
          href="https://github.com/Justineo/vue-clamp/graphs/contributors"
          target="_blank"
          rel="noopener"
          >contributors</a
        >
      </p>
      <p class="footer-meta">
        Built with
        <a class="footer-brand-link" href="https://viteplus.dev" target="_blank" rel="noopener">
          <span class="sr-only">VitePlus</span>
          <img
            class="footer-viteplus-logo"
            src="/viteplus.svg"
            alt=""
            aria-hidden="true"
            decoding="async"
          />
        </a>
        and hosted on
        <a class="footer-brand-link" href="https://void.app" target="_blank" rel="noopener">
          <span class="sr-only">Void</span>
          <img
            class="footer-void-logo"
            src="/void.svg"
            alt=""
            aria-hidden="true"
            decoding="async"
          />
        </a>
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
  --c-code-bg: color-mix(in srgb, var(--c-text) 7%, transparent);
  --c-success: #16a34a;
  --c-muted: #9ca3af;
  --focus-ring: 0 0 0 3px color-mix(in srgb, var(--c-accent) 18%, transparent);
  --focus-ring-subtle: 0 0 0 2px color-mix(in srgb, var(--c-accent) 22%, transparent);
  --font-body: Geist, "Segoe UI", "Helvetica Neue", Arial, sans-serif;
  --font-mono:
    "Geist Mono", "JetBrains Mono", "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  --radius: 6px;
  --radius-lg: 8px;
  --component-tabs-height: 42px;
  --control-height: 28px;
  --demo-controls-sticky-top: var(--component-tabs-height);
  --demo-range-width: 126px;
}

html {
  font-family: var(--font-body);
  font-size: 15px;
  line-height: 1.6;
  color: var(--c-text);
  background: var(--c-bg);
  scroll-behavior: smooth;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

@supports (-webkit-touch-callout: none) {
  html {
    -webkit-text-size-adjust: 100%;
    text-size-adjust: 100%;
  }
}

body {
  margin: 0;
  scroll-behavior: smooth;
}

.os-theme-light.os-scrollbar {
  --os-size: 11px;
  --os-padding-axis: 2px;
  --os-padding-perpendicular: 2px;
  --os-track-border-radius: 999px;
  --os-handle-border-radius: 999px;
  --os-handle-bg: color-mix(in srgb, var(--c-text-3) 34%, transparent);
  --os-handle-bg-hover: color-mix(in srgb, var(--c-accent) 34%, var(--c-text-3));
  --os-handle-bg-active: color-mix(in srgb, var(--c-accent) 54%, var(--c-text-2));
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

.hero-tagline-measure-parts {
  display: grid;
  justify-items: start;
  gap: 4px;
}

.hero-tagline-measure-line {
  display: inline-block;
  width: auto;
  max-width: none;
  transition: none;
  white-space: nowrap;
}

.hero-tagline-measure-segment {
  white-space: pre;
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

/* Surface guide */

.surface-guide {
  display: grid;
  gap: 12px;
}

.surface-guide-lead {
  margin: 0;
  font-size: 0.92rem;
  line-height: 1.7;
  color: var(--c-text-2);
}

.surface-guide-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0;
  border-top: 1px solid var(--c-border);
  border-left: 1px solid var(--c-border);
}

.surface-guide-item {
  min-width: 0;
}

.surface-guide-card {
  position: relative;
  z-index: 0;
  display: grid;
  gap: 6px;
  min-height: 100%;
  padding: 14px 16px;
  color: inherit;
  text-decoration: none;
  background: transparent;
  border-right: 1px solid var(--c-border);
  border-bottom: 1px solid var(--c-border);
  transition:
    background 0.15s,
    color 0.15s;
}

.surface-guide-card::before {
  content: "";
  position: absolute;
  inset: -1px;
  pointer-events: none;
  border: 1px solid transparent;
  transition: border-color 0.15s;
}

.surface-guide-card::after {
  content: "";
  position: absolute;
  top: -1px;
  right: -1px;
  width: 0;
  height: 0;
  pointer-events: none;
  opacity: 0.8;
  border-top: 11px solid var(--c-border);
  border-left: 11px solid transparent;
  transition:
    border-top-color 0.15s,
    opacity 0.15s;
}

.surface-guide-card:hover {
  z-index: 1;
  background: color-mix(in srgb, var(--c-accent-soft) 10%, transparent);
}

.surface-guide-card:hover::before {
  border-color: color-mix(in srgb, var(--c-accent) 44%, var(--c-border));
}

.surface-guide-card:focus-visible::before {
  border-color: var(--c-accent);
}

.surface-guide-card:hover::after {
  border-top-color: color-mix(in srgb, var(--c-accent) 36%, var(--c-border));
  opacity: 1;
}

.surface-guide-card:focus-visible::after {
  border-top-color: var(--c-accent);
  opacity: 1;
}

.surface-guide-card:focus-visible {
  z-index: 1;
  outline: none;
  border-radius: 0;
  box-shadow: none;
}

.surface-guide-link {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  color: var(--c-text);
  text-decoration: none;
}

.surface-guide-link code {
  font-size: 0.86rem;
  color: inherit;
  background: transparent;
  padding: 0;
}

.surface-guide-card:hover .surface-guide-link,
.surface-guide-card:focus-visible .surface-guide-link {
  color: var(--c-accent-text);
}

.surface-guide-card:hover .surface-guide-link code,
.surface-guide-card:focus-visible .surface-guide-link code {
  color: inherit;
}

.surface-guide-summary {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.6;
  color: var(--c-text-2);
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
  top: 0;
  z-index: 9;
  block-size: var(--component-tabs-height);
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
  position: relative;
  margin-top: 26px;
  padding-top: 26px;
}

.reference-section + .reference-section::before {
  content: "";
  position: absolute;
  top: 0;
  left: 50%;
  width: 72px;
  height: 1px;
  background: color-mix(in srgb, var(--c-border) 72%, var(--c-bg));
  transform: translateX(-50%);
}

.reference-section > .subsection-title {
  margin-top: 0;
}

/* Demo blocks */

.stress-playground-section {
  text-align: center;
}

.stress-playground-row {
  display: flex;
  justify-content: center;
  margin: 0;
}

.stress-playground-open {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 11px;
  gap: 7px;
  font-size: 0.8rem;
  font-weight: 600;
  font-family: inherit;
  color: var(--c-text-2);
  background: transparent;
  border: 1px solid var(--c-border);
  border-radius: 8px;
  cursor: pointer;
  transition:
    background 0.15s,
    border-color 0.15s,
    color 0.15s,
    box-shadow 0.15s;
}

.stress-playground-open:hover {
  color: var(--c-accent-text);
  background: color-mix(in srgb, var(--c-accent-soft) 74%, var(--c-bg));
  border-color: color-mix(in srgb, var(--c-accent) 28%, transparent);
}

.stress-playground-open:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.demo-surface {
  display: flex;
  flex-direction: column;
}

.demo-source-controls {
  padding-bottom: 14px;
}

.demo-shared-controls {
  position: sticky;
  top: var(--demo-controls-sticky-top);
  z-index: 8;
  padding: 0;
  margin-bottom: 22px;
  background: color-mix(in srgb, var(--c-bg) 96%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--c-border) 72%, transparent);
  backdrop-filter: blur(12px);
}

.demo-controls-toggle {
  display: none;
}

.demo-controls-panel-inner {
  padding: 9px 0 10px;
}

.demo-shared-controls .demo-controls {
  flex-flow: row wrap;
  align-items: center;
  column-gap: 22px;
  row-gap: 8px;
  padding-bottom: 0;
}

.demo-shared-controls .control {
  min-height: var(--control-height);
}

.demo-shared-controls .stacked-control {
  align-items: center;
}

.demo-shared-controls .control-label {
  width: auto;
}

.demo-shared-controls .control-stack {
  flex: 0 1 auto;
  flex-direction: row;
  align-items: center;
  gap: 6px;
}

.demo-shared-controls .control-row {
  min-height: var(--control-height);
  flex: 0 1 auto;
}

.demo-shared-controls .control-range {
  flex: 0 1 var(--demo-range-width);
  inline-size: var(--demo-range-width);
}

.shared-control-wide {
  inline-size: 100%;
}

.shared-checks {
  min-height: var(--control-height);
  gap: 12px;
}

.line-text-settings {
  padding: 6px 0;
}

.rich-html-settings {
  padding: 6px 0;
}

.demo-example-list {
  display: flex;
  flex-direction: column;
}

.demo-block {
  position: relative;
  margin-bottom: 0;
  padding: 18px 0 20px;
}

.demo-block:first-child {
  padding-top: 0;
}

.demo-block + .demo-block::before {
  content: "";
  position: absolute;
  top: 0;
  left: 50%;
  width: 56px;
  height: 1px;
  background: color-mix(in srgb, var(--c-border) 60%, var(--c-bg));
  transform: translateX(-50%);
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
  min-height: var(--control-height);
  font-size: 0.8rem;
}

.stacked-control {
  align-items: flex-start;
}

.control-label {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  width: 72px;
  min-height: var(--control-height);
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
  height: var(--control-height);
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

.control-textarea {
  inline-size: min(100%, 720px);
  min-height: 120px;
  padding: 10px 12px;
  font-family: inherit;
  font-weight: inherit;
  line-height: 1.6;
  color: var(--c-text);
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  border-radius: 10px;
  field-sizing: content;
  resize: vertical;
  scrollbar-width: thin;
  outline: none;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}

.control-textarea:focus-visible {
  border-color: var(--c-accent);
  box-shadow: var(--focus-ring);
}

.control-textarea-rich {
  min-height: 180px;
}

.control-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-height: var(--control-height);
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
  min-height: var(--control-height);
  font-size: 0.8rem;
  color: var(--c-text-2);
  cursor: pointer;
  user-select: none;
}

.control-check input,
.control-radio input {
  accent-color: var(--c-accent);
}

.control-check input:focus-visible,
.control-radio input:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.demo-preview {
  padding: 14px;
  background: var(--c-bg-soft);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  font-size: 0.9rem;
}

.demo-preview :deep([data-overlayscrollbars-viewport]) {
  overscroll-behavior-x: contain;
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
  display: flex;
  align-items: center;
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

:deep(.demo-rich-card) {
  color: var(--c-text);
}

:deep(.demo-rich-card a) {
  color: var(--c-accent-text);
  font-weight: 600;
  text-decoration-thickness: 1.5px;
}

:deep(.demo-rich-card mark) {
  padding: 0 0.2em;
  color: #6e3d00;
  background: #fff1c7;
  border-radius: 0.2em;
}

:deep(.demo-rich-card code) {
  padding: 0.12em 0.38em;
  font-size: 0.82em;
  font-family: var(--font-mono);
  color: var(--c-accent-text);
  background: var(--c-code-bg);
  border-radius: 999px;
}

:deep(.demo-rich-card .rich-chip) {
  display: inline;
  padding: 0.08rem 0.42rem 0.12rem;
  font-size: 0.72rem;
  font-weight: 600;
  line-height: 1.45;
  color: var(--c-text-2);
  background: var(--c-bg-soft);
  border: 1px solid var(--c-border);
  border-radius: 999px;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}

:deep(.demo-rich-card .rich-chip--accent) {
  color: var(--c-accent-text);
  background: var(--c-accent-soft);
  border-color: color-mix(in srgb, var(--c-accent) 28%, white);
}

:deep(.demo-rich-card .rich-chip--quiet) {
  color: var(--c-text-3);
  background: rgba(215, 220, 232, 0.32);
}

:deep(.demo-rich-card .rich-chip--warm) {
  color: #995214;
  background: #fff4e4;
  border-color: #f0d0aa;
}

:deep(.demo-rich-card .rich-chip--success) {
  color: #0f7b46;
  background: #edf9f1;
  border-color: #cbe7d4;
}

:deep(.demo-rich-card .rich-link-run) {
  font-family: var(--font-mono);
  color: var(--c-text-2);
}

:deep(.demo-rich-card .rich-meta) {
  color: var(--c-text-3);
}

:deep(.demo-rich-card inline-note) {
  color: var(--c-accent-text);
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
.toggle-btn:focus-visible {
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
  .surface-guide-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

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
  :root {
    --demo-range-width: 100%;
  }

  .hero-tagline-shell {
    max-width: 100%;
  }

  .demo-source-controls {
    padding-bottom: 10px;
  }

  .demo-shared-controls {
    margin-bottom: 14px;
    padding: 0;
    border-bottom: none;
  }

  .demo-shared-controls.is-expanded {
    border-bottom: 1px solid color-mix(in srgb, var(--c-border) 82%, transparent);
  }

  .demo-controls-toggle {
    display: flex;
    align-items: center;
    width: 100%;
    min-height: 58px;
    padding: 9px 10px;
    gap: 10px;
    font-size: 0.8rem;
    font-weight: 600;
    font-family: inherit;
    color: var(--c-text);
    background: var(--c-bg);
    border: 1px solid var(--c-border);
    border-radius: 13px;
    box-shadow: 0 1px 2px rgba(18, 20, 28, 0.04);
    cursor: pointer;
    text-align: left;
    transition:
      border-color 0.15s,
      background 0.15s,
      box-shadow 0.15s;
  }

  .demo-controls-toggle:hover {
    border-color: var(--c-border-dark);
    background: color-mix(in srgb, var(--c-bg) 82%, var(--c-bg-soft));
  }

  .demo-controls-toggle:focus-visible {
    outline: none;
    border-color: var(--c-accent);
    box-shadow: var(--focus-ring);
  }

  .demo-controls-toggle-glyph {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 34px;
    width: 34px;
    height: 34px;
    color: var(--c-accent-text);
    background: var(--c-accent-soft);
    border-radius: 10px;
  }

  .demo-controls-toggle-copy {
    display: grid;
    flex: 1 1 auto;
    min-width: 0;
    gap: 1px;
  }

  .demo-controls-toggle-title {
    min-width: 0;
    font-size: 0.82rem;
    line-height: 1.3;
    color: var(--c-text);
  }

  .demo-controls-toggle-summary {
    min-width: 0;
    overflow: hidden;
    font-size: 0.72rem;
    font-weight: 500;
    line-height: 1.35;
    color: var(--c-text-3);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .demo-controls-toggle-icon {
    flex: 0 0 auto;
    color: var(--c-text-3);
    transition: transform 0.15s;
  }

  .demo-shared-controls.is-expanded .demo-controls-toggle-icon {
    transform: rotate(180deg);
  }

  .demo-controls-panel {
    display: grid;
    grid-template-rows: 0fr;
    overflow: hidden;
    transition: grid-template-rows 0.18s ease;
  }

  .demo-shared-controls.is-expanded .demo-controls-panel {
    grid-template-rows: 1fr;
  }

  .demo-controls-panel-inner {
    min-height: 0;
    overflow: hidden;
    padding: 0;
  }

  .demo-shared-controls.is-expanded .demo-controls-panel-inner {
    padding: 8px 0 11px;
  }

  .demo-shared-controls .demo-controls {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .demo-shared-controls .control,
  .demo-shared-controls .shared-checks {
    width: 100%;
  }

  .demo-shared-controls .control-label {
    width: 72px;
    min-width: 72px;
  }

  .demo-shared-controls .control-row,
  .demo-shared-controls .control-stack {
    flex: 1 1 auto;
    min-width: 0;
    justify-content: flex-end;
  }

  .demo-shared-controls .control-range {
    flex: 1 1 auto;
    inline-size: auto;
    min-width: 96px;
    max-width: none;
  }

  .demo-shared-controls .control-pills {
    justify-content: flex-end;
  }

  .demo-shared-controls .shared-checks {
    justify-content: flex-start;
  }
}

/* Footer */

.footer {
  padding: 32px 0 0;
  display: grid;
  gap: 10px;
  justify-items: center;
  text-align: center;
  font-size: 0.8rem;
  color: var(--c-text-3);
}

.footer-copy {
  margin: 0;
}

.footer a {
  color: var(--c-text-2);
  font-weight: 500;
}

.footer a:hover {
  color: var(--c-accent);
}

.footer-meta {
  margin: 0;
}

.footer-brand-link {
  display: inline-block;
  vertical-align: baseline;
  text-decoration: none;
}

.footer-brand-link:hover {
  text-decoration: none;
}

.footer-viteplus-logo {
  height: 0.5lh;
  width: auto;
  display: block;
}

.footer-void-logo {
  height: 0.5lh;
  width: auto;
  display: block;
}

.footer-brand-link:hover .footer-viteplus-logo,
.footer-brand-link:hover .footer-void-logo {
  opacity: 0.88;
}
</style>
