import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import stylesheet from './ManageFilmImpactPage.scss?inline';

describe('manage film impact select styling', () => {
	let style;

	beforeAll(() => {
		style = document.createElement('style');
		style.textContent = stylesheet;
		document.head.append(style);
	});

	afterAll(() => {
		style.remove();
		document.body.innerHTML = '';
	});

	// The selects on this page are transparent, and Chrome paints an open option
	// list with the select's own background, so the options need their own
	// colors. jsdom returns the declared var() values without resolving them:
	// this checks that the declaration exists, not the rendered colors.
	it('declares a themed surface and text color for select options', () => {
		document.body.innerHTML = `
			<div class="manage-film-impact-page">
				<select><option>Screening</option></select>
			</div>`;
		const optionStyle = getComputedStyle(document.querySelector('option'));

		expect(optionStyle.backgroundColor).toBe('var(--bg-surface, var(--popup-bg-color))');
		expect(optionStyle.color).toBe('var(--text-strong, var(--body-text-color))');
	});
});
