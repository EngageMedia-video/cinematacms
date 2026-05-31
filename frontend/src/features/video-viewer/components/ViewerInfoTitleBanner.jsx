import React from 'react';

import SiteContext from '../../../static/js/contexts/SiteContext';

import PropTypes from 'prop-types';

import PageStore from '../../../static/js/pages/_PageStore';

import MediaPageStore from '../../../static/js/pages/MediaPage/store.js';

import { Badge } from '../../shared/components/Badge';
import { Tooltip } from '../../shared/components/Tooltip';

import { formatInnerLink } from '../../../static/js/functions/formatInnerLink';
import { Text } from '../../shared/components/Text/Text.jsx';
import MediaActions from './MediaActions';
import { Button } from '../../shared/components/Button/Button.jsx';
import { Icon } from '../../shared/components/Icon/Icon.jsx';

function legacyContextValue(context) {
	return context['_currentValue'];
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
						className="text-text-strong hover:underline"
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
			<>
				<div className="flex-row gap-2 items-center hidden sm:flex">
					<Badge
						color="bg/primary"
						className={'media-state-badge media-state-badge-' + mediaState}
						title={stateTooltip}
					>
						<span className="body-12-bold">{String(mediaState).toUpperCase()}</span>
					</Badge>

					<Tooltip content={stateTooltip} placement="right" trigger="hover">
						<Button
							variant="icon"
							aria-label="Open tooltip"
							icon={<Icon name="infoYellow" size={18} decorative />}
						/>
					</Tooltip>
				</div>

				<div className="flex-row gap-2 items-center flex sm:hidden">
					<Badge
						color="bg/primary"
						className={'media-state-badge media-state-badge-' + mediaState}
						title={stateTooltip}
					>
						<span className="body-12-bold">{String(mediaState).toUpperCase()}</span>
					</Badge>

					<Tooltip content={stateTooltip} placement="left" trigger="hover">
						<Button
							variant="icon"
							aria-label="Open tooltip"
							icon={<Icon name="infoYellow" size={18} decorative />}
						/>
					</Tooltip>
				</div>
			</>
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

				{void 0 !== this.props.title ? (
					<Text variant="h4-medium" className="m-0 text-text-strong">
						{this.props.title}
					</Text>
				) : null}

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
