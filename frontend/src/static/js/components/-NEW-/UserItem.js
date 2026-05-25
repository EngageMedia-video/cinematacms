import React, { useState, useEffect } from 'react';

import { Item } from './Item';

import { useItem } from './hooks/useItem';

import { UserItemMemberSince, UserItemThumbnailLink } from './includes/items';

export function UserItem(props) {
	props = { ...UserItem.defaults, ...props };

	const type = 'user';

	// The title should already be set from ListItem (which gets it from listItemProps)
	const modifiedProps = { ...props, type };
	const [titleComponent, descriptionComponent, thumbnailUrl, UnderThumbWrapper] = useItem(modifiedProps);

	// Extract additional member data
	const location = props.location || '';
	const mediaCount = props.media_count || 0;
	const isTrusted = props.is_trusted || props.advancedUser || false;
	const isEditor = props.is_editor || false;
	const isManager = props.is_manager || false;
	const locationCountry = props.location_country || '';

	// Check if same country as current user (client-side only to avoid hydration mismatch)
	const [isSameCountry, setIsSameCountry] = useState(false);

	useEffect(() => {
		// Only runs on client - safe to access window
		if (typeof window !== 'undefined' && window.MediaCMS && window.MediaCMS.user) {
			const userCountry = window.MediaCMS.user.location_country;
			// Always set the state based on current comparison (handles component reuse)
			setIsSameCountry(userCountry && locationCountry && userCountry === locationCountry);
		} else {
			// No user info available - ensure state is false
			setIsSameCountry(false);
		}
	}, [locationCountry]);

	function metaComponents() {
		if (props.hideAllMeta) return null;

		return (
			<div className="member-info-meta">
				<p className="username">@{props.username || 'member'}</p>
				{location && (
					<div className="location">
						<svg
							width="14"
							height="14"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
							<circle cx="12" cy="10" r="3"></circle>
						</svg>
						<span>{location}</span>
					</div>
				)}
				<div className="stats">
					<div className="stat">
						<svg
							width="14"
							height="14"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<polygon points="23 7 16 12 23 17 23 7"></polygon>
							<rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
						</svg>
						<span>
							{mediaCount} {mediaCount === 1 ? 'video' : 'videos'}
						</span>
					</div>
					<div className="stat">
						<svg
							width="14"
							height="14"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
							<line x1="16" y1="2" x2="16" y2="6"></line>
							<line x1="8" y1="2" x2="8" y2="6"></line>
							<line x1="3" y1="10" x2="21" y2="10"></line>
						</svg>
						<UserItemMemberSince date={props.publish_date} />
					</div>
				</div>
			</div>
		);
	}

	function badgesComponent() {
		if (!isTrusted && !isSameCountry && !isEditor && !isManager) return null;

		// Track badge index for dynamic positioning
		let roleBadgeIndex = 0;

		return (
			<React.Fragment>
				{isSameCountry && <div className="badge local">Local</div>}
				{isTrusted && (
					<div className="badge role-badge trusted" style={{ top: `${1 + roleBadgeIndex++ * 1.7}rem` }}>
						Trusted
					</div>
				)}
				{isEditor && (
					<div className="badge role-badge editor" style={{ top: `${1 + roleBadgeIndex++ * 1.7}rem` }}>
						Editor
					</div>
				)}
				{isManager && (
					<div className="badge role-badge moderator" style={{ top: `${1 + roleBadgeIndex++ * 1.7}rem` }}>
						Moderator
					</div>
				)}
			</React.Fragment>
		);
	}

	function avatarComponent() {
		return (
			<div className="avatar">
				{thumbnailUrl ? (
					<div className="avatar-image" style={{ backgroundImage: `url('${thumbnailUrl}')` }}></div>
				) : (
					<span>{props.title ? props.title.charAt(0).toUpperCase() : '👤'}</span>
				)}
			</div>
		);
	}

	return (
		<div className={`member-card${isSameCountry ? ' same-country' : ''}`}>
			{badgesComponent()}
			{avatarComponent()}

			<div className="member-info">
				{titleComponent()}
				{metaComponents()}
				<a href={props.link} className="view-profile" title={`View ${props.title}'s profile`}>
					View Profile
				</a>
			</div>

			<style jsx>{`
				.member-card {
					background: var(--bg-surface-raised, var(--cinemata-white));
					border-radius: 12px;
					padding: 1.5rem;
					transition: all 0.2s;
					position: relative;
					text-align: center;
				}

				.member-card:hover {
					transform: translateY(-2px);
				}

				.badge {
					position: absolute;
					color: var(--text-on-primary, var(--cinemata-white));
					padding: 0.25rem 0.75rem;
					border-radius: var(--radius-ds-2, var(--radius-2, 2px));
					font-size: var(--size-10, 0.625rem);
					font-weight: 600;
					top: 1rem;
				}

				.badge.local {
					right: 1rem;
					background: var(--bg-success, var(--cinemata-green-500));
				}

				.badge.role-badge {
					left: 1rem;
					background: var(--member-role-badge-bg, var(--cinemata-amber-700));
					color: var(--member-role-badge-text, var(--text-on-primary, var(--cinemata-white)));
				}

				.avatar {
					width: 80px;
					height: 80px;
					background: linear-gradient(
						135deg,
						var(--cinemata-strait-blue-300) 0%,
						var(--cinemata-pacific-deep-400) 100%
					);
					border-radius: 50%;
					display: flex;
					align-items: center;
					justify-content: center;
					font-size: 2.5rem;
					margin: 0 auto 1rem;
					overflow: hidden;
				}

				.avatar-image {
					width: 100%;
					height: 100%;
					background-size: cover;
					background-position: center;
				}

				.member-info {
					text-align: center;
				}

				.member-info :global(h3) {
					font-size: 1.125rem;
					color: var(--text-primary, var(--cinemata-pacific-deep-700));
					margin-bottom: 0.25rem;
				}

				.member-info :global(h3 a) {
					color: var(--text-link, var(--cinemata-sunset-horizon-400p));
					text-decoration: none;
				}

				.member-info :global(h3 a:hover) {
					color: var(--text-link-hover, var(--cinemata-sunset-horizon-600));
				}

				.username {
					color: var(--text-muted, var(--cinemata-pacific-deep-400));
					opacity: 0.7;
					font-size: 0.875rem;
					margin-bottom: 0.75rem;
				}

				.location {
					display: flex;
					align-items: center;
					justify-content: center;
					gap: 0.5rem;
					color: var(--text-muted, var(--cinemata-pacific-deep-400));
					opacity: 0.8;
					font-size: 0.875rem;
					margin-bottom: 1rem;
				}

				.location svg {
					flex-shrink: 0;
				}

				.stats {
					display: flex;
					justify-content: center;
					gap: 1rem;
					margin-bottom: 1rem;
					padding: 0.75rem 0;
				}

				.stat {
					display: flex;
					align-items: center;
					gap: 0.5rem;
					color: var(--text-muted, var(--cinemata-pacific-deep-400));
					opacity: 0.8;
					font-size: 0.875rem;
				}

				.stat svg {
					flex-shrink: 0;
				}

				.stat :global(time) {
					font-size: inherit;
					color: inherit;
				}

				.view-profile {
					width: 100%;
					padding: 0.75rem;
					background: var(--bg-secondary, var(--cinemata-sunset-horizon-400p));
					color: var(--text-on-primary, var(--cinemata-white)) !important;
					border: none;
					border-radius: 8px;
					font-weight: 500;
					cursor: pointer;
					transition: all 0.2s;
					text-decoration: none;
					display: block;
					text-align: center;
				}

				.view-profile:hover {
					background: var(--bg-secondary-hover, var(--cinemata-sunset-horizon-500));
					color: var(--text-on-primary, var(--cinemata-white)) !important;
				}

				@media (max-width: 768px) {
					.member-card {
						padding: 1rem;
					}

					.badge {
						font-size: var(--size-10, 0.625rem);
						padding: 0.2rem 0.6rem;
					}

					.badge.local {
						top: 0.5rem;
						right: 0.5rem;
					}

					.badge.role-badge {
						top: 0.5rem;
						left: 0.5rem;
					}

					.avatar {
						width: 60px;
						height: 60px;
						font-size: 1.75rem;
					}
				}
			`}</style>
		</div>
	);
}

UserItem.propTypes = {
	...Item.propTypes,
};

UserItem.defaults = {
	...Item.defaults,
};
