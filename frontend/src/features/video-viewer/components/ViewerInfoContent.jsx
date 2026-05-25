import React, { useContext, useRef, useState, useEffect } from 'react';
import DOMPurify from 'dompurify';

import { usePopup } from '../../../static/js/components/-NEW-/hooks/usePopup';

import { UserConsumer } from '../../../static/js/contexts/UserContext';
import SiteContext from '../../../static/js/contexts/SiteContext';

import PageStore from '../../../static/js/pages/_PageStore';
import * as PageActions from '../../../static/js/pages/_PageActions';
import MediaPageStore from '../../../static/js/pages/MediaPage/store.js';
import * as MediaPageActions from '../../../static/js/pages/MediaPage/actions.js';

import { RatingSystem } from '../../../static/js/components/RatingSystem/RatingSystem';
import { PopupMain } from '../../../static/js/components/-NEW-/Popup';
import { UserRoleBadge } from '../../shared/components/UserRoleBadge';
import { formatInnerLink } from '../../../static/js/functions/formatInnerLink';
import { TabContent, TabView } from '../../shared/components/TabView/TabView.jsx';
import { Text } from '../../shared/components/Text/Text.jsx';
import { Avatar } from '../../shared/components/Avatar/Avatar.jsx';

function metafield(arr) {
	let i;
	let sep;
	let ret = [];

	if (arr && arr.length) {
		i = 0;
		sep = 1 < arr.length ? ', ' : '';
		while (i < arr.length) {
			let separator = '';
			if (i < arr.length - 1) {
				separator = sep;
			}
			ret[i] = (
				<div key={i}>
					<a href={arr[i].url} title={arr[i].title}>
						{arr[i].title}
					</a>
					{separator}
				</div>
			);
			i += 1;
		}
	}

	return ret;
}

function MediaAuthorBanner(props) {
	return (
		<div className="flex flex-row gap-4 items-center">
			<a href={props.link || null} title={props.name}>
				<Avatar src={props.thumb} name={props.name || 'User'} size="large" style={{ width: 40, height: 40 }} />
			</a>
			<div className="flex flex-col justify-center gap-size-6">
				<Text as="a" variant="body-16-medium" href={props.link} title={props.name} className="no-underline">
					<span>{props.name}</span>
				</Text>

				<UserRoleBadge isManager={props.isManager} isTrusted={props.isTrusted} />
			</div>
		</div>
	);
}

function MediaMetaField(props) {
	return (
		<div className="media-content-languages">
			<div className="media-content-field">
				<div className="media-content-field-label">
					<h4>{props.title}</h4>
				</div>
				<div className="media-content-field-content">{props.value}</div>
			</div>
		</div>
	);
}

function EditMediaButton(props) {
	return (
		<a href={props.link} rel="nofollow" title="Edit media" className="edit-media">
			EDIT MEDIA
		</a>
	);
}

function EditSubtitleButton(props) {
	return (
		<a href={props.link} rel="nofollow" title="Edit subtitle" className="edit-subtitle">
			EDIT SUBTITLE
		</a>
	);
}

