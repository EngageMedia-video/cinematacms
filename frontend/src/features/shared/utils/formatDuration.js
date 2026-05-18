export function formatDuration(seconds) {
	if (seconds === null || seconds === undefined || seconds === '') return '';
	const totalSeconds = Number(seconds);
	if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '';

	const roundedSeconds = Math.floor(totalSeconds);
	const h = Math.floor(roundedSeconds / 3600);
	const m = Math.floor((roundedSeconds % 3600) / 60);
	const s = roundedSeconds % 60;
	if (h > 0) {
		return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
	}
	return `${m}:${String(s).padStart(2, '0')}`;
}
