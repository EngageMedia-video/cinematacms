import { render, screen } from '@testing-library/react';
import { Pagination } from './Pagination';

it('preserves caller URLs and omits unavailable directions and single-page navigation', () => {
	const nextHref = '?page=2&days=7&tz=Asia%2FJakarta#media';
	const { rerender } = render(<Pagination page={1} totalPages={2} nextHref={nextHref} />);
	expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute('href', nextHref);
	expect(screen.queryByRole('link', { name: 'Previous' })).not.toBeInTheDocument();
	rerender(<Pagination page={2} totalPages={2} previousHref="?page=1" />);
	expect(screen.getByRole('link', { name: 'Previous' })).toHaveAttribute('rel', 'prev');
	expect(screen.queryByRole('link', { name: 'Next' })).not.toBeInTheDocument();
	rerender(<Pagination page={1} totalPages={1} />);
	expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
});
