import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../src/App';

describe('App Integration - Status Overview and Mount Points', () => {
  it('should display status overview on dashboard', () => {
    const { container } = render(<App />);
    const mainContent = container.querySelector('.main') as HTMLElement;

    // Verify status overview is visible in main content area
    expect(within(mainContent).getByText('Platform Status Overview')).toBeInTheDocument();

    const statusGrid = container.querySelector('.status-grid') as HTMLElement;
    expect(within(statusGrid).getByText('Workspaces')).toBeInTheDocument();
    expect(within(statusGrid).getByText('Accounts')).toBeInTheDocument();
    expect(within(statusGrid).getByText('Instances')).toBeInTheDocument();
    expect(within(statusGrid).getByText('Channels')).toBeInTheDocument();
  });

  it('should display mount points on dashboard', () => {
    const { container } = render(<App />);
    const mountPointsGrid = container.querySelector('.mount-points-grid') as HTMLElement;

    // Verify all three mount points are visible in the mount points grid
    expect(within(mountPointsGrid).getByText('Tasks')).toBeInTheDocument();
    expect(within(mountPointsGrid).getByText('Reports')).toBeInTheDocument();
    expect(within(mountPointsGrid).getByText('Extensions')).toBeInTheDocument();
  });

  it('should show mount point placeholders when navigating to pending features', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);

    // Navigate to Tasks
    const nav = container.querySelector('.nav') as HTMLElement;
    const tasksButton = within(nav).getByText('Tasks');
    await user.click(tasksButton);

    // Verify mount point placeholder is shown
    expect(screen.getByText(/will be implemented in subsequent task cards/i)).toBeInTheDocument();
  });
});
