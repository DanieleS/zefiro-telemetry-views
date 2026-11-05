/**
 * One Playwright project per view and contract version its range covers.
 *
 * The matrix is the point: a view declaring `^2.0` is loaded and fed pictures announced as every
 * vendored 2.x, not only the one it was written against. Projects are named `<view>@<version>`, so
 * `npx playwright test --project sea-of-stars@2.0` runs one cell.
 */
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';
import { loadViews, outputName, versionsFor } from './scripts/views.mjs';

export interface Cell {
  view: string;
  file: string;
  contract: string;
  version: string;
  schemaFile: string;
}

const root = fileURLToPath(new URL('.', import.meta.url));
const projects = loadViews(root).flatMap((view) =>
  versionsFor(root, view).map((version) => ({
    name: `${view.name}@${version.text}`,
    metadata: {
      view: view.name,
      file: outputName(view),
      contract: view.contract.id,
      version: version.text,
      schemaFile: version.schemaFile,
    } satisfies Cell,
  })),
);

/**
 * The browser to drive. Playwright's own Chromium by default; `PW_CHANNEL=msedge` (or `chrome`)
 * drives an installed one instead, which is what works on a Windows machine with no Playwright
 * browsers downloaded, and on Windows that is the default.
 */
export const channel = process.env.PW_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined);

export default defineConfig({
  testDir: 'tests',
  // Photographs, not checks: run by playwright.shots.config.ts (`npm run shots`).
  testIgnore: 'shots.spec.ts',
  // A hang is one of the failures being tested for; this is the backstop behind the spec's own,
  // shorter, per-step deadline.
  timeout: 120_000,
  fullyParallel: true,
  reporter: process.env.CI ? 'list' : 'line',
  use: { browserName: 'chromium', channel, headless: true },
  projects,
});
