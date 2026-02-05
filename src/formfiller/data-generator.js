/**
 * Form Filler Data Generator for ScanVui
 * Generates realistic random data for form testing
 * 
 * NOTE: This file is kept as a reference module. The actual generation logic
 * is inlined in popup.js > FormFillerController > injectFormFiller() method.
 */

const FormFillerData = {
  // Vietnamese and English names
  firstNames: {
    vi: ['Minh', 'Hùng', 'Anh', 'Linh', 'Hương', 'Thảo', 'Lan', 'Mai', 'Tuấn', 'Phong', 'Dũng', 'Hà', 'Thu', 'Ngọc', 'Bình'],
    en: ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'David', 'Elizabeth', 'William', 'Barbara', 'Richard', 'Susan', 'Joseph']
  },
  lastNames: {
    vi: ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương'],
    en: ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Wilson', 'Anderson', 'Taylor', 'Thomas', 'Moore']
  },

  // Email domains
  emailDomains: ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'test.com', 'example.com'],

  // Phone prefixes by locale
  phonePrefix: {
    vi: ['090', '091', '093', '094', '096', '097', '098', '086', '083', '084'],
    en: ['+1', '+44', '+61']
  },

  // Cities
  cities: {
    vi: ['Hà Nội', 'TP. Hồ Chí Minh', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ', 'Nha Trang', 'Huế', 'Vũng Tàu'],
    en: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'San Diego', 'Dallas', 'San Jose']
  },

  // Street names
  streets: {
    vi: ['Nguyễn Huệ', 'Lê Lợi', 'Trần Hưng Đạo', 'Hai Bà Trưng', 'Điện Biên Phủ', 'Võ Văn Tần', 'Lý Tự Trọng'],
    en: ['Main St', 'Oak Ave', 'Park Blvd', 'Maple Dr', 'Cedar Lane', 'Pine Rd', 'Washington St']
  },

  // Companies
  companies: ['ABC Corp', 'Tech Solutions', 'Global Services', 'Digital Inc', 'Smart Systems', 'Future Labs', 'Innovate Co'],

  // Lorem ipsum words for text
  loremWords: ['lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit', 'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore'],

  // Helper: random item from array
  randomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  },

  // Helper: random number in range
  randomNumber(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  // Generate full name
  generateName(locale = 'en') {
    const first = this.randomItem(this.firstNames[locale] || this.firstNames.en);
    const last = this.randomItem(this.lastNames[locale] || this.lastNames.en);
    return locale === 'vi' ? `${last} ${first}` : `${first} ${last}`;
  },

  // Generate first name only
  generateFirstName(locale = 'en') {
    return this.randomItem(this.firstNames[locale] || this.firstNames.en);
  },

  // Generate last name only
  generateLastName(locale = 'en') {
    return this.randomItem(this.lastNames[locale] || this.lastNames.en);
  },

  // Generate email
  generateEmail(name = null) {
    const base = name ? name.toLowerCase().replace(/\s+/g, '.') : `user${this.randomNumber(100, 9999)}`;
    const domain = this.randomItem(this.emailDomains);
    return `${base}@${domain}`;
  },

  // Generate phone
  generatePhone(locale = 'en') {
    const prefix = this.randomItem(this.phonePrefix[locale] || this.phonePrefix.en);
    if (locale === 'vi') {
      return `${prefix}${this.randomNumber(1000000, 9999999)}`;
    }
    return `${prefix} ${this.randomNumber(200, 999)}-${this.randomNumber(100, 999)}-${this.randomNumber(1000, 9999)}`;
  },

  // Generate address
  generateAddress(locale = 'en') {
    const num = this.randomNumber(1, 999);
    const street = this.randomItem(this.streets[locale] || this.streets.en);
    const city = this.randomItem(this.cities[locale] || this.cities.en);
    return `${num} ${street}, ${city}`;
  },

  // Generate date (YYYY-MM-DD format)
  generateDate(minAge = 18, maxAge = 65) {
    const year = new Date().getFullYear() - this.randomNumber(minAge, maxAge);
    const month = String(this.randomNumber(1, 12)).padStart(2, '0');
    const day = String(this.randomNumber(1, 28)).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // Generate password
  generatePassword(length = 12) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  },

  // Generate URL
  generateUrl() {
    return `https://www.example${this.randomNumber(1, 100)}.com`;
  },

  // Generate text paragraph
  generateText(wordCount = 10) {
    return Array.from({ length: wordCount }, () => this.randomItem(this.loremWords)).join(' ');
  },

  // Generate number
  generateNumber(min = 1, max = 100) {
    return this.randomNumber(min, max);
  },

  // Generate company name
  generateCompany() {
    return this.randomItem(this.companies);
  }
};

// Export for use
if (typeof window !== 'undefined') {
  window.FormFillerData = FormFillerData;
}

