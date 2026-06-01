export const TIMESTAMP_REGEX = /(?:(\d{1,2}):)?(\d{1,2}):(\d{2})/;

export function parseTimestamp(value) {
	const match = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})$/.exec(String(value).trim());
	if (!match) return null;
	const h = match[1] ? Number(match[1]) : 0;
	const m = Number(match[2]);
	const s = Number(match[3]);
	if (Number.isNaN(h) || Number.isNaN(m) || Number.isNaN(s)) return null;
	if (m > 59 || s > 59) return null;
	return h * 3600 + m * 60 + s;
}

export function formatTimestamp(totalSeconds) {
	const n = Math.max(0, Math.floor(Number(totalSeconds) || 0));
	const h = Math.floor(n / 3600);
	const m = Math.floor((n % 3600) / 60);
	const s = n % 60;
	const pad = (v) => String(v).padStart(2, '0');
	return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function splitTextByTimestamps(text) {
	if (!text) return [];
	const segments = [];
	let lastIndex = 0;
	const re = new RegExp(TIMESTAMP_REGEX.source, 'g');
	let m;
	while ((m = re.exec(text)) !== null) {
		const seconds = parseTimestamp(m[0]);
		if (seconds === null) continue;
		if (m.index > lastIndex) {
			segments.push({ type: 'text', value: text.slice(lastIndex, m.index) });
		}
		segments.push({ type: 'timestamp', value: m[0], seconds });
		lastIndex = m.index + m[0].length;
	}
	if (lastIndex < text.length) {
		segments.push({ type: 'text', value: text.slice(lastIndex) });
	}
	return segments;
}
