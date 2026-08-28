import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
	{
		ignores: ['build/**', 'node_modules/**', 'packages/**', 'config/**', 'scripts/**'],
	},

	{
		files: ['src/**/*.{js,jsx}'],
		languageOptions: {
			parserOptions: {
				ecmaFeatures: { jsx: true },
			},
		},
	},

	{
		files: ['src/features/**/*.{js,jsx}'],
		plugins: {
			'react-hooks': reactHooks,
		},
		rules: {
			'react-hooks/rules-of-hooks': 'error',
			'react-hooks/exhaustive-deps': 'warn',
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

	// Keep legacy-only rules non-blocking until the migration changes their baseline.
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
