import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MountPoint from '../../src/components/MountPoint';

describe('MountPoint Component', () => {
  it('should render mount point with title and description', () => {
    render(
      <MountPoint
        title="Tasks"
        description="Task management functionality"
      />
    );

    expect(screen.getByText('Tasks')).toBeInTheDocument();
    expect(screen.getByText('Task management functionality')).toBeInTheDocument();
  });

  it('should show pending status by default', () => {
    render(
      <MountPoint
        title="Reports"
        description="Reporting functionality"
      />
    );

    expect(screen.getByText('Pending Implementation')).toBeInTheDocument();
  });

  it('should show available status when specified', () => {
    render(
      <MountPoint
        title="Extensions"
        description="Extension functionality"
        status="available"
      />
    );

    expect(screen.getByText('Available')).toBeInTheDocument();
  });
});
