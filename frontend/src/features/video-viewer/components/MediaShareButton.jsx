import React, { useState } from 'react';
import PropTypes from 'prop-types';

import { Dialog, DialogContent, DialogTrigger } from '../../shared/components/Dialog/Dialog';
import { MediaShareEmbed } from './MediaShare/MediaShareEmbed';
import { MediaShareOptions } from './MediaShare/MediaShareOptions';
import { NavigationContentApp } from './MediaShare/NavigationContentApp';

import { Button } from '../../shared/components/Button/Button';
import { Icon } from '../../shared/components/Icon/Icon';
import { Text } from '../../shared/components/Text/Text';

function mediaSharePopupPages() {
	return {
		shareOptions: <MediaShareOptions />,
	};
}

function videoSharePopupPages(onTriggerPopupClose) {
	return {
		...mediaSharePopupPages(),
		shareEmbed: <MediaShareEmbed triggerPopupClose={onTriggerPopupClose} />,
	};
}

export function MediaShareButton({ isVideo }) {
	const [isOpen, setIsOpen] = useState(false);
	const [popupCurrentPage, setPopupCurrentPage] = useState('shareOptions');

	function onOpenChange(nextOpen) {
		setIsOpen(nextOpen);
		setPopupCurrentPage('shareOptions');
	}

	function triggerPopupClose() {
		onOpenChange(false);
	}

	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<div className="sm:hidden">
				<DialogTrigger>
					<Button
						aria-label="Share"
						variant="secondary"
						icon={<Icon name="shareMedia" className="text-cinemata-strait-blue-100" />}
						className="dark:bg-cinemata-strait-blue-900 body-body-14-medium whitespace-nowrap p-size-8"
						size="sm"
					/>
				</DialogTrigger>
			</div>
			<div className="hidden sm:block">
				<DialogTrigger>
					<Button
						aria-label="Share"
						variant="secondary"
						icon={<Icon name="shareMedia" className="text-cinemata-strait-blue-100" />}
						className="dark:bg-cinemata-strait-blue-900 body-body-14-medium whitespace-nowrap"
						size="sm"
					>
						<Text
							as="span"
							variant="body-14-medium"
							className="text-neutral-50 dark:text-cinemata-strait-blue-100 whitespace-nowrap"
						>
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
					pages={isVideo ? videoSharePopupPages(triggerPopupClose) : mediaSharePopupPages()}
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
