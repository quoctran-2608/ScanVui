class PopupController {
  constructor() {
    this.scanData = null;
    this.filteredData = null;
    this.sectionsInitialized = false;
    this.init();
  }

  init() {
    this.bindElements();
    this.bindEvents();
    this.loadLastScan();
    this.initTheme();
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
    this.welcomeScreen = document.getElementById('welcomeScreen');
    this.searchInput = document.getElementById('searchInput');
    this.themeToggle = document.getElementById('themeToggle');
    this.scoreSection = document.getElementById('scoreSection');
  }

  bindEvents() {
    this.scanBtn.addEventListener('click', () => this.scanPage());
    this.refreshBtn.addEventListener('click', () => this.scanPage());
    this.copyJsonBtn.addEventListener('click', () => this.copyAsJson());
    this.copyTextBtn.addEventListener('click', () => this.copyAsText());
    this.downloadBtn.addEventListener('click', () => this.downloadJson());
    
    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
    }
    
    if (this.themeToggle) {
      this.themeToggle.addEventListener('click', () => this.toggleTheme());
    }
  }

  escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }

  initTheme() {
    const savedTheme = localStorage.getItem('scanvui-theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    this.updateThemeIcon(savedTheme);
  }

  toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('scanvui-theme', newTheme);
    this.updateThemeIcon(newTheme);
  }

  updateThemeIcon(theme) {
    if (this.themeToggle) {
      this.themeToggle.innerHTML = theme === 'light' ? '🌙' : '☀️';
      this.themeToggle.title = theme === 'light' ? 'Dark mode' : 'Light mode';
    }
  }

  async loadLastScan() {
    try {
      const result = await chrome.storage.local.get(['lastScan', 'lastScanUrl']);
      if (result.lastScan) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.url === result.lastScanUrl) {
          this.showResults(result.lastScan, false);
          return;
        }
      }
    } catch (e) {
      console.log('No previous scan data');
    }
    this.showWelcome();
  }

  showWelcome() {
    if (this.welcomeScreen) {
      this.welcomeScreen.classList.remove('hidden');
    }
    this.results.classList.add('hidden');
    this.footer.classList.add('hidden');
  }

  hideWelcome() {
    if (this.welcomeScreen) {
      this.welcomeScreen.classList.add('hidden');
    }
  }

  showLoading() {
    this.hideWelcome();
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

  showResults(data, saveToStorage = true) {
    this.hideLoading();
    this.hideWelcome();
    this.scanData = data;
    this.filteredData = data;
    
    if (saveToStorage) {
      this.saveScanData(data);
    }
    
    this.renderScoreSection(data);
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
    this.renderStorageSection(data);
    
    if (!this.sectionsInitialized) {
      this.bindCollapsibleSections();
      this.sectionsInitialized = true;
    }
    
    this.results.classList.remove('hidden');
    this.footer.classList.remove('hidden');
  }

  async saveScanData(data) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.storage.local.set({
        lastScan: data,
        lastScanUrl: tab?.url || ''
      });
    } catch (e) {
      console.error('Failed to save scan data:', e);
    }
  }

  bindCollapsibleSections() {
    document.querySelectorAll('.section-header').forEach(header => {
      const newHeader = header.cloneNode(true);
      header.parentNode.replaceChild(newHeader, header);
      
      newHeader.addEventListener('click', () => {
        const targetId = newHeader.dataset.target;
        const content = document.getElementById(targetId);
        const toggle = newHeader.querySelector('.section-toggle');
        if (content && toggle) {
          content.classList.toggle('expanded');
          toggle.classList.toggle('expanded');
        }
      });
    });
  }

  calculateScores(data) {
    const scores = {
      seo: { score: 0, max: 100, issues: [] },
      accessibility: { score: 0, max: 100, issues: [] },
      performance: { score: 0, max: 100, issues: [] },
      bestPractices: { score: 0, max: 100, issues: [] }
    };

    // SEO Score
    let seoPoints = 0;
    if (data.meta?.title) seoPoints += 15; else scores.seo.issues.push('Missing title');
    if (data.meta?.description) seoPoints += 15; else scores.seo.issues.push('Missing meta description');
    if (data.meta?.canonical) seoPoints += 10; else scores.seo.issues.push('Missing canonical URL');
    if (data.headings?.some(h => h.level === 'H1')) seoPoints += 15; else scores.seo.issues.push('Missing H1 heading');
    if (data.meta?.openGraph?.length > 0) seoPoints += 10; else scores.seo.issues.push('Missing Open Graph tags');
    if (data.meta?.viewport) seoPoints += 10; else scores.seo.issues.push('Missing viewport meta');
    if (data.meta?.language) seoPoints += 10; else scores.seo.issues.push('Missing lang attribute');
    if (data.media?.images?.withAlt === data.media?.images?.total) seoPoints += 15; 
    else if (data.media?.images?.total > 0) scores.seo.issues.push(`${data.media?.images?.withoutAlt || 0} images missing alt text`);
    scores.seo.score = Math.min(100, seoPoints);

    // Accessibility Score
    let a11yPoints = 0;
    const a11y = data.accessibility || {};
    if (a11y.langAttribute) a11yPoints += 15; else scores.accessibility.issues.push('Missing lang attribute');
    if (a11y.skipLinks > 0) a11yPoints += 10; else scores.accessibility.issues.push('No skip links');
    if (a11y.labels >= data.totalFields * 0.8) a11yPoints += 20; else scores.accessibility.issues.push('Many form fields missing labels');
    if (a11y.altTextCoverage >= 90) a11yPoints += 20; else scores.accessibility.issues.push(`Alt text coverage: ${a11y.altTextCoverage || 0}%`);
    if (a11y.ariaLabels > 0 || a11y.ariaRoles > 0) a11yPoints += 15;
    if (data.headings?.length > 0) a11yPoints += 10;
    if (data.semantic?.main > 0) a11yPoints += 10; else scores.accessibility.issues.push('Missing <main> landmark');
    scores.accessibility.score = Math.min(100, a11yPoints);

    // Performance Score
    let perfPoints = 100;
    const perf = data.performance || {};
    if (perf.domElements > 1500) { perfPoints -= 20; scores.performance.issues.push(`High DOM count: ${perf.domElements}`); }
    if (perf.domDepth > 15) { perfPoints -= 10; scores.performance.issues.push(`Deep DOM: ${perf.domDepth} levels`); }
    if (perf.inlineStyles > 50) { perfPoints -= 15; scores.performance.issues.push(`Many inline styles: ${perf.inlineStyles}`); }
    if (perf.imagesWithoutDimensions > 5) { perfPoints -= 15; scores.performance.issues.push(`Images without dimensions: ${perf.imagesWithoutDimensions}`); }
    if ((data.scripts?.total || 0) > 30) { perfPoints -= 15; scores.performance.issues.push(`Many scripts: ${data.scripts?.total}`); }
    if ((data.scripts?.inline || 0) > 10) { perfPoints -= 10; scores.performance.issues.push(`Many inline scripts: ${data.scripts?.inline}`); }
    scores.performance.score = Math.max(0, perfPoints);

    // Best Practices Score
    let bpPoints = 100;
    if (perf.deprecatedElements > 0) { bpPoints -= 20; scores.bestPractices.issues.push(`Deprecated elements: ${perf.deprecatedElements}`); }
    if (!data.meta?.charset) { bpPoints -= 10; scores.bestPractices.issues.push('Missing charset'); }
    if (!data.meta?.favicon) { bpPoints -= 10; scores.bestPractices.issues.push('Missing favicon'); }
    if ((data.iframes?.total || 0) > 5) { bpPoints -= 10; scores.bestPractices.issues.push(`Many iframes: ${data.iframes?.total}`); }
    const externalLinks = data.navigation?.externalLinks || 0;
    const linksWithoutRel = data.links?.filter(l => l.type === 'external' && !l.rel?.includes('noopener'))?.length || 0;
    if (linksWithoutRel > 0) { bpPoints -= 15; scores.bestPractices.issues.push('External links missing rel="noopener"'); }
    scores.bestPractices.score = Math.max(0, bpPoints);

    return scores;
  }

  renderScoreSection(data) {
    const container = document.getElementById('scoreSection');
    if (!container) return;

    const scores = this.calculateScores(data);
    const overall = Math.round((scores.seo.score + scores.accessibility.score + scores.performance.score + scores.bestPractices.score) / 4);

    const getScoreClass = (score) => {
      if (score >= 80) return 'good';
      if (score >= 50) return 'warning';
      return 'poor';
    };

    const getScoreEmoji = (score) => {
      if (score >= 80) return '✅';
      if (score >= 50) return '⚠️';
      return '❌';
    };

    container.innerHTML = `
      <div class="overall-score ${getScoreClass(overall)}">
        <div class="overall-score-value">${overall}</div>
        <div class="overall-score-label">Overall Score</div>
      </div>
      <div class="score-grid">
        <div class="score-item" title="${scores.seo.issues.join('\\n') || 'Good!'}">
          <div class="score-header">
            <span>${getScoreEmoji(scores.seo.score)} SEO</span>
            <span class="score-value ${getScoreClass(scores.seo.score)}">${scores.seo.score}</span>
          </div>
          <div class="score-bar"><div class="score-fill ${getScoreClass(scores.seo.score)}" style="width: ${scores.seo.score}%"></div></div>
        </div>
        <div class="score-item" title="${scores.accessibility.issues.join('\\n') || 'Good!'}">
          <div class="score-header">
            <span>${getScoreEmoji(scores.accessibility.score)} Accessibility</span>
            <span class="score-value ${getScoreClass(scores.accessibility.score)}">${scores.accessibility.score}</span>
          </div>
          <div class="score-bar"><div class="score-fill ${getScoreClass(scores.accessibility.score)}" style="width: ${scores.accessibility.score}%"></div></div>
        </div>
        <div class="score-item" title="${scores.performance.issues.join('\\n') || 'Good!'}">
          <div class="score-header">
            <span>${getScoreEmoji(scores.performance.score)} Performance</span>
            <span class="score-value ${getScoreClass(scores.performance.score)}">${scores.performance.score}</span>
          </div>
          <div class="score-bar"><div class="score-fill ${getScoreClass(scores.performance.score)}" style="width: ${scores.performance.score}%"></div></div>
        </div>
        <div class="score-item" title="${scores.bestPractices.issues.join('\\n') || 'Good!'}">
          <div class="score-header">
            <span>${getScoreEmoji(scores.bestPractices.score)} Best Practices</span>
            <span class="score-value ${getScoreClass(scores.bestPractices.score)}">${scores.bestPractices.score}</span>
          </div>
          <div class="score-bar"><div class="score-fill ${getScoreClass(scores.bestPractices.score)}" style="width: ${scores.bestPractices.score}%"></div></div>
        </div>
      </div>
    `;
  }

  handleSearch(query) {
    query = query.toLowerCase().trim();
    
    document.querySelectorAll('.field-item, .other-item, .meta-item, .heading-item').forEach(item => {
      const text = item.textContent.toLowerCase();
      item.style.display = text.includes(query) || query === '' ? '' : 'none';
    });

    document.querySelectorAll('.form-card').forEach(card => {
      const text = card.textContent.toLowerCase();
      card.style.display = text.includes(query) || query === '' ? '' : 'none';
    });
  }

  renderHeadingsSection(data) {
    const container = document.getElementById('headingsSection');
    if (!container) return;

    if (!data.headings || data.headings.length === 0) {
      container.innerHTML = '<p class="empty-message">No headings found on this page.</p>';
      return;
    }

    container.innerHTML = data.headings.map(h => {
      const level = h.level.toLowerCase();
      return `
        <div class="heading-item ${level}" data-element-selector="${this.escapeHtml(h.id ? '#' + h.id : h.level)}">
          <span class="heading-level">${this.escapeHtml(h.level)}</span>
          <span class="heading-text">${this.escapeHtml(h.text) || '(empty)'}</span>
        </div>
      `;
    }).join('');

    this.bindHighlightEvents(container);
  }

  bindHighlightEvents(container) {
    container.querySelectorAll('[data-element-selector]').forEach(item => {
      item.addEventListener('mouseenter', () => {
        const selector = item.dataset.elementSelector;
        this.highlightElement(selector);
      });
      item.addEventListener('mouseleave', () => {
        this.removeHighlight();
      });
      item.addEventListener('click', () => {
        const selector = item.dataset.elementSelector;
        this.scrollToElement(selector);
      });
    });
  }

  async highlightElement(selector) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (sel) => {
          const existing = document.getElementById('scanvui-highlight');
          if (existing) existing.remove();

          let element = null;
          try {
            element = document.querySelector(sel);
          } catch (e) {
            const elements = document.querySelectorAll(sel);
            if (elements.length > 0) element = elements[0];
          }

          if (element) {
            const rect = element.getBoundingClientRect();
            const highlight = document.createElement('div');
            highlight.id = 'scanvui-highlight';
            highlight.style.cssText = `
              position: fixed;
              top: ${rect.top - 4}px;
              left: ${rect.left - 4}px;
              width: ${rect.width + 8}px;
              height: ${rect.height + 8}px;
              border: 3px solid #667eea;
              background: rgba(102, 126, 234, 0.15);
              border-radius: 4px;
              pointer-events: none;
              z-index: 999999;
              transition: all 0.2s ease;
              box-shadow: 0 0 20px rgba(102, 126, 234, 0.4);
            `;
            document.body.appendChild(highlight);
          }
        },
        args: [selector]
      });
    } catch (e) {
      console.log('Highlight failed:', e);
    }
  }

  async removeHighlight() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const existing = document.getElementById('scanvui-highlight');
          if (existing) existing.remove();
        }
      });
    } catch (e) {}
  }

  async scrollToElement(selector) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (sel) => {
          let element = null;
          try {
            element = document.querySelector(sel);
          } catch (e) {
            const elements = document.querySelectorAll(sel);
            if (elements.length > 0) element = elements[0];
          }
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        },
        args: [selector]
      });
    } catch (e) {}
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
          <span class="summary-label">${this.escapeHtml(item.label)}</span>
          <span class="summary-value">${item.value}</span>
        </div>
      </div>
    `).join('');
  }

  renderForms(forms) {
    if (forms.length === 0) {
      this.formsContainer.innerHTML = '<p class="empty-message">No forms detected on this page.</p>';
      return;
    }

    this.formsContainer.innerHTML = forms.map((form, index) => `
      <div class="form-card">
        <div class="form-header" data-form-index="${index}">
          <span class="form-toggle">▶</span>
          <span class="form-title">${this.escapeHtml(form.name) || `Form #${index + 1}`}</span>
          <span class="form-badge">${form.fields.length} fields</span>
          ${form.method ? `<span class="form-method">${this.escapeHtml(form.method)}</span>` : ''}
        </div>
        <div class="form-fields" id="form-fields-${index}">
          ${form.action ? `<div class="form-action">Action: ${this.escapeHtml(form.action)}</div>` : ''}
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
      return '<p class="empty-message">No fields in this form.</p>';
    }

    return fields.map(field => {
      const icon = this.getFieldIcon(field.type);
      const tags = [];
      
      if (field.type) tags.push(`<span class="field-tag type">${this.escapeHtml(field.type)}</span>`);
      if (field.required) tags.push(`<span class="field-tag required">required</span>`);
      if (field.pattern) tags.push(`<span class="field-tag">pattern</span>`);
      if (field.minLength || field.maxLength) tags.push(`<span class="field-tag">length</span>`);
      if (field.inShadowDOM) tags.push(`<span class="field-tag shadow">shadow</span>`);
      if (field.disabled) tags.push(`<span class="field-tag disabled">disabled</span>`);
      if (field.readonly) tags.push(`<span class="field-tag">readonly</span>`);

      const selector = field.id ? `#${field.id}` : (field.name ? `[name="${field.name}"]` : field.tag);

      return `
        <div class="field-item" data-element-selector="${this.escapeHtml(selector)}">
          <span class="field-icon">${icon}</span>
          <div class="field-info">
            <div class="field-name">${this.escapeHtml(field.label || field.name || field.id || field.placeholder) || '(unnamed)'}</div>
            ${field.name ? `<div class="field-attr">name: ${this.escapeHtml(field.name)}</div>` : ''}
            ${field.id ? `<div class="field-attr">id: ${this.escapeHtml(field.id)}</div>` : ''}
            <div class="field-meta">${tags.join('')}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  getFieldIcon(type) {
    const icons = {
      'text': '📝', 'email': '📧', 'password': '🔒', 'number': '🔢',
      'tel': '📞', 'url': '🌐', 'date': '📅', 'datetime-local': '📅',
      'time': '🕐', 'file': '📎', 'checkbox': '☑️', 'radio': '🔘',
      'select': '📋', 'textarea': '📄', 'hidden': '👁️', 'submit': '✅',
      'button': '🔲', 'search': '🔍', 'color': '🎨', 'range': '📊'
    };
    return icons[type] || '📝';
  }

  toggleForm(header) {
    const index = header.dataset.formIndex;
    const fields = document.getElementById(`form-fields-${index}`);
    const toggle = header.querySelector('.form-toggle');
    
    fields.classList.toggle('expanded');
    toggle.classList.toggle('expanded');

    if (fields.classList.contains('expanded')) {
      this.bindHighlightEvents(fields);
    }
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
      { icon: '🖼️', label: 'Images', count: data.media.images?.total || 0, details: `${data.media.images?.withAlt || 0} with alt` },
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
    const stylesheets = data.stylesheets || {};
    
    container.innerHTML = `
      <div class="subsection-title">Scripts</div>
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
      <div class="other-item">
        <span class="other-icon">⚡</span>
        <span class="other-label">Async/Defer</span>
        <span class="other-count">${(scripts.async || 0) + (scripts.defer || 0)}</span>
      </div>
      <div class="subsection-title">Stylesheets</div>
      <div class="other-item">
        <span class="other-icon">🎨</span>
        <span class="other-label">Total</span>
        <span class="other-count">${stylesheets.total || 0}</span>
      </div>
      <div class="other-item">
        <span class="other-icon">🔗</span>
        <span class="other-label">External</span>
        <span class="other-count">${stylesheets.external || 0}</span>
      </div>
      <div class="other-item">
        <span class="other-icon">📝</span>
        <span class="other-label">Inline</span>
        <span class="other-count">${stylesheets.inline || 0}</span>
      </div>
    `;
  }

  renderAccessibilitySection(data) {
    const container = document.getElementById('accessibilitySection');
    if (!container || !data.accessibility) return;

    const a11y = data.accessibility;
    const coverage = a11y.altTextCoverage || 0;
    const coverageClass = coverage >= 90 ? 'good' : coverage >= 50 ? 'warning' : 'poor';

    container.innerHTML = `
      <div class="a11y-coverage">
        <span>Alt Text Coverage</span>
        <div class="coverage-bar">
          <div class="coverage-fill ${coverageClass}" style="width: ${coverage}%"></div>
        </div>
        <span class="coverage-value">${coverage}%</span>
      </div>
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
        <span class="other-label">Form Labels</span>
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
        <span class="meta-value">${this.escapeHtml(meta.title) || '<em>(none)</em>'}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Description</span>
        <span class="meta-value">${this.escapeHtml(meta.description) || '<em>(none)</em>'}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Keywords</span>
        <span class="meta-value">${this.escapeHtml(meta.keywords) || '<em>(none)</em>'}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Author</span>
        <span class="meta-value">${this.escapeHtml(meta.author) || '<em>(none)</em>'}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Viewport</span>
        <span class="meta-value">${this.escapeHtml(meta.viewport) || '<em>(none)</em>'}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Charset</span>
        <span class="meta-value">${this.escapeHtml(meta.charset) || '<em>(none)</em>'}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Language</span>
        <span class="meta-value">${this.escapeHtml(meta.language) || '<em>(none)</em>'}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Canonical</span>
        <span class="meta-value">${meta.canonical ? 'Yes' : '<em>No</em>'}</span>
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
        <span class="meta-label">Structured Data</span>
        <span class="meta-value">${meta.structuredData?.length || 0} schemas</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Favicon</span>
        <span class="meta-value">${meta.favicon ? 'Yes' : '<em>No</em>'}</span>
      </div>
    `;
  }

  renderStorageSection(data) {
    const container = document.getElementById('storageSection');
    if (!container || !data.storage) return;

    const storage = data.storage;
    container.innerHTML = `
      <div class="other-item">
        <span class="other-icon">🍪</span>
        <span class="other-label">Cookies</span>
        <span class="other-count">${storage.cookies || 0}</span>
      </div>
      <div class="other-item">
        <span class="other-icon">💾</span>
        <span class="other-label">LocalStorage Keys</span>
        <span class="other-count">${storage.localStorage || 0}</span>
      </div>
      <div class="other-item">
        <span class="other-icon">📦</span>
        <span class="other-label">SessionStorage Keys</span>
        <span class="other-count">${storage.sessionStorage || 0}</span>
      </div>
    `;
  }

  copyAsJson() {
    if (!this.scanData) return;
    const detailedJson = this.generateDetailedJson(this.scanData);
    navigator.clipboard.writeText(JSON.stringify(detailedJson, null, 2))
      .then(() => this.showToast('Copied JSON to clipboard!'))
      .catch((err) => this.showToast('Failed to copy: ' + err.message));
  }

  generateDetailedJson(data) {
    const scores = this.calculateScores(data);
    return {
      scanInfo: {
        url: data.url,
        title: data.title,
        timestamp: data.timestamp,
        scanVersion: '2.1.0'
      },
      scores: {
        overall: Math.round((scores.seo.score + scores.accessibility.score + scores.performance.score + scores.bestPractices.score) / 4),
        seo: { score: scores.seo.score, issues: scores.seo.issues },
        accessibility: { score: scores.accessibility.score, issues: scores.accessibility.issues },
        performance: { score: scores.performance.score, issues: scores.performance.issues },
        bestPractices: { score: scores.bestPractices.score, issues: scores.bestPractices.issues }
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
      forms: data.forms,
      buttons: data.buttons,
      links: { total: data.linksTotal || data.links.length, items: data.links },
      headings: data.headings,
      media: data.media,
      tables: data.tables,
      navigation: data.navigation || {},
      semantic: data.semantic || {},
      scripts: data.scripts || {},
      stylesheets: data.stylesheets || {},
      accessibility: data.accessibility || {},
      performance: data.performance || {},
      storage: data.storage || {},
      iframes: data.iframes
    };
  }

  copyAsText() {
    if (!this.scanData) return;
    const text = this.formatAsMarkdown(this.scanData);
    navigator.clipboard.writeText(text)
      .then(() => this.showToast('Copied Markdown to clipboard!'))
      .catch((err) => this.showToast('Failed to copy: ' + err.message));
  }

  formatAsMarkdown(data) {
    const scores = this.calculateScores(data);
    const overall = Math.round((scores.seo.score + scores.accessibility.score + scores.performance.score + scores.bestPractices.score) / 4);
    
    let md = `# ScanVui Report\n\n`;
    md += `**URL:** ${data.url}\n`;
    md += `**Title:** ${data.title}\n`;
    md += `**Scanned:** ${new Date(data.timestamp).toLocaleString()}\n\n`;
    md += `---\n\n`;

    md += `## Scores\n\n`;
    md += `| Category | Score | Status |\n`;
    md += `|----------|-------|--------|\n`;
    md += `| **Overall** | ${overall}/100 | ${overall >= 80 ? '✅' : overall >= 50 ? '⚠️' : '❌'} |\n`;
    md += `| SEO | ${scores.seo.score}/100 | ${scores.seo.score >= 80 ? '✅' : scores.seo.score >= 50 ? '⚠️' : '❌'} |\n`;
    md += `| Accessibility | ${scores.accessibility.score}/100 | ${scores.accessibility.score >= 80 ? '✅' : scores.accessibility.score >= 50 ? '⚠️' : '❌'} |\n`;
    md += `| Performance | ${scores.performance.score}/100 | ${scores.performance.score >= 80 ? '✅' : scores.performance.score >= 50 ? '⚠️' : '❌'} |\n`;
    md += `| Best Practices | ${scores.bestPractices.score}/100 | ${scores.bestPractices.score >= 80 ? '✅' : scores.bestPractices.score >= 50 ? '⚠️' : '❌'} |\n\n`;

    const allIssues = [...scores.seo.issues, ...scores.accessibility.issues, ...scores.performance.issues, ...scores.bestPractices.issues];
    if (allIssues.length > 0) {
      md += `### Issues Found\n\n`;
      allIssues.forEach(issue => {
        md += `- ⚠️ ${issue}\n`;
      });
      md += '\n';
    }

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
    md += `| Shadow DOM | ${data.shadowDomCount || 0} |\n`;
    md += `| Custom Elements | ${data.customElements || 0} |\n\n`;

    if (data.meta) {
      md += `## Meta Information\n\n`;
      md += `- **Title:** ${data.meta.title || '(none)'}\n`;
      md += `- **Description:** ${data.meta.description || '(none)'}\n`;
      md += `- **Charset:** ${data.meta.charset || '(none)'}\n`;
      md += `- **Viewport:** ${data.meta.viewport || '(none)'}\n`;
      md += `- **Language:** ${data.meta.language || '(none)'}\n`;
      md += `- **Canonical:** ${data.meta.canonical || '(none)'}\n`;
      md += `- **Favicon:** ${data.meta.favicon ? 'Yes' : 'No'}\n`;
      md += `- **Open Graph Tags:** ${data.meta.openGraph?.length || 0}\n`;
      md += `- **Twitter Cards:** ${data.meta.twitterCards?.length || 0}\n`;
      md += `- **Structured Data:** ${data.meta.structuredData?.length || 0}\n\n`;
    }

    md += `## Headings Structure\n\n`;
    if (data.headings?.length > 0) {
      data.headings.forEach(h => {
        const indent = '  '.repeat(parseInt(h.level.replace('H', '')) - 1);
        md += `${indent}- **${h.level}:** ${h.text}\n`;
      });
    } else {
      md += `No headings found.\n`;
    }
    md += '\n';

    md += `## Forms\n\n`;
    if (data.forms.length === 0) {
      md += `No forms detected.\n\n`;
    } else {
      data.forms.forEach((form, i) => {
        md += `### ${form.name || `Form #${i + 1}`}\n\n`;
        md += `- **Action:** ${form.action || 'N/A'}\n`;
        md += `- **Method:** ${form.method || 'GET'}\n`;
        md += `- **Fields:** ${form.fields.length}\n\n`;
        
        if (form.fields.length > 0) {
          md += `| Field | Type | Required |\n`;
          md += `|-------|------|----------|\n`;
          form.fields.forEach(field => {
            const name = field.label || field.name || field.id || '(unnamed)';
            md += `| ${name} | ${field.type} | ${field.required ? 'Yes' : 'No'} |\n`;
          });
          md += '\n';
        }
      });
    }

    md += `## Accessibility\n\n`;
    if (data.accessibility) {
      md += `- **Alt Text Coverage:** ${data.accessibility.altTextCoverage || 0}%\n`;
      md += `- **ARIA Labels:** ${data.accessibility.ariaLabels || 0}\n`;
      md += `- **ARIA Roles:** ${data.accessibility.ariaRoles || 0}\n`;
      md += `- **Form Labels:** ${data.accessibility.labels || 0}\n`;
      md += `- **Skip Links:** ${data.accessibility.skipLinks || 0}\n`;
      md += `- **Lang Attribute:** ${data.accessibility.langAttribute ? 'Yes' : 'No'}\n\n`;
    }

    md += `## Performance\n\n`;
    if (data.performance) {
      md += `- **DOM Elements:** ${data.performance.domElements || 0}\n`;
      md += `- **DOM Depth:** ${data.performance.domDepth || 0}\n`;
      md += `- **Inline Styles:** ${data.performance.inlineStyles || 0}\n`;
      md += `- **Images without dimensions:** ${data.performance.imagesWithoutDimensions || 0}\n`;
      md += `- **Deprecated Elements:** ${data.performance.deprecatedElements || 0}\n\n`;
    }

    md += `---\n\n`;
    md += `*Generated by ScanVui v2.1*\n`;

    return md;
  }

  downloadJson() {
    if (!this.scanData) return;
    const detailedJson = this.generateDetailedJson(this.scanData);
    const blob = new Blob([JSON.stringify(detailedJson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scanvui-${new Date().toISOString().slice(0, 10)}.json`;
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
    
    setTimeout(() => toast.remove(), 2500);
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
    storage: {},
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

  // Storage information
  try {
    result.storage = {
      cookies: document.cookie ? document.cookie.split(';').filter(c => c.trim()).length : 0,
      localStorage: localStorage ? Object.keys(localStorage).length : 0,
      sessionStorage: sessionStorage ? Object.keys(sessionStorage).length : 0
    };
  } catch (e) {
    result.storage = { cookies: 0, localStorage: 0, sessionStorage: 0 };
  }

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

  // Links
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
