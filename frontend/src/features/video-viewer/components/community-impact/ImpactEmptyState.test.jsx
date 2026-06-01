import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ImpactEmptyState } from './ImpactEmptyState';

describe('ImpactEmptyState', () => {
	it('renders the prompt and calls the add handler', async () => {
		const user = userEvent.setup();
		const onAddImpact = vi.fn();

		render(<ImpactEmptyState onAddImpact={onAddImpact} />);

		await user.click(screen.getByRole('button', { name: 'ADD IMPACT' }));

		expect(screen.getByText('Where has this film made an impact?')).toBeVisible();
		expect(onAddImpact).toHaveBeenCalledTimes(1);
	});

	it('can hide the add action', () => {
		render(<ImpactEmptyState canAdd={false} />);

		expect(screen.queryByRole('button', { name: 'ADD IMPACT' })).not.toBeInTheDocument();
	});
});
