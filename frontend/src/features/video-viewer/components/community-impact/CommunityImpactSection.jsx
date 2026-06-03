import PropTypes from 'prop-types';
import { useEffect, useMemo, useState } from 'react';
import { Button, Text } from '../../../shared/components';
import { AddImpactDialog } from './AddImpactDialog';
import { ImpactCard } from './ImpactCard';
import { ImpactEmptyState } from './ImpactEmptyState';
import { COMMUNITY_IMPACT_CATEGORIES } from './impactIcons';

function hasListEntries(category) {
	return Array.isArray(category)
		? category.length > 0
		: Array.isArray(category?.entries) && category.entries.length > 0;
}

function hasSummaryEntries(category) {
	if (!category) {
		return false;
	}

	if (Array.isArray(category)) {
		return category.length > 0;
	}

	if (typeof category.totalCount === 'number') {
		return category.totalCount > 0;
	}

	if (category.totalCount && typeof category.totalCount === 'object') {
		return Object.values(category.totalCount).some((value) => Number(value) > 0);
	}

	return hasListEntries(category);
}

function normalizeEntry(entry) {
	return {
		...entry,
		date: entry.date || entry.event_date,
		title: entry.title || entry.location || '',
		url: entry.url || entry.link || '',
	};
}

function normalizeCategoryData(data = {}) {
	if (Array.isArray(data)) {
		return {
			entries: data.map(normalizeEntry),
			totalCount: data.length,
		};
	}

	const entries = Array.isArray(data.entries) ? data.entries.map(normalizeEntry) : [];
	return {
		...data,
		entries,
		totalCount: data.totalCount ?? entries.length,
	};
}

function getTotalCountNumber(totalCount) {
	if (typeof totalCount === 'number') {
		return totalCount;
	}

	if (totalCount && typeof totalCount === 'object') {
		return Object.values(totalCount).reduce((sum, value) => sum + (Number(value) || 0), 0);
	}

	return 0;
}

function buildCardProps(variant, data = {}) {
	const total = getTotalCountNumber(data.totalCount ?? data.entries?.length);

	if (variant === 'screening') {
		return { title: 'Screened In', subtitle: `This film has been screened ${total}x` };
	}

	if (variant === 'featured') {
		return { title: 'Featured In', subtitle: `This film has been featured ${total}x` };
	}

	if (variant === 'curated') {
		return {
			title: 'Curated Into',
			subtitle: `This film has been curated into ${total} ${total === 1 ? 'collection' : 'collections'}`,
		};
	}

	if (variant === 'saves') {
		return { title: 'Saves & Playlists', subtitle: `${total.toLocaleString()} reported community uses` };
	}

	return { title: 'Academic Usage', subtitle: `Used in ${total.toLocaleString()} academic contexts` };
}

export function CommunityImpactSection({
	canAdd = true,
	entries = {},
	onAddImpact,
	onSubmitErrorClear,
	submitError = null,
	submitMessage = '',
	submitStatus = 'idle',
}) {
	const [dialogOpen, setDialogOpen] = useState(false);
	const cards = useMemo(
		() =>
			COMMUNITY_IMPACT_CATEGORIES.map(({ value }) => {
				const data = normalizeCategoryData(entries[value] ?? {});
				return {
					...buildCardProps(value, data),
					...data,
					variant: value,
				};
			})
				.filter((card) => card.variant !== 'curated')
				.filter((card) =>
					card.variant === 'saves' || card.variant === 'academic'
						? hasSummaryEntries(card)
						: hasListEntries(card)
				),
		[entries]
	);
	const populated = cards.length > 0;

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

	return (
		<section aria-labelledby="community-impact-heading" className="w-full text-text-primary">
			<div className="flex flex-col gap-space-base lg:flex-row lg:items-center lg:justify-between">
				<div className="max-w-[calc(var(--size-96)*6+var(--size-64))]">
					<Text id="community-impact-heading" variant="h5-bold" as="h2" className="m-0 text-text-primary">
						Film&apos;s Impact
					</Text>
					<Text variant="body-14" color="meta" className="m-0 mt-space-xs">
						For filmmakers & viewers. Add screenings, playlists, or discussions to show how this film is
						reaching people.
					</Text>
				</div>

				{canAdd ? (
					<Button
						className="w-full justify-center focus-visible:ring-2 focus-visible:ring-ring-focus sm:w-fit"
						onClick={handleAddClick}
					>
						ADD IMPACT
					</Button>
				) : null}
			</div>

			{submitMessage ? (
				<Text as="p" variant="body-14-bold" color="accent" className="m-0 mt-space-sm" aria-live="polite">
					{submitMessage}
				</Text>
			) : null}

			<div className="mt-space-lg">
				{populated ? (
					<div className="grid grid-cols-1 gap-space-base lg:grid-cols-2">
						{cards.map((card) => (
							<ImpactCard key={card.variant} {...card} />
						))}
					</div>
				) : (
					<ImpactEmptyState canAdd={canAdd} onAddImpact={handleAddClick} />
				)}
			</div>

			<AddImpactDialog
				open={dialogOpen}
				onClose={() => setDialogOpen(false)}
				onSubmit={handleSubmit}
				onSubmitErrorClear={onSubmitErrorClear}
				submitError={submitError}
				submitting={submitStatus === 'submitting'}
			/>
		</section>
	);
}

const listEntryShape = PropTypes.shape({
	date: PropTypes.string,
	title: PropTypes.string.isRequired,
	url: PropTypes.string,
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
	entries: PropTypes.shape({
		academic: PropTypes.oneOfType([
			PropTypes.arrayOf(listEntryShape),
			PropTypes.shape({
				label: PropTypes.string,
				lastReportedAt: PropTypes.string,
				totalCount: PropTypes.number,
			}),
		]),
		featured: entryCategoryShape,
		curated: entryCategoryShape,
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
