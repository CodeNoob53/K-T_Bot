/**
 * Головний файл для керування Kahoot-ботом
 * Адаптований для роботи з проксі-сервером на Render.com
 */

import { KahootBot } from './KahootBot.js';
import { MLAnalyzer } from './MLAnalyzer.js';
import { SearchEngine } from './SearchEngine.js';
import * as utils from './utils.js';

// Адреса проксі-сервера на Render.com
// !!! ВАЖЛИВО: Тут має бути точна адреса вашого Render.com сервера
const PROXY_SERVER_URL = 'https://kahootbot-serve.onrender.com';

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

// Елементи проксі
const proxyUrlInput = document.getElementById('proxyUrl');
const proxyIpElement = document.getElementById('proxyIp');
const proxyPortElement = document.getElementById('proxyPort');
const proxyLoginElement = document.getElementById('proxyLogin');
const proxyPasswordElement = document.getElementById('proxyPassword');
const testProxyBtn = document.getElementById('testProxy');
const proxyStatusIndicator = document.getElementById('proxyStatusIndicator');
const proxyStatusText = document.getElementById('proxyStatusText');

// Елементи акордіону налаштувань
const settingsHeader = document.getElementById('settingsHeader');
const settingsToggle = document.getElementById('settingsToggle');
const settingsContent = document.getElementById('settingsContent');

// Змінні стану
let botRunning = false;
let kahootBot = null;

// Дані проксі-сервера (ініціалізуємо порожніми значеннями)
let proxyConfig = {
  host: '',
  port: '',
  auth: {
    username: '',
    password: ''
  }
};

// Функція логування подій
function logMessage(message, type = 'info') {
  utils.logToElement(message, 'logContainer', type);
}

// Функція оновлення відображення даних проксі
function updateProxyDisplay() {
  proxyIpElement.textContent = proxyConfig.host || 'Не вказано';
  proxyPortElement.textContent = proxyConfig.port || 'Не вказано';
  proxyLoginElement.textContent = proxyConfig.auth.username || 'Не вказано';
  proxyPasswordElement.textContent = proxyConfig.auth.password ? '••••••••' : 'Не вказано'; // Маскування паролю
}

// Функція розбору введеного URL проксі
function parseProxyUrl(url) {
  try {
    // Перевірка на формат IP:PORT:LOGIN:PASSWORD
    const parts = url.split(':');
    if (parts.length === 4) {
      const [host, port, username, password] = parts;
      // Перевірка чи IP та PORT є валідними
      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) && /^\d+$/.test(port)) {
        return {
          host,
          port: parseInt(port, 10),
          auth: {
            username,
            password
          }
        };
      }
    }
    // Перевірка на формат IP:PORT
    else if (parts.length === 2) {
      const [host, port] = parts;
      // Перевірка чи IP та PORT є валідними
      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) && /^\d+$/.test(port)) {
        return {
          host,
          port: parseInt(port, 10),
          auth: {
            username: '',
            password: ''
          }
        };
      }
    }
    
    throw new Error('Невірний формат проксі. Використовуйте формат IP:PORT або IP:PORT:LOGIN:PASSWORD');
  } catch (error) {
    logMessage(`Помилка розбору проксі URL: ${error.message}`, 'error');
    return null;
  }
}

// Перевірка полів форми
function validateForm() {
  const botName = botNameInput.value.trim();
  const gamePin = gamePinInput.value.trim();
  const proxyUrl = proxyUrlInput.value.trim();
  
  if (!botName) {
    logMessage('Помилка: Введіть ім\'я бота', 'error');
    return false;
  }
  
  if (!gamePin || !utils.isValidKahootPin(gamePin)) {
    logMessage('Помилка: Введіть коректний PIN-код гри (6-10 цифр)', 'error');
    return false;
  }
  
  if (!proxyUrl) {
    logMessage('Помилка: Введіть адресу проксі у форматі IP:PORT або IP:PORT:LOGIN:PASSWORD', 'error');
    return false;
  }
  
  // Оновлення конфігурації проксі
  const newProxyConfig = parseProxyUrl(proxyUrl);
  if (!newProxyConfig) {
    return false;
  }
  
  // Оновлюємо конфігурацію проксі
  proxyConfig = newProxyConfig;
  
  // Оновлюємо відображення
  updateProxyDisplay();
  
  return true;
}

