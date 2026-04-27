function log(...x) {
	console[x[0]](...x.slice(1));
}

export function warn(...x) {
	log('warn', ...x);
}

export function error(...x) {
	log('error', ...x);
}
