import { render, screen } from '@testing-library/react';
import { ProfileTabs } from './ProfileTabs';

describe('ProfileTabs', () => {
	it('fills the active tab with the tab selection token', () => {
		render(
			<ProfileTabs
				activeTab="media"
				tabs={[
					{ id: 'media', label: 'Media', href: '/user/someone/media' },
					{ id: 'about', label: 'About', href: '/user/someone/about' },
				]}
			/>
		);

		expect(screen.getByRole('link', { name: 'Media' }).style.backgroundColor).toBe('var(--tab-selected-bg)');
	});
});
