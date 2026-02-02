# Get-Form-Extension - Project Plan

## 1. Tổng quan dự án

**Mục tiêu:** Xây dựng Chrome Extension đọc và phân tích giao diện web hiện tại, liệt kê chi tiết các thông tin và form fields, hoạt động với cả các trang web hiện đại sử dụng công nghệ cao.

**Tên extension:** Get-Form-Extension (hoặc Form Inspector)

---

## 2. Công nghệ & Kiến trúc

### 2.1 Chrome Extension Manifest V3

Chrome đã chuyển hoàn toàn sang Manifest V3 từ 2024-2025. Extension sẽ sử dụng:

- **Manifest V3** (bắt buộc cho Chrome mới)
- **Service Worker** thay cho background pages
- **Content Scripts** để inject code vào trang web
- **Scripting API** (`chrome.scripting`) để đăng ký script động

### 2.2 Cấu trúc Extension

```
Get-Form-Extension/
├── manifest.json           # Cấu hình extension
├── src/
│   ├── background/
│   │   └── service-worker.js    # Service worker (Manifest V3)
│   ├── content/
│   │   └── content-script.js    # Script inject vào trang web
│   ├── popup/
│   │   ├── popup.html           # UI popup
│   │   ├── popup.css            # Styles
│   │   └── popup.js             # Logic popup
│   └── utils/
│       ├── form-detector.js     # Logic detect form
│       ├── shadow-dom-walker.js # Xử lý Shadow DOM
│       └── field-analyzer.js    # Phân tích field types
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── docs/
    └── PROJECT_PLAN.md
```

---

## 3. Các thách thức kỹ thuật & Giải pháp

### 3.1 Shadow DOM (Web Components)

**Vấn đề:** Nhiều framework hiện đại (Salesforce Lightning, Angular Material, Shopify) sử dụng Shadow DOM. `document.querySelector` không thể truy cập elements bên trong shadow root.

**Giải pháp:**
```javascript
function walkShadowDOM(root, callback) {
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT,
    null,
    false
  );
  
  let node;
  while (node = walker.nextNode()) {
    callback(node);
    if (node.shadowRoot) {
      walkShadowDOM(node.shadowRoot, callback);
    }
  }
}
```

### 3.2 Dynamic Content (React, Vue, Angular)

**Vấn đề:** SPA frameworks render content động, form có thể xuất hiện sau khi page load.

**Giải pháp:**
- Sử dụng `MutationObserver` để theo dõi DOM changes
- Re-scan khi phát hiện thay đổi
- Debounce để tránh scan quá nhiều lần

```javascript
const observer = new MutationObserver((mutations) => {
  debounce(() => scanForForms(), 500);
});
observer.observe(document.body, { childList: true, subtree: true });
```

### 3.3 iFrame Content

**Vấn đề:** Form có thể nằm trong iframes, bị chặn bởi same-origin policy.

**Giải pháp:**
- Same-origin iframes: Truy cập trực tiếp `iframe.contentDocument`
- Cross-origin iframes: Chỉ báo cáo sự hiện diện, không thể access content

### 3.4 Custom Form Elements

**Vấn đề:** Nhiều trang sử dụng `div[contenteditable]`, custom dropdowns, hoặc ARIA-enabled elements thay vì native form elements.

**Giải pháp:** Detect theo nhiều tiêu chí:
- Native: `input`, `select`, `textarea`, `button`
- ARIA: `[role="textbox"]`, `[role="combobox"]`, `[role="listbox"]`
- Custom: `[contenteditable="true"]`, `data-*` attributes

---

## 4. Features chính

### 4.1 Form Detection
- Detect tất cả `<form>` elements
- Detect orphan inputs (không trong form)
- Detect custom form implementations

### 4.2 Field Analysis
Cho mỗi field, thu thập:
| Thông tin | Mô tả |
|-----------|-------|
| Type | input type (text, email, password, etc.) |
| Name/ID | identifier |
| Label | Associated label text |
| Placeholder | Placeholder text |
| Required | Bắt buộc hay không |
| Validation | Pattern, min/max, etc. |
| ARIA | aria-label, aria-describedby |
| Current Value | Giá trị hiện tại (mask sensitive) |

