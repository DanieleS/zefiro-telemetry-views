<script setup lang="ts">
/**
 * Which scene the panel shows. It follows the game's own state, never the viewer: the panel takes
 * touches but never focus, and this view has nothing to tap.
 *
 * Above that sits the contract check: a stream this view was not written for gets a refusal and
 * nothing else, not a best effort over values of a shape it does not know.
 */
import TitleScene from './components/TitleScene.vue';
import FieldScene from './components/FieldScene.vue';
import BattleScene from './components/BattleScene.vue';
import Unsupported from './components/Unsupported.vue';
import { scene } from './domain/game';
import { meta } from './stream';
</script>

<template>
  <div class="view" :data-state="meta.unsupported ? 'unsupported' : scene">
    <Unsupported v-if="meta.unsupported" :reason="meta.unsupported" />
    <Transition v-else name="scene" mode="out-in">
      <TitleScene v-if="scene === 'title'" key="title" />
      <BattleScene v-else-if="scene === 'battle'" key="battle" />
      <FieldScene v-else key="field" />
    </Transition>
  </div>
</template>

<style scoped>
.view {
  height: 100%;
  box-sizing: border-box;
  padding: 1.5rem 1.8rem 1.4rem;
  display: flex;
  flex-direction: column;
}

/* The map runs to the panel's edges; the field scene pads its own lines. */
.view[data-state='field'] {
  padding: 0;
}
</style>
