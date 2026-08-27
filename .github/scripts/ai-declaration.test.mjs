import assert from 'node:assert/strict';
import test from 'node:test';

import {
	ASSISTED_LABEL,
	parseAiDeclaration,
	UNASSISTED_LABEL,
} from './ai-declaration.mjs';

function option(label, mark = ' ') {
	return `- [${mark}] ${label}`;
}

test('rejects a pull request with no declaration', () => {
	assert.deepEqual(parseAiDeclaration('## Summary'), {
		assisted: false,
		message: 'Select exactly one AI assistance declaration in the pull request body.',
		valid: false,
	});
});

test('accepts a substantive assistance declaration', () => {
	const body = [option(ASSISTED_LABEL, 'x'), option(UNASSISTED_LABEL)].join('\n');

	assert.deepEqual(parseAiDeclaration(body), {
		assisted: true,
		message: 'Substantive AI assistance declared.',
		valid: true,
	});
});

test('accepts a non-assisted declaration', () => {
	const body = [option(ASSISTED_LABEL), option(UNASSISTED_LABEL, 'x')].join('\n');

	assert.deepEqual(parseAiDeclaration(body), {
		assisted: false,
		message: 'No substantive AI assistance declared.',
		valid: true,
	});
});

test('rejects a pull request with both declarations', () => {
	const body = [option(ASSISTED_LABEL, 'x'), option(UNASSISTED_LABEL, 'X')].join('\n');

	assert.deepEqual(parseAiDeclaration(body), {
		assisted: false,
		message: 'Clear one AI assistance declaration in the pull request body.',
		valid: false,
	});
});

test('allows indentation and spacing around a checked declaration', () => {
	const body = `  -   [X]   ${ASSISTED_LABEL}   `;

	assert.equal(parseAiDeclaration(body).valid, true);
	assert.equal(parseAiDeclaration(body).assisted, true);
});

test('ignores unrelated checkboxes', () => {
	const body = [
		'- [x] Tests pass.',
		option(ASSISTED_LABEL),
		option(UNASSISTED_LABEL, 'x'),
	].join('\n');

	assert.equal(parseAiDeclaration(body).valid, true);
	assert.equal(parseAiDeclaration(body).assisted, false);
});
