/**
 * ScanVui v3.1 - Redesigned Popup Controller
 * Clean, modular, user-friendly
 */

class ScanVuiApp {
  constructor() {
    this.scanData = null;
    this.currentTab = 'results';
    this.mediaData = null;
    this.currentMediaTab = 'images';
    this.screenshotData = null;
    this.screenshotMode = 'full';
    this.isCapturing = false;
    
    // Website Crawler properties
    this.crawlerPollInterval = null;
    this.toastTimeout = null;
    
    this.init();
  }

  init() {
    this.bindElements();
    this.bindEvents();
    this.initTheme();
    this.loadLastScan();
    this.showPageInfo();
    this.checkCrawlerOnLoad();
  }

  bindElements() {
    // Core
    this.scanBtn = document.getElementById('scanBtn');
    this.loading = document.getElementById('loading');
    this.error = document.getElementById('error');
    this.errorMessage = document.getElementById('errorMessage');
    this.welcomeScreen = document.getElementById('welcomeScreen');
    this.tabNav = document.getElementById('tabNav');
    this.tabContent = document.getElementById('tabContent');
    this.pageInfo = document.getElementById('pageInfo');
    this.themeToggle = document.getElementById('themeToggle');
    this.toast = document.getElementById('toast');

    // Results Tab
    this.scoreCards = document.getElementById('scoreCards');
    this.issuesContent = document.getElementById('issuesContent');
    this.issuesCount = document.getElementById('issuesCount');
    this.quickStats = document.getElementById('quickStats');
    this.metaDetail = document.getElementById('metaDetail');
    this.formsDetail = document.getElementById('formsDetail');
    this.a11yDetail = document.getElementById('a11yDetail');
    this.techDetail = document.getElementById('techDetail');

    // Tools
    this.xrayApply = document.getElementById('xrayApply');
    this.xrayClear = document.getElementById('xrayClear');
    this.fillForms = document.getElementById('fillForms');
    this.clearForms = document.getElementById('clearForms');
    this.pickElement = document.getElementById('pickElement');
    this.detectTech = document.getElementById('detectTech');
    this.scanMedia = document.getElementById('scanMedia');
    this.resetA11y = document.getElementById('resetA11y');

    // Export
    this.copyJSON = document.getElementById('copyJSON');
    this.copyMarkdown = document.getElementById('copyMarkdown');
    this.copySummary = document.getElementById('copySummary');

    // Screenshot
    this.captureScreenshotBtn = document.getElementById('captureScreenshot');
    this.downloadScreenshotBtn = document.getElementById('downloadScreenshot');
    this.copyScreenshotBtn = document.getElementById('copyScreenshot');
    this.screenshotProgress = document.getElementById('screenshotProgress');
    this.progressLabel = document.getElementById('progressLabel');
    this.progressPercent = document.getElementById('progressPercent');
    this.progressFill = document.getElementById('progressFill');
    this.screenshotPreview = document.getElementById('screenshotPreview');
    this.previewImage = document.getElementById('previewImage');
    this.previewSize = document.getElementById('previewSize');

    // Crawler (uses getElementById directly in methods)
  }

