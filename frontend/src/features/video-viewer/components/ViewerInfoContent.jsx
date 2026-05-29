import React, { useContext, useState, useEffect, useId, useLayoutEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import { UserConsumer } from '../../../static/js/contexts/UserContext';
import SiteContext from '../../../static/js/contexts/SiteContext';
import PageStore from '../../../static/js/pages/_PageStore';
import * as PageActions from '../../../static/js/pages/_PageActions';
import MediaPageStore from '../../../static/js/pages/MediaPage/store.js';
import * as MediaPageActions from '../../../static/js/pages/MediaPage/actions.js';
import { RatingSystem } from '../../../static/js/components/RatingSystem/RatingSystem';
import { formatInnerLink } from '../../../static/js/functions/formatInnerLink';
import { TabContent, TabView } from '../../shared/components/TabView/TabView.jsx';
import { Text } from '../../shared/components/Text/Text.jsx';
import { MediaAuthorBanner } from './MediaAuthorBanner.jsx';
import { MediaMetaField } from './MediaMetaField.jsx';
import { Link } from '../../shared/components/Link/Link.jsx';
import { Button } from '../../shared/components/Button/Button.jsx';
import { Dialog, DialogClose, DialogTrigger } from '../../shared/components/Dialog/Dialog.jsx';
import { ConfirmationDialogContent } from '../../shared/components/ConfirmationDialog';
import { cn } from '../../shared/utils/classNames.js';

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

			ret[i] = `${arr[i].title}${separator} `;

			i += 1;
		}
	}

	return ret;
}

function MediaButton(props) {
	return (
		<Link href={props.link} rel="nofollow" variant="primary">
			{props.label}
		</Link>
	);
}

