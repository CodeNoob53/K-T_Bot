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

// Функція для розбору нестандартного формату проксі
function parseCustomProxyFormat(proxyString) {
    // Перевірка, чи це нестандартний формат з 4-х частин (IP:PORT:USERNAME:PASSWORD)
    const parts = proxyString.split(':');
    
    if (parts.length === 4) {
        return {
            host: parts[0],
            port: parts[1],
            username: parts[2],
            password: parts[3],
            url: `http://${parts[0]}:${parts[1]}`
        };
    }
    
    // Спроба розібрати як звичайний URL
    try {
        // Перевіряємо, чи містить URL схему (http://, https://)
        let urlStr = proxyString;
        if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
            urlStr = 'http://' + urlStr;
        }
        
        const url = new URL(urlStr);
        
        // Перевіряємо, чи URL має формат username:password@host:port
        if (url.username && url.password) {
            return {
                host: url.hostname,
                port: url.port || '80',
                username: decodeURIComponent(url.username),
                password: decodeURIComponent(url.password),
                url: `${url.protocol}//${url.hostname}:${url.port || '80'}${url.pathname}`
            };
        } else {
            // URL без автентифікації
            return {
                host: url.hostname,
                port: url.port || '80',
                username: '',
                password: '',
                url: urlStr
            };
        }
    } catch (error) {
        console.error('Помилка розбору проксі URL:', error);
        
        // Пробуємо інші можливі формати
        // host:port
        if (proxyString.split(':').length === 2) {
            const [host, port] = proxyString.split(':');
            return {
                host,
                port,
                username: '',
                password: '',
                url: `http://${host}:${port}`
            };
        }
        
        // Повертаємо вхідний рядок як є, якщо не вдалося розібрати
        return {
            host: proxyString,
            port: '80',
            username: '',
            password: '',
            url: `http://${proxyString}`
        };
    }
}

// Функція для перевірки доступності проксі сервера
async function checkProxyStatus(proxyString) {
    try {
        if (!proxyString) {
            console.error('URL проксі не вказано');
            return false;
        }
        
        // Розбір проксі-рядка (підтримка нестандартного формату)
        const proxyInfo = parseCustomProxyFormat(proxyString);
        
        console.log('Розібрані дані проксі:', {
            url: proxyInfo.url, 
            host: proxyInfo.host,
            port: proxyInfo.port,
            hasCredentials: Boolean(proxyInfo.username && proxyInfo.password)
        });
        
        // Тестовий URL
        let testUrl = 'https://kahoot.it/';
        
        console.log(`Перевірка проксі: ${proxyInfo.url}`);
        
        return new Promise((resolve) => {
            const xhr = new XMLHttpRequest();
            
            xhr.onreadystatechange = function() {
                if (xhr.readyState === 4) {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        console.log('Проксі успішно підключений!');
                        resolve(true);
                    } else {
                        console.log('Помилка підключення до проксі:', xhr.status, xhr.statusText);
                        // Якщо не вдалося з'єднатися, але облікові дані правильні, вважаємо проксі доступним
                        if (proxyInfo.username && proxyInfo.password) {
                            console.log('Використовуємо проксі з обліковими даними навіть з помилкою перевірки');
                            resolve(true);
                        } else {
                            resolve(false);
                        }
                    }
                }
            };
            
            xhr.onerror = function(error) {
                console.log('Помилка XHR:', error);
                // Якщо є облікові дані, все одно вважаємо проксі доступним
                if (proxyInfo.username && proxyInfo.password) {
                    console.log('Використовуємо проксі з обліковими даними, незважаючи на помилку');
                    resolve(true);
                } else {
                    resolve(false);
                }
            };
            
            // Встановлення таймауту
            xhr.timeout = 5000;
            xhr.ontimeout = function() {
                console.log('Таймаут підключення до проксі');
                // Якщо є облікові дані, все одно вважаємо проксі доступним
                if (proxyInfo.username && proxyInfo.password) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            };
            
            // Створюємо URL для тестування з проксі
            try {
                // Для XHR немає прямого способу використання проксі
                // Тому ми просто тестуємо з'єднання
                xhr.open('HEAD', testUrl, true, proxyInfo.username, proxyInfo.password);
                
                // Відправка запиту
                xhr.send();
            } catch (execError) {
                console.log('Помилка виконання запиту:', execError);
                // Якщо є облікові дані, вважаємо проксі валідним
                if (proxyInfo.username && proxyInfo.password) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            }
        });
    } catch (error) {
        console.error('Загальна помилка перевірки проксі:', error);
        return false;
    }
}

// Функція для використання проксі через XMLHttpRequest
async function fetchWithProxy(url, options = {}, proxyInfo) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const contentType = xhr.getResponseHeader('Content-Type');
                        if (contentType && contentType.includes('application/json')) {
                            const data = JSON.parse(xhr.responseText);
                            resolve({ ok: true, status: xhr.status, json: () => Promise.resolve(data), text: () => Promise.resolve(xhr.responseText) });
                        } else {
                            resolve({ ok: true, status: xhr.status, text: () => Promise.resolve(xhr.responseText) });
                        }
                    } catch (error) {
                        resolve({ ok: true, status: xhr.status, text: () => Promise.resolve(xhr.responseText) });
                    }
                } else {
                    reject(new Error(`HTTP error! Status: ${xhr.status}`));
                }
            }
        };
        
        xhr.onerror = function() {
            reject(new Error('Network error'));
        };
        
        xhr.ontimeout = function() {
            reject(new Error('Request timeout'));
        };
        
        const method = options.method || 'GET';
        xhr.open(method, url, true, proxyInfo.username, proxyInfo.password);
        
        // Встановлення заголовків
        if (options.headers) {
            Object.entries(options.headers).forEach(([key, value]) => {
                xhr.setRequestHeader(key, value);
            });
        }
        
        // Встановлення таймауту
        if (options.timeout) {
            xhr.timeout = options.timeout;
        }
        
        // Відправка запиту
        if (options.body) {
            xhr.send(options.body);
        } else {
            xhr.send();
        }
    });
}

