// ScanVui Service Worker
// Handles background tasks: screenshot, fetch, and website crawler

// ============================================
// CRAWLER STATE
// ============================================
let crawlerState = null;
let crawlerAbortController = null;
let keepAliveInterval = null;
let isExecutingCrawler = false; // Prevent race conditions

// ============================================
// SERVICE WORKER LIFECYCLE
// ============================================

// Restore state on startup (after extension reload/update)
chrome.runtime.onStartup.addListener(async () => {
  await restoreCrawlerState();
});

chrome.runtime.onInstalled.addListener(async () => {
  await restoreCrawlerState();
});

async function restoreCrawlerState() {
  try {
    const { crawlerStatus } = await chrome.storage.local.get('crawlerStatus');
    if (crawlerStatus && crawlerStatus.status === 'running') {
      // Crawler was interrupted - mark as error
      crawlerStatus.status = 'error';
      crawlerStatus.error = 'Crawler bị gián đoạn do extension reload';
      await chrome.storage.local.set({ crawlerStatus });
    }
  } catch (e) {
    console.error('Error restoring crawler state:', e);
  }
}

// Keep service worker alive while crawling
function startKeepAlive() {
  if (keepAliveInterval) return;
  
  keepAliveInterval = setInterval(async () => {
    if (crawlerState && crawlerState.status === 'running') {
      // Ping storage and create a fetch to keep SW alive
      try {
        await chrome.storage.local.get('crawlerStatus');
      } catch {}
    } else {
      stopKeepAlive();
    }
  }, 25000); // Every 25 seconds (SW timeout is 30s)
}

function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
}

// ============================================
// MESSAGE HANDLER
// ============================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request, sender, sendResponse);
  return true; // Always return true for async
});

async function handleMessage(request, sender, sendResponse) {
  try {
    switch (request.action) {
      case 'getTabInfo':
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        sendResponse(tabs[0] ? { tabId: tabs[0].id, url: tabs[0].url } : { error: 'No active tab found' });
        break;

      case 'captureVisibleTab':
        try {
          const dataUrl = await chrome.tabs.captureVisibleTab(null, {
            format: request.format || 'png',
            quality: request.quality || 100
          });
          sendResponse({ dataUrl });
        } catch (e) {
          sendResponse({ error: e.message });
        }
        break;

      case 'fetchUrl':
        try {
          const result = await fetchUrlWithRetry(request.url, request.options || {});
          sendResponse(result);
        } catch (e) {
          sendResponse({ error: e.message });
        }
        break;

      case 'startCrawler':
        try {
          await startCrawlerInBackground(request.tabId, request.startUrl, request.settings);
          sendResponse({ success: true });
        } catch (e) {
          sendResponse({ error: e.message });
        }
        break;

      case 'stopCrawler':
        stopCrawler();
        sendResponse({ success: true });
        break;

      case 'getCrawlerStatus':
        if (crawlerState) {
          sendResponse(getCrawlerStatus());
        } else {
          try {
            const { crawlerStatus } = await chrome.storage.local.get('crawlerStatus');
            sendResponse(crawlerStatus || { status: 'idle' });
          } catch {
            sendResponse({ status: 'idle' });
          }
        }
        break;

      case 'resetCrawler':
        // Only reset if not currently running
        if (isExecutingCrawler) {
          sendResponse({ error: 'Crawler đang chạy, không thể reset' });
        } else {
          crawlerState = null;
          crawlerAbortController = null;
          stopKeepAlive();
          await chrome.storage.local.remove('crawlerStatus');
          sendResponse({ success: true });
        }
        break;

      case 'getCrawlerPages':
        // Return pages data for popup to download
        if (crawlerState && crawlerState.pages && crawlerState.pages.length > 0) {
          // Only send essential data to avoid memory issues
          const pagesData = crawlerState.pages.map(p => ({
            filename: p.filename,
            html: p.processedHtml || p.html,
            title: p.title
          }));
          sendResponse({ 
            success: true, 
            pages: pagesData,
            folderName: crawlerState.folderName,
            images: crawlerState.pendingImages || []
          });
        } else {
          sendResponse({ error: 'No pages available' });
        }
        break;

      default:
        sendResponse({ error: 'Unknown action' });
    }
  } catch (e) {
    sendResponse({ error: e.message });
  }
}

// ============================================
// CRAWLER IMPLEMENTATION
// ============================================

async function startCrawlerInBackground(tabId, startUrl, settings) {
  // Prevent concurrent starts
  if (isExecutingCrawler) {
    throw new Error('Crawler đang chạy');
  }
  
  if (crawlerState && crawlerState.status === 'running') {
    throw new Error('Crawler đang chạy');
  }

  // Validate tab exists and is accessible
  let tab;
  try {
    tab = await chrome.tabs.get(tabId);
    if (!tab || !tab.url) {
      throw new Error('Tab không hợp lệ');
    }
  } catch (e) {
    throw new Error('Tab không tồn tại hoặc không truy cập được');
  }

  // Validate URL
  let baseUrl;
  try {
    baseUrl = new URL(startUrl);
  } catch {
    throw new Error('URL không hợp lệ');
  }

  crawlerAbortController = new AbortController();
  isExecutingCrawler = true;
  
  const folderName = sanitizeFolderName(baseUrl.hostname);

  crawlerState = {
    status: 'running',
    folderName,
    baseHost: baseUrl.hostname,
    startUrl,
    tabId,
    crawlerTabId: null, // Separate tab for crawling (preserves user's tab)
    settings: {
      depth: Math.min(settings.depth || 2, 10),
      maxPages: Math.min(settings.maxPages || 50, 1000)
    },
    visited: new Set(),
    queue: [{ url: startUrl, depth: 0 }],
    pages: [],
    pendingImages: [],
    downloadedImages: new Map(),
    pageCount: 0,
    imageCount: 0,
    currentUrl: '',
    progress: 0,
    progressLabel: 'Đang chuẩn bị...',
    startTime: Date.now(),
    error: null,
    usedFilenames: new Set(['index.html'])
  };

  startKeepAlive();
  await saveCrawlerState();

  // Run crawler
  executeCrawler().finally(() => {
    isExecutingCrawler = false;
    stopKeepAlive();
  });
}

