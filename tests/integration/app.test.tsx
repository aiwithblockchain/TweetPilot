import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import App from '../../src/App';

describe('App Integration', () => {
  it('should render the main application shell', () => {
    render(<App />);
    const appElements = screen.getAllByText('TweetPilot');
    expect(appElements.length).toBeGreaterThan(0);
  });

  it('should display platform information from tweetOps API', () => {
    render(<App />);
    const platformElement = screen.getByText(window.tweetOps.runtime.platform);
    expect(platformElement).toBeInTheDocument();
  });

  it('should display app name from tweetOps API', () => {
    render(<App />);
    const appNameElements = screen.getAllByText(window.tweetOps.appName);
    expect(appNameElements.length).toBeGreaterThan(0);
  });

  it('should render main navigation with all key entries', () => {
    const { container } = render(<App />);
    const nav = container.querySelector('.nav') as HTMLElement;
    expect(nav).toBeInTheDocument();

    // Core platform entries
    expect(within(nav).getByText('Dashboard')).toBeInTheDocument();
    expect(within(nav).getByText('Customer Workspace')).toBeInTheDocument();
    expect(within(nav).getByText('Accounts')).toBeInTheDocument();
    expect(within(nav).getByText('Instances')).toBeInTheDocument();
    expect(within(nav).getByText('Execution Channels')).toBeInTheDocument();

    // Mount points for future features
    expect(within(nav).getByText('Tasks')).toBeInTheDocument();
    expect(within(nav).getByText('Reports')).toBeInTheDocument();
    expect(within(nav).getByText('Extensions')).toBeInTheDocument();
  });

  it('should render dashboard view by default', () => {
    const { container } = render(<App />);
    const nav = container.querySelector('.nav') as HTMLElement;
    const dashboardButton = within(nav).getByText('Dashboard');
    expect(dashboardButton).toHaveClass('is-active');
  });
});
