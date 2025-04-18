/**
 * Головний файл для керування Kahoot-ботом
 * Адаптований для роботи з проксі-сервером на Render.com
 */

import KahootBot from './KahootBot.js';
import MLAnalyzer from './MLAnalyzer.js';
import SearchEngine from './SearchEngine.js';
import * as utils from './utils.js';

// Адреса проксі-сервера на Render.com
// !!! ВАЖЛИВО: Замініть цей URL на вашу реальну адресу додатку на Render.com
const PROXY_SERVER_URL = 'https://your-app-name.onrender.com';

// Основні елементи інтерфейсу
const botNameInput = document.getElementById('botName');
const gamePinInput = document.getElementById('gamePin');
const startBotBtn = document.getElementById('startBot');
const stopBotBtn = document.getElementById('stopBot');
const statusIndicator = document.getElementById('botStatus');
const logContainer = document.getElementById('logContainer');

// Елементи налаштувань
const useTensorflowToggle = document.getElementById('useTensorflow');
const useML5Toggle = document.getElementById('useML5');
const useSearchToggle = document.getElementById('useSearch');
const useProxyToggle = document.getElementById('useProxy');

// Елементи проксі
const proxyUrlInput = document.getElementById('proxyUrl');
const proxyLoginInput = document.getElementById('proxyLogin');
const proxyPasswordInput = document.getElementById('proxyPassword');
const testProxyBtn = document.getElementById('testProxy');

// Елементи акордіону налаштувань
const settingsHeader = document.getElementById('settingsHeader');
const settingsToggle = document.getElementById('settingsToggle');
const settingsContent = document.getElementById('settingsContent');

// Елементи акордіону проксі
const proxyHeader = document.getElementById('proxyHeader');
const proxyToggle = document.getElementById('proxyToggle');
const proxySettings = document.getElementById('proxySettings');

// Змінні стану
let botRunning = false;
let kahootBot = null;

// Функція логування подій
function logMessage(message, type = 'info') {
    utils.logToElement(message, 'logContainer', type);
}

// Перевірка полів форми
function validateForm() {
    const botName = botNameInput.value.trim();
    const gamePin = gamePinInput.value.trim();
    
    if (!botName) {
        logMessage('Помилка: Введіть ім\'я бота', 'error');
        return false;
    }
    
    if (!gamePin || !utils.isValidKahootPin(gamePin)) {
        logMessage('Помилка: Введіть коректний PIN-код гри (6-10 цифр)', 'error');
        return false;
    }
    
    return true;
}

// Перевірка доступності проксі-сервера на Render.com
async function checkProxyServerConnection() {
    try {
        logMessage('Перевірка з\'єднання з проксі-сервером на Render.com...', 'info');
        
        const response = await fetch(`${PROXY_SERVER_URL}/`);
        
        if (response.ok) {
            const data = await response.json();
            logMessage(`Проксі-сервер доступний: ${JSON.stringify(data)}`, 'success');
            return true;
        } else {
            logMessage(`Помилка з'єднання з проксі-сервером: ${response.status} ${response.statusText}`, 'error');
            return false;
        }
    } catch (error) {
        logMessage(`Помилка перевірки проксі-сервера: ${error.message}`, 'error');
        logMessage(`Переконайтеся, що проксі-сервер запущено на ${PROXY_SERVER_URL}`, 'warn');
        return false;
    }
}

// Перевірка проксі-сервера через інтерфейс користувача (для налаштувань проксі)
async function checkProxy() {
    updateProxyStatus('warning', 'Перевірка доступності проксі-сервера...');
    
    try {
        const isAvailable = await checkProxyServerConnection();
        
        if (isAvailable) {
            updateProxyStatus('success', 'Проксі-сервер на Render.com доступний і працює');
        } else {
            updateProxyStatus('error', 'Помилка: Проксі-сервер на Render.com недоступний');
        }
    } catch (error) {
        updateProxyStatus('error', `Помилка: ${error.message}`);
    }
}