async function executeCrawler() {
  const { settings, tabId, startUrl } = crawlerState;
  const maxDepth = settings.depth;
  const maxPages = settings.maxPages;
  const maxTime = 30 * 60 * 1000; // 30 minutes
  const startTime = Date.now();

  try {
    // Step 1: Get HTML from current tab
    updateProgress('Đang lấy trang chính...', 5);
    
    if (!await checkTabExists(tabId)) {
      throw new Error('Tab đã bị đóng');
    }

    const mainPageHtml = await getPageHtmlFromTab(tabId);
    if (!mainPageHtml) {
      throw new Error('Không thể lấy HTML từ tab. Hãy thử refresh trang.');
    }

    const mainTitle = await getPageTitle(tabId);
    
    crawlerState.pages.push({
      url: startUrl,
      html: mainPageHtml,
      filename: 'index.html',
      title: decodeHtmlEntities(mainTitle)
    });
    crawlerState.visited.add(normalizeUrl(startUrl));
    crawlerState.pageCount = 1;

    // Extract links
    const links = extractLinksFromHtml(mainPageHtml, startUrl, crawlerState.baseHost);
    for (const link of links) {
      const normalized = normalizeUrl(link);
      if (!crawlerState.visited.has(normalized)) {
        crawlerState.queue.push({ url: link, depth: 1 });
      }
    }

    updateProgress(`Tìm thấy ${links.length} links`, 10);
    await saveCrawlerState();

    // Step 2: Create a hidden tab for crawling (preserves user's original tab)
    let crawlerTab;
    try {
      crawlerTab = await chrome.tabs.create({ 
        url: 'about:blank', 
        active: false 
      });
      crawlerState.crawlerTabId = crawlerTab.id;
    } catch (e) {
      throw new Error('Không thể tạo tab để crawl: ' + e.message);
    }

    // Step 2b: Re-capture main page with unhide on crawler tab
    try {
      const unhiddenResult = await getPageHtmlViaTab(crawlerState.crawlerTabId, startUrl, 15000);
      if (unhiddenResult && unhiddenResult.html) {
        crawlerState.pages[0].html = unhiddenResult.html;
        if (unhiddenResult.title) {
          crawlerState.pages[0].title = decodeHtmlEntities(unhiddenResult.title);
        }
      }
    } catch {
      // Fall back to original HTML if unhide fails
    }

    // Step 3: Crawl child pages using tab navigation (with auth cookies)
    try {
      while (crawlerState.queue.length > 0) {
        if (crawlerAbortController?.signal?.aborted) {
          crawlerState.status = 'stopped';
          crawlerState.progressLabel = 'Đã dừng';
          await saveCrawlerState();
          break;
        }

        if (crawlerState.pageCount >= maxPages) break;

        if (Date.now() - startTime > maxTime) {
          updateProgress('Đạt giới hạn thời gian (30 phút)', 80);
          break;
        }

        const item = crawlerState.queue.shift();
        if (!item) break;
        
        const { url, depth } = item;
        
        if (maxDepth > 0 && depth > maxDepth) continue;
        
        const normalizedUrl = normalizeUrl(url);
        if (crawlerState.visited.has(normalizedUrl)) continue;
        crawlerState.visited.add(normalizedUrl);

        crawlerState.currentUrl = url;
        const progress = Math.min(75, 10 + (crawlerState.pageCount / maxPages) * 65);
        updateProgress(`Trang ${crawlerState.pageCount + 1}/${maxPages}`, progress);

        try {
          // Check if crawler tab still exists
          try { await chrome.tabs.get(crawlerState.crawlerTabId); } catch {
            crawlerTab = await chrome.tabs.create({ url: 'about:blank', active: false });
            crawlerState.crawlerTabId = crawlerTab.id;
          }

          // Navigate crawler tab to URL (browser sends cookies automatically!)
          const result = await getPageHtmlViaTab(crawlerState.crawlerTabId, url, 15000);
          
          if (!result || !result.html) continue;

          const html = result.html;
          const filename = generateUniqueFilename(url, crawlerState.pageCount, crawlerState.usedFilenames);
          const title = decodeHtmlEntities(result.title || extractTitleFromHtml(html));

          crawlerState.pages.push({ url, html, filename, title });
          crawlerState.pageCount++;

          // Extract more links
          if (maxDepth === 0 || depth < maxDepth) {
            const childLinks = extractLinksFromHtml(html, url, crawlerState.baseHost);
            for (const link of childLinks) {
              const normalized = normalizeUrl(link);
              if (!crawlerState.visited.has(normalized) && 
                  crawlerState.queue.length < maxPages * 3) {
                crawlerState.queue.push({ url: link, depth: depth + 1 });
              }
            }
          }

          if (crawlerState.pageCount % 5 === 0) {
            await saveCrawlerState();
          }
          
          await delay(200);
          
        } catch (e) {
          // Silently skip failed URLs
          console.log(`[ScanVui] Skip ${url}: ${e.message}`);
        }
      }
    } finally {
      // Close the crawler tab
      try {
        if (crawlerState.crawlerTabId) {
          await chrome.tabs.remove(crawlerState.crawlerTabId);
          crawlerState.crawlerTabId = null;
        }
      } catch {}
    }

    // Step 3: Collect image URLs (don't download yet)
    console.log(`[ScanVui] Crawled ${crawlerState.pages.length} pages total`);
    updateProgress('Đang phân tích hình ảnh...', 78);
    collectImageUrls();
    console.log(`[ScanVui] Found ${crawlerState.pendingImages.length} images`);

    // Step 4: Fetch and inline CSS
    updateProgress('Đang tải CSS...', 80);
    await inlineCssForPages();

    // Step 5: Process HTML (replace URLs)
    updateProgress('Đang xử lý HTML...', 82);
    processAllPages();
    console.log(`[ScanVui] Processed HTML for ${crawlerState.pages.length} pages`);

    // Step 6: Download everything
    updateProgress('Đang lưu files...', 85);
    await downloadAllFiles();
    console.log(`[ScanVui] Download phase complete`);

    // Done
    crawlerState.status = 'completed';
    crawlerState.progress = 100;
    crawlerState.progressLabel = 'Hoàn thành!';
    crawlerState.currentUrl = '';
    await saveCrawlerState();

    showNotification('ScanVui - Tải xong!', 
      `${crawlerState.pageCount} trang, ${crawlerState.imageCount} ảnh → Downloads/${crawlerState.folderName}/`);

  } catch (e) {
    crawlerState.status = 'error';
    crawlerState.error = e.message || 'Lỗi không xác định';
    crawlerState.progressLabel = 'Lỗi: ' + crawlerState.error;
    await saveCrawlerState();
  }
}

