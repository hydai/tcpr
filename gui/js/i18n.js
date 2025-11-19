// i18n initialization and utilities
// Secure implementation without XSS vulnerabilities

let i18nextInstance = null;

// Initialize i18next
async function initI18n() {
  const savedLanguage = localStorage.getItem('language') || 'en';

  // Fetch translation files
  const [enTranslation, jaTranslation] = await Promise.all([
    fetch('locales/en/translation.json').then(r => r.json()),
    fetch('locales/ja/translation.json').then(r => r.json())
  ]);

  i18nextInstance = i18next.createInstance();

  await i18nextInstance.init({
    lng: savedLanguage,
    fallbackLng: 'en',
    debug: false,
    resources: {
      en: { translation: enTranslation },
      ja: { translation: jaTranslation }
    },
    interpolation: {
      escapeValue: true // Always escape values for security
    }
  });

  // Update the page with translations
  updatePageTranslations();

  return i18nextInstance;
}

// Translate a key
function t(key, options = {}) {
  if (!i18nextInstance) {
    console.error('i18next not initialized');
    return key;
  }
  return i18nextInstance.t(key, options);
}

// Change language
async function changeLanguage(lang) {
  if (!i18nextInstance) {
    console.error('i18next not initialized');
    return;
  }

  await i18nextInstance.changeLanguage(lang);
  localStorage.setItem('language', lang);
  updatePageTranslations();
}

// Get current language
function getCurrentLanguage() {
  return i18nextInstance ? i18nextInstance.language : 'en';
}

// Update all page translations
function updatePageTranslations() {
  // Update all elements with data-i18n attribute (text content only - safe from XSS)
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    const translation = t(key);

    // Use textContent instead of innerHTML to prevent XSS
    // Special handling for different element types
    if (element.tagName === 'INPUT' && element.type !== 'submit' && element.type !== 'button') {
      // For input elements, set value
      element.value = translation;
    } else {
      // For all other elements, use textContent
      element.textContent = translation;
    }
  });

  // Update all placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
    const key = element.getAttribute('data-i18n-placeholder');
    element.placeholder = t(key);
  });

  // Update all titles (tooltips)
  document.querySelectorAll('[data-i18n-title]').forEach(element => {
    const key = element.getAttribute('data-i18n-title');
    element.title = t(key);
  });

  // Update page title
  document.title = t('header.title');
}

// Export functions to global scope for use in app.js
window.initI18n = initI18n;
window.t = t;
window.changeLanguage = changeLanguage;
window.getCurrentLanguage = getCurrentLanguage;
window.updatePageTranslations = updatePageTranslations;
