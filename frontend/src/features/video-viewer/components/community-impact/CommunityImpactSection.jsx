import PropTypes from 'prop-types';
import { useEffect, useId, useMemo, useState } from 'react';
import { Button, Text } from '../../../shared/components';
import { AddImpactDialog } from './AddImpactDialog';
import { ImpactCard } from './ImpactCard';
import { ImpactEmptyState } from './ImpactEmptyState';
import { buildImpactCards } from './utils/buildImpactCards';

export function CommunityImpactSection({
	canAdd = true,
	description = 'For filmmakers & viewers. A list of where the film has been screened, written about, taught, or recognised',
	entries = {},
	onAddImpact,
	onSubmitErrorClear,
	submitError = null,
	submitMessage = '',
	submitStatus = 'idle',
	title = "Film's Impact",
}) {
	const [dialogOpen, setDialogOpen] = useState(false);
	const headingId = useId();
	const cards = useMemo(() => buildImpactCards(entries), [entries]);
	const summaryCards = cards.filter((card) => card.layout === 'summary');
	const listCards = cards.filter((card) => card.layout === 'list');

	useEffect(() => {
		if (submitStatus === 'success') {
			setDialogOpen(false);
		}
	}, [submitStatus]);

	function handleAddClick() {
		setDialogOpen(true);
	}

	function handleSubmit(values) {
		onAddImpact?.(values);
	}

	function renderCard(card) {
		return (
			<ImpactCard
				key={card.key}
				entries={card.entries}
				iconName={card.iconName}
				iconShellClassName={card.iconShellClassName}
				label={card.label}
				layout={card.layout}
				subtitle={card.subtitle}
				value={card.value}
				variant={card.key}
			/>
		);
	}

	return (
		<section aria-labelledby={headingId} className="@container flex w-full flex-col gap-4 text-text-primary">
			<h2 id={headingId} className="sr-only">
				{title}
			</h2>

			<div className="flex flex-col gap-4 @lg:flex-row @lg:items-center @lg:justify-between">
				<p className="body-body-14-regular m-0 max-w-[461px] text-text-description">{description}</p>

				{canAdd ? (
					<Button
						className="h-10 w-full shrink-0 justify-center bg-bg-secondary px-4 py-0 text-text-on-primary hover:bg-bg-secondary-hover focus-visible:ring-2 focus-visible:ring-ring-focus @lg:w-fit"
						onClick={handleAddClick}
					>
						ADD IMPACT
					</Button>
				) : null}
			</div>

			{submitMessage ? (
				<Text as="p" variant="body-14-bold" color="accent" className="m-0" aria-live="polite">
					{submitMessage}
				</Text>
			) : null}

			<hr className="m-0 border-0 border-t border-border-divider" />

			{cards.length ? (
				<div className="flex flex-col gap-4">
					{summaryCards.length ? (
						<div className="grid grid-cols-1 items-start gap-4 @lg:grid-cols-2 @4xl:grid-cols-4">
							{summaryCards.map(renderCard)}
						</div>
					) : null}
					{listCards.length ? (
						<div className="grid grid-cols-1 gap-4 @2xl:grid-cols-2 @5xl:grid-cols-3">
							{listCards.map(renderCard)}
						</div>
					) : null}
				</div>
			) : (
				<ImpactEmptyState canAdd={canAdd} onAddImpact={handleAddClick} />
			)}

			<AddImpactDialog
				open={dialogOpen}
				onClose={() => {
					setDialogOpen(false);
					if (submitError) {
						onSubmitErrorClear?.();
					}
				}}
				onSubmit={handleSubmit}
				onSubmitErrorClear={onSubmitErrorClear}
				submitError={submitError}
				submitting={submitStatus === 'submitting'}
			/>
		</section>
	);
}

const listEntryShape = PropTypes.shape({
	category: PropTypes.string,
	date: PropTypes.string,
	summary: PropTypes.string,
	title: PropTypes.string.isRequired,
	url: PropTypes.string,
	year: PropTypes.number,
});

const entryCategoryShape = PropTypes.oneOfType([
	PropTypes.arrayOf(listEntryShape),
	PropTypes.shape({
		entries: PropTypes.arrayOf(listEntryShape),
		totalCount: PropTypes.number,
	}),
]);

CommunityImpactSection.propTypes = {
	canAdd: PropTypes.bool,
	description: PropTypes.string,
	title: PropTypes.string,
	entries: PropTypes.shape({
		academic: PropTypes.oneOfType([
			PropTypes.arrayOf(listEntryShape),
			PropTypes.shape({
				label: PropTypes.string,
				lastReportedAt: PropTypes.string,
				totalCount: PropTypes.number,
			}),
		]),
		article: entryCategoryShape,
		award: entryCategoryShape,
		featured: entryCategoryShape,
		curated: entryCategoryShape,
		referenced: entryCategoryShape,
		saves: PropTypes.oneOfType([
			PropTypes.arrayOf(listEntryShape),
			PropTypes.shape({
				lastEventAt: PropTypes.string,
				totalCount: PropTypes.shape({
					playlists: PropTypes.number,
					saves: PropTypes.number,
				}),
			}),
		]),
		screening: entryCategoryShape,
		teaching: entryCategoryShape,
	}),
	onAddImpact: PropTypes.func,
	onSubmitErrorClear: PropTypes.func,
	submitError: PropTypes.shape({
		field: PropTypes.string,
		message: PropTypes.string.isRequired,
	}),
	submitMessage: PropTypes.string,
	submitStatus: PropTypes.oneOf(['idle', 'submitting', 'success', 'error']),
};
