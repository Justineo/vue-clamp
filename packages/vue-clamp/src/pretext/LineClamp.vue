<script setup lang="ts">
import { h, mergeProps, shallowRef, useAttrs } from "vue";
import StandardLineClamp from "../line/LineClamp.vue";
import { provideLineClampPredictor } from "../line/predictor.ts";
import { createPretextLineClampPredictor } from "./predictor.ts";

import type { VNodeChild } from "vue";
import type { ClampEmits } from "../types.ts";
import type { LineClampExposed, LineClampProps, LineClampSlots } from "../line/types.ts";

defineOptions({
  name: "LineClamp",
  inheritAttrs: false,
});

const props = defineProps<Omit<LineClampProps, "expanded">>();
const expanded = defineModel<NonNullable<LineClampProps["expanded"]>>("expanded", {
  default: false,
});
const emit = defineEmits<Omit<ClampEmits, "update:expanded">>();
const slots = defineSlots<LineClampSlots>();
const attrs = useAttrs();
const lineClamp = shallowRef<LineClampExposed | null>(null);

provideLineClampPredictor(createPretextLineClampPredictor());

function render(): VNodeChild {
  return h(
    StandardLineClamp,
    mergeProps(attrs, props, {
      expanded: expanded.value,
      onClampchange: (value: boolean) => emit("clampchange", value),
      "onUpdate:expanded": (value: boolean) => {
        expanded.value = value;
      },
      ref: lineClamp,
    }),
    slots,
  );
}

defineRender(render);

defineExpose({
  expand() {
    lineClamp.value?.expand();
  },
  collapse() {
    lineClamp.value?.collapse();
  },
  toggle() {
    lineClamp.value?.toggle();
  },
  get clamped() {
    return lineClamp.value?.clamped ?? false;
  },
  get expanded() {
    return expanded.value;
  },
} satisfies LineClampExposed);
</script>
