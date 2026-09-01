import assert from 'node:assert/strict';
import test from 'node:test';

import {
	renderCoverageSummary,
	summarizeCoverage,
} from './summarize-frontend-coverage.mjs';

function fileCoverage(total, covered) {
	return {
		branches: { covered, total },
		functions: { covered, total },
		lines: { covered, total },
		statements: { covered, total },
	};
}

test('aggregates modern and legacy files separately', () => {
	const groups = summarizeCoverage({
		'/repo/src/features/a.js': fileCoverage(10, 5),
		'/repo/src/features/b.jsx': fileCoverage(10, 10),
		'/repo/src/static/js/legacy.js': fileCoverage(20, 5),
		total: fileCoverage(40, 20),
	});

	assert.deepEqual(groups['Modern frontend'].lines, { covered: 15, total: 20 });
	assert.deepEqual(groups['Legacy frontend'].lines, { covered: 5, total: 20 });
});

test('renders percentages and an informational notice', () => {
	const markdown = renderCoverageSummary(
		summarizeCoverage({
			'C:\\repo\\src\\features\\a.js': fileCoverage(4, 3),
			'/repo/src/static/js/legacy.js': fileCoverage(2, 1),
		})
	);

	assert.match(markdown, /Modern frontend \| 75\.0%/);
	assert.match(markdown, /Legacy frontend \| 50\.0%/);
	assert.match(markdown, /has no percentage threshold/);
});
