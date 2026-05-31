import { useState } from 'react';
import { PasswordDialog } from '../PasswordDialog';

export function RestrictedMediaGate({ viewerClassname, onPasswordSuccess }) {
	const [passwordDialogOpen, setPasswordDialogOpen] = useState(true);

	return (
		<div className={viewerClassname}>
			<div className="viewer-container" key="viewer-container">
				<div className="restricted-media-poster">
					{MediaCMS.media_poster_url ? (
						<img
							src={MediaCMS.media_poster_url}
							alt=""
							width={1280}
							height={720}
							className="restricted-media-poster-img"
							loading="eager"
							fetchPriority="high"
						/>
					) : null}
					<div className="restricted-media-poster-overlay" />
				</div>
			</div>
			<PasswordDialog
				open={passwordDialogOpen}
				onOpenChange={setPasswordDialogOpen}
				friendlyToken={MediaCMS.media_friendly_token || MediaCMS.mediaId}
				ownerName={MediaCMS.media_owner_name}
				ownerUrl={MediaCMS.media_owner_url}
				onSuccess={onPasswordSuccess}
			/>
		</div>
	);
}
