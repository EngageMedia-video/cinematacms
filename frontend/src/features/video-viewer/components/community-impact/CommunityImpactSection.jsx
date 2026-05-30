import PropTypes from 'prop-types';
import { useMemo, useState } from 'react';
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

function hasImpactEntries(entries) {
	return COMMUNITY_IMPACT_CATEGORIES.some(({ value }) => {
		const category = entries?.[value];
		return value === 'saves' || value === 'academic' ? hasSummaryEntries(category) : hasListEntries(category);
	});
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

function buildCardProps(variant, data = {}) {
	const totalCount = data.totalCount ?? data.entries?.length ?? 0;
	const numericTotal = Number(totalCount) || data.entries?.length || 0;

	if (variant === 'screening') {
		return {
			subtitle: `This film has been screened ${numericTotal}x`,
			title: 'Screened In',
		};
	}

	if (variant === 'featured') {
		return {
			subtitle: `This film has been featured ${numericTotal}x`,
			title: 'Featured In',
		};
	}

	if (variant === 'curated') {
		return {
			subtitle: `This film has been curated into ${numericTotal} ${numericTotal === 1 ? 'collection' : 'collections'}`,
			title: 'Curated Into',
		};
	}

	if (variant === 'saves') {
		if (typeof totalCount === 'number') {
			return {
				subtitle: `${totalCount.toLocaleString()} reported community uses`,
				title: 'Saves & Playlists',
			};
		}

		const saves = Number(totalCount?.saves) || 0;
		const playlists = Number(totalCount?.playlists) || 0;

		return {
			subtitle: `${saves.toLocaleString()} saves and ${playlists.toLocaleString()} playlists`,
			title: 'Saves & Playlists',
		};
	}

	return {
		subtitle: `Used in ${(Number(totalCount) || 0).toLocaleString()} ${data.label || 'academic contexts'}`,
		title: 'Academic Usage',
	};
}

export function CommunityImpactSection({ canAdd = true, entries = {}, onAddImpact }) {
	const [dialogOpen, setDialogOpen] = useState(false);
	const populated = hasImpactEntries(entries);
	const cards = useMemo(
		() =>
			COMMUNITY_IMPACT_CATEGORIES.map(({ value }) => {
				const data = normalizeCategoryData(entries[value] ?? {});
				return {
					...buildCardProps(value, data),
					...data,
					variant: value,
				};
			}).filter((card) =>
				card.variant === 'saves' || card.variant === 'academic' ? hasSummaryEntries(card) : hasListEntries(card)
			),
		[entries]
	);

	function handleAddClick() {
		setDialogOpen(true);
	}

	function handleSubmit(values) {
		onAddImpact?.(values);
	}

	return (
		<section aria-labelledby="community-impact-heading" className="w-full bg-bg-page text-text-primary">
			<div className="flex flex-col gap-space-base lg:flex-row lg:items-start lg:justify-between">
				<div className="max-w-[calc(var(--size-96)*6+var(--size-64))]">
					<Text id="community-impact-heading" variant="h4-medium" as="h2" className="m-0 text-text-primary">
						Film&apos;s Impact
					</Text>
					<Text variant="body-14" color="meta" className="m-0 mt-space-xs">
						Track where this film has been screened, featured, saved, and used for learning.
					</Text>
				</div>

				{canAdd && populated ? (
					<Button
						className="w-full justify-center focus-visible:ring-2 focus-visible:ring-ring-focus sm:w-fit"
						onClick={handleAddClick}
					>
						ADD IMPACT
					</Button>
				) : null}
			</div>

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

			<AddImpactDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onSubmit={handleSubmit} />
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
};