// Формування URL проксі-сервера
function getProxyServerUrl() {
  // Перевіряємо, що сервер доступний за вказаною адресою
  if (!PROXY_SERVER_URL || PROXY_SERVER_URL.includes('your-render-app-name')) {
    logMessage('Помилка: URL проксі-сервера не налаштований правильно', 'error');
    return null;
  }
  return PROXY_SERVER_URL;
}

// Оновлення конфігурації проксі на сервері
async function updateServerProxyConfig() {
  try {
    const proxyServerUrl = getProxyServerUrl();
    if (!proxyServerUrl) {
      throw new Error('URL проксі-сервера не вказано або вказано неправильно');
    }

    logMessage(`Надсилання налаштувань проксі на сервер: ${proxyServerUrl}/set-proxy`, 'info');
    
    const response = await fetch(`${proxyServerUrl}/set-proxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        host: proxyConfig.host,
        port: proxyConfig.port,
        username: proxyConfig.auth.username,
        password: proxyConfig.auth.password
      })
    });
    
    if (!response.ok) {
      throw new Error(`Помилка оновлення конфігурації проксі: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    logMessage('Конфігурація проксі успішно оновлена на сервері', 'success');
    return true;
  } catch (error) {
    logMessage(`Помилка оновлення конфігурації проксі на сервері: ${error.message}`, 'error');
    return false;
  }
}

// Перевірка доступності проксі-сервера на Render.com
async function checkProxyServerConnection() {
  try {
    const proxyServerUrl = getProxyServerUrl();
    if (!proxyServerUrl) {
      return false;
    }
    
    logMessage('Перевірка з\'єднання з проксі-сервером...', 'info');
    
    // Перевіряємо з'єднання з проксі-сервером
    const testConnectionResponse = await fetch(`${proxyServerUrl}/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!testConnectionResponse.ok) {
      throw new Error(`Не вдалося з'єднатися з проксі-сервером: ${testConnectionResponse.status}`);
    }
    
    // Спочатку оновлюємо конфігурацію проксі на сервері
    const configUpdated = await updateServerProxyConfig();
    if (!configUpdated) {
      return false;
    }
    
    // Перевіряємо, чи правильно налаштовано проксі
    const testProxyResponse = await fetch(`${proxyServerUrl}/test-proxy`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!testProxyResponse.ok) {
      throw new Error(`Помилка перевірки проксі: ${testProxyResponse.status}`);
    }
    
    const testData = await testProxyResponse.json();
    if (!testData.success) {
      throw new Error(testData.message || 'Проксі не працює');
    }
    
    logMessage(`Проксі-сервер доступний: ${JSON.stringify(testData)}`, 'success');
    return true;
  } catch (error) {
    logMessage(`Помилка перевірки проксі-сервера: ${error.message}`, 'error');
    const proxyServerUrl = getProxyServerUrl();
    logMessage(`Переконайтеся, що проксі-сервер запущено на ${proxyServerUrl}`, 'warn');
    return false;
  }
}

// Перевірка проксі-сервера через інтерфейс користувача
async function checkProxy() {
  updateProxyStatus('warning', 'Перевірка доступності проксі-сервера...');
  
  // Валідація введених даних проксі
  const proxyUrl = proxyUrlInput.value.trim();
  if (!proxyUrl) {
    updateProxyStatus('error', 'Помилка: Введіть адресу проксі');
    return;
  }
  
  // Оновлення конфігурації проксі
  const newProxyConfig = parseProxyUrl(proxyUrl);
  if (!newProxyConfig) {
    updateProxyStatus('error', 'Помилка: Невірний формат проксі');
    return;
  }
  
  // Оновлюємо конфігурацію проксі
  proxyConfig = newProxyConfig;
  
  // Оновлюємо відображення
  updateProxyDisplay();
  
  try {
    // Перевіряємо з'єднання з сервером Render
    const serverUrl = getProxyServerUrl();
    if (!serverUrl) {
      updateProxyStatus('error', 'Помилка: Не налаштовано URL проксі-сервера');
      return;
    }
    
    // Перевіряємо з'єднання
    const response = await fetch(`${serverUrl}/`);
    if (!response.ok) {
      updateProxyStatus('error', `Помилка з'єднання з сервером: ${response.status}`);
      return;
    }
    
    // Перевіряємо конфігурацію проксі
    const isAvailable = await checkProxyServerConnection();
    
    if (isAvailable) {
      updateProxyStatus('success', 'Проксі-сервер доступний і працює');
      
      // Збереження налаштувань проксі у localStorage
      utils.saveToStorage('kahootBot.proxy', {
        url: `${proxyConfig.host}:${proxyConfig.port}:${proxyConfig.auth.username}:${proxyConfig.auth.password}`
      });
    } else {
      updateProxyStatus('error', 'Помилка: Проксі-сервер недоступний');
    }
  } catch (error) {
    updateProxyStatus('error', `Помилка: ${error.message}`);
    console.error('Помилка перевірки проксі:', error);
  }
}

// Функція оновлення статусу проксі
function updateProxyStatus(status, message) {
  proxyStatusIndicator.classList.remove('success', 'warning', 'error');
  proxyStatusIndicator.classList.add(status);
  proxyStatusText.textContent = message;
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
  
  // Перевірка доступності проксі-сервера
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
      proxyServerUrl: getProxyServerUrl(),
      proxy: {
        enabled: true, // Проксі завжди включено
        host: proxyConfig.host,
        port: proxyConfig.port,
        auth: proxyConfig.auth
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
        proxyUrl: getProxyServerUrl() + '/kahoot-api'
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
        useSearch: botOptions.useSearch,
        proxy: `${proxyConfig.host}:${proxyConfig.port}:${proxyConfig.auth.username}:${proxyConfig.auth.password}`
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
settingsHeader.addEventListener('click', function() {
  settingsToggle.classList.toggle('active');
  settingsContent.classList.toggle('active');
  settingsToggle.textContent = settingsToggle.classList.contains('active') ? '▲' : '▼';
});

// Обробник події для кнопки перевірки проксі
testProxyBtn.addEventListener('click', checkProxy);

// Оновлення проксі при зміні значення поля
proxyUrlInput.addEventListener('change', function() {
  const proxyUrl = proxyUrlInput.value.trim();
  if (proxyUrl) {
    const newProxyConfig = parseProxyUrl(proxyUrl);
    if (newProxyConfig) {
      proxyConfig = newProxyConfig;
      updateProxyDisplay();
      
      // Збереження налаштувань проксі у localStorage
      utils.saveToStorage('kahootBot.proxy', {
        url: `${proxyConfig.host}:${proxyConfig.port}:${proxyConfig.auth.username}:${proxyConfig.auth.password}`
      });
    }
  }
});

// Завантаження збережених налаштувань при завантаженні сторінки
document.addEventListener('DOMContentLoaded', function() {
  const savedSettings = utils.loadFromStorage('kahootBot.settings');
  const savedProxy = utils.loadFromStorage('kahootBot.proxy');
  
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
    
    if (savedSettings.proxy) {
      proxyUrlInput.value = savedSettings.proxy;
      // Оновлюємо конфігурацію проксі з збережених даних
      const newProxyConfig = parseProxyUrl(savedSettings.proxy);
      if (newProxyConfig) {
        proxyConfig = newProxyConfig;
      }
    }
  } else if (savedProxy && savedProxy.url) {
    proxyUrlInput.value = savedProxy.url;
    // Оновлюємо конфігурацію проксі з збережених даних
    const newProxyConfig = parseProxyUrl(savedProxy.url);
    if (newProxyConfig) {
      proxyConfig = newProxyConfig;
    }
  }
  
  // Оновлюємо відображення проксі
  updateProxyDisplay();
  
  // Показуємо акордіон налаштувань за замовчуванням
  settingsToggle.classList.add('active');
  settingsContent.classList.add('active');
  settingsToggle.textContent = '▲';
  
  // Початкове логування
  logMessage('Бот готовий до роботи. Введіть дані та натисніть "Запустити бота".', 'info');
  
  // Перевірка URL проксі-сервера
  const proxyServerUrl = getProxyServerUrl();
  if (proxyServerUrl) {
    logMessage(`Проксі-сервер налаштовано на ${proxyServerUrl}`, 'info');
  } else {
    logMessage('УВАГА: URL проксі-сервера не налаштовано правильно!', 'error');
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
  }, 1000);
});