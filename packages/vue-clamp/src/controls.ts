import type { Ref } from "vue";
import type { ClampControls } from "./types.ts";

export function useClampControls(expanded: Ref<boolean>): ClampControls {
  function expand(): void {
    expanded.value = true;
  }

  function collapse(): void {
    expanded.value = false;
  }

  function toggle(): void {
    expanded.value = !expanded.value;
  }

  return {
    expand,
    collapse,
    toggle,
  };
}
