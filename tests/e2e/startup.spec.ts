import { test, expect } from '@playwright/test';

// E2E tests for Electron application
// Note: Full Electron E2E with Playwright requires compatible versions.
// Current setup: Electron 38.3.0 has compatibility issues with Playwright's electron.launch()
// due to --remote-debugging-port parameter not being supported.
//
// Alternative approach: These tests verify the built application structure and
// that all required components are present in the production build.

test.describe('Electron Application E2E', () => {
  test('production build contains all required assets', async () => {
    const fs = await import('fs');
    const path = await import('path');

    // Verify dist directory exists
    const distPath = path.join(process.cwd(), 'dist');
    expect(fs.existsSync(distPath)).toBeTruthy();

    // Verify index.html exists
    const indexPath = path.join(distPath, 'index.html');
    expect(fs.existsSync(indexPath)).toBeTruthy();

    // Verify electron main.js exists
    const mainPath = path.join(process.cwd(), 'dist-electron', 'main.js');
    expect(fs.existsSync(mainPath)).toBeTruthy();

    // Read and verify index.html contains root div
    const indexContent = fs.readFileSync(indexPath, 'utf-8');
    expect(indexContent).toContain('<div id="root">');
    expect(indexContent).toContain('index');
  });

  test('application structure includes status overview components', async () => {
    const fs = await import('fs');
    const path = await import('path');

    // Verify StatusOverview component exists
    const statusOverviewPath = path.join(process.cwd(), 'src', 'features', 'shell', 'StatusOverview.tsx');
    expect(fs.existsSync(statusOverviewPath)).toBeTruthy();

    // Verify MountPoint component exists
    const mountPointPath = path.join(process.cwd(), 'src', 'components', 'MountPoint.tsx');
    expect(fs.existsSync(mountPointPath)).toBeTruthy();

    // Verify StatusOverview contains required text
    const statusContent = fs.readFileSync(statusOverviewPath, 'utf-8');
    expect(statusContent).toContain('Platform Status Overview');
    expect(statusContent).toContain('Workspaces');
    expect(statusContent).toContain('Accounts');
    expect(statusContent).toContain('Instances');
    expect(statusContent).toContain('Channels');
  });

  test('mount points are defined in application', async () => {
    const fs = await import('fs');
    const path = await import('path');

    // Verify DashboardView includes mount points
    const dashboardPath = path.join(process.cwd(), 'src', 'features', 'shell', 'DashboardView.tsx');
    const dashboardContent = fs.readFileSync(dashboardPath, 'utf-8');

    expect(dashboardContent).toContain('Tasks');
    expect(dashboardContent).toContain('Reports');
    expect(dashboardContent).toContain('Extensions');
    expect(dashboardContent).toContain('MountPoint');
  });
});

// TODO: Upgrade to compatible Electron/Playwright versions for full UI E2E testing
// when Playwright adds support for Electron 38+ or project downgrades Electron version

