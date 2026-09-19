import { beforeEach, describe, expect, it, vi } from 'vitest';

// HeaderContext reads the MediaCMS config at module load, so each case mocks the
// config module and re-imports with a fresh module registry.
vi.mock('../mediacms/config.js', () => ({
	config: () => globalThis.__HEADER_TEST_CONFIG__,
}));

function buildConfig({ anonymous = false, canAddMedia = true, isAdmin = false } = {}) {
	return {
		url: {
			signout: '/accounts/logout/',
			signin: '/accounts/login/',
			register: '/accounts/signup/',
			changePassword: '/accounts/password/change/',
			admin: '/admin/',
			user: {
				addMedia: '/upload',
				editProfile: '/edit-profile',
			},
		},
		theme: { switch: { enabled: false, position: 'header' } },
		member: {
			is: { anonymous, admin: isAdmin },
			can: { addMedia: canAddMedia, login: true, register: true, changePassword: true },
		},
	};
}

async function loadPopupItems(overrides) {
	globalThis.__HEADER_TEST_CONFIG__ = buildConfig(overrides);
	vi.resetModules();
	const { default: HeaderContext } = await import('./HeaderContext.js');
	// createContext stores the default value we care about on _currentValue.
	const { popupNavItems } = HeaderContext._currentValue;
	return [...popupNavItems.top, ...popupNavItems.middle, ...popupNavItems.bottom];
}

describe('HeaderContext popup nav items', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	// The topbar renders UPLOAD MEDIA at every breakpoint, so the popup must never
	// duplicate it — see issue #950.
	const uploadCases = [
		{ name: 'signed-in user who can upload', overrides: { anonymous: false, canAddMedia: true } },
		{ name: 'signed-in user who cannot upload', overrides: { anonymous: false, canAddMedia: false } },
		{ name: 'anonymous visitor', overrides: { anonymous: true, canAddMedia: false } },
	];

	it.each(uploadCases)('omits the Upload media entry for a $name', async ({ overrides }) => {
		const items = await loadPopupItems(overrides);

		expect(items.map((item) => item.text)).not.toContain('Upload media');
		expect(items.some((item) => item.link === '/upload')).toBe(false);
	});

	const retainedCases = [
		{ name: 'Sign out', overrides: { anonymous: false }, text: 'Sign out' },
		{ name: 'Edit profile', overrides: { anonymous: false }, text: 'Edit profile' },
		{ name: 'Change password', overrides: { anonymous: false }, text: 'Change password' },
		{
			name: 'MediaCMS administration',
			overrides: { anonymous: false, isAdmin: true },
			text: 'MediaCMS administration',
		},
	];

	it.each(retainedCases)('still offers $name', async ({ overrides, text }) => {
		const items = await loadPopupItems(overrides);

		expect(items.map((item) => item.text)).toContain(text);
	});
});
