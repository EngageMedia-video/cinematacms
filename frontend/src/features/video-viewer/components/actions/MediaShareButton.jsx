import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';

import { Dialog, DialogContent, DialogTrigger } from '../../../shared/components/Dialog/Dialog';
import { MediaShareEmbed } from './media-share/MediaShareEmbed';
import { MediaShareOptions } from './media-share/MediaShareOptions';
import { NavigationContentApp } from './media-share/NavigationContentApp';

import { Button } from '../../../shared/components/Button/Button';
import { Icon } from '../../../shared/components/Icon/Icon';
import { Text } from '../../../shared/components/Text/Text';

function getCurrentVideoTimestamp() {
	const videoElem = document.querySelector('.viewer-container video');
	return videoElem?.currentTime ?? 0;
}

export function MediaShareButton({ isVideo }) {
	const [isOpen, setIsOpen] = useState(false);
	const [popupCurrentPage, setPopupCurrentPage] = useState('shareOptions');
	const [timestamp, setTimestamp] = useState(0);
	const [startAtSelected, setStartAtSelected] = useState(false);

	useEffect(() => {
		if (isOpen) {
			setTimestamp(getCurrentVideoTimestamp());
		} else {
			setStartAtSelected(false);
		}
	}, [isOpen]);

	function onOpenChange(nextOpen) {
		setIsOpen(nextOpen);
		setPopupCurrentPage('shareOptions');
	}

	function triggerPopupClose() {
		onOpenChange(false);
	}

	const sharedOptionsProps = {
		timestamp,
		startAtSelected,
		onToggleStartAt: () => setStartAtSelected((prev) => !prev),
	};
	const embedStartAt = startAtSelected ? timestamp : 0;

	const pages = isVideo
		? {
				shareOptions: <MediaShareOptions {...sharedOptionsProps} />,
				shareEmbed: <MediaShareEmbed triggerPopupClose={triggerPopupClose} startAt={embedStartAt} />,
			}
		: { shareOptions: <MediaShareOptions {...sharedOptionsProps} /> };

	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<div className="sm:hidden">
				<DialogTrigger>
					<Button
						aria-label="Share"
						variant="tertiary"
						icon={<Icon name="shareMedia" className="text-current" />}
						className="body-body-14-medium whitespace-nowrap p-size-8"
						size="sm"
					/>
				</DialogTrigger>
			</div>
			<div className="hidden sm:block">
				<DialogTrigger>
					<Button
						aria-label="Share"
						variant="tertiary"
						icon={<Icon name="shareMedia" className="text-current" />}
						className="body-body-14-medium whitespace-nowrap"
						size="sm"
					>
						<Text as="span" variant="body-14-medium" className="whitespace-nowrap text-current">
							Share
						</Text>
					</Button>
				</DialogTrigger>
			</div>

			<DialogContent
				aria-label="Share media"
				className="w-full max-w-[560px] rounded-ds-12 bg-bg-surface shadow-2xl"
			>
				<NavigationContentApp
					initPage={popupCurrentPage}
					pageChangeSelector=".change-page"
					pageIdSelectorAttr="data-page-id"
					pages={pages}
					focusFirstItemOnPageChange={false}
					pageChangeCallback={setPopupCurrentPage}
				/>
			</DialogContent>
		</Dialog>
	);
}

MediaShareButton.propTypes = {
	isVideo: PropTypes.bool.isRequired,
};
