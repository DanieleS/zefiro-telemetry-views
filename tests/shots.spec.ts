/**
 * Photograph each built view in its named screens (tests/shots.ts), for a person to look at.
 *
 *   npm run shots     # -> shots/<view>@<version>/<name>.png
 *
 * Run by playwright.shots.config.ts, never by the main suite: nothing here is asserted beyond the
 * screen being reached without an error. The page is the real build at the panel's size, fed through
 * `window.scry.onFrame` as the app feeds it, and every animation is stopped before the shot so two
 * runs of the same values give the same picture.
 */
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Cell } from '../playwright.config';
import { shots } from './shots';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

test('shots', async ({ page }, info) => {
  const cell = info.project.metadata as Cell;
  const list = shots[cell.view] ?? [];
  test.skip(list.length === 0, `no shots for ${cell.view}`);
  const out = join(root, 'shots', `${cell.view}@${cell.version}`);
  mkdirSync(out, { recursive: true });

  for (const shot of list) {
    const problems: string[] = [];
    page.removeAllListeners('pageerror');
    page.removeAllListeners('console');
    page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(`console.error: ${message.text()}`);
    });

    await page.goto(pathToFileURL(join(root, 'dist', cell.file)).href);
    // The bundle is a module: wait for it to install the bridge rather than racing it.
    await page.waitForFunction(() => Boolean(window.scry));
    const body = {
      attached: true,
      slug: 'Shot',
      process: 'Game.exe',
      profile: 'shot',
      contract: { id: cell.contract, version: cell.version },
      values: shot.values,
    };
    await page.evaluate((json) => window.scry!.onFrame('snapshot', JSON.parse(json)), JSON.stringify(body));
    for (const selector of shot.clicks ?? []) await page.locator(selector).first().click();
    if (shot.ready) await page.locator(shot.ready).first().waitFor({ state: 'visible' });
    // A scene change is a Vue <Transition>: wait until nothing is entering or leaving, or the shot
    // can catch an empty frame between the old scene and the new one.
    await page.waitForFunction(() => !document.querySelector('[class*="-enter-"], [class*="-leave-"]'));
    // Images decoded and a frame painted, so the shot is not of a half-loaded map.
    await page.evaluate(async () => {
      await Promise.all([...document.images].map((image) => image.decode().catch(() => undefined)));
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    });

    await page.screenshot({ path: join(out, `${shot.name}.png`), animations: 'disabled' });
    expect(problems, `${shot.name}: ${problems.join('\n')}`).toEqual([]);
  }
});