  bindEvents() {
    // Scan
    this.scanBtn.addEventListener('click', () => this.scanPage());

    // Theme
    this.themeToggle.addEventListener('click', () => this.toggleTheme());

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });

    // Tools
    this.xrayApply?.addEventListener('click', () => this.applyXray());
    this.xrayClear?.addEventListener('click', () => this.clearXray());
    this.fillForms?.addEventListener('click', () => this.fillAllForms());
    this.clearForms?.addEventListener('click', () => this.clearAllForms());
    this.pickElement?.addEventListener('click', () => this.startElementPicker());
    this.detectTech?.addEventListener('click', () => this.detectTechStack());
    this.scanMedia?.addEventListener('click', () => this.scanAllMedia());
    this.resetA11y?.addEventListener('click', () => this.resetA11ySimulation());
    
    // Download all media
    document.getElementById('downloadAllMedia')?.addEventListener('click', () => this.downloadAllMedia());
    
    // Copy mini buttons in selector result - use event delegation
    document.getElementById('selectorResult')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.copy-mini');
      if (btn) {
        const type = btn.dataset.copy;
        const codeEl = btn.previousElementSibling;
        if (codeEl) {
          navigator.clipboard.writeText(codeEl.textContent);
          this.showToast(`Đã copy ${type}!`);
        }
      }
    });

    // Viewport buttons
    document.querySelectorAll('.viewport-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.openViewport(parseInt(btn.dataset.w), parseInt(btn.dataset.h));
      });
    });

    // A11y simulation buttons
    document.querySelectorAll('.sim-btn').forEach(btn => {
      btn.addEventListener('click', () => this.applyA11ySimulation(btn.dataset.sim));
    });

    // Export buttons
    document.querySelectorAll('.export-btn').forEach(btn => {
      btn.addEventListener('click', () => this.exportReport(btn.dataset.format));
    });

    this.copyJSON?.addEventListener('click', () => this.copyAsJSON());
    this.copyMarkdown?.addEventListener('click', () => this.copyAsMarkdown());
    this.copySummary?.addEventListener('click', () => this.copyAsSummary());

    // Screenshot mode buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.screenshotMode = btn.dataset.mode;
      });
    });

    // Screenshot buttons
    this.captureScreenshotBtn?.addEventListener('click', () => this.captureScreenshot());
    this.downloadScreenshotBtn?.addEventListener('click', () => this.downloadScreenshot());
    this.copyScreenshotBtn?.addEventListener('click', () => this.copyScreenshotToClipboard());

    // Crawler buttons
    document.getElementById('startCrawler')?.addEventListener('click', () => this.startCrawler());
    document.getElementById('stopCrawler')?.addEventListener('click', () => this.stopCrawler());
    document.getElementById('redownloadCrawler')?.addEventListener('click', () => this.redownloadFromPopup());

    // Quick Actions Bar
    document.querySelectorAll('.quick-action-btn').forEach(btn => {
      btn.addEventListener('click', () => this.handleQuickAction(btn.dataset.quick));
    });

    // Tools Sub-tabs
    document.querySelectorAll('.subtab-btn').forEach(btn => {
      btn.addEventListener('click', () => this.switchSubtab(btn.dataset.subtab));
    });
  }

  // ============================================
  // THEME
  // ============================================
  initTheme() {
    const saved = localStorage.getItem('scanvui-theme') || 'light';
    document.body.setAttribute('data-theme', saved);
  }

  toggleTheme() {
    const current = document.body.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', next);
    localStorage.setItem('scanvui-theme', next);
  }

  // ============================================
  // PAGE INFO
  // ============================================
  async showPageInfo() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url) {
        const url = new URL(tab.url);
        this.pageInfo.textContent = url.hostname + url.pathname.substring(0, 30);
      }
    } catch (e) {}
  }

  // ============================================
  // TAB NAVIGATION
  // ============================================
  switchTab(tabId) {
    this.currentTab = tabId;
    
    // If switching to results tab without scan data, show a message
    if (tabId === 'results' && !this.scanData) {
      this.showToast('Nhấn "Quét trang" để xem kết quả phân tích');
    }
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === tabId + 'Tab');
    });
  }

  // Switch tools sub-tab
  switchSubtab(subtabId) {
    document.querySelectorAll('.subtab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.subtab === subtabId);
    });
    
    document.querySelectorAll('.tools-subtab-content').forEach(content => {
      content.classList.toggle('active', content.dataset.subtabContent === subtabId);
    });
  }

  // Handle quick action buttons
  handleQuickAction(action) {
    // Hide welcome screen if visible
    const welcomeScreen = document.getElementById('welcomeScreen');
    if (welcomeScreen) {
      welcomeScreen.classList.add('hidden');
    }
    
    // Show tab navigation and content (even without scan data)
    this.tabNav?.classList.remove('hidden');
    this.tabContent?.classList.remove('hidden');
    
    // Switch to tools tab
    this.switchTab('tools');
    
    // Map action to subtab and tool
    const actionMap = {
      'screenshot': { subtab: 'popular', tool: 'screenshot' },
      'crawler': { subtab: 'popular', tool: 'crawler' },
      'media': { subtab: 'popular', tool: 'media' },
      'selector': { subtab: 'dev', tool: 'selector' }
    };
    
    const config = actionMap[action];
    if (config) {
      this.switchSubtab(config.subtab);
      
      // Scroll to the tool and highlight it briefly
      setTimeout(() => {
        const toolCard = document.querySelector(`.tool-card[data-tool="${config.tool}"]`);
        if (toolCard) {
          toolCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
          toolCard.classList.add('highlight');
          setTimeout(() => toolCard.classList.remove('highlight'), 1500);
        }
      }, 100);
    }
  }

  // ============================================
  // SCANNING
  // ============================================
  async loadLastScan() {
    try {
      const result = await chrome.storage.local.get(['lastScan', 'lastScanUrl']);
      if (result.lastScan) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.url === result.lastScanUrl) {
          this.showResults(result.lastScan, false);
          return;
        }
      }
    } catch (e) {}
    this.showWelcome();
  }

  showWelcome() {
    this.welcomeScreen.classList.remove('hidden');
    this.tabNav.classList.add('hidden');
    this.tabContent.classList.add('hidden');
  }

  hideWelcome() {
    this.welcomeScreen.classList.add('hidden');
  }

  showLoading() {
    this.hideWelcome();
    this.loading.classList.remove('hidden');
    this.error.classList.add('hidden');
    this.tabNav.classList.add('hidden');
    this.tabContent.classList.add('hidden');
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

  async scanPage() {
    this.showLoading();

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) throw new Error('Không tìm thấy tab');
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        throw new Error('Không thể quét trang Chrome nội bộ');
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: scanPageContent,
        world: 'MAIN'
      });

      if (results?.[0]?.result) {
        this.showResults(results[0].result);
      } else {
        throw new Error('Không thể quét trang');
      }
    } catch (err) {
      this.showError(err.message || 'Lỗi không xác định');
    }
  }

  async showResults(data, save = true) {
    this.hideLoading();
    this.hideWelcome();
    this.scanData = data;

    if (save) {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await chrome.storage.local.set({
          lastScan: data,
          lastScanUrl: tab?.url || ''
        });
      } catch (e) {}
    }

    this.tabNav.classList.remove('hidden');
    this.tabContent.classList.remove('hidden');

    this.renderScores(data);
    this.renderIssues(data);
    this.renderQuickStats(data);
    this.renderDetails(data);
    
    this.switchTab('results');
  }

  // ============================================
  // RENDER RESULTS
  // ============================================
  calculateScores(data) {
    const scores = {
      seo: { score: 0, issues: [] },
      a11y: { score: 0, issues: [] },
      perf: { score: 0, issues: [] },
      bp: { score: 0, issues: [] }
    };

    // SEO
    let seo = 0;
    if (data.meta?.title) seo += 20; else scores.seo.issues.push('Thiếu title');
    if (data.meta?.description) seo += 20; else scores.seo.issues.push('Thiếu meta description');
    if (data.headings?.some(h => h.level === 'H1')) seo += 15; else scores.seo.issues.push('Thiếu H1');
    if (data.meta?.canonical) seo += 10; else scores.seo.issues.push('Thiếu canonical URL');
    if (data.meta?.openGraph?.length > 0) seo += 10;
    if (data.meta?.viewport) seo += 10;
    if (data.meta?.language) seo += 10;
    if (data.media?.images?.withAlt === data.media?.images?.total) seo += 5;
    else if (data.media?.images?.withoutAlt > 0) scores.seo.issues.push(`${data.media.images.withoutAlt} ảnh thiếu alt`);
    scores.seo.score = Math.min(100, seo);

    // Accessibility
    let a11y = 0;
    const acc = data.accessibility || {};
    if (acc.langAttribute) a11y += 15; else scores.a11y.issues.push('Thiếu lang attribute');
    if (acc.skipLinks > 0) a11y += 10; else scores.a11y.issues.push('Không có skip links');
    if (acc.labels >= data.totalFields * 0.8) a11y += 25; else scores.a11y.issues.push('Form fields thiếu labels');
    if (acc.altTextCoverage >= 90) a11y += 20;
    if (acc.ariaLabels > 0 || acc.ariaRoles > 0) a11y += 15;
    if (data.semantic?.main > 0) a11y += 15; else scores.a11y.issues.push('Thiếu <main> landmark');
    scores.a11y.score = Math.min(100, a11y);

    // Performance
    let perf = 100;
    const p = data.performance || {};
    if (p.domElements > 1500) { perf -= 20; scores.perf.issues.push(`DOM quá lớn: ${p.domElements}`); }
    if (p.domDepth > 15) { perf -= 10; scores.perf.issues.push(`DOM quá sâu: ${p.domDepth}`); }
    if (p.inlineStyles > 50) { perf -= 15; scores.perf.issues.push(`Nhiều inline styles`); }
    if ((data.scripts?.total || 0) > 30) { perf -= 15; scores.perf.issues.push(`Nhiều scripts: ${data.scripts.total}`); }
    scores.perf.score = Math.max(0, perf);

    // Best Practices
    let bp = 100;
    if (p.deprecatedElements > 0) { bp -= 20; scores.bp.issues.push('Có elements lỗi thời'); }
    if (!data.meta?.charset) { bp -= 10; scores.bp.issues.push('Thiếu charset'); }
    if (!data.meta?.favicon) { bp -= 10; scores.bp.issues.push('Thiếu favicon'); }
    scores.bp.score = Math.max(0, bp);

    return scores;
  }

  getScoreClass(score) {
    if (score >= 80) return 'good';
    if (score >= 50) return 'warning';
    return 'poor';
  }

  renderScores(data) {
    const scores = this.calculateScores(data);
    
    this.scoreCards.innerHTML = `
      <div class="score-card">
        <div class="score-value ${this.getScoreClass(scores.seo.score)}">${scores.seo.score}</div>
        <div class="score-label">SEO</div>
        <div class="score-bar"><div class="score-fill ${this.getScoreClass(scores.seo.score)}" style="width:${scores.seo.score}%"></div></div>
      </div>
      <div class="score-card">
        <div class="score-value ${this.getScoreClass(scores.a11y.score)}">${scores.a11y.score}</div>
        <div class="score-label">Accessibility</div>
        <div class="score-bar"><div class="score-fill ${this.getScoreClass(scores.a11y.score)}" style="width:${scores.a11y.score}%"></div></div>
      </div>
      <div class="score-card">
        <div class="score-value ${this.getScoreClass(scores.perf.score)}">${scores.perf.score}</div>
        <div class="score-label">Performance</div>
        <div class="score-bar"><div class="score-fill ${this.getScoreClass(scores.perf.score)}" style="width:${scores.perf.score}%"></div></div>
      </div>
      <div class="score-card">
        <div class="score-value ${this.getScoreClass(scores.bp.score)}">${scores.bp.score}</div>
        <div class="score-label">Best Practices</div>
        <div class="score-bar"><div class="score-fill ${this.getScoreClass(scores.bp.score)}" style="width:${scores.bp.score}%"></div></div>
      </div>
    `;
  }

  renderIssues(data) {
    const scores = this.calculateScores(data);
    const allIssues = [
      ...scores.seo.issues.map(i => ({ type: 'error', text: i })),
      ...scores.a11y.issues.map(i => ({ type: 'warning', text: i })),
      ...scores.perf.issues.map(i => ({ type: 'warning', text: i })),
      ...scores.bp.issues.map(i => ({ type: 'info', text: i }))
    ];

    this.issuesCount.textContent = allIssues.length;
    this.issuesCount.classList.toggle('success', allIssues.length === 0);

    if (allIssues.length === 0) {
      this.issuesContent.innerHTML = '<div class="no-issues">✅ Không phát hiện vấn đề!</div>';
    } else {
      this.issuesContent.innerHTML = allIssues.map(issue => `
        <div class="issue-item">
          <span class="issue-icon ${issue.type}">${issue.type === 'error' ? '❌' : issue.type === 'warning' ? '⚠️' : 'ℹ️'}</span>
          <span class="issue-text">${this.escapeHtml(issue.text)}</span>
        </div>
      `).join('');
    }
  }

  renderQuickStats(data) {
    const stats = [
      { label: 'Forms', value: data.forms?.length || 0 },
      { label: 'Links', value: data.linksTotal || 0 },
      { label: 'Images', value: data.media?.images?.total || 0 },
      { label: 'Scripts', value: data.scripts?.total || 0 }
    ];

    this.quickStats.innerHTML = stats.map(s => `
      <div class="stat-item">
        <div class="stat-value">${s.value}</div>
        <div class="stat-label">${s.label}</div>
      </div>
    `).join('');
  }

  renderDetails(data) {
    // Meta
    const meta = data.meta || {};
    this.metaDetail.innerHTML = `
      <div class="detail-row"><span class="detail-label">Title</span><span class="detail-value">${this.escapeHtml(meta.title) || '-'}</span></div>
      <div class="detail-row"><span class="detail-label">Description</span><span class="detail-value">${this.escapeHtml(meta.description) || '-'}</span></div>
      <div class="detail-row"><span class="detail-label">Charset</span><span class="detail-value">${meta.charset || '-'}</span></div>
      <div class="detail-row"><span class="detail-label">Viewport</span><span class="detail-value">${meta.viewport ? '✓' : '✗'}</span></div>
      <div class="detail-row"><span class="detail-label">Language</span><span class="detail-value">${meta.language || '-'}</span></div>
      <div class="detail-row"><span class="detail-label">Canonical</span><span class="detail-value">${meta.canonical ? '✓' : '✗'}</span></div>
      <div class="detail-row"><span class="detail-label">Open Graph</span><span class="detail-value">${meta.openGraph?.length || 0} tags</span></div>
    `;

    // Forms
    if (data.forms?.length > 0) {
      this.formsDetail.innerHTML = data.forms.map((form, i) => `
        <div style="margin-bottom:10px;padding:8px;background:var(--bg-secondary);border-radius:6px;">
          <strong>${form.name || 'Form #' + (i + 1)}</strong> - ${form.fields?.length || 0} fields
          ${form.method ? `<span style="margin-left:8px;color:var(--success)">${form.method}</span>` : ''}
        </div>
      `).join('');
    } else {
      this.formsDetail.innerHTML = '<em>Không có forms</em>';
    }

    // A11y
    const a11y = data.accessibility || {};
    this.a11yDetail.innerHTML = `
      <div class="detail-row"><span class="detail-label">Alt Text Coverage</span><span class="detail-value">${a11y.altTextCoverage || 0}%</span></div>
      <div class="detail-row"><span class="detail-label">ARIA Labels</span><span class="detail-value">${a11y.ariaLabels || 0}</span></div>
      <div class="detail-row"><span class="detail-label">ARIA Roles</span><span class="detail-value">${a11y.ariaRoles || 0}</span></div>
      <div class="detail-row"><span class="detail-label">Form Labels</span><span class="detail-value">${a11y.labels || 0}</span></div>
      <div class="detail-row"><span class="detail-label">Skip Links</span><span class="detail-value">${a11y.skipLinks || 0}</span></div>
      <div class="detail-row"><span class="detail-label">Lang Attribute</span><span class="detail-value">${a11y.langAttribute ? '✓' : '✗'}</span></div>
    `;

    // Tech
    const perf = data.performance || {};
    this.techDetail.innerHTML = `
      <div class="detail-row"><span class="detail-label">DOM Elements</span><span class="detail-value">${perf.domElements || 0}</span></div>
      <div class="detail-row"><span class="detail-label">DOM Depth</span><span class="detail-value">${perf.domDepth || 0}</span></div>
      <div class="detail-row"><span class="detail-label">Shadow DOM</span><span class="detail-value">${data.shadowDomCount || 0}</span></div>
      <div class="detail-row"><span class="detail-label">Custom Elements</span><span class="detail-value">${data.customElements || 0}</span></div>
      <div class="detail-row"><span class="detail-label">Inline Styles</span><span class="detail-value">${perf.inlineStyles || 0}</span></div>
      <div class="detail-row"><span class="detail-label">Scripts</span><span class="detail-value">${data.scripts?.total || 0}</span></div>
      <div class="detail-row"><span class="detail-label">Stylesheets</span><span class="detail-value">${data.stylesheets?.total || 0}</span></div>
    `;
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }

  // ============================================
  // TOOLS
  // ============================================
  async applyXray() {
    const types = [];
    document.querySelectorAll('[data-xray]:checked').forEach(cb => {
      types.push(cb.dataset.xray);
    });

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: injectXray,
        args: [types]
      });
      this.showToast('X-Ray đã bật!');
    } catch (e) {
      this.showToast('Lỗi: ' + e.message);
    }
  }

  async clearXray() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          document.querySelectorAll('[data-scanvui-xray]').forEach(el => {
            el.style.outline = '';
            el.style.backgroundColor = '';
            el.removeAttribute('data-scanvui-xray');
          });
        }
      });
      this.showToast('X-Ray đã tắt');
    } catch (e) {}
  }

  async fillAllForms() {
    const locale = document.getElementById('fillLocale')?.value || 'vi';
    const mode = document.getElementById('fillMode')?.value || 'realistic';
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: fillFormsWithData,
        args: [locale, mode]
      });
      this.showToast('Đã điền forms!');
    } catch (e) {
      this.showToast('Lỗi: ' + e.message);
    }
  }

  async clearAllForms() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          document.querySelectorAll('input, textarea, select').forEach(el => {
            if (el.type === 'checkbox' || el.type === 'radio') el.checked = false;
            else el.value = '';
          });
        }
      });
      this.showToast('Đã xóa forms');
    } catch (e) {}
  }

  async startElementPicker() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: startPicker
      });
      this.showToast('Click vào element trên trang (ESC để hủy)');
    } catch (e) {
      this.showToast('Lỗi: ' + e.message);
    }
  }

  updateSelectorDisplay(selectors) {
    const result = document.getElementById('selectorResult');
    if (result && selectors) {
      result.classList.remove('hidden');
      document.getElementById('cssSelector').textContent = selectors.css || '-';
      const xpathEl = document.getElementById('xpathSelector');
      if (xpathEl) xpathEl.textContent = selectors.xpath || '-';
      const playwrightEl = document.getElementById('playwrightSelector');
      if (playwrightEl) playwrightEl.textContent = selectors.playwright || '-';
    }
  }

  async openViewport(width, height) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.windows.create({
      url: tab.url,
      width: width + 16,
      height: height + 88,
      type: 'popup'
    });
  }

  async applyA11ySimulation(type) {
    const filters = {
      protanopia: 'sepia(100%) saturate(300%) hue-rotate(-50deg)',
      deuteranopia: 'sepia(100%) saturate(300%) hue-rotate(50deg)',
      tritanopia: 'sepia(100%) saturate(300%) hue-rotate(180deg)',
      achromatopsia: 'grayscale(100%)',
      blurry: 'blur(2px)'
    };

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (filter) => { document.documentElement.style.filter = filter; },
        args: [filters[type] || '']
      });
      
      document.querySelectorAll('.sim-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.sim === type);
      });
      this.showToast(`Mô phỏng: ${type}`);
    } catch (e) {
      this.showToast('Lỗi: ' + e.message);
    }
  }

  async resetA11ySimulation() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => { document.documentElement.style.filter = ''; }
      });
      document.querySelectorAll('.sim-btn').forEach(btn => btn.classList.remove('active'));
      this.showToast('Đã khôi phục');
    } catch (e) {}
  }

  async detectTechStack() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: detectTechnologies,
        world: 'MAIN'
      });
      
      const techs = results?.[0]?.result || [];
      const container = document.getElementById('techStackResult');
      
      if (techs.length === 0) {
        container.innerHTML = '<span style="color:var(--text-muted)">Không phát hiện</span>';
      } else {
        container.innerHTML = techs.map(t => 
          `<span class="tech-tag">${t.icon} ${t.name}</span>`
        ).join('');
      }
    } catch (e) {
      this.showToast('Lỗi: ' + e.message);
    }
  }

  async scanAllMedia() {
    try {
      this.showToast('Đang quét media...');
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const media = { images: [], videos: [], audio: [] };
          
          // Images
          document.querySelectorAll('img[src]').forEach(img => {
            const src = img.src;
            if (src && src.startsWith('http')) {
              const filename = src.split('/').pop().split('?')[0] || 'image';
              const ext = filename.split('.').pop().toLowerCase();
              media.images.push({
                url: src,
                filename: filename.substring(0, 50),
                type: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif'].includes(ext) ? ext : 'img',
                alt: img.alt || '',
                width: img.naturalWidth || img.width || 0,
                height: img.naturalHeight || img.height || 0
              });
            }
          });
          
          // Background images
          document.querySelectorAll('*').forEach(el => {
            const bg = getComputedStyle(el).backgroundImage;
            if (bg && bg.startsWith('url("http')) {
              const url = bg.slice(5, -2);
              const filename = url.split('/').pop().split('?')[0] || 'bg-image';
              if (!media.images.find(m => m.url === url)) {
                media.images.push({
                  url,
                  filename: filename.substring(0, 50),
                  type: 'bg',
                  alt: 'Background',
                  width: 0,
                  height: 0
                });
              }
            }
          });
          
          // Videos
          document.querySelectorAll('video[src], video source[src]').forEach(v => {
            const src = v.src || v.querySelector('source')?.src;
            if (src && src.startsWith('http')) {
              const filename = src.split('/').pop().split('?')[0] || 'video';
              media.videos.push({
                url: src,
                filename: filename.substring(0, 50),
                type: 'video'
              });
            }
          });
          
          // YouTube/Vimeo embeds
          document.querySelectorAll('iframe[src*="youtube"], iframe[src*="vimeo"]').forEach(iframe => {
            const src = iframe.src;
            const isYT = src.includes('youtube');
            media.videos.push({
              url: src,
              filename: isYT ? 'YouTube Video' : 'Vimeo Video',
              type: isYT ? 'youtube' : 'vimeo',
              embed: true
            });
          });
          
          // Audio
          document.querySelectorAll('audio[src], audio source[src]').forEach(a => {
            const src = a.src || a.querySelector('source')?.src;
            if (src && src.startsWith('http')) {
              const filename = src.split('/').pop().split('?')[0] || 'audio';
              media.audio.push({
                url: src,
                filename: filename.substring(0, 50),
                type: 'audio'
              });
            }
          });
          
          return media;
        }
      });
      
      const media = results?.[0]?.result || { images: [], videos: [], audio: [] };
      this.mediaData = media;
      this.currentMediaTab = 'images';
      
      this.renderMediaResults(media);
      
      const total = media.images.length + media.videos.length + media.audio.length;
      this.showToast(`Tìm thấy ${total} media`);
    } catch (e) {
      this.showToast('Lỗi: ' + e.message);
    }
  }

  renderMediaResults(media) {
    const summary = document.getElementById('mediaSummary');
    const list = document.getElementById('mediaList');
    const downloadBtn = document.getElementById('downloadAllMedia');
    
    // Summary
    summary.innerHTML = `
      <span class="media-stat">🖼️ <strong>${media.images.length}</strong> ảnh</span>
      <span class="media-stat">🎬 <strong>${media.videos.length}</strong> video</span>
      <span class="media-stat">🎵 <strong>${media.audio.length}</strong> audio</span>
    `;
    
    // Tabs
    const tabs = `
      <div class="media-tabs">
        <button class="media-tab ${this.currentMediaTab === 'images' ? 'active' : ''}" data-media-tab="images">🖼️ Ảnh (${media.images.length})</button>
        <button class="media-tab ${this.currentMediaTab === 'videos' ? 'active' : ''}" data-media-tab="videos">🎬 Video (${media.videos.length})</button>
        <button class="media-tab ${this.currentMediaTab === 'audio' ? 'active' : ''}" data-media-tab="audio">🎵 Audio (${media.audio.length})</button>
      </div>
    `;
    
    // Items
    let items = [];
    if (this.currentMediaTab === 'images') items = media.images;
    else if (this.currentMediaTab === 'videos') items = media.videos;
    else if (this.currentMediaTab === 'audio') items = media.audio;
    
    let itemsHtml = '';
    if (items.length === 0) {
      itemsHtml = '<div class="media-empty">Không có media nào</div>';
    } else {
      itemsHtml = items.slice(0, 50).map((item, i) => `
        <div class="media-item" data-index="${i}" data-type="${this.currentMediaTab}">
          ${this.currentMediaTab === 'images' ? `<img class="media-thumb" src="${this.escapeHtml(item.url)}" alt="" loading="lazy" onerror="this.style.display='none'">` : ''}
          <div class="media-info">
            <div class="media-name" title="${this.escapeHtml(item.url)}">${this.escapeHtml(item.filename)}</div>
            <div class="media-size">${item.width && item.height ? `${item.width}x${item.height}` : item.embed ? 'Embed' : ''}</div>
          </div>
          <span class="media-type">${item.type}</span>
          <div class="media-actions">
            <button class="media-btn secondary" data-action="copy" title="Copy URL">📋</button>
            ${!item.embed ? `<button class="media-btn" data-action="download" title="Tải về">⬇️</button>` : `<button class="media-btn" data-action="open" title="Mở">🔗</button>`}
          </div>
        </div>
      `).join('');
      
      if (items.length > 50) {
        itemsHtml += `<div class="media-empty">... và ${items.length - 50} media khác</div>`;
      }
    }
    
    list.innerHTML = tabs + itemsHtml;
    
    // Enable download all button
    downloadBtn.disabled = media.images.length === 0 && media.videos.length === 0 && media.audio.length === 0;
    
    // Bind tab events
    list.querySelectorAll('.media-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.currentMediaTab = tab.dataset.mediaTab;
        this.renderMediaResults(this.mediaData);
      });
    });
    
    // Bind item action events
    list.querySelectorAll('.media-item').forEach(item => {
      item.querySelectorAll('.media-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const action = btn.dataset.action;
          const index = parseInt(item.dataset.index);
          const type = item.dataset.type;
          
          let mediaItem;
          if (type === 'images') mediaItem = this.mediaData.images[index];
          else if (type === 'videos') mediaItem = this.mediaData.videos[index];
          else if (type === 'audio') mediaItem = this.mediaData.audio[index];
          
          if (mediaItem) {
            if (action === 'copy') {
              navigator.clipboard.writeText(mediaItem.url);
              this.showToast('Đã copy URL!');
            } else if (action === 'download') {
              this.downloadSingleMedia(mediaItem);
            } else if (action === 'open') {
              chrome.tabs.create({ url: mediaItem.url });
            }
          }
        });
      });
    });
  }

  async downloadSingleMedia(item) {
    try {
      const filename = item.filename || 'media';
      await chrome.downloads.download({ 
        url: item.url, 
        filename: `scanvui-media/${filename}` 
      });
      this.showToast(`Đang tải: ${filename}`);
    } catch (e) {
      // Try opening in new tab if download fails
      chrome.tabs.create({ url: item.url });
      this.showToast('Mở trong tab mới (không tải được trực tiếp)');
    }
  }

  async downloadAllMedia() {
    if (!this.mediaData) {
      this.showToast('Chưa có media. Hãy quét trước!');
      return;
    }
    
    const allMedia = [
      ...this.mediaData.images.filter(m => !m.embed),
      ...this.mediaData.videos.filter(m => !m.embed),
      ...this.mediaData.audio.filter(m => !m.embed)
    ];
    
    if (allMedia.length === 0) {
      this.showToast('Không có media để tải!');
      return;
    }
    
    const toDownload = allMedia.slice(0, 30); // Limit to 30
    this.showToast(`Đang tải ${toDownload.length} media...`);
    
    let success = 0;
    for (const item of toDownload) {
      try {
        await chrome.downloads.download({ 
          url: item.url, 
          filename: `scanvui-media/${item.filename || 'media'}` 
        });
        success++;
      } catch (e) {}
    }
    
    this.showToast(`Đã tải ${success}/${toDownload.length} files!`);
  }

  // ============================================
  // SCREENSHOT
  // ============================================
  async captureScreenshot() {
    if (this.isCapturing) {
      this.showToast('Đang chụp, vui lòng đợi...');
      return;
    }

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        this.showToast('Không tìm thấy tab!');
        return;
      }
      
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        this.showToast('Không thể chụp trang Chrome nội bộ!');
        return;
      }

      this.isCapturing = true;
      const toolCard = document.querySelector('[data-tool="screenshot"]');
      toolCard?.classList.add('capturing');
      
      const format = document.querySelector('input[name="screenshotFormat"]:checked')?.value || 'png';
      const hideFixed = document.getElementById('hideFixedElements')?.checked ?? true;

      if (this.screenshotMode === 'visible') {
        await this.captureVisibleOnly(tab, format);
      } else {
        await this.captureFullPage(tab, format, hideFixed);
      }

      toolCard?.classList.remove('capturing');
      this.isCapturing = false;
    } catch (e) {
      this.isCapturing = false;
      document.querySelector('[data-tool="screenshot"]')?.classList.remove('capturing');
      this.showToast('Lỗi: ' + e.message);
    }
  }

  async captureVisibleOnly(tab, format) {
    this.showProgress('Đang chụp...', 50);
    
    const response = await chrome.runtime.sendMessage({
      action: 'captureVisibleTab',
      format: format,
      quality: 100
    });

    if (response.error) {
      this.hideProgress();
      throw new Error(response.error);
    }

    this.showProgress('Hoàn thành!', 100);
    this.screenshotData = response.dataUrl;
    this.showScreenshotPreview(response.dataUrl);
    this.hideProgress();
    this.showToast('Đã chụp xong!');
  }

  async captureFullPage(tab, format, hideFixed) {
    this.showProgress('Chuẩn bị...', 5);

    // Get page dimensions and prepare
    const setupResult = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (hideFixed) => {
        // Save current scroll position
        const originalScrollX = window.scrollX;
        const originalScrollY = window.scrollY;
        
        // Get full page dimensions
        const fullHeight = Math.max(
          document.body.scrollHeight,
          document.documentElement.scrollHeight,
          document.body.offsetHeight,
          document.documentElement.offsetHeight
        );
        const fullWidth = Math.max(
          document.body.scrollWidth,
          document.documentElement.scrollWidth,
          document.body.offsetWidth,
          document.documentElement.offsetWidth
        );
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const devicePixelRatio = window.devicePixelRatio || 1;

        // Find and hide fixed/sticky elements
        const fixedElements = [];
        if (hideFixed) {
          document.querySelectorAll('*').forEach(el => {
            const style = getComputedStyle(el);
            if (style.position === 'fixed' || style.position === 'sticky') {
              fixedElements.push({
                element: el,
                originalPosition: style.position,
                originalDisplay: el.style.display
              });
              el.dataset.scanvuiOriginalPosition = style.position;
              el.dataset.scanvuiOriginalDisplay = el.style.display || '';
            }
          });
        }

        return {
          fullHeight,
          fullWidth,
          viewportHeight,
          viewportWidth,
          devicePixelRatio,
          originalScrollX,
          originalScrollY,
          fixedCount: fixedElements.length
        };
      },
      args: [hideFixed]
    });

    const pageInfo = setupResult?.[0]?.result;
    if (!pageInfo) {
      throw new Error('Không thể lấy thông tin trang');
    }

    const { fullHeight, viewportHeight, devicePixelRatio, originalScrollX, originalScrollY } = pageInfo;
    const totalScrolls = Math.ceil(fullHeight / viewportHeight);
    const screenshots = [];

    this.showProgress(`Đang chụp 0/${totalScrolls}...`, 10);

    // Capture each viewport
    for (let i = 0; i < totalScrolls; i++) {
      const scrollY = i * viewportHeight;
      const isLast = i === totalScrolls - 1;
      
      // Scroll and hide fixed elements after first screenshot
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (scrollY, hideFixed, isFirst) => {
          window.scrollTo(0, scrollY);
          
          // Hide fixed elements after first capture
          if (hideFixed && !isFirst) {
            document.querySelectorAll('[data-scanvui-original-position]').forEach(el => {
              el.style.display = 'none';
            });
          }
        },
        args: [scrollY, hideFixed, i === 0]
      });

      // Wait for render
      await new Promise(r => setTimeout(r, 150));

      // Capture
      const response = await chrome.runtime.sendMessage({
        action: 'captureVisibleTab',
        format: format,
        quality: 100
      });

      if (response.error) {
        throw new Error(response.error);
      }

      screenshots.push({
        dataUrl: response.dataUrl,
        scrollY: scrollY,
        isLast: isLast
      });

      const progress = 10 + ((i + 1) / totalScrolls) * 70;
      this.showProgress(`Đang chụp ${i + 1}/${totalScrolls}...`, progress);
    }

    // Restore page state
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (originalScrollX, originalScrollY) => {
        // Restore fixed elements
        document.querySelectorAll('[data-scanvui-original-position]').forEach(el => {
          el.style.display = el.dataset.scanvuiOriginalDisplay || '';
          delete el.dataset.scanvuiOriginalPosition;
          delete el.dataset.scanvuiOriginalDisplay;
        });
        
        // Restore scroll position
        window.scrollTo(originalScrollX, originalScrollY);
      },
      args: [originalScrollX, originalScrollY]
    });

    this.showProgress('Đang ghép ảnh...', 85);

    // Stitch images
    const finalImage = await this.stitchImages(screenshots, pageInfo, format);
    
    this.showProgress('Hoàn thành!', 100);
    this.screenshotData = finalImage;
    this.showScreenshotPreview(finalImage);
    this.hideProgress();
    this.showToast('Đã chụp xong!');
  }

  async stitchImages(screenshots, pageInfo, format) {
    const { fullHeight, viewportHeight, viewportWidth, devicePixelRatio } = pageInfo;
    
    // Create canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = viewportWidth * devicePixelRatio;
    canvas.height = fullHeight * devicePixelRatio;

    // Load and draw each image
    for (let i = 0; i < screenshots.length; i++) {
      const screenshot = screenshots[i];
      const img = await this.loadImage(screenshot.dataUrl);
      
      let sourceY = 0;
      let sourceHeight = img.height;
      let destY = screenshot.scrollY * devicePixelRatio;
      let destHeight = sourceHeight;

      // Handle last image overlap
      if (screenshot.isLast && screenshots.length > 1) {
        const expectedY = (screenshots.length - 1) * viewportHeight;
        const actualBottom = fullHeight;
        const overlap = expectedY + viewportHeight - actualBottom;
        
        if (overlap > 0) {
          sourceY = overlap * devicePixelRatio;
          sourceHeight = img.height - sourceY;
          destY = (fullHeight - (viewportHeight - overlap)) * devicePixelRatio;
          destHeight = sourceHeight;
        }
      }

      ctx.drawImage(
        img,
        0, sourceY, img.width, sourceHeight,
        0, destY, img.width, destHeight
      );
    }

    // Export
    const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const quality = format === 'jpeg' ? 0.95 : undefined;
    return canvas.toDataURL(mimeType, quality);
  }

  loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  showProgress(label, percent) {
    this.screenshotProgress?.classList.remove('hidden');
    if (this.progressLabel) this.progressLabel.textContent = label;
    if (this.progressPercent) this.progressPercent.textContent = Math.round(percent) + '%';
    if (this.progressFill) this.progressFill.style.width = percent + '%';
  }

  hideProgress() {
    setTimeout(() => {
      this.screenshotProgress?.classList.add('hidden');
    }, 500);
  }

  showScreenshotPreview(dataUrl) {
    this.screenshotPreview?.classList.remove('hidden');
    if (this.previewImage) this.previewImage.src = dataUrl;
    
    // Calculate size
    const base64Length = dataUrl.length - (dataUrl.indexOf(',') + 1);
    const sizeInBytes = (base64Length * 3) / 4;
    const sizeInKB = (sizeInBytes / 1024).toFixed(1);
    const sizeText = sizeInKB > 1024 ? (sizeInKB / 1024).toFixed(2) + ' MB' : sizeInKB + ' KB';
    
    if (this.previewSize) this.previewSize.textContent = `Kích thước: ${sizeText}`;
    
    // Enable buttons
    if (this.downloadScreenshotBtn) this.downloadScreenshotBtn.disabled = false;
    if (this.copyScreenshotBtn) this.copyScreenshotBtn.disabled = false;
  }

  async downloadScreenshot() {
    if (!this.screenshotData) {
      this.showToast('Chưa có ảnh để tải!');
      return;
    }

    try {
      const format = document.querySelector('input[name="screenshotFormat"]:checked')?.value || 'png';
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const hostname = tab?.url ? new URL(tab.url).hostname.replace(/\./g, '-') : 'page';
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
      const filename = `scanvui-${hostname}-${timestamp}.${format}`;

      // Convert data URL to blob and download
      const response = await fetch(this.screenshotData);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      
      URL.revokeObjectURL(url);
      this.showToast('Đã tải xuống!');
    } catch (e) {
      this.showToast('Lỗi: ' + e.message);
    }
  }

  async copyScreenshotToClipboard() {
    if (!this.screenshotData) {
      this.showToast('Chưa có ảnh để copy!');
      return;
    }

    try {
      const response = await fetch(this.screenshotData);
      const blob = await response.blob();
      
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob })
      ]);
      
      this.showToast('Đã copy vào clipboard!');
    } catch (e) {
      this.showToast('Lỗi: ' + e.message);
    }
  }

  // ============================================
  // WEBSITE CRAWLER
  // ============================================
  // Crawler runs in background service worker, popup just shows status
  
  async startCrawler() {
    try {
      // Check if already running
      const status = await chrome.runtime.sendMessage({ action: 'getCrawlerStatus' });
      
      if (status.status === 'running') {
        this.showToast('Crawler đang chạy!');
        this.showCrawlerRunning();
        this.updateCrawlerUI(status);
        this.startCrawlerPolling();
        return;
      }

      // If previous crawl completed/error, reset first
      if (status.status === 'completed' || status.status === 'error' || status.status === 'stopped') {
        await chrome.runtime.sendMessage({ action: 'resetCrawler' });
      }

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab?.url) {
        this.showToast('Không tìm thấy tab!');
        return;
      }

      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) {
        this.showToast('Không thể tải trang hệ thống!');
        return;
      }

      // Validate URL
      try {
        new URL(tab.url);
      } catch {
        this.showToast('URL không hợp lệ!');
        return;
      }

      const depth = parseInt(document.getElementById('crawlerDepth')?.value) || 2;
      const maxPages = parseInt(document.getElementById('crawlerMaxPages')?.value) || 50;
      
      // Show progress UI immediately
      this.showCrawlerRunning();
      
      // Start crawler in background
      const response = await chrome.runtime.sendMessage({
        action: 'startCrawler',
        tabId: tab.id,
        startUrl: tab.url,
        settings: { depth, maxPages }
      });

      if (response.error) {
        this.showCrawlerStopped();
        this.showToast('Lỗi: ' + response.error);
        return;
      }

      // Start polling for status
      this.startCrawlerPolling();
      
      this.showToast('Đang tải... (có thể đóng popup)');
      
    } catch (e) {
      this.showCrawlerStopped();
      this.showToast('Lỗi: ' + e.message);
      console.error(e);
    }
  }

  showCrawlerRunning() {
    const toolCard = document.querySelector('[data-tool="crawler"]');
    toolCard?.classList.add('crawling');
    
    const startBtn = document.getElementById('startCrawler');
    const stopBtn = document.getElementById('stopCrawler');
    if (startBtn) startBtn.disabled = true;
    if (stopBtn) stopBtn.disabled = false;
    
    const crawlerProgress = document.getElementById('crawlerProgress');
    const crawlerResult = document.getElementById('crawlerResult');
    crawlerProgress?.classList.remove('hidden');
    crawlerResult?.classList.add('hidden');
  }

  showCrawlerStopped() {
    const toolCard = document.querySelector('[data-tool="crawler"]');
    toolCard?.classList.remove('crawling');
    
    const startBtn = document.getElementById('startCrawler');
    const stopBtn = document.getElementById('stopCrawler');
    if (startBtn) startBtn.disabled = false;
    if (stopBtn) stopBtn.disabled = true;
  }

  startCrawlerPolling() {
    // Clear existing interval
    if (this.crawlerPollInterval) {
      clearInterval(this.crawlerPollInterval);
      this.crawlerPollInterval = null;
    }

    let errorCount = 0;
    const MAX_ERRORS = 5;

    // Poll every 500ms
    this.crawlerPollInterval = setInterval(async () => {
      try {
        const status = await chrome.runtime.sendMessage({ action: 'getCrawlerStatus' });
        
        if (!status) {
          errorCount++;
          if (errorCount >= MAX_ERRORS) {
            this.stopPolling();
            this.showCrawlerStopped();
          }
          return;
        }
        
        errorCount = 0; // Reset on success
        this.updateCrawlerUI(status);

        // Stop polling if not running
        if (status.status !== 'running') {
          this.stopPolling();
          this.showCrawlerStopped();
          
          if (status.status === 'completed') {
            this.showCrawlerResult(status);
          } else if (status.status === 'error') {
            this.showToast('Lỗi: ' + (status.error || 'Không xác định'));
          } else if (status.status === 'stopped') {
            this.showToast('Đã dừng');
          }
        }
      } catch (e) {
        console.error('Polling error:', e);
        errorCount++;
        if (errorCount >= MAX_ERRORS) {
          this.stopPolling();
          this.showCrawlerStopped();
        }
      }
    }, 500);
  }

  stopPolling() {
    if (this.crawlerPollInterval) {
      clearInterval(this.crawlerPollInterval);
      this.crawlerPollInterval = null;
    }
  }

  updateCrawlerUI(status) {
    if (!status) return;

    const progressEl = document.getElementById('crawlerProgress');
    
    // Show progress panel if running
    if (status.status === 'running' && progressEl) {
      progressEl.classList.remove('hidden');
    }

    // Update progress elements
    const labelEl = document.getElementById('crawlerProgressLabel');
    const percentEl = document.getElementById('crawlerProgressPercent');
    const fillEl = document.getElementById('crawlerProgressFill');
    const pagesEl = document.getElementById('crawlerPagesCount');
    const imagesEl = document.getElementById('crawlerImagesCount');
    const currentUrlEl = document.getElementById('crawlerCurrentUrl');
    
    if (labelEl) labelEl.textContent = status.progressLabel || 'Đang xử lý...';
    if (percentEl) percentEl.textContent = (status.progress || 0) + '%';
    if (fillEl) fillEl.style.width = (status.progress || 0) + '%';
    if (pagesEl) pagesEl.textContent = status.pageCount || 0;
    if (imagesEl) imagesEl.textContent = status.imageCount || 0;
    
    if (currentUrlEl) {
      const url = status.currentUrl || '';
      currentUrlEl.textContent = url.length > 60 ? url.substring(0, 57) + '...' : url;
      currentUrlEl.title = url; // Full URL on hover
    }
  }

  showCrawlerResult(status) {
    const progressEl = document.getElementById('crawlerProgress');
    const resultEl = document.getElementById('crawlerResult');
    const infoEl = document.getElementById('crawlerResultInfo');
    const folderEl = document.getElementById('crawlerFolderName');
    
    progressEl?.classList.add('hidden');
    resultEl?.classList.remove('hidden');
    
    if (infoEl) {
      infoEl.textContent = `${status.pageCount || 0} trang, ${status.imageCount || 0} ảnh`;
    }
    if (folderEl) {
      folderEl.textContent = status.folderName || '';
    }
  }

  async stopCrawler() {
    try {
      await chrome.runtime.sendMessage({ action: 'stopCrawler' });
      this.showToast('Đang dừng...');
      
      // Don't immediately stop polling - let it detect the stopped state
      setTimeout(() => {
        this.stopPolling();
        this.showCrawlerStopped();
      }, 1000);
      
    } catch (e) {
      this.showToast('Lỗi: ' + e.message);
      this.stopPolling();
      this.showCrawlerStopped();
    }
  }

  async checkCrawlerOnLoad() {
    try {
      const status = await chrome.runtime.sendMessage({ action: 'getCrawlerStatus' });
      
      if (!status || status.status === 'idle') return;
      
      // Get current tab URL
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentUrl = tab?.url;
      
      // Check if the crawl result is for a different domain
      if (status.startUrl && currentUrl) {
        try {
          const crawledHost = new URL(status.startUrl).hostname;
          const currentHost = new URL(currentUrl).hostname;
          
          // Different domain - don't show old results, reset instead
          if (crawledHost !== currentHost) {
            // Only reset if not currently running
            if (status.status !== 'running') {
              await chrome.runtime.sendMessage({ action: 'resetCrawler' });
              return;
            }
          }
        } catch {}
      }
      
      if (status.status === 'running') {
        this.showCrawlerRunning();
        this.updateCrawlerUI(status);
        this.startCrawlerPolling();
      } else if (status.status === 'completed') {
        this.showCrawlerResult(status);
      } else if (status.status === 'error') {
        const progressEl = document.getElementById('crawlerProgress');
        const labelEl = document.getElementById('crawlerProgressLabel');
        progressEl?.classList.remove('hidden');
        if (labelEl) labelEl.textContent = 'Lỗi: ' + (status.error || 'Không xác định');
      }
    } catch (e) {
      console.error('Error checking crawler status:', e);
    }
  }

  // Download files from popup context (fallback method)
  async redownloadFromPopup() {
    this.showToast('Đang lấy dữ liệu...');
    
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getCrawlerPages' });
      
      if (response.error) {
        this.showToast('Lỗi: ' + response.error);
        return;
      }
      
      if (!response.pages || response.pages.length === 0) {
        this.showToast('Không có trang nào để tải!');
        return;
      }
      
      const { pages, folderName } = response;
      this.showToast(`Đang tải ${pages.length} trang...`);
      
      let downloaded = 0;
      
      for (const page of pages) {
        try {
          // Create blob and download from popup context
          const blob = new Blob([page.html], { type: 'text/html;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          
          await chrome.downloads.download({
            url: url,
            filename: `${folderName}/${page.filename}`,
            saveAs: false,
            conflictAction: 'uniquify'
          });
          
          // Delay revoke to ensure download starts
          setTimeout(() => URL.revokeObjectURL(url), 2000);
          
          downloaded++;
        } catch (e) {
          console.error('Download error:', page.filename, e);
        }
        
        // Small delay between downloads
        await new Promise(r => setTimeout(r, 100));
      }
      
      this.showToast(`Đã tải ${downloaded}/${pages.length} trang!`);
      
    } catch (e) {
      this.showToast('Lỗi: ' + e.message);
      console.error(e);
    }
  }

  // ============================================
  // EXPORT
  // ============================================
  async exportReport(format) {
    if (!this.scanData) {
      this.showToast('Chưa có dữ liệu. Hãy quét trang trước!');
      return;
    }

    const scores = this.calculateScores(this.scanData);
    const filename = `scanvui-${new Date().toISOString().slice(0, 10)}`;

    switch (format) {
      case 'json':
        this.downloadFile(filename + '.json', JSON.stringify(this.scanData, null, 2), 'application/json');
        break;
      case 'markdown':
        this.downloadFile(filename + '.md', this.generateMarkdown(scores), 'text/markdown');
        break;
      case 'html':
        this.downloadFile(filename + '.html', this.generateHTML(scores), 'text/html');
        break;
      case 'csv':
        this.downloadFile(filename + '.csv', this.generateCSV(), 'text/csv');
        break;
    }
    this.showToast('Đã tải xuống!');
  }

  downloadFile(name, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  copyAsJSON() {
    if (!this.scanData) return this.showToast('Chưa có dữ liệu');
    navigator.clipboard.writeText(JSON.stringify(this.scanData, null, 2));
    this.showToast('Đã copy JSON!');
  }

  copyAsMarkdown() {
    if (!this.scanData) return this.showToast('Chưa có dữ liệu');
    const scores = this.calculateScores(this.scanData);
    navigator.clipboard.writeText(this.generateMarkdown(scores));
    this.showToast('Đã copy Markdown!');
  }

  copyAsSummary() {
    if (!this.scanData) return this.showToast('Chưa có dữ liệu');
    const scores = this.calculateScores(this.scanData);
    const summary = `ScanVui Report: ${this.scanData.url}
SEO: ${scores.seo.score}/100 | A11y: ${scores.a11y.score}/100 | Perf: ${scores.perf.score}/100
Forms: ${this.scanData.forms?.length || 0} | Links: ${this.scanData.linksTotal || 0} | Images: ${this.scanData.media?.images?.total || 0}`;
    navigator.clipboard.writeText(summary);
    this.showToast('Đã copy tóm tắt!');
  }

  generateMarkdown(scores) {
    const d = this.scanData;
    return `# ScanVui Report

**URL:** ${d.url}
**Date:** ${new Date(d.timestamp).toLocaleString()}

## Scores
| Category | Score |
|----------|-------|
| SEO | ${scores.seo.score}/100 |
| Accessibility | ${scores.a11y.score}/100 |
| Performance | ${scores.perf.score}/100 |
| Best Practices | ${scores.bp.score}/100 |

## Issues
${[...scores.seo.issues, ...scores.a11y.issues, ...scores.perf.issues, ...scores.bp.issues].map(i => `- ${i}`).join('\n') || 'No issues found!'}

## Summary
- Forms: ${d.forms?.length || 0}
- Links: ${d.linksTotal || 0}
- Images: ${d.media?.images?.total || 0}
- Scripts: ${d.scripts?.total || 0}

---
*Generated by ScanVui v3.1*
`;
  }

  generateHTML(scores) {
    const d = this.scanData;
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>ScanVui Report - ${d.url}</title>
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #6366f1; }
    .score { display: inline-block; padding: 10px 20px; margin: 5px; border-radius: 8px; color: white; }
    .good { background: #10b981; }
    .warning { background: #f59e0b; }
    .poor { background: #ef4444; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
    th { background: #f5f5f5; }
  </style>
</head>
<body>
  <h1>🔍 ScanVui Report</h1>
  <p><strong>URL:</strong> ${d.url}</p>
  <p><strong>Date:</strong> ${new Date(d.timestamp).toLocaleString()}</p>
  
  <h2>Scores</h2>
  <div class="score ${this.getScoreClass(scores.seo.score)}">SEO: ${scores.seo.score}</div>
  <div class="score ${this.getScoreClass(scores.a11y.score)}">A11y: ${scores.a11y.score}</div>
  <div class="score ${this.getScoreClass(scores.perf.score)}">Perf: ${scores.perf.score}</div>
  <div class="score ${this.getScoreClass(scores.bp.score)}">BP: ${scores.bp.score}</div>

  <h2>Summary</h2>
  <table>
    <tr><th>Metric</th><th>Value</th></tr>
    <tr><td>Forms</td><td>${d.forms?.length || 0}</td></tr>
    <tr><td>Links</td><td>${d.linksTotal || 0}</td></tr>
    <tr><td>Images</td><td>${d.media?.images?.total || 0}</td></tr>
    <tr><td>Scripts</td><td>${d.scripts?.total || 0}</td></tr>
  </table>
</body>
</html>`;
  }

  generateCSV() {
    const d = this.scanData;
    const scores = this.calculateScores(d);
    return `Metric,Value
URL,${d.url}
Date,${d.timestamp}
SEO Score,${scores.seo.score}
A11y Score,${scores.a11y.score}
Performance Score,${scores.perf.score}
Best Practices Score,${scores.bp.score}
Forms,${d.forms?.length || 0}
Links,${d.linksTotal || 0}
Images,${d.media?.images?.total || 0}
Scripts,${d.scripts?.total || 0}`;
  }

  // ============================================
  // TOAST (with debounce to prevent spam)
  // ============================================
  showToast(message) {
    // Clear existing timeout
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
    
    this.toast.textContent = message;
    this.toast.classList.remove('hidden');
    
    this.toastTimeout = setTimeout(() => {
      this.toast.classList.add('hidden');
      this.toastTimeout = null;
    }, 2500);
  }
}

// ============================================
// INJECTED FUNCTIONS
// ============================================
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
    tables: { total: 0 },
    iframes: { total: 0 },
    shadowDomCount: 0,
    customElements: 0,
    meta: {},
    media: { images: { total: 0, withAlt: 0, withoutAlt: 0 }, videos: { total: 0 }, audio: { total: 0 } },
    navigation: {},
    semantic: {},
    scripts: {},
    stylesheets: {},
    accessibility: {},
    performance: {},
    storage: {}
  };

  // Walk DOM
  let domElements = 0, maxDepth = 0, shadowDomCount = 0, customElements = 0;
  function walk(node, depth = 0) {
    if (depth > 20) return;
    if (depth > maxDepth) maxDepth = depth;
    const children = node.children || [];
    for (let i = 0; i < children.length; i++) {
      const el = children[i];
      if (!el || el.nodeType !== 1) continue;
      domElements++;
      if (el.tagName?.includes('-')) customElements++;
      if (el.shadowRoot) { shadowDomCount++; walk(el.shadowRoot, depth + 1); }
      walk(el, depth + 1);
    }
  }
  walk(document.body);
  result.shadowDomCount = shadowDomCount;
  result.customElements = customElements;
  result.performance.domElements = domElements;
  result.performance.domDepth = maxDepth;

  // Meta
  result.meta = {
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.content || null,
    viewport: document.querySelector('meta[name="viewport"]')?.content || null,
    charset: document.characterSet,
    canonical: document.querySelector('link[rel="canonical"]')?.href || null,
    language: document.documentElement.lang || null,
    favicon: !!document.querySelector('link[rel="icon"], link[rel="shortcut icon"]'),
    openGraph: Array.from(document.querySelectorAll('meta[property^="og:"]')).map(m => ({ property: m.getAttribute('property'), content: m.content })),
    twitterCards: Array.from(document.querySelectorAll('meta[name^="twitter:"]')).map(m => ({ name: m.name, content: m.content }))
  };

  // Forms
  document.querySelectorAll('form').forEach((form, i) => {
    const fields = [];
    form.querySelectorAll('input:not([type="hidden"]), select, textarea').forEach(el => {
      fields.push({
        type: el.type || el.tagName.toLowerCase(),
        name: el.name || null,
        id: el.id || null,
        required: el.required,
        label: el.labels?.[0]?.textContent?.trim() || el.getAttribute('aria-label') || null
      });
      result.totalFields++;
    });
    result.forms.push({
      name: form.name || form.id || null,
      method: (form.method || 'GET').toUpperCase(),
      action: form.action || null,
      fields
    });
  });

  // Links
  const links = document.querySelectorAll('a[href]');
  result.linksTotal = links.length;
  const host = window.location.hostname;
  let internal = 0, external = 0;
  links.forEach(a => {
    if (a.hostname && a.hostname !== host) external++;
    else internal++;
  });
  result.navigation = { internalLinks: internal, externalLinks: external };

  // Headings
  document.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(h => {
    result.headings.push({ level: h.tagName, text: h.textContent?.trim().substring(0, 100), id: h.id || null });
  });

  // Media
  const images = document.querySelectorAll('img');
  let withAlt = 0, withoutAlt = 0;
  images.forEach(img => { if (img.alt) withAlt++; else withoutAlt++; });
  result.media.images = { total: images.length, withAlt, withoutAlt };
  result.media.videos.total = document.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"]').length;
  result.media.audio.total = document.querySelectorAll('audio').length;

  // Semantic
  result.semantic = {
    header: document.querySelectorAll('header').length,
    nav: document.querySelectorAll('nav').length,
    main: document.querySelectorAll('main').length,
    footer: document.querySelectorAll('footer').length,
    article: document.querySelectorAll('article').length,
    section: document.querySelectorAll('section').length,
    aside: document.querySelectorAll('aside').length
  };

  // Scripts
  const scripts = document.querySelectorAll('script');
  let ext = 0, inl = 0;
  scripts.forEach(s => { if (s.src) ext++; else inl++; });
  result.scripts = { total: scripts.length, external: ext, inline: inl };

  // Stylesheets
  result.stylesheets = {
    total: document.querySelectorAll('link[rel="stylesheet"]').length + document.querySelectorAll('style').length,
    external: document.querySelectorAll('link[rel="stylesheet"]').length,
    inline: document.querySelectorAll('style').length
  };

  // Accessibility
  result.accessibility = {
    ariaLabels: document.querySelectorAll('[aria-label]').length,
    ariaRoles: document.querySelectorAll('[role]').length,
    tabindex: document.querySelectorAll('[tabindex]').length,
    labels: document.querySelectorAll('label').length,
    skipLinks: document.querySelectorAll('a[href^="#main"], a[href^="#content"], .skip-link').length,
    langAttribute: !!document.documentElement.lang,
    altTextCoverage: images.length > 0 ? Math.round((withAlt / images.length) * 100) : 100
  };

  // Performance
  result.performance.inlineStyles = document.querySelectorAll('[style]').length;
  result.performance.deprecatedElements = document.querySelectorAll('font, center, marquee, blink').length;

  // Storage
  try {
    result.storage = {
      cookies: document.cookie ? document.cookie.split(';').length : 0,
      localStorage: Object.keys(localStorage).length,
      sessionStorage: Object.keys(sessionStorage).length
    };
  } catch (e) {}

  return result;
}

function injectXray(types) {
  const colors = {
    forms: '#22c55e',
    inputs: '#3b82f6',
    buttons: '#eab308',
    links: '#a855f7',
    headings: '#ef4444',
    images: '#f97316'
  };
  const selectors = {
    forms: 'form',
    inputs: 'input, select, textarea',
    buttons: 'button, [type="submit"], [type="button"]',
    links: 'a[href]',
    headings: 'h1, h2, h3, h4, h5, h6',
    images: 'img'
  };

  types.forEach(type => {
    if (selectors[type]) {
      document.querySelectorAll(selectors[type]).forEach(el => {
        el.style.outline = `3px solid ${colors[type]}`;
        el.style.backgroundColor = colors[type] + '20';
        el.setAttribute('data-scanvui-xray', type);
      });
    }
  });
}

function fillFormsWithData(locale, mode) {
  const data = {
    vi: {
      name: ['Nguyễn Văn A', 'Trần Thị B', 'Lê Văn C'],
      email: ['test@example.com', 'user@mail.vn'],
      phone: ['0901234567', '0912345678'],
      address: ['123 Đường ABC, Quận 1, TP.HCM'],
      text: ['Đây là nội dung test']
    },
    en: {
      name: ['John Doe', 'Jane Smith'],
      email: ['john@example.com', 'test@mail.com'],
      phone: ['555-1234', '555-5678'],
      address: ['123 Main St, City'],
      text: ['This is test content']
    }
  };
  const d = data[locale] || data.vi;
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  document.querySelectorAll('input, textarea, select').forEach(el => {
    if (el.type === 'hidden' || el.disabled || el.readOnly) return;
    
    const name = (el.name || el.id || '').toLowerCase();
    
    if (el.type === 'email' || name.includes('email')) el.value = pick(d.email);
    else if (el.type === 'tel' || name.includes('phone') || name.includes('tel')) el.value = pick(d.phone);
    else if (name.includes('name')) el.value = pick(d.name);
    else if (name.includes('address')) el.value = pick(d.address);
    else if (el.type === 'checkbox') el.checked = Math.random() > 0.5;
    else if (el.type === 'radio') el.checked = Math.random() > 0.7;
    else if (el.tagName === 'SELECT' && el.options.length > 1) el.selectedIndex = 1;
    else if (el.type === 'text' || el.tagName === 'TEXTAREA') el.value = pick(d.text);
    else if (el.type === 'number') el.value = Math.floor(Math.random() * 100);
    else if (el.type === 'date') el.value = new Date().toISOString().slice(0, 10);
  });
}

function startPicker() {
  if (document.getElementById('scanvui-picker-overlay')) return;
  
  const overlay = document.createElement('div');
  overlay.id = 'scanvui-picker-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:999999;cursor:crosshair;';
  
  const tooltip = document.createElement('div');
  tooltip.id = 'scanvui-picker-tooltip';
  tooltip.style.cssText = 'position:fixed;background:#1a1a2e;color:white;padding:8px 12px;border-radius:6px;font-size:12px;font-family:monospace;z-index:1000000;pointer-events:none;max-width:300px;word-break:break-all;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
  document.body.appendChild(tooltip);
  
  let highlight = null;
  let lastSelectors = null;
  
  function getSelectors(el) {
    // CSS Selector
    let css = '';
    if (el.id) {
      css = '#' + el.id;
    } else if (el.className && typeof el.className === 'string') {
      const classes = el.className.trim().split(/\s+/).filter(c => c && !c.startsWith('scanvui'));
      if (classes.length > 0) {
        css = el.tagName.toLowerCase() + '.' + classes[0];
      } else {
        css = el.tagName.toLowerCase();
      }
    } else {
      css = el.tagName.toLowerCase();
    }
    
    // XPath - simple but accurate
    let xpath = '';
    if (el.id) {
      xpath = `//*[@id="${el.id}"]`;
    } else {
      const parts = [];
      let current = el;
      while (current && current.nodeType === 1 && current !== document.body) {
        let selector = current.tagName.toLowerCase();
        const siblings = current.parentNode ? Array.from(current.parentNode.children).filter(c => c.tagName === current.tagName) : [];
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `[${index}]`;
        }
        parts.unshift(selector);
        current = current.parentElement;
      }
      xpath = '//' + parts.join('/');
    }
    
    // Playwright selector
    let playwright = '';
    if (el.getAttribute('data-testid')) {
      playwright = `[data-testid="${el.getAttribute('data-testid')}"]`;
    } else if (el.getAttribute('aria-label')) {
      playwright = `getByLabel("${el.getAttribute('aria-label')}")`;
    } else if (el.textContent && el.textContent.trim().length > 0 && el.textContent.trim().length < 50 && el.children.length === 0) {
      playwright = `getByText("${el.textContent.trim().substring(0, 30)}")`;
    } else {
      playwright = css;
    }
    
    return { css, xpath, playwright };
  }
  
  overlay.addEventListener('mousemove', e => {
    overlay.style.pointerEvents = 'none';
    const el = document.elementFromPoint(e.clientX, e.clientY);
    overlay.style.pointerEvents = 'auto';
    
    if (el && el !== overlay && el !== tooltip && el !== highlight) {
      if (highlight) {
        highlight.style.outline = highlight._originalOutline || '';
      }
      highlight = el;
      highlight._originalOutline = highlight.style.outline;
      highlight.style.outline = '3px solid #6366f1';
      
      lastSelectors = getSelectors(el);
      tooltip.innerHTML = `<strong>${el.tagName.toLowerCase()}</strong>${el.id ? '#' + el.id : ''}<br>CSS: ${lastSelectors.css}`;
      tooltip.style.display = 'block';
    }
    
    tooltip.style.left = (e.clientX + 15) + 'px';
    tooltip.style.top = (e.clientY + 15) + 'px';
  });
  
  overlay.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    
    if (highlight && lastSelectors) {
      highlight.style.outline = highlight._originalOutline || '';
      
      window.postMessage({ 
        type: 'SCANVUI_SELECTOR_PICKED', 
        selectors: lastSelectors 
      }, '*');
      
      navigator.clipboard.writeText(lastSelectors.css).then(() => {
        const toast = document.createElement('div');
        toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#10b981;color:white;padding:10px 20px;border-radius:8px;font-size:13px;z-index:1000001;';
        toast.textContent = 'Đã copy: ' + lastSelectors.css;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
      });
    }
    
    overlay.remove();
    tooltip.remove();
  });
  
  overlay.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (highlight) highlight.style.outline = highlight._originalOutline || '';
      overlay.remove();
      tooltip.remove();
    }
  });
  
  overlay.setAttribute('tabindex', '0');
  document.body.appendChild(overlay);
  overlay.focus();
}

