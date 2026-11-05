/**
 * `npm run shots`: the same projects as the main suite (one per view and contract version), running
 * only tests/shots.spec.ts, at the size of the panel the views are drawn for — the Thor's second
 * screen, about 538x444 CSS px — and at twice its pixel density, so the PNGs stay sharp.
 */
import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  testIgnore: undefined,
  testMatch: 'shots.spec.ts',
  reporter: 'line',
  use: { ...base.use, viewport: { width: 538, height: 444 }, deviceScaleFactor: 2 },
});
