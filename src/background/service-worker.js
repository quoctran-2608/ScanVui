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
      func: () => document.documentElement.outerHTML
    });
    return results?.[0]?.result || null;
  } catch (e) {
    console.error('getPageHtmlFromTab error:', e);
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
      // Timeout - try to get whatever HTML is available
      getPageHtmlFromTab(tabId).then(html => {
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
        // Small delay to let JS render
        setTimeout(async () => {
          try {
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
    
    // Remove scripts to avoid errors offline
    html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    
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
