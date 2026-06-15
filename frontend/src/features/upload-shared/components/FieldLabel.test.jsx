import { render, screen } from '@testing-library/react';
import { FieldLabel } from './FieldLabel';

describe('FieldLabel', () => {
	it('exposes required state to screen readers', () => {
		render(<FieldLabel required>Synopsis</FieldLabel>);

		expect(screen.getByText('required')).toHaveClass('sr-only');
		expect(screen.getByText('*')).toHaveAttribute('aria-hidden', 'true');
	});
});
