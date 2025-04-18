// Основний файл для роботи з Kahoot API
class KahootBot {
    constructor(name, pin, options = {}) {
        this.name = name;
        this.pin = pin;
        this.socket = null;
        this.clientId = '';
        this.sessionToken = '';
        this.challengeToken = '';
        this.options = {
            useTensorflow: options.useTensorflow || false,
            useML5: options.useML5 || false,
            useSearch: options.useSearch || false,
            delay: options.delay || { min: 500, max: 2000 },  // Затримка перед відповіддю в мс
            useProxy: options.useProxy !== false, // Увімкнення проксі за замовчуванням
            proxyUrl: options.proxyUrl || 'http://localhost:3000/kahoot-api' // URL проксі-сервера
        };
        
        this.currentQuestion = null;
        this.currentQuestionIndex = 0;
        this.answers = {};
        this.questionHistory = [];
        
        // Стан підключення
        this.connected = false;
        this.logCallback = options.logCallback || console.log;
        
        // Прив'язка модулів аналізу, якщо вони передані
        this.mlAnalyzer = options.mlAnalyzer || null;
        this.searchEngine = options.searchEngine || null;
        
        // Налаштування моделей ML, якщо увімкнено
        if (this.options.useTensorflow || this.options.useML5) {
            this.initMLComponents();
        }
    }
    
    // Логування з часовою міткою
    log(message) {
        this.logCallback(`[${new Date().toLocaleTimeString()}] ${message}`);
    }
    
    // Ініціалізація компонентів машинного навчання
    async initMLComponents() {
        try {
            this.log('Ініціалізація компонентів ML...');
            
            // Якщо є зовнішній аналізатор ML, використовуємо його
            if (this.mlAnalyzer) {
                await this.mlAnalyzer.initialize();
                this.log('Зовнішній ML аналізатор ініціалізовано');
                return;
            }
            
            // Інакше ініціалізуємо вбудовані компоненти
            if (this.options.useTensorflow) {
                this.initTensorflow();
            }
            
            if (this.options.useML5) {
                this.initML5();
            }
        } catch (error) {
            this.log(`Помилка ініціалізації ML компонентів: ${error.message}`);
        }
    }
    
    // Ініціалізація TensorFlow.js
    async initTensorflow() {
        try {
            this.log('Ініціалізація TensorFlow.js...');
            
            // Перевірка доступності TensorFlow
            if (typeof tf === 'undefined') {
                throw new Error('TensorFlow.js недоступний. Перевірте підключення бібліотеки.');
            }
            
            // Завантаження моделі для NLP аналізу
            this.tfModel = await tf.loadLayersModel('models/model.json');
            
            // Завантаження токенізатора або відображення слів
            const response = await fetch('models/word_index.json');
            this.wordIndex = await response.json();
                
            this.log('TensorFlow.js модель успішно завантажена');
        } catch (error) {
            this.log(`Помилка ініціалізації TensorFlow: ${error.message}`);
        }
    }
    
    // Ініціалізація ML5.js
    async initML5() {
        try {
            this.log('Ініціалізація ML5.js...');
            
            // Перевірка доступності ML5
            if (typeof ml5 === 'undefined') {
                throw new Error('ML5.js недоступний. Перевірте підключення бібліотеки.');
            }
            
            // Ініціалізація класифікатора тексту
            this.textClassifier = await ml5.neuralNetwork({
                task: 'classification',
                debug: false
            });
            
            this.log('ML5.js компоненти успішно ініціалізовані');
        } catch (error) {
            this.log(`Помилка ініціалізації ML5: ${error.message}`);
        }
    }
    
