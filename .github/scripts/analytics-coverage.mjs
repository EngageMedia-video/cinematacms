import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseAnalyticsDeclaration } from './analytics-declaration.mjs';

export function validateCoverage(root, catalogue) {
	const errors = [];
	const known = new Set();
	for (const feature of catalogue.features) {
		if (!feature.id || !feature.trigger || !feature.privacy || !feature.tests?.length || !feature.sources?.length)
			errors.push(`Incomplete contract: ${feature.id}`);
		for (const event of feature.events) {
			if (!/^[a-z][a-z0-9_]{0,49}$/.test(event)) errors.push(`Invalid event: ${event}`);
			known.add(event);
		}
		for (const source of feature.sources) {
			const file = path.join(root, source.path);
			if (!fs.existsSync(file) || !fs.readFileSync(file, 'utf8').includes(source.contains))
				errors.push(`Missing emitter: ${feature.id} in ${source.path}`);
		}
		for (const test of feature.tests) {
			if (!fs.existsSync(path.join(root, test)) || !/test|\.spec\./.test(test))
				errors.push(`Missing verification: ${feature.id} in ${test}`);
		}
	}
	function scan(directory) {
		for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
			const file = path.join(directory, item.name);
			if (item.isDirectory()) {
				if (!['node_modules', 'dist', 'lib', '__pycache__'].includes(item.name)) scan(file);
			} else if (
				/\.(js|jsx|py|html)$/.test(file) &&
				!/(^|\/)tests?\/|\btest_|\.(test|spec|stories)\./.test(path.relative(root, file))
			) {
				const source = fs.readFileSync(file, 'utf8');
				const patterns = [
					/(?:\.track|\bsend)\(\s*['"]([a-z][a-z0-9_]*)['"]/g,
					/data-analytics-action=['"]([a-z][a-z0-9_]*)['"]/g,
					/(?:queue_action|action_events)\(request,\s*['"]([a-z][a-z0-9_]*)['"]/g,
				];
				for (const pattern of patterns)
					for (const match of source.matchAll(pattern)) {
						if (!known.has(match[1]))
							errors.push(`Unregistered event ${match[1]} in ${path.relative(root, file)}`);
					}
			}
		}
	}
	for (const directory of [
		'frontend/src',
		'frontend/packages/media-player/src',
		'static/js',
		'cms',
		'files',
		'users',
		'templates',
	])
		scan(path.join(root, directory));
	return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const root = fileURLToPath(new URL('../../', import.meta.url));
	const catalogue = JSON.parse(fs.readFileSync(path.join(root, 'docs/technical/analytics-coverage.json'), 'utf8'));
	const errors = validateCoverage(root, catalogue);
	if (process.env.PR_BODY) {
		const declaration = parseAnalyticsDeclaration(process.env.PR_BODY);
		if (!declaration.valid) errors.push(declaration.message);
		for (const id of declaration.coverage || [])
			if (!catalogue.features.some((feature) => feature.id === id)) errors.push(`Unknown coverage entry: ${id}`);
	}
	if (errors.length) {
		console.error(errors.join('\n'));
		process.exitCode = 1;
	} else console.log(`Analytics coverage contract verified: ${catalogue.features.length} features.`);
}
