<script setup lang="ts">
import { WrapClamp } from "../src/index.ts";

type Invitee = {
  id: string;
  label: string;
  priority: number;
};

const invitees: readonly Invitee[] = [
  { id: "design", label: "Design", priority: 2 },
  { id: "docs", label: "Docs", priority: 1 },
];

function inviteeKey(item: Invitee, index: number): string {
  return `${item.id}-${index}`;
}

function inviteeLabel(item: Invitee): string {
  return `${item.label} ${item.priority.toFixed(0)}`;
}

function hiddenInviteeCount(items: readonly Invitee[]): number {
  return items.length;
}
</script>

<template>
  <WrapClamp :items="invitees" :item-key="inviteeKey" :max-lines="1">
    <template #item="{ item, index }">
      <span>{{ inviteeLabel(item) }} {{ index.toFixed(0) }}</span>
    </template>

    <template #after="{ hiddenItems, clamped, expanded, toggle }">
      <button v-if="clamped || expanded" type="button" @click="toggle">
        {{ hiddenInviteeCount(hiddenItems) }}
      </button>
    </template>
  </WrapClamp>
</template>
