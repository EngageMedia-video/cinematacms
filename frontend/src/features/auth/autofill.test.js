import tailwindSource from '../../static/css/tailwind.css?raw';
import { declarationsFor } from '../../test/cssDeclarations';

describe('auth form autofill styling', () => {
	// Chrome paints autofilled inputs #E8F0FE with black text through a UA
	// `!important` rule, which ignores the dark theme on the auth pages.
	it('keeps autofilled auth fields on the theme text color over the themed panel', () => {
		const declarations = declarationsFor(tailwindSource, ['.auth-field input', ':-webkit-autofill']);

		expect(declarations['-webkit-text-fill-color']).toBe('var(--text-strong)');
		expect(declarations['background-clip']).toBe('text');
	});
});
