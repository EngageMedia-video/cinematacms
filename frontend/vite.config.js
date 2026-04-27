import { defineConfig, transformWithEsbuild } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import svgr from 'vite-plugin-svgr';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import svgoConfig from './svgo.config.mjs';

export default defineConfig({
	plugins: [
		// This codebase uses .js files for JSX (legacy Webpack convention).
		// Vite's built-in esbuild only parses .jsx/.tsx as JSX, so we need a
		// pre-transform plugin to handle .js files containing JSX before
		// Vite's own parser sees them.
		{
			name: 'treat-js-as-jsx',
			enforce: 'pre',
			async transform(code, id) {
				if (!id.match(/src\/.*\.js$/) || id.includes('node_modules')) return null;
				return transformWithEsbuild(code, id, {
					loader: 'jsx',
					jsx: 'automatic',
				});
			},
		},
		react({
			include: /\.(js|jsx)$/,
			babel: {
				plugins: ['styled-jsx/babel'],
			},
		}),
		svgr({
			include: '**/*.svg?react',
			svgrOptions: {
				plugins: ['@svgr/plugin-svgo', '@svgr/plugin-jsx'],
				ref: true,
				titleProp: true,
				svgoConfig,
			},
		}),
		tailwindcss(),
		viteStaticCopy({
			targets: [
				{
					src: 'src/static/images',
					dest: '.',
				},
				{
					src: 'src/static/lib/Inter',
					dest: 'lib',
				},
				{
					src: 'src/static/lib/BarlowSemiCondensed',
					dest: 'lib',
				},
			],
		}),
	],

	base: '/static/',

	server: {
		origin: 'http://localhost:5173',
		// Tell the HMR client to connect to the Vite dev server directly,
		// not to the Django host the page was loaded from.
		hmr: {
			host: 'localhost',
			port: 5173,
		},
	},

	// Handle JSX in .js files during dependency pre-bundling (dev server).
	optimizeDeps: {
		esbuildOptions: {
			loader: {
				'.js': 'jsx',
			},
		},
	},

	css: {
		preprocessorOptions: {
			scss: {
				api: 'modern-compiler',
				// Silence expected deprecation warnings from legacy SCSS (not changing in this PR).
				silenceDeprecations: ['import', 'slash-div', 'color-functions'],
			},
		},
	},

	build: {
		outDir: 'build/production/static',
		manifest: true,
		// Include workspace packages in CJS→ESM conversion.
		// Vite resolves symlinks to real paths (packages/media-player/),
		// which don't match the default /node_modules/ pattern.
		commonjsOptions: {
			include: [/packages\/media-player/, /node_modules/],
		},
		rollupOptions: {
			external: ['video.js'],
			input: {
				base: 'src/entries/base.js',
				index: 'src/entries/index.js',
				search: 'src/entries/search.js',
				latest: 'src/entries/latest.js',
				featured: 'src/entries/featured.js',
				recommended: 'src/entries/recommended.js',
				members: 'src/entries/members.js',
				embed: 'src/entries/embed.js',
				media: 'src/entries/media.js',
				playlist: 'src/entries/playlist.js',
				tags: 'src/entries/tags.js',
				categories: 'src/entries/categories.js',
				topics: 'src/entries/topics.js',
				languages: 'src/entries/languages.js',
				countries: 'src/entries/countries.js',
				'manage-media': 'src/entries/manage-media.js',
				'manage-users': 'src/entries/manage-users.js',
				'manage-comments': 'src/entries/manage-comments.js',
				'manage-uploads': 'src/entries/manage-uploads.js',
				'profile-home': 'src/entries/profile-home.js',
				'profile-about': 'src/entries/profile-about.js',
				'profile-playlists': 'src/entries/profile-playlists.js',
				'profile-media': 'src/entries/profile-media.js',
				history: 'src/entries/history.js',
				liked: 'src/entries/liked.js',
				'add-media': 'src/entries/add-media.js',
				error: 'src/entries/error.js',
				'modern-demo': 'src/entries/modern-demo.js',
				notifications: 'src/entries/notifications.js',
				'index-revamp': 'src/entries/index-revamp.js',
			},
			output: {
				globals: {
					'video.js': 'videojs',
				},
				// Isolate modern-track libraries into a dedicated chunk.
				// If a legacy component accidentally imports these, the separate
				// chunk will appear in the build output, making the leak visible.
				// Without this, Rollup might merge them into a shared chunk
				// that gets loaded by every page (~15KB gzipped).
				manualChunks: {
					'modern-track-vendor': ['@tanstack/react-query', 'zustand'],
				},
			},
		},
	},
});
