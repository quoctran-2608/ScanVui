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
    this.results.classList.remove('hidden');
    this.footer.classList.remove('hidden');
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
      { icon: '🔗', label: 'Links', value: data.links.length },
      { icon: '🖼️', label: 'Images', value: data.images },
      { icon: '📊', label: 'Tables', value: data.tables }
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
        </div>
        <div class="form-fields" id="form-fields-${index}">
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

      return `
        <div class="field-item">
          <span class="field-icon">${icon}</span>
          <div class="field-info">
            <div class="field-name">${field.label || field.name || field.id || field.placeholder || '(unnamed)'}</div>
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
      { icon: '📰', label: 'Headings', count: data.headings?.length || 0 },
      { icon: '🔘', label: 'Standalone Buttons', count: data.buttons?.length || 0 },
      { icon: '📦', label: 'iFrames', count: data.iframes || 0 },
      { icon: '🌑', label: 'Shadow DOM Elements', count: data.shadowDomCount || 0 },
      { icon: '🧩', label: 'Custom Elements', count: data.customElements || 0 }
    ];

    this.otherElements.innerHTML = items.map(item => `
      <div class="other-item">
        <span class="other-icon">${item.icon}</span>
        <span class="other-label">${item.label}</span>
        <span class="other-count">${item.count}</span>
      </div>
    `).join('');
  }

  copyAsJson() {
    if (!this.scanData) return;
    navigator.clipboard.writeText(JSON.stringify(this.scanData, null, 2))
      .then(() => this.showToast('Copied JSON to clipboard!'))
      .catch(() => this.showToast('Failed to copy'));
  }

  copyAsText() {
    if (!this.scanData) return;
    const text = this.formatAsText(this.scanData);
    navigator.clipboard.writeText(text)
      .then(() => this.showToast('Copied text to clipboard!'))
      .catch(() => this.showToast('Failed to copy'));
  }

  formatAsText(data) {
    let text = '=== PAGE ANALYSIS ===\n\n';
    text += `URL: ${data.url}\n`;
    text += `Scanned: ${data.timestamp}\n\n`;
    
    text += '--- SUMMARY ---\n';
    text += `Forms: ${data.forms.length}\n`;
    text += `Total Fields: ${data.totalFields}\n`;
    text += `Buttons: ${data.buttons.length}\n`;
    text += `Links: ${data.links.length}\n`;
    text += `Images: ${data.images}\n`;
    text += `Tables: ${data.tables}\n\n`;

    text += '--- FORMS DETAIL ---\n';
    data.forms.forEach((form, i) => {
      text += `\nForm #${i + 1}: ${form.name || '(unnamed)'}\n`;
      text += `  Action: ${form.action || 'N/A'}\n`;
      text += `  Method: ${form.method || 'GET'}\n`;
      text += `  Fields:\n`;
      form.fields.forEach(field => {
        text += `    - ${field.label || field.name || field.id || '(unnamed)'} [${field.type}]${field.required ? ' *required' : ''}\n`;
      });
    });

    return text;
  }

  downloadJson() {
    if (!this.scanData) return;
    const blob = new Blob([JSON.stringify(this.scanData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `form-analysis-${new Date().toISOString().slice(0, 10)}.json`;
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
    if (depth > 15) return;
    
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
    } catch (e) {
      console.warn('FormInspector: DOM walk error', e);
    }
  }

  walkDOM(document.body);
  result.shadowDomCount = shadowDomCount;
  result.customElements = customElements;

  const forms = document.querySelectorAll('form');
  forms.forEach((form, index) => {
    const formData = {
      index,
      name: form.name || form.id || form.getAttribute('aria-label') || null,
      action: form.action || null,
      method: form.method || 'GET',
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

  const orphanInputs = document.querySelectorAll('input:not(form input), select:not(form select), textarea:not(form textarea), [contenteditable="true"]:not(form [contenteditable="true"])');
  if (orphanInputs.length > 0) {
    const orphanForm = {
      index: result.forms.length,
      name: 'Standalone Fields (no form)',
      action: null,
      method: null,
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
      maxLength: element.maxLength > 0 ? element.maxLength : null,
      min: element.min || null,
      max: element.max || null,
      autocomplete: element.autocomplete || null,
      ariaLabel: element.getAttribute('aria-label') || null
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

  const buttons = document.querySelectorAll('button, input[type="button"], input[type="submit"], [role="button"]');
  buttons.forEach(btn => {
    result.buttons.push({
      text: btn.textContent?.trim() || btn.value || btn.getAttribute('aria-label') || '(no text)',
      type: btn.type || 'button',
      disabled: btn.disabled
    });
  });

  const links = document.querySelectorAll('a[href]');
  result.links = Array.from(links).slice(0, 50).map(a => ({
    text: a.textContent?.trim().substring(0, 50) || '(no text)',
    href: a.href
  }));
  result.links.totalCount = links.length;

  const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
  result.headings = Array.from(headings).map(h => ({
    level: h.tagName,
    text: h.textContent?.trim().substring(0, 100)
  }));

  result.images = document.querySelectorAll('img').length;
  result.tables = document.querySelectorAll('table').length;
  result.iframes = document.querySelectorAll('iframe').length;

  return result;
}

document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
