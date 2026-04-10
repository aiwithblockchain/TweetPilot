import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import StatusOverview from '../../src/features/shell/StatusOverview';

describe('StatusOverview Component', () => {
  it('should render platform status overview', () => {
    render(<StatusOverview />);

    expect(screen.getByText('Platform Status Overview')).toBeInTheDocument();
  });

  it('should display workspace status', () => {
    const { container } = render(<StatusOverview />);
    const statusGrid = container.querySelector('.status-grid') as HTMLElement;

    expect(within(statusGrid).getByText('Workspaces')).toBeInTheDocument();
  });

  it('should display account status', () => {
    const { container } = render(<StatusOverview />);
    const statusGrid = container.querySelector('.status-grid') as HTMLElement;

    expect(within(statusGrid).getByText('Accounts')).toBeInTheDocument();
  });

  it('should display instance status with online count', () => {
    const { container } = render(<StatusOverview />);
    const statusGrid = container.querySelector('.status-grid') as HTMLElement;

    expect(within(statusGrid).getByText('Instances')).toBeInTheDocument();
    expect(within(statusGrid).getByText('1/2')).toBeInTheDocument();
  });

  it('should display channel status with availability', () => {
    const { container } = render(<StatusOverview />);
    const statusGrid = container.querySelector('.status-grid') as HTMLElement;

    expect(within(statusGrid).getByText('Channels')).toBeInTheDocument();
    expect(within(statusGrid).getByText('2/3')).toBeInTheDocument();
  });
});
