import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test.describe('VOLANS mobile', () => {
  test('dashboard summary card has engine values', async ({ page }) => {
    await page.goto('/m');
    await expect(page.getByText(/延床面積 \(最大\)/).first()).toBeVisible();
    // tabs
    await expect(page.getByRole('button', { name: 'サマリー' })).toBeVisible();
    await expect(page.getByRole('button', { name: '斜線案' })).toBeVisible();
    await expect(page.getByRole('button', { name: '天空率案' })).toBeVisible();
  });

  test('input page shows site editor + DXF + OCR pickers', async ({ page }) => {
    await page.goto('/m/input');
    await expect(page.getByText('敷地形状を編集')).toBeVisible();
    await expect(page.getByText('CAD（DXF）取込')).toBeVisible();
    await expect(page.getByText('画像 / PDF 取込（測量図・概要書）')).toBeVisible();
  });

  test('compare page renders three patterns', async ({ page }) => {
    await page.goto('/m/compare');
    await expect(page.getByText('斜線案 (現行)')).toBeVisible();
    await expect(page.getByText('天空率案 (推奨)')).toBeVisible();
    await expect(page.getByText('パターン C (中間)')).toBeVisible();
  });

  test('ai page has assistant greeting and input', async ({ page }) => {
    await page.goto('/m/ai');
    await expect(page.getByText(/どのような計画を検討中でしょうか/)).toBeVisible();
    await expect(page.getByPlaceholder('メッセージを入力…')).toBeVisible();
  });

  test('report page has PDF download button', async ({ page }) => {
    await page.goto('/m/report');
    await expect(page.getByRole('button', { name: /PDFをダウンロード/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /共有する/ })).toBeVisible();
  });

  test('3d page viewer loads', async ({ page }) => {
    await page.goto('/m/3d');
    await expect(page.getByText('3Dビュア').first()).toBeVisible();
    await expect(page.getByText('天空率チェック (代表点)')).toBeVisible();
  });
});
