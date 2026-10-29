import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ShareOptionsContext from '../../../../../static/js/contexts/ShareOptionsContext';
import { MediaShareOptions } from './MediaShareOptions';

vi.mock('../../../../../static/js/contexts/ShareOptionsContext', () => ({
	default: React.createContext([]),
}));
vi.mock('../../../../../static/js/pages/MediaPage/store.js', () => ({
	default: { get: () => 'https://cinemata.example/view?m=film', on: vi.fn(), removeListener: vi.fn() },
}));

describe('MediaShareOptions', () => {
	it('names the share network on each share link for analytics', () => {
		render(
			<ShareOptionsContext.Provider value={['fb', 'email', 'whatsapp']}>
				<MediaShareOptions />
			</ShareOptionsContext.Provider>
		);

		for (const [label, network] of [
			['Facebook', 'fb'],
			['Email', 'email'],
			['WhatsApp', 'whatsapp'],
		]) {
			const link = screen.getByRole('link', { name: label });
			expect(link).toHaveAttribute('data-analytics-action', 'media_share_click');
			expect(link).toHaveAttribute('data-analytics-network', network);
		}
	});
});
