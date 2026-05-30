const PALETTE = [
	['var(--bg-secondary)', 'var(--bg-primary)'],
	['var(--bg-primary)', 'var(--bg-secondary)'],
	['var(--bg-warning)', 'var(--bg-secondary)'],
	['var(--bg-success)', 'var(--bg-primary)'],
	['var(--bg-secondary-hover)', 'var(--bg-danger)'],
	['var(--bg-primary-hover)', 'var(--bg-secondary-hover)'],
];

export function gradientForName(name) {
	const seed = String(name || '?');
	let h = 0;
	for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
	const [from, to] = PALETTE[h % PALETTE.length];
	return { from, to };
}

export function initialFor(name) {
	const t = String(name || '').trim();
	return t ? t.charAt(0).toUpperCase() : '?';
}
