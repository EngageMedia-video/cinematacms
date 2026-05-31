const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

function trimTrailingZeroes(value) {
	return value.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
}

export function formatBytes(bytes, { decimals = 1 } = {}) {
	if (bytes === null || bytes === undefined || bytes === '') return null;
	const value = Number(bytes);
	if (!Number.isFinite(value) || value < 0) return null;
	if (value === 0) return '0 B';

	const unitIndex = Math.min(Math.floor(Math.log(value) / Math.log(1024)), UNITS.length - 1);
	const unitValue = value / 1024 ** unitIndex;

	if (unitIndex === 0) {
		return `${Math.round(unitValue)} ${UNITS[unitIndex]}`;
	}

	const precision = Math.max(0, decimals);
	return `${trimTrailingZeroes(unitValue.toFixed(precision))} ${UNITS[unitIndex]}`;
}