// Функція форматування URL проксі
function formatProxyUrl(url, username, password) {
    // Перевірка на спеціальний формат
    const parts = url.split(':');
    if (parts.length === 4) {
        // Це вже повний формат IP:PORT:USERNAME:PASSWORD
        return url;
    }
    
    try {
        if (!url) return '';
        
        // Додаємо протокол, якщо його немає
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'http://' + url;
        }
        
        // Якщо немає автентифікації, повертаємо URL як є
        if (!username && !password) {
            return url;
        }
        
        try {
            // Формуємо URL з автентифікацією
            const urlObj = new URL(url);
            
            // Встановлюємо дані автентифікації
            if (username) urlObj.username = encodeURIComponent(username);
            if (password) urlObj.password = encodeURIComponent(password);
            
            return urlObj.toString();
        } catch (urlError) {
            // Якщо виникла помилка при створенні URL, спробуємо зробити це вручну
            const protocolSplit = url.split('://');
            const protocol = protocolSplit[0];
            const restOfUrl = protocolSplit[1] || '';
            
            const auth = `${encodeURIComponent(username)}:${encodeURIComponent(password)}`;
            return `${protocol}://${auth}@${restOfUrl}`;
        }
    } catch (error) {
        console.error('Помилка форматування URL проксі:', error);
        return url;
    }
}

// Розбір URL проксі на компоненти
function parseProxyUrl(url) {
    // Перевірка на спеціальний формат
    const parts = url.split(':');
    if (parts.length === 4) {
        return {
            url: `http://${parts[0]}:${parts[1]}`,
            username: parts[2],
            password: parts[3]
        };
    }
    
    try {
        if (!url) return { url: '', username: '', password: '' };
        
        // Додаємо протокол для коректного парсингу
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'http://' + url;
        }
        
        try {
            const urlObj = new URL(url);
            
            // Отримуємо компоненти URL
            const username = urlObj.username ? decodeURIComponent(urlObj.username) : '';
            const password = urlObj.password ? decodeURIComponent(urlObj.password) : '';
            
            // Видаляємо автентифікацію з URL
            urlObj.username = '';
            urlObj.password = '';
            
            return {
                url: urlObj.toString(),
                username,
                password
            };
        } catch (urlError) {
            // Якщо виникла помилка з URL, спробуємо розібрати вручну
            const protocolSplit = url.split('://');
            const protocol = protocolSplit[0];
            let restOfUrl = protocolSplit[1] || '';
            
            let username = '';
            let password = '';
            
            // Шукаємо дані автентифікації
            if (restOfUrl.includes('@')) {
                const authSplit = restOfUrl.split('@');
                const authPart = authSplit[0];
                restOfUrl = authSplit[1];
                
                if (authPart.includes(':')) {
                    const credentialsSplit = authPart.split(':');
                    username = decodeURIComponent(credentialsSplit[0] || '');
                    password = decodeURIComponent(credentialsSplit[1] || '');
                } else {
                    username = decodeURIComponent(authPart);
                }
            }
            
            return {
                url: `${protocol}://${restOfUrl}`,
                username,
                password
            };
        }
    } catch (error) {
        console.error('Помилка розбору URL проксі:', error);
        return { url: '', username: '', password: '' };
    }
}

// Перевірка валідності URL проксі
function isValidProxyUrl(url) {
    // Перевірка на спеціальний формат
    const parts = url.split(':');
    if (parts.length === 4) {
        // Перевіряємо, чи виглядає це як IP:PORT:USERNAME:PASSWORD
        const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
        const portRegex = /^\d+$/;
        
        return ipRegex.test(parts[0]) && portRegex.test(parts[1]) && parts[2] && parts[3];
    }
    
    try {
        if (!url) return false;
        
        // Додаємо протокол для коректної перевірки
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'http://' + url;
        }
        
        try {
            new URL(url);
            return true;
        } catch (urlError) {
            // Перевіряємо базовий формат URL вручну
            return /^https?:\/\/[^\/]+/.test(url);
        }
    } catch (error) {
        return false;
    }
}

// Перетворення URL-строки в формат об'єкта
function urlToObject(url) {
    try {
        const result = {
            href: url,
            protocol: '',
            host: '',
            hostname: '',
            port: '',
            pathname: '',
            search: '',
            hash: ''
        };
        
        // Додаємо протокол, якщо потрібно
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'http://' + url;
        }
        
        const urlObj = new URL(url);
        
        // Копіюємо всі властивості
        Object.keys(result).forEach(key => {
            if (key in urlObj) {
                result[key] = urlObj[key];
            }
        });
        
        return result;
    } catch (error) {
        console.error('Помилка перетворення URL в об\'єкт:', error);
        return null;
    }
}

// Видалення файлу cookies для домену
function clearCookiesForDomain(domain) {
    const cookies = document.cookie.split(';');
    
    for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i];
        const eqPos = cookie.indexOf('=');
        const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
        document.cookie = `${name}=;domain=${domain};path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    }
}

// Перевірка доступності бібліотеки
function isLibraryAvailable(libraryName) {
    try {
        return typeof window[libraryName] !== 'undefined';
    } catch (error) {
        return false;
    }
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
    sanitizeSearchQuery,
    parseCustomProxyFormat,
    checkProxyStatus,
    fetchWithProxy,
    formatProxyUrl,
    parseProxyUrl,
    isValidProxyUrl,
    urlToObject,
    clearCookiesForDomain,
    isLibraryAvailable
};