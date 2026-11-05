<script setup lang="ts">
/**
 * The region map, filling its box, north up, with the player kept in the middle.
 *
 * The image is moved and scaled rather than redrawn, so following the player is a transform per
 * frame. The zoom shows about SPAN_M metres across the short side, or the whole map when the region
 * is smaller than that (a town, a cave).
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { marker, regionMap } from '../domain/location';

/** How many metres the short side of the box covers in the open world. */
const SPAN_M = 1100;

const box = ref<HTMLElement | null>(null);
const size = ref({ w: 0, h: 0 });
let observer: ResizeObserver | null = null;

onMounted(() => {
  observer = new ResizeObserver(([entry]) => {
    if (entry) size.value = { w: entry.contentRect.width, h: entry.contentRect.height };
  });
  if (box.value) observer.observe(box.value);
});
onBeforeUnmount(() => observer?.disconnect());

/** CSS pixels per image pixel. */
const scale = computed(() => {
  const map = regionMap.value;
  const short = Math.min(size.value.w, size.value.h);
  if (!map || !short) return 1;
  const mapMetres = (Math.min(map.meta.w, map.meta.h) * map.meta.cmPerPx) / 100;
  const span = Math.min(SPAN_M, mapMetres);
  return short / ((span * 100) / map.meta.cmPerPx);
});

/** The image's transform: the player's pixel lands on the box's centre. */
const transform = computed(() => {
  const at = marker.value;
  const map = regionMap.value;
  if (!map) return 'none';
  const cx = at?.x ?? map.meta.w / 2;
  const cy = at?.y ?? map.meta.h / 2;
  const s = scale.value;
  return `translate(${size.value.w / 2 - cx * s}px, ${size.value.h / 2 - cy * s}px) scale(${s})`;
});
</script>

<template>
  <div ref="box" class="region-map">
    <img
      v-if="regionMap"
      :key="regionMap.id"
      class="image"
      :src="regionMap.url"
      :width="regionMap.meta.w"
      :height="regionMap.meta.h"
      :style="{ transform }"
      alt=""
    />
    <svg v-if="regionMap && marker" class="you" viewBox="-12 -12 24 24" aria-hidden="true">
      <circle class="halo" r="10" />
      <circle class="dot" r="4.5" />
    </svg>
    <span v-if="!regionMap" class="caption none">Mappa non disponibile</span>
  </div>
</template>

<style scoped>
.region-map {
  position: relative;
  overflow: hidden;
  background: radial-gradient(ellipse at center, #0d1a2b 0%, var(--ground) 75%);
}

.image {
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: 0 0;
  max-width: none;
  /* A slow glide between the profile's 4 Hz position samples, so the map does not step. */
  transition: transform 260ms linear;
  will-change: transform;
}

.you {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 2.4rem;
  height: 2.4rem;
  transform: translate(-50%, -50%);
  overflow: visible;
}

.dot {
  fill: var(--atb-full);
  stroke: var(--ground);
  stroke-width: 1.5;
}

.halo {
  fill: none;
  stroke: var(--atb-full);
  stroke-width: 1.2;
  opacity: 0.6;
  transform-origin: center;
  animation: halo 2.2s ease-out infinite;
}

@keyframes halo {
  from {
    transform: scale(0.45);
    opacity: 0.8;
  }
  to {
    transform: scale(1.2);
    opacity: 0;
  }
}

.none {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
}
</style>
