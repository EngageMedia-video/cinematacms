import React from 'react';

import SiteContext from '../../../static/js/contexts/SiteContext';

import PropTypes from 'prop-types';

import PageStore from '../../../static/js/pages/_PageStore';

import MediaPageStore from '../../../static/js/pages/MediaPage/store.js';

import { Badge } from '../../shared/components/Badge';

import { formatInnerLink } from '../../../static/js/functions/formatInnerLink';
import { Text } from '../../shared/components/Text/Text.jsx';
import MediaActions from './MediaActions';

function Tooltip(el) {
	// const parent = el.parentNode;
	const parent = document.body;

	const tooltipElem = document.createElement('span');

	tooltipElem.innerText = el.getAttribute('data-tooltip');
	tooltipElem.setAttribute('class', 'tooltip');

	el.removeAttribute('data-tooltip');

	// console.log(el);
	// console.log(tooltipElem);

	function onMouseenter() {
		const targetClientRect = el.getBoundingClientRect();
		parent.appendChild(tooltipElem);
		tooltipElem.style.top = targetClientRect.top - (0 + tooltipElem.offsetHeight) + 'px';
		tooltipElem.style.left = targetClientRect.left + 'px';
		document.addEventListener('scroll', onScroll);
	}

	function onMouseleave() {
		parent.removeChild(tooltipElem);
		tooltipElem.style.top = '';
		tooltipElem.style.left = '';
		document.removeEventListener('scroll', onScroll);
	}

	function onScroll() {
		const targetClientRect = el.getBoundingClientRect();
		tooltipElem.style.top = targetClientRect.top - (0 + tooltipElem.offsetHeight) + 'px';
		tooltipElem.style.left = targetClientRect.left + 'px';
	}

	el.addEventListener('mouseenter', onMouseenter);
	el.addEventListener('mouseleave', onMouseleave);
}

function legacyContextValue(context) {
	return context['_currentValue'];
}

function stateBadgeColor(mediaState) {
	switch (mediaState) {
		case 'private':
			return 'cinemata-sunset-horizon-700';
		case 'restricted':
			return 'cinemata-pacific-deep-700';
		case 'unlisted':
			return 'cinemata-strait-blue-600p';
		default:
			return 'cinemata-neutral-700';
	}
}

export default class ViewerInfoTitleBanner extends React.PureComponent {
	constructor(props) {
		super(props);

		this.state = {
			likedMedia: MediaPageStore.get('user-liked-media'),
			dislikedMedia: MediaPageStore.get('user-disliked-media'),
		};

		// @note: Allow only image files to download directly.
		this.downloadLink =
			'video' !== MediaPageStore.get('media-type')
				? formatInnerLink(MediaPageStore.get('media-original-url'), legacyContextValue(SiteContext).url)
				: null;

		this.updateStateValues = this.updateStateValues.bind(this);
	}

	componentDidMount() {
		MediaPageStore.on('liked_media', this.updateStateValues);
		MediaPageStore.on('unliked_media', this.updateStateValues);
		MediaPageStore.on('disliked_media', this.updateStateValues);
		MediaPageStore.on('undisliked_media', this.updateStateValues);

		const tooltips = document.querySelectorAll('[data-tooltip]');

		if (tooltips.length) {
			tooltips.forEach((tooltipElem) => Tooltip(tooltipElem));
		}
	}

	updateStateValues() {
		this.setState({
			likedMedia: MediaPageStore.get('user-liked-media'),
			dislikedMedia: MediaPageStore.get('user-disliked-media'),
		});
	}

	mediaCategories(overTitle) {
		if (void 0 === this.props.categories || null === this.props.categories || !this.props.categories.length) {
			return null;
		}

		let i = 0;
		let cats = [];
		while (i < this.props.categories.length) {
			cats.push(
				<span key={i}>
					<Text
						as="a"
						href={formatInnerLink(this.props.categories[i].url, legacyContextValue(SiteContext).url)}
						action="text-link"
						variant="body-12-medium"
						className="hover:underline dark:text-cinemata-pacific-deep-400 text-cinemata-pacific-deep-900"
					>
						{this.props.categories[i].title}
					</Text>
				</span>
			);
			i += 1;
		}

		return <div className={'media-under-title-categories' + (!!overTitle ? ' over-title' : '')}>{cats}</div>;
	}

	mediaStateBadge(mediaState, stateTooltip) {
		if ('public' === mediaState) {
			return null;
		}

		return (
			<div className="media-labels-area">
				<Badge
					color={stateBadgeColor(mediaState)}
					className={'media-state-badge media-state-badge-' + mediaState}
					title={stateTooltip}
				>
					{String(mediaState).toUpperCase()}
				</Badge>
			</div>
		);
	}

	render() {
		const displayViews = PageStore.get('config-options').pages.media.displayViews && void 0 !== this.props.views;
		const mediaState = MediaPageStore.get('media-data').state;

		let stateTooltip = '';

		switch (mediaState) {
			case 'private':
				stateTooltip = 'The site admins have to make its access public';
				break;
			case 'unlisted':
				stateTooltip = 'The site admins have to make it appear on listings';
				break;
			case 'restricted':
				stateTooltip = 'The site admins have to make its access public';
				break;
		}

		return (
			<div className="media-title-banner">
				{displayViews && PageStore.get('config-options').pages.media.categoriesWithTitle
					? this.mediaCategories(true)
					: null}

				{void 0 !== this.props.title ? <h1>{this.props.title}</h1> : null}

				{this.mediaStateBadge(mediaState, stateTooltip)}

				<div className={'media-views-actions' + (this.state.likedMedia ? ' liked-media' : '')}>
					{!displayViews && PageStore.get('config-options').pages.media.categoriesWithTitle
						? this.mediaCategories()
						: null}

					<MediaActions
						allowDownload={this.props.allowDownload}
						displayViews={displayViews}
						downloadLink={this.downloadLink}
						isVideo={false}
						title={this.props.title}
						views={this.props.views}
					/>
				</div>
			</div>
		);
	}
}

ViewerInfoTitleBanner.propTypes = {
	allowDownload: PropTypes.bool.isRequired,
};

ViewerInfoTitleBanner.defaultProps = {
	allowDownload: false,
};
