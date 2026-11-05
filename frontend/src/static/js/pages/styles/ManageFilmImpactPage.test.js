import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import stylesheet from './ManageFilmImpactPage.scss?inline';

function renderSelectOption(formClassName) {
	document.body.className = 'dark_theme';
	document.body.innerHTML = `
		<div class="manage-film-impact-page">
			<form class="${formClassName}">
				<select><option>Screening</option><option>Featured</option></select>
			</form>
		</div>`;
	return document.querySelectorAll('option')[1];
}

describe('manage film impact select styling', () => {
	let style;

	beforeAll(() => {
		style = document.createElement('style');
		style.textContent = stylesheet;
		document.head.append(style);
	});

	afterAll(() => {
		style.remove();
		document.body.className = '';
		document.body.innerHTML = '';
	});

	// The filter and edit selects are transparent so they sit on the page.
	// Chrome paints the open option list with the select's own background, so a
	// transparent select gets the browser's white list while the dark theme
	// keeps the option text light: the options become unreadable.
	it.each(['manage-film-impact-page__filters', 'manage-film-impact-page__edit-form'])(
		'paints the open option list of %s on the themed surface and text colors',
		(formClassName) => {
			const optionStyle = getComputedStyle(renderSelectOption(formClassName));

			expect(optionStyle.backgroundColor).toBe('var(--bg-surface, var(--popup-bg-color))');
			expect(optionStyle.color).toBe('var(--text-strong, var(--body-text-color))');
		}
	);
});
