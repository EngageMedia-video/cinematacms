import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

const legacyContextAccess = {
	selector: 'MemberExpression[property.name="_currentValue"]',
	message: 'Use useContext() instead of ._currentValue in modern track code.',
};

// Tailwind color utility with an arbitrary value, such as bg-[var(--body-bg-color)]
// or text-[#1F1F1F]. Sizing arbitrary values such as text-[11px] stay allowed.
const rawColorUtility =
	'/\\b(bg|text|border|ring|outline|divide|fill|stroke|shadow|caret|accent|decoration|placeholder|from|via|to)-\\[(var\\(--|#)/';

const inlineColorProperty =
	'Property[key.name=/^(color|backgroundColor|borderColor|borderTopColor|borderRightColor|borderBottomColor|borderLeftColor|outlineColor|fill|stroke|caretColor|accentColor|textDecorationColor|columnRuleColor)$/] > Literal[value=/var\\(--/]';

const semanticTokenMessage =
	'Use a semantic token utility, such as bg-bg-page or text-text-strong, instead of a raw CSS variable or color literal. See CODING_STANDARDS.md and docs/modern-track-color-system.md.';

const rawColorSelectors = [
	{ selector: `Literal[value=${rawColorUtility}]`, message: semanticTokenMessage },
	{ selector: `TemplateElement[value.raw=${rawColorUtility}]`, message: semanticTokenMessage },
	{ selector: inlineColorProperty, message: semanticTokenMessage },
];

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
			'no-restricted-syntax': ['error', legacyContextAccess, ...rawColorSelectors],
		},
	},

	// Test files assert on class strings instead of styling an interface.
	// NavigationMenuList is the documented sidebar bridge into legacy SCSS
	// variables; see docs/modern-track-color-system.md.
	{
		files: ['src/features/**/*.test.{js,jsx}', 'src/features/layout/Sidebar/navigation/NavigationMenuList.jsx'],
		rules: {
			'no-restricted-syntax': ['error', legacyContextAccess],
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
