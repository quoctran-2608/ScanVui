# ScanVui - Chrome Extension

![Phiên bản](https://img.shields.io/badge/phiên_bản-3.5.0-blue)
![Chrome](https://img.shields.io/badge/chrome-extension-green)
![Giấy phép](https://img.shields.io/badge/giấy_phép-MIT-orange)

**ScanVui** là một Chrome Extension all-in-one mạnh mẽ giúp phân tích SEO, Accessibility, Performance và cung cấp các công cụ hữu ích cho lập trình viên và tester.

## Tác giả

- **Tên:** TranQuoc
- **Email:** tduyquoc@gmail.com

## Hướng dẫn cài đặt

1. Clone hoặc tải repository này về máy
2. Mở trình duyệt Chrome và truy cập `chrome://extensions/`
3. Bật **Chế độ nhà phát triển** (Developer mode) ở góc trên bên phải
4. Nhấn **Tải tiện ích đã giải nén** (Load unpacked) và chọn thư mục `ScanVui`
5. Extension sẽ xuất hiện trên thanh công cụ của Chrome

## Tính năng nổi bật v3.4.0

### ⚡ Quick Actions Bar (MỚI!)
Thanh truy cập nhanh luôn hiển thị với 4 tools hay dùng nhất:
- 📸 **Chụp** - Chụp ảnh toàn trang
- 🌐 **Tải web** - Tải website offline
- 🖼️ **Media** - Quét và tải media
- 🎯 **Selector** - Copy CSS/XPath/Playwright selector

**Không cần quét trang trước!** Click vào Quick Action là dùng được ngay.

### 🗂️ Tools Sub-tabs (MỚI!)
Các tools được phân loại rõ ràng:
- **⭐ Phổ biến**: Screenshot, Crawler, Media Scanner
- **🛠️ Dev**: Selector, Tech Stack, X-Ray
- **🧪 Testing**: Form Filler, Responsive, A11y Simulator

## Tính năng chi tiết

### 1. 🔍 Quét và Phân tích trang
Quét toàn diện và đánh giá theo 4 tiêu chí:
- **SEO**: Title, meta description, headings, Open Graph, alt text
- **Accessibility**: ARIA labels, form labels, semantic HTML
- **Performance**: DOM size, inline styles, scripts
- **Best Practices**: Charset, favicon, deprecated elements

### 2. 📸 Chụp ảnh trang (Screenshot)
- **Toàn trang**: Cuộn và ghép ảnh tự động
- **Visible**: Chỉ phần đang hiển thị
- Định dạng PNG/JPEG
- Ẩn header/footer cố định
- Copy vào clipboard

### 3. 🌐 Tải Website Offline (Crawler)
Tải toàn bộ website về máy (chạy nền, không cần giữ popup):
- **Hỗ trợ trang cần đăng nhập** - crawl với session cookies của browser
- Tạo tab ẩn để crawl, không ảnh hưởng tab đang dùng
- Độ sâu tùy chỉnh (1-5 level hoặc không giới hạn)
- Giới hạn số trang (20-1000)
- Thay thế links thành local paths
- Tải ảnh kèm theo (cũng hỗ trợ auth)
- Thông báo khi hoàn thành

### 4. 🖼️ Media Scanner
- Quét tất cả hình ảnh, video, audio
- Hiển thị thumbnail preview
- Tải từng file hoặc tải tất cả
- Hỗ trợ YouTube/Vimeo embed

### 5. 🎯 Copy Selector
Click chọn element và lấy:
- CSS Selector
- XPath
- Playwright Selector

### 6. 👁️ X-Ray Vision
Highlight các phần tử theo loại:
- Forms, Inputs, Buttons
- Links, Headings, Images

### 7. 🧪 Form Filler
Tự động điền form với dữ liệu test:
- Ngôn ngữ: Tiếng Việt / English
- Chế độ: Thực tế / Ngẫu nhiên / Edge cases

### 8. 📱 Responsive Tester
Test với các kích thước màn hình:
- iPhone SE (375x667)
- iPhone 14 (390x844)
- iPad (768x1024)
- Desktop (1920x1080)

### 9. ♿ A11y Simulator
Mô phỏng các dạng khiếm thị:
- Mù đỏ, xanh lá, xanh dương
- Mù màu hoàn toàn
- Thị lực mờ

### 10. ⚙️ Tech Stack Detector
Phát hiện frameworks và thư viện:
- React, Vue, Angular, Svelte, Next.js...
- Tailwind, Bootstrap, MUI...
- Google Analytics, Facebook Pixel...

### 11. 📤 Export báo cáo
Xuất kết quả phân tích:
- HTML, Markdown, JSON, CSV
- Copy nhanh vào clipboard

### 12. 🌓 Dark/Light Theme
Chuyển đổi giao diện sáng/tối, tự động lưu.

## Cấu trúc thư mục

```
ScanVui/
├── manifest.json
├── README.md
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── src/
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── popup.js
│   └── background/
│       └── service-worker.js
└── test-page.html
```

## Quyền truy cập

| Quyền | Lý do |
|-------|-------|
| `activeTab` | Truy cập tab đang mở |
| `scripting` | Chèn scripts phân tích |
| `storage` | Lưu cài đặt |
| `downloads` | Tải files |
| `notifications` | Thông báo khi crawler hoàn thành |

## Yêu cầu hệ thống

- Google Chrome phiên bản 88+ (Manifest V3)

## Lịch sử phiên bản

### v3.5.0 (Hiện tại)
- ✨ **MỚI:** Crawler hỗ trợ website cần đăng nhập (authenticated crawling)
- ✨ **MỚI:** Dùng tab navigation thay vì fetch() - browser tự gửi cookies/session
- ✨ **MỚI:** Tạo tab ẩn để crawl, không ảnh hưởng tab đang làm việc
- 🔧 **CẢI TIẾN:** Image fetch cũng gửi credentials
- 🔧 **CẢI TIẾN:** Thêm permission `tabs` cho tab management

### v3.4.0
- ✨ **MỚI:** Quick Actions Bar - truy cập nhanh 4 tools hay dùng nhất
- ✨ **MỚI:** Tools Sub-tabs - phân loại tools rõ ràng (Phổ biến, Dev, Testing)
- ✨ **MỚI:** Quick Actions hoạt động ngay không cần quét trang trước
- 🔧 **CẢI TIẾN:** Website Crawler - fix link replacement toàn diện
- 🔧 **CẢI TIẾN:** Auto-reset UI khi chuyển sang domain khác
- 🔧 **CẢI TIẾN:** HTML download với UTF-8 encoding chính xác

### v3.3.0
- ✨ Tính năng Tải Website Offline (chạy background)
- ✨ Thông báo khi crawler hoàn thành

### v3.2.0
- ✨ Chụp ảnh toàn trang (Full Page Screenshot)
- ✨ Hỗ trợ PNG/JPEG, copy clipboard

### v3.1.0
- ✨ Thiết kế lại giao diện với tabs navigation
- ✨ Score cards với thanh tiến trình
- ✨ Dark/Light theme
- ✨ Export đa định dạng

## Giấy phép

MIT License - Tự do sử dụng, chỉnh sửa và phân phối.

## Liên hệ

- **Tác giả:** TranQuoc
- **Email:** tduyquoc@gmail.com
- **GitHub:** https://github.com/quoctran-2608/ScanVui

---

**ScanVui** - Quét vui vẻ, code hiệu quả! 🚀
