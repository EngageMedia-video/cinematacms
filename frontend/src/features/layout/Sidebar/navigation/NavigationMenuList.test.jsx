import { render, screen } from '@testing-library/react';

import { NavigationMenuList } from './NavigationMenuList';

const ITEMS = [
	{
		itemType: 'link',
		link: '/manage/media',
		icon: 'gear',
		text: 'Media',
		itemAttr: { className: 'nav-item-manage-media' },
	},
	{
		itemType: 'link',
		link: '/manage/users',
		icon: 'gear',
		text: 'Users',
		itemAttr: { className: 'nav-item-manage-users' },
	},
];

describe('NavigationMenuList', () => {
	it('renders a section heading and labels the nav when a title is provided', () => {
		render(<NavigationMenuList title="Manage" items={ITEMS} />);

		const heading = screen.getByRole('heading', { name: 'Manage' });
		const nav = screen.getByRole('navigation', { name: 'Manage' });

		expect(heading).toBeInTheDocument();
		expect(nav).toHaveAttribute('aria-labelledby', heading.getAttribute('id'));
	});

	it('omits the heading and nav label when no title is provided', () => {
		render(<NavigationMenuList items={ITEMS} />);

		expect(screen.queryByRole('heading')).not.toBeInTheDocument();
		expect(screen.getByRole('navigation')).not.toHaveAttribute('aria-labelledby');
	});

	it('renders the provided items as links to their destinations', () => {
		render(<NavigationMenuList title="Manage" items={ITEMS} />);

		expect(screen.getByRole('link', { name: 'Media' })).toHaveAttribute('href', '/manage/media');
		expect(screen.getByRole('link', { name: 'Users' })).toHaveAttribute('href', '/manage/users');
	});

	it('renders nothing when there are no items', () => {
		const { container } = render(<NavigationMenuList title="Manage" items={[]} />);

		expect(container).toBeEmptyDOMElement();
	});
});