async function checkTabExists(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    return tab && tab.id;
  } catch {
    return false;
  }
}

async function getPageHtmlFromTab(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => document.documentElement.outerHTML
    });
    return results?.[0]?.result || null;
  } catch (e) {
    console.error('getPageHtmlFromTab error:', e);
    return null;
  }
}

// Unhide hidden content and capture HTML (only use on crawler tab, NOT user's tab)
async function getPageHtmlWithUnhide(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        try {
          // === STEP A: HIDE problematic overlapping elements ===
          // Sidebar, drawer, nav-overlay, off-canvas that may cover main content
          const hideSelectors = [
            '[class*="sidebar"]', '[class*="side-bar"]', '[class*="side_bar"]',
            '[class*="drawer"]', '[class*="offcanvas"]', '[class*="off-canvas"]',
            '[class*="nav-overlay"]', '[class*="sidenav"]', '[class*="side-nav"]',
            '[class*="left-panel"]', '[class*="right-panel"]',
            '.nav-menu', '.mobile-menu', '.hamburger-menu',
            '[class*="flyout"]', '[class*="slide-menu"]',
            '[role="navigation"][aria-hidden]'
          ];
          const mainContentPatterns = /main|content|article|page|wrapper|app|root/i;
          
          document.querySelectorAll(hideSelectors.join(',')).forEach(el => {
            try {
              const style = getComputedStyle(el);
              const cls = (typeof el.className === 'string' ? el.className : '');
              // Only hide if it's a fixed/absolute positioned sidebar
              const isFixed = style.position === 'fixed' || style.position === 'absolute';
              const isOffScreen = parseInt(style.left) < -50 || parseInt(style.right) < -50 ||
                                  style.transform.includes('translate');
              const isNarrow = el.offsetWidth > 0 && el.offsetWidth < 400;
              
              // If it looks like a sidebar (fixed/absolute, narrow, off-screen or overlapping)
              if (isFixed && isNarrow && !mainContentPatterns.test(cls)) {
                el.style.setProperty('display', 'none', 'important');
              }
              // If it was hidden but we might accidentally unhide it later
              if (style.display === 'none' || isOffScreen) {
                el.setAttribute('data-scanvui-keep-hidden', 'true');
              }
            } catch {}
          });
          
          // === STEP B: UNHIDE content panels ===
          // 1. Remove hidden attribute (but not on sidebar elements)
          document.querySelectorAll('[hidden]:not([data-scanvui-keep-hidden])').forEach(el => {
            el.removeAttribute('hidden');
          });
          
          // 2. Expand <details> elements
          document.querySelectorAll('details').forEach(d => d.setAttribute('open', ''));
          
          // 3. Expand Bootstrap/Tailwind collapse
          document.querySelectorAll('.collapse:not(.show), .collapsed').forEach(el => {
            const cls = (typeof el.className === 'string' ? el.className : '').toLowerCase();
            if (/sidebar|drawer|offcanvas|nav|menu/.test(cls)) return;
            el.classList.add('show');
            el.classList.remove('collapsed');
            el.style.setProperty('display', 'block', 'important');
            el.style.setProperty('height', 'auto', 'important');
          });
          
          // 4. Set aria-expanded to true (content triggers only)
          document.querySelectorAll('[aria-expanded="false"]').forEach(el => {
            const cls = (typeof el.className === 'string' ? el.className : '').toLowerCase();
            if (/sidebar|drawer|offcanvas|nav|menu|hamburger/.test(cls)) return;
            el.setAttribute('aria-expanded', 'true');
          });
          
          // 5. Unhide aria-hidden content panels (not modals, not sidebars)
          const skipAria = /modal|overlay|backdrop|popup|lightbox|dialog|sidebar|drawer|offcanvas|nav|menu/i;
          document.querySelectorAll('[aria-hidden="true"]').forEach(el => {
            const cls = (typeof el.className === 'string' ? el.className : '').toLowerCase();
            if (skipAria.test(cls)) return;
            el.setAttribute('aria-hidden', 'false');
            if (el.style) el.style.setProperty('display', 'block', 'important');
          });
          
          // 6. Targeted unhide for known content patterns
          const contentSelectors = [
            '[class*="panel"]:not([data-scanvui-keep-hidden])',
            '[class*="content"]:not([data-scanvui-keep-hidden])',
            '[class*="body"]:not([data-scanvui-keep-hidden])',
            '[class*="detail"]:not([data-scanvui-keep-hidden])',
            '[class*="answer"]:not([data-scanvui-keep-hidden])',
            '[class*="collapse"]:not([data-scanvui-keep-hidden])',
            '[class*="accordion"]:not([data-scanvui-keep-hidden])',
            '[class*="tab-pane"]:not([data-scanvui-keep-hidden])',
            '[class*="tabpanel"]:not([data-scanvui-keep-hidden])',
            '[class*="section"]:not([data-scanvui-keep-hidden])',
            '[class*="faq"]:not([data-scanvui-keep-hidden])',
            '[role="tabpanel"]', '[role="region"]'
          ];
          const skipContent = /dropdown|menu|popup|modal|overlay|tooltip|popover|lightbox|dialog|backdrop|nav-sub|submenu|sidebar|drawer|offcanvas/i;
          
          document.querySelectorAll(contentSelectors.join(',')).forEach(el => {
            try {
              const style = getComputedStyle(el);
              const cls = (typeof el.className === 'string' ? el.className : '').toLowerCase();
              if (skipContent.test(cls)) return;
              
              if (style.display === 'none') {
                el.style.setProperty('display', 'block', 'important');
              }
              if (style.maxHeight === '0px' || style.maxHeight === '0') {
                el.style.setProperty('max-height', 'none', 'important');
              }
              if (style.overflow === 'hidden' && parseInt(style.maxHeight) < 50) {
                el.style.setProperty('max-height', 'none', 'important');
                el.style.setProperty('overflow', 'visible', 'important');
              }
              if (style.visibility === 'hidden') {
                el.style.setProperty('visibility', 'visible', 'important');
              }
              if (parseFloat(style.opacity) === 0) {
                el.style.setProperty('opacity', '1', 'important');
              }
            } catch {}
          });
          
          // 7. Convert lazy-load images (data-src -> src)
          document.querySelectorAll('img[data-src], img[data-lazy-src], img[data-original]').forEach(img => {
            const lazySrc = img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('data-original');
            if (lazySrc && !img.src.startsWith('http')) {
              img.src = lazySrc;
            }
          });
          document.querySelectorAll('source[data-srcset]').forEach(src => {
            const srcset = src.getAttribute('data-srcset');
            if (srcset) src.setAttribute('srcset', srcset);
          });
          
          // === STEP C: Fix layout for offline viewing ===
          // Remove fixed positioning from headers/footers
          document.querySelectorAll('header, footer, [class*="header"], [class*="footer"], [class*="navbar"], [class*="topbar"]').forEach(el => {
            try {
              const style = getComputedStyle(el);
              if (style.position === 'fixed' || style.position === 'sticky') {
                el.style.setProperty('position', 'relative', 'important');
              }
            } catch {}
          });
          
          // Ensure main content is not pushed/offset by sidebar
          document.querySelectorAll('main, [role="main"], [class*="main-content"], [class*="page-content"], #content, .content').forEach(el => {
            try {
              el.style.setProperty('margin-left', '0', 'important');
              el.style.setProperty('padding-left', '', '');
              el.style.setProperty('transform', 'none', 'important');
              el.style.setProperty('width', '100%', 'important');
              el.style.setProperty('max-width', '100%', 'important');
            } catch {}
          });
          
        } catch (e) {
          console.error('Unhide error:', e);
        }
        
        return document.documentElement.outerHTML;
      }
    });
    return results?.[0]?.result || null;
  } catch (e) {
    console.error('getPageHtmlWithUnhide error:', e);
    return null;
  }
}

