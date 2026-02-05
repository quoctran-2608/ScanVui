/**
 * Quick Fixes Analyzer Module for ScanVui
 * Detects common accessibility, SEO, and performance issues
 * and provides actionable fix suggestions with code snippets.
 * 
 * NOTE: This file is kept as a reference module. The actual analysis logic
 * is inlined in popup.js > QuickFixesController > analyzeIssues() method.
 */

const QuickFixesAnalyzer = {
  // Issue categories
  categories: {
    a11y: { name: 'Accessibility', icon: '♿', color: '#8b5cf6' },
    seo: { name: 'SEO', icon: '🔍', color: '#f59e0b' },
    security: { name: 'Security', icon: '🔒', color: '#ef4444' },
    performance: { name: 'Performance', icon: '⚡', color: '#22c55e' },
    bestPractice: { name: 'Best Practice', icon: '✨', color: '#3b82f6' }
  },

  // All detectable issues
  issues: [
    {
      id: 'img-no-alt',
      category: 'a11y',
      severity: 'high',
      title: 'Images without alt text',
      detect: (doc) => Array.from(doc.querySelectorAll('img:not([alt])')),
      getFix: (el) => {
        const src = el.src || '';
        const filename = src.split('/').pop()?.split('.')[0] || 'image';
        return `<img src="${el.getAttribute('src')}" alt="${filename}">`;
      },
      description: 'Screen readers cannot describe images without alt attributes'
    },
    {
      id: 'input-no-label',
      category: 'a11y',
      severity: 'high',
      title: 'Form inputs without labels',
      detect: (doc) => Array.from(doc.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"])')).filter(input => {
        const id = input.id;
        if (!id) return true;
        return !doc.querySelector(`label[for="${id}"]`);
      }),
      getFix: (el) => {
        const name = el.name || el.id || 'field';
        const label = name.charAt(0).toUpperCase() + name.slice(1).replace(/[-_]/g, ' ');
        return `<label for="${el.id || name}">${label}</label>\n<input id="${el.id || name}" ...>`;
      },
      description: 'Form inputs need associated labels for accessibility'
    },
    {
      id: 'link-no-noopener',
      category: 'security',
      severity: 'medium',
      title: 'External links without rel="noopener"',
      detect: (doc) => Array.from(doc.querySelectorAll('a[target="_blank"]:not([rel*="noopener"])')),
      getFix: (el) => `<a href="${el.href}" target="_blank" rel="noopener noreferrer">`,
      description: 'Links with target="_blank" should have rel="noopener" to prevent tab-nabbing attacks'
    },
    {
      id: 'button-no-type',
      category: 'bestPractice',
      severity: 'low',
      title: 'Buttons without type attribute',
      detect: (doc) => Array.from(doc.querySelectorAll('button:not([type])')),
      getFix: (el) => `<button type="button">${el.textContent?.trim() || '...'}</button>`,
      description: 'Buttons default to type="submit" which may cause unexpected form submissions'
    },
    {
      id: 'heading-skip',
      category: 'a11y',
      severity: 'medium',
      title: 'Skipped heading levels',
      detect: (doc) => {
        const headings = Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5, h6'));
        const skipped = [];
        let lastLevel = 0;
        headings.forEach(h => {
          const level = parseInt(h.tagName[1]);
          if (lastLevel > 0 && level > lastLevel + 1) {
            skipped.push(h);
          }
          lastLevel = level;
        });
        return skipped;
      },
      getFix: (el) => {
        const level = parseInt(el.tagName[1]);
        return `<!-- Consider using <h${level - 1}> instead of <h${level}> for proper hierarchy -->`;
      },
      description: 'Heading levels should not skip (e.g., h1 to h3)'
    },
    {
      id: 'meta-description-missing',
      category: 'seo',
      severity: 'high',
      title: 'Missing meta description',
      detect: (doc) => doc.querySelector('meta[name="description"]') ? [] : [doc.head || doc],
      getFix: () => `<meta name="description" content="Your page description here (150-160 characters recommended)">`,
      description: 'Meta description helps search engines understand page content'
    },
    {
      id: 'meta-viewport-missing',
      category: 'a11y',
      severity: 'high',
      title: 'Missing viewport meta tag',
      detect: (doc) => doc.querySelector('meta[name="viewport"]') ? [] : [doc.head || doc],
      getFix: () => `<meta name="viewport" content="width=device-width, initial-scale=1">`,
      description: 'Viewport meta tag is essential for responsive design'
    },
    {
      id: 'html-no-lang',
      category: 'a11y',
      severity: 'high',
      title: 'Missing lang attribute on html',
      detect: (doc) => doc.documentElement.hasAttribute('lang') ? [] : [doc.documentElement],
      getFix: () => `<html lang="en">`,
      description: 'The lang attribute helps screen readers select the correct language'
    },
    {
      id: 'inline-styles',
      category: 'bestPractice',
      severity: 'low',
      title: 'Elements with inline styles',
      detect: (doc) => Array.from(doc.querySelectorAll('[style]')).slice(0, 10),
      getFix: (el) => `/* Move inline styles to CSS class */\n.your-class { ${el.getAttribute('style')} }`,
      description: 'Inline styles are harder to maintain and override'
    },
    {
      id: 'empty-link',
      category: 'a11y',
      severity: 'medium',
      title: 'Empty links (no text content)',
      detect: (doc) => Array.from(doc.querySelectorAll('a')).filter(a => !a.textContent?.trim() && !a.querySelector('img') && !a.getAttribute('aria-label')),
      getFix: (el) => `<a href="${el.href}" aria-label="Describe link purpose">...</a>`,
      description: 'Links should have discernible text for screen readers'
    }
  ],

  // Analyze document and return issues
  analyze(document) {
    const results = [];
    this.issues.forEach(issue => {
      const elements = issue.detect(document);
      if (elements.length > 0) {
        results.push({
          ...issue,
          count: elements.length,
          elements: elements.slice(0, 5), // Limit to 5 examples
          fixes: elements.slice(0, 3).map(el => issue.getFix(el))
        });
      }
    });
    return results;
  }
};

if (typeof window !== 'undefined') {
  window.QuickFixesAnalyzer = QuickFixesAnalyzer;
}

