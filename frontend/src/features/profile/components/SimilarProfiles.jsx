import { Avatar, Card, Icon, Link, Text, UserRoleBadge } from '../../shared/components';
import { useSimilarProfiles } from '../hooks/useSimilarProfiles';
import { getJoinedLabel } from '../utils/joinedDate';
import { ProfileSectionHeader } from './ProfileSectionHeader';

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
		<section aria-labelledby="similar-profiles-heading" className="rounded-lg border border-border-default p-4">
			<ProfileSectionHeader
				icon="profileSimilarProfiles"
				title="Similar Profiles"
				as="h2"
				id="similar-profiles-heading"
			/>
			<div className="mt-4 grid grid-cols-1 gap-5 sm:ml-[57px] sm:grid-cols-2 xl:grid-cols-4">
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
									className="flex min-h-[310px] flex-col items-center gap-4 bg-bg-surface-raised p-6 text-center"
								>
									<Avatar
										name={name}
										src={profile.thumbnail_url || ''}
										alt={`${name}'s profile photo`}
										style={{ width: 80, height: 80 }}
									/>
									<div className="min-w-0">
										<Text as="h3" variant="h5-bold" className="m-0 text-text-primary">
											{name}
										</Text>
										<div className="mt-1 flex items-center justify-center gap-1">
											<Text as="span" variant="body-16-medium" className="text-text-accent">
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
									<div className="flex flex-col items-center gap-1">
										{profile.location ? (
											<Text
												as="p"
												variant="body-14"
												className="m-0 inline-flex items-center gap-2 text-text-secondary"
											>
												<Icon name="profileLocation" size="xs" decorative />
												{profile.location}
											</Text>
										) : null}
										<div className="flex items-center gap-4">
											<Text
												as="p"
												variant="body-14"
												className="m-0 inline-flex items-center gap-2 text-text-secondary"
											>
												<Icon name="profileVideoCount" size="xs" decorative />
												{mediaCount.toLocaleString()} {mediaCount === 1 ? 'video' : 'videos'}
											</Text>
											{joinedLabel ? (
												<Text
													as="p"
													variant="body-14"
													className="m-0 inline-flex items-center gap-2 text-text-secondary"
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