async function getPageTitle(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => document.title
    });
    return results?.[0]?.result || 'Untitled';
  } catch {
    return 'Untitled';
  }
}

// Navigate a tab to URL, wait for load, and extract HTML (preserves auth/cookies)
async function getPageHtmlViaTab(tabId, url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer = null;
    let listener = null;
    let renderTimer = null;

    const cleanup = () => {
      if (timer) { clearTimeout(timer); timer = null; }
      if (renderTimer) { clearTimeout(renderTimer); renderTimer = null; }
      if (listener) { chrome.tabs.onUpdated.removeListener(listener); listener = null; }
    };

    const settle = (value, error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve(value);
    };

    timer = setTimeout(() => {
      // Timeout - try to get whatever HTML is available
      getPageHtmlWithUnhide(tabId).then(html => {
        if (html) {
          getPageTitle(tabId).then(title => {
            settle({ html, title: title || 'Untitled' });
          }).catch(() => settle({ html, title: 'Untitled' }));
        } else {
          settle(null);
        }
      }).catch(() => settle(null));
    }, timeoutMs);

    listener = (updatedTabId, changeInfo) => {
      if (updatedTabId !== tabId || settled) return;
      if (changeInfo.status === 'complete') {
        // Small delay to let JS render, but cancel if already settled
        renderTimer = setTimeout(async () => {
          if (settled) return;
          try {
            const html = await getPageHtmlWithUnhide(tabId);
            const title = await getPageTitle(tabId);
            settle({ html, title });
          } catch (e) {
            settle(null, e);
          }
        }, 800);
      }
    };

    chrome.tabs.onUpdated.addListener(listener);

    chrome.tabs.update(tabId, { url }).catch(e => {
      settle(null, e);
    });
  });
}

