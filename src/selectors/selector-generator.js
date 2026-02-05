/**
 * Selector Generator Module for ScanVui
 * Generates various selector formats: CSS, XPath, Playwright, Cypress
 * 
 * NOTE: This file is kept as a reference module. The actual selector logic
 * is inlined in popup.js > SelectorController > generateSelectors() method.
 */

const SelectorGenerator = {
  // Generate unique CSS selector
  getCssSelector(element) {
    if (element.id) {
      return `#${CSS.escape(element.id)}`;
    }
    
    const path = [];
    let current = element;
    
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let selector = current.tagName.toLowerCase();
      
      if (current.id) {
        selector = `#${CSS.escape(current.id)}`;
        path.unshift(selector);
        break;
      }
      
      if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\s+/).filter(c => c);
        if (classes.length > 0) {
          selector += '.' + classes.slice(0, 2).map(c => CSS.escape(c)).join('.');
        }
      }
      
      // Add nth-child if needed for uniqueness
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(el => el.tagName === current.tagName);
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-child(${index})`;
        }
      }
      
      path.unshift(selector);
      current = current.parentElement;
      
      // Limit depth
      if (path.length > 5) break;
    }
    
    return path.join(' > ');
  },

  // Generate XPath selector
  getXPath(element) {
    if (element.id) {
      return `//*[@id="${element.id}"]`;
    }
    
    const path = [];
    let current = element;
    
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let selector = current.tagName.toLowerCase();
      
      if (current.id) {
        path.unshift(`*[@id="${current.id}"]`);
        break;
      }
      
      // Add index for uniqueness
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(el => el.tagName === current.tagName);
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `[${index}]`;
        }
      }
      
      path.unshift(selector);
      current = current.parentElement;
      
      if (path.length > 5) break;
    }
    
    return '//' + path.join('/');
  },

  // Generate Playwright locator
  getPlaywrightLocator(element) {
    // Prefer data-testid
    if (element.dataset.testid) {
      return `page.getByTestId('${element.dataset.testid}')`;
    }
    
    // Prefer role + name
    const role = element.getAttribute('role');
    if (role) {
      const name = element.textContent?.trim().substring(0, 30) || element.getAttribute('aria-label');
      if (name) {
        return `page.getByRole('${role}', { name: '${name}' })`;
      }
    }
    
    // Use label for form elements
    if (element.labels && element.labels.length > 0) {
      const labelText = element.labels[0].textContent.trim();
      return `page.getByLabel('${labelText}')`;
    }
    
    // Use placeholder
    if (element.placeholder) {
      return `page.getByPlaceholder('${element.placeholder}')`;
    }
    
    // Use text for buttons/links
    if (['A', 'BUTTON'].includes(element.tagName)) {
      const text = element.textContent?.trim().substring(0, 30);
      if (text) {
        return `page.getByText('${text}')`;
      }
    }
    
    // Fallback to CSS
    return `page.locator('${this.getCssSelector(element)}')`;
  },

  // Generate Cypress selector
  getCypressSelector(element) {
    // Prefer data-cy or data-testid
    if (element.dataset.cy) {
      return `cy.get('[data-cy="${element.dataset.cy}"]')`;
    }
    if (element.dataset.testid) {
      return `cy.get('[data-testid="${element.dataset.testid}"]')`;
    }
    
    // Use ID
    if (element.id) {
      return `cy.get('#${element.id}')`;
    }
    
    // Use name attribute
    if (element.name) {
      return `cy.get('[name="${element.name}"]')`;
    }
    
    // Fallback to CSS
    return `cy.get('${this.getCssSelector(element)}')`;
  },

  // Generate all selectors
  generateAll(element) {
    return {
      css: this.getCssSelector(element),
      xpath: this.getXPath(element),
      playwright: this.getPlaywrightLocator(element),
      cypress: this.getCypressSelector(element)
    };
  }
};

// Export for use
if (typeof window !== 'undefined') {
  window.SelectorGenerator = SelectorGenerator;
}

