/**
 * Tech Stack Detector Module for ScanVui
 * Detects frameworks, libraries, and technologies used on a webpage
 * 
 * NOTE: This file is kept as a reference module. The actual detection logic
 * is inlined in popup.js > TechStackController methods.
 */

const TechStackDetector = {
  // Detection signatures for common technologies
  signatures: {
    // JavaScript Frameworks
    react: {
      name: 'React',
      icon: '⚛️',
      category: 'Frontend Framework',
      detect: () => !!(window.React || document.querySelector('[data-reactroot], [data-reactid]'))
    },
    vue: {
      name: 'Vue.js',
      icon: '💚',
      category: 'Frontend Framework',
      detect: () => !!(window.Vue || window.__VUE__ || document.querySelector('[data-v-]'))
    },
    angular: {
      name: 'Angular',
      icon: '🅰️',
      category: 'Frontend Framework',
      detect: () => !!(window.ng || document.querySelector('[ng-app], [ng-controller], [_nghost], [_ngcontent]'))
    },
    svelte: {
      name: 'Svelte',
      icon: '🔥',
      category: 'Frontend Framework',
      detect: () => !!document.querySelector('[class*="svelte-"]')
    },
    nextjs: {
      name: 'Next.js',
      icon: '▲',
      category: 'React Framework',
      detect: () => !!(window.__NEXT_DATA__ || document.querySelector('#__next'))
    },
    nuxt: {
      name: 'Nuxt.js',
      icon: '💚',
      category: 'Vue Framework',
      detect: () => !!(window.__NUXT__ || document.querySelector('#__nuxt'))
    },
    
    // CSS Frameworks
    tailwind: {
      name: 'Tailwind CSS',
      icon: '🎨',
      category: 'CSS Framework',
      detect: () => {
        const el = document.querySelector('[class*="flex"], [class*="grid"], [class*="text-"]');
        return el && (el.className.match(/\b(flex|grid|text-[a-z]+-\d+|bg-[a-z]+-\d+)\b/) !== null);
      }
    },
    bootstrap: {
      name: 'Bootstrap',
      icon: '🅱️',
      category: 'CSS Framework',
      detect: () => !!document.querySelector('.container, .row, .col, .btn, [class*="col-md-"]')
    },
    
    // Libraries
    jquery: {
      name: 'jQuery',
      icon: '💲',
      category: 'Library',
      detect: () => !!(window.jQuery || window.$)
    },
    lodash: {
      name: 'Lodash',
      icon: '📦',
      category: 'Library',
      detect: () => !!(window._ && window._.VERSION)
    },
    
    // Build Tools
    webpack: {
      name: 'Webpack',
      icon: '📦',
      category: 'Build Tool',
      detect: () => !!(window.webpackJsonp || window.__webpack_require__)
    },
    vite: {
      name: 'Vite',
      icon: '⚡',
      category: 'Build Tool',
      detect: () => !!document.querySelector('script[type="module"][src*="/@vite"]')
    },
    
    // Analytics
    googleAnalytics: {
      name: 'Google Analytics',
      icon: '📊',
      category: 'Analytics',
      detect: () => !!(window.ga || window.gtag || window.dataLayer)
    },
    
    // CMS
    wordpress: {
      name: 'WordPress',
      icon: '📝',
      category: 'CMS',
      detect: () => !!document.querySelector('link[href*="wp-content"], meta[name="generator"][content*="WordPress"]')
    }
  },

  // Detect all technologies
  detectAll() {
    const detected = [];
    for (const [key, sig] of Object.entries(this.signatures)) {
      try {
        if (sig.detect()) {
          detected.push({
            id: key,
            name: sig.name,
            icon: sig.icon,
            category: sig.category
          });
        }
      } catch (e) {
        // Ignore detection errors
      }
    }
    return detected;
  }
};

if (typeof window !== 'undefined') {
  window.TechStackDetector = TechStackDetector;
}

