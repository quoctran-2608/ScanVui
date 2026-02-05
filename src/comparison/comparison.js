/**
 * Website Comparison Module for ScanVui
 * Compares scan results between two websites
 * 
 * NOTE: This file is kept as a reference module. The actual comparison logic
 * is inlined in popup.js > ComparisonController > compareResults() method.
 */

const WebsiteComparison = {
  // Metrics to compare
  metrics: [
    { key: 'seoScore', name: 'SEO Score', icon: '🔍', unit: '%' },
    { key: 'accessibilityScore', name: 'Accessibility', icon: '♿', unit: '%' },
    { key: 'performanceScore', name: 'Performance', icon: '⚡', unit: '%' },
    { key: 'formsCount', name: 'Forms', icon: '📝', unit: '' },
    { key: 'inputsCount', name: 'Inputs', icon: '📋', unit: '' },
    { key: 'linksCount', name: 'Links', icon: '🔗', unit: '' },
    { key: 'imagesCount', name: 'Images', icon: '🖼️', unit: '' },
    { key: 'headingsCount', name: 'Headings', icon: '📑', unit: '' }
  ],

  // Compare two scan results
  compare(resultA, resultB) {
    const comparisons = [];

    this.metrics.forEach(metric => {
      const valueA = this.extractValue(resultA, metric.key);
      const valueB = this.extractValue(resultB, metric.key);
      const diff = valueA - valueB;
      
      comparisons.push({
        ...metric,
        valueA,
        valueB,
        diff,
        winner: diff > 0 ? 'A' : diff < 0 ? 'B' : 'tie'
      });
    });

    return {
      urlA: resultA.url || 'Website A',
      urlB: resultB.url || 'Website B',
      comparisons,
      summary: this.getSummary(comparisons)
    };
  },

  // Extract value from scan result
  extractValue(result, key) {
    if (!result) return 0;
    
    switch (key) {
      case 'seoScore':
        return result.seo?.score ?? result.seoScore ?? 0;
      case 'accessibilityScore':
        return result.accessibility?.score ?? result.accessibilityScore ?? 0;
      case 'performanceScore':
        return result.performance?.score ?? result.performanceScore ?? 0;
      case 'formsCount':
        return result.forms?.length ?? result.formsCount ?? 0;
      case 'inputsCount':
        return result.totalInputs ?? result.inputsCount ?? 0;
      case 'linksCount':
        return result.links?.length ?? result.linksCount ?? 0;
      case 'imagesCount':
        return result.images?.length ?? result.imagesCount ?? 0;
      case 'headingsCount':
        return result.headingsCount ?? 0;
      default:
        return result[key] ?? 0;
    }
  },

  // Get overall summary
  getSummary(comparisons) {
    let winsA = 0, winsB = 0, ties = 0;
    comparisons.forEach(c => {
      if (c.winner === 'A') winsA++;
      else if (c.winner === 'B') winsB++;
      else ties++;
    });

    return {
      winsA,
      winsB,
      ties,
      overall: winsA > winsB ? 'A' : winsB > winsA ? 'B' : 'tie'
    };
  },

  // Format difference with color
  formatDiff(diff, unit = '') {
    if (diff === 0) return { text: '=', class: 'tie' };
    const sign = diff > 0 ? '+' : '';
    return {
      text: `${sign}${diff}${unit}`,
      class: diff > 0 ? 'better' : 'worse'
    };
  }
};

if (typeof window !== 'undefined') {
  window.WebsiteComparison = WebsiteComparison;
}

