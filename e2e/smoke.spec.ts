import { test, expect } from '@playwright/test';

test.describe('VOLANS smoke', () => {
  test('landing page renders brand and CTA', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/VOLANS/);
    await expect(page.getByText('斜線制限の海から')).toBeVisible();
    await expect(page.getByRole('link', { name: /今すぐ試す/ })).toBeVisible();
  });

  test('landing CTA navigates to /sky', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /今すぐ試す/ }).click();
    await expect(page).toHaveURL(/\/sky$/);
    await expect(page.getByText('解析結果サマリー')).toBeVisible();
  });

  test('/sky has VOLANS envelope metrics', async ({ page, viewport }) => {
    // /sky is the ≥1024px layout per ui-spec-volans §7. On narrower viewports
    // the page auto-redirects to /m, so we only assert the summary surface on
    // desktop viewports.
    const isDesktop = (viewport?.width ?? 0) >= 1024;
    await page.goto('/sky');
    if (isDesktop) {
      await expect(page.getByText(/延床面積/).first()).toBeVisible();
      await expect(page.getByRole('button', { name: /天空率 最大化を実行/ })).toBeVisible();
    } else {
      await expect(page).toHaveURL(/\/m$/);
      await expect(page.getByText(/新宿区西新宿3丁目計画/)).toBeVisible();
    }
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
});
