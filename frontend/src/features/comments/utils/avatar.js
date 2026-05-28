const PALETTE = [
	['#98e3ff', '#3e6cc2'],
	['#98a7ff', '#a73ec2'],
	['#ff98b7', '#c23e6a'],
	['#ffd698', '#c27e3e'],
	['#98ffc1', '#3ec27e'],
	['#c198ff', '#6c3ec2'],
	['#ffc198', '#c2553e'],
	['#98ffea', '#3ec2a7'],
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