// Функція оновлення статусу проксі
function updateProxyStatus(status, message) {
    const statusIndicator = document.getElementById('proxyStatusIndicator');
    const statusText = document.getElementById('proxyStatusText');
    
    // Очищаємо попередні класи
    statusIndicator.classList.remove('success', 'warning', 'error');
    
    // Додаємо новий клас відповідно до статусу
    statusIndicator.classList.add(status);
    
    // Оновлюємо текст статусу
    statusText.textContent = message;
}

// Обробники подій для акордіонів
function toggleSettingsAccordion() {
    settingsToggle.classList.toggle('active');
    settingsContent.classList.toggle('active');
    settingsToggle.textContent = settingsToggle.classList.contains('active') ? '▲' : '▼';
}

function toggleProxyAccordion() {
    proxyToggle.classList.toggle('active');
    proxySettings.classList.toggle('active');
    proxyToggle.textContent = proxyToggle.classList.contains('active') ? '▲' : '▼';
}

// Заповнення полів для проксі
function fillProxyFields() {
    // Заповнюємо поля налаштувань проксі для Render.com (вже налаштовано на сервері)
    proxyUrlInput.value = "Налаштовано на Render.com";
    proxyLoginInput.value = "Налаштовано на Render.com";
    proxyPasswordInput.value = "**********";
    
    // Блокуємо редагування, оскільки проксі вже налаштовано на сервері
    proxyUrlInput.disabled = true;
    proxyLoginInput.disabled = true;
    proxyPasswordInput.disabled = true;
    
    // Оновлюємо опис
    const proxyStatusText = document.getElementById('proxyStatusText');
    if (proxyStatusText) {
        proxyStatusText.textContent = "Проксі налаштовано на сервері";
    }
}

// Обробник події для кнопки запуску бота
startBotBtn.addEventListener('click', async function() {
    if (botRunning) return;
    
    if (!validateForm()) return;
    
    // Перевірка з'єднання з інтернетом
    const isConnected = await utils.checkInternetConnection();
    if (!isConnected) {
        logMessage('Помилка: Відсутнє підключення до інтернету', 'error');
        return;
    }
    
    // Перевірка доступності проксі-сервера на Render.com
    const isProxyServerAvailable = await checkProxyServerConnection();
    if (!isProxyServerAvailable) {
        return;
    }
    
    logMessage('Ініціалізація бота...', 'info');
    startBotBtn.disabled = true;
    
    try {
        const botName = botNameInput.value.trim();
        const gamePin = gamePinInput.value.trim();
        
        // Підготовка налаштувань бота
        const botOptions = {
            useTensorflow: useTensorflowToggle.checked,
            useML5: useML5Toggle.checked,
            useSearch: useSearchToggle.checked,
            delay: { min: 500, max: 2000 },
            logCallback: logMessage,
            proxyServerUrl: PROXY_SERVER_URL, // Використовуємо проксі-сервер на Render.com
            proxy: {
                enabled: true // Проксі завжди включено, оскільки воно налаштовано на сервері
            }
        };
        
        // Ініціалізація аналізатора ML якщо увімкнено
        if (botOptions.useTensorflow || botOptions.useML5) {
            const mlAnalyzer = new MLAnalyzer({
                useTensorflow: botOptions.useTensorflow,
                useML5: botOptions.useML5,
                modelPath: 'models/model.json',
                wordIndexPath: 'models/word_index.json',
                logCallback: logMessage
            });
            
            botOptions.mlAnalyzer = mlAnalyzer;
            logMessage('ML аналізатор ініціалізовано', 'success');
        }
        
        // Ініціалізація пошукового рушія якщо увімкнено
        if (botOptions.useSearch) {
            const searchEngine = new SearchEngine({
                logCallback: logMessage,
                useProxy: true, // Завжди використовуємо проксі
                proxyUrl: PROXY_SERVER_URL + '/kahoot-api'
            });
            
            botOptions.searchEngine = searchEngine;
            logMessage('Пошуковий рушій ініціалізовано', 'success');
        }
        
        // Створення екземпляру бота
        kahootBot = new KahootBot(botName, gamePin, botOptions);
        
        // Підключення до гри
        logMessage(`Підключення до гри з PIN: ${gamePin}...`, 'info');
        const connected = await kahootBot.connect();
        
        if (connected) {
            botRunning = true;
            statusIndicator.classList.add('online');
            startBotBtn.disabled = true;
            stopBotBtn.disabled = false;
            
            logMessage('Бот успішно підключений і готовий до гри!', 'success');
            
            // Збереження налаштувань у localStorage
            utils.saveToStorage('kahootBot.settings', {
                name: botName,
                useTensorflow: botOptions.useTensorflow,
                useML5: botOptions.useML5,
                useSearch: botOptions.useSearch
            });
        } else {
            startBotBtn.disabled = false;
            logMessage('Не вдалося підключитися до гри', 'error');
        }
    } catch (error) {
        logMessage(`Помилка запуску бота: ${error.message}`, 'error');
        startBotBtn.disabled = false;
    }
});

