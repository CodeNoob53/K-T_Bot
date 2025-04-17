/**
 * Допоміжні функції для проєкту Kahoot-бот
 */

// Генерування унікального ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// Форматування часу
function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('uk-UA', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
    });
}

// Затримка виконання на вказаний час (мс)
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Випадкова затримка в межах діапазону
function randomDelay(min, max) {
    const delayTime = Math.floor(Math.random() * (max - min + 1) + min);
    return delay(delayTime);
}

// Збереження об'єкта в localStorage
function saveToStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
    } catch (error) {
        console.error('Помилка збереження даних:', error);
        return false;
    }
}

// Завантаження об'єкта з localStorage
function loadFromStorage(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error('Помилка завантаження даних:', error);
        return null;
    }
}

// Видалення даних з localStorage
function removeFromStorage(key) {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (error) {
        console.error('Помилка видалення даних:', error);
        return false;
    }
}

// Логування з часовою міткою
function log(message, type = 'info') {
    const timestamp = formatTime(Date.now());
    const formattedMessage = `[${timestamp}] ${message}`;
    
    switch (type.toLowerCase()) {
        case 'error':
            console.error(formattedMessage);
            break;
        case 'warn':
            console.warn(formattedMessage);
            break;
        case 'success':
            console.log(`%c${formattedMessage}`, 'color: green');
            break;
        default:
            console.log(formattedMessage);
    }
    
    return formattedMessage;
}

// Додавання запису в HTML-елемент логу
function logToElement(message, elementId, type = 'info') {
    const logElement = document.getElementById(elementId);
    if (!logElement) return false;
    
    const timestamp = formatTime(Date.now());
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry log-${type}`;
    logEntry.textContent = `[${timestamp}] ${message}`;
    
    logElement.appendChild(logEntry);
    logElement.scrollTop = logElement.scrollHeight;
    
    return true;
}

// Перевірка правильності PIN-коду Kahoot
function isValidKahootPin(pin) {
    return /^\d{6,10}$/.test(pin.toString());
}

// Перевірка з'єднання з інтернетом
async function checkInternetConnection() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch('https://www.google.com', { 
            method: 'HEAD',
            mode: 'no-cors',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        return true;
    } catch (error) {
        return false;
    }
}

// Перетворення тексту для пошуку
function sanitizeSearchQuery(text) {
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, '') // Видалення спеціальних символів
        .replace(/\s+/g, ' ')    // Заміна багатьох пробілів на один
        .trim();
}

// Експорт функцій
export {
    generateId,
    formatTime,
    delay,
    randomDelay,
    saveToStorage,
    loadFromStorage,
    removeFromStorage,
    log,
    logToElement,
    isValidKahootPin,
    checkInternetConnection,
    sanitizeSearchQuery
};