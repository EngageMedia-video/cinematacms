import { splitTextByTimestamps } from '../utils/timestamp';
import { seekPlayerTo } from '../utils/videoPlayer';

function buildSeekHref(seconds) {
	if (typeof window === 'undefined') return `?t=${seconds}`;
	const url = new URL(window.location.href);
	url.searchParams.set('t', String(seconds));
	return url.pathname + url.search;
}

export function CommentText({ text }) {
	if (!text) return null;
	const lines = String(text).split('\n');

	return (
		<>
			{lines.map((line, lineIdx) => (
				<span key={lineIdx} className="whitespace-pre-wrap break-words">
					{splitTextByTimestamps(line).map((seg, segIdx) =>
						seg.type === 'timestamp' ? (
							<a
								key={segIdx}
								href={buildSeekHref(seg.seconds)}
								className="font-medium text-text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus rounded-sm"
								onClick={(event) => {
									if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
									const seeked = seekPlayerTo(seg.seconds);
									if (!seeked) return;
									event.preventDefault();
									if (typeof window !== 'undefined' && window.history?.replaceState) {
										window.history.replaceState({}, '', buildSeekHref(seg.seconds));
									}
								}}
							>
								{seg.value}
							</a>
						) : (
							<span key={segIdx}>{seg.value}</span>
						)
					)}
					{lineIdx < lines.length - 1 ? '\n' : null}
				</span>
			))}
		</>
	);
}
