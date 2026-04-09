import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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

  it('should render basic shell structure', () => {
    const { container } = render(<App />);
    const shell = container.querySelector('.shell');
    expect(shell).toBeInTheDocument();
  });

  it('should display platform host ready message', () => {
    render(<App />);
    expect(screen.getByText('Platform Host Ready')).toBeInTheDocument();
  });
});