### 4.3 Page Structure Analysis
- Headings hierarchy (H1-H6)
- Links count
- Images count
- Tables
- Buttons

### 4.4 Export Options
- Copy to clipboard (JSON/Text)
- Download as JSON
- Download as CSV

---

## 5. UI/UX Design

### Popup Interface
```
┌─────────────────────────────────┐
│  📋 Get-Form Inspector         │
├─────────────────────────────────┤
│  [🔄 Scan Page]  [⚙️ Settings] │
├─────────────────────────────────┤
│  📊 Summary                     │
│  ├─ Forms: 2                    │
│  ├─ Input Fields: 15            │
│  ├─ Buttons: 4                  │
│  └─ Links: 23                   │
├─────────────────────────────────┤
│  📝 Forms Detail                │
│  ▼ Form #1 (Login Form)         │
│    ├─ email (required)          │
│    ├─ password (required)       │
│    └─ [Submit] button           │
│  ▶ Form #2 (Contact)            │
├─────────────────────────────────┤
│  [Copy JSON] [Download] [CSV]   │
└─────────────────────────────────┘
```

---

## 6. Permissions cần thiết

```json
{
  "permissions": [
    "activeTab",
    "scripting"
  ],
  "host_permissions": [
    "<all_urls>"
  ]
}
```

- `activeTab`: Truy cập tab hiện tại khi user click extension
- `scripting`: Inject content scripts động
- `<all_urls>`: Hoạt động trên mọi website

---

## 7. Roadmap phát triển

### Phase 1: MVP (1-2 tuần)
- [x] Setup project structure
- [ ] Basic manifest.json
- [ ] Simple form detection (native elements)
- [ ] Popup UI hiển thị kết quả
- [ ] Copy to clipboard

### Phase 2: Advanced Detection (1 tuần)
- [ ] Shadow DOM traversal
- [ ] MutationObserver cho dynamic content
- [ ] Custom elements detection (ARIA, contenteditable)
- [ ] iFrame detection

### Phase 3: Enhanced Features (1 tuần)
- [ ] Export JSON/CSV
- [ ] Highlight elements on page
- [ ] Field grouping & categorization
- [ ] Settings page

### Phase 4: Polish (3-5 ngày)
- [ ] Error handling
- [ ] Performance optimization
- [ ] Icons & branding
- [ ] Testing trên nhiều websites

---

## 8. Test Cases

Extension cần hoạt động tốt trên:
- [x] Static HTML forms
- [ ] React apps (Facebook, Instagram)
- [ ] Angular apps (Google services)
- [ ] Vue apps (GitLab, Alibaba)
- [ ] Shadow DOM (Salesforce, YouTube)
- [ ] Single Page Applications
- [ ] Multi-step forms (wizards)
- [ ] Forms trong modals/dialogs

---

## 9. Security Considerations

1. **Không lưu trữ data nhạy cảm** - Extension chỉ đọc, không gửi data đi đâu
2. **Mask password fields** - Không hiển thị value của password
3. **No remote code execution** - Tuân thủ Manifest V3 policies
4. **Minimal permissions** - Chỉ request permissions cần thiết

---

## 10. Resources & References

- [Chrome Extensions Manifest V3](https://developer.chrome.com/docs/extensions/develop/migrate)
- [Content Scripts Documentation](https://developer.chrome.com/docs/extensions/mv3/content_scripts/)
- [Shadow DOM MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM)
- [MutationObserver API](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver)
- [ARIA Roles](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles)

---

## 11. Kết luận

Extension này sẽ giải quyết nhu cầu phân tích cấu trúc form trên các trang web hiện đại. Với việc sử dụng Shadow DOM traversal, MutationObserver, và ARIA detection, extension có thể hoạt động với hầu hết các framework và công nghệ web phổ biến hiện nay.

**Estimated total time:** 3-4 tuần cho bản hoàn chỉnh.
