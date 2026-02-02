# ScanVui - Chrome Extension

A fun and easy Chrome Extension that scans web pages to detect all form fields, inputs, and interactive elements including Shadow DOM and dynamic content.

## Features

- Detect all forms and input fields on any web page
- Support for Shadow DOM elements (Web Components)
- Detect ARIA-labeled elements (role="textbox", role="combobox", etc.)
- Detect contenteditable elements
- Analyze custom elements and dynamic content
- Export results as JSON, Text, or download as file
- Beautiful and intuitive popup UI

## Installation

### Method 1: Load Unpacked Extension (Developer Mode)

1. Open Chrome browser
2. Go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right corner)
4. Click **Load unpacked**
5. Select the `Get-Form-Extension` folder
6. The extension icon should appear in your toolbar

### Method 2: Pin the Extension

After installing, you might need to pin the extension:
1. Click the puzzle icon in Chrome toolbar
2. Find "Get-Form Inspector"
3. Click the pin icon to keep it visible

## Usage

1. Navigate to any web page you want to analyze
2. Click the ScanVui extension icon
3. Click **Scan Page** button
4. View the results:
   - **Summary**: Overview of forms, fields, buttons, links, etc.
   - **Forms Detail**: Click to expand each form and see all fields
   - **Other Elements**: Headings, iframes, Shadow DOM count

### Export Options

- **Copy JSON**: Copy full analysis as JSON to clipboard
- **Copy Text**: Copy human-readable summary to clipboard
- **Download**: Download analysis as JSON file

## What It Detects

### Form Elements
- All `<form>` elements
- Standalone inputs (not inside a form)
- Input types: text, email, password, number, tel, url, date, file, checkbox, radio, etc.
- Select dropdowns
- Textareas
- Hidden fields (counted but not displayed)

### Custom Elements
- `contenteditable` elements
- ARIA roles: textbox, combobox, listbox, searchbox
- Web Components with Shadow DOM
- Custom HTML elements (tags with hyphens)

### Field Properties
- Name, ID, Label
- Type and validation (required, pattern, min/max)
- Placeholder text
- ARIA labels and descriptions
- Disabled/readonly state

### Page Structure
- Headings (H1-H6)
- Links count
- Images count
- Tables count
- iFrames count
- Shadow DOM elements count

## Testing

Open `test-page.html` in your browser to test the extension with various form types and input elements.

## Permissions

- `activeTab`: Access the current tab when you click the extension
- `scripting`: Inject content scripts to analyze the page
- `<all_urls>`: Work on any website

## Files Structure

```
Get-Form-Extension/
├── manifest.json           # Extension configuration
├── src/
│   ├── popup/
│   │   ├── popup.html      # Popup UI
│   │   ├── popup.css       # Styles
│   │   └── popup.js        # Logic & form detection
│   ├── content/
│   │   └── content-script.js  # Advanced DOM walker
│   └── background/
│       └── service-worker.js  # Background service
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── docs/
│   └── PROJECT_PLAN.md
├── test-page.html          # Test page with various forms
└── README.md
```

## Browser Support

- Chrome 88+ (Manifest V3)
- Edge 88+ (Chromium-based)
- Other Chromium-based browsers

## License

MIT License
