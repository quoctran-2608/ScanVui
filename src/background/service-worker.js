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

    // Re-capture main page on crawler tab with autoFixOverlap
    try {
      updateProgress('Đang tối ưu trang chính...', 8);
      const fixedMain = await getPageHtmlViaTab(crawlerState.crawlerTabId, startUrl, 15000);
      if (fixedMain && fixedMain.html) {
        crawlerState.pages[0].html = fixedMain.html;
        console.log('[ScanVui] Main page re-captured with autoFixOverlap');
      }
    } catch (e) {
      console.log('[ScanVui] Main page autoFix skipped:', e.message);
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

    // Step 4: Process HTML (replace URLs)
    updateProgress('Đang xử lý HTML...', 82);
    processAllPages();
    console.log(`[ScanVui] Processed HTML for ${crawlerState.pages.length} pages`);

    // Step 5: Download everything
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
      func: () => {
        // Expand/unhide all hidden content before capturing
        // 1. Remove hidden attribute
        document.querySelectorAll('[hidden]').forEach(el => el.removeAttribute('hidden'));
        
        // 2. Force show elements with display:none or visibility:hidden (content containers only)
        document.querySelectorAll('*').forEach(el => {
          const style = getComputedStyle(el);
          const tag = el.tagName.toLowerCase();
          // Skip script, style, meta elements
          if (['script', 'style', 'link', 'meta', 'head', 'noscript'].includes(tag)) return;
          // Only unhide elements that look like content containers
          if (style.display === 'none' && el.children.length >= 0) {
            // Check if this is a content panel (not a popup/modal/overlay)
            const classes = el.className.toLowerCase();
            const id = (el.id || '').toLowerCase();
            const isContentPanel = /panel|content|body|text|detail|answer|collapse|accordion|tab-pane|section/
              .test(classes + ' ' + id);
            const isDropdown = /dropdown|menu|popup|modal|overlay|tooltip|popover|lightbox|dialog|backdrop/
              .test(classes + ' ' + id);
            if (isContentPanel || (!isDropdown && el.textContent.trim().length > 20)) {
              el.style.display = '';
              el.style.setProperty('display', 'block', 'important');
            }
          }
          if (style.visibility === 'hidden') {
            el.style.setProperty('visibility', 'visible', 'important');
          }
          // 3. Expand collapsed height (max-height: 0)
          if (style.maxHeight === '0px' || style.maxHeight === '0') {
            el.style.setProperty('max-height', 'none', 'important');
          }
          if (style.overflow === 'hidden' && style.maxHeight !== 'none' && parseInt(style.maxHeight) < 50) {
            el.style.setProperty('max-height', 'none', 'important');
            el.style.setProperty('overflow', 'visible', 'important');
          }
        });
        
        // 4. Expand <details> elements
        document.querySelectorAll('details').forEach(d => d.setAttribute('open', ''));
        
        // 5. Mark aria-expanded as true, aria-hidden as false
        document.querySelectorAll('[aria-expanded="false"]').forEach(el => el.setAttribute('aria-expanded', 'true'));
        document.querySelectorAll('[aria-hidden="true"]').forEach(el => {
          const classes = el.className.toLowerCase();
          if (!/modal|overlay|backdrop|popup|lightbox|dialog/.test(classes)) {
            el.setAttribute('aria-hidden', 'false');
            el.style.setProperty('display', 'block', 'important');
          }
        });
        
        // 6. Expand Bootstrap/Tailwind collapse
        document.querySelectorAll('.collapse:not(.show), .collapsed').forEach(el => {
          el.classList.add('show');
          el.classList.remove('collapsed', 'collapse');
          el.style.setProperty('display', 'block', 'important');
          el.style.setProperty('height', 'auto', 'important');
        });
        
        return document.documentElement.outerHTML;
      }
    });
    return results?.[0]?.result || null;
  } catch (e) {
    console.error('getPageHtmlFromTab error:', e);
    return null;
  }
}

