import { useEffect, useState } from 'react';

function getStoryColorMode(mode) {
	if ('light' === mode || 'dark' === mode) {
		return mode;
	}

	if (typeof document === 'undefined') {
		return 'dark';
	}

	return document.body.classList.contains('light_theme') ? 'light' : 'dark';
}

async function syncSidebarStoryThemeStore(mode) {
	try {
		const [{ default: ThemeStore }, ThemeActions] = await Promise.all([
			import('../../../../../static/js/stores/ThemeStore.js'),
			import('../../../../../static/js/actions/ThemeActions.js'),
		]);

		if (ThemeStore.get('mode') !== mode) {
			ThemeActions.toggleMode();
		}
	} catch {
		// ThemeStore is only needed by lazy-loaded sidebar components.
	}
}

export function ensureSidebarStoryMediaCMS(mode) {
	if (typeof window === 'undefined') {
		return;
	}

	const colorMode = getStoryColorMode(mode);

	if (window.MediaCMS) {
		window.MediaCMS.site.theme.mode = colorMode;
		return;
	}

	window.MediaCMS = {
		site: {
			id: 'storybook-sidebar',
			title: 'Cinemata',
			url: 'https://cinemata.test',
			api: 'https://cinemata.test/api',
			devEnv: true,
			theme: {
				mode: colorMode,
				switch: {
					enabled: true,
					position: 'sidebar',
				},
			},
			logo: {
				lightMode: {
					img: '',
					svg: '',
				},
				darkMode: {
					img: '',
					svg: '',
				},
			},
			pages: {
				featured: { enabled: true, title: 'Featured' },
				recommended: { enabled: true, title: 'Recommended' },
				latest: { enabled: true, title: 'Recent Uploads' },
				members: { enabled: true, title: 'Members' },
				liked: { enabled: true, title: 'Liked Media' },
				history: { enabled: true, title: 'History' },
			},
			userPages: {},
			taxonomies: {
				tags: { enabled: true, title: 'Tags' },
				categories: { enabled: true, title: 'Categories' },
				topics: { enabled: true, title: 'Topics' },
				languages: { enabled: true, title: 'Languages' },
				countries: { enabled: true, title: 'Countries' },
			},
		},
		pages: {
			home: {},
			search: {},
			media: {},
			profile: {},
		},
		url: {
			home: '/',
			admin: '/manage',
			error404: '/404',
			latestMedia: '/latest',
			featuredMedia: '/featured',
			recommendedMedia: '/recommended',
			signin: '/signin',
			signout: '/signout',
			register: '/register',
			changePassword: '/change-password',
			members: '/members',
			search: '/search',
			likedMedia: '/liked',
			history: '/history',
			addMedia: '/upload',
			editChannel: '/edit-channel',
			editProfile: '/edit-profile',
			tags: '/tags',
			categories: '/categories',
			topics: '/topics',
			countries: '/countries',
			languages: '/languages',
			manageMedia: '/manage/media',
			manageUsers: '/manage/users',
			manageComments: '/manage/comments',
			manageUploads: '/manage/uploads',
		},
		user: {
			is: {
				anonymous: false,
				admin: true,
			},
			name: 'Storybook User',
			username: 'storybook-user',
			thumbnail: '',
			can: {
				changePassword: true,
				deleteProfile: false,
				addComment: true,
				deleteComment: true,
				editMedia: true,
				deleteMedia: true,
				editSubtitle: true,
				manageMedia: true,
				manageUsers: true,
				manageComments: true,
				manageUploads: true,
				contactUser: false,
				addMedia: true,
				editProfile: true,
				readComment: true,
			},
			pages: {
				home: '/user/storybook-user',
				about: '/user/storybook-user/about',
				media: '/user/storybook-user/media',
				playlists: '/user/storybook-user/playlists',
			},
		},
		profileId: 'storybook-user',
		api: {
			media: 'media',
			playlists: 'playlists',
			members: 'members',
			liked: 'liked',
			history: 'history',
			tags: 'tags',
			categories: 'categories',
			topics: 'topics',
			countries: 'countries',
			languages: 'languages',
			manage_media: 'manage/media',
			manage_users: 'manage/users',
			manage_comments: 'manage/comments',
			my_uploads: 'manage/uploads',
			search: 'search',
		},
		contents: {
			header: {},
			sidebar: {
				mainMenuExtraItems: [
					{
						text: 'Campaigns',
						link: '/campaigns',
						icon: 'campaign',
						className: 'nav-item-campaigns',
					},
				],
				navMenuItems: [
					{
						text: 'Editorial Picks',
						link: '/editorial',
						icon: 'auto_awesome',
						className: 'nav-item-editorial',
					},
				],
				belowNavMenu: '<p class="body-body-14-regular">Curated weekly by the Cinemata editorial team.</p>',
				// belowThemeSwitcher:
				// 	'<p class="body-body-12-regular">Switch between light and dark themes in the sidebar.</p>',
				footer: '<p class="body-body-12-regular">Need help? <a href="/help">Visit the help center</a>.</p>',
				footerNew: {
					logo: {
						link: 'https://engagemedia.org',
						title: 'EngageMedia',
						darkImage: '/static/images/em_logo_dark.png',
						lightImage: '/static/images/em_logo_light.png',
						target: '_blank',
						rel: 'noreferrer',
					},
					links: [
						{
							text: 'Powered by CinemataCMS',
							link: 'https://github.com/EngageMedia-Tech/cinematacms',
							target: '_blank',
							rel: 'noreferrer',
						},
						{
							text: 'Terms & Privacy',
							link: 'https://cinemata.org/terms',
							target: '_blank',
							rel: 'noreferrer',
						},
					],
				},
			},
			uploader: {},
			notifications: {},
		},
		features: {
			sideBar: {
				hideHomeLink: false,
				hideTagsLink: false,
			},
			headerBar: {
				hideLogin: false,
				hideRegister: false,
			},
			embeddedVideo: {},
			mediaItem: {},
			media: {
				actions: {
					comment: true,
					like: true,
					dislike: true,
					report: true,
					download: true,
					save: true,
					share: true,
				},
				shareOptions: [],
			},
			playlists: {},
		},
		notifications: [],
	};
}

export function SidebarStorySurface({ children, className = '' }) {
	useEffect(() => {
		const mode = getStoryColorMode();
		ensureSidebarStoryMediaCMS(mode);
		syncSidebarStoryThemeStore(mode);
	});

	return (
		<div
			className={`min-h-screen bg-surface-body text-content-body ${className}`}
			style={{
				'--header-height': '72px',
				'--sidebar-width': '240px',
				'--theme-color': '#ed7c30',
				'--default-theme-color': '#ed7c30',
			}}
		>
			{children}
		</div>
	);
}

export function SidebarPanel({ children, className = '' }) {
	return (
		<SidebarStorySurface className="flex items-start justify-center p-8">
			<div className={`w-[280px] overflow-hidden rounded-sm bg-surface-sidebar ${className}`}>{children}</div>
		</SidebarStorySurface>
	);
}

export function LazySidebarComponent({ loadComponent, exportName, fallback = null, ...props }) {
	const [Component, setComponent] = useState(null);

	useEffect(() => {
		const mode = getStoryColorMode();
		ensureSidebarStoryMediaCMS(mode);
		syncSidebarStoryThemeStore(mode);

		let isMounted = true;

		loadComponent().then((module) => {
			if (isMounted) {
				setComponent(() => module[exportName]);
			}
		});

		return () => {
			isMounted = false;
		};
	}, [exportName, loadComponent]);

	return Component ? <Component {...props} /> : fallback;
}
