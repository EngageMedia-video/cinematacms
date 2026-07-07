import { describe, expect, it } from 'vitest';
import { getProfileTabs } from './tabConfig';

const AUTHOR = {
	username: 'jen',
	name: 'Jen Tarnate',
	media_count: 4,
	playlist_count: 2,
};

function runtimeConfig(overrides = {}) {
	return {
		member: {
			can: {
				manageUploads: true,
				saveMedia: true,
				...overrides.can,
			},
		},
		options: {
			pages: {
				profile: {
					includeHistory: true,
					includeLikedMedia: true,
					...overrides.profile,
				},
			},
		},
	};
}

describe('getProfileTabs', () => {
	it('hides private tabs from visitors', () => {
		const tabs = getProfileTabs({ ...AUTHOR, is_owner: false }, runtimeConfig());

		expect(tabs.map((tab) => tab.id)).toEqual(['about', 'media', 'playlists', 'impact']);
		expect(tabs.find((tab) => tab.id === 'media').label).toBe("Jen's Media");
	});

	it('shows enabled owner tabs in stakeholder order', () => {
		const tabs = getProfileTabs({ ...AUTHOR, is_owner: true }, runtimeConfig());

		expect(tabs.map((tab) => tab.id)).toEqual([
			'about',
			'media',
			'manage-uploads',
			'playlists',
			'notes',
			'impact',
			'history',
			'liked',
		]);
		expect(tabs.find((tab) => tab.id === 'media').label).toBe("Jen's Media");
	});

	it('honors existing capability flags', () => {
		const tabs = getProfileTabs(
			{ ...AUTHOR, is_owner: true },
			runtimeConfig({
				can: { manageUploads: false, saveMedia: false },
				profile: { includeHistory: false, includeLikedMedia: false },
			})
		);

		expect(tabs.map((tab) => tab.id)).toEqual(['about', 'media', 'notes', 'impact']);
	});
});