async function autoFixOverlap(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        try {
          let fixCount = 0;

          // Collect all "blocking" elements: fixed, sticky, absolute with z-index
          const blockers = [];
          const allEls = document.querySelectorAll('*');
          for (const el of allEls) {
            if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'LINK' ||
                el.tagName === 'META' || el.tagName === 'HEAD' || el.tagName === 'BR' ||
                el.tagName === 'HR' || el.tagName === 'NOSCRIPT') continue;
            if (el.id === 'scanvui-toolbar' || el.closest('#scanvui-toolbar')) continue;
            try {
              const cs = getComputedStyle(el);
              const pos = cs.position;
              if (pos !== 'fixed' && pos !== 'sticky' && pos !== 'absolute') continue;
              const z = parseInt(cs.zIndex) || 0;
              const rect = el.getBoundingClientRect();
              if (rect.width === 0 || rect.height === 0) continue;
              blockers.push({ el, pos, z, rect, cs });
            } catch {}
          }

          // Collect text-containing elements (potential victims)
          const textSelectors = 'p, h1, h2, h3, h4, h5, h6, li, td, th, dt, dd, blockquote, figcaption, label, span, a';
          const textEls = document.querySelectorAll(textSelectors);
          const victims = [];
          for (const el of textEls) {
            const text = el.textContent?.trim();
            if (!text || text.length < 3) continue;
            if (el.closest('#scanvui-toolbar')) continue;
            try {
              const rect = el.getBoundingClientRect();
              if (rect.width === 0 || rect.height === 0) continue;
              const cs = getComputedStyle(el);
              if (cs.display === 'none' || cs.visibility === 'hidden') continue;
              victims.push({ el, rect });
            } catch {}
          }

          // Helper: check if two rects overlap
          function rectsOverlap(a, b) {
            return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
          }

          // Helper: overlap area
          function overlapArea(a, b) {
            const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
            const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
            return x * y;
          }

          // Track which blockers are actually overlapping text
          const blockerFixMap = new Map();

          for (const blocker of blockers) {
            let overlappedTextCount = 0;
            let totalOverlapArea = 0;

            for (const victim of victims) {
              if (blocker.el.contains(victim.el) || victim.el.contains(blocker.el)) continue;
              if (!rectsOverlap(blocker.rect, victim.rect)) continue;

              // Check z-index: blocker must visually be on top
              const victimZ = parseInt(getComputedStyle(victim.el).zIndex) || 0;
              if (blocker.z <= victimZ && blocker.pos !== 'fixed' && blocker.pos !== 'sticky') continue;

              const area = overlapArea(blocker.rect, victim.rect);
              const victimArea = victim.rect.width * victim.rect.height;
              // Only count if significant overlap (>20% of text element)
              if (victimArea > 0 && (area / victimArea) > 0.2) {
                overlappedTextCount++;
                totalOverlapArea += area;
              }
            }

            if (overlappedTextCount > 0) {
              blockerFixMap.set(blocker, { overlappedTextCount, totalOverlapArea });
            }
          }

          // Apply fixes to each problematic blocker
          for (const [blocker, info] of blockerFixMap) {
            const el = blocker.el;
            const tag = el.tagName.toLowerCase();
            const cls = (typeof el.className === 'string' ? el.className : '').toLowerCase();
            const id = (el.id || '').toLowerCase();
            const combined = tag + ' ' + cls + ' ' + id;
            const w = blocker.rect.width;
            const h = blocker.rect.height;
            const viewW = window.innerWidth;
            const viewH = window.innerHeight;

            // Classify the blocker type
            const isCookieBanner = /cookie|consent|gdpr|privacy|notice|accept/i.test(combined);
            const isChatWidget = /chat|intercom|drift|crisp|tawk|zendesk|messenger|livechat|hubspot/i.test(combined);
            const isAdBanner = /^(ins|amp-ad)$/.test(tag) || /adsbygoogle|ad-container|ad-wrapper|banner-ad|advertisement/i.test(combined);
            const isOverlay = /overlay|backdrop|modal-backdrop|lightbox-bg/i.test(combined);
            const isNav = tag === 'nav' || /nav|menu|sidebar|sidenav|drawer/i.test(combined);
            const isHeader = tag === 'header' || /header|topbar|navbar|app-bar/i.test(combined);
            const isFooter = tag === 'footer' || /footer|bottom-bar/i.test(combined);
            const isFloatingBtn = (w < 80 && h < 80) || /fab|float|scroll-top|back-to-top|goto-top/i.test(combined);

            try {
              if (isCookieBanner || isChatWidget || isAdBanner || isOverlay || isFloatingBtn) {
                // Remove completely - not part of content
                el.style.setProperty('display', 'none', 'important');
                fixCount++;
              } else if (isNav && blocker.pos === 'fixed') {
                // Fixed sidebar/nav: hide it, content will expand
                el.style.setProperty('display', 'none', 'important');
                fixCount++;
              } else if (isHeader) {
                // Fixed/sticky header: make relative so it scrolls with page
                el.style.setProperty('position', 'relative', 'important');
                el.style.setProperty('z-index', 'auto', 'important');
                // Also fix children with position:fixed
                el.querySelectorAll('*').forEach(child => {
                  try {
                    const childCs = getComputedStyle(child);
                    if (childCs.position === 'fixed' || childCs.position === 'sticky') {
                      child.style.setProperty('position', 'relative', 'important');
                      child.style.setProperty('z-index', 'auto', 'important');
                    }
                  } catch {}
                });
                fixCount++;
              } else if (isFooter && blocker.pos === 'fixed') {
                el.style.setProperty('position', 'relative', 'important');
                fixCount++;
              } else {
                // Generic blocker: decide based on size
                const blockerArea = w * h;
                const screenArea = viewW * viewH;
                if (blockerArea > screenArea * 0.5) {
                  // Full-screen overlay -> hide
                  el.style.setProperty('display', 'none', 'important');
                } else if (w < 350 && blocker.pos === 'fixed') {
                  // Narrow fixed element (sidebar-like) -> hide
                  el.style.setProperty('display', 'none', 'important');
                } else if (h < 100 && w > viewW * 0.5 && blocker.pos === 'fixed') {
                  // Wide short fixed bar (header/banner-like) -> make relative
                  el.style.setProperty('position', 'relative', 'important');
                  el.style.setProperty('z-index', 'auto', 'important');
                } else {
                  // Other: lower z-index and make relative
                  el.style.setProperty('position', 'relative', 'important');
                  el.style.setProperty('z-index', 'auto', 'important');
                }
                fixCount++;
              }
            } catch {}
          }

          // After removing fixed sidebars/navs, reset main content margins
          if (fixCount > 0) {
            document.querySelectorAll('main, [role="main"], [class*="main-content"], [class*="page-content"], #content, .content, [class*="wrapper"], [class*="container"]').forEach(el => {
              try {
                const cs = getComputedStyle(el);
                const ml = parseInt(cs.marginLeft) || 0;
                const pl = parseInt(cs.paddingLeft) || 0;
                // Only reset if there's suspicious left offset (from sidebar)
                if (ml > 200 || pl > 200) {
                  el.style.setProperty('margin-left', '0', 'important');
                  el.style.setProperty('padding-left', '16px', 'important');
                  el.style.setProperty('width', '100%', 'important');
                  el.style.setProperty('max-width', '100%', 'important');
                }
              } catch {}
            });
            // Unlock body scroll if locked
            document.body.style.setProperty('overflow', 'auto', 'important');
            document.body.style.setProperty('position', 'static', 'important');
          }

          return fixCount;
        } catch (e) {
          return -1;
        }
      }
    });
    const fixCount = results?.[0]?.result ?? 0;
    if (fixCount > 0) {
      console.log(`[ScanVui] autoFixOverlap: fixed ${fixCount} blocking elements`);
    }
    return fixCount;
  } catch (e) {
    console.error('[ScanVui] autoFixOverlap error:', e);
    return 0;
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

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      if (listener) chrome.tabs.onUpdated.removeListener(listener);
    };

    const settle = (value, error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve(value);
    };

    timer = setTimeout(() => {
      // Timeout - try to fix overlaps and get whatever HTML is available
      autoFixOverlap(tabId).then(() => {
        return getPageHtmlFromTab(tabId);
      }).then(html => {
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
      if (updatedTabId !== tabId) return;
      if (changeInfo.status === 'complete') {
        // Small delay to let JS render, then fix overlaps, then capture
        setTimeout(async () => {
          try {
            await autoFixOverlap(tabId);
            const html = await getPageHtmlFromTab(tabId);
            const title = await getPageTitle(tabId);
            settle({ html, title });
          } catch (e) {
            settle(null, e);
          }
        }, 500);
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
document.addEventListener('click', function(e) {
  var t = e.target.closest('[data-toggle],[data-bs-toggle],summary,.accordion-header,.collapsible,.toggle-btn,[role="tab"],[role="button"]');
  if (!t) return;
  var target = t.getAttribute('data-target') || t.getAttribute('data-bs-target') || t.getAttribute('href');
  if (target && target.startsWith('#')) {
    var panel = document.querySelector(target);
    if (panel) {
      var isHidden = panel.style.display === 'none' || !panel.offsetHeight;
      panel.style.display = isHidden ? 'block' : 'none';
      t.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
    }
  }
  var next = t.nextElementSibling;
  if (next && next.children.length > 0) {
    var isHidden = next.style.display === 'none' || !next.offsetHeight;
    next.style.display = isHidden ? 'block' : 'none';
  }
});
</script>`;

    // Inject ScanVui Visual Editor
    const elementRemoverScript = `
<style id="scanvui-editor-css">
#sve{position:fixed;bottom:0;left:0;right:0;z-index:2147483647;font-family:system-ui,-apple-system,sans-serif;font-size:12px;background:#1a1a2e;color:#e0e0e0;box-shadow:0 -4px 24px rgba(0,0,0,.5);user-select:none}
#sve *{box-sizing:border-box}
#sve .sve-row{display:flex;align-items:center;gap:4px;padding:5px 10px;flex-wrap:wrap}
#sve .sve-r2{border-top:1px solid #2d2d50;min-height:34px;display:none}
#sve .sve-r2.show{display:flex}
#sve button{border:none;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:11px;font-weight:600;color:#e0e0e0;background:#2d2d50;transition:all .12s;white-space:nowrap}
#sve button:hover{background:#3d3d70}
#sve button.active{background:#6366f1;color:#fff}
#sve button.sv-del{background:#e94560}#sve button.sv-del:hover{background:#ff6b81}
#sve button.sv-save{background:#00b894}#sve button.sv-save:hover{background:#55efc4;color:#333}
#sve button.sv-saveas{background:#0984e3}#sve button.sv-saveas:hover{background:#74b9ff}
#sve .sve-brand{font-weight:700;color:#00d2ff;font-size:13px;margin-right:6px}
#sve .sve-sep{width:1px;height:20px;background:#3d3d60;margin:0 4px}
#sve .sve-info{color:#a0a0c0;font-size:11px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#sve .sve-close{background:none;color:#888;font-size:15px;padding:2px 6px;margin-left:auto}#sve .sve-close:hover{color:#fff}
#sve .sve-prop{display:flex;align-items:center;gap:3px;margin-right:8px}
#sve .sve-prop label{color:#a0a0c0;font-size:10px;min-width:18px}
#sve .sve-prop input[type=number]{width:52px;padding:2px 4px;border:1px solid #3d3d60;border-radius:3px;background:#12122a;color:#e0e0e0;font-size:11px}
#sve .sve-prop input[type=color]{width:24px;height:22px;padding:0;border:1px solid #3d3d60;border-radius:3px;cursor:pointer;background:none}
#sve .sve-prop select{padding:2px 4px;border:1px solid #3d3d60;border-radius:3px;background:#12122a;color:#e0e0e0;font-size:11px}
#sve .sve-prop input[type=range]{width:60px;height:14px;cursor:pointer}
.sve-outline{outline:2px dashed #6366f1!important;outline-offset:-2px}
.sve-selected{outline:2px solid #e94560!important;outline-offset:-1px}
.sve-hidden-by-editor{opacity:.25!important;outline:2px dashed #f59e0b!important}
.sve-handle{position:absolute;width:8px;height:8px;background:#e94560;border:1px solid #fff;z-index:2147483646;pointer-events:auto}
.sve-handle-tl{cursor:nw-resize}.sve-handle-tc{cursor:n-resize}.sve-handle-tr{cursor:ne-resize}
.sve-handle-ml{cursor:w-resize}.sve-handle-mr{cursor:e-resize}
.sve-handle-bl{cursor:sw-resize}.sve-handle-bc{cursor:s-resize}.sve-handle-br{cursor:se-resize}
.sve-moving{cursor:move!important}
.sve-editing{outline:2px solid #00b894!important;min-height:1em}
</style>
<div id="sve">
<div class="sve-row">
<span class="sve-brand">ScanVui Editor</span>
<div class="sve-sep"></div>
<button id="sveSelect" class="active" title="Chon phan tu (S)">&#9654; Chon</button>
<button id="sveMove" title="Di chuyen (M)">&#9995; Di chuyen</button>
<button id="sveResize" title="Thay doi kich thuoc (R)">&#10697; Resize</button>
<div class="sve-sep"></div>
<button id="sveDel" class="sv-del" title="Xoa phan tu (Delete)">&#128465; Xoa</button>
<button id="sveHide" title="An/hien phan tu (H)">&#128065; An</button>
<button id="sveEdit" title="Sua text (double-click) (E)">&#9998; Sua text</button>
<div class="sve-sep"></div>
<button id="sveUndo" title="Hoan tac (Ctrl+Z)">&#8630; Undo</button>
<button id="sveRedo" title="Lam lai (Ctrl+Shift+Z)">&#8631; Redo</button>
<span class="sve-info" id="sveInfo">Click phan tu de chon</span>
<div class="sve-sep"></div>
<button id="sveSave" class="sv-save" title="Luu file goc">&#128190; Luu</button>
<button id="sveSaveAs" class="sv-saveas" title="Luu file moi">&#128196; Luu moi</button>
<button id="sveClose" class="sve-close" title="Dong editor">&#10005;</button>
</div>
<div class="sve-r2" id="sveProps">
<div class="sve-prop"><label>W</label><input type="number" id="svePW" min="0" step="1"></div>
<div class="sve-prop"><label>H</label><input type="number" id="svePH" min="0" step="1"></div>
<div class="sve-prop"><label>Z</label><input type="number" id="svePZ" step="1"></div>
<div class="sve-prop"><label title="Opacity">Op</label><input type="range" id="svePO" min="0" max="1" step="0.05"></div>
<div class="sve-prop"><label title="Font size">Fs</label><input type="number" id="svePFs" min="0" step="1"></div>
<div class="sve-prop"><label title="Mau nen">Bg</label><input type="color" id="svePBg"></div>
<div class="sve-prop"><label title="Mau chu">Cl</label><input type="color" id="svePCl"></div>
<div class="sve-prop"><label>Dp</label><select id="svePDp"><option value="">--</option><option>block</option><option>flex</option><option>inline</option><option>inline-block</option><option>grid</option><option>none</option></select></div>
<div class="sve-prop"><label>Ps</label><select id="svePPs"><option value="">--</option><option>static</option><option>relative</option><option>absolute</option><option>fixed</option><option>sticky</option></select></div>
</div>
</div>
<script>
(function(){
var E=document.getElementById('sve');if(!E)return;
var mode='select',sel=null,handles=[],undoStack=[],redoStack=[],changed=false;
var $=function(id){return document.getElementById(id)};
var btnSel=$('sveSelect'),btnMov=$('sveMove'),btnRes=$('sveResize');
var btnDel=$('sveDel'),btnHide=$('sveHide'),btnEdit=$('sveEdit');
var btnUndo=$('sveUndo'),btnRedo=$('sveRedo');
var btnSave=$('sveSave'),btnSaveAs=$('sveSaveAs'),btnClose=$('sveClose');
var info=$('sveInfo'),propsRow=$('sveProps');
var pW=$('svePW'),pH=$('svePH'),pZ=$('svePZ'),pO=$('svePO');
var pFs=$('svePFs'),pBg=$('svePBg'),pCl=$('svePCl'),pDp=$('svePDp'),pPs=$('svePPs');

function isEd(el){return el&&(el.id==='sve'||el.closest('#sve')||el.classList.contains('sve-handle'))}
function desc(el){if(!el)return'';var t=el.tagName.toLowerCase(),i=el.id?'#'+el.id:'',c=typeof el.className==='string'?'.'+el.className.split(' ').filter(function(x){return x&&!x.startsWith('sve')}).slice(0,2).join('.'):'';return t+i+c}

// Mode switching
function setMode(m){mode=m;
btnSel.classList.toggle('active',m==='select');
btnMov.classList.toggle('active',m==='move');
btnRes.classList.toggle('active',m==='resize');
document.body.style.cursor=m==='move'?'move':m==='resize'?'crosshair':'';
if(m!=='resize')removeHandles();
if(m==='resize'&&sel)showHandles(sel);
}
btnSel.onclick=function(){setMode('select')};
btnMov.onclick=function(){setMode('move')};
btnRes.onclick=function(){setMode('resize')};

// Select element
function selectEl(el){
if(sel)sel.classList.remove('sve-selected');
sel=el;
if(!sel){info.textContent='Click phan tu de chon';propsRow.classList.remove('show');removeHandles();return}
sel.classList.add('sve-selected');
var r=sel.getBoundingClientRect();
info.textContent=desc(sel)+' | '+Math.round(r.width)+'x'+Math.round(r.height);
propsRow.classList.add('show');
syncProps();
if(mode==='resize')showHandles(sel);
}

// Sync property panel with selected element
function syncProps(){
if(!sel)return;
var cs=getComputedStyle(sel);
pW.value=Math.round(sel.offsetWidth);
pH.value=Math.round(sel.offsetHeight);
pZ.value=parseInt(cs.zIndex)||0;
pO.value=parseFloat(cs.opacity)||1;
pFs.value=parseInt(cs.fontSize)||14;
pBg.value=rgbToHex(cs.backgroundColor);
pCl.value=rgbToHex(cs.color);
pDp.value=cs.display;
pPs.value=cs.position;
}
function rgbToHex(rgb){if(!rgb||rgb==='transparent'||rgb.startsWith('#'))return rgb||'#ffffff';
var m=rgb.match(/\\d+/g);if(!m||m.length<3)return'#ffffff';
return'#'+((1<<24)+(+m[0]<<16)+(+m[1]<<8)+ +m[2]).toString(16).slice(1)}

// Record change for undo
function rec(el,prop,oldV,newV,type){
undoStack.push({el:el,prop:prop,oldV:oldV,newV:newV,type:type||'style'});
redoStack=[];changed=true;
}

// Apply style with undo recording
function applyStyle(prop,val){
if(!sel)return;
var old=sel.style.getPropertyValue(prop);
sel.style.setProperty(prop,val,'important');
rec(sel,prop,old,val);
syncProps();
}

// Property inputs
pW.onchange=function(){if(sel)applyStyle('width',pW.value+'px')};
pH.onchange=function(){if(sel)applyStyle('height',pH.value+'px')};
pZ.onchange=function(){if(sel)applyStyle('z-index',pZ.value)};
pO.oninput=function(){if(sel)applyStyle('opacity',pO.value)};
pFs.onchange=function(){if(sel)applyStyle('font-size',pFs.value+'px')};
pBg.oninput=function(){if(sel)applyStyle('background-color',pBg.value)};
pCl.oninput=function(){if(sel)applyStyle('color',pCl.value)};
pDp.onchange=function(){if(sel&&pDp.value)applyStyle('display',pDp.value)};
pPs.onchange=function(){if(sel&&pPs.value)applyStyle('position',pPs.value)};

// Hover outline
var hovered=null;
document.addEventListener('mouseover',function(e){
if(!mode||isEd(e.target))return;
if(hovered)hovered.classList.remove('sve-outline');
hovered=e.target;hovered.classList.add('sve-outline');
},true);
document.addEventListener('mouseout',function(e){
if(hovered)hovered.classList.remove('sve-outline');hovered=null;
},true);

// Click to select
document.addEventListener('click',function(e){
if(isEd(e.target))return;
if(!mode)return;
e.preventDefault();e.stopPropagation();
var el=e.target;
if(!el||el===document.body||el===document.documentElement)return;
el.classList.remove('sve-outline');
selectEl(el);
},true);

// === MOVE (drag & drop) ===
var moveData=null;
document.addEventListener('mousedown',function(e){
if(mode!=='move'||isEd(e.target)||!sel)return;
var el=e.target;
if(!sel.contains(el)&&el!==sel)return;
e.preventDefault();
var cs=getComputedStyle(sel);
if(cs.position==='static'){
  var oldPos=sel.style.getPropertyValue('position');
  sel.style.setProperty('position','relative','important');
  rec(sel,'position',oldPos,'relative');
}
var rect=sel.getBoundingClientRect();
moveData={startX:e.clientX,startY:e.clientY,origLeft:parseInt(sel.style.left)||0,origTop:parseInt(sel.style.top)||0,
  oldLeft:sel.style.getPropertyValue('left'),oldTop:sel.style.getPropertyValue('top')};
sel.classList.add('sve-moving');
},true);
document.addEventListener('mousemove',function(e){
if(!moveData||!sel)return;
var dx=e.clientX-moveData.startX,dy=e.clientY-moveData.startY;
sel.style.setProperty('left',(moveData.origLeft+dx)+'px','important');
sel.style.setProperty('top',(moveData.origTop+dy)+'px','important');
});
document.addEventListener('mouseup',function(){
if(!moveData||!sel)return;
sel.classList.remove('sve-moving');
rec(sel,'left',moveData.oldLeft,sel.style.getPropertyValue('left'));
rec(sel,'top',moveData.oldTop,sel.style.getPropertyValue('top'));
moveData=null;syncProps();
});

// === RESIZE (8 handles) ===
var resizeData=null;
function removeHandles(){handles.forEach(function(h){h.remove()});handles=[]}
function showHandles(el){
removeHandles();
var positions=['tl','tc','tr','ml','mr','bl','bc','br'];
positions.forEach(function(p){
  var h=document.createElement('div');
  h.className='sve-handle sve-handle-'+p;
  h.dataset.pos=p;
  document.body.appendChild(h);
  handles.push(h);
  posHandle(h,p,el);
  h.addEventListener('mousedown',function(e){startResize(e,p,el)});
});
}
function posHandle(h,p,el){
var r=el.getBoundingClientRect(),s=window.scrollY,sx=window.scrollX;
var positions={
  tl:{left:r.left+sx-4,top:r.top+s-4},tc:{left:r.left+sx+r.width/2-4,top:r.top+s-4},
  tr:{left:r.right+sx-4,top:r.top+s-4},ml:{left:r.left+sx-4,top:r.top+s+r.height/2-4},
  mr:{left:r.right+sx-4,top:r.top+s+r.height/2-4},bl:{left:r.left+sx-4,top:r.bottom+s-4},
  bc:{left:r.left+sx+r.width/2-4,top:r.bottom+s-4},br:{left:r.right+sx-4,top:r.bottom+s-4}
};
var pos=positions[p];
h.style.cssText='position:absolute;left:'+pos.left+'px;top:'+pos.top+'px;width:8px;height:8px;background:#e94560;border:1px solid #fff;z-index:2147483646;pointer-events:auto;cursor:'+getComputedStyle(h).cursor;
}
function startResize(e,pos,el){
e.preventDefault();e.stopPropagation();
var r=el.getBoundingClientRect();
resizeData={pos:pos,el:el,startX:e.clientX,startY:e.clientY,startW:r.width,startH:r.height,
  startL:parseInt(el.style.left)||0,startT:parseInt(el.style.top)||0,
  oldW:el.style.getPropertyValue('width'),oldH:el.style.getPropertyValue('height'),
  oldL:el.style.getPropertyValue('left'),oldT:el.style.getPropertyValue('top')};
}
document.addEventListener('mousemove',function(e){
if(!resizeData)return;
var d=resizeData,dx=e.clientX-d.startX,dy=e.clientY-d.startY,p=d.pos;
var nw=d.startW,nh=d.startH,nl=d.startL,nt=d.startT;
if(p.includes('r'))nw=Math.max(20,d.startW+dx);
if(p.includes('l')){nw=Math.max(20,d.startW-dx);nl=d.startL+dx}
if(p.includes('b'))nh=Math.max(20,d.startH+dy);
if(p.includes('t')){nh=Math.max(20,d.startH-dy);nt=d.startT+dy}
d.el.style.setProperty('width',nw+'px','important');
d.el.style.setProperty('height',nh+'px','important');
if(p.includes('l'))d.el.style.setProperty('left',nl+'px','important');
if(p.includes('t'))d.el.style.setProperty('top',nt+'px','important');
handles.forEach(function(h){posHandle(h,h.dataset.pos,d.el)});
});
document.addEventListener('mouseup',function(){
if(!resizeData)return;
var d=resizeData;
rec(d.el,'width',d.oldW,d.el.style.getPropertyValue('width'));
rec(d.el,'height',d.oldH,d.el.style.getPropertyValue('height'));
if(d.pos.includes('l'))rec(d.el,'left',d.oldL,d.el.style.getPropertyValue('left'));
if(d.pos.includes('t'))rec(d.el,'top',d.oldT,d.el.style.getPropertyValue('top'));
resizeData=null;syncProps();
});

// === DELETE ===
btnDel.onclick=function(){
if(!sel)return;
var el=sel,parent=el.parentNode,next=el.nextSibling;
var oldHtml=el.outerHTML;
rec(el,'__delete',{parent:parent,next:next,html:oldHtml},null,'delete');
selectEl(null);
el.remove();changed=true;
};

// === HIDE/SHOW ===
btnHide.onclick=function(){
if(!sel)return;
var isHidden=sel.classList.contains('sve-hidden-by-editor');
if(isHidden){
  sel.classList.remove('sve-hidden-by-editor');
  var old=sel.style.getPropertyValue('display');
  sel.style.removeProperty('display');
  rec(sel,'__visibility',old,'visible','visibility');
}else{
  sel.classList.add('sve-hidden-by-editor');
  rec(sel,'__visibility','visible',sel.style.getPropertyValue('display'),'visibility');
}
};

// === EDIT TEXT (double-click) ===
var editingEl=null;
btnEdit.onclick=function(){
if(!sel)return;
if(editingEl){finishEdit();return}
var old=sel.innerHTML;
sel.contentEditable='true';
sel.classList.add('sve-editing');
sel.focus();
editingEl={el:sel,oldHtml:old};
btnEdit.classList.add('active');
info.textContent='Dang sua text... Click "Sua text" de ket thuc';
};
function finishEdit(){
if(!editingEl)return;
editingEl.el.contentEditable='false';
editingEl.el.classList.remove('sve-editing');
var newHtml=editingEl.el.innerHTML;
if(newHtml!==editingEl.oldHtml){
  rec(editingEl.el,'innerHTML',editingEl.oldHtml,newHtml,'html');
  changed=true;
}
btnEdit.classList.remove('active');
editingEl=null;
if(sel)info.textContent=desc(sel);
}
document.addEventListener('dblclick',function(e){
if(isEd(e.target)||mode!=='select')return;
if(sel&&sel.contains(e.target)){
  e.preventDefault();
  btnEdit.onclick();
}
},true);

// === UNDO / REDO ===
function doUndo(){
if(!undoStack.length)return;
var a=undoStack.pop();redoStack.push(a);
if(a.type==='delete'){
  if(a.oldV&&a.oldV.parent){
    var tmp=document.createElement('div');tmp.innerHTML=a.oldV.html;
    var restored=tmp.firstChild;
    if(a.oldV.next)a.oldV.parent.insertBefore(restored,a.oldV.next);
    else a.oldV.parent.appendChild(restored);
    a.el=restored;
  }
}else if(a.type==='html'){
  a.el.innerHTML=a.oldV;
}else if(a.type==='visibility'){
  a.el.classList.remove('sve-hidden-by-editor');
  if(a.oldV)a.el.style.setProperty('display',a.oldV,'important');
  else a.el.style.removeProperty('display');
}else{
  if(a.oldV)a.el.style.setProperty(a.prop,a.oldV,'important');
  else a.el.style.removeProperty(a.prop);
}
if(sel)syncProps();
}
function doRedo(){
if(!redoStack.length)return;
var a=redoStack.pop();undoStack.push(a);
if(a.type==='delete'){a.el.remove();}
else if(a.type==='html'){a.el.innerHTML=a.newV;}
else if(a.type==='visibility'){a.el.classList.add('sve-hidden-by-editor');}
else{if(a.newV)a.el.style.setProperty(a.prop,a.newV,'important');else a.el.style.removeProperty(a.prop)}
if(sel)syncProps();
}
btnUndo.onclick=doUndo;
btnRedo.onclick=doRedo;

// === KEYBOARD SHORTCUTS ===
document.addEventListener('keydown',function(e){
if(editingEl)return;
if(e.key==='Escape'){selectEl(null);return}
if(e.key==='Delete'&&sel){btnDel.onclick();return}
if(e.key==='s'||e.key==='S'){if(!e.ctrlKey){setMode('select');e.preventDefault()}}
if(e.key==='m'||e.key==='M'){if(!e.ctrlKey){setMode('move');e.preventDefault()}}
if(e.key==='r'||e.key==='R'){if(!e.ctrlKey){setMode('resize');e.preventDefault()}}
if(e.key==='h'||e.key==='H'){if(!e.ctrlKey&&sel){btnHide.onclick();e.preventDefault()}}
if(e.key==='e'||e.key==='E'){if(!e.ctrlKey&&sel){btnEdit.onclick();e.preventDefault()}}
if(e.key==='z'&&e.ctrlKey&&!e.shiftKey){doUndo();e.preventDefault()}
if(e.key==='z'&&e.ctrlKey&&e.shiftKey){doRedo();e.preventDefault()}
if(e.key==='Z'&&e.ctrlKey){doRedo();e.preventDefault()}
});

// === SAVE ===
function getCleanHtml(){
if(editingEl)finishEdit();
selectEl(null);removeHandles();
E.style.display='none';
var css=document.getElementById('scanvui-editor-css');
var cssHtml=css?css.outerHTML:'';
if(css)css.remove();
document.querySelectorAll('.sve-outline,.sve-selected,.sve-moving,.sve-editing,.sve-hidden-by-editor,.sve-handle').forEach(function(el){
  el.classList.remove('sve-outline','sve-selected','sve-moving','sve-editing');
  if(el.classList.contains('sve-handle'))el.remove();
  if(el.classList.contains('sve-hidden-by-editor')){el.classList.remove('sve-hidden-by-editor')}
});
document.querySelectorAll('[contenteditable]').forEach(function(el){el.removeAttribute('contenteditable')});
var html='<!DOCTYPE html>\\n'+document.documentElement.outerHTML;
document.body.appendChild(E);
E.style.display='';
if(cssHtml){var t=document.createElement('div');t.innerHTML=cssHtml;if(t.firstChild)document.head.appendChild(t.firstChild)}
return html;
}
function downloadHtml(html,fn){
var b=new Blob([html],{type:'text/html;charset=utf-8'});
var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=fn;a.click();URL.revokeObjectURL(a.href);
}
btnSave.onclick=function(){
var html=getCleanHtml();
var fn=location.pathname.split('/').pop()||'index.html';
downloadHtml(html,fn);changed=false;
};
btnSaveAs.onclick=function(){
var base=location.pathname.split('/').pop()||'page';
base=base.replace(/\\.html$/i,'');
var name=prompt('Ten file moi:',base+'_edited.html');
if(!name)return;if(!name.endsWith('.html'))name+='.html';
downloadHtml(getCleanHtml(),name);changed=false;
};
btnClose.onclick=function(){
if(changed&&!confirm('Co thay doi chua luu. Dong editor?'))return;
if(editingEl)finishEdit();selectEl(null);removeHandles();
E.remove();var css=document.getElementById('scanvui-editor-css');if(css)css.remove();
document.body.style.cursor='';
};
})();
</script>`;

    // Inject backup CSS for offline overlap fix
    const overlapFixCss = `
<style id="scanvui-overlap-fix">
/* ScanVui: backup overlap fix for offline viewing */
/* Cookie banners, chat widgets, overlays */
div[class*="cookie" i], div[class*="consent" i], div[class*="gdpr" i],
div[class*="chat-widget" i], div[class*="intercom" i], div[class*="drift" i],
div[class*="overlay" i]:not([class*="content" i]), .modal-backdrop,
div[class*="ad-container" i], div[class*="adsbygoogle" i] {
  display: none !important;
}
/* Fixed navs that are narrow (sidebars) */
nav[style*="position: fixed"], nav[style*="position:fixed"] {
  position: relative !important;
}
/* Ensure body scrollable */
body { overflow: auto !important; position: static !important; }
</style>`;
    
    // Insert fix CSS into <head>
    if (html.includes('</head>')) {
      html = html.replace('</head>', overlapFixCss + '</head>');
    }
    
    // Insert before </body> or at end
    if (html.includes('</body>')) {
      html = html.replace('</body>', offlineScript + elementRemoverScript + '</body>');
    } else {
      html += offlineScript + elementRemoverScript;
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
