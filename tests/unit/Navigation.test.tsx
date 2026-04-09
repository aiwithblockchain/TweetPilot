import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Navigation from '../../src/components/Navigation';

describe('Navigation Component', () => {
  const mockItems = [
    { id: 'dashboard', label: 'Dashboard', active: true },
    { id: 'accounts', label: 'Accounts', active: false },
    { id: 'tasks', label: 'Tasks', active: false },
  ];

  it('should render all navigation items', () => {
    render(<Navigation items={mockItems} />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Accounts')).toBeInTheDocument();
    expect(screen.getByText('Tasks')).toBeInTheDocument();
  });

  it('should mark active item with is-active class', () => {
    render(<Navigation items={mockItems} />);

    const dashboardButton = screen.getByText('Dashboard');
    expect(dashboardButton).toHaveClass('is-active');
  });

  it('should call onNavigate when item is clicked', () => {
    const mockNavigate = vi.fn();
    render(<Navigation items={mockItems} onNavigate={mockNavigate} />);

    const accountsButton = screen.getByText('Accounts');
    accountsButton.click();

    expect(mockNavigate).toHaveBeenCalledWith('accounts');
  });
});