function detectTechnologies() {
  const techs = [];
  
  // Frameworks
  if (window.React || document.querySelector('[data-reactroot]') || document.querySelector('[data-react-helmet]')) {
    techs.push({ icon: '⚛️', name: 'React' });
  }
  if (window.Vue || document.querySelector('[data-v-]') || window.__VUE__) {
    techs.push({ icon: '💚', name: 'Vue' });
  }
  if (window.angular || document.querySelector('[ng-app]') || document.querySelector('[ng-version]')) {
    techs.push({ icon: '🅰️', name: 'Angular' });
  }
  if (window.Svelte || document.querySelector('[class*="svelte"]')) {
    techs.push({ icon: '🔶', name: 'Svelte' });
  }
  if (window.next || document.querySelector('#__next') || window.__NEXT_DATA__) {
    techs.push({ icon: '▲', name: 'Next.js' });
  }
  if (window.nuxt || document.querySelector('#__nuxt') || window.__NUXT__) {
    techs.push({ icon: '💚', name: 'Nuxt' });
  }
  if (window.__GATSBY) {
    techs.push({ icon: '💜', name: 'Gatsby' });
  }
  if (document.querySelector('[data-astro-cid]') || document.querySelector('astro-island')) {
    techs.push({ icon: '🚀', name: 'Astro' });
  }
  
  // Libraries
  if (window.jQuery || window.$?.fn?.jquery) {
    techs.push({ icon: '📦', name: 'jQuery' });
  }
  if (window.htmx) {
    techs.push({ icon: '⚡', name: 'htmx' });
  }
  if (window.Alpine) {
    techs.push({ icon: '🏔️', name: 'Alpine.js' });
  }
  
  // CSS Frameworks - improved detection
  const allClasses = Array.from(document.querySelectorAll('[class]')).map(el => el.className).join(' ');
  if (allClasses.includes('tw-') || document.querySelector('[class*="sm:"]') || document.querySelector('[class*="md:"]') || document.querySelector('[class*="lg:"]')) {
    techs.push({ icon: '🎨', name: 'Tailwind' });
  }
  if (document.querySelector('.btn-primary') || document.querySelector('.navbar-brand') || document.querySelector('[class*="col-md-"]') || document.querySelector('[class*="col-lg-"]')) {
    techs.push({ icon: '🅱️', name: 'Bootstrap' });
  }
  if (document.querySelector('.ui.button') || document.querySelector('.ui.container')) {
    techs.push({ icon: '🎨', name: 'Semantic UI' });
  }
  if (document.querySelector('[class*="MuiButton"]') || document.querySelector('[class*="MuiPaper"]')) {
    techs.push({ icon: '🎨', name: 'MUI' });
  }
  if (document.querySelector('[class*="chakra-"]')) {
    techs.push({ icon: '⚡', name: 'Chakra UI' });
  }
  if (document.querySelector('[class*="ant-"]')) {
    techs.push({ icon: '🐜', name: 'Ant Design' });
  }
  
  // Build tools
  if (document.querySelector('script[src*="@vite"]') || document.querySelector('script[type="module"][src*="/@"]')) {
    techs.push({ icon: '⚡', name: 'Vite' });
  }
  
  // Analytics
  if (window.gtag || window.ga || window.dataLayer) {
    techs.push({ icon: '📊', name: 'GA' });
  }
  if (window.fbq) {
    techs.push({ icon: '📘', name: 'FB Pixel' });
  }
  if (window.analytics || window.segment) {
    techs.push({ icon: '📈', name: 'Segment' });
  }
  if (window.mixpanel) {
    techs.push({ icon: '📊', name: 'Mixpanel' });
  }
  if (window.amplitude) {
    techs.push({ icon: '📊', name: 'Amplitude' });
  }
  if (window.posthog) {
    techs.push({ icon: '🦔', name: 'PostHog' });
  }
  
  // CMS
  if (document.querySelector('meta[name="generator"][content*="WordPress"]') || document.querySelector('link[href*="wp-content"]')) {
    techs.push({ icon: '📝', name: 'WordPress' });
  }
  if (document.querySelector('meta[name="generator"][content*="Shopify"]') || window.Shopify) {
    techs.push({ icon: '🛒', name: 'Shopify' });
  }
  if (document.querySelector('meta[name="generator"][content*="Webflow"]')) {
    techs.push({ icon: '🌐', name: 'Webflow' });
  }
  if (document.querySelector('meta[name="generator"][content*="Wix"]') || window.wixBiSession) {
    techs.push({ icon: '🎨', name: 'Wix' });
  }
  if (document.querySelector('meta[name="generator"][content*="Squarespace"]')) {
    techs.push({ icon: '◼️', name: 'Squarespace' });
  }
  
  return techs;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => new ScanVuiApp());
