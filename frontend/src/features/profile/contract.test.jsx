import { describe, expect, it } from 'vitest';

const PROFILE_SOURCES = import.meta.glob('./**/*.{js,jsx}', {
	eager: true,
	query: '?raw',
	import: 'default',
});
const sources = Object.entries(PROFILE_SOURCES).filter(([path]) => !path.includes('.test.'));

describe('Profile architecture contract', () => {
	it('does not import legacy Flux state into the modern feature', () => {
		const violations = sources.filter(([, source]) => /from ['"].*flux|_currentValue/.test(source));
		expect(violations.map(([path]) => path)).toEqual([]);
	});

	it('uses semantic colors and avoids raw palette utilities', () => {
		const violations = sources.filter(([, source]) =>
			/(?:bg|text|border)-cinemata-|#[0-9a-f]{3,8}\b/i.test(source)
		);
		expect(violations.map(([path]) => path)).toEqual([]);
	});

	it('does not use transition-all or forwardRef', () => {
		const violations = sources.filter(([, source]) => /transition-all|forwardRef/.test(source));
		expect(violations.map(([path]) => path)).toEqual([]);
	});

	it('assigns the Figma-specific icon to each About section', () => {
		const sourceByPath = Object.fromEntries(sources);
		const aboutSource = sourceByPath['./components/sections/AboutSection.jsx'];
		const similarSource = sourceByPath['./components/SimilarProfiles.jsx'];

		expect(aboutSource).toContain('icon="profileBionote"');
		expect(aboutSource).toContain('icon="profileDetails"');
		expect(aboutSource).toContain('icon="profileFavoriteFilms"');
		expect(aboutSource).toContain('icon="profileRecentPlaylists"');
		expect(similarSource).toContain('icon="profileSimilarProfiles"');
	});

	it('uses one shared tab panel instead of top-level section cards', () => {
		const sourceByPath = Object.fromEntries(sources);
		const profilePageSource = sourceByPath['./components/ProfilePage.jsx'];
		const aboutSource = sourceByPath['./components/sections/AboutSection.jsx'];
		const manageUploadsSource = sourceByPath['./components/sections/ManageUploadsSection.jsx'];
		const notesSource = sourceByPath['./components/sections/NotesSection.jsx'];

		expect(profilePageSource).toContain('rounded-2xl bg-bg-surface');
		expect(aboutSource).not.toContain('<Card');
		expect(manageUploadsSource).not.toContain('<Card');
		expect(notesSource).not.toContain('<Card');
	});

	it('renders the Figma profile banner when the profile has no uploaded banner', () => {
		const profilePageSource = Object.fromEntries(sources)['./components/ProfilePage.jsx'];

		expect(profilePageSource).toContain("import defaultProfileBanner from '../assets/profile-banner.png'");
		expect(profilePageSource).toContain('author.banner_thumbnail_url || defaultProfileBanner');
		expect(profilePageSource).toContain('h-[230px]');
		expect(profilePageSource).toContain('sm:bg-[length:100%_167.92%]');
	});
});
