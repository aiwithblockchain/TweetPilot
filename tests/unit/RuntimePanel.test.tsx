import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import RuntimePanel from '../../src/components/RuntimePanel';

describe('RuntimePanel Component', () => {
  it('should display platform information', () => {
    render(<RuntimePanel platform="darwin" appName="TweetPilot" />);

    expect(screen.getByText('darwin')).toBeInTheDocument();
    expect(screen.getByText('TweetPilot')).toBeInTheDocument();
  });

  it('should render runtime title', () => {
    render(<RuntimePanel platform="darwin" appName="TweetPilot" />);

    expect(screen.getByText('Runtime')).toBeInTheDocument();
  });
});
