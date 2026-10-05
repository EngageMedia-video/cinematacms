import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { parseAnalyticsDeclaration } from './analytics-declaration.mjs';

const events = `## Analytics
- [x] Events added or updated.
- [ ] Not applicable.
Events: pageview, annotation_created
Trigger: public page loads and annotation save succeeds
Verification: tracker unit test and local Umami collection
Coverage: media-loads`;

test('requires an analytics section and one selection', () => {
	assert.equal(parseAnalyticsDeclaration('## Description').valid, false);
	assert.equal(parseAnalyticsDeclaration(events.replace('[x]', '[ ]')).valid, false);
	assert.equal(
		parseAnalyticsDeclaration(events.replace('- [ ] Not applicable.', '- [X] Not applicable.')).valid,
		false
	);
});

test('accepts documented events, including edited whitespace and unrelated checkboxes', () => {
	const body = `- [x] New feature\r\n${events.replace('- [x]', '  -  [X]')}`;
	assert.equal(parseAnalyticsDeclaration(body).valid, true);
});

test('requires valid event names, a trigger, and verification', () => {
	assert.equal(parseAnalyticsDeclaration(events.replace('annotation_created', 'annotation:secret')).valid, false);
	assert.equal(
		parseAnalyticsDeclaration(events.replace('Trigger: public page loads and annotation save succeeds', 'Trigger:'))
			.valid,
		false
	);
	assert.equal(
		parseAnalyticsDeclaration(
			events.replace('Verification: tracker unit test and local Umami collection', 'Verification:')
		).valid,
		false
	);
	assert.equal(parseAnalyticsDeclaration(events.replace('Coverage: media-loads', 'Coverage:')).valid, false);
});

test('accepts an explained exception and rejects a blank one', () => {
	const body = `## Analytics
- [ ] Events added or updated.
- [x] Not applicable.
Reason: Staff-only maintenance view.`;
	assert.equal(parseAnalyticsDeclaration(body).valid, true);
	assert.equal(
		parseAnalyticsDeclaration(body.replace('Staff-only maintenance view.', '<!-- explain -->')).valid,
		false
	);
});

test('ignores declarations outside the analytics section', () => {
	const body = `## Analytics
- [ ] Events added or updated.
- [ ] Not applicable.

## Checklist
- [x] Events added or updated.
Events: play
Trigger: button click
Verification: test`;
	assert.equal(parseAnalyticsDeclaration(body).valid, false);
});

test('accepts a completed pull request template', () => {
	const template = readFileSync(new URL('../PULL_REQUEST_TEMPLATE.md', import.meta.url), 'utf8');
	const body = template
		.replace('- [ ] Events added or updated.', '- [x] Events added or updated.')
		.replace(/^Events:.*$/m, 'Events: pageview')
		.replace(/^Trigger:.*$/m, 'Trigger: public page loads')
		.replace(/^Verification:.*$/m, 'Verification: browser check')
		.replace(/^Coverage:.*$/m, 'Coverage: media-loads');

	assert.equal(parseAnalyticsDeclaration(template).valid, false);
	assert.equal(parseAnalyticsDeclaration(body).valid, true);
});

test('writes status outputs for valid and invalid PR bodies', () => {
	const directory = mkdtempSync(join(tmpdir(), 'cinemata-analytics-pr-'));
	try {
		for (const [body, expectedCode, expectedOutput] of [
			[events, 0, 'valid=true'],
			['## Description', 1, 'valid=false'],
		]) {
			const output = join(directory, `output-${expectedCode}`);
			const result = spawnSync(
				process.execPath,
				[fileURLToPath(new URL('./analytics-declaration.mjs', import.meta.url))],
				{
					env: { ...process.env, PR_BODY: body, GITHUB_OUTPUT: output },
					encoding: 'utf8',
				}
			);
			assert.equal(result.status, expectedCode);
			assert.match(readFileSync(output, 'utf8'), new RegExp(expectedOutput));
		}
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
