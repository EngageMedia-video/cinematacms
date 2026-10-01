import { render, screen, within } from '@testing-library/react';
import { Breadcrumbs } from './Breadcrumbs';

it('links ancestors and identifies the current page without linking it', () => {
	render(<Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'A film' }]} />);
	const nav = within(screen.getByRole('navigation', { name: 'Breadcrumb' }));
	expect(nav.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
	expect(nav.getByText('A film')).toHaveAttribute('aria-current', 'page');
	expect(nav.queryByRole('link', { name: 'A film' })).not.toBeInTheDocument();
});
