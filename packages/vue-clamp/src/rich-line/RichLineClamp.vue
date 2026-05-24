<script setup lang="ts">
import { computed, nextTick, shallowRef, useTemplateRef, watch } from "vue";
import { cssLength, normalizeLineLimit } from "../layout.ts";
import { useMultilineClamp } from "../multiline.ts";
import { MultilineAffixSlot } from "../multiline-render.ts";
import { multilineSlotStyle } from "../multiline-styles.ts";
import { clampRich, patchRich, prepareRich } from "../rich.ts";
import { richProbeStyle } from "./styles.ts";

import type { CSSProperties } from "vue";
import type { ClampEmits } from "../types.ts";
import type { PreparedRich, RichState } from "../rich.ts";
import type {
  RichLineClampExposed,
  RichLineClampProps,
  RichLineClampSlotProps,
  RichLineClampSlots,
} from "./types.ts";

type ProbeElements = {
  body: HTMLElement;
  content: HTMLElement;
};

// Large width jumps are cheaper as cold search than as repeated local expansion.
const warmSearchWidthDelta = 32;

defineOptions({
  name: "RichLineClamp",
  inheritAttrs: false,
});

const {
  as: rootTag = "div",
  html,
  maxLines,
  maxHeight,
  ellipsis = "…",
  boundary = "grapheme",
} = defineProps<Omit<RichLineClampProps, "expanded">>();
const expanded = defineModel<NonNullable<RichLineClampProps["expanded"]>>("expanded", {
  default: false,
});
const emit = defineEmits<Omit<ClampEmits, "update:expanded">>();
const slots = defineSlots<RichLineClampSlots>();

const probeRef = useTemplateRef("probe");
const isFallback = shallowRef(false);

const preparedHtml = computed(() => prepareRich(html, boundary));

// The visible tree and hidden probe advance independently: visibleState patches
// user-facing DOM, while probeState keeps measurement patches cheap across
// repeated reclamps.
let visibleState: RichState | null = null;
let probeState: RichState | null = null;
let probeElements: ProbeElements | null = null;
let probeStateWidth: number | null = null;

const {
  rootRef,
  contentRef,
  beforeRef,
  bodyRef,
  afterRef,
  isClamped,
  expand,
  collapse,
  toggle,
  requestRecompute,
} = useMultilineClamp({
  expanded,
  onClampedChange: (value) => {
    emit("clampchange", value);
  },
  recompute: async (expanded): Promise<void> => {
    const lineLimit = normalizeLineLimit(maxLines);

    if (
      expanded.value ||
      html.length === 0 ||
      (lineLimit === undefined && maxHeight === undefined)
    ) {
      // Expanded, empty, and unlimited states should leave the trusted HTML
      // visible as authored.
      await resetClamp();
      return;
    }

    const prepared = preparedHtml.value;

    if (!bodyRef.value || !prepared) {
      // DOMParser can be unavailable in non-browser environments, and refs can
      // be absent during mount/teardown; both cases use the safe source.
      await resetClamp();
      return;
    }

    const probe = prepareProbe();
    if (!probe) {
      await resetClamp();
      return;
    }

    const searchHint =
      probeStateWidth === null || Math.abs(probe.width - probeStateWidth) <= warmSearchWidthDelta
        ? probeState
        : null;
    // Search hints help nearby resizes but can cost more on large jumps. The
    // current probe state is still passed separately so patching remains correct
    // even when the search starts cold.
    const result = clampRich({
      ellipsis,
      from: probeState,
      hint: searchHint,
      lineLimit,
      maxHeight,
      prepared,
      probe,
    });
    probeState = result.state;
    probeStateWidth = probe.width;

    if (!result.state) {
      // A zero-width probe should not replace visible content with a guessed rich
      // fragment.
      await resetClamp();
      return;
    }

    patchVisible(prepared, result.state);
    await applyStatus(result.state.kind === "clamped", result.fallback);
  },
});

const slotProps = computed<RichLineClampSlotProps>(() => ({
  expand,
  collapse,
  toggle,
  clamped: isClamped.value,
  expanded: expanded.value,
}));
const rootStyle = computed<CSSProperties>(() => {
  const collapsedMaxHeight =
    !expanded.value && !isFallback.value ? cssLength(maxHeight) : undefined;

  return {
    maxHeight: collapsedMaxHeight,
    overflow: collapsedMaxHeight ? "hidden" : undefined,
  };
});

