import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Icon } from '../Icon.jsx';
import { iconNames } from '../iconRegistry.js';

describe('iconRegistry', () => {
	it('auto-registers shared icons from filenames', () => {
		expect(iconNames).toContain('exampleIcon');
	});
});

describe('Icon', () => {
	it('renders a registered icon as decorative by default', () => {
		const { container } = render(<Icon name="exampleIcon" />);
		const svg = container.querySelector('svg[data-icon="exampleIcon"]');

		expect(svg).not.toBeNull();
		expect(svg).toHaveAttribute('aria-hidden', 'true');
		expect(svg).not.toHaveAttribute('role');
	});

	it('renders an accessible icon when a label is provided', () => {
		render(<Icon name="exampleIcon" label="Example icon" />);

		expect(screen.getByRole('img', { name: 'Example icon' })).toBeInTheDocument();
	});

	it('applies numeric sizing through inline styles', () => {
		const { container } = render(<Icon name="exampleIcon" size={30} />);
		const svg = container.querySelector('svg[data-icon="exampleIcon"]');

		expect(svg).toHaveStyle({ width: '30px', height: '30px' });
	});

	it('warns once and renders nothing for unknown icons', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const { container, rerender } = render(<Icon name="missingIcon" />);

		expect(container.querySelector('svg')).toBeNull();
		expect(warnSpy).toHaveBeenCalledTimes(1);

		rerender(<Icon name="missingIcon" />);
		expect(warnSpy).toHaveBeenCalledTimes(1);

		warnSpy.mockRestore();
	});
});
