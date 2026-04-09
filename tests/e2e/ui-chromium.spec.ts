import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:8765';

test.describe('TweetPilot UI E2E (Chromium)', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Electron preload API BEFORE navigation
    await page.addInitScript(() => {
      (window as any).tweetOps = {
        appName: 'TweetPilot',
        runtime: {
          platform: 'darwin',
        },
      };
    });

    // Navigate to the app
    await page.goto(BASE_URL);
  });

  test('should display status overview and mount points', async ({ page }) => {
    // Wait for React to render
    await page.waitForSelector('h2', { timeout: 10000 });

    // Verify Dashboard title
    await expect(page.locator('h2:has-text("Dashboard")')).toBeVisible();

    // Verify Platform Status Overview
    await expect(page.locator('text=Platform Status Overview')).toBeVisible();

    // Verify status cards (use more specific selectors)
    const statusGrid = page.locator('.status-grid');
    await expect(statusGrid.locator('text=Workspaces')).toBeVisible();
    await expect(statusGrid.locator('text=Accounts')).toBeVisible();
    await expect(statusGrid.locator('text=Instances')).toBeVisible();
    await expect(statusGrid.locator('text=Channels')).toBeVisible();

    // Verify mount points
    const tasksText = page.locator('text=Tasks');
    await expect(tasksText.first()).toBeVisible();

    const reportsText = page.locator('text=Reports');
    await expect(reportsText.first()).toBeVisible();

    const extensionsText = page.locator('text=Extensions');
    await expect(extensionsText.first()).toBeVisible();
  });

  test('should navigate between views', async ({ page }) => {
    // Wait for initial render
    await page.waitForSelector('h2');

    // Click on Accounts navigation
    await page.click('nav >> text=Accounts');
    await expect(page.locator('h2:has-text("Accounts")')).toBeVisible();

    // Click on Instances navigation
    await page.click('nav >> text=Instances');
    await expect(page.locator('h2:has-text("Instances")')).toBeVisible();

    // Click on Channels navigation
    await page.click('nav >> text=Execution Channels');
    await expect(page.locator('h2:has-text("Execution Channels")')).toBeVisible();

    // Go back to Dashboard
    await page.click('nav >> text=Dashboard');
    await expect(page.locator('h2:has-text("Dashboard")')).toBeVisible();
    await expect(page.locator('text=Platform Status Overview')).toBeVisible();
  });

  test('should display runtime information', async ({ page }) => {
    // Wait for render
    await page.waitForSelector('text=Runtime');

    // Verify runtime panel (use more specific selectors)
    const runtimePanel = page.locator('.panel.compact');
    await expect(runtimePanel.locator('text=Runtime')).toBeVisible();
    await expect(runtimePanel.locator('text=Platform')).toBeVisible();
    await expect(runtimePanel.locator('text=darwin')).toBeVisible();
    await expect(runtimePanel.locator('text=App')).toBeVisible();
    await expect(runtimePanel.locator('text=TweetPilot')).toBeVisible();
  });
});
