import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Icon } from './Icon.jsx';
import { getIconComponent, iconNames } from './iconRegistry.js';

describe('iconRegistry', () => {
	it('auto-registers shared icons from filenames', () => {
		expect(iconNames).toContain('caretCircleRight');
		expect(iconNames).toContain('example');
		expect(iconNames).toContain('magnifyingGlass');
		expect(iconNames).toContain('infoCircle');
		expect(iconNames).toContain('info3d');
		expect(iconNames).toContain('eye');
		expect(iconNames).toContain('eyeSlash');
		expect(iconNames).toContain('upload');
		expect(iconNames).toContain('uploadSmall');
		expect(iconNames).toContain('moon');
		expect(iconNames).toContain('sun');
		expect(iconNames).toContain('infoYellow');
	});

	it('does not resolve inherited Object.prototype keys as icons', () => {
		expect(getIconComponent('toString')).toBeNull();
	});
});

describe('Icon', () => {
	it('renders a registered icon as decorative by default', () => {
		const { container } = render(<Icon name="example" />);
		const svg = container.querySelector('svg[data-icon="example"]');

		expect(svg).not.toBeNull();
		expect(svg).toHaveAttribute('aria-hidden', 'true');
		expect(svg).not.toHaveAttribute('role');
	});

	it('renders an accessible icon when a label is provided', () => {
		render(<Icon name="example" label="Example icon" />);

		expect(screen.getByRole('img', { name: 'Example icon' })).toBeInTheDocument();
	});

	it('applies numeric sizing through inline styles', () => {
		const { container } = render(<Icon name="example" size={30} />);
		const svg = container.querySelector('svg[data-icon="example"]');

		expect(svg).toHaveStyle({ width: '30px', height: '30px' });
	});

	it('warns once and renders nothing for unknown icons', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const uniqueName = `missingIcon_${Date.now()}_${Math.random()}`;
		const { container, rerender } = render(<Icon name={uniqueName} />);

		expect(container.querySelector('svg')).toBeNull();
		expect(warnSpy).toHaveBeenCalledTimes(1);
		rerender(<Icon name={uniqueName} />);
		expect(warnSpy).toHaveBeenCalledTimes(1);

		warnSpy.mockRestore();
	});
});
