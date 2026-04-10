import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../src/App';

describe('Roles View Integration', () => {
  it('should render role management and reflect workspace isolation', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Roles' }));

    expect(screen.getByText('Workspace Scope')).toBeInTheDocument();
    expect(screen.getAllByText('专业客服').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('增长运营')).toHaveLength(0);

    await user.selectOptions(screen.getByRole('combobox', { name: /workspace/i }), 'ws-002');

    expect((await screen.findAllByText('增长运营')).length).toBeGreaterThan(0);
    expect(screen.queryAllByText('专业客服')).toHaveLength(0);
  });
});