    // Підключення до сервера Kahoot
    async connect() {
        try {
            this.log(`Підключення до гри Kahoot з PIN: ${this.pin}...`);
            
            // Формування URL для запиту до API
            let apiUrl = `https://kahoot.it/reserve/session/${this.pin}`;
            
            // Використання проксі, якщо увімкнено
            if (this.options.useProxy) {
                apiUrl = `${this.options.proxyUrl}/reserve/session/${this.pin}`;
                this.log('Використання проксі-сервера для запитів до Kahoot API');
            }
            
            // Перший крок: отримання session token
            const sessionResponse = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'
                }
            });
            
            if (!sessionResponse.ok) {
                throw new Error(`Не вдалося підключитися до гри. Перевірте PIN-код. Статус: ${sessionResponse.status}`);
            }
            
            const sessionData = await sessionResponse.json();
            this.sessionToken = sessionData.token;
            this.challengeToken = sessionData.challenge;
            
            // Формування WebSocket URL
            let wsUrl = `wss://kahoot.it/cometd/${this.pin}/${this.sessionToken}`;
            
            // Якщо використовуємо проксі, додатково логуємо це
            if (this.options.useProxy) {
                this.log('Використання прямого WebSocket з\'єднання з Kahoot');
                // Примітка: для WebSocket з'єднання проксі потрібно налаштувати окремо
            }
            
            // Другий крок: створення WebSocket з'єднання
            this.socket = new WebSocket(wsUrl);
            
            // Встановлення обробників подій для WebSocket
            this.socket.onopen = this.handleSocketOpen.bind(this);
            this.socket.onmessage = this.handleSocketMessage.bind(this);
            this.socket.onerror = this.handleSocketError.bind(this);
            this.socket.onclose = this.handleSocketClose.bind(this);
            
            return new Promise((resolve, reject) => {
                // Таймаут для підключення
                const connectionTimeout = setTimeout(() => {
                    reject(new Error('Таймаут підключення до гри'));
                }, 10000);
                
                // Успішне підключення
                this.socket.addEventListener('open', () => {
                    clearTimeout(connectionTimeout);
                    this.connected = true;
                    resolve(true);
                }, { once: true });
                
                // Помилка підключення
                this.socket.addEventListener('error', (error) => {
                    clearTimeout(connectionTimeout);
                    reject(error);
                }, { once: true });
            });
        } catch (error) {
            this.log(`Помилка підключення: ${error.message}`);
            return false;
        }
    }
    
    // Обробник відкриття WebSocket з'єднання
    handleSocketOpen() {
        this.log('WebSocket з\'єднання встановлено');
        this.sendClientInfo();
    }
    
    // Відправка інформації про клієнта
    sendClientInfo() {
        this.log(`Відправка інформації про клієнта...`);
        
        // Формування повідомлення для handshake
        const handshakeMessage = {
            id: Date.now(),
            version: '1.0',
            minimumVersion: '1.0',
            channel: '/meta/handshake',
            supportedConnectionTypes: ['websocket', 'long-polling'],
            advice: {
                timeout: 60000,
                interval: 0
            }
        };
        
        this.socket.send(JSON.stringify([handshakeMessage]));
    }
    
    // Відправка реєстраційної інформації
    registerUser() {
        this.log(`Реєстрація з ім'ям: ${this.name}...`);
        
        // Формування повідомлення для реєстрації користувача
        const registerMessage = {
            id: Date.now(),
            channel: '/service/controller',
            data: {
                type: 'login',
                name: this.name
            }
        };
        
        this.socket.send(JSON.stringify([registerMessage]));
    }
    
    // Обробник повідомлень WebSocket
    async handleSocketMessage(event) {
        try {
            const messages = JSON.parse(event.data);
            
            for (const message of messages) {
                await this.processMessage(message);
            }
        } catch (error) {
            this.log(`Помилка обробки повідомлення: ${error.message}`);
        }
    }
    
    // Обробка отриманих повідомлень
    async processMessage(message) {
        const { channel, data, clientId, successful } = message;
        
        // Обробка handshake відповіді
        if (channel === '/meta/handshake' && successful) {
            this.clientId = clientId;
            this.log('Handshake успішний. Підключення до гри...');
            this.subscribeToChannels();
        }
        
        // Обробка успішної підписки
        if (channel === '/meta/subscribe' && successful) {
            this.log('Підписка на канали успішна');
            this.registerUser();
        }
        
        // Обробка повідомлень від гри
        if (channel === '/service/player') {
            await this.handleGameMessage(data);
        }
    }
    
    // Підписка на необхідні канали
    subscribeToChannels() {
        const subscriptions = [
            '/service/player',
            '/service/status',
            '/service/controller'
        ];
        
        for (const channel of subscriptions) {
            const subscribeMessage = {
                id: Date.now(),
                channel: '/meta/subscribe',
                subscription: channel,
                clientId: this.clientId
            };
            
            this.socket.send(JSON.stringify([subscribeMessage]));
        }
    }
    
    // Обробка ігрових повідомлень
    async handleGameMessage(data) {
        // Якщо повідомлення не має типу, ігноруємо його
        if (!data || !data.type) return;
        
        switch (data.type) {
            case 'quiz':
                this.log('Отримано інформацію про квіз');
                break;
                
            case 'question':
                this.currentQuestionIndex++;
                this.currentQuestion = data.question;
                this.log(`Отримано питання #${this.currentQuestionIndex}: "${data.question}"`);
                this.questionHistory.push({
                    index: this.currentQuestionIndex,
                    question: data.question,
                    options: data.options
                });
                
                // Аналіз питання і пошук відповіді
                await this.findAnswer(data.question, data.options);
                break;
                
            case 'questionEnd':
                this.log(`Завершено питання #${this.currentQuestionIndex}`);
                // Тут можна аналізувати результати відповіді
                break;
                
            case 'quizEnd':
                this.log('Квіз завершено');
                break;
                
            default:
                // Інші типи повідомлень
                break;
        }
    }
    
    // Аналіз питання та пошук відповіді
    async findAnswer(question, options) {
        this.log('Аналіз питання та пошук відповіді...');
        
        let bestAnswerIndex = -1;
        let confidence = 0;
        
        try {
            // Використання TensorFlow.js для аналізу
            if (this.options.useTensorflow && this.tfModel) {
                this.log('Використання TensorFlow.js для аналізу питання...');
                
                // Токенізація питання
                const sequence = this.tokenizeText(question);
                const paddedSequence = this.padSequence(sequence, 50);
                
                // Перетворення в тензор і нормалізація
                const tensor = tf.tensor2d([paddedSequence]);
                
                // Отримання прогнозів з моделі
                const predictions = this.tfModel.predict(tensor);
                const tfResults = await predictions.data();
                
                // Знаходження найбільш імовірної відповіді
                const maxIndex = tfResults.indexOf(Math.max(...tfResults));
                confidence = Math.max(...tfResults);
                
                if (confidence > 0.6) {
                    bestAnswerIndex = maxIndex % options.length;
                    this.log(`TensorFlow.js вибрав відповідь ${bestAnswerIndex + 1} з впевненістю ${confidence.toFixed(2)}`);
                } else {
                    this.log(`TensorFlow.js не зміг визначити відповідь з достатньою впевненістю`);
                }
            }
            
            // Використання ML5.js для аналізу
            if (this.options.useML5 && this.textClassifier && bestAnswerIndex === -1) {
                this.log('Використання ML5.js для аналізу питання...');
                
                // Аналіз питання за допомогою ML5
                const ml5Results = await this.analyzeWithML5(question, options);
                
                if (ml5Results.confidence > confidence) {
                    bestAnswerIndex = ml5Results.index;
                    confidence = ml5Results.confidence;
                    this.log(`ML5.js вибрав відповідь ${bestAnswerIndex + 1} з впевненістю ${confidence.toFixed(2)}`);
                }
            }
            
            // Пошук в інтернеті
            if (this.options.useSearch && bestAnswerIndex === -1) {
                this.log('Пошук відповіді в інтернеті...');
                
                const searchResults = await this.searchOnline(question, options);
                
                if (searchResults.confidence > confidence) {
                    bestAnswerIndex = searchResults.index;
                    confidence = searchResults.confidence;
                    this.log(`Пошук в інтернеті знайшов відповідь ${bestAnswerIndex + 1} з впевненістю ${confidence.toFixed(2)}`);
                }
            }
            
            // Якщо жоден метод не зміг знайти відповідь, вибираємо випадкову
            if (bestAnswerIndex === -1) {
                bestAnswerIndex = Math.floor(Math.random() * options.length);
                this.log(`Не вдалося знайти відповідь. Вибираємо випадкову відповідь: ${bestAnswerIndex + 1}`);
            }
            
            // Запам'ятовуємо відповідь
            this.answers[this.currentQuestionIndex] = {
                questionText: question,
                selectedIndex: bestAnswerIndex,
                confidence: confidence
            };
            
            // Відправляємо відповідь з невеликою затримкою для імітації людської поведінки
            const randomDelay = Math.floor(
                Math.random() * (this.options.delay.max - this.options.delay.min) + this.options.delay.min
            );
            
            this.log(`Відправлення відповіді через ${randomDelay}мс...`);
            setTimeout(() => {
                this.sendAnswer(bestAnswerIndex);
            }, randomDelay);
            
        } catch (error) {
            this.log(`Помилка при аналізі питання: ${error.message}`);
            // У разі помилки відправляємо випадкову відповідь
            bestAnswerIndex = Math.floor(Math.random() * options.length);
            this.sendAnswer(bestAnswerIndex);
        }
    }
    
    // Відправка відповіді на сервер Kahoot
    sendAnswer(answerIndex) {
        if (!this.connected || !this.socket) {
            this.log('Неможливо відправити відповідь: відсутнє з\'єднання');
            return false;
        }
        
        const answerMessage = {
            id: Date.now(),
            channel: '/service/controller',
            data: {
                type: 'answer',
                questionIndex: this.currentQuestionIndex - 1,
                answerIndex: answerIndex,
                meta: {
                    lag: Math.floor(Math.random() * 100)
                }
            },
            clientId: this.clientId
        };
        
        try {
            this.socket.send(JSON.stringify([answerMessage]));
            this.log(`Відповідь ${answerIndex + 1} успішно відправлена!`);
            return true;
        } catch (error) {
            this.log(`Помилка відправлення відповіді: ${error.message}`);
            return false;
        }
    }
    
    // Токенізація тексту для TensorFlow
    tokenizeText(text) {
        if (!this.wordIndex) return [];
        
        // Нормалізація тексту
        const normalized = text.toLowerCase().replace(/[^\w\s]/g, '');
        const words = normalized.split(/\s+/);
        
        // Перетворення слів у числові токени
        return words.map(word => {
            return this.wordIndex[word] || 0; // 0 для невідомих слів
        });
    }
    
    // Доповнення послідовності до фіксованої довжини
    padSequence(sequence, maxLen) {
        if (sequence.length > maxLen) {
            return sequence.slice(0, maxLen);
        }
        
        // Доповнення нулями
        return [...sequence, ...Array(maxLen - sequence.length).fill(0)];
    }
    
    // Аналіз питання за допомогою ML5.js
    async analyzeWithML5(question, options) {
        try {
            // Створення композитного зображення питання (для демонстрації)
            // У реальному випадку потрібна інша логіка для аналізу тексту через ML5
            
            // Симуляція результатів аналізу
            const confidences = options.map(() => Math.random());
            const maxIndex = confidences.indexOf(Math.max(...confidences));
            
            return {
                index: maxIndex,
                confidence: Math.max(...confidences)
            };
        } catch (error) {
            this.log(`Помилка аналізу ML5: ${error.message}`);
            return { index: -1, confidence: 0 };
        }
    }
    
    // Пошук відповіді в інтернеті
    async searchOnline(question, options) {
        try {
            // Формування запиту для пошуку
            const searchQuery = encodeURIComponent(question);
            
            // Виконання запиту до пошукової системи
            // В реальному проекті тут має бути реальний запит до API пошукової системи
            this.log(`Пошук: "${question}"`);
            
            // Симуляція відповіді від пошукової системи
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Аналіз результатів пошуку та порівняння з варіантами відповідей
            const optionScores = options.map((option, index) => {
                // Імітація оцінки релевантності кожного варіанту
                const score = Math.random();
                return { index, score };
            });
            
            // Вибір найбільш релевантного варіанту
            optionScores.sort((a, b) => b.score - a.score);
            const bestOption = optionScores[0];
            
            return {
                index: bestOption.index,
                confidence: bestOption.score
            };
        } catch (error) {
            this.log(`Помилка пошуку в інтернеті: ${error.message}`);
            return { index: -1, confidence: 0 };
        }
    }
    
    // Обробник помилок WebSocket
    handleSocketError(error) {
        this.log(`WebSocket помилка: ${error.message || 'Невідома помилка'}`);
        this.connected = false;
    }
    
    // Обробник закриття WebSocket
    handleSocketClose(event) {
        this.log(`WebSocket з'єднання закрито: ${event.code} ${event.reason}`);
        this.connected = false;
    }
    
    // Відключення від гри
    disconnect() {
        if (!this.connected || !this.socket) {
            this.log('Бот вже відключений');
            return true;
        }
        
        try {
            // Відправка повідомлення про вихід
            const leaveMessage = {
                id: Date.now(),
                channel: '/service/controller',
                data: {
                    type: 'leave'
                },
                clientId: this.clientId
            };
            
            this.socket.send(JSON.stringify([leaveMessage]));
            
            // Закриття WebSocket
            this.socket.close();
            this.socket = null;
            this.connected = false;
            
            this.log('Бот успішно відключений від гри');
            return true;
        } catch (error) {
            this.log(`Помилка відключення: ${error.message}`);
            return false;
        }
    }
}

// Експортуємо клас для використання в основному додатку
export default KahootBot;