import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import profileQueryClient, { PROFILE_QUERY_KEYS } from '../../queryClient';
import { AboutSection } from './AboutSection';

const AUTHOR = {
	username: 'jen',
	name: 'Jen Tarnate',
	description: '<p>Filmmaker</p><img src="x" onerror="alert(1)">',
	location_info: [],
	social_media_links: '',
};

describe('AboutSection biography security', () => {
	beforeEach(() => {
		profileQueryClient.clear();
		profileQueryClient.setQueryData(PROFILE_QUERY_KEYS.playlists(AUTHOR.username), { results: [] });
		profileQueryClient.setQueryData(PROFILE_QUERY_KEYS.similar(AUTHOR.username, ''), { results: [] });
	});

	it('sanitizes unsafe biography attributes before rendering HTML', () => {
		const { container } = render(
			<QueryClientProvider client={profileQueryClient}>
				<AboutSection author={AUTHOR} />
			</QueryClientProvider>
		);

		expect(container).toHaveTextContent('Filmmaker');
		expect(container.querySelector('[onerror]')).toBeNull();
	});

	it('preserves plain-text paragraph breaks in the biography', () => {
		const author = { ...AUTHOR, description: 'First paragraph.\n\nSecond paragraph.' };
		const { container } = render(
			<QueryClientProvider client={profileQueryClient}>
				<AboutSection author={author} />
			</QueryClientProvider>
		);

		const bio = container.querySelector('.whitespace-pre-line');
		expect(bio).not.toBeNull();
		expect(bio.textContent).toContain('First paragraph.\n\nSecond paragraph.');
	});
});
