/**
 * ESLint Configuration — Track Boundary Enforcement
 *
 * This config enforces the dual-track architecture boundary:
 *
 * - Modern track (features/**): Must NOT import legacy Flux stores or dispatcher.
 * - Legacy track (pages/**, components/**): Should NOT import modern-track libs.
 *
 * This is intentionally minimal — no recommended config or React plugin.
 * It exists solely to enforce the track boundary via no-restricted-imports.
 */

export default [
	// Ignore build artifacts and node_modules
	{
		ignores: ['build/**', 'node_modules/**', 'packages/**', 'config/**', 'scripts/**'],
	},

	// Enable JSX parsing for all JS files (this codebase uses .js for JSX)
	{
		files: ['src/**/*.{js,jsx}'],
		languageOptions: {
			parserOptions: {
				ecmaFeatures: { jsx: true },
			},
		},
	},

	// Modern track: ERROR on legacy imports
	{
		files: ['src/features/**/*.{js,jsx}'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					paths: [
						{
							name: 'flux',
							message: 'Modern track must use Zustand, not Flux.',
						},
					],
					patterns: [
						{
							group: ['**/stores/*'],
							message: 'Modern track must use Zustand stores (useFooStore.js), not legacy Flux stores.',
						},
					],
				},
			],
			'no-restricted-syntax': [
				'error',
				{
					selector: 'MemberExpression[property.name="_currentValue"]',
					message: 'Use useContext() instead of ._currentValue in modern track code.',
				},
			],
		},
	},

	// Legacy track: WARN on modern imports
	{
		files: ['src/static/js/pages/**/*.{js,jsx}', 'src/static/js/components/**/*.{js,jsx}'],
		rules: {
			'no-restricted-imports': [
				'warn',
				{
					paths: [
						{
							name: 'zustand',
							message:
								'Legacy components should not import Zustand. Use Flux stores or move to features/.',
						},
						{
							name: '@tanstack/react-query',
							message:
								'Legacy components should not import TanStack Query. Use axios directly or move to features/.',
						},
					],
				},
			],
		},
	},
];
