import React, { useRef, useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';

import { usePopup } from '../hooks/usePopup';
import { PopupMain } from '../Popup';
import { formatManagementTableDate } from '../../../functions/formatManagementTableDate.js';
import PageStore from '../../../pages/_PageStore.js';

function ManageItemTitle(props) {
	if (props.title && props.url) {
		return (
			<a href={props.url} title={props.title}>
				{props.title}
			</a>
		);
	}
	if (props.title) {
		return props.title;
	}
	if (props.url) {
		return props.url;
	}
	return <i className="non-available">N/A</i>;
}

function ManageItemDate(props) {
	if (props.date) {
		return formatManagementTableDate(new Date(Date.parse(props.date)));
	}
	return <i className="non-available">N/A</i>;
}

function ManageUploadItemActions(props) {
	const [popupContentRef, PopupContent, PopupTrigger] = usePopup();
	const [isOpenPopup, setIsOpenPopup] = useState(false);

	function onPopupShow() {
		setIsOpenPopup(true);
	}

	function onPopupHide() {
		setIsOpenPopup(false);
	}

	function onCancel() {
		popupContentRef.current.tryToHide();
	}

	function onProceed() {
		popupContentRef.current.tryToHide();
		if ('function' === typeof props.onProceed) {
			props.onProceed();
		}
	}

	const positionState = { updating: false, pending: 0 };

	const onWindowResize = useCallback(function () {
		if (positionState.updating) {
			positionState.pending = positionState.pending + 1;
		} else {
			positionState.updating = true;

			if (!props.containerRef.current) {
				positionState.updating = false;
				return;
			}

			const popupElem = props.containerRef.current.querySelector('.popup');

			if (popupElem) {
				const containerClientRect = props.containerRef.current.getBoundingClientRect();
				popupElem.style.position = 'fixed';
				popupElem.style.left = containerClientRect.x + 'px';

				if (
					document.body.offsetHeight <
					32 + popupElem.offsetHeight + window.scrollY + containerClientRect.top
				) {
					popupElem.style.top = containerClientRect.y - popupElem.offsetHeight + 'px';
				} else {
					popupElem.style.top = containerClientRect.y + containerClientRect.height + 'px';
				}
			}

			setTimeout(() => {
				positionState.updating = false;
				if (positionState.pending) {
					positionState.pending = 0;
					onWindowResize();
				}
			}, 8);
		}
	}, []);

	useEffect(() => {
		if (isOpenPopup) {
			PageStore.on('window_scroll', onWindowResize);
			PageStore.on('window_resize', onWindowResize);
			onWindowResize();
		} else {
			PageStore.removeListener('window_scroll', onWindowResize);
			PageStore.removeListener('window_resize', onWindowResize);
		}

		return () => {
			PageStore.removeListener('window_scroll', onWindowResize);
			PageStore.removeListener('window_resize', onWindowResize);
		};
	}, [isOpenPopup]);

	return (
		<div ref={props.containerRef} className="actions">
			<PopupTrigger contentRef={popupContentRef}>
				<button title={'Delete' + (props.title ? ' "' + props.title + '"' : '')}>Delete</button>
			</PopupTrigger>
			<PopupContent contentRef={popupContentRef} showCallback={onPopupShow} hideCallback={onPopupHide}>
				<PopupMain>
					<div className="popup-message">
						<span className="popup-message-title">Media removal</span>
						<span className="popup-message-main">
							{"You're willing to remove media" + (props.title ? ' "' + props.title + '"' : '')}?
						</span>
					</div>
					<hr />
					<span className="popup-message-bottom">
						<button className="button-link cancel-profile-removal" onClick={onCancel}>
							CANCEL
						</button>
						<button className="button-link proceed-profile-removal" onClick={onProceed}>
							PROCEED
						</button>
					</span>
				</PopupMain>
			</PopupContent>
		</div>
	);
}

export function ManageUploadItem(props) {
	const actionsContainerRef = useRef(null);
	const [selected, setSelected] = useState(false);

	function onRowCheck() {
		setSelected(!selected);
	}

	function onClickProceed() {
		if ('function' === typeof props.onProceedRemoval) {
			props.onProceedRemoval(props.token);
		}
	}

	useEffect(() => {
		if ('function' === typeof props.onCheckRow) {
			props.onCheckRow(props.token, selected);
		}
	}, [selected]);

	useEffect(() => {
		setSelected(props.selectedRow);
	}, [props.selectedRow]);

	return (
		<div className="item manage-item manage-upload-item">
			<div className="mi-checkbox">
				<input type="checkbox" checked={selected} onChange={onRowCheck} />
			</div>
			<div className="mi-title">
				<ManageItemTitle title={props.title} url={props.url} />
				{props.hideDeleteAction ? null : (
					<ManageUploadItemActions
						containerRef={actionsContainerRef}
						title={props.title}
						onProceed={onClickProceed}
					/>
				)}
			</div>
			<div className="mi-added">
				<ManageItemDate date={props.add_date} />
			</div>
			<div className="mi-type">
				{props.media_type !== undefined ? props.media_type : <i className="non-available">N/A</i>}
			</div>
			<div className="mi-encoding">
				{props.encoding_status !== undefined ? props.encoding_status : <i className="non-available">N/A</i>}
			</div>
			<div className="mi-state">
				{props.state !== undefined ? props.state : <i className="non-available">N/A</i>}
			</div>
			<div className="mi-views">
				{props.views !== undefined ? props.views : <i className="non-available">N/A</i>}
			</div>
			<div className="mi-likes">
				{props.likes !== undefined ? props.likes : <i className="non-available">N/A</i>}
			</div>
		</div>
	);
}

ManageUploadItem.propTypes = {
	token: PropTypes.string,
	title: PropTypes.string,
	url: PropTypes.string,
	add_date: PropTypes.string,
	media_type: PropTypes.string,
	encoding_status: PropTypes.string,
	state: PropTypes.string,
	views: PropTypes.number,
	likes: PropTypes.number,
	onCheckRow: PropTypes.func,
	selectedRow: PropTypes.bool.isRequired,
	hideDeleteAction: PropTypes.bool.isRequired,
};