// Обробник події для кнопки зупинки бота
stopBotBtn.addEventListener('click', function() {
    if (!botRunning || !kahootBot) return;
    
    logMessage('Зупинка бота...', 'info');
    
    try {
        const disconnected = kahootBot.disconnect();
        
        if (disconnected) {
            botRunning = false;
            statusIndicator.classList.remove('online');
            startBotBtn.disabled = false;
            stopBotBtn.disabled = true;
            
            logMessage('Бот успішно зупинений', 'success');
        } else {
            logMessage('Не вдалося зупинити бота', 'error');
        }
    } catch (error) {
        logMessage(`Помилка зупинки бота: ${error.message}`, 'error');
    }
});

// Обробник для закриття сторінки
window.addEventListener('beforeunload', function(event) {
    if (botRunning && kahootBot) {
        kahootBot.disconnect();
    }
});

// Обробники подій для акордіонів
settingsHeader.addEventListener('click', toggleSettingsAccordion);
settingsToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleSettingsAccordion();
});

proxyHeader.addEventListener('click', toggleProxyAccordion);
proxyToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleProxyAccordion();
});

// Обробник події для кнопки перевірки проксі
testProxyBtn.addEventListener('click', checkProxy);

// Завантаження збережених налаштувань при завантаженні сторінки
document.addEventListener('DOMContentLoaded', function() {
    const savedSettings = utils.loadFromStorage('kahootBot.settings');
    
    if (savedSettings) {
        if (savedSettings.name) {
            botNameInput.value = savedSettings.name;
        }
        
        if (savedSettings.useTensorflow !== undefined) {
            useTensorflowToggle.checked = savedSettings.useTensorflow;
        }
        
        if (savedSettings.useML5 !== undefined) {
            useML5Toggle.checked = savedSettings.useML5;
        }
        
        if (savedSettings.useSearch !== undefined) {
            useSearchToggle.checked = savedSettings.useSearch;
        }
    }
    
    // Заповнюємо поля для проксі
    fillProxyFields();
    
    // Показуємо акордіон налаштувань за замовчуванням
    settingsToggle.classList.add('active');
    settingsContent.classList.add('active');
    settingsToggle.textContent = '▲';
    
    // Початкове логування
    logMessage('Бот готовий до роботи. Введіть дані та натисніть "Запустити бота".', 'info');
    logMessage(`Проксі-сервер налаштовано на ${PROXY_SERVER_URL}`, 'info');
    
    // Вимикаємо перемикач проксі, оскільки воно завжди увімкнено на Render.com
    if (useProxyToggle) {
        useProxyToggle.checked = true;
        useProxyToggle.disabled = true;
    }
    
    // Перевірка наявності необхідних бібліотек
    setTimeout(async function() {
        const tensorflowAvailable = typeof tf !== 'undefined';
        const ml5Available = typeof ml5 !== 'undefined';
        
        if (!tensorflowAvailable && (useTensorflowToggle.checked || useML5Toggle.checked)) {
            logMessage('Попередження: TensorFlow.js не завантажений. Деякі функції можуть не працювати.', 'warn');
        }
        
        if (!ml5Available && useML5Toggle.checked) {
            logMessage('Попередження: ML5.js не завантажений. Деякі функції можуть не працювати.', 'warn');
        }
        
        // Автоматична перевірка проксі при завантаженні
        await checkProxyServerConnection();
    }, 1000);
});