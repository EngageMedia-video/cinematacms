import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import commentsQueryClient from '../queryClient';
import useCommentsStore from '../useCommentsStore';
import { Dialog, DialogContent } from '../../shared/components/Dialog';
import { getFriendlyTokenFromLocation } from '../utils/videoPlayer';
import { CommentsPanel } from './CommentsPanel';

import '../../../static/css/tailwind.css';

function CommentsStyleTag() {
	return (
		<style>{`
			.comments-scrollbar {
				scrollbar-color: var(--cinemata-strait-blue-200) transparent;
				scrollbar-width: thin;
			}
			.comments-scrollbar::-webkit-scrollbar {
				width: 6px;
			}
			.comments-scrollbar::-webkit-scrollbar-track {
				background: transparent;
			}
			.comments-scrollbar::-webkit-scrollbar-thumb {
				border: 2px solid transparent;
				border-radius: 999px;
				background-color: var(--cinemata-strait-blue-200);
				background-clip: content-box;
			}
			.comments-form-textarea {
				min-height: 20px;
				max-height: 120px;
				overflow-y: auto;
				scrollbar-color: var(--cinemata-strait-blue-200) transparent;
				scrollbar-width: thin;
			}
			.comments-form-textarea::-webkit-scrollbar {
				width: 6px;
			}
			.comments-form-textarea::-webkit-scrollbar-thumb {
				border-radius: 999px;
				background-color: var(--cinemata-strait-blue-200);
			}
		`}</style>
	);
}

function CommentsSectionInner({ friendlyToken, variant }) {
	const isExpanded = useCommentsStore((s) => s.isExpanded);
	const openExpanded = useCommentsStore((s) => s.openExpanded);
	const closeExpanded = useCommentsStore((s) => s.closeExpanded);

	useEffect(() => () => closeExpanded(), [closeExpanded]);

	if (!friendlyToken) return null;

	return (
		<>
			<CommentsPanel
				friendlyToken={friendlyToken}
				variant={variant}
				onExpandToggle={openExpanded}
				isExpanded={false}
			/>

			<Dialog open={isExpanded} onOpenChange={(next) => (next ? openExpanded() : closeExpanded())}>
				<DialogContent
					aria-label="Comments"
					className="flex h-[min(85vh,860px)] w-full max-w-[520px] flex-col"
					overlayClassName="bg-cinemata-pacific-deep-950/90 dark:opacity-95"
				>
					<CommentsPanel
						friendlyToken={friendlyToken}
						variant="modal"
						onExpandToggle={closeExpanded}
						isExpanded={true}
					/>
				</DialogContent>
			</Dialog>
		</>
	);
}

export function CommentsSection({ friendlyToken, variant = 'inline' }) {
	const resolvedToken = friendlyToken || getFriendlyTokenFromLocation();
	return (
		<QueryClientProvider client={commentsQueryClient}>
			<CommentsStyleTag />
			<CommentsSectionInner friendlyToken={resolvedToken} variant={variant} />
		</QueryClientProvider>
	);
}