function decodeHtmlEntities(text) {
  if (!text) return 'Untitled';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .substring(0, 200);
}

function extractLinksFromHtml(html, baseUrl, allowedHost) {
  const links = new Set();
  const regex = /<a[^>]+href=["']([^"'#]+)/gi;
  let match;
  
  while ((match = regex.exec(html)) !== null) {
    try {
      const href = match[1].trim();
      if (href.startsWith('javascript:') || href.startsWith('mailto:') || 
          href.startsWith('tel:') || href.startsWith('data:') ||
          href.startsWith('#')) continue;
      
      const absoluteUrl = new URL(href, baseUrl).href;
      const urlHost = new URL(absoluteUrl).hostname;
      
      if (urlHost === allowedHost && absoluteUrl.startsWith('http')) {
        links.add(absoluteUrl.split('#')[0]);
      }
    } catch {}
  }
  
  return [...links];
}

function extractTitleFromHtml(html) {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match ? match[1].trim() : 'Untitled';
}

function collectImageUrls() {
  const imageUrls = new Set();
  const MAX_IMAGES = 150;
  
  for (const page of crawlerState.pages) {
    if (imageUrls.size >= MAX_IMAGES) break;
    
    // img src
    const imgRegex = /<img[^>]+src=["']([^"']+)/gi;
    let match;
    while ((match = imgRegex.exec(page.html)) !== null && imageUrls.size < MAX_IMAGES) {
      try {
        const src = match[1].trim();
        if (src.startsWith('data:') || src.length > 500) continue;
        const absoluteUrl = new URL(src, page.url).href;
        if (absoluteUrl.startsWith('http')) {
          imageUrls.add(absoluteUrl);
        }
      } catch {}
    }
    
    // Also collect background-image URLs from inline styles
    const bgRegex = /background(?:-image)?\s*:\s*url\(\s*["']?([^"')]+)/gi;
    while ((match = bgRegex.exec(page.html)) !== null && imageUrls.size < MAX_IMAGES) {
      try {
        const src = match[1].trim();
        if (src.startsWith('data:') || src.length > 500) continue;
        const absoluteUrl = new URL(src, page.url).href;
        if (absoluteUrl.startsWith('http')) {
          imageUrls.add(absoluteUrl);
        }
      } catch {}
    }
  }

  // Create filename mapping
  let index = 0;
  for (const url of imageUrls) {
    const ext = getImageExtension(url);
    const filename = `images/img_${index}.${ext}`;
    crawlerState.downloadedImages.set(url, filename);
    crawlerState.pendingImages.push({ url, filename });
    index++;
  }
}

// Collect CSS URLs from all pages
function collectCssUrls() {
  const cssUrls = new Set();
  
  for (const page of crawlerState.pages) {
    const linkRegex = /<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/gi;
    const linkRegex2 = /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']stylesheet["']/gi;
    let match;
    
    for (const regex of [linkRegex, linkRegex2]) {
      while ((match = regex.exec(page.html)) !== null) {
        try {
          const href = match[1].trim();
          if (href.startsWith('data:') || href.length > 500) continue;
          const absoluteUrl = new URL(href, page.url).href;
          if (absoluteUrl.startsWith('http')) {
            cssUrls.add(absoluteUrl);
          }
        } catch {}
      }
    }
  }
  
  return [...cssUrls];
}

// Fetch and inline CSS into HTML
async function inlineCssForPages() {
  const cssUrls = collectCssUrls();
  if (cssUrls.length === 0) return;
  
  console.log(`[ScanVui] Fetching ${cssUrls.length} CSS files to inline`);
  
  const cssCache = new Map();
  const MAX_CSS = 30;
  
  for (let i = 0; i < Math.min(cssUrls.length, MAX_CSS); i++) {
    try {
      const response = await fetchUrlWithRetry(cssUrls[i], { timeout: 8000 });
      if (response.text && response.text.length < 500000) {
        cssCache.set(cssUrls[i], response.text);
      }
    } catch {}
    await delay(50);
  }
  
  console.log(`[ScanVui] Fetched ${cssCache.size} CSS files`);
  
  // Inline CSS into each page
  for (const page of crawlerState.pages) {
    let html = page.html;
    
    // Replace <link rel="stylesheet" href="..."> with <style>content</style>
    html = html.replace(/<link[^>]+rel=["']stylesheet["'][^>]*>/gi, (linkTag) => {
      const hrefMatch = linkTag.match(/href=["']([^"']+)["']/);
      if (!hrefMatch) return linkTag;
      
      try {
        const absoluteUrl = new URL(hrefMatch[1].trim(), page.url).href;
        if (cssCache.has(absoluteUrl)) {
          return `<style>/* ${hrefMatch[1]} */\n${cssCache.get(absoluteUrl)}</style>`;
        }
      } catch {}
      
      return linkTag;
    });
    
    // Also handle reverse order <link href="..." rel="stylesheet">
    html = html.replace(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']stylesheet["'][^>]*>/gi, (linkTag, href) => {
      try {
        const absoluteUrl = new URL(href.trim(), page.url).href;
        if (cssCache.has(absoluteUrl)) {
          return `<style>/* ${href} */\n${cssCache.get(absoluteUrl)}</style>`;
        }
      } catch {}
      return linkTag;
    });
    
    page.html = html;
  }
}

function getImageExtension(url) {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (pathname.includes('.png')) return 'png';
    if (pathname.includes('.gif')) return 'gif';
    if (pathname.includes('.webp')) return 'webp';
    if (pathname.includes('.svg')) return 'svg';
    if (pathname.includes('.ico')) return 'ico';
  } catch {}
  return 'jpg';
}

function processAllPages() {
  console.log(`[ScanVui] Processing ${crawlerState.pages.length} pages for link replacement`);
  
  // Build comprehensive URL to filename mapping
  const urlToFile = new Map();
  
  for (const page of crawlerState.pages) {
    const url = page.url;
    const filename = page.filename;
    
    // Add multiple variations of the URL
    urlToFile.set(url, filename);
    urlToFile.set(url.toLowerCase(), filename);
    
    // Without trailing slash
    if (url.endsWith('/')) {
      urlToFile.set(url.slice(0, -1), filename);
    } else {
      urlToFile.set(url + '/', filename);
    }
    
    // Just pathname
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      if (pathname && pathname !== '/') {
        urlToFile.set(pathname, filename);
        // Without trailing slash
        if (pathname.endsWith('/')) {
          urlToFile.set(pathname.slice(0, -1), filename);
        } else {
          urlToFile.set(pathname + '/', filename);
        }
      }
      
      // Pathname with query
      if (urlObj.search) {
        urlToFile.set(pathname + urlObj.search, filename);
      }
      
      // Full URL without protocol
      const noProtocol = url.replace(/^https?:/, '');
      urlToFile.set(noProtocol, filename);
      
      // Just host + pathname
      urlToFile.set(urlObj.host + pathname, filename);
      
    } catch {}
  }
  
  console.log(`[ScanVui] Built ${urlToFile.size} URL variations for replacement`);
  
  // Process each page
  for (const page of crawlerState.pages) {
    let html = page.html;
    let replacements = 0;
    
    // Replace image URLs with local paths
    for (const [imageUrl, filename] of crawlerState.downloadedImages) {
      const before = html.length;
      html = replaceAllSafe(html, imageUrl, filename);
      if (html.length !== before) replacements++;
      
      // Also try protocol-relative
      try {
        const protoRelative = imageUrl.replace(/^https?:/, '');
        html = replaceAllSafe(html, protoRelative, filename);
      } catch {}
    }
    
    // Replace all href attributes using regex for better matching
    html = html.replace(/href\s*=\s*["']([^"']+)["']/gi, (match, href) => {
      // Skip anchors, javascript, mailto, tel
      if (href.startsWith('#') || href.startsWith('javascript:') || 
          href.startsWith('mailto:') || href.startsWith('tel:') ||
          href.startsWith('data:')) {
        return match;
      }
      
      // Try to find matching file
      let targetFile = null;
      
      // Direct match
      if (urlToFile.has(href)) {
        targetFile = urlToFile.get(href);
      }
      
      // Try lowercase
      if (!targetFile && urlToFile.has(href.toLowerCase())) {
        targetFile = urlToFile.get(href.toLowerCase());
      }
      
      // Try to resolve as absolute URL and match
      if (!targetFile) {
        try {
          const absoluteUrl = new URL(href, page.url).href;
          if (urlToFile.has(absoluteUrl)) {
            targetFile = urlToFile.get(absoluteUrl);
          }
          
          // Try without query string
          if (!targetFile) {
            const noQuery = absoluteUrl.split('?')[0].split('#')[0];
            if (urlToFile.has(noQuery)) {
              targetFile = urlToFile.get(noQuery);
            }
          }
          
          // Try just pathname
          if (!targetFile) {
            const urlObj = new URL(absoluteUrl);
            if (urlToFile.has(urlObj.pathname)) {
              targetFile = urlToFile.get(urlObj.pathname);
            }
          }
        } catch {}
      }
      
      if (targetFile) {
        replacements++;
        return `href="${targetFile}"`;
      }
      
      return match;
    });
    
    // Also replace src attributes for any resources
    html = html.replace(/src\s*=\s*["']([^"']+)["']/gi, (match, src) => {
      if (src.startsWith('data:')) return match;
      
      // Check if it's an image we downloaded
      if (crawlerState.downloadedImages.has(src)) {
        return `src="${crawlerState.downloadedImages.get(src)}"`;
      }
      
      // Try absolute URL
      try {
        const absoluteUrl = new URL(src, page.url).href;
        if (crawlerState.downloadedImages.has(absoluteUrl)) {
          return `src="${crawlerState.downloadedImages.get(absoluteUrl)}"`;
        }
      } catch {}
      
      return match;
    });
    
    // Remove problematic scripts (tracking, analytics, external) but keep basic structure
    // Remove all script tags - content is already "baked" with unhidden state
    html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    
    // Inject lightweight offline toggle script (for any remaining interactive elements)
    const offlineScript = `
<script>
(function(){
  // Toggle click handler for interactive elements
  document.addEventListener('click', function(e) {
    // Handle <details>/<summary> natively
    var summary = e.target.closest('summary');
    if (summary) return; // Let browser handle natively
    
    // Handle toggle buttons
    var t = e.target.closest('[data-toggle],[data-bs-toggle],[role="tab"],[role="button"],.accordion-header,.accordion-button,.collapsible,.toggle-btn,.expandable');
    if (!t) return;
    
    e.preventDefault();
    
    // Find target panel
    var targetSel = t.getAttribute('data-target') || t.getAttribute('data-bs-target') || t.getAttribute('aria-controls');
    var href = t.getAttribute('href');
    if (!targetSel && href && href.startsWith('#')) targetSel = href;
    
    var panel = null;
    if (targetSel) {
      try { panel = document.querySelector(targetSel.startsWith('#') ? targetSel : '#' + targetSel); } catch(ex){}
    }
    if (!panel) panel = t.nextElementSibling;
    if (!panel) return;
    
    var isHidden = panel.style.display === 'none' || getComputedStyle(panel).display === 'none';
    panel.style.display = isHidden ? 'block' : 'none';
    t.setAttribute('aria-expanded', String(isHidden));
    t.classList.toggle('collapsed', !isHidden);
  });
})();
</script>`;
    
    // Insert before </body> or at end
    if (html.includes('</body>')) {
      html = html.replace('</body>', offlineScript + '</body>');
    } else {
      html += offlineScript;
    }
    
    // Ensure UTF-8 charset meta tag exists
    if (!html.match(/<meta[^>]+charset/i)) {
      html = html.replace(/<head/i, '<head>\n<meta charset="utf-8">');
    }
    
    // Inject auto-fix CSS for clean offline viewing
    const fixCss = `
<style id="scanvui-offline-fix">
/* ScanVui Offline Layout Fix */
[data-scanvui-keep-hidden] { display: none !important; }
body { overflow-x: hidden; }
/* Hide sidebars, drawers, overlays that may overlap content */
[class*="sidebar"][style*="position: fixed"],
[class*="sidebar"][style*="position: absolute"],
[class*="drawer"], [class*="offcanvas"], [class*="off-canvas"],
[class*="nav-overlay"], [class*="slide-menu"],
.modal-backdrop, .overlay, [class*="backdrop"] {
  display: none !important;
}
/* Reset main content to full width */
main, [role="main"], [class*="main-content"], [class*="page-content"] {
  margin-left: 0 !important;
  margin-right: 0 !important;
  padding-left: 16px !important;
  padding-right: 16px !important;
  width: 100% !important;
  max-width: 100% !important;
  transform: none !important;
}
/* Reset fixed headers/footers to relative */
header[style*="position: fixed"], header[style*="position: sticky"],
[class*="navbar"][style*="position: fixed"],
footer[style*="position: fixed"] {
  position: relative !important;
}
/* Ensure body is not locked (from modal open state) */
body.modal-open, body.overflow-hidden, body[style*="overflow: hidden"] {
  overflow: auto !important;
  padding-right: 0 !important;
}
/* Reset any transform on body */
body[style*="transform"] { transform: none !important; }
</style>`;
    
    // Insert fix CSS into <head>
    if (html.includes('</head>')) {
      html = html.replace('</head>', fixCss + '</head>');
    } else if (html.includes('<body')) {
      html = html.replace(/<body/i, fixCss + '<body');
    }
    
    // Add base tag to help with relative resources (optional)
    // html = html.replace(/<head>/i, '<head><base href="./">');
    
    page.processedHtml = html;
    console.log(`[ScanVui] Processed ${page.filename}: ${replacements} replacements`);
  }
}

