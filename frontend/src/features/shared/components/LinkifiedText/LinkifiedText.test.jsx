import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LinkifiedText } from './LinkifiedText';

describe('LinkifiedText', () => {
	it('renders a bare URL as a nofollow link that opens in the same tab', () => {
		const { container } = render(<LinkifiedText text="Screening at https://cinemata.org/watch." />);

		const link = screen.getByRole('link', { name: 'https://cinemata.org/watch' });
		expect(link).toHaveAttribute('href', 'https://cinemata.org/watch');
		expect(link).toHaveAttribute('rel', 'nofollow noopener');
		expect(link).not.toHaveAttribute('target');
		expect(container.textContent).toBe('Screening at https://cinemata.org/watch.');
	});

	it('links a bare www host over https', () => {
		render(<LinkifiedText text="Visit www.engagemedia.org today" />);

		expect(screen.getByRole('link', { name: 'www.engagemedia.org' })).toHaveAttribute(
			'href',
			'https://www.engagemedia.org/'
		);
	});

	it('escapes author markup instead of rendering it', () => {
		const { container } = render(
			<LinkifiedText text={'<img src=x onerror="alert(1)"> <a href="javascript:alert(1)">x</a>'} />
		);

		expect(container.querySelector('img')).toBeNull();
		expect(screen.queryByRole('link')).not.toBeInTheDocument();
		expect(container.textContent).toBe('<img src=x onerror="alert(1)"> <a href="javascript:alert(1)">x</a>');
	});

	it('leaves a clipped trailing URL as text when trailing links are not allowed', () => {
		const { container } = render(<LinkifiedText text="Watch https://cinemata.org/wat" allowTrailingLink={false} />);

		expect(screen.queryByRole('link')).not.toBeInTheDocument();
		expect(container.textContent).toBe('Watch https://cinemata.org/wat');
	});

	it('formats only the text between links', () => {
		const seen = [];
		const { container } = render(
			<LinkifiedText
				text="at 1:30 see https://example.org/clip?t=2:45 now"
				renderText={(value) => {
					seen.push(value);
					return <em>{value}</em>;
				}}
			/>
		);

		expect(seen).toEqual(['at 1:30 see ', ' now']);
		expect(container.querySelectorAll('em')).toHaveLength(2);
		expect(screen.getByRole('link', { name: 'https://example.org/clip?t=2:45' })).toBeInTheDocument();
	});

	it('renders nothing for empty text', () => {
		const { container } = render(<LinkifiedText text="" />);

		expect(container).toBeEmptyDOMElement();
	});
});
