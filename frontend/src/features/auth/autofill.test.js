import tailwindSource from '../../static/css/tailwind.css?raw';
import { declarationsFor } from '../../test/cssDeclarations';

describe('auth form autofill styling', () => {
	// Checks the declarations only: jsdom cannot paint Chrome's autofill state.
	it('repaints autofilled auth text with the theme color and clips the autofill background to the text', () => {
		const declarations = declarationsFor(tailwindSource, ['.auth-field input', ':-webkit-autofill']);

		expect(declarations['-webkit-text-fill-color']).toBe('var(--text-strong)');
		expect(declarations['background-clip']).toBe('text');
	});
});
