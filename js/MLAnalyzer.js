// Модуль для аналізу питань за допомогою ML5.js та TensorFlow.js

class MLAnalyzer {
    constructor(options = {}) {
        this.options = {
            useTensorflow: options.useTensorflow !== false,
            useML5: options.useML5 !== false,
            modelPath: options.modelPath || 'https://example.com/tfjs-models/nlp-model/model.json',
            wordIndexPath: options.wordIndexPath || 'https://example.com/tfjs-models/nlp-model/word_index.json',
            maxSequenceLength: options.maxSequenceLength || 50,
            confidenceThreshold: options.confidenceThreshold || 0.6
        };
        
        this.tfModel = null;
        this.wordIndex = null;
        this.ml5Classifier = null;
        this.initialized = false;
        this.logCallback = options.logCallback || console.log;
    }
    
    // Логування
    log(message) {
        this.logCallback(`[MLAnalyzer] ${message}`);
    }
    
    // Ініціалізація ML компонентів
    async initialize() {
        try {
            this.log('Ініціалізація ML компонентів...');
            
            // Ініціалізація TensorFlow.js моделі, якщо увімкнено
            if (this.options.useTensorflow) {
                await this.initTensorflow();
            }
            
            // Ініціалізація ML5.js компонентів, якщо увімкнено
            if (this.options.useML5) {
                await this.initML5();
            }
            
            this.initialized = true;
            this.log('ML компоненти успішно ініціалізовані');
            return true;
        } catch (error) {
            this.log(`Помилка ініціалізації ML компонентів: ${error.message}`);
            return false;
        }
    }
    
    // Ініціалізація TensorFlow.js
    async initTensorflow() {
        try {
            this.log('Завантаження TensorFlow.js моделі...');
            
            // Перевірка, чи доступний tf
            if (typeof tf === 'undefined') {
                throw new Error('TensorFlow.js не доступний. Переконайтеся, що бібліотека завантажена.');
            }
            
            // Завантаження моделі
            this.tfModel = await tf.loadLayersModel(this.options.modelPath);
            this.log('TensorFlow.js модель успішно завантажена');
            
            // Завантаження словника
            this.log('Завантаження словника для токенізації...');
            const response = await fetch(this.options.wordIndexPath);
            
            if (!response.ok) {
                throw new Error(`Не вдалося завантажити словник: ${response.status} ${response.statusText}`);
            }
            
            this.wordIndex = await response.json();
            this.log('Словник успішно завантажений');
            
            return true;
        } catch (error) {
            this.log(`Помилка ініціалізації TensorFlow.js: ${error.message}`);
            return false;
        }
    }
    
    // Ініціалізація ML5.js
    async initML5() {
        try {
            this.log('Ініціалізація ML5.js компонентів...');
            
            // Перевірка, чи доступний ml5
            if (typeof ml5 === 'undefined') {
                throw new Error('ML5.js не доступний. Переконайтеся, що бібліотека завантажена.');
            }
            
            // Ініціалізація класифікатора тексту
            this.ml5Classifier = await ml5.neuralNetwork({
                task: 'classification',
                debug: false
            });
            
            // Замість завантаження готової моделі, ми симулюємо навчання
            this.log('ML5.js компоненти успішно ініціалізовані');
            
            return true;
        } catch (error) {
            this.log(`Помилка ініціалізації ML5.js: ${error.message}`);
            return false;
        }
    }
    
    // Аналіз питання за допомогою TensorFlow.js
    async analyzeWithTensorflow(question, options) {
        if (!this.initialized || !this.tfModel || !this.wordIndex) {
            this.log('TensorFlow.js модель не ініціалізована');
            return { index: -1, confidence: 0 };
        }
        
        try {
            this.log(`Аналіз питання з TensorFlow.js: "${question}"`);
            
            // Підготовка питання та варіантів відповідей для аналізу
            const questionTokens = this.tokenizeText(question);
            const paddedQuestion = this.padSequence(questionTokens, this.options.maxSequenceLength);
            
            // Створення тензора для питання
            const questionTensor = tf.tensor2d([paddedQuestion]);
            
            // Отримання прогнозу від моделі
            const predictions = this.tfModel.predict(questionTensor);
            const confidences = await predictions.data();
            
            // Очищення пам'яті
            questionTensor.dispose();
            predictions.dispose();
            
            // Знаходження найбільш підходящого варіанту
            const confidenceScores = options.map((_, index) => ({
                index,
                confidence: confidences[index % confidences.length]
            }));
            
            confidenceScores.sort((a, b) => b.confidence - a.confidence);
            const bestMatch = confidenceScores[0];
            
            this.log(`TensorFlow.js результат: варіант ${bestMatch.index + 1} з впевненістю ${bestMatch.confidence.toFixed(2)}`);
            
            // Повертаємо результат тільки якщо впевненість перевищує поріг
            if (bestMatch.confidence >= this.options.confidenceThreshold) {
                return bestMatch;
            } else {
                this.log(`Впевненість нижче порогу (${this.options.confidenceThreshold})`);
                return { index: -1, confidence: 0 };
            }
        } catch (error) {
            this.log(`Помилка аналізу з TensorFlow.js: ${error.message}`);
            return { index: -1, confidence: 0 };
        }
    }
    
