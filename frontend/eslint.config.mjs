/**
 * ESLint Configuration — Track Boundary Enforcement
 *
 * This config enforces the dual-track architecture boundary:
 *
 * - Modern track (features/**): Must NOT import legacy Flux stores or dispatcher.
 * - Legacy track (pages/**, components/**): Should NOT import modern-track libs,
 *   plus a small set of warn-only sanity rules to catch new regressions without
 *   forcing a cleanup of existing code.
 */

import globals from 'globals';

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

	// Legacy track: WARN on modern imports + a few warn-only safety rules.
	// All rules here are intentionally warn-only — they catch new regressions
	// without forcing cleanup of existing legacy code.
	{
		files: ['src/static/js/pages/**/*.{js,jsx}', 'src/static/js/components/**/*.{js,jsx}'],
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
			},
		},
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
			'no-undef': 'warn',
			'no-unused-vars': [
				'warn',
				{
					argsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
				},
			],
			'no-debugger': 'warn',
		},
	},
];