function replaceAllSafe(str, find, replace) {
  if (!find || find.length < 3) return str;
  try {
    return str.split(find).join(replace);
  } catch {
    return str;
  }
}

async function downloadAllFiles() {
  const folderName = crawlerState.folderName;
  const totalPages = crawlerState.pages.length;
  const totalImages = crawlerState.pendingImages.length;
  let pagesDownloaded = 0;
  let imagesDownloaded = 0;
  
  console.log(`[ScanVui] === DOWNLOAD START ===`);
  console.log(`[ScanVui] Folder: ${folderName}, Pages: ${totalPages}, Images: ${totalImages}`);
  
  if (totalPages === 0) {
    console.error(`[ScanVui] ERROR: No pages!`);
    return;
  }
  
  // Download HTML pages
  for (let i = 0; i < crawlerState.pages.length; i++) {
    if (crawlerAbortController?.signal?.aborted) break;
    
    const page = crawlerState.pages[i];
    const html = page.processedHtml || page.html;
    const filename = `${folderName}/${page.filename}`;
    
    const sizeKB = Math.round(html.length / 1024);
    console.log(`[ScanVui] Page ${i+1}/${totalPages}: ${page.filename} (${sizeKB}KB)`);
    
    try {
      // Convert to UTF-8 bytes then base64
      const utf8Bytes = new TextEncoder().encode(html);
      const base64 = arrayBufferToBase64(utf8Bytes);
      const dataUrl = `data:text/html;charset=utf-8;base64,${base64}`;
      
      console.log(`[ScanVui] DataURL length: ${dataUrl.length}`);
      
      const downloadId = await downloadPromise(dataUrl, filename);
      pagesDownloaded++;
      console.log(`[ScanVui] OK: ${page.filename} (ID: ${downloadId})`);
      
    } catch (e) {
      console.error(`[ScanVui] FAIL: ${page.filename}: ${e.message}`);
    }
    
    updateProgress(`Trang ${i+1}/${totalPages}`, 85 + (i / totalPages) * 8);
    await delay(200);
  }
  
  console.log(`[ScanVui] === PAGES: ${pagesDownloaded}/${totalPages} ===`);
  
  // Download images
  for (let i = 0; i < crawlerState.pendingImages.length; i++) {
    if (crawlerAbortController?.signal?.aborted) break;
    
    const img = crawlerState.pendingImages[i];
    
    try {
      const response = await fetchUrlWithRetry(img.url, { responseType: 'base64', timeout: 8000 });
      
      if (response.base64 && response.size < 3 * 1024 * 1024) {
        const mimeType = response.contentType || 'image/jpeg';
        const dataUrl = `data:${mimeType};base64,${response.base64}`;
        
        await downloadPromise(dataUrl, `${folderName}/${img.filename}`);
        imagesDownloaded++;
        crawlerState.imageCount = imagesDownloaded;
      }
    } catch (e) {}
    
    if (i % 10 === 0) {
      updateProgress(`Ảnh ${i+1}/${totalImages}`, 93 + (i / totalImages) * 6);
    }
    await delay(50);
  }
  
  console.log(`[ScanVui] === IMAGES: ${imagesDownloaded}/${totalImages} ===`);
  console.log(`[ScanVui] === COMPLETE ===`);
  
  crawlerState.pendingImages = [];
  crawlerState.imageCount = imagesDownloaded;
}

