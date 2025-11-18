// i18n initialization and utilities

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
      escapeValue: true // Explicitly enable XSS protection (default)
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
  // Update all elements with data-i18n attribute
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    element.textContent = t(key);
  });

  // Update all placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
    const key = element.getAttribute('data-i18n-placeholder');
    element.placeholder = t(key);
  });

  // Update all titles
  document.querySelectorAll('[data-i18n-title]').forEach(element => {
    const key = element.getAttribute('data-i18n-title');
    element.title = t(key);
  });

  // Update page title
  document.title = t('header.title');
}

// Export functions to global scope
window.initI18n = initI18n;
window.t = t;
window.changeLanguage = changeLanguage;
window.getCurrentLanguage = getCurrentLanguage;
window.updatePageTranslations = updatePageTranslations;
