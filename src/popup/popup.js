class PopupController {
  constructor() {
    this.scanData = null;
    this.init();
  }

  init() {
    this.bindElements();
    this.bindEvents();
  }

  bindElements() {
    this.scanBtn = document.getElementById('scanBtn');
    this.refreshBtn = document.getElementById('refreshBtn');
    this.loading = document.getElementById('loading');
    this.error = document.getElementById('error');
    this.errorMessage = document.getElementById('errorMessage');
    this.results = document.getElementById('results');
    this.summaryGrid = document.getElementById('summaryGrid');
    this.formsContainer = document.getElementById('formsContainer');
    this.otherElements = document.getElementById('otherElements');
    this.footer = document.getElementById('footer');
    this.copyJsonBtn = document.getElementById('copyJsonBtn');
    this.copyTextBtn = document.getElementById('copyTextBtn');
    this.downloadBtn = document.getElementById('downloadBtn');
  }

  bindEvents() {
    this.scanBtn.addEventListener('click', () => this.scanPage());
    this.refreshBtn.addEventListener('click', () => this.scanPage());
    this.copyJsonBtn.addEventListener('click', () => this.copyAsJson());
    this.copyTextBtn.addEventListener('click', () => this.copyAsText());
    this.downloadBtn.addEventListener('click', () => this.downloadJson());
  }

  showLoading() {
    this.loading.classList.remove('hidden');
    this.error.classList.add('hidden');
    this.results.classList.add('hidden');
    this.footer.classList.add('hidden');
    this.scanBtn.disabled = true;
  }

  hideLoading() {
    this.loading.classList.add('hidden');
    this.scanBtn.disabled = false;
  }

  showError(message) {
    this.hideLoading();
    this.errorMessage.textContent = message;
    this.error.classList.remove('hidden');
  }

  showResults(data) {
    this.hideLoading();
    this.scanData = data;
    this.renderSummary(data);
    this.renderForms(data.forms);
    this.renderOtherElements(data);
    this.renderMediaSection(data);
    this.renderNavigationSection(data);
    this.renderSemanticSection(data);
    this.renderScriptsSection(data);
    this.renderAccessibilitySection(data);
    this.renderMetaSection(data);
    this.renderHeadingsSection(data);
    this.bindCollapsibleSections();
    this.results.classList.remove('hidden');
    this.footer.classList.remove('hidden');
  }

  bindCollapsibleSections() {
    document.querySelectorAll('.section-header').forEach(header => {
      header.addEventListener('click', () => {
        const targetId = header.dataset.target;
        const content = document.getElementById(targetId);
        const toggle = header.querySelector('.section-toggle');
        if (content && toggle) {
          content.classList.toggle('expanded');
          toggle.classList.toggle('expanded');
        }
      });
    });
  }

  renderHeadingsSection(data) {
    const container = document.getElementById('headingsSection');
    if (!container) return;

    if (!data.headings || data.headings.length === 0) {
      container.innerHTML = '<p style="color: #888; font-size: 12px;">No headings found on this page.</p>';
      return;
    }

    container.innerHTML = data.headings.map(h => {
      const level = h.level.toLowerCase();
      return `
        <div class="heading-item ${level}">
          <span class="heading-level">${h.level}</span>
          <span class="heading-text">${h.text || '(empty)'}</span>
        </div>
      `;
    }).join('');
  }

  async scanPage() {
    this.showLoading();

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        throw new Error('No active tab found');
      }

      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        throw new Error('Cannot scan Chrome internal pages');
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: scanPageContent,
        world: 'MAIN'
      });

      if (results && results[0] && results[0].result) {
        this.showResults(results[0].result);
      } else {
        throw new Error('Failed to scan page content');
      }
    } catch (err) {
      console.error('Scan error:', err);
      this.showError(err.message || 'Failed to scan page');
    }
  }

  renderSummary(data) {
    const items = [
      { icon: '📝', label: 'Forms', value: data.forms.length },
      { icon: '✏️', label: 'Input Fields', value: data.totalFields },
      { icon: '🔘', label: 'Buttons', value: data.buttons.length },
      { icon: '🔗', label: 'Links', value: data.linksTotal || data.links.length },
      { icon: '🖼️', label: 'Images', value: data.media?.images?.total || data.images },
      { icon: '📊', label: 'Tables', value: data.tables?.total || data.tables },
      { icon: '📰', label: 'Headings', value: data.headings?.length || 0 },
      { icon: '🎬', label: 'Videos', value: data.media?.videos?.total || 0 }
    ];

    this.summaryGrid.innerHTML = items.map(item => `
      <div class="summary-item">
        <span class="summary-icon">${item.icon}</span>
        <div class="summary-info">
          <span class="summary-label">${item.label}</span>
          <span class="summary-value">${item.value}</span>
        </div>
      </div>
    `).join('');
  }

  renderForms(forms) {
    if (forms.length === 0) {
      this.formsContainer.innerHTML = '<p style="color: #888; font-size: 12px;">No forms detected on this page.</p>';
      return;
    }

    this.formsContainer.innerHTML = forms.map((form, index) => `
      <div class="form-card">
        <div class="form-header" data-form-index="${index}">
          <span class="form-toggle">▶</span>
          <span class="form-title">${form.name || `Form #${index + 1}`}</span>
          <span class="form-badge">${form.fields.length} fields</span>
          ${form.method ? `<span class="form-method">${form.method}</span>` : ''}
        </div>
        <div class="form-fields" id="form-fields-${index}">
          ${form.action ? `<div class="form-action">Action: ${form.action}</div>` : ''}
          ${this.renderFields(form.fields)}
        </div>
      </div>
    `).join('');

    this.formsContainer.querySelectorAll('.form-header').forEach(header => {
      header.addEventListener('click', () => this.toggleForm(header));
    });
  }

  renderFields(fields) {
    if (fields.length === 0) {
      return '<p style="color: #888; font-size: 11px;">No fields in this form.</p>';
    }

    return fields.map(field => {
      const icon = this.getFieldIcon(field.type);
      const tags = [];
      
      if (field.type) tags.push(`<span class="field-tag type">${field.type}</span>`);
      if (field.required) tags.push(`<span class="field-tag required">required</span>`);
      if (field.pattern) tags.push(`<span class="field-tag">pattern</span>`);
      if (field.minLength || field.maxLength) tags.push(`<span class="field-tag">length</span>`);
      if (field.inShadowDOM) tags.push(`<span class="field-tag shadow">shadow</span>`);
      if (field.disabled) tags.push(`<span class="field-tag disabled">disabled</span>`);
      if (field.readonly) tags.push(`<span class="field-tag">readonly</span>`);

      return `
        <div class="field-item">
          <span class="field-icon">${icon}</span>
          <div class="field-info">
            <div class="field-name">${field.label || field.name || field.id || field.placeholder || '(unnamed)'}</div>
            ${field.name ? `<div class="field-attr">name: ${field.name}</div>` : ''}
            ${field.id ? `<div class="field-attr">id: ${field.id}</div>` : ''}
            <div class="field-meta">${tags.join('')}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  getFieldIcon(type) {
    const icons = {
      'text': '📝',
      'email': '📧',
      'password': '🔒',
      'number': '🔢',
      'tel': '📞',
      'url': '🌐',
      'date': '📅',
      'datetime-local': '📅',
      'time': '🕐',
      'file': '📎',
      'checkbox': '☑️',
      'radio': '🔘',
      'select': '📋',
      'textarea': '📄',
      'hidden': '👁️‍🗨️',
      'submit': '✅',
      'button': '🔲',
      'search': '🔍',
      'color': '🎨',
      'range': '📊'
    };
    return icons[type] || '📝';
  }

  toggleForm(header) {
    const index = header.dataset.formIndex;
    const fields = document.getElementById(`form-fields-${index}`);
    const toggle = header.querySelector('.form-toggle');
    
    fields.classList.toggle('expanded');
    toggle.classList.toggle('expanded');
  }

  renderOtherElements(data) {
    const items = [
      { icon: '📦', label: 'iFrames', count: data.iframes?.total || data.iframes || 0 },
      { icon: '🌑', label: 'Shadow DOM Elements', count: data.shadowDomCount || 0 },
      { icon: '🧩', label: 'Custom Elements', count: data.customElements || 0 },
      { icon: '📜', label: 'Scripts', count: data.scripts?.total || 0 },
      { icon: '🎨', label: 'Stylesheets', count: data.stylesheets?.total || 0 },
      { icon: '🔤', label: 'Fonts', count: data.fonts?.length || 0 }
    ];

    this.otherElements.innerHTML = items.map(item => `
      <div class="other-item">
        <span class="other-icon">${item.icon}</span>
        <span class="other-label">${item.label}</span>
        <span class="other-count">${item.count}</span>
      </div>
    `).join('');
  }

  renderMediaSection(data) {
    const container = document.getElementById('mediaSection');
    if (!container || !data.media) return;

    const items = [
      { icon: '🖼️', label: 'Images', count: data.media.images?.total || 0, details: data.media.images?.withAlt + ' with alt' },
      { icon: '🎬', label: 'Videos', count: data.media.videos?.total || 0 },
      { icon: '🎵', label: 'Audio', count: data.media.audio?.total || 0 },
      { icon: '📐', label: 'SVGs', count: data.media.svg?.total || 0 },
      { icon: '🖼️', label: 'Canvas', count: data.media.canvas || 0 }
    ];

    container.innerHTML = items.map(item => `
      <div class="other-item">
        <span class="other-icon">${item.icon}</span>
        <span class="other-label">${item.label}</span>
        <span class="other-count">${item.count}</span>
        ${item.details ? `<span class="other-detail">(${item.details})</span>` : ''}
      </div>
    `).join('');
  }

  renderNavigationSection(data) {
    const container = document.getElementById('navigationSection');
    if (!container || !data.navigation) return;

    const nav = data.navigation;
    const items = [
      { icon: '🧭', label: 'Nav Elements', count: nav.navElements || 0 },
      { icon: '📋', label: 'Menus', count: nav.menus || 0 },
      { icon: '🔗', label: 'Internal Links', count: nav.internalLinks || 0 },
      { icon: '🌐', label: 'External Links', count: nav.externalLinks || 0 },
      { icon: '⚓', label: 'Anchor Links', count: nav.anchorLinks || 0 },
      { icon: '📞', label: 'Tel/Mail Links', count: nav.telMailLinks || 0 }
    ];

    container.innerHTML = items.map(item => `
      <div class="other-item">
        <span class="other-icon">${item.icon}</span>
        <span class="other-label">${item.label}</span>
        <span class="other-count">${item.count}</span>
      </div>
    `).join('');
  }

  renderSemanticSection(data) {
    const container = document.getElementById('semanticSection');
    if (!container || !data.semantic) return;

    const sem = data.semantic;
    const items = [
      { icon: '📰', label: 'Header', count: sem.header || 0 },
      { icon: '📄', label: 'Main', count: sem.main || 0 },
      { icon: '📦', label: 'Footer', count: sem.footer || 0 },
      { icon: '📑', label: 'Article', count: sem.article || 0 },
      { icon: '📂', label: 'Section', count: sem.section || 0 },
      { icon: '📎', label: 'Aside', count: sem.aside || 0 }
    ];

    container.innerHTML = items.map(item => `
      <div class="other-item">
        <span class="other-icon">${item.icon}</span>
        <span class="other-label">${item.label}</span>
        <span class="other-count">${item.count}</span>
      </div>
    `).join('');
  }

  renderScriptsSection(data) {
    const container = document.getElementById('scriptsSection');
    if (!container || !data.scripts) return;

    const scripts = data.scripts;
    container.innerHTML = `
      <div class="other-item">
        <span class="other-icon">📜</span>
        <span class="other-label">Total Scripts</span>
        <span class="other-count">${scripts.total || 0}</span>
      </div>
      <div class="other-item">
        <span class="other-icon">🔗</span>
        <span class="other-label">External</span>
        <span class="other-count">${scripts.external || 0}</span>
      </div>
      <div class="other-item">
        <span class="other-icon">📝</span>
        <span class="other-label">Inline</span>
        <span class="other-count">${scripts.inline || 0}</span>
      </div>
      <div class="other-item">
        <span class="other-icon">📦</span>
        <span class="other-label">Modules</span>
        <span class="other-count">${scripts.modules || 0}</span>
      </div>
    `;
  }

  renderAccessibilitySection(data) {
    const container = document.getElementById('accessibilitySection');
    if (!container || !data.accessibility) return;

    const a11y = data.accessibility;
    container.innerHTML = `
      <div class="other-item">
        <span class="other-icon">🏷️</span>
        <span class="other-label">ARIA Labels</span>
        <span class="other-count">${a11y.ariaLabels || 0}</span>
      </div>
      <div class="other-item">
        <span class="other-icon">🎭</span>
        <span class="other-label">ARIA Roles</span>
        <span class="other-count">${a11y.ariaRoles || 0}</span>
      </div>
      <div class="other-item">
        <span class="other-icon">🔘</span>
        <span class="other-label">Tabindex Elements</span>
        <span class="other-count">${a11y.tabindex || 0}</span>
      </div>
      <div class="other-item">
        <span class="other-icon">🏷️</span>
        <span class="other-label">Labels</span>
        <span class="other-count">${a11y.labels || 0}</span>
      </div>
      <div class="other-item ${a11y.skipLinks > 0 ? 'success' : 'warning'}">
        <span class="other-icon">⏭️</span>
        <span class="other-label">Skip Links</span>
        <span class="other-count">${a11y.skipLinks || 0}</span>
      </div>
      <div class="other-item ${a11y.langAttribute ? 'success' : 'warning'}">
        <span class="other-icon">🌍</span>
        <span class="other-label">Lang Attribute</span>
        <span class="other-count">${a11y.langAttribute ? 'Yes' : 'No'}</span>
      </div>
    `;
  }

  renderMetaSection(data) {
    const container = document.getElementById('metaSection');
    if (!container || !data.meta) return;

    const meta = data.meta;
    container.innerHTML = `
      <div class="meta-item">
        <span class="meta-label">Title</span>
        <span class="meta-value">${meta.title || '(none)'}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Description</span>
        <span class="meta-value">${meta.description || '(none)'}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Viewport</span>
        <span class="meta-value">${meta.viewport ? 'Yes' : 'No'}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Charset</span>
        <span class="meta-value">${meta.charset || '(none)'}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Open Graph</span>
        <span class="meta-value">${meta.openGraph?.length || 0} tags</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Twitter Cards</span>
        <span class="meta-value">${meta.twitterCards?.length || 0} tags</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Canonical URL</span>
        <span class="meta-value">${meta.canonical ? 'Yes' : 'No'}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Favicon</span>
        <span class="meta-value">${meta.favicon ? 'Yes' : 'No'}</span>
      </div>
    `;
  }

  copyAsJson() {
    if (!this.scanData) return;
    const detailedJson = this.generateDetailedJson(this.scanData);
    navigator.clipboard.writeText(JSON.stringify(detailedJson, null, 2))
      .then(() => this.showToast('Copied JSON to clipboard!'))
      .catch(() => this.showToast('Failed to copy'));
  }

  generateDetailedJson(data) {
    return {
      scanInfo: {
        url: data.url,
        title: data.title,
        timestamp: data.timestamp,
        scanVersion: '2.0.0'
      },
      summary: {
        totalForms: data.forms.length,
        totalFields: data.totalFields,
        totalButtons: data.buttons.length,
        totalLinks: data.linksTotal || data.links.length,
        totalImages: data.media?.images?.total || data.images,
        totalTables: data.tables?.total || data.tables,
        totalHeadings: data.headings?.length || 0,
        totalVideos: data.media?.videos?.total || 0,
        totalScripts: data.scripts?.total || 0,
        totalStylesheets: data.stylesheets?.total || 0,
        shadowDomElements: data.shadowDomCount || 0,
        customElements: data.customElements || 0,
        iframes: data.iframes?.total || data.iframes || 0
      },
      meta: data.meta || {},
      forms: data.forms.map(form => ({
        name: form.name,
        action: form.action,
        method: form.method,
        inShadowDOM: form.inShadowDOM || false,
        fieldsCount: form.fields.length,
        fields: form.fields.map(field => ({
          tag: field.tag,
          type: field.type,
          name: field.name,
          id: field.id,
          label: field.label,
          placeholder: field.placeholder,
          required: field.required,
          disabled: field.disabled,
          readonly: field.readonly,
          pattern: field.pattern,
          minLength: field.minLength,
          maxLength: field.maxLength,
          min: field.min,
          max: field.max,
          autocomplete: field.autocomplete,
          ariaLabel: field.ariaLabel,
          inShadowDOM: field.inShadowDOM || false,
          options: field.options || null
        }))
      })),
      buttons: data.buttons,
      links: {
        total: data.linksTotal || data.links.length,
        items: data.links
      },
      headings: data.headings,
      media: data.media || {
        images: { total: data.images, withAlt: 0, withoutAlt: 0, items: [] },
        videos: { total: 0, items: [] },
        audio: { total: 0, items: [] },
        svg: { total: 0 },
        canvas: 0
      },
      tables: data.tables,
      navigation: data.navigation || {},
      semantic: data.semantic || {},
      scripts: data.scripts || {},
      stylesheets: data.stylesheets || {},
      accessibility: data.accessibility || {},
      performance: data.performance || {},
      iframes: data.iframes
    };
  }

  copyAsText() {
    if (!this.scanData) return;
    const text = this.formatAsMarkdown(this.scanData);
    navigator.clipboard.writeText(text)
      .then(() => this.showToast('Copied Markdown to clipboard!'))
      .catch(() => this.showToast('Failed to copy'));
  }

  formatAsMarkdown(data) {
    let md = '';
    
    md += `# Page Analysis Report\n\n`;
    md += `**URL:** ${data.url}\n`;
    md += `**Title:** ${data.title}\n`;
    md += `**Scanned:** ${new Date(data.timestamp).toLocaleString()}\n\n`;
    md += `---\n\n`;

    md += `## Summary\n\n`;
    md += `| Element | Count |\n`;
    md += `|---------|-------|\n`;
    md += `| Forms | ${data.forms.length} |\n`;
    md += `| Input Fields | ${data.totalFields} |\n`;
    md += `| Buttons | ${data.buttons.length} |\n`;
    md += `| Links | ${data.linksTotal || data.links.length} |\n`;
    md += `| Images | ${data.media?.images?.total || data.images} |\n`;
    md += `| Videos | ${data.media?.videos?.total || 0} |\n`;
    md += `| Tables | ${data.tables?.total || data.tables} |\n`;
    md += `| Headings | ${data.headings?.length || 0} |\n`;
    md += `| Scripts | ${data.scripts?.total || 0} |\n`;
    md += `| Stylesheets | ${data.stylesheets?.total || 0} |\n`;
    md += `| iFrames | ${data.iframes?.total || data.iframes || 0} |\n`;
    md += `| Shadow DOM Elements | ${data.shadowDomCount || 0} |\n`;
    md += `| Custom Elements | ${data.customElements || 0} |\n\n`;

    if (data.meta) {
      md += `## Meta Information\n\n`;
      md += `- **Title:** ${data.meta.title || '(none)'}\n`;
      md += `- **Description:** ${data.meta.description || '(none)'}\n`;
      md += `- **Charset:** ${data.meta.charset || '(none)'}\n`;
      md += `- **Viewport:** ${data.meta.viewport || '(none)'}\n`;
      md += `- **Canonical:** ${data.meta.canonical || '(none)'}\n`;
      md += `- **Language:** ${data.meta.language || '(none)'}\n`;
      md += `- **Favicon:** ${data.meta.favicon ? 'Yes' : 'No'}\n`;
      
      if (data.meta.openGraph && data.meta.openGraph.length > 0) {
        md += `\n### Open Graph Tags\n\n`;
        data.meta.openGraph.forEach(og => {
          md += `- **${og.property}:** ${og.content}\n`;
        });
      }
      
      if (data.meta.twitterCards && data.meta.twitterCards.length > 0) {
        md += `\n### Twitter Card Tags\n\n`;
        data.meta.twitterCards.forEach(tc => {
          md += `- **${tc.name}:** ${tc.content}\n`;
        });
      }
      md += '\n';
    }

    md += `## Headings Structure\n\n`;
    if (data.headings && data.headings.length > 0) {
      data.headings.forEach(h => {
        const indent = '  '.repeat(parseInt(h.level.replace('H', '')) - 1);
        md += `${indent}- **${h.level}:** ${h.text}\n`;
      });
    } else {
      md += `No headings found.\n`;
    }
    md += '\n';

    md += `## Forms Detail\n\n`;
    if (data.forms.length === 0) {
      md += `No forms detected on this page.\n\n`;
    } else {
      data.forms.forEach((form, i) => {
        md += `### Form ${i + 1}: ${form.name || '(unnamed)'}\n\n`;
        md += `- **Action:** ${form.action || 'N/A'}\n`;
        md += `- **Method:** ${form.method || 'GET'}\n`;
        md += `- **Fields Count:** ${form.fields.length}\n`;
        if (form.inShadowDOM) md += `- **In Shadow DOM:** Yes\n`;
        md += '\n';
        
        if (form.fields.length > 0) {
          md += `| Label/Name | Type | ID | Required | Validation |\n`;
          md += `|------------|------|----|---------|-----------|\n`;
          form.fields.forEach(field => {
            const name = field.label || field.name || field.id || field.placeholder || '(unnamed)';
            const validation = [];
            if (field.pattern) validation.push(`pattern`);
            if (field.minLength) validation.push(`min:${field.minLength}`);
            if (field.maxLength) validation.push(`max:${field.maxLength}`);
            if (field.min) validation.push(`min:${field.min}`);
            if (field.max) validation.push(`max:${field.max}`);
            md += `| ${name} | ${field.type} | ${field.id || '-'} | ${field.required ? 'Yes' : 'No'} | ${validation.join(', ') || '-'} |\n`;
          });
          md += '\n';
        }
      });
    }

    md += `## Buttons\n\n`;
    if (data.buttons.length > 0) {
      md += `| Text | Type | Disabled |\n`;
      md += `|------|------|----------|\n`;
      data.buttons.slice(0, 30).forEach(btn => {
        md += `| ${btn.text} | ${btn.type} | ${btn.disabled ? 'Yes' : 'No'} |\n`;
      });
      if (data.buttons.length > 30) {
        md += `\n*...and ${data.buttons.length - 30} more buttons*\n`;
      }
    } else {
      md += `No buttons found.\n`;
    }
    md += '\n';

    md += `## Links\n\n`;
    if (data.navigation) {
      md += `- **Total Links:** ${data.linksTotal || data.links.length}\n`;
      md += `- **Internal Links:** ${data.navigation.internalLinks || 0}\n`;
      md += `- **External Links:** ${data.navigation.externalLinks || 0}\n`;
      md += `- **Anchor Links:** ${data.navigation.anchorLinks || 0}\n`;
      md += `- **Tel/Mail Links:** ${data.navigation.telMailLinks || 0}\n\n`;
    }
    if (data.links.length > 0) {
      md += `### Sample Links (first 20)\n\n`;
      data.links.slice(0, 20).forEach(link => {
        md += `- [${link.text || '(no text)'}](${link.href})\n`;
      });
    }
    md += '\n';

    md += `## Media\n\n`;
    if (data.media) {
      md += `### Images\n`;
      md += `- **Total:** ${data.media.images?.total || 0}\n`;
      md += `- **With Alt Text:** ${data.media.images?.withAlt || 0}\n`;
      md += `- **Without Alt Text:** ${data.media.images?.withoutAlt || 0}\n`;
      if (data.media.images?.items && data.media.images.items.length > 0) {
        md += `\n| Src | Alt | Dimensions |\n`;
        md += `|-----|-----|------------|\n`;
        data.media.images.items.slice(0, 10).forEach(img => {
          const src = img.src?.substring(0, 50) + (img.src?.length > 50 ? '...' : '');
          md += `| ${src || '-'} | ${img.alt || '-'} | ${img.width || '?'}x${img.height || '?'} |\n`;
        });
      }
      
      md += `\n### Videos\n`;
      md += `- **Total:** ${data.media.videos?.total || 0}\n`;
      
      md += `\n### Audio\n`;
      md += `- **Total:** ${data.media.audio?.total || 0}\n`;
      
      md += `\n### SVG\n`;
      md += `- **Total:** ${data.media.svg?.total || 0}\n`;
      
      md += `\n### Canvas\n`;
      md += `- **Total:** ${data.media.canvas || 0}\n`;
    }
    md += '\n';

    if (data.tables && data.tables.items && data.tables.items.length > 0) {
      md += `## Tables\n\n`;
      md += `- **Total:** ${data.tables.total}\n\n`;
      data.tables.items.forEach((table, i) => {
        md += `### Table ${i + 1}\n`;
        md += `- **Rows:** ${table.rows}\n`;
        md += `- **Columns:** ${table.columns}\n`;
        md += `- **Has Header:** ${table.hasHeader ? 'Yes' : 'No'}\n`;
        if (table.caption) md += `- **Caption:** ${table.caption}\n`;
        md += '\n';
      });
    }

    md += `## Semantic Structure\n\n`;
    if (data.semantic) {
      md += `| Element | Count |\n`;
      md += `|---------|-------|\n`;
      md += `| \`<header>\` | ${data.semantic.header || 0} |\n`;
      md += `| \`<nav>\` | ${data.semantic.nav || 0} |\n`;
      md += `| \`<main>\` | ${data.semantic.main || 0} |\n`;
      md += `| \`<article>\` | ${data.semantic.article || 0} |\n`;
      md += `| \`<section>\` | ${data.semantic.section || 0} |\n`;
      md += `| \`<aside>\` | ${data.semantic.aside || 0} |\n`;
      md += `| \`<footer>\` | ${data.semantic.footer || 0} |\n`;
      md += `| \`<figure>\` | ${data.semantic.figure || 0} |\n`;
      md += `| \`<figcaption>\` | ${data.semantic.figcaption || 0} |\n`;
      md += `| \`<details>\` | ${data.semantic.details || 0} |\n`;
      md += `| \`<dialog>\` | ${data.semantic.dialog || 0} |\n`;
    }
    md += '\n';

    md += `## Accessibility\n\n`;
    if (data.accessibility) {
      md += `| Feature | Count/Status |\n`;
      md += `|---------|-------------|\n`;
      md += `| ARIA Labels | ${data.accessibility.ariaLabels || 0} |\n`;
      md += `| ARIA Roles | ${data.accessibility.ariaRoles || 0} |\n`;
      md += `| Tabindex Elements | ${data.accessibility.tabindex || 0} |\n`;
      md += `| Labels | ${data.accessibility.labels || 0} |\n`;
      md += `| Skip Links | ${data.accessibility.skipLinks || 0} |\n`;
      md += `| Lang Attribute | ${data.accessibility.langAttribute ? 'Yes' : 'No'} |\n`;
      md += `| Alt Text Coverage | ${data.accessibility.altTextCoverage || 0}% |\n`;
    }
    md += '\n';

    md += `## Scripts & Styles\n\n`;
    if (data.scripts) {
      md += `### Scripts\n`;
      md += `- **Total:** ${data.scripts.total || 0}\n`;
      md += `- **External:** ${data.scripts.external || 0}\n`;
      md += `- **Inline:** ${data.scripts.inline || 0}\n`;
      md += `- **Modules:** ${data.scripts.modules || 0}\n`;
      md += `- **Async:** ${data.scripts.async || 0}\n`;
      md += `- **Defer:** ${data.scripts.defer || 0}\n`;
      
      if (data.scripts.sources && data.scripts.sources.length > 0) {
        md += `\n**External Script Sources:**\n`;
        data.scripts.sources.slice(0, 10).forEach(src => {
          md += `- ${src}\n`;
        });
      }
    }
    if (data.stylesheets) {
      md += `\n### Stylesheets\n`;
      md += `- **Total:** ${data.stylesheets.total || 0}\n`;
      md += `- **External:** ${data.stylesheets.external || 0}\n`;
      md += `- **Inline:** ${data.stylesheets.inline || 0}\n`;
    }
    md += '\n';

    if (data.performance) {
      md += `## Performance Hints\n\n`;
      md += `- **DOM Elements:** ${data.performance.domElements || 0}\n`;
      md += `- **DOM Depth:** ${data.performance.domDepth || 0}\n`;
      md += `- **Images without dimensions:** ${data.performance.imagesWithoutDimensions || 0}\n`;
      md += `- **Inline Styles:** ${data.performance.inlineStyles || 0}\n`;
      md += `- **Deprecated Elements:** ${data.performance.deprecatedElements || 0}\n`;
      md += '\n';
    }

    if (data.iframes && data.iframes.items && data.iframes.items.length > 0) {
      md += `## iFrames\n\n`;
      md += `- **Total:** ${data.iframes.total}\n\n`;
      data.iframes.items.forEach((iframe, i) => {
        md += `${i + 1}. **${iframe.title || 'Untitled'}**\n`;
        md += `   - Src: ${iframe.src || '(none)'}\n`;
        if (iframe.sandbox) md += `   - Sandbox: Yes\n`;
        md += '\n';
      });
    }

    md += `---\n\n`;
    md += `*Generated by ScanVui v2.0*\n`;

    return md;
  }

  downloadJson() {
    if (!this.scanData) return;
    const detailedJson = this.generateDetailedJson(this.scanData);
    const blob = new Blob([JSON.stringify(detailedJson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scanvui-report-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('Downloaded!');
  }

  showToast(message) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.remove(), 2000);
  }
}

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
      const children = root.children || [];
      for (let i = 0; i < children.length; i++) {
        const node = children[i];
        if (!node || node.nodeType !== 1) continue;
        
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
    } catch (e) {}
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
  const forms = document.querySelectorAll('form');
  forms.forEach((form, index) => {
    const formData = {
      index,
      name: form.name || form.id || form.getAttribute('aria-label') || null,
      action: form.action || null,
      method: (form.method || 'GET').toUpperCase(),
      enctype: form.enctype || null,
      target: form.target || null,
      autocomplete: form.autocomplete || null,
      novalidate: form.noValidate || false,
      fields: []
    };

    const inputs = form.querySelectorAll('input, select, textarea, [contenteditable="true"], [role="textbox"], [role="combobox"]');
    inputs.forEach(input => {
      const field = extractFieldInfo(input);
      if (field) {
        formData.fields.push(field);
        result.totalFields++;
      }
    });

    result.forms.push(formData);
  });

  // Orphan inputs
  const orphanInputs = document.querySelectorAll('input:not(form input), select:not(form select), textarea:not(form textarea), [contenteditable="true"]:not(form [contenteditable="true"])');
  if (orphanInputs.length > 0) {
    const orphanForm = {
      index: result.forms.length,
      name: 'Standalone Fields (no form)',
      action: null,
      method: null,
      isOrphan: true,
      fields: []
    };

    orphanInputs.forEach(input => {
      const field = extractFieldInfo(input);
      if (field) {
        orphanForm.fields.push(field);
        result.totalFields++;
      }
    });

    if (orphanForm.fields.length > 0) {
      result.forms.push(orphanForm);
    }
  }

  function extractFieldInfo(element) {
    const tagName = element.tagName.toLowerCase();
    
    if (tagName === 'input' && element.type === 'hidden') {
      return null;
    }

    let type = 'text';
    if (tagName === 'select') type = 'select';
    else if (tagName === 'textarea') type = 'textarea';
    else if (tagName === 'input') type = element.type || 'text';
    else if (element.hasAttribute('contenteditable')) type = 'contenteditable';
    else if (element.getAttribute('role') === 'textbox') type = 'textbox';
    else if (element.getAttribute('role') === 'combobox') type = 'combobox';

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
      placeholder: element.placeholder || null,
      required: element.required || element.getAttribute('aria-required') === 'true',
      disabled: element.disabled || element.getAttribute('aria-disabled') === 'true',
      readonly: element.readOnly || false,
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
      options: options
    };
  }

  function findLabel(element) {
    if (element.id) {
      const label = document.querySelector(`label[for="${element.id}"]`);
      if (label) return label.textContent.trim();
    }

    const parentLabel = element.closest('label');
    if (parentLabel) {
      const text = parentLabel.textContent.replace(element.value || '', '').trim();
      if (text) return text;
    }

    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;

    const ariaLabelledBy = element.getAttribute('aria-labelledby');
    if (ariaLabelledBy) {
      const labelElement = document.getElementById(ariaLabelledBy);
      if (labelElement) return labelElement.textContent.trim();
    }

    return null;
  }

  // Buttons
  const buttons = document.querySelectorAll('button, input[type="button"], input[type="submit"], input[type="reset"], [role="button"]');
  buttons.forEach(btn => {
    result.buttons.push({
      text: btn.textContent?.trim() || btn.value || btn.getAttribute('aria-label') || '(no text)',
      type: btn.type || 'button',
      disabled: btn.disabled,
      id: btn.id || null,
      className: btn.className?.toString().substring(0, 50) || null
    });
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
      text: (a.textContent?.trim() || '(no text)').substring(0, 80),
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
  result.headings = Array.from(headings).map(h => ({
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

document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
