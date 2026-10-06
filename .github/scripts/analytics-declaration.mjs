import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const EVENT_NAME = /^[a-z][a-z0-9_]{0,49}$/;

function field(lines, name) {
	const prefix = `${name}:`;
	const line = lines.find((item) => item.trimStart().startsWith(prefix));
	return line?.trimStart().slice(prefix.length).trim() || '';
}

export function parseAnalyticsDeclaration(body = '') {
	const lines = body.replaceAll('\r\n', '\n').split('\n');
	const start = lines.findIndex((line) => /^\s*##\s+Analytics\s*$/i.test(line));
	if (start < 0) return { valid: false, message: 'Add the Analytics section from the pull request template.' };

	const nextHeading = lines.findIndex((line, index) => index > start && /^\s*##\s+/.test(line));
	const section = lines.slice(start + 1, nextHeading < 0 ? undefined : nextHeading).join('\n');
	const content = section.replace(/<!--[\s\S]*?-->/g, '').split('\n');
	const events = content.some((line) => /^\s*-\s*\[[xX]\]\s*Events added or updated\.\s*$/.test(line));
	const notApplicable = content.some((line) => /^\s*-\s*\[[xX]\]\s*Not applicable\.\s*$/.test(line));
	if (events === notApplicable) {
		return { valid: false, message: 'Select exactly one Analytics option in the pull request.' };
	}

	if (notApplicable) {
		return field(content, 'Reason')
			? { valid: true, message: 'Analytics exception explained.' }
			: { valid: false, message: 'Explain why Analytics is not applicable.' };
	}

	const names = field(content, 'Events')
		.split(',')
		.map((name) => name.trim());
	if (!names.length || names.some((name) => !EVENT_NAME.test(name))) {
		return { valid: false, message: 'List fixed snake_case event names in Events, separated by commas.' };
	}
	if (!field(content, 'Trigger') || !field(content, 'Verification') || !field(content, 'Coverage')) {
		return { valid: false, message: 'Describe the event Trigger, Verification and coverage catalogue entry IDs.' };
	}
	const coverage = field(content, 'Coverage')
		.split(',')
		.map((id) => id.trim());
	if (coverage.some((id) => !/^[a-z][a-z0-9-]*$/.test(id)))
		return { valid: false, message: 'List coverage entry IDs separated by commas.' };
	return { valid: true, message: 'Analytics events documented.', coverage };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const result = parseAnalyticsDeclaration(process.env.PR_BODY);
	if (process.env.GITHUB_OUTPUT) {
		fs.appendFileSync(process.env.GITHUB_OUTPUT, `valid=${result.valid}\nmessage=${result.message}\n`);
	}
	console.log(result.message);
	if (!result.valid) process.exitCode = 1;
}
