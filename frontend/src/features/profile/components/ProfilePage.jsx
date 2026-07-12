import { QueryClientProvider } from '@tanstack/react-query';
import { config as createRuntimeConfig } from '../../../static/js/mediacms/config';
import defaultProfileBanner from '../assets/profile-banner.png';
import profileQueryClient from '../queryClient';
import { getProfileTabs } from '../utils/tabConfig';
import { ProfileHeader } from './ProfileHeader';
import { ProfileTabs } from './ProfileTabs';
import { SectionHeading } from './SectionHeading';
import { AboutSection } from './sections/AboutSection';
import { ContactSection } from './sections/ContactSection';
import { ImpactSection } from './sections/ImpactSection';
import { ManageUploadsSection } from './sections/ManageUploadsSection';
import { MediaSection } from './sections/MediaSection';
import { NotesSection } from './sections/NotesSection';
import { OwnerMediaSection } from './sections/OwnerMediaSection';
import { PlaylistsSection } from './sections/PlaylistsSection';

const SECTIONS = {
	about: AboutSection,
	media: MediaSection,
	'manage-uploads': ManageUploadsSection,
	playlists: PlaylistsSection,
	notes: NotesSection,
	impact: ImpactSection,
	contact: ContactSection,
	history: (props) => <OwnerMediaSection {...props} action="history" />,
	liked: (props) => <OwnerMediaSection {...props} action="liked" />,
};

function ProfilePageContent({ author, activeTab }) {
	const runtimeConfig = createRuntimeConfig(window.MediaCMS);
	const tabs = getProfileTabs(author, runtimeConfig);
	const selectedTab = tabs.some((tab) => tab.id === activeTab) ? activeTab : 'about';
	const tab = tabs.find((item) => item.id === selectedTab) || tabs[0];
	const ActiveSection = SECTIONS[selectedTab] || AboutSection;
	const bannerImage = author.banner_thumbnail_url || defaultProfileBanner;

	return (
		<div className="min-h-screen bg-bg-page text-text-primary">
			<div
				className={`relative h-[230px] overflow-hidden bg-bg-chrome bg-cover sm:h-[310px] ${
					author.banner_thumbnail_url
						? 'bg-center'
						: 'bg-[position:35%_center] sm:bg-center sm:bg-[length:100%_167.92%]'
				}`}
				style={{
					backgroundImage: author.banner_thumbnail_url
						? `linear-gradient(color-mix(in srgb, var(--bg-overlay-dark) 38%, transparent), color-mix(in srgb, var(--bg-overlay-dark) 38%, transparent)), url("${bannerImage}")`
						: `url("${bannerImage}")`,
				}}
				aria-hidden="true"
			/>

			<div className="relative z-10 mx-auto -mt-[84px] w-[calc(100%_-_32px)] max-w-[1515px] overflow-hidden rounded-lg bg-bg-page">
				<ProfileHeader author={author} />
				<div className="mx-4 border-t border-border-divider sm:mx-8" />
				<div className="mx-4 mt-4 overflow-hidden rounded-2xl bg-bg-surface sm:mx-8">
					<div className="px-4 pt-4">
						<ProfileTabs activeTab={selectedTab} tabs={tabs} />
					</div>
					<main aria-labelledby={`profile-${selectedTab}-heading`} className="px-4 py-6 sm:px-6 sm:py-8">
						<SectionHeading
							id={`profile-${selectedTab}-heading`}
							heading={tab.heading}
							subtext={tab.subtext}
						/>
						<ActiveSection author={author} />
					</main>
				</div>
			</div>
		</div>
	);
}

export function ProfilePage({ author, activeTab }) {
	return (
		<QueryClientProvider client={profileQueryClient}>
			<ProfilePageContent author={author} activeTab={activeTab} />
		</QueryClientProvider>
	);
}
