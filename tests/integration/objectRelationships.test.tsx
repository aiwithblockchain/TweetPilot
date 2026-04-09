import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../src/App';

describe('App Integration - Object Relationships', () => {
  it('should display workspace data when navigating to workspace view', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);

    const nav = container.querySelector('.nav') as HTMLElement;
    const workspaceButton = within(nav).getByText('Customer Workspace');
    await user.click(workspaceButton);

    // Verify workspace data from seed is displayed
    expect(screen.getByText('Default Workspace')).toBeInTheDocument();
    expect(screen.getByText('Primary customer workspace')).toBeInTheDocument();
  });

  it('should display account data when navigating to accounts view', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);

    const nav = container.querySelector('.nav') as HTMLElement;
    const accountsButton = within(nav).getByText('Accounts');
    await user.click(accountsButton);

    // Verify account data from seed is displayed
    expect(screen.getByText('TweetPilot Demo')).toBeInTheDocument();
    expect(screen.getByText(/\@tweetpilot_demo/)).toBeInTheDocument();
    expect(screen.getByText(/Status: active/)).toBeInTheDocument();
  });

  it('should display instance data when navigating to instances view', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);

    const nav = container.querySelector('.nav') as HTMLElement;
    const instancesButton = within(nav).getByText('Instances');
    await user.click(instancesButton);

    // Verify instance data from seed is displayed
    expect(screen.getByText('Local Instance 1')).toBeInTheDocument();
    expect(screen.getByText(/Status: online/)).toBeInTheDocument();
    expect(screen.getByText(/Capabilities: read, write, monitor/)).toBeInTheDocument();
  });

  it('should display channel data when navigating to channels view', async () => {
    const user = userEvent.setup();
    render(<App />);

    const channelsButton = screen.getByRole('button', { name: 'Execution Channels' });
    await user.click(channelsButton);

    // Verify channel data from seed is displayed
    expect(screen.getByText('Local Bridge')).toBeInTheDocument();
    expect(screen.getByText(/local-bridge/)).toBeInTheDocument();
    expect(screen.getByText('X Official API')).toBeInTheDocument();
    expect(screen.getByText(/x-api/)).toBeInTheDocument();
  });
});