// Convert ArrayBuffer/Uint8Array to base64
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const chunkSize = 8192;
  
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, chunk);
  }
  
  return btoa(binary);
}

function downloadPromise(url, filename) {
  return new Promise((resolve, reject) => {
    chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: false,
      conflictAction: 'uniquify'
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (downloadId === undefined) {
        reject(new Error('No ID'));
      } else {
        resolve(downloadId);
      }
    });
  });
}

function sanitizeFolderName(hostname) {
  return hostname
    .replace(/^www\./, '')
    .replace(/[^a-z0-9.-]/gi, '_')
    .replace(/_+/g, '_')
    .substring(0, 40);
}

function generateUniqueFilename(url, index, usedFilenames) {
  let path;
  try {
    const urlObj = new URL(url);
    path = urlObj.pathname.replace(/^\/|\/$/g, '') || `page_${index}`;
    path = path.replace(/\//g, '_').replace(/[^a-z0-9_.-]/gi, '_').replace(/_+/g, '_');
    
    if (!path.endsWith('.html') && !path.endsWith('.htm')) {
      path += '.html';
    }
    
    if (path.length > 60) {
      path = path.substring(0, 50) + '.html';
    }
  } catch {
    path = `page_${index}.html`;
  }
  
  // Ensure unique (with limit to prevent infinite loop)
  let finalPath = path;
  let counter = 1;
  const maxAttempts = 100;
  
  while (usedFilenames.has(finalPath) && counter < maxAttempts) {
    const base = path.replace(/\.html?$/, '');
    finalPath = `${base}_${counter}.html`;
    counter++;
  }
  
  if (counter >= maxAttempts) {
    finalPath = `page_${index}_${Date.now()}.html`;
  }
  
  usedFilenames.add(finalPath);
  return finalPath;
}

function normalizeUrl(url) {
  try {
    const urlObj = new URL(url);
    urlObj.hash = '';
    
    // Remove tracking params
    const params = new URLSearchParams(urlObj.search);
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 
     'fbclid', 'gclid', 'ref', 'source'].forEach(p => params.delete(p));
    urlObj.search = params.toString();
    
    // Normalize trailing slash
    if (urlObj.pathname !== '/' && urlObj.pathname.endsWith('/')) {
      urlObj.pathname = urlObj.pathname.slice(0, -1);
    }
    
    return urlObj.href.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function updateProgress(label, percent) {
  if (!crawlerState) return;
  crawlerState.progressLabel = label;
  crawlerState.progress = Math.round(percent);
  saveCrawlerState().catch(() => {});
}

async function saveCrawlerState() {
  if (!crawlerState) return;
  
  try {
    await chrome.storage.local.set({
      crawlerStatus: {
        status: crawlerState.status,
        folderName: crawlerState.folderName,
        baseHost: crawlerState.baseHost,
        startUrl: crawlerState.startUrl,
        pageCount: crawlerState.pageCount,
        imageCount: crawlerState.imageCount,
        currentUrl: crawlerState.currentUrl,
        progress: crawlerState.progress,
        progressLabel: crawlerState.progressLabel,
        startTime: crawlerState.startTime,
        error: crawlerState.error
      }
    });
  } catch {}
}

function getCrawlerStatus() {
  if (!crawlerState) return { status: 'idle' };
  
  return {
    status: crawlerState.status,
    folderName: crawlerState.folderName,
    startUrl: crawlerState.startUrl,
    pageCount: crawlerState.pageCount,
    imageCount: crawlerState.imageCount,
    currentUrl: crawlerState.currentUrl,
    progress: crawlerState.progress,
    progressLabel: crawlerState.progressLabel,
    error: crawlerState.error
  };
}

function stopCrawler() {
  if (crawlerAbortController) {
    crawlerAbortController.abort();
  }
  if (crawlerState && crawlerState.status === 'running') {
    crawlerState.status = 'stopped';
    crawlerState.progressLabel = 'Đã dừng';
    saveCrawlerState();
    // Close crawler tab if it exists
    if (crawlerState.crawlerTabId) {
      chrome.tabs.remove(crawlerState.crawlerTabId).catch(() => {});
      crawlerState.crawlerTabId = null;
    }
  }
  stopKeepAlive();
}

function showNotification(title, message) {
  try {
    chrome.notifications.create(`scanvui-${Date.now()}`, {
      type: 'basic',
      iconUrl: '/icons/icon128.png',
      title,
      message
    });
  } catch {}
}

// ============================================
// FETCH UTILITIES
// ============================================

async function fetchUrlWithRetry(url, options = {}) {
  const timeout = options.timeout || 15000;
  const maxRetries = 2;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        credentials: 'include',
        signal: controller.signal,
        headers: {
          'Accept': options.responseType === 'base64' 
            ? 'image/*,*/*;q=0.8'
            : 'text/html,application/xhtml+xml,*/*;q=0.8'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentType = response.headers.get('Content-Type') || '';

      if (options.responseType === 'base64') {
        const blob = await response.blob();
        if (blob.size > 5 * 1024 * 1024) throw new Error('Too large');
        const base64 = await blobToBase64(blob);
        return { base64: base64.split(',')[1], contentType, size: blob.size };
      } else {
        const text = await response.text();
        return { text, contentType, size: text.length };
      }
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;
      if (attempt < maxRetries && err.name !== 'AbortError') {
        await delay(300 * attempt);
      }
    }
  }

  throw lastError || new Error('Fetch failed');
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
