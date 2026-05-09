<script setup lang="ts">
import { InlineClamp } from "vue-clamp";

const file = "summer-campaign-panorama-final.jpeg";

const imageExtensions = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif"];

const splitImageFile = (text: string) => {
  const extension = imageExtensions.find((candidate) => text.toLowerCase().endsWith(candidate));

  return extension
    ? {
        body: text.slice(0, -extension.length),
        end: text.slice(-extension.length),
      }
    : { body: text };
};
</script>

<template>
  <InlineClamp :text="file" :split="splitImageFile" location="middle" />
</template>
