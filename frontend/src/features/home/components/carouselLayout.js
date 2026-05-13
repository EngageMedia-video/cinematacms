export const CAROUSEL_MAX_VISIBLE_COUNT = 4;
export const CAROUSEL_MIN_ITEM_WIDTH_PX = 220;
export const CAROUSEL_GAP_PX = 16;

export const CAROUSEL_RESPONSIVE_VISIBLE_COUNT_QUERIES = [
	{ query: '(max-width: 639px)', visibleCount: 1 },
	{ query: '(max-width: 1023px)', visibleCount: 2 },
];

const CAROUSEL_MAX_VISIBLE_GAP_PX = (CAROUSEL_MAX_VISIBLE_COUNT - 1) * CAROUSEL_GAP_PX;

export const CAROUSEL_GRID_TEMPLATE_COLUMNS = `repeat(auto-fill, minmax(min(100%, max(${CAROUSEL_MIN_ITEM_WIDTH_PX}px, calc((100% - ${CAROUSEL_MAX_VISIBLE_GAP_PX}px) / ${CAROUSEL_MAX_VISIBLE_COUNT}))), 1fr))`;
