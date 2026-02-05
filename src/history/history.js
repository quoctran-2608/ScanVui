/**
 * History & Trends Module for ScanVui
 * Stores and manages scan history using Chrome storage
 * 
 * NOTE: This file is kept as a reference module. The actual history logic
 * is inlined in popup.js > HistoryController methods.
 */

const ScanHistory = {
  MAX_HISTORY_ITEMS: 50,
  STORAGE_KEY: 'scanvui_history',

  // Save a scan result to history
  async save(scanResult) {
    const history = await this.getAll();
    
    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      url: scanResult.url,
      hostname: new URL(scanResult.url).hostname,
      title: scanResult.title || 'Untitled',
      timestamp: Date.now(),
      scores: {
        seo: scanResult.seoScore || 0,
        accessibility: scanResult.accessibilityScore || 0,
        performance: scanResult.performanceScore || 0
      },
      stats: {
        forms: scanResult.formsCount || 0,
        inputs: scanResult.inputsCount || 0,
        links: scanResult.linksCount || 0,
        images: scanResult.imagesCount || 0
      }
    };

    history.unshift(entry);
    
    // Limit history size
    if (history.length > this.MAX_HISTORY_ITEMS) {
      history.splice(this.MAX_HISTORY_ITEMS);
    }

    await chrome.storage.local.set({ [this.STORAGE_KEY]: history });
    return entry;
  },

  // Get all history
  async getAll() {
    const result = await chrome.storage.local.get(this.STORAGE_KEY);
    return result[this.STORAGE_KEY] || [];
  },

  // Get history for a specific domain
  async getByDomain(domain) {
    const history = await this.getAll();
    return history.filter(entry => entry.hostname === domain);
  },

  // Get trend data for a domain
  async getTrend(domain) {
    const entries = await this.getByDomain(domain);
    if (entries.length < 2) return null;

    // Sort by timestamp oldest first
    entries.sort((a, b) => a.timestamp - b.timestamp);

    return {
      domain,
      entries: entries.slice(-10), // Last 10 entries
      seoTrend: this.calculateTrend(entries.map(e => e.scores.seo)),
      a11yTrend: this.calculateTrend(entries.map(e => e.scores.accessibility)),
      perfTrend: this.calculateTrend(entries.map(e => e.scores.performance))
    };
  },

  // Calculate trend direction
  calculateTrend(values) {
    if (values.length < 2) return 'stable';
    const recent = values.slice(-3);
    const older = values.slice(-6, -3);
    
    if (older.length === 0) {
      const diff = values[values.length - 1] - values[0];
      return diff > 5 ? 'up' : diff < -5 ? 'down' : 'stable';
    }

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    const diff = recentAvg - olderAvg;

    return diff > 5 ? 'up' : diff < -5 ? 'down' : 'stable';
  },

  // Delete an entry
  async delete(id) {
    const history = await this.getAll();
    const filtered = history.filter(entry => entry.id !== id);
    await chrome.storage.local.set({ [this.STORAGE_KEY]: filtered });
  },

  // Clear all history
  async clear() {
    await chrome.storage.local.remove(this.STORAGE_KEY);
  },

  // Format timestamp
  formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  }
};

if (typeof window !== 'undefined') {
  window.ScanHistory = ScanHistory;
}