function createProbe(): ProbeElements {
  const content = document.createElement("span");
  const body = document.createElement("span");

  return {
    body,
    content,
  };
}

function resetStates(): void {
  visibleState = null;
  probeState = null;
  probeStateWidth = null;
}

function patchVisible(prepared: PreparedRich, state: RichState): void {
  const bodyElement = bodyRef.value;
  if (!bodyElement) {
    // If Vue has not mounted the target body, discard states rather than
    // applying future patches against an unknown DOM state.
    resetStates();
    return;
  }

  visibleState = patchRich(prepared, bodyElement, visibleState, state, ellipsis);
}

async function applyStatus(nextClamped: boolean, nextFallback: boolean): Promise<void> {
  const changed = isClamped.value !== nextClamped || isFallback.value !== nextFallback;

  isClamped.value = nextClamped;
  isFallback.value = nextFallback;

  if (changed) {
    // The measured rich DOM is already final; this tick exposes clamped state
    // changes after Vue commits the visible patch.
    await nextTick();
  }
}

async function resetClamp(): Promise<void> {
  const prepared = preparedHtml.value;

  if (prepared) {
    // Reset through the structural patcher so existing visible descendants are
    // restored consistently with normal clamp commits.
    patchVisible(prepared, { kind: "full" });
  } else {
    resetStates();
  }

  await applyStatus(false, false);
}

function prepareProbe(): {
  body: HTMLElement;
  content: HTMLElement;
  root: HTMLElement;
  width: number;
} | null {
  const rootElement = rootRef.value;
  const probeRoot = probeRef.value;
  if (!rootElement || !probeRoot) {
    return null;
  }

  const elements = (probeElements ??= createProbe());
  const normalizedMaxHeight = cssLength(maxHeight);
  const width = rootElement.getBoundingClientRect().width;

  probeRoot.style.width = `${width}px`;
  probeRoot.style.maxHeight = normalizedMaxHeight === undefined ? "" : String(normalizedMaxHeight);
  probeRoot.style.overflow = normalizedMaxHeight === undefined ? "visible" : "hidden";

  elements.content.replaceChildren();

  const beforeElement = beforeRef.value;
  if (beforeElement) {
    // Slot content affects fit but should not be mutated by rich candidate
    // patches, so the probe receives cloned slot boxes.
    elements.content.appendChild(beforeElement.cloneNode(true));
  }

  elements.content.appendChild(elements.body);

  const afterElement = afterRef.value;
  if (afterElement) {
    elements.content.appendChild(afterElement.cloneNode(true));
  }

  probeRoot.replaceChildren(elements.content);

  return {
    body: elements.body,
    content: elements.content,
    root: probeRoot,
    width,
  };
}

function setAffixElement(target: typeof beforeRef, element: Element | null): void {
  const nextElement = element instanceof HTMLElement ? element : null;
  if (target.value === nextElement) {
    return;
  }

  target.value = nextElement;
  // The hidden probe clones affix wrappers, so wait until Vue has committed the
  // latest slot DOM before triggering another measurement pass.
  void nextTick(requestRecompute);
}

function setBeforeElement(element: Element | null): void {
  setAffixElement(beforeRef, element);
}

function setAfterElement(element: Element | null): void {
  setAffixElement(afterRef, element);
}

watch(
  [() => html, () => maxLines, () => maxHeight, () => ellipsis, () => boundary],
  () => {
    // HTML and clamp semantics change the structural state space, so both
    // visible and probe patch cursors must restart.
    resetStates();
    isFallback.value = false;
    requestRecompute();
  },
  { flush: "post" },
);

defineExpose({
  expand,
  collapse,
  toggle,
  get clamped() {
    return isClamped.value;
  },
  get expanded() {
    return expanded.value;
  },
} satisfies RichLineClampExposed);
</script>

<template>
  <component :is="rootTag" v-bind="$attrs" data-part="root" ref="rootRef" :style="rootStyle">
    <span data-part="content" ref="contentRef">
      <MultilineAffixSlot
        part="before"
        :render="slots.before"
        :setRef="setBeforeElement"
        :slotProps="slotProps"
        :slotStyle="multilineSlotStyle"
      />

      <span data-part="body" ref="bodyRef" v-html="html" />

      <MultilineAffixSlot
        part="after"
        :render="slots.after"
        :setRef="setAfterElement"
        :slotProps="slotProps"
        :slotStyle="multilineSlotStyle"
      />
    </span>

    <span aria-hidden="true" ref="probe" :style="richProbeStyle" />
  </component>
</template>
