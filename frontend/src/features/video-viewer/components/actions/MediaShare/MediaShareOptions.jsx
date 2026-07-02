import React, { useContext, useEffect, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';

import ShareOptionsContext from '../../../../../static/js/contexts/ShareOptionsContext';

import * as PageActions from '../../../../../static/js/pages/_PageActions.js';
import MediaPageStore from '../../../../../static/js/pages/MediaPage/store.js';
import * as MediaPageActions from '../../../../../static/js/pages/MediaPage/actions.js';

import { Button } from '../../../../shared/components/Button/Button';
import { CheckboxButton } from '../../../../shared/components/CheckboxButton/CheckboxButton';
import { Icon } from '../../../../shared/components/Icon/Icon';
import { Text } from '../../../../shared/components/Text/Text';
import { cn } from '../../../../shared/utils/classNames';

const SHARE_OPTION_META = {
	embed: { title: 'Embed', icon: 'embedLink', bgColor: '#dadce0', iconColor: '#3c4043' },
	email: {
		title: 'Email',
		icon: 'email',
		bgColor: '#7d7d7d',
		iconColor: '#ffffff',
		urlFor: (url) => `mailto:?body=${url}`,
	},
	fb: {
		title: 'Facebook',
		icon: 'facebook',
		bgColor: '#3b5998',
		iconColor: '#ffffff',
		urlFor: (url) => `https://www.facebook.com/sharer.php?u=${url}`,
	},
	tw: {
		title: 'X',
		icon: 'x',
		bgColor: '#000000',
		iconColor: '#ffffff',
		urlFor: (url) => `https://twitter.com/intent/tweet?url=${url}`,
	},
	reddit: {
		title: 'Reddit',
		icon: 'reddit',
		bgColor: '#ff4500',
		iconColor: '#ffffff',
		urlFor: (url, title) => `https://reddit.com/submit?url=${url}&title=${title}`,
	},
	tumblr: {
		title: 'Tumblr',
		icon: 'tumblr',
		bgColor: '#35465c',
		iconColor: '#ffffff',
		urlFor: (url, title) => `https://www.tumblr.com/widgets/share/tool?canonicalUrl=${url}&title=${title}`,
	},
	pinterest: {
		title: 'Pinterest',
		icon: 'pinterest',
		bgColor: '#e60023',
		iconColor: '#ffffff',
		urlFor: (url) => `http://pinterest.com/pin/create/link/?url=${url}`,
	},
	vk: {
		title: 'ВКонтакте',
		icon: 'shareMedia',
		bgColor: '#4a76a8',
		iconColor: '#ffffff',
		urlFor: (url, title) => `http://vk.com/share.php?url=${url}&title=${title}`,
	},
	linkedin: {
		title: 'LinkedIn',
		icon: 'linkedIn',
		bgColor: '#0a66c2',
		iconColor: '#ffffff',
		urlFor: (url) => `https://www.linkedin.com/shareArticle?mini=true&url=${url}`,
	},
	mix: {
		title: 'Mix',
		icon: 'shareMedia',
		bgColor: '#ff8226',
		iconColor: '#ffffff',
		urlFor: (url) => `https://mix.com/add?url=${url}`,
	},
	whatsapp: {
		title: 'WhatsApp',
		icon: 'whatsapp',
		bgColor: '#25d366',
		iconColor: '#ffffff',
		urlFor: (url) => `whatsapp://send?text=${url}`,
	},
	telegram: {
		title: 'Telegram',
		icon: 'telegram',
		bgColor: '#0088cc',
		iconColor: '#ffffff',
		urlFor: (url, title) => `https://t.me/share/url?url=${url}&text=${title}`,
	},
};

function buildShareOptions(socialMedia, shareUrl) {
	const mediaTitle = MediaPageStore.get('media-data').title;
	const mediaType = MediaPageStore.get('media-data').media_type;
	const encodedUrl = encodeURIComponent(shareUrl || '');
	const encodedTitle = encodeURIComponent(mediaTitle || '');

	const result = [];
	for (const key of socialMedia) {
		const meta = SHARE_OPTION_META[key];
		if (!meta) continue;
		if (key === 'embed') {
			if (mediaType !== 'video') continue;
			result.push({ key, ...meta });
			continue;
		}
		result.push({ key, ...meta, shareUrl: meta.urlFor(encodedUrl, encodedTitle) });
	}
	return result;
}

function toHHMMSS(timeInt) {
	const total = parseInt(timeInt, 10) || 0;
	const h = Math.floor(total / 3600);
	const m = Math.floor((total - h * 3600) / 60);
	const s = total - h * 3600 - m * 60;
	const pad = (n) => String(n).padStart(2, '0');
	return h >= 1 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

const SHARE_TILE_CLASSES =
	'group inline-flex shrink-0 cursor-pointer flex-col items-center gap-size-8 border-none bg-transparent p-0 outline-none transition-opacity hover:opacity-80 focus:outline-none focus-visible:outline-none';

function ShareTile({ icon, label, bgColor, iconColor, href, target, dataPageId, className = '' }) {
	const inner = (
		<>
			<span
				className="flex h-[56px] w-[56px] items-center justify-center rounded-full [&_svg_path]:fill-current [&_svg_path]:stroke-current"
				style={{ backgroundColor: bgColor, color: iconColor }}
			>
				<Icon name={icon} size={24} decorative />
			</span>

			<Text as="span" variant="body-12-regular" className="text-text-strong">
				{label}
			</Text>
		</>
	);

	if (href) {
		return (
			<a
				href={href}
				target={target}
				rel={target === '_blank' ? 'noopener noreferrer' : undefined}
				className={cn(SHARE_TILE_CLASSES, 'no-underline', className)}
			>
				{inner}
			</a>
		);
	}

	return (
		<button
			type="button"
			className={cn(SHARE_TILE_CLASSES, dataPageId ? 'change-page' : '', className)}
			data-page-id={dataPageId}
		>
			{inner}
		</button>
	);
}

export function MediaShareOptions({ timestamp = 0, startAtSelected = false, onToggleStartAt }) {
	const containerRef = useRef(null);
	const inputRef = useRef(null);
	const mediaUrl = MediaPageStore.get('media-url');
	const socialMedia = useContext(ShareOptionsContext);
	const formattedTimestamp = toHHMMSS(timestamp);

	const shareMediaLink = startAtSelected ? `${mediaUrl}&t=${Math.trunc(timestamp)}` : mediaUrl;
	const shareOptions = useMemo(() => buildShareOptions(socialMedia, shareMediaLink), [socialMedia, shareMediaLink]);

	function onClickCopy() {
		if (inputRef.current) {
			MediaPageActions.copyShareLink(inputRef.current);
		}
	}

	function onCompleteCopy() {
		PageActions.addNotification('Link copied to clipboard', 'clipboardLinkCopy');
	}

	useEffect(() => {
		MediaPageStore.on('copied_media_link', onCompleteCopy);
		return () => {
			MediaPageStore.removeListener('copied_media_link', onCompleteCopy);
		};
	}, []);

	return (
		<div ref={containerRef} className="flex w-full flex-col gap-size-16 py-size-20 px-size-24">
			<Text as="h2" variant="body-16-bold" className="text-text-strong">
				Share media
			</Text>

			{shareOptions.length > 0 && (
				<div className="thin-scrollbar mx-size-4 flex flex-nowrap items-start gap-size-16 overflow-x-auto px-size-4 pb-size-4">
					{shareOptions.map((opt) =>
						opt.key === 'embed' ? (
							<ShareTile
								key={opt.key}
								icon={opt.icon}
								label={opt.title}
								bgColor={opt.bgColor}
								iconColor={opt.iconColor}
								dataPageId="shareEmbed"
							/>
						) : (
							<ShareTile
								key={opt.key}
								icon={opt.icon}
								label={opt.title}
								bgColor={opt.bgColor}
								iconColor={opt.iconColor}
								href={opt.shareUrl}
								target="_blank"
							/>
						)
					)}
				</div>
			)}

			<div className="flex items-stretch gap-size-8 rounded-ds-8 border border-border-strong-constant bg-bg-surface p-size-4">
				<input
					ref={inputRef}
					type="text"
					readOnly
					value={shareMediaLink}
					className="body-body-14-regular w-full min-w-0 flex-1 border-none bg-transparent px-size-8 text-text-strong outline-none focus:outline-none focus:ring-0"
				/>
				<Button type="button" variant="primary" size="sm" onClick={onClickCopy}>
					Copy
				</Button>
			</div>

			<CheckboxButton checked={startAtSelected} onChange={onToggleStartAt}>
				Start at {formattedTimestamp}
			</CheckboxButton>
		</div>
	);
}

MediaShareOptions.propTypes = {
	timestamp: PropTypes.number,
	startAtSelected: PropTypes.bool,
	onToggleStartAt: PropTypes.func,
};
