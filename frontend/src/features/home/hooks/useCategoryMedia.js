/**
 * Stub hook returning an empty result set until the deferred category-source
 * work lands. The call-site interface ({ data, isLoading, isError }) is locked
 * here so that work only replaces this function body without touching callers.
 *
 * @param {string} _categoryId - Reserved for the follow-up implementation.
 */
export function useCategoryMedia(_categoryId) {
	return { data: [], isLoading: false, isError: false };
}
