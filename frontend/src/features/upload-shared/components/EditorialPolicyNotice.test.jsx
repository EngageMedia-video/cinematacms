import { render, screen } from '@testing-library/react';
import { EditorialPolicyNotice } from './EditorialPolicyNotice';

describe('EditorialPolicyNotice', () => {
	it('renders a clickable Editorial Policy link to the policy page', () => {
		render(<EditorialPolicyNotice />);
		const link = screen.getByRole('link', { name: /editorial policy/i });
		expect(link).toHaveAttribute('href', '/editorial-policy');
	});
});
