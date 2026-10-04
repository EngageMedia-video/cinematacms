import { Fragment } from 'react';
import { splitTextByLinks } from '../../utils/linkify';

const LINK_CLASSES =
	'rounded-ds-4 text-text-accent underline hover:text-text-link-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus transition-colors duration-200';

function renderPlainText(value) {
	return value;
}

// Renders user-supplied plain text with bare URLs as anchors. Every run stays a
// React child, so author markup is escaped before any link is added. Callers
// format the runs between links through `renderText`, which keeps timestamp or
// mention detection from matching inside a URL.
export function LinkifiedText({ text, allowTrailingLink = true, renderText = renderPlainText }) {
	return splitTextByLinks(text, { allowTrailingLink }).map((segment, index) => (
		<Fragment key={index}>
			{segment.type === 'link' ? (
				<a href={segment.href} rel="nofollow noopener" className={LINK_CLASSES}>
					{segment.text}
				</a>
			) : (
				renderText(segment.text)
			)}
		</Fragment>
	));
}
