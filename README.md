# ScanVui - Chrome Extension

![Phiên bản](https://img.shields.io/badge/phiên_bản-3.1.0-blue)
![Chrome](https://img.shields.io/badge/chrome-extension-green)
![Giấy phép](https://img.shields.io/badge/giấy_phép-MIT-orange)

**ScanVui** là một Chrome Extension mạnh mẽ giúp phân tích SEO, Accessibility, Performance và cung cấp các công cụ hữu ích cho lập trình viên và tester.

## Tác giả

- **Tên:** TranQuoc
- **Email:** tduyquoc@gmail.com

## Hướng dẫn cài đặt

1. Clone hoặc tải repository này về máy
2. Mở trình duyệt Chrome và truy cập `chrome://extensions/`
3. Bật **Chế độ nhà phát triển** (Developer mode) ở góc trên bên phải
4. Nhấn **Tải tiện ích đã giải nén** (Load unpacked) và chọn thư mục `ScanVui`
5. Extension sẽ xuất hiện trên thanh công cụ của Chrome

## Tính năng chi tiết

### 1. Quét và Phân tích trang (Page Scanner)

Quét toàn diện trang web và đánh giá theo 4 tiêu chí chính:

| Tiêu chí | Mô tả chi tiết |
|----------|----------------|
| **SEO** | Kiểm tra title, meta description, cấu trúc headings, canonical URL, Open Graph tags, alt text cho hình ảnh |
| **Accessibility** | Kiểm tra ARIA labels, form labels, skip links, thuộc tính lang, semantic HTML |
| **Performance** | Đánh giá kích thước DOM, độ sâu DOM, inline styles, số lượng scripts |
| **Best Practices** | Kiểm tra charset, favicon, các elements lỗi thời |

**Kết quả hiển thị bao gồm:**
- Thẻ điểm (Score cards) với điểm số từ 0-100 và màu sắc trực quan (xanh/vàng/đỏ)
- Danh sách các vấn đề cần khắc phục
- Thống kê nhanh về số lượng forms, links, images, scripts
- Chi tiết kỹ thuật có thể mở rộng/thu gọn

### 2. X-Ray Vision (Chế độ nhìn xuyên)

Làm nổi bật các phần tử trên trang theo từng loại với màu sắc riêng biệt:

| Loại phần tử | Màu viền |
|--------------|----------|
| **Forms** | Xanh lá (#22c55e) |
| **Inputs** | Xanh dương (#3b82f6) |
| **Buttons** | Vàng (#eab308) |
| **Links** | Tím (#a855f7) |
| **Headings** | Đỏ (#ef4444) |
| **Images** | Cam (#f97316) |

### 3. Form Filler (Tự động điền form)

Tự động điền form với dữ liệu test theo các tùy chọn:

| Tùy chọn | Các lựa chọn |
|----------|--------------|
| **Ngôn ngữ** | Tiếng Việt / English |
| **Chế độ điền** | Thực tế / Ngẫu nhiên / Edge cases |

**Hỗ trợ các loại input:**
- Text, Email, Phone, Name, Address
- Checkbox, Radio button
- Select dropdown, Textarea
- Date, Number

### 4. Element Picker (Chọn và sao chép Selector)

Cho phép click vào bất kỳ phần tử nào trên trang để lấy selector:

| Loại Selector | Ví dụ |
|---------------|-------|
| **CSS Selector** | `#header`, `.btn-primary`, `div.container` |
| **XPath** | `//*[@id="header"]`, `//div[1]/span[2]` |
| **Playwright Selector** | `getByLabel("Email")`, `getByText("Đăng nhập")`, `[data-testid="submit"]` |

**Các tính năng:**
- Tooltip theo chuột hiển thị thông tin phần tử
- Tự động sao chép CSS selector vào clipboard khi click
- Nhấn phím ESC để hủy chế độ chọn
- Nút sao chép riêng cho từng loại selector

### 5. Responsive Tester (Kiểm tra giao diện đa thiết bị)

Mở trang trong cửa sổ mới với kích thước màn hình cố định:

| Thiết bị | Kích thước (width x height) |
|----------|----------------------------|
| iPhone SE | 375 x 667 pixels |
| iPhone 14 | 390 x 844 pixels |
| iPad | 768 x 1024 pixels |
| Desktop | 1920 x 1080 pixels |

### 6. A11y Simulator (Mô phỏng khiếm thị)

Mô phỏng các dạng khiếm thị để kiểm tra khả năng tiếp cận:

| Loại khiếm thị | Mô tả | Hiệu ứng CSS |
|----------------|-------|--------------|
| **Protanopia** | Mù màu đỏ | sepia + hue-rotate(-50deg) |
| **Deuteranopia** | Mù màu xanh lá | sepia + hue-rotate(50deg) |
| **Tritanopia** | Mù màu xanh dương | sepia + hue-rotate(180deg) |
| **Achromatopsia** | Mù màu hoàn toàn | grayscale(100%) |
| **Blurry** | Thị lực kém/mờ | blur(2px) |

### 7. Tech Stack Detector (Phát hiện công nghệ)

Tự động phát hiện các frameworks, thư viện và công nghệ được sử dụng trên trang:

**JavaScript Frameworks:**
- React, Vue.js, Angular, Svelte
- Next.js, Nuxt.js, Gatsby, Astro

**JavaScript Libraries:**
- jQuery, htmx, Alpine.js

**CSS Frameworks:**
- Tailwind CSS, Bootstrap, Semantic UI
- MUI (Material UI), Chakra UI, Ant Design

**Build Tools:**
- Vite

**Analytics & Tracking:**
- Google Analytics, Facebook Pixel, Segment
- Mixpanel, Amplitude, PostHog

**CMS & Website Builders:**
- WordPress, Shopify, Webflow, Wix, Squarespace

### 8. Media Scanner (Quét và tải media)

Quét toàn bộ media trên trang với đầy đủ thông tin:

**Các loại media được hỗ trợ:**
- Hình ảnh (JPG, PNG, GIF, WebP, SVG, AVIF)
- Hình nền CSS (Background images)
- Video (HTML5 video, YouTube embed, Vimeo embed)
- Audio (HTML5 audio)

**Tính năng chi tiết:**
| Tính năng | Mô tả |
|-----------|-------|
| Hiển thị thumbnail | Xem trước hình ảnh thu nhỏ |
| Thông tin file | Tên file, kích thước (width x height), loại file |
| Phân loại theo tabs | Ảnh / Video / Audio |
| Sao chép URL | Nút 📋 để sao chép URL từng media |
| Tải từng file | Nút ⬇️ để tải về từng file riêng lẻ |
| Mở embed | Nút 🔗 để mở YouTube/Vimeo trong tab mới |
| Tải tất cả | Tải hàng loạt (tối đa 30 files) vào thư mục `scanvui-media/` |

### 9. Export & Copy (Xuất và sao chép báo cáo)

Xuất báo cáo phân tích dưới nhiều định dạng khác nhau:

| Định dạng | Mô tả | Ứng dụng |
|-----------|-------|----------|
| **HTML** | Báo cáo đẹp với định dạng đầy đủ | Xem trên trình duyệt, chia sẻ |
| **Markdown** | Định dạng văn bản thuần | GitHub, tài liệu kỹ thuật |
| **JSON** | Dữ liệu thô có cấu trúc | Xử lý bằng code, API |
| **CSV** | Bảng dữ liệu | Excel, Google Sheets |

**Sao chép nhanh:**
- Sao chép JSON - Dữ liệu đầy đủ
- Sao chép Markdown - Báo cáo định dạng
- Sao chép tóm tắt - Thông tin ngắn gọn

### 10. Giao diện (Theme)

Hỗ trợ 2 chế độ giao diện:

| Chế độ | Mô tả |
|--------|-------|
| **Light** | Giao diện sáng, nền trắng |
| **Dark** | Giao diện tối, dễ nhìn ban đêm |

- Chế độ giao diện được lưu tự động
- Tự động áp dụng khi mở extension lần sau

## Cấu trúc thư mục dự án

```
ScanVui/
├── manifest.json              # Cấu hình Chrome extension (Manifest V3)
├── README.md                  # Tài liệu hướng dẫn (file này)
├── icons/                     # Biểu tượng extension
│   ├── icon16.png            # Icon 16x16 pixels
│   ├── icon48.png            # Icon 48x48 pixels
│   └── icon128.png           # Icon 128x128 pixels
├── src/
│   ├── popup/
│   │   ├── popup.html        # Giao diện popup chính
│   │   ├── popup.css         # Định dạng CSS
│   │   └── popup.js          # Logic xử lý JavaScript
│   └── service-worker.js     # Background service worker
├── generate_icons.py          # Script tạo icons
└── test-page.html            # Trang test để phát triển
```

## Quyền truy cập (Permissions)

Extension yêu cầu các quyền sau:

| Quyền | Lý do cần thiết |
|-------|-----------------|
| `activeTab` | Truy cập tab đang mở để quét và phân tích |
| `scripting` | Chèn scripts để thu thập thông tin trang |
| `storage` | Lưu trữ kết quả quét và cài đặt người dùng |
| `downloads` | Tải xuống các file media |

## Yêu cầu hệ thống

- **Trình duyệt:** Google Chrome phiên bản 88 trở lên (hỗ trợ Manifest V3)
- **Lưu ý:** Extension không hoạt động trên các trang hệ thống như `chrome://` hoặc `chrome-extension://`

## Hướng dẫn phát triển

### Tạo icons

```bash
python generate_icons.py
```

### Kiểm thử

1. Mở file `test-page.html` trong trình duyệt
2. Click vào biểu tượng ScanVui trên thanh công cụ
3. Thử nghiệm các tính năng

### Reload extension sau khi sửa code

1. Vào `chrome://extensions/`
2. Nhấn nút reload (🔄) trên thẻ ScanVui
3. Đóng và mở lại popup để thấy thay đổi

## Lịch sử phiên bản (Changelog)

### Phiên bản 3.1.0 (Hiện tại)
- ✨ Thiết kế lại giao diện hoàn toàn với điều hướng theo tabs
- ✨ Thêm thẻ điểm (score cards) với thanh tiến trình trực quan
- ✨ Cải tiến Element Picker với tooltip và hỗ trợ đa selector
- ✨ Cải tiến A11y Simulator sử dụng CSS filters thay vì SVG
- ✨ Cải tiến Tech Stack detection (thêm hơn 15 frameworks mới)
- ✨ Cải tiến Media Scanner với danh sách chi tiết và tải từng file
- ✨ Thêm chế độ giao diện sáng/tối (dark/light theme)
- ✨ Xuất báo cáo đa định dạng (HTML, Markdown, JSON, CSV)

### Phiên bản 3.0.0
- 🚀 Phiên bản đầu tiên

## Giấy phép (License)

MIT License - Tự do sử dụng, chỉnh sửa và phân phối.

## Đóng góp

Mọi đóng góp đều được chào đón! Vui lòng:
- Tạo **Issue** để báo lỗi hoặc đề xuất tính năng mới
- Tạo **Pull Request** để đóng góp code

## Liên hệ

- **Tác giả:** TranQuoc
- **Email:** tduyquoc@gmail.com
- **GitHub:** https://github.com/quoctran-2608/ScanVui

---

**ScanVui** - Quét vui vẻ, code hiệu quả! 🚀
