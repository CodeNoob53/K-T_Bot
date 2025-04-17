/**
 * Головний файл для керування Kahoot-ботом
 */

import KahootBot from './KahootBot.js';
import MLAnalyzer from './MLAnalyzer.js';
import SearchEngine from './SearchEngine.js';
import * as utils from './utils.js';

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
    
    logMessage('Ініціалізація бота...', 'info');
    startBotBtn.disabled = true;
    
    try {
        const botName = botNameInput.value.trim();
        const gamePin = gamePinInput.value.trim();
        
        // Налаштування бота
        const botOptions = {
            useTensorflow: useTensorflowToggle.checked,
            useML5: useML5Toggle.checked,
            useSearch: useSearchToggle.checked,
            delay: { min: 500, max: 2000 },
            logCallback: logMessage
        };
        
        // Ініціалізація аналізатора ML
        if (botOptions.useTensorflow || botOptions.useML5) {
            const mlAnalyzer = new MLAnalyzer({
                useTensorflow: botOptions.useTensorflow,
                useML5: botOptions.useML5,
                logCallback: logMessage
            });
            
            botOptions.mlAnalyzer = mlAnalyzer;
            logMessage('ML аналізатор ініціалізовано', 'success');
        }
        
        // Ініціалізація пошукового рушія
        if (botOptions.useSearch) {
            const searchEngine = new SearchEngine({
                logCallback: logMessage
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
    
    // Початкове логування
    logMessage('Бот готовий до роботи. Введіть дані та натисніть "Запустити бота".', 'info');
    
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