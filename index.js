// Модуль для плавающего переводчика
const FLOATING_TRANSLATOR_MODULE = 'floating_translator';

// Настройки по умолчанию
const defaultSettings = {
    enabled: true,
    provider: 'google',      // google, deepl, yandex
    targetLanguage: 'ru',     // язык перевода
    autoTranslate: true,      // автоматический перевод при вводе
    windowWidth: 400,
    windowHeight: 300,
    windowPosition: 'bottom-right', // bottom-right, top-right, etc.
    apiKey: ''                // для провайдеров, требующих API ключ
};

// Состояние окна
let translatorWindow = null;
let isWindowVisible = false;
let dragOffset = { x: 0, y: 0 };
let isDragging = false;

// Инициализация расширения
jQuery(() => {
    if (!SillyTavern.getContext()) {
        console.error('Не удалось получить контекст SillyTavern');
        return;
    }
    
    initTranslatorExtension();
});

function initTranslatorExtension() {
    const context = SillyTavern.getContext();
    
    // Загружаем или создаем настройки
    if (!context.extensionSettings[FLOATING_TRANSLATOR_MODULE]) {
        context.extensionSettings[FLOATING_TRANSLATOR_MODULE] = JSON.parse(JSON.stringify(defaultSettings));
    }
    
    // Создаем кнопку для открытия переводчика
    addTranslatorButton();
    
    // Создаем HTML структуру окна
    createTranslatorWindow();
    
    // Подписываемся на события
    context.eventSource.on(context.eventTypes.EXTRAS_CONNECTED, () => {
        console.log('Расширение переводчика готово к работе');
    });
    
    // Сохраняем настройки при изменении
    saveSettings();
}

function addTranslatorButton() {
    // Добавляем кнопку в панель расширений или в топ-бар
    const buttonHtml = `
        <div id="floating_translator_button" class="list-group-item flex-container flexGap5">
            <div class="fa-solid fa-language extensionsMenuIcon"></div>
            <span data-i18n="Плавающий переводчик">Плавающий переводчик</span>
        </div>
    `;
    
    // Находим меню расширений и добавляем кнопку
    const extensionsMenu = document.getElementById('extensions_menu');
    if (extensionsMenu) {
        extensionsMenu.insertAdjacentHTML('beforeend', buttonHtml);
        
        // Добавляем обработчик клика
        document.getElementById('floating_translator_button').addEventListener('click', toggleTranslatorWindow);
    }
}

function createTranslatorWindow() {
    // Проверяем, не создано ли уже окно
    if (document.getElementById('floating_translator_window')) {
        return;
    }
    
    const settings = getSettings();
    
    // Создаем HTML структуру плавающего окна
    const windowHtml = `
        <div id="floating_translator_window" class="translator-window" style="width: ${settings.windowWidth}px; height: ${settings.windowHeight}px; display: none;">
            <div class="translator-header">
                <span class="translator-title">🌐 Переводчик</span>
                <div class="translator-controls">
                    <button class="translator-minimize">−</button>
                    <button class="translator-close">×</button>
                </div>
            </div>
            <div class="translator-content">
                <div class="translator-input-area">
                    <textarea 
                        id="translator_source_text" 
                        class="translator-textarea" 
                        placeholder="Введите текст для перевода..."
                    ></textarea>
                    <select id="translator_source_lang" class="translator-lang-select">
                        <option value="auto">Автоопределение</option>
                        <option value="en">Английский</option>
                        <option value="ru">Русский</option>
                        <option value="de">Немецкий</option>
                        <option value="fr">Французский</option>
                        <option value="es">Испанский</option>
                        <option value="it">Итальянский</option>
                        <option value="ja">Японский</option>
                        <option value="ko">Корейский</option>
                        <option value="zh">Китайский</option>
                    </select>
                </div>
                <div class="translator-output-area">
                    <textarea 
                        id="translator_target_text" 
                        class="translator-textarea" 
                        placeholder="Перевод..." 
                        readonly
                    ></textarea>
                    <select id="translator_target_lang" class="translator-lang-select">
                        <option value="ru">Русский</option>
                        <option value="en">Английский</option>
                        <option value="de">Немецкий</option>
                        <option value="fr">Французский</option>
                        <option value="es">Испанский</option>
                        <option value="it">Итальянский</option>
                        <option value="ja">Японский</option>
                        <option value="ko">Корейский</option>
                        <option value="zh">Китайский</option>
                    </select>
                </div>
                <div class="translator-footer">
                    <button id="translator_swap_langs" class="translator-button" title="Поменять языки местами">↔️</button>
                    <button id="translator_copy_result" class="translator-button" title="Копировать перевод">📋</button>
                    <button id="translator_insert_chat" class="translator-button" title="Вставить в чат">💬</button>
                </div>
            </div>
        </div>
    `;
    
    // Добавляем окно в body
    document.body.insertAdjacentHTML('beforeend', windowHtml);
    
    // Получаем ссылку на окно
    translatorWindow = document.getElementById('floating_translator_window');
    
    // Устанавливаем начальную позицию
    setWindowPosition(getSettings().windowPosition);
    
    // Добавляем обработчики событий
    attachWindowHandlers();
}

function attachWindowHandlers() {
    if (!translatorWindow) return;
    
    // Перетаскивание окна
    const header = translatorWindow.querySelector('.translator-header');
    header.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);
    
    // Кнопки управления
    translatorWindow.querySelector('.translator-close').addEventListener('click', hideTranslatorWindow);
    translatorWindow.querySelector('.translator-minimize').addEventListener('click', minimizeWindow);
    
    // Поле ввода - автоматический перевод
    const sourceText = document.getElementById('translator_source_text');
    sourceText.addEventListener('input', debounce(() => {
        if (getSettings().autoTranslate) {
            performTranslation();
        }
    }, 500));
    
    // Кнопки действий
    document.getElementById('translator_swap_langs').addEventListener('click', swapLanguages);
    document.getElementById('translator_copy_result').addEventListener('click', copyTranslation);
    document.getElementById('translator_insert_chat').addEventListener('click', insertIntoChat);
    
    // Изменение языков
    document.getElementById('translator_source_lang').addEventListener('change', performTranslation);
    document.getElementById('translator_target_lang').addEventListener('change', () => {
        // Сохраняем выбранный язык в настройки
        const settings = getSettings();
        settings.targetLanguage = document.getElementById('translator_target_lang').value;
        saveSettings();
        performTranslation();
    });
    
    // Загружаем сохраненный язык
    const settings = getSettings();
    document.getElementById('translator_target_lang').value = settings.targetLanguage;
}

async function performTranslation() {
    const sourceText = document.getElementById('translator_source_text').value.trim();
    if (!sourceText) {
        document.getElementById('translator_target_text').value = '';
        return;
    }
    
    const sourceLang = document.getElementById('translator_source_lang').value;
    const targetLang = document.getElementById('translator_target_lang').value;
    const settings = getSettings();
    
    try {
        let translatedText = '';
        
        // Используем разные провайдеры в зависимости от настроек
        switch (settings.provider) {
            case 'google':
                translatedText = await translateWithGoogle(sourceText, sourceLang, targetLang);
                break;
            case 'deepl':
                translatedText = await translateWithDeepL(sourceText, sourceLang, targetLang, settings.apiKey);
                break;
            case 'yandex':
                translatedText = await translateWithYandex(sourceText, sourceLang, targetLang, settings.apiKey);
                break;
            default:
                translatedText = await translateWithGoogle(sourceText, sourceLang, targetLang);
        }
        
        document.getElementById('translator_target_text').value = translatedText;
    } catch (error) {
        console.error('Ошибка перевода:', error);
        document.getElementById('translator_target_text').value = 'Ошибка перевода. Проверьте подключение к интернету.';
    }
}

async function translateWithGoogle(text, sourceLang, targetLang) {
    // Используем бесплатный API Google Translate (неофициальный, но рабочий)
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    // Парсим ответ Google
    let translatedText = '';
    if (data && data[0]) {
        translatedText = data[0].map(item => item[0]).join('');
    }
    
    return translatedText;
}

async function translateWithDeepL(text, sourceLang, targetLang, apiKey) {
    if (!apiKey) {
        throw new Error('Необходим API ключ DeepL');
    }
    
    // Преобразуем языки в формат DeepL
    const deeplTarget = targetLang.toUpperCase();
    
    const url = 'https://api-free.deepl.com/v2/translate';
    const params = new URLSearchParams({
        auth_key: apiKey,
        text: text,
        target_lang: deeplTarget
    });
    
    if (sourceLang !== 'auto') {
        params.append('source_lang', sourceLang.toUpperCase());
    }
    
    const response = await fetch(url, {
        method: 'POST',
        body: params
    });
    
    const data = await response.json();
    return data.translations[0].text;
}

async function translateWithYandex(text, sourceLang, targetLang, apiKey) {
    if (!apiKey) {
        throw new Error('Необходим API ключ Yandex');
    }
    
    const url = 'https://translate.api.cloud.yandex.net/translate/v2/translate';
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Api-Key ${apiKey}`
        },
        body: JSON.stringify({
            sourceLanguageCode: sourceLang === 'auto' ? null : sourceLang,
            targetLanguageCode: targetLang,
            texts: [text]
        })
    });
    
    const data = await response.json();
    return data.translations[0].text;
}

function swapLanguages() {
    const sourceLang = document.getElementById('translator_source_lang');
    const targetLang = document.getElementById('translator_target_lang');
    const sourceText = document.getElementById('translator_source_text');
    const targetText = document.getElementById('translator_target_text');
    
    // Меняем языки местами
    const tempLang = sourceLang.value;
    sourceLang.value = targetLang.value;
    targetLang.value = tempLang;
    
    // Меняем текст местами (если есть перевод)
    if (targetText.value) {
        sourceText.value = targetText.value;
        targetText.value = '';
        performTranslation();
    }
}

function copyTranslation() {
    const targetText = document.getElementById('translator_target_text');
    if (targetText.value) {
        navigator.clipboard.writeText(targetText.value);
        showNotification('Перевод скопирован в буфер обмена');
    }
}

function insertIntoChat() {
    const targetText = document.getElementById('translator_target_text').value;
    if (!targetText) return;
    
    const context = SillyTavern.getContext();
    
    // Вставляем перевод в поле ввода чата
    const sendForm = document.getElementById('send_textarea');
    if (sendForm) {
        const currentText = sendForm.value;
        sendForm.value = currentText + (currentText ? '\n' : '') + targetText;
        sendForm.dispatchEvent(new Event('input', { bubbles: true }));
        sendForm.focus();
    }
}

function toggleTranslatorWindow() {
    if (!translatorWindow) return;
    
    if (isWindowVisible) {
        hideTranslatorWindow();
    } else {
        showTranslatorWindow();
    }
}

function showTranslatorWindow() {
    if (!translatorWindow) return;
    
    translatorWindow.style.display = 'flex';
    isWindowVisible = true;
    
    // Фокусируемся на поле ввода
    setTimeout(() => {
        document.getElementById('translator_source_text').focus();
    }, 100);
}

function hideTranslatorWindow() {
    if (!translatorWindow) return;
    
    translatorWindow.style.display = 'none';
    isWindowVisible = false;
}

function minimizeWindow() {
    if (!translatorWindow) return;
    
    const content = translatorWindow.querySelector('.translator-content');
    const isMinimized = content.style.display === 'none';
    
    content.style.display = isMinimized ? 'flex' : 'none';
    
    const minimizeBtn = translatorWindow.querySelector('.translator-minimize');
    minimizeBtn.textContent = isMinimized ? '−' : '+';
}

function startDrag(e) {
    if (e.target.closest('.translator-controls')) return;
    
    isDragging = true;
    const rect = translatorWindow.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;
    
    translatorWindow.style.cursor = 'grabbing';
    translatorWindow.style.transition = 'none';
}

function onDrag(e) {
    if (!isDragging) return;
    
    e.preventDefault();
    
    const x = e.clientX - dragOffset.x;
    const y = e.clientY - dragOffset.y;
    
    // Ограничиваем окно пределами экрана
    const maxX = window.innerWidth - translatorWindow.offsetWidth;
    const maxY = window.innerHeight - translatorWindow.offsetHeight;
    
    translatorWindow.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
    translatorWindow.style.top = Math.max(0, Math.min(y, maxY)) + 'px';
    translatorWindow.style.right = 'auto';
    translatorWindow.style.bottom = 'auto';
}

function stopDrag() {
    if (!isDragging) return;
    
    isDragging = false;
    translatorWindow.style.cursor = '';
    translatorWindow.style.transition = '';
}

function setWindowPosition(position) {
    if (!translatorWindow) return;
    
    // Сбрасываем все позиционирования
    translatorWindow.style.left = 'auto';
    translatorWindow.style.right = 'auto';
    translatorWindow.style.top = 'auto';
    translatorWindow.style.bottom = 'auto';
    
    switch (position) {
        case 'top-left':
            translatorWindow.style.left = '20px';
            translatorWindow.style.top = '20px';
            break;
        case 'top-right':
            translatorWindow.style.right = '20px';
            translatorWindow.style.top = '20px';
            break;
        case 'bottom-left':
            translatorWindow.style.left = '20px';
            translatorWindow.style.bottom = '20px';
            break;
        case 'bottom-right':
        default:
            translatorWindow.style.right = '20px';
            translatorWindow.style.bottom = '20px';
    }
}

function getSettings() {
    const context = SillyTavern.getContext();
    if (!context.extensionSettings[FLOATING_TRANSLATOR_MODULE]) {
        context.extensionSettings[FLOATING_TRANSLATOR_MODULE] = JSON.parse(JSON.stringify(defaultSettings));
    }
    return context.extensionSettings[FLOATING_TRANSLATOR_MODULE];
}

function saveSettings() {
    const context = SillyTavern.getContext();
    context.saveSettingsDebounced();
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function showNotification(message) {
    // Используем встроенную систему уведомлений SillyTavern, если есть
    if (typeof toastr !== 'undefined') {
        toastr.info(message);
    } else {
        alert(message);
    }
}
