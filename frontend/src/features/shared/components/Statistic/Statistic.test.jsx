import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Statistic } from './Statistic';

it('keeps metric explanations in accessible help that opens with keyboard or click', async () => {
	const user = userEvent.setup();
	render(
		<dl className="grid">
			<Statistic
				label="Media views"
				value="5"
				description="Repeat loads count."
				comparison="No earlier events recorded"
			/>
		</dl>
	);
	expect(screen.getByText('5')).toBeVisible();
	expect(screen.queryByText('Repeat loads count.')).not.toBeInTheDocument();
	expect(screen.queryByText('No earlier events recorded')).not.toBeInTheDocument();
	await user.tab();
	const help = screen.getByRole('button', { name: 'About media views' });
	expect(help).toHaveFocus();
	await user.keyboard('{Enter}');
	expect(help).toHaveAccessibleDescription('Repeat loads count. No earlier events recorded');
	await user.keyboard('{Escape}');
	expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
	await user.click(help);
	expect(screen.getByRole('tooltip')).toBeVisible();
	await user.click(document.body);
	expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});
