import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const METRICS = ['statements', 'branches', 'functions', 'lines'];

function emptyMetrics() {
	return Object.fromEntries(METRICS.map((metric) => [metric, { covered: 0, total: 0 }]));
}

function groupForPath(filePath) {
	const normalized = filePath.replaceAll('\\', '/');
	if (normalized.includes('/src/features/')) return 'Modern frontend';
	if (normalized.includes('/src/static/js/')) return 'Legacy frontend';
	return null;
}

export function summarizeCoverage(summary) {
	const groups = {
		'Modern frontend': emptyMetrics(),
		'Legacy frontend': emptyMetrics(),
	};

	for (const [filePath, coverage] of Object.entries(summary)) {
		if (filePath === 'total') continue;
		const group = groupForPath(filePath);
		if (!group) continue;

		for (const metric of METRICS) {
			groups[group][metric].covered += coverage[metric].covered;
			groups[group][metric].total += coverage[metric].total;
		}
	}

	return groups;
}

function percentage({ covered, total }) {
	return total === 0 ? 'n/a' : `${((100 * covered) / total).toFixed(1)}%`;
}

export function renderCoverageSummary(groups) {
	const rows = Object.entries(groups).map(([group, metrics]) => {
		const values = METRICS.map((metric) => percentage(metrics[metric]));
		return `| ${group} | ${values.join(' | ')} |`;
	});

	return [
		'### Frontend coverage',
		'',
		'| Area | Statements | Branches | Functions | Lines |',
		'|---|---:|---:|---:|---:|',
		...rows,
		'',
		'Coverage is informational. This job has no percentage threshold.',
		'',
		'Scope: `src/features/**/*.{js,jsx}` and `src/static/js/**/*.{js,jsx}`.',
		'Tests and test setup are excluded. `src/static/js/components/-NEW-/InlineSliderItemListAsync.js` is also excluded because it contains JSX under a `.js` extension that V8 cannot remap when the file is uncovered.',
		'',
	].join('\n');
}

function main() {
	const inputPath = process.argv[2];
	if (!inputPath) throw new Error('Pass the path to coverage-summary.json.');

	const summary = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
	const markdown = renderCoverageSummary(summarizeCoverage(summary));
	console.log(markdown);

	if (process.env.GITHUB_STEP_SUMMARY) {
		fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main();
}
