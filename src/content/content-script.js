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
      linksTotal: 0,
      headings: [],
      images: 0,
      tables: { total: 0, items: [] },
      iframes: { total: 0, items: [] },
      shadowDomCount: 0,
      customElements: 0,
      meta: {},
      media: {
        images: { total: 0, withAlt: 0, withoutAlt: 0, items: [] },
        videos: { total: 0, items: [] },
        audio: { total: 0, items: [] },
        svg: { total: 0 },
        canvas: 0
      },
      navigation: {},
      semantic: {},
      scripts: {},
      stylesheets: {},
      accessibility: {},
      performance: {},
      fonts: []
    };

    const allElements = [];
    let shadowDomCount = 0;
    let customElements = 0;
    let maxDepth = 0;

    function walkDOM(root, depth = 0, inShadow = false) {
      if (depth > 20) return;
      if (depth > maxDepth) maxDepth = depth;

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
    result.performance.domElements = allElements.length;
    result.performance.domDepth = maxDepth;

    // Meta information
    result.meta = {
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.content || null,
      keywords: document.querySelector('meta[name="keywords"]')?.content || null,
      author: document.querySelector('meta[name="author"]')?.content || null,
      viewport: document.querySelector('meta[name="viewport"]')?.content || null,
      charset: document.characterSet || document.querySelector('meta[charset]')?.getAttribute('charset'),
      robots: document.querySelector('meta[name="robots"]')?.content || null,
      canonical: document.querySelector('link[rel="canonical"]')?.href || null,
      language: document.documentElement.lang || null,
      favicon: document.querySelector('link[rel="icon"], link[rel="shortcut icon"]')?.href || null,
      themeColor: document.querySelector('meta[name="theme-color"]')?.content || null,
      openGraph: [],
      twitterCards: [],
      structuredData: []
    };

    document.querySelectorAll('meta[property^="og:"]').forEach(og => {
      result.meta.openGraph.push({
        property: og.getAttribute('property'),
        content: og.content
      });
    });

    document.querySelectorAll('meta[name^="twitter:"]').forEach(tc => {
      result.meta.twitterCards.push({
        name: tc.getAttribute('name'),
        content: tc.content
      });
    });

    document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
      try {
        result.meta.structuredData.push(JSON.parse(script.textContent));
      } catch (e) {}
    });

    // Forms
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
        enctype: form.enctype || null,
        target: form.target || null,
        autocomplete: form.autocomplete || null,
        novalidate: form.noValidate || false,
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

    // Orphan fields
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

    // Buttons
    const buttons = findAllElements('button, input[type="button"], input[type="submit"], input[type="reset"], [role="button"]', allElements);
    result.buttons = buttons.slice(0, 100).map(btnInfo => {
      const btn = btnInfo.element;
      return {
        text: getButtonText(btn),
        type: btn.type || 'button',
        disabled: btn.disabled || btn.hasAttribute('disabled'),
        id: btn.id || null,
        className: btn.className?.toString().substring(0, 50) || null,
        inShadowDOM: btnInfo.inShadow
      };
    });

    // Links with categorization
    const links = document.querySelectorAll('a[href]');
    const currentHost = window.location.hostname;
    let internalLinks = 0, externalLinks = 0, anchorLinks = 0, telMailLinks = 0;
    
    result.links = Array.from(links).slice(0, 100).map(a => {
      const href = a.href;
      let linkType = 'internal';
      
      if (href.startsWith('#') || (href.includes('#') && href.includes(currentHost))) {
        anchorLinks++;
        linkType = 'anchor';
      } else if (href.startsWith('tel:') || href.startsWith('mailto:')) {
        telMailLinks++;
        linkType = 'contact';
      } else if (a.hostname && a.hostname !== currentHost) {
        externalLinks++;
        linkType = 'external';
      } else {
        internalLinks++;
      }
      
      return {
        text: (a.textContent?.trim() || a.getAttribute('aria-label') || '(no text)').substring(0, 80),
        href: href,
        type: linkType,
        target: a.target || null,
        rel: a.rel || null
      };
    });
    result.linksTotal = links.length;
    result.navigation = {
      navElements: document.querySelectorAll('nav').length,
      menus: document.querySelectorAll('[role="menu"], [role="menubar"]').length,
      internalLinks,
      externalLinks,
      anchorLinks,
      telMailLinks,
      breadcrumbs: document.querySelectorAll('[aria-label*="breadcrumb"], .breadcrumb, .breadcrumbs').length
    };

    // Headings
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    result.headings = Array.from(headings).slice(0, 50).map(h => ({
      level: h.tagName,
      text: h.textContent?.trim().substring(0, 150),
      id: h.id || null
    }));

    // Media - Images
    const images = document.querySelectorAll('img');
    let imagesWithAlt = 0, imagesWithoutAlt = 0, imagesWithoutDimensions = 0;
    result.media.images.items = Array.from(images).slice(0, 50).map(img => {
      if (img.alt) imagesWithAlt++;
      else imagesWithoutAlt++;
      if (!img.width || !img.height) imagesWithoutDimensions++;
      
      return {
        src: img.src?.substring(0, 200) || null,
        alt: img.alt || null,
        width: img.width || img.naturalWidth || null,
        height: img.height || img.naturalHeight || null,
        loading: img.loading || null,
        srcset: img.srcset ? true : false
      };
    });
    result.media.images.total = images.length;
    result.media.images.withAlt = imagesWithAlt;
    result.media.images.withoutAlt = imagesWithoutAlt;
    result.performance.imagesWithoutDimensions = imagesWithoutDimensions;

    // Media - Videos
    const videos = document.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"], iframe[src*="dailymotion"]');
    result.media.videos.total = videos.length;
    result.media.videos.items = Array.from(videos).slice(0, 20).map(v => ({
      type: v.tagName.toLowerCase() === 'video' ? 'native' : 'embed',
      src: v.src || v.querySelector('source')?.src || null,
      poster: v.poster || null,
      autoplay: v.autoplay || false,
      controls: v.controls || false
    }));

    // Media - Audio
    const audio = document.querySelectorAll('audio');
    result.media.audio.total = audio.length;
    result.media.audio.items = Array.from(audio).slice(0, 10).map(a => ({
      src: a.src || a.querySelector('source')?.src || null,
      controls: a.controls || false
    }));

    // Media - SVG & Canvas
    result.media.svg.total = document.querySelectorAll('svg').length;
    result.media.canvas = document.querySelectorAll('canvas').length;

    // Tables
    const tables = document.querySelectorAll('table');
    result.tables.total = tables.length;
    result.tables.items = Array.from(tables).slice(0, 10).map(table => ({
      rows: table.rows?.length || 0,
      columns: table.rows?.[0]?.cells?.length || 0,
      hasHeader: !!table.querySelector('thead, th'),
      caption: table.caption?.textContent?.trim() || null,
      id: table.id || null
    }));

    // iFrames
    const iframes = document.querySelectorAll('iframe');
    result.iframes.total = iframes.length;
    result.iframes.items = Array.from(iframes).slice(0, 20).map(iframe => ({
      src: iframe.src || null,
      title: iframe.title || null,
      sandbox: iframe.sandbox?.value || null,
      loading: iframe.loading || null,
      allow: iframe.allow || null
    }));

    // Semantic elements
    result.semantic = {
      header: document.querySelectorAll('header').length,
      nav: document.querySelectorAll('nav').length,
      main: document.querySelectorAll('main').length,
      article: document.querySelectorAll('article').length,
      section: document.querySelectorAll('section').length,
      aside: document.querySelectorAll('aside').length,
      footer: document.querySelectorAll('footer').length,
      figure: document.querySelectorAll('figure').length,
      figcaption: document.querySelectorAll('figcaption').length,
      details: document.querySelectorAll('details').length,
      summary: document.querySelectorAll('summary').length,
      dialog: document.querySelectorAll('dialog').length,
      time: document.querySelectorAll('time').length,
      mark: document.querySelectorAll('mark').length,
      address: document.querySelectorAll('address').length
    };

    // Scripts
    const scripts = document.querySelectorAll('script');
    let externalScripts = 0, inlineScripts = 0, moduleScripts = 0, asyncScripts = 0, deferScripts = 0;
    const scriptSources = [];
    
    scripts.forEach(script => {
      if (script.src) {
        externalScripts++;
        scriptSources.push(script.src);
      } else {
        inlineScripts++;
      }
      if (script.type === 'module') moduleScripts++;
      if (script.async) asyncScripts++;
      if (script.defer) deferScripts++;
    });
    
    result.scripts = {
      total: scripts.length,
      external: externalScripts,
      inline: inlineScripts,
      modules: moduleScripts,
      async: asyncScripts,
      defer: deferScripts,
      sources: scriptSources.slice(0, 20)
    };

    // Stylesheets
    const styleLinks = document.querySelectorAll('link[rel="stylesheet"]');
    const inlineStyles = document.querySelectorAll('style');
    result.stylesheets = {
      total: styleLinks.length + inlineStyles.length,
      external: styleLinks.length,
      inline: inlineStyles.length,
      sources: Array.from(styleLinks).slice(0, 20).map(l => l.href)
    };
    result.performance.inlineStyles = document.querySelectorAll('[style]').length;

    // Accessibility
    result.accessibility = {
      ariaLabels: document.querySelectorAll('[aria-label]').length,
      ariaDescribedBy: document.querySelectorAll('[aria-describedby]').length,
      ariaLabelledBy: document.querySelectorAll('[aria-labelledby]').length,
      ariaRoles: document.querySelectorAll('[role]').length,
      ariaHidden: document.querySelectorAll('[aria-hidden]').length,
      ariaLive: document.querySelectorAll('[aria-live]').length,
      ariaExpanded: document.querySelectorAll('[aria-expanded]').length,
      tabindex: document.querySelectorAll('[tabindex]').length,
      labels: document.querySelectorAll('label').length,
      fieldsets: document.querySelectorAll('fieldset').length,
      legends: document.querySelectorAll('legend').length,
      skipLinks: document.querySelectorAll('a[href^="#main"], a[href^="#content"], .skip-link, .skip-to-content').length,
      langAttribute: !!document.documentElement.lang,
      altTextCoverage: images.length > 0 ? Math.round((imagesWithAlt / images.length) * 100) : 100
    };

    // Performance hints
    const deprecatedElements = document.querySelectorAll('font, center, marquee, blink, spacer, frame, frameset, basefont, big, strike, tt');
    result.performance.deprecatedElements = deprecatedElements.length;

    // Fonts
    try {
      const fontFaces = document.fonts ? Array.from(document.fonts) : [];
      result.fonts = fontFaces.slice(0, 20).map(f => ({
        family: f.family,
        style: f.style,
        weight: f.weight,
        status: f.status
      }));
    } catch (e) {
      result.fonts = [];
    }

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
      value: element.value?.substring(0, 100) || null,
      checked: element.type === 'checkbox' || element.type === 'radio' ? element.checked : null,
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