export default function ViewerInfoContent(props) {
	const description = props.description.trim();
	const hasHtmlDescription = PageStore.get('config-options').pages.media.htmlInDescription;
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

	const hasAboutText = '' !== description;
	const [isAboutExpanded, setIsAboutExpanded] = useState(false);
	const [isSummaryClamped, setIsSummaryClamped] = useState(false);
	const aboutDetailsId = useId();
	const summaryTextRef = useRef(null);

	function proceedMediaRemoval() {
		MediaPageActions.removeMedia();
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

	useEffect(() => {
		MediaPageStore.on('media_delete', onMediaDelete);
		MediaPageStore.on('media_delete_fail', onMediaDeleteFail);
		return () => {
			MediaPageStore.removeListener('media_delete', onMediaDelete);
			MediaPageStore.removeListener('media_delete_fail', onMediaDeleteFail);
		};
	}, []);

	useLayoutEffect(() => {
		const summaryText = summaryTextRef.current;

		if (!summaryText || !hasAboutText || isAboutExpanded) {
			setIsSummaryClamped(false);
			return undefined;
		}

		function measureSummaryClamp() {
			const isBelowLg = window.matchMedia('(max-width: 1023.98px)').matches;
			setIsSummaryClamped(isBelowLg && summaryText.scrollHeight > summaryText.clientHeight + 1);
		}

		measureSummaryClamp();
		window.addEventListener('resize', measureSummaryClamp);

		const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measureSummaryClamp) : null;

		if (resizeObserver) {
			resizeObserver.observe(summaryText);
		}

		return () => {
			window.removeEventListener('resize', measureSummaryClamp);
			resizeObserver?.disconnect();
		};
	}, [description, hasAboutText, isAboutExpanded]);

	const authorLink = formatInnerLink(props.author.url, site.url);
	const authorThumb = formatInnerLink(props.author.thumb, site.url);

	function setTimestampAnchors(text) {
		function wrapTimestampWithAnchor(match) {
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
				'<a class="text-text-accent" href="' +
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

	let licenseValue;
	if (null !== licenseContent && '' !== licenseContent) {
		licenseValue = (
			<div className="inline-flex flex-col">
				<a href={licenseContent.url} title={licenseContent.title} target="_blank" rel="nofollow">
					<span>
						<img src={licenseContent.thumbnail} alt="" />
					</span>
				</a>

				<Text as="span" variant="body-12" color="meta">
					{licenseContent.title}
				</Text>
			</div>
		);
	} else {
		licenseValue = <span>All rights reserved.</span>;
	}

	const metaFields = [
		summary && {
			title: 'Synopsis',
			value: summary,
		},
		languagesContent.length && {
			title: languagesContent.length > 1 ? 'Languages' : 'Language',
			value: languagesContent,
		},
		props.yearProduced && { title: 'Year produced', value: props.yearProduced },
		null !== productionCompanyContent &&
			'' !== productionCompanyContent && {
				title: 'Production company',
				value: productionCompanyContent,
			},
		websiteContent && {
			title: 'Website',
			value: (
				<a
					href={websiteContent}
					target="_blank"
					rel="noreferrer noopener"
					className="decoration-none text-text-primary no-underline"
				>
					{websiteContent}
				</a>
			),
		},
		topicsContent.length && {
			title: 1 < topicsContent.length ? 'Topics' : 'Topic',
			value: topicsContent,
		},
		categoriesContent.length && {
			title: 1 < categoriesContent.length ? 'Categories' : 'Category',
			value: categoriesContent,
		},
		tagsContent.length && {
			title: 1 < tagsContent.length ? 'Tags' : 'Tag',
			value: tagsContent,
		},
		MediaPageStore.get('display-media-license-info') && {
			title: null !== licenseContent && '' !== licenseContent ? 'License' : 'Copyright',
			value: licenseValue,
		},
	].filter(Boolean);

	return (
		<UserConsumer>
			{(user) => (
				<div className="py-8 px-4 md:px-0">
					<TabView
						tabMode="wrap"
						listClassName="rounded-none rounded-tl-ds-8 rounded-tr-ds-8"
						triggerClassName="rounded-none py-3 px-size-22 text-neutral-50 aria-selected:text-text-primary dark:aria-selected:text-neutral-50"
						triggerSelectedColor="bg-bg-surface"
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

										{(hasAboutText || metaFields.length) && (
											<div className="border-b border-b-cinemata-pacific-deep-600p mt-6" />
										)}
									</>
								)}

								{hasAboutText && (
									<>
										<div className="media-content-summary mt-6 flex flex-col gap-3">
											<Text variant="h6-medium" className="m-0">
												Log Line / Synopsis
											</Text>

											<div className="relative">
												<Text
													ref={summaryTextRef}
													variant="body-16"
													className={cn(
														'm-0',
														!isAboutExpanded && 'line-clamp-5 lg:line-clamp-none'
													)}
												>
													{hasHtmlDescription ? (
														<span
															dangerouslySetInnerHTML={{
																__html: DOMPurify.sanitize(
																	setTimestampAnchors(description)
																),
															}}
														/>
													) : (
														setTimestampAnchors(description)
													)}
												</Text>

												{!isAboutExpanded && isSummaryClamped && (
													<>
														<Text
															as="button"
															action="text-button"
															variant="body-14-bold"
															color="accent"
															type="button"
															aria-controls={aboutDetailsId}
															aria-expanded="false"
															onClick={() => setIsAboutExpanded(true)}
															className="inline align-baseline lg:hidden"
														>
															READ MORE
														</Text>
													</>
												)}
											</div>

											{!isAboutExpanded && !isSummaryClamped && (
												<>
													<Text
														as="button"
														action="text-button"
														variant="body-14-bold"
														color="accent"
														type="button"
														aria-controls={aboutDetailsId}
														aria-expanded="false"
														onClick={() => setIsAboutExpanded(true)}
														className="inline align-baseline lg:hidden"
													>
														READ MORE
													</Text>
												</>
											)}
										</div>
										{metaFields.length > 0 && (
											<div
												className={cn(
													'border-b border-b-cinemata-pacific-deep-600p mt-6',
													!isAboutExpanded && 'hidden lg:block'
												)}
											/>
										)}
									</>
								)}

								<div
									id={aboutDetailsId}
									className={cn(hasAboutText && !isAboutExpanded ? 'hidden lg:block' : 'block')}
								>
									{metaFields.length > 0 && (
										<div className="flex flex-col gap-3 mt-6">
											{metaFields.map((field) => (
												<MediaMetaField
													key={field.title}
													title={field.title}
													value={field.value}
												/>
											))}
										</div>
									)}

									{(user.can.editMedia || user.can.editSubtitle || user.can.deleteMedia) && (
										<div className="flex flex-row flex-wrap mt-6 gap-4">
											{user.can.editMedia && (
												<MediaButton
													link={MediaPageStore.get('media-data').edit_url}
													label="EDIT MEDIA"
												/>
											)}

											{user.can.editSubtitle &&
												'video' === MediaPageStore.get('media-data').media_type && (
													<MediaButton
														link={MediaPageStore.get('media-data').edit_url.replace(
															'edit?',
															'add_subtitle?'
														)}
														label="EDIT SUBTITLE"
													/>
												)}

											<Dialog>
												<DialogTrigger>
													<Button variant="primary">DELETE MEDIA</Button>
												</DialogTrigger>

												<ConfirmationDialogContent
													title="Media removal"
													subtitle="You're willing to remove media permanently?"
													aria-label="Media removal confirmation"
													actions={
														<>
															<DialogClose>
																<Button type="button" variant="secondary">
																	CANCEL
																</Button>
															</DialogClose>
															<DialogClose>
																<Button
																	type="button"
																	variant="primary"
																	onClick={proceedMediaRemoval}
																>
																	PROCEED
																</Button>
															</DialogClose>
														</>
													}
												/>
											</Dialog>
										</div>
									)}
								</div>

								{hasAboutText && isAboutExpanded && (
									<Text
										as="button"
										action="text-button"
										variant="body-14-bold"
										color="accent"
										type="button"
										aria-controls={aboutDetailsId}
										aria-expanded="true"
										onClick={() => setIsAboutExpanded(false)}
										className="mx-auto mt-6 flex lg:hidden"
									>
										CLOSE
									</Text>
								)}
							</div>
						</TabContent>
						<TabContent title="COMMUNITY IMPACT">Test</TabContent>
					</TabView>

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
