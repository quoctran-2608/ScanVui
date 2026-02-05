/**
 * Responsive Check Module for ScanVui
 * Defines common viewport sizes and responsive testing utilities
 * 
 * NOTE: This file is kept as a reference module. The actual responsive logic
 * is inlined in popup.js > ResponsiveController methods.
 */

const ResponsiveCheck = {
  // Common device viewports
  viewports: [
    { name: 'iPhone SE', width: 375, height: 667, icon: '📱', type: 'mobile' },
    { name: 'iPhone 14', width: 390, height: 844, icon: '📱', type: 'mobile' },
    { name: 'iPhone 14 Pro Max', width: 430, height: 932, icon: '📱', type: 'mobile' },
    { name: 'Samsung Galaxy S21', width: 360, height: 800, icon: '📱', type: 'mobile' },
    { name: 'iPad Mini', width: 768, height: 1024, icon: '📱', type: 'tablet' },
    { name: 'iPad Pro 11"', width: 834, height: 1194, icon: '📱', type: 'tablet' },
    { name: 'iPad Pro 12.9"', width: 1024, height: 1366, icon: '📱', type: 'tablet' },
    { name: 'Laptop', width: 1366, height: 768, icon: '💻', type: 'desktop' },
    { name: 'Desktop HD', width: 1920, height: 1080, icon: '🖥️', type: 'desktop' },
    { name: 'Desktop 2K', width: 2560, height: 1440, icon: '🖥️', type: 'desktop' }
  ],

  // Common breakpoints
  breakpoints: {
    xs: 0,      // Extra small (phones portrait)
    sm: 576,    // Small (phones landscape)
    md: 768,    // Medium (tablets)
    lg: 992,    // Large (desktops)
    xl: 1200,   // Extra large (large desktops)
    xxl: 1400   // Extra extra large
  },

  // Get viewport category
  getCategory(width) {
    if (width < 576) return 'Mobile';
    if (width < 768) return 'Mobile Landscape';
    if (width < 992) return 'Tablet';
    if (width < 1200) return 'Desktop';
    return 'Large Desktop';
  },

  // Check if media query would match at given width
  checkMediaQuery(query, width) {
    const match = query.match(/\((?:min|max)-width:\s*(\d+)px\)/);
    if (!match) return null;

    const breakpoint = parseInt(match[1]);
    if (query.includes('min-width')) {
      return width >= breakpoint;
    } else if (query.includes('max-width')) {
      return width <= breakpoint;
    }
    return null;
  },

  // Analyze page responsiveness
  analyzeResponsiveness(stylesheets) {
    const mediaQueries = [];
    
    stylesheets.forEach(sheet => {
      try {
        const rules = sheet.cssRules || sheet.rules;
        for (let rule of rules) {
          if (rule.type === CSSRule.MEDIA_RULE) {
            mediaQueries.push({
              query: rule.conditionText,
              rulesCount: rule.cssRules.length
            });
          }
        }
      } catch (e) {
        // Cross-origin stylesheet, skip
      }
    });

    return {
      hasMediaQueries: mediaQueries.length > 0,
      mediaQueries: mediaQueries,
      hasViewportMeta: !!document.querySelector('meta[name="viewport"]'),
      viewportContent: document.querySelector('meta[name="viewport"]')?.content || null
    };
  }
};

if (typeof window !== 'undefined') {
  window.ResponsiveCheck = ResponsiveCheck;
}

