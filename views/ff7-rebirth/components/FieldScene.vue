<script setup lang="ts">
/**
 * Out of battle: the region map fills the panel, with where the player is on one line above it and
 * the party on one line below.
 *
 * The party line is the glance: each member's HP and MP as two short bars, and the gil. A tap opens
 * it into the full rows, figures and maxima included, and a second tap folds it back. Opening it is
 * the one thing on this panel that answers a touch; it never takes focus from the game.
 */
import { ref } from 'vue';
import Bar from './Bar.vue';
import RegionMap from './RegionMap.vue';
import { formatNumber, gil, hpBand, party, paused, playTime } from '../domain/game';
import { place } from '../domain/location';

const HP_COLOR = { ok: 'var(--hp)', low: 'var(--hp-low)', danger: 'var(--hp-danger)', unknown: 'var(--hp)' };

const open = ref(false);
</script>

<template>
  <section class="field">
    <RegionMap class="map" />

    <header class="top">
      <div class="where">
        <span v-if="place?.region" class="caption region">{{ place.region }}</span>
        <span class="area">{{ place?.area ?? place?.sub ?? 'Esplorazione' }}</span>
        <span v-if="place?.area && place?.sub" class="sub">{{ place.sub }}</span>
      </div>
      <div class="end">
        <span v-if="paused" class="paused caption">Pausa</span>
        <span v-if="playTime" class="figures time">{{ playTime }}</span>
      </div>
    </header>

    <footer class="bottom" :class="{ open }" @click="open = !open">
      <ol v-if="!open" class="strip">
        <li v-for="member in party" :key="member.slot">
          <span class="name">{{ member.name }}</span>
          <div class="bars">
            <Bar :value="member.hpRatio" :color="HP_COLOR[hpBand(member.hpRatio)]" />
            <Bar :value="member.mpRatio" color="var(--mp)" />
          </div>
        </li>
        <li class="gil">
          <span class="figures">{{ formatNumber(gil) }}</span>
          <span class="caption">Guil</span>
        </li>
      </ol>

      <ol v-else class="rows">
        <li v-for="member in party" :key="member.slot">
          <div class="who">
            <span class="name">{{ member.name }}</span>
            <span v-if="member.level !== null" class="level figures">Lv {{ member.level }}</span>
          </div>
          <div class="stat">
            <div class="reading">
              <span class="caption">PV</span>
              <span class="figures big">
                {{ formatNumber(member.hp) }}<span class="max"> / {{ formatNumber(member.hpMax) }}</span>
              </span>
            </div>
            <Bar :value="member.hpRatio" :color="HP_COLOR[hpBand(member.hpRatio)]" />
          </div>
          <div class="stat">
            <div class="reading">
              <span class="caption">PM</span>
              <span class="figures big">
                {{ formatNumber(member.mp) }}<span class="max"> / {{ formatNumber(member.mpMax) }}</span>
              </span>
            </div>
            <Bar :value="member.mpRatio" color="var(--mp)" />
          </div>
        </li>
        <li class="total">
          <span class="figures gil-big">{{ formatNumber(gil) }}</span>
          <span class="caption">Guil</span>
        </li>
      </ol>
    </footer>
  </section>
</template>

<style scoped>
.field {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.map {
  position: absolute;
  inset: 0;
}

/* Both lines sit on the map, each on a fade into the ground so the text stays legible over any
   terrain without boxing the map in. */
.top,
.bottom {
  position: relative;
  padding: 1.1rem 1.6rem;
}

.top {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  background: linear-gradient(to bottom, rgba(6, 10, 18, 0.92) 0%, rgba(6, 10, 18, 0.7) 60%, transparent);
  padding-bottom: 2.2rem;
}

.where {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.region {
  color: var(--atb-full);
}

.area {
  font-size: 1.9rem;
  font-weight: 500;
  line-height: 1.1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sub {
  font-size: 1.25rem;
  color: var(--ink-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.end {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.time {
  font-size: 1.5rem;
  color: var(--ink-2);
}

.paused {
  padding: 0.15rem 0.5rem;
  border: 1px solid var(--edge-lit);
  color: var(--ink-2);
}

.bottom {
  background: linear-gradient(to top, rgba(6, 10, 18, 0.94) 0%, rgba(6, 10, 18, 0.75) 65%, transparent);
  padding-top: 2.2rem;
}

.bottom.open {
  background: rgba(6, 10, 18, 0.9);
  border-top: 1px solid var(--rule);
  padding-top: 1.1rem;
}

ol {
  list-style: none;
  margin: 0;
  padding: 0;
}

.strip {
  display: flex;
  align-items: center;
  gap: 1.4rem;
}

.strip li {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.strip .name {
  font-size: 1.15rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bars {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.strip .gil {
  flex: 0 0 auto;
  align-items: flex-end;
}

.strip .gil .figures {
  font-size: 1.35rem;
}

.rows li {
  display: grid;
  grid-template-columns: 10rem minmax(0, 1fr) minmax(0, 0.72fr);
  column-gap: 1.6rem;
  align-items: center;
  padding: 0.6rem 0;
  border-bottom: 1px solid var(--rule);
}

.rows .total {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
  border-bottom: 0;
  padding-bottom: 0;
}

.who {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  min-width: 0;
}

.rows .name {
  font-size: 1.55rem;
  font-weight: 500;
  white-space: nowrap;
}

.level {
  font-size: 1.05rem;
  color: var(--ink-3);
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
}

.reading {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.big {
  font-size: 1.8rem;
  font-weight: 500;
}

.max {
  font-size: 1.05rem;
  color: var(--ink-3);
}

.gil-big {
  font-size: 1.6rem;
}
</style>
