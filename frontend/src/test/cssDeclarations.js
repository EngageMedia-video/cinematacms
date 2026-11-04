import postcss from 'postcss';

// Collects the declarations of every rule with a selector that contains all of
// the given fragments. Later declarations win, as in the cascade.
export function declarationsFor(source, selectorFragments) {
	const declarations = {};
	postcss.parse(source).walkRules((rule) => {
		const matches = rule.selectors.some((selector) =>
			selectorFragments.every((fragment) => selector.includes(fragment))
		);
		if (!matches) {
			return;
		}
		rule.walkDecls((declaration) => {
			declarations[declaration.prop] = declaration.value;
		});
	});
	return declarations;
}
