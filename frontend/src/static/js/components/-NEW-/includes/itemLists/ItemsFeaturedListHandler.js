import { ItemsStaticListHandler } from './ItemsStaticListHandler';

export class ItemsFeaturedListHandler extends ItemsStaticListHandler {
  constructor(items, pageItems, maxItems, onItemsCount, onItemsLoad) {
    super(items, pageItems, maxItems, onItemsCount, onItemsLoad);
  }

  initialize() {
    // Only show first 8 featured items (if more exist)
    if (this.items && Array.isArray(this.items)) {
      this.items = this.items.slice(0, 8);
    }
    super.initialize();
  }
}