export default function ViewerInfoContent(props) {
	const description = props.description.trim();
	const site = useContext(SiteContext);
	const productionCompanyContent = MediaPageStore.get('media-production-company');
	const websiteContent = MediaPageStore.get('media-website');
	const licenseContent = MediaPageStore.get('media-license-info');
	const languagesContent = metafield(MediaPageStore.get('media-languages'));
	const topicsContent = metafield(MediaPageStore.get('media-topics'));
	const tagsContent = (() => {
		if (
			!PageStore.get('config-enabled').taxonomies.tags ||
			PageStore.get('config-enabled').taxonomies.tags.enabled
		) {
			return metafield(MediaPageStore.get('media-tags'));
		}
		return [];
	})();
	const categoriesContent = (() => {
		if (PageStore.get('config-options').pages.media.categoriesWithTitle) {
			return [];
		}
		if (
			!PageStore.get('config-enabled').taxonomies.categories ||
			PageStore.get('config-enabled').taxonomies.categories.enabled
		) {
			return metafield(MediaPageStore.get('media-categories'));
		}
		return [];
	})();

	let summary = MediaPageStore.get('media-summary');

	summary = summary ? summary.trim() : '';

	const [popupContentRef, PopupContent, PopupTrigger] = usePopup();

	const [hasSummary, setHasSummary] = useState('' !== summary);
	const [isContentVisible, setIsContentVisible] = useState('' == summary);

	function proceedMediaRemoval() {
		MediaPageActions.removeMedia();
		popupContentRef.current.toggle();
	}

	function cancelMediaRemoval() {
		popupContentRef.current.toggle();
	}

	function onMediaDelete(mediaId) {
		PageActions.addNotification('Media removed. Redirecting...', 'mediaDelete');

		setTimeout(function () {
			const mediaData = MediaPageStore.get('media-data');
			const authorProfile = mediaData?.author_profile ?? '';
			window.location.href = site.url + '/' + authorProfile.replace(/^\//g, '');
		}, 2000);

		if (void 0 !== mediaId) {
			console.info("Removed media '" + mediaId + '"');
		}
	}

	function onMediaDeleteFail(mediaId) {
		PageActions.addNotification('Media removal failed', 'mediaDeleteFail');

		if (void 0 !== mediaId) {
			console.info('Media "' + mediaId + '"' + ' removal failed');
		}
	}

	function onClickLoadMore() {
		setIsContentVisible(!isContentVisible);
	}

	useEffect(() => {
		MediaPageStore.on('media_delete', onMediaDelete);
		MediaPageStore.on('media_delete_fail', onMediaDeleteFail);
		return () => {
			MediaPageStore.removeListener('media_delete', onMediaDelete);
			MediaPageStore.removeListener('media_delete_fail', onMediaDeleteFail);
		};
	}, []);

	const authorLink = formatInnerLink(props.author.url, site.url);
	const authorThumb = formatInnerLink(props.author.thumb, site.url);

	function setTimestampAnchors(text) {
		function wrapTimestampWithAnchor(match, string) {
			let split = match.split(':'),
				s = 0,
				m = 1;
			let searchParameters = new URLSearchParams(window.location.search);

			while (split.length > 0) {
				s += m * parseInt(split.pop(), 10);
				m *= 60;
			}
			searchParameters.set('t', s);

			const wrapped =
				'<a href="' +
				MediaPageStore.get('media-url').split('?')[0] +
				'?' +
				searchParameters +
				'">' +
				match +
				'</a>';
			return wrapped;
		}

		const timeRegex = new RegExp('((\\d)?\\d:)?(\\d)?\\d:\\d\\d', 'g');
		return text.replace(timeRegex, wrapTimestampWithAnchor);
	}

	let ratings_info = MediaPageStore.get('media-data').ratings_info;

	if (void 0 === ratings_info || !ratings_info.length) {
		ratings_info = null;
	}

	let licenseTitle;
	if (null !== licenseContent && '' !== licenseContent) {
		licenseTitle = 'License';
	} else {
		licenseTitle = 'Copyright';
	}

	let licenseValue;
	if (null !== licenseContent && '' !== licenseContent) {
		licenseValue = (
			<a
				href={licenseContent.url}
				title={licenseContent.title}
				className="media-license-link"
				target="_blank"
				rel="nofollow"
			>
				<span>
					<img src={licenseContent.thumbnail} alt="" />
				</span>
				<span>{licenseContent.title}</span>
			</a>
		);
	} else {
		licenseValue = <span>All rights reserved.</span>;
	}

	return (
		<UserConsumer>
			{(user) => (
				<div className="media-info-content py-8">
					<TabView
						tabMode="wrap"
						listClassName="rounded-none rounded-tl-ds-8 rounded-tr-ds-8"
						triggerClassName="rounded-none py-3 px-size-22"
						panelClassName="mt-0 p-0 bg-bg-surface rounded-b-ds-8"
					>
						<TabContent title="ABOUT THE FILM & MAKER">
							<div className="p-4">
								{(void 0 === PageStore.get('config-media-item').displayAuthor ||
									null === PageStore.get('config-media-item').displayAuthor ||
									!!PageStore.get('config-media-item').displayAuthor) && (
									<>
										<div>
											<MediaAuthorBanner
												link={authorLink}
												thumb={authorThumb}
												name={props.author.name}
												published={props.published}
												isManager={props.author.isManager}
												isTrusted={props.author.isTrusted}
											/>
										</div>

										<div className="border-b border-b-cinemata-pacific-deep-600p mt-6" />
									</>
								)}

								{hasSummary && (
									<>
										<div className="media-content-summary mt-6 flex flex-col gap-3">
											<Text variant="h6-medium" className="m-0">
												Log Line / Synopsis
											</Text>
											<Text variant="body-16" className="m-0">
												{summary}
											</Text>
										</div>
										<div className="border-b border-b-cinemata-pacific-deep-600p mt-6" />
									</>
								)}

								{languagesContent.length && (
									<div className="mt-6">
										<MediaMetaField
											value={languagesContent}
											title={1 < languagesContent.length ? 'Languages' : 'Language'}
										/>
									</div>
								)}

								{MediaPageStore.get('display-media-license-info') && (
									<MediaMetaField value={licenseValue} title={licenseTitle} />
								)}
							</div>
						</TabContent>
						<TabContent title="COMMUNITY IMPACT">Test</TabContent>
					</TabView>

					<div
						className={
							'media-content-banner' +
							(null !== productionCompanyContent && '' !== productionCompanyContent
								? ' large-fields-title'
								: '')
						}
					>
						<div className="media-content-banner-inner">
							{hasSummary && <div className="media-content-summary">{summary}</div>}

							{(!hasSummary || isContentVisible) &&
								description &&
								(PageStore.get('config-options').pages.media.htmlInDescription ? (
									<div
										className="media-content-description"
										dangerouslySetInnerHTML={{
											__html: DOMPurify.sanitize(setTimestampAnchors(description)),
										}}
									></div>
								) : (
									<div className="media-content-description">{setTimestampAnchors(description)}</div>
								))}

							{hasSummary && (
								<button className="load-more" onClick={onClickLoadMore}>
									{isContentVisible ? 'SHOW LESS' : 'SHOW MORE'}
								</button>
							)}

							{!!props.yearProduced && (
								<MediaMetaField
									value={<span className="media-year-produced">{props.yearProduced}</span>}
									title={'Year produced'}
								/>
							)}

							{!!topicsContent.length && (
								<MediaMetaField
									value={topicsContent}
									title={1 < topicsContent.length ? 'Topics' : 'Topic'}
								/>
							)}

							{!!categoriesContent.length && (
								<MediaMetaField
									value={categoriesContent}
									title={1 < categoriesContent.length ? 'Categories' : 'Category'}
								/>
							)}

							{null !== productionCompanyContent && '' !== productionCompanyContent && (
								<MediaMetaField value={productionCompanyContent} title="Production company" />
							)}

							{websiteContent && (
								<MediaMetaField
									value={
										<a href={websiteContent} target="_blank" rel="noreferrer noopener">
											{websiteContent}
										</a>
									}
									title="Website"
								/>
							)}

							{!!tagsContent.length && (
								<MediaMetaField value={tagsContent} title={1 < tagsContent.length ? 'Tags' : 'Tag'} />
							)}

							{(user.can.editMedia || user.can.editSubtitle || user.can.deleteMedia) && (
								<div className="media-author-actions">
									{user.can.editMedia && (
										<EditMediaButton link={MediaPageStore.get('media-data').edit_url} />
									)}

									{user.can.editSubtitle &&
										'video' === MediaPageStore.get('media-data').media_type && (
											<EditSubtitleButton
												link={MediaPageStore.get('media-data').edit_url.replace(
													'edit?',
													'add_subtitle?'
												)}
											/>
										)}

									<PopupTrigger contentRef={popupContentRef}>
										<button className="remove-media">DELETE MEDIA</button>
									</PopupTrigger>

									<PopupContent contentRef={popupContentRef}>
										<PopupMain>
											<div className="popup-message">
												<span className="popup-message-title">Media removal</span>
												<span className="popup-message-main">
													You're willing to remove media permanently?
												</span>
											</div>
											<hr />
											<span className="popup-message-bottom">
												<button
													className="button-link cancel-comment-removal"
													onClick={cancelMediaRemoval}
												>
													CANCEL
												</button>
												<button
													className="button-link proceed-comment-removal"
													onClick={proceedMediaRemoval}
												>
													PROCEED
												</button>
											</span>
										</PopupMain>
									</PopupContent>
								</div>
							)}
						</div>
					</div>

					{null !== ratings_info && (
						<section className="media-impact-section" aria-labelledby="media-impact-heading">
							<h2 id="media-impact-heading">Film&apos;s Impact</h2>
							<RatingSystem media_id={MediaPageStore.get('media-id')} ratings_data={ratings_info} />
						</section>
					)}
				</div>
			)}
		</UserConsumer>
	);
}
