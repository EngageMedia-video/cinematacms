import PropTypes from 'prop-types';
import { Button, Icon, Text } from '../../../shared/components';
import { getImpactIconConfig } from './impactIcons';

export function ImpactEmptyState({ canAdd = true, onAddImpact }) {
	const heartConfig = getImpactIconConfig('heart');

	return (
		<div className="flex min-h-[calc(var(--size-96)*3+var(--size-64)+var(--size-8))] flex-col items-center justify-center rounded-ds-8 border border-border-default bg-bg-surface px-space-lg py-space-2xl text-center">
			<span
				className={`${heartConfig.iconShellClassName} inline-flex h-size-64 w-size-64 items-center justify-center rounded-full`}
				aria-hidden="true"
			>
				<Icon name={heartConfig.iconName} size="lg" decorative />
			</span>
			<Text variant="h5" as="h3" className="m-0 mt-space-lg text-text-primary">
				Where this film has made an impact?
			</Text>
			<Text variant="body-14" color="meta" className="m-0 mt-space-sm max-w-[calc(var(--size-96)*5)]">
				Share screenings, features, saves, playlists, or academic use so the community can see how this film
				travels.
			</Text>
			{canAdd ? (
				<Button
					className="mt-space-lg focus-visible:ring-2 focus-visible:ring-ring-focus"
					onClick={onAddImpact}
				>
					ADD IMPACT
				</Button>
			) : null}
		</div>
	);
}

ImpactEmptyState.propTypes = {
	canAdd: PropTypes.bool,
	onAddImpact: PropTypes.func,
};
