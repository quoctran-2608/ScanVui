/**
 * X-Ray Vision Module for ScanVui
 * Highlights different types of elements on the page with distinct colors
 *
 * NOTE: This file is kept as a reference module. The actual X-Ray logic
 * is inlined in popup.js > XRayController > injectXRay() method
 * because Chrome Extension requires functions to be serializable when
 * using chrome.scripting.executeScript().
 */

const XRayVision = {
  // Configuration for element types and their colors
  config: {
    forms: { color: '#22c55e', label: 'Forms', selector: 'form' },
    inputs: { color: '#3b82f6', label: 'Inputs', selector: 'input, select, textarea, [contenteditable="true"]' },
    buttons: { color: '#eab308', label: 'Buttons', selector: 'button, input[type="button"], input[type="submit"], [role="button"]' },
    links: { color: '#a855f7', label: 'Links', selector: 'a[href]' },
    headings: { color: '#ef4444', label: 'Headings', selector: 'h1, h2, h3, h4, h5, h6' },
    images: { color: '#f97316', label: 'Images', selector: 'img, svg, picture' },
    media: { color: '#ec4899', label: 'Media', selector: 'video, audio, iframe' },
    semantic: { color: '#06b6d4', label: 'Semantic', selector: 'header, nav, main, article, section, aside, footer' }
  },

  // Track active overlays
  overlayContainer: null,
  isActive: false,
  activeTypes: new Set(),

  // Initialize X-Ray mode
  init() {
    this.createOverlayContainer();
    this.addStyles();
  },

  // Create container for overlays
  createOverlayContainer() {
    this.removeOverlayContainer();
    this.overlayContainer = document.createElement('div');
    this.overlayContainer.id = 'scanvui-xray-container';
    this.overlayContainer.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 999998;';
    document.body.appendChild(this.overlayContainer);
  },

  // Remove overlay container
  removeOverlayContainer() {
    const existing = document.getElementById('scanvui-xray-container');
    if (existing) existing.remove();
    const style = document.getElementById('scanvui-xray-styles');
    if (style) style.remove();
  },

  // Add CSS styles for overlays
  addStyles() {
    const style = document.createElement('style');
    style.id = 'scanvui-xray-styles';
    style.textContent = `
      .scanvui-xray-overlay {
        position: fixed;
        pointer-events: none;
        border-width: 2px;
        border-style: solid;
        border-radius: 3px;
        transition: opacity 0.2s;
        box-sizing: border-box;
      }
      .scanvui-xray-label {
        position: absolute;
        top: -18px;
        left: -2px;
        font-size: 10px;
        font-weight: 600;
        padding: 1px 4px;
        border-radius: 2px 2px 0 0;
        color: white;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        white-space: nowrap;
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    `;
    document.head.appendChild(style);
  },

  // Highlight elements of a specific type
  highlightType(type) {
    const config = this.config[type];
    if (!config) return;

    const elements = document.querySelectorAll(config.selector);
    elements.forEach((el, index) => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      if (rect.top > window.innerHeight || rect.bottom < 0) return;
      if (rect.left > window.innerWidth || rect.right < 0) return;

      const overlay = document.createElement('div');
      overlay.className = 'scanvui-xray-overlay';
      overlay.dataset.xrayType = type;
      overlay.style.cssText = `
        top: ${rect.top}px;
        left: ${rect.left}px;
        width: ${rect.width}px;
        height: ${rect.height}px;
        border-color: ${config.color};
        background-color: ${config.color}20;
      `;

      // Add label for first few elements or larger elements
      if (index < 5 || rect.height > 50) {
        const label = document.createElement('span');
        label.className = 'scanvui-xray-label';
        label.style.backgroundColor = config.color;
        const tagName = el.tagName.toLowerCase();
        const id = el.id ? `#${el.id}` : '';
        const name = el.name ? `[${el.name}]` : '';
        label.textContent = `${tagName}${id}${name}`;
        overlay.appendChild(label);
      }

      this.overlayContainer.appendChild(overlay);
    });

    this.activeTypes.add(type);
  },

  // Remove highlights for a specific type
  removeType(type) {
    const overlays = this.overlayContainer.querySelectorAll(`[data-xray-type="${type}"]`);
    overlays.forEach(el => el.remove());
    this.activeTypes.delete(type);
  },

  // Toggle a specific type
  toggleType(type, enabled) {
    if (enabled) {
      this.highlightType(type);
    } else {
      this.removeType(type);
    }
  },

  // Refresh all active overlays (on scroll/resize)
  refresh() {
    const types = Array.from(this.activeTypes);
    this.clearAll();
    types.forEach(type => this.highlightType(type));
  },

  // Clear all overlays
  clearAll() {
    if (this.overlayContainer) {
      this.overlayContainer.innerHTML = '';
    }
    this.activeTypes.clear();
  },

  // Enable X-Ray mode
  enable(types = []) {
    this.isActive = true;
    this.init();
    types.forEach(type => this.highlightType(type));
    
    // Add scroll/resize listeners
    this._scrollHandler = () => this.refresh();
    window.addEventListener('scroll', this._scrollHandler, { passive: true });
    window.addEventListener('resize', this._scrollHandler, { passive: true });
  },

  // Disable X-Ray mode
  disable() {
    this.isActive = false;
    this.clearAll();
    this.removeOverlayContainer();
    
    if (this._scrollHandler) {
      window.removeEventListener('scroll', this._scrollHandler);
      window.removeEventListener('resize', this._scrollHandler);
    }
  }
};

// Expose to window for injection
window.ScanVuiXRay = XRayVision;