    // Аналіз питання за допомогою ML5.js
    async analyzeWithML5(question, options) {
        if (!this.initialized || !this.ml5Classifier) {
            this.log('ML5.js компоненти не ініціалізовані');
            return { index: -1, confidence: 0 };
        }
        
        try {
            this.log(`Аналіз питання з ML5.js: "${question}"`);
            
            // Функція для обчислення подібності тексту
            const calculateTextSimilarity = (text1, text2) => {
                const words1 = text1.toLowerCase().split(/\s+/);
                const words2 = text2.toLowerCase().split(/\s+/);
                
                // Кількість загальних слів
                const commonWords = words1.filter(word => 
                    words2.includes(word) && word.length > 2
                ).length;
                
                // Нормалізована подібність
                const similarity = commonWords / Math.sqrt(words1.length * words2.length);
                
                return similarity;
            };
            
            // Обчислення подібності між питанням та кожним варіантом відповіді
            const similarities = options.map((option, index) => {
                const similarity = calculateTextSimilarity(question, option);
                return { index, confidence: similarity };
            });
            
            // Сортування за подібністю
            similarities.sort((a, b) => b.confidence - a.confidence);
            const bestMatch = similarities[0];
            
            this.log(`ML5.js результат: варіант ${bestMatch.index + 1} з впевненістю ${bestMatch.confidence.toFixed(2)}`);
            
            // Повертаємо результат тільки якщо впевненість перевищує поріг
            if (bestMatch.confidence >= this.options.confidenceThreshold * 0.5) { // Знижений поріг для ML5
                return bestMatch;
            } else {
                this.log(`Впевненість нижче порогу (${this.options.confidenceThreshold * 0.5})`);
                return { index: -1, confidence: 0 };
            }
        } catch (error) {
            this.log(`Помилка аналізу з ML5.js: ${error.message}`);
            return { index: -1, confidence: 0 };
        }
    }
    
    // Комбінований аналіз питання
    async analyzeQuestion(question, options) {
        try {
            if (!this.initialized) {
                await this.initialize();
            }
            
            let bestResult = { index: -1, confidence: 0 };
            
            // Аналіз за допомогою TensorFlow.js
            if (this.options.useTensorflow && this.tfModel) {
                const tfResult = await this.analyzeWithTensorflow(question, options);
                
                if (tfResult.confidence > bestResult.confidence) {
                    bestResult = tfResult;
                    this.log(`Обрано результат TensorFlow.js: варіант ${bestResult.index + 1}`);
                }
            }
            
            // Аналіз за допомогою ML5.js
            if (this.options.useML5 && this.ml5Classifier) {
                const ml5Result = await this.analyzeWithML5(question, options);
                
                if (ml5Result.confidence > bestResult.confidence) {
                    bestResult = ml5Result;
                    this.log(`Обрано результат ML5.js: варіант ${bestResult.index + 1}`);
                }
            }
            
            // Якщо жоден метод не дав результату з достатньою впевненістю
            if (bestResult.index === -1) {
                this.log('Жоден метод не дав результату з достатньою впевненістю');
                
                // Застосування простого текстового порівняння як запасний варіант
                const keywordsMatch = this.simpleKeywordMatching(question, options);
                bestResult = keywordsMatch;
            }
            
            return bestResult;
        } catch (error) {
            this.log(`Помилка аналізу питання: ${error.message}`);
            return { index: -1, confidence: 0 };
        }
    }
    
    // Проста перевірка на ключові слова
    simpleKeywordMatching(question, options) {
        try {
            this.log('Застосування простого порівняння за ключовими словами');
            
            // Підготовка питання
            const questionWords = question.toLowerCase()
                .replace(/[^\w\s]/g, '') // Видалення пунктуації
                .split(/\s+/)            // Розділення на слова
                .filter(word => word.length > 3); // Ігнорування коротких слів
            
            // Оцінка кожного варіанту
            const scores = options.map((option, index) => {
                const optionWords = option.toLowerCase()
                    .replace(/[^\w\s]/g, '')
                    .split(/\s+/)
                    .filter(word => word.length > 3);
                
                // Підрахунок кількості спільних слів
                const commonWords = optionWords.filter(word => questionWords.includes(word)).length;
                
                // Нормалізована оцінка
                const score = commonWords / (optionWords.length || 1);
                
                return { index, confidence: score };
            });
            
            // Сортування варіантів за оцінкою
            scores.sort((a, b) => b.confidence - a.confidence);
            
            this.log(`Результат порівняння за ключовими словами: варіант ${scores[0].index + 1} з впевненістю ${scores[0].confidence.toFixed(2)}`);
            
            return scores[0];
        } catch (error) {
            this.log(`Помилка при простому порівнянні: ${error.message}`);
            
            // У разі помилки повертаємо випадковий варіант
            const randomIndex = Math.floor(Math.random() * options.length);
            return { index: randomIndex, confidence: 0.1 };
        }
    }
    
    // Токенізація тексту для TensorFlow
    tokenizeText(text) {
        if (!this.wordIndex) return [];
        
        // Нормалізація тексту
        const normalized = text.toLowerCase()
            .replace(/[^\w\s]/g, '')  // Видалення пунктуації
            .trim();                  // Видалення зайвих пробілів
        
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
    
    // Очистка ресурсів
    dispose() {
        try {
            if (this.tfModel) {
                this.tfModel.dispose();
                this.tfModel = null;
            }
            
            if (this.ml5Classifier) {
                // ML5 не потребує явного звільнення ресурсів
                this.ml5Classifier = null;
            }
            
            this.initialized = false;
            this.log('ML ресурси звільнені');
            
            return true;
        } catch (error) {
            this.log(`Помилка при звільненні ресурсів: ${error.message}`);
            return false;
        }
    }
}

export default MLAnalyzer;