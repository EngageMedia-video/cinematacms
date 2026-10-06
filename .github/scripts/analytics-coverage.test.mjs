import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import test from 'node:test';
import { validateCoverage } from './analytics-coverage.mjs';

test('rejects a new event without a catalogue entry and a removed emitter', () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'analytics-coverage-'));
	try {
		for (const directory of [
			'frontend/src',
			'frontend/packages/media-player/src',
			'static/js',
			'cms',
			'files',
			'users',
			'templates',
			'tests',
		])
			fs.mkdirSync(path.join(root, directory), { recursive: true });
		const source = path.join(root, 'frontend/src/feature.js');
		fs.writeFileSync(source, "window.CinemataAnalytics?.track('saved');");
		fs.writeFileSync(path.join(root, 'tests/test_feature.py'), 'def test_saved(): pass');
		const catalogue = {
			features: [
				{
					id: 'save',
					events: ['saved'],
					trigger: 'confirmed save',
					privacy: 'count only',
					sources: [{ path: 'frontend/src/feature.js', contains: "track('saved')" }],
					tests: ['tests/test_feature.py'],
				},
			],
		};
		assert.deepEqual(validateCoverage(root, catalogue), []);
		fs.appendFileSync(source, "window.CinemataAnalytics?.track('new_feature');");
		assert.match(validateCoverage(root, catalogue).join('\n'), /Unregistered event new_feature/);
		fs.writeFileSync(source, 'export const feature = true;');
		assert.match(validateCoverage(root, catalogue).join('\n'), /Missing emitter/);
		fs.rmSync(path.join(root, 'tests/test_feature.py'));
		assert.match(validateCoverage(root, catalogue).join('\n'), /Missing verification/);
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});
