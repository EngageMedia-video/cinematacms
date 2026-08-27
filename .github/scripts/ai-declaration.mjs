import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export const ASSISTED_LABEL = 'This contribution includes substantive AI assistance.';
export const UNASSISTED_LABEL = 'This contribution does not include substantive AI assistance.';

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isChecked(body, label) {
	const pattern = new RegExp(
		`^\\s*-\\s*\\[[xX]\\]\\s*${escapeRegExp(label)}\\s*$`,
		'm'
	);
	return pattern.test(body.replaceAll('\r\n', '\n'));
}

export function parseAiDeclaration(body = '') {
	const assisted = isChecked(body, ASSISTED_LABEL);
	const unassisted = isChecked(body, UNASSISTED_LABEL);
	const selected = Number(assisted) + Number(unassisted);

	if (selected === 0) {
		return {
			assisted: false,
			message: 'Select exactly one AI assistance declaration in the pull request body.',
			valid: false,
		};
	}

	if (selected === 2) {
		return {
			assisted: false,
			message: 'Clear one AI assistance declaration in the pull request body.',
			valid: false,
		};
	}

	return {
		assisted,
		message: assisted
			? 'Substantive AI assistance declared.'
			: 'No substantive AI assistance declared.',
		valid: true,
	};
}

function writeOutputs(result) {
	if (!process.env.GITHUB_OUTPUT) return;

	fs.appendFileSync(
		process.env.GITHUB_OUTPUT,
		`valid=${result.valid}\nassisted=${result.assisted}\nmessage=${result.message}\n`
	);
}

function main() {
	const result = parseAiDeclaration(process.env.PR_BODY);
	writeOutputs(result);
	console.log(result.message);
	if (!result.valid) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main();
}
