import {
	Children,
	createContext,
	isValidElement,
	useCallback,
	useContext,
	useId,
	useMemo,
	useRef,
	useState,
} from 'react';

const TabViewContext = createContext(null);

function joinClasses(...classes) {
	return classes.filter(Boolean).join(' ');
}

function toKebabCase(value) {
	return String(value)
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

function normalizeTabValue(title, value, index) {
	const resolvedValue = value ?? toKebabCase(title);
	return resolvedValue || `tab-${index + 1}`;
}

function flattenTabContentItems(children, items = []) {
	Children.forEach(children, (child) => {
		if (!isValidElement(child)) {
			return;
		}

		if (child.type === TabContent) {
			const index = items.length;
			items.push({
				value: normalizeTabValue(child.props.title, child.props.value, index),
				label: child.props.title,
				content: child.props.content ?? child.props.children,
				disabled: !!child.props.disabled,
				triggerClassName: child.props.triggerClassName ?? '',
				panelClassName: child.props.panelClassName ?? '',
			});
			return;
		}

		if (child.props?.children) {
			flattenTabContentItems(child.props.children, items);
		}
	});

	return items;
}

function clampTabsValue(tabs, nextValue) {
	if (!tabs.length) {
		return undefined;
	}

	const resolved = tabs.find((tab) => tab.value === nextValue && !tab.disabled);
	if (resolved) {
		return resolved.value;
	}

	return tabs.find((tab) => !tab.disabled)?.value ?? tabs[0]?.value;
}

function findAdjacentTabValue(tabs, currentValue, step) {
	const enabledTabs = tabs.filter((tab) => !tab.disabled);

	if (!enabledTabs.length) {
		return undefined;
	}

	const currentIndex = enabledTabs.findIndex((tab) => tab.value === currentValue);
	const nextIndex = currentIndex === -1 ? 0 : (currentIndex + step + enabledTabs.length) % enabledTabs.length;

	return enabledTabs[nextIndex]?.value;
}

function useTabViewContext(componentName) {
	const context = useContext(TabViewContext);

	if (!context) {
		throw new Error(`${componentName} must be used within TabView.`);
	}

	return context;
}

function TabViewList({ items, className = '', triggerClassName = '' }) {
	const { ariaLabel, tabMode } = useTabViewContext('TabViewList');

	return (
		<div className="w-full overflow-x-auto">
			<div
				role="tablist"
				aria-label={ariaLabel}
				className={joinClasses(
					'flex overflow-hidden rounded-sm bg-cinemata-pacific-deep-800 p-0',
					tabMode === 'wrap' ? 'w-max min-w-0' : 'min-w-full',
					className
				)}
			>
				{items.map((item) => (
					<TabViewTrigger
						key={item.value}
						value={item.value}
						disabled={item.disabled}
						className={joinClasses(triggerClassName, item.triggerClassName)}
					>
						{item.label}
					</TabViewTrigger>
				))}
			</div>
		</div>
	);
}

function TabViewTrigger({ children, value, disabled = false, className = '' }) {
	const { focusTrigger, getPanelId, getTabId, registerTrigger, selectedValue, selectValue, tabs, tabMode } =
		useTabViewContext('TabViewTrigger');
	const isSelected = selectedValue === value;

	function selectAndFocus(nextValue) {
		if (!nextValue) {
			return;
		}

		selectValue(nextValue);
		focusTrigger(nextValue);
	}

	return (
		<button
			ref={(node) => registerTrigger(value, node)}
			type="button"
			role="tab"
			id={getTabId(value)}
			aria-selected={isSelected}
			aria-controls={getPanelId(value)}
			tabIndex={isSelected ? 0 : -1}
			disabled={disabled}
			onClick={() => selectValue(value)}
			onKeyDown={(event) => {
				if (event.key === 'ArrowRight') {
					event.preventDefault();
					selectAndFocus(findAdjacentTabValue(tabs, value, 1));
				}

				if (event.key === 'ArrowLeft') {
					event.preventDefault();
					selectAndFocus(findAdjacentTabValue(tabs, value, -1));
				}

				if (event.key === 'Home') {
					event.preventDefault();
					selectAndFocus(tabs.find((tab) => !tab.disabled)?.value);
				}

				if (event.key === 'End') {
					event.preventDefault();
					selectAndFocus([...tabs].reverse().find((tab) => !tab.disabled)?.value);
				}
			}}
			className={joinClasses(
				'body-body-14-bold cursor-pointer whitespace-nowrap border-0 px-4 py-4 text-cinemata-white uppercase tracking-[0.02em] transition-colors duration-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
				tabMode === 'wrap' ? 'min-w-0 flex-none' : 'min-w-[160px] flex-1',
				isSelected ? 'bg-cinemata-strait-blue-800' : 'bg-transparent',
				className
			)}
		>
			{children}
		</button>
	);
}

function TabViewPanel({ item, className = '' }) {
	const { getPanelId, getTabId, selectedValue } = useTabViewContext('TabViewPanel');

	if (!item || selectedValue !== item.value) {
		return null;
	}

	return (
		<div
			role="tabpanel"
			id={getPanelId(item.value)}
			aria-labelledby={getTabId(item.value)}
			className={joinClasses('mt-4 w-full', className, item.panelClassName)}
		>
			{item.content}
		</div>
	);
}

export function TabContent() {
	return null;
}

export function TabView({
	children,
	selectedTab,
	defaultSelectedTab,
	onSelectedTabChange,
	className = '',
	listClassName = '',
	triggerClassName = '',
	panelClassName = '',
	tabMode = 'fill',
	'aria-label': ariaLabel = 'Tabs',
}) {
	const generatedId = useId();
	const tabs = useMemo(() => flattenTabContentItems(children), [children]);
	const triggerRefs = useRef(new Map());
	const [internalValue, setInternalValue] = useState(() => clampTabsValue(tabs, defaultSelectedTab));
	const selectedValue = clampTabsValue(tabs, selectedTab ?? internalValue);
	const selectedItem = tabs.find((tab) => tab.value === selectedValue) ?? tabs[0];

	const selectValue = useCallback(
		(nextValue) => {
			const resolvedValue = clampTabsValue(tabs, nextValue);

			if (selectedTab === undefined) {
				setInternalValue(resolvedValue);
			}

			if (resolvedValue !== undefined) {
				onSelectedTabChange?.(resolvedValue);
			}
		},
		[tabs, selectedTab, onSelectedTabChange]
	);

	const registerTrigger = useCallback((tabValue, node) => {
		if (!tabValue) {
			return;
		}

		if (node) {
			triggerRefs.current.set(tabValue, node);
			return;
		}

		triggerRefs.current.delete(tabValue);
	}, []);

	const focusTrigger = useCallback((tabValue) => {
		if (!tabValue) {
			return;
		}

		requestAnimationFrame(() => {
			triggerRefs.current.get(tabValue)?.focus();
		});
	}, []);

	const contextValue = useMemo(
		() => ({
			ariaLabel,
			focusTrigger,
			getPanelId: (tabValue) => `${generatedId}-panel-${tabValue}`,
			getTabId: (tabValue) => `${generatedId}-tab-${tabValue}`,
			registerTrigger,
			selectedValue,
			selectValue,
			tabMode,
			tabs,
		}),
		[ariaLabel, focusTrigger, generatedId, registerTrigger, selectedValue, selectValue, tabMode, tabs]
	);

	return (
		<TabViewContext.Provider value={contextValue}>
			<div className={joinClasses('w-full', className)}>
				<TabViewList items={tabs} className={listClassName} triggerClassName={triggerClassName} />
				<TabViewPanel item={selectedItem} className={panelClassName} />
			</div>
		</TabViewContext.Provider>
	);
}
