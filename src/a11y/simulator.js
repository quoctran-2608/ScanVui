/**
 * Accessibility Simulator Module for ScanVui
 * Simulates various vision impairments using CSS filters
 * 
 * NOTE: This file is kept as a reference module. The actual simulator logic
 * is inlined in popup.js > A11ySimulatorController methods.
 */

const A11ySimulator = {
  // Vision impairment simulations using CSS filters
  simulations: {
    // Color blindness types
    protanopia: {
      name: 'Protanopia',
      description: 'Red-blind (1% of males)',
      icon: '🔴',
      filter: 'url(#protanopia)'
    },
    deuteranopia: {
      name: 'Deuteranopia', 
      description: 'Green-blind (1% of males)',
      icon: '🟢',
      filter: 'url(#deuteranopia)'
    },
    tritanopia: {
      name: 'Tritanopia',
      description: 'Blue-blind (rare)',
      icon: '🔵',
      filter: 'url(#tritanopia)'
    },
    achromatopsia: {
      name: 'Achromatopsia',
      description: 'Complete color blindness',
      icon: '⚫',
      filter: 'grayscale(100%)'
    },
    // Vision impairments
    blurry: {
      name: 'Blurred Vision',
      description: 'Low visual acuity',
      icon: '👓',
      filter: 'blur(2px)'
    },
    lowContrast: {
      name: 'Low Contrast',
      description: 'Reduced contrast sensitivity',
      icon: '🌫️',
      filter: 'contrast(0.6)'
    },
    cataracts: {
      name: 'Cataracts',
      description: 'Cloudy vision',
      icon: '☁️',
      filter: 'blur(1px) contrast(0.8) brightness(1.1)'
    }
  },

  // SVG filter definitions for accurate color blindness simulation
  svgFilters: `
<svg xmlns="http://www.w3.org/2000/svg" style="display:none">
  <filter id="protanopia">
    <feColorMatrix type="matrix" values="
      0.567, 0.433, 0,     0, 0
      0.558, 0.442, 0,     0, 0
      0,     0.242, 0.758, 0, 0
      0,     0,     0,     1, 0
    "/>
  </filter>
  <filter id="deuteranopia">
    <feColorMatrix type="matrix" values="
      0.625, 0.375, 0,   0, 0
      0.7,   0.3,   0,   0, 0
      0,     0.3,   0.7, 0, 0
      0,     0,     0,   1, 0
    "/>
  </filter>
  <filter id="tritanopia">
    <feColorMatrix type="matrix" values="
      0.95, 0.05,  0,     0, 0
      0,    0.433, 0.567, 0, 0
      0,    0.475, 0.525, 0, 0
      0,    0,     0,     1, 0
    "/>
  </filter>
</svg>`,

  // Apply simulation to page
  applySimulation(type) {
    const sim = this.simulations[type];
    if (!sim) return;
    
    // Inject SVG filters if using color blindness simulation
    if (sim.filter.startsWith('url(#')) {
      if (!document.getElementById('a11y-svg-filters')) {
        const div = document.createElement('div');
        div.id = 'a11y-svg-filters';
        div.innerHTML = this.svgFilters;
        document.body.appendChild(div);
      }
    }
    
    document.documentElement.style.filter = sim.filter;
  },

  // Remove simulation
  removeSimulation() {
    document.documentElement.style.filter = '';
    const svgFilters = document.getElementById('a11y-svg-filters');
    if (svgFilters) svgFilters.remove();
  }
};

if (typeof window !== 'undefined') {
  window.A11ySimulator = A11ySimulator;
}

