import { Avatar, Card, Icon, Link, Text, UserRoleBadge } from '../../shared/components';
import { useSimilarProfiles } from '../hooks/useSimilarProfiles';
import { getJoinedLabel } from '../utils/joinedDate';
import { ProfileSectionHeader } from './ProfileSectionHeader';

// Columns follow the section's width, not the viewport: from 768px an open
// sidebar takes ~260px, which squeezed viewport-based tracks below the ~210px
// a card's stats line needs. Three profiles never use four tracks, and four
// never use three, so neither leaves a lone card on the last row.
const GRID_COLUMNS = {
	three: '@lg:ml-[57px] @lg:grid-cols-2 @3xl:grid-cols-3',
	four: '@lg:ml-[57px] @lg:grid-cols-2 @min-[58rem]:ml-0 @min-[58rem]:grid-cols-4',
};

function normalizeProfiles(data) {
	if (Array.isArray(data)) return data;
	return Array.isArray(data?.results) ? data.results : [];
}

export function SimilarProfiles({ author }) {
	const country = author.location_country || author.location_info?.[0]?.title || '';
	const { data, isLoading, isError } = useSimilarProfiles(author.username, country);
	const profiles = normalizeProfiles(data)
		.filter((profile) => profile.username !== author.username)
		.slice(0, 4);

	if (isError || (!isLoading && profiles.length === 0)) return null;

	return (
		<section aria-labelledby="similar-profiles-heading" className="@container rounded-lg border border-border p-4">
			<ProfileSectionHeader
				icon="profileSimilarProfiles"
				title="Similar Profiles"
				as="h2"
				id="similar-profiles-heading"
			/>
			<div
				className={`mt-4 grid grid-cols-1 gap-5 ${GRID_COLUMNS[!isLoading && profiles.length === 3 ? 'three' : 'four']}`}
			>
				{isLoading
					? Array.from({ length: 4 }, (_, index) => (
							<div
								key={index}
								className="h-[310px] animate-pulse rounded-xl bg-bg-skeleton"
								aria-hidden="true"
							/>
						))
					: profiles.map((profile) => {
							const name = profile.name || profile.username;
							const mediaCount = Number(profile.media_count || 0);
							const joinedLabel = getJoinedLabel(profile.date_added);
							return (
								<Card
									key={profile.username}
									variant="outlined"
									className="flex min-h-[310px] min-w-0 flex-col items-center gap-4 bg-bg-surface-raised p-6 text-center"
								>
									<Avatar
										name={name}
										src={profile.thumbnail_url || ''}
										alt={`${name}'s profile photo`}
										style={{ width: 80, height: 80 }}
									/>
									<div className="w-full min-w-0">
										<Text as="h3" variant="h5-bold" className="m-0 break-words text-text">
											{name}
										</Text>
										<div className="mt-1 flex items-center justify-center gap-1">
											<Text
												as="span"
												variant="body-16-medium"
												className="min-w-0 break-all text-text-accent"
											>
												@{profile.username}
											</Text>
											{profile.is_trusted ? (
												<Icon
													name="verifiedCheck"
													size="sm"
													className="text-text-success"
													label="Trusted member"
												/>
											) : null}
										</div>
									</div>
									<UserRoleBadge isManager={profile.is_manager} isTrusted={profile.is_trusted} />
									<div className="flex w-full min-w-0 flex-col items-center gap-1">
										{profile.location ? (
											<Text
												as="p"
												variant="body-14"
												className="m-0 inline-flex items-center gap-2 text-text-subtle"
											>
												<Icon name="profileLocation" size="xs" decorative />
												{profile.location}
											</Text>
										) : null}
										<div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
											<Text
												as="p"
												variant="body-14"
												className="m-0 inline-flex items-center gap-2 text-text-subtle"
											>
												<Icon name="profileVideoCount" size="xs" decorative />
												{mediaCount.toLocaleString()} {mediaCount === 1 ? 'video' : 'videos'}
											</Text>
											{joinedLabel ? (
												<Text
													as="p"
													variant="body-14"
													className="m-0 inline-flex items-center gap-2 text-text-subtle"
												>
													<Icon name="profileMemberSince" size="xs" decorative />
													{joinedLabel}
												</Text>
											) : null}
										</div>
									</div>
									<Link
										href={profile.url || `/user/${encodeURIComponent(profile.username)}`}
										variant="primary"
										className="mt-auto uppercase"
									>
										View Profile
									</Link>
								</Card>
							);
						})}
			</div>
		</section>
	);
}
