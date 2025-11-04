import React, { useState, useEffect } from 'react';

import { Item } from './Item';

import { useItem } from './hooks/useItem';

import { UserItemMemberSince, UserItemThumbnailLink } from './includes/items';

export function UserItem(props){

	const type = 'user';

	const [ titleComponent, descriptionComponent, thumbnailUrl, UnderThumbWrapper ] = useItem({...props, type});

	// Extract additional member data
	const location = props.location || '';
	const mediaCount = props.media_count || 0;
	const isTrusted = props.is_trusted || props.advancedUser || false;
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

	function metaComponents(){
		if (props.hideAllMeta) return null;
		
		return (
			<div className="member-info-meta">
				<p className="username">@{props.username || 'member'}</p>
				{location && (
					<div className="location">
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
							<circle cx="12" cy="10" r="3"></circle>
						</svg>
						<span>{location}</span>
					</div>
				)}
				<div className="stats">
					<div className="stat">
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<polygon points="23 7 16 12 23 17 23 7"></polygon>
							<rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
						</svg>
						<span>{mediaCount} {mediaCount === 1 ? 'video' : 'videos'}</span>
					</div>
					<div className="stat">
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

	function badgesComponent(){
		if (!isTrusted && !isSameCountry) return null;
		
		return (
			<React.Fragment>
				{isSameCountry && <div className="badge local">Local</div>}
				{isTrusted && <div className="badge trusted">Trusted</div>}
			</React.Fragment>
		);
	}

	function avatarComponent(){
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
					background: var(--popup-bg-color, white);
					border-radius: 12px;
					padding: 1.5rem;
					box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
					transition: all 0.2s;
					position: relative;
					text-align: center;
					border: 1px solid var(--input-border-color, #e2e8f0);
				}

				.member-card:hover {
					transform: translateY(-2px);
					box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
				}

				.member-card.same-country {
					border: 2px solid #10b981;
				}

				.badge {
					position: absolute;
					top: 1rem;
					color: white;
					padding: 0.25rem 0.75rem;
					border-radius: 12px;
					font-size: 0.75rem;
					font-weight: 600;
				}

				.badge.local {
					right: 1rem;
					background: #10b981;
				}

				.badge.trusted {
					left: 1rem;
					background: #f59e0b;
				}

				.avatar {
					width: 80px;
					height: 80px;
					background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
					color: var(--body-text-color, #1e293b);
					margin-bottom: 0.25rem;
				}

				.member-info :global(h3 a) {
					color: inherit;
					text-decoration: none;
				}

				.member-info :global(h3 a:hover) {
					color: var(--default-theme-color, #3b82f6);
				}

				.username {
					color: var(--body-text-color, #64748b);
					opacity: 0.7;
					font-size: 0.875rem;
					margin-bottom: 0.75rem;
				}

				.location {
					display: flex;
					align-items: center;
					justify-content: center;
					gap: 0.5rem;
					color: var(--body-text-color, #475569);
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
					border-top: 1px solid var(--input-border-color, #f1f5f9);
					border-bottom: 1px solid var(--input-border-color, #f1f5f9);
				}

				.stat {
					display: flex;
					align-items: center;
					gap: 0.5rem;
					color: var(--body-text-color, #64748b);
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
					background: var(--default-theme-color, #3b82f6);
					color: white !important;
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
					opacity: 0.9;
					color: white !important;
				}

				@media (max-width: 768px) {
					.member-card {
						padding: 1rem;
					}

					.badge {
						font-size: 0.65rem;
						padding: 0.2rem 0.6rem;
					}

					.badge.local {
						top: 0.5rem;
						right: 0.5rem;
					}

					.badge.trusted {
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

UserItem.defaultProps = {
	...Item.defaultProps,
};
