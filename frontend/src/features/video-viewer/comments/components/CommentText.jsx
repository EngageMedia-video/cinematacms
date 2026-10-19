import { LinkifiedText } from '../../../shared/components/LinkifiedText';
import { splitTextByTimestamps } from '../utils/timestamp';
import { seekPlayerTo } from '../utils/videoPlayer';
import { mentionProfileHref, splitTextByMentions } from '../utils/mentions';

function buildSeekHref(seconds) {
	if (typeof window === 'undefined') return `?t=${seconds}`;
	const url = new URL(window.location.href);
	url.searchParams.set('t', String(seconds));
	return url.pathname + url.search;
}

function renderTimestamps(text) {
	return splitTextByTimestamps(text).map((seg, segIdx) =>
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
	);
}

// Mentions are split out first because a handle may contain "www.", and a
// mention never starts inside a URL since it needs whitespace before "@". URLs
// are split before timestamps so "?t=1:30" stays part of the link.
export function CommentText({ text }) {
	if (!text) return null;
	const lines = String(text).split('\n');

	return (
		<>
			{lines.map((line, lineIdx) => (
				<span key={lineIdx} className="whitespace-pre-wrap break-words">
					{splitTextByMentions(line).map((part, partIdx) =>
						part.type === 'mention' ? (
							<a
								key={partIdx}
								href={mentionProfileHref(part.handle)}
								className="font-medium text-text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus rounded-sm"
							>
								{part.value}
							</a>
						) : (
							<LinkifiedText key={partIdx} text={part.value} renderText={renderTimestamps} />
						)
					)}
					{lineIdx < lines.length - 1 ? '\n' : null}
				</span>
			))}
		</>
	);
}
