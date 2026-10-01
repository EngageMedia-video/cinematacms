import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { defineChart, lineY } from '@tanstack/charts';
import { Chart } from '@tanstack/charts/react/tooltip';
import { scaleLinear } from '@tanstack/charts/scales/linear';
import { scalePoint } from '@tanstack/charts/scales/point';
import { tooltip } from '@tanstack/charts/tooltip';
import { Text } from '../Text';
import { cn } from '../../utils/classNames';

const COLORS = { primary: 'text-text-link', secondary: 'text-text-secondary', success: 'text-text-success' };

/** A single numeric series with categorical x values; formatting belongs to the caller. */
export function LineChart({
	data,
	xKey,
	yKey,
	label,
	xTicks,
	yMax,
	formatX = String,
	formatY = String,
	formatTooltipTitle = formatX,
	formatTooltipValue = formatY,
	color = 'primary',
	height = 220,
	className = '',
}) {
	const host = useRef(null);
	const [fontSize, setFontSize] = useState();
	useLayoutEffect(() => {
		// TanStack measures axis labels in pixels; resolve the shared body typography.
		const size = parseFloat(getComputedStyle(host.current).fontSize);
		if (Number.isFinite(size)) setFontSize(size);
	}, []);
	const definition = useMemo(() => {
		const maximum = yMax ?? Math.max(1, ...data.map((row) => row[yKey]));
		return defineChart({
			marks: [lineY(data, { x: xKey, y: yKey, stroke: 'currentColor', strokeWidth: 3 })],
			scales: {
				x: {
					scale: () => scalePoint().padding(0.2),
					axis: {
						line: false,
						ticks: { values: xTicks, size: 0, padding: 12, format: formatX },
						tickLabels: { fontSize, opacity: 1, thin: true },
					},
				},
				y: {
					scale: scaleLinear().domain([0, maximum]),
					nice: yMax == null,
					grid: { strokeOpacity: 0.5 },
					axis: {
						line: false,
						ticks: { count: Math.min(4, maximum), size: 0, format: formatY },
						tickLabels: { fontSize, opacity: 1 },
					},
				},
			},
			tooltip: { use: tooltip },
		});
	}, [data, xKey, yKey, xTicks, yMax, formatX, formatY, fontSize]);
	return (
		<Text
			as="div"
			ref={host}
			variant="body-14"
			role="group"
			aria-label={label}
			className={cn(
				'min-w-0 [&_svg_text]:fill-text-primary [&_svg_line]:stroke-border-default',
				COLORS[color],
				className
			)}
			style={{
				'--ts-chart-tooltip-background': 'var(--bg-surface-raised)',
				'--ts-chart-tooltip-color': 'var(--text-strong)',
				'--ts-chart-tooltip-border': '1px solid var(--border-subtle)',
				'--ts-chart-tooltip-border-radius': 'var(--radius-8)',
				'--ts-chart-tooltip-padding': 'var(--size-6) var(--size-12)',
				'--ts-chart-tooltip-font': 'inherit',
				'--ts-chart-tooltip-shadow': 'none',
			}}
		>
			<Chart
				definition={definition}
				height={height}
				ariaLabel={label}
				renderTooltipBody={({ points }) =>
					points.length ? (
						<div>
							<Text as="p" variant="body-12" color="meta" className="m-0">
								{formatTooltipTitle(points[0].xValue)}
							</Text>
							<Text as="p" variant="body-14-medium" className="m-0 tabular-nums">
								{formatTooltipValue(points[0].yValue)}
							</Text>
						</div>
					) : null
				}
			/>
		</Text>
	);
}
