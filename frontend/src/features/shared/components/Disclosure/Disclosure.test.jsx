import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { Disclosure } from './Disclosure';

it('is reachable by keyboard and toggles help without losing focus', async () => {
	const user = userEvent.setup();
	render(<Disclosure title="About watch time">Only active playback counts.</Disclosure>);
	expect(screen.getByText('Only active playback counts.')).not.toBeVisible();
	await user.tab();
	expect(screen.getByText('About watch time')).toHaveFocus();
	await user.click(screen.getByText('About watch time'));
	expect(screen.getByText('Only active playback counts.')).toBeVisible();
	await user.click(screen.getByText('About watch time'));
	expect(screen.getByText('Only active playback counts.')).not.toBeVisible();
	expect(screen.getByText('About watch time')).toHaveFocus();
});
