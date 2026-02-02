(function() {
  'use strict';

  window.FormInspector = {
    scan: function() {
      return scanPageContent();
    }
  };

  function scanPageContent() {
    const result = {
      url: window.location.href,
      title: document.title,
      timestamp: new Date().toISOString(),
      forms: [],
      totalFields: 0,
      buttons: [],
      links: [],
      headings: [],
      images: 0,
      tables: 0,
      iframes: 0,
      shadowDomCount: 0,
      customElements: 0
    };

    const allElements = [];
    let shadowDomCount = 0;
    let customElements = 0;

    function walkDOM(root, depth = 0, inShadow = false) {
      if (depth > 20) return;

      try {
        const children = root.children || root.childNodes;
        for (let i = 0; i < children.length; i++) {
          const node = children[i];
          if (node.nodeType !== Node.ELEMENT_NODE) continue;

          allElements.push({ element: node, inShadow, depth });

          if (node.tagName && node.tagName.includes('-')) {
            customElements++;
          }

          if (node.shadowRoot) {
            shadowDomCount++;
            walkDOM(node.shadowRoot, depth + 1, true);
          }

          walkDOM(node, depth + 1, inShadow);
        }
      } catch (e) {
        console.warn('FormInspector: Error walking DOM', e);
      }
    }

    walkDOM(document.body);
    result.shadowDomCount = shadowDomCount;
    result.customElements = customElements;

    const processedForms = new Set();
    const formElements = findAllElements('form', allElements);
    
    formElements.forEach((formInfo, index) => {
      const form = formInfo.element;
      if (processedForms.has(form)) return;
      processedForms.add(form);

      const formData = {
        index,
        name: form.name || form.id || form.getAttribute('aria-label') || null,
        action: form.action || null,
        method: (form.method || 'GET').toUpperCase(),
        inShadowDOM: formInfo.inShadow,
        fields: []
      };

      const formFields = findFormFields(form, allElements);
      formFields.forEach(fieldInfo => {
        const field = extractFieldInfo(fieldInfo.element, fieldInfo.inShadow);
        if (field) {
          formData.fields.push(field);
          result.totalFields++;
        }
      });

      result.forms.push(formData);
    });

    const orphanFields = findOrphanFields(allElements, processedForms);
    if (orphanFields.length > 0) {
      const orphanForm = {
        index: result.forms.length,
        name: 'Standalone Fields (no form)',
        action: null,
        method: null,
        isOrphan: true,
        fields: []
      };

      orphanFields.forEach(fieldInfo => {
        const field = extractFieldInfo(fieldInfo.element, fieldInfo.inShadow);
        if (field) {
          orphanForm.fields.push(field);
          result.totalFields++;
        }
      });

      if (orphanForm.fields.length > 0) {
        result.forms.push(orphanForm);
      }
    }

    const buttons = findAllElements('button, input[type="button"], input[type="submit"], [role="button"]', allElements);
    result.buttons = buttons.slice(0, 100).map(btnInfo => {
      const btn = btnInfo.element;
      return {
        text: getButtonText(btn),
        type: btn.type || 'button',
        disabled: btn.disabled || btn.hasAttribute('disabled'),
        inShadowDOM: btnInfo.inShadow
      };
    });

    const links = document.querySelectorAll('a[href]');
    result.links = Array.from(links).slice(0, 100).map(a => ({
      text: (a.textContent?.trim() || a.getAttribute('aria-label') || '(no text)').substring(0, 80),
      href: a.href
    }));
    result.linksTotal = links.length;

    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    result.headings = Array.from(headings).slice(0, 50).map(h => ({
      level: h.tagName,
      text: h.textContent?.trim().substring(0, 150)
    }));

    result.images = document.querySelectorAll('img').length;
    result.tables = document.querySelectorAll('table').length;
    result.iframes = document.querySelectorAll('iframe').length;

    return result;
  }

  function findAllElements(selector, allElements) {
    const result = [];
    const selectors = selector.split(',').map(s => s.trim());
    
    allElements.forEach(info => {
      try {
        for (const sel of selectors) {
          if (info.element.matches && info.element.matches(sel)) {
            result.push(info);
            break;
          }
        }
      } catch (e) {}
    });

    return result;
  }

  function findFormFields(form, allElements) {
    const fields = [];
    const inputSelectors = [
      'input', 'select', 'textarea',
      '[contenteditable="true"]',
      '[role="textbox"]', '[role="combobox"]', '[role="listbox"]',
      '[role="spinbutton"]', '[role="slider"]', '[role="searchbox"]'
    ];

    try {
      inputSelectors.forEach(selector => {
        const elements = form.querySelectorAll(selector);
        elements.forEach(el => {
          const inShadow = allElements.find(info => info.element === el)?.inShadow || false;
          fields.push({ element: el, inShadow });
        });
      });
    } catch (e) {}

    if (form.shadowRoot) {
      walkShadowForFields(form.shadowRoot, fields);
    }

    return fields;
  }

  function walkShadowForFields(shadowRoot, fields) {
    const inputSelectors = 'input, select, textarea, [contenteditable="true"], [role="textbox"]';
    try {
      const elements = shadowRoot.querySelectorAll(inputSelectors);
      elements.forEach(el => fields.push({ element: el, inShadow: true }));

      const allInShadow = shadowRoot.querySelectorAll('*');
      allInShadow.forEach(el => {
        if (el.shadowRoot) {
          walkShadowForFields(el.shadowRoot, fields);
        }
      });
    } catch (e) {}
  }

  function findOrphanFields(allElements, processedForms) {
    const orphans = [];
    const inputSelectors = [
      'input', 'select', 'textarea',
      '[contenteditable="true"]',
      '[role="textbox"]', '[role="combobox"]'
    ];

    allElements.forEach(info => {
      try {
        for (const selector of inputSelectors) {
          if (info.element.matches && info.element.matches(selector)) {
            const parentForm = info.element.closest('form');
            if (!parentForm || !processedForms.has(parentForm)) {
              orphans.push(info);
            }
            break;
          }
        }
      } catch (e) {}
    });

    return orphans;
  }

  function extractFieldInfo(element, inShadow = false) {
    const tagName = element.tagName?.toLowerCase() || 'unknown';

    if (tagName === 'input' && element.type === 'hidden') {
      return null;
    }

    let type = 'text';
    if (tagName === 'select') type = 'select';
    else if (tagName === 'textarea') type = 'textarea';
    else if (tagName === 'input') type = element.type || 'text';
    else if (element.hasAttribute('contenteditable')) type = 'contenteditable';
    else if (element.getAttribute('role')) type = element.getAttribute('role');

    const label = findLabel(element);

    let options = null;
    if (tagName === 'select') {
      options = Array.from(element.options || []).slice(0, 20).map(opt => ({
        value: opt.value,
        text: opt.text,
        selected: opt.selected
      }));
    }

    return {
      tag: tagName,
      type,
      name: element.name || null,
      id: element.id || null,
      label: label,
      placeholder: element.placeholder || element.getAttribute('placeholder') || null,
      required: element.required || element.getAttribute('aria-required') === 'true' || element.hasAttribute('required'),
      disabled: element.disabled || element.getAttribute('aria-disabled') === 'true' || element.hasAttribute('disabled'),
      readonly: element.readOnly || element.hasAttribute('readonly'),
      pattern: element.pattern || null,
      minLength: element.minLength > 0 ? element.minLength : null,
      maxLength: element.maxLength > 0 && element.maxLength < 1000000 ? element.maxLength : null,
      min: element.min || null,
      max: element.max || null,
      step: element.step || null,
      autocomplete: element.autocomplete || null,
      ariaLabel: element.getAttribute('aria-label') || null,
      ariaDescribedBy: element.getAttribute('aria-describedby') || null,
      className: element.className?.toString().substring(0, 100) || null,
      inShadowDOM: inShadow,
      options: options,
      hasValue: !!(element.value || element.textContent?.trim())
    };
  }

  function findLabel(element) {
    if (element.id) {
      const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
      if (label) return label.textContent.trim();

      try {
        const root = element.getRootNode();
        if (root && root !== document) {
          const shadowLabel = root.querySelector(`label[for="${CSS.escape(element.id)}"]`);
          if (shadowLabel) return shadowLabel.textContent.trim();
        }
      } catch (e) {}
    }

    const parentLabel = element.closest('label');
    if (parentLabel) {
      const clone = parentLabel.cloneNode(true);
      const inputs = clone.querySelectorAll('input, select, textarea');
      inputs.forEach(input => input.remove());
      const text = clone.textContent.trim();
      if (text) return text;
    }

    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;

    const ariaLabelledBy = element.getAttribute('aria-labelledby');
    if (ariaLabelledBy) {
      const ids = ariaLabelledBy.split(/\s+/);
      const texts = ids.map(id => {
        const el = document.getElementById(id);
        return el ? el.textContent.trim() : '';
      }).filter(Boolean);
      if (texts.length) return texts.join(' ');
    }

    const prevSibling = element.previousElementSibling;
    if (prevSibling && prevSibling.tagName === 'LABEL') {
      return prevSibling.textContent.trim();
    }

    return null;
  }

  function getButtonText(btn) {
    let text = btn.textContent?.trim();
    if (!text) text = btn.value;
    if (!text) text = btn.getAttribute('aria-label');
    if (!text) text = btn.title;
    if (!text) {
      const img = btn.querySelector('img[alt]');
      if (img) text = img.alt;
    }
    return text || '(no text)';
  }

})();
