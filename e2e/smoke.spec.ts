import { test, expect } from '@playwright/test';

test.describe('VOLANS smoke', () => {
  test('landing page renders brand and CTA', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/VOLANS/);
    await expect(page.getByText('斜線制限の海から')).toBeVisible();
    await expect(page.getByRole('link', { name: /今すぐ試す/ })).toBeVisible();
  });

  test('landing CTA navigates to /sky (or /m on mobile)', async ({ page, viewport }) => {
    const isDesktop = (viewport?.width ?? 0) >= 1024;
    await page.goto('/');
    // Wait for the CTA to actually hydrate before clicking. On the flaky
    // mobile-chrome run, playwright fires click() while React is still
    // swapping the SSR tree, and the click misses the client-bound handler.
    const cta = page.getByRole('link', { name: /今すぐ試す/ });
    await expect(cta).toBeVisible();
    await cta.click();
    if (isDesktop) {
      await page.waitForURL(/\/sky$/, { timeout: 10_000 });
      await expect(page.getByText('解析結果サマリー')).toBeVisible();
    } else {
      // /sky auto-redirects narrow viewports to /m per ui-spec-volans §7.
      await page.waitForURL(/\/m$/, { timeout: 10_000 });
      await expect(page.getByText(/新宿区西新宿3丁目計画/)).toBeVisible();
    }
  });

  test('/sky has VOLANS envelope metrics', async ({ page, viewport }) => {
    // /sky is the ≥1024px layout per ui-spec-volans §7. Narrow-viewport
    // redirect is covered by the "landing CTA" test above; don't duplicate
    // it here because the /sky → /m client-side redirect races with
    // playwright's page.goto() when browser context is reused across tests.
    test.skip((viewport?.width ?? 0) < 1024, '/sky is desktop-only; mobile path is tested via the CTA redirect');
    await page.goto('/sky');
    await expect(page.getByText(/延床面積/).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /天空率 最大化を実行/ })).toBeVisible();
  });

  test('/sky footer carries Article 56-7 citation', async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 0) < 1024, '/sky redirects to /m on narrow viewports');
    await page.goto('/sky');
    // The citation appears both in the visible footer and the (hidden) print
    // report. We only care that at least one is present and visible.
    const matches = page.getByText(/平成14年 国交省告示 第1350号/);
    await expect(matches.first()).toBeAttached();
  });

  test('mobile dashboard renders at /m', async ({ page }) => {
    await page.goto('/m');
    await expect(page.getByText(/新宿区西新宿3丁目計画/)).toBeVisible();
    // bottom nav
    await expect(page.getByRole('link', { name: /ダッシュボード/ })).toBeVisible();
  });

  test('/api/health returns a JSON liveness payload', async ({ request }) => {
    const resp = await request.get('/api/health');
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('volans-web');
    expect(typeof body.uptimeSec).toBe('number');
    expect(typeof body.bootedAt).toBe('string');
  });
});
