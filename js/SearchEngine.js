// Модуль для пошуку відповідей в інтернеті

class SearchEngine {
    constructor(options = {}) {
        this.apiKey = options.apiKey || '';
        this.searchEngineId = options.searchEngineId || '';
        this.useProxy = options.useProxy || false;
        this.proxyUrl = options.proxyUrl || '';
        this.cacheEnabled = options.cacheEnabled !== false;
        this.cache = {};
        this.logCallback = options.logCallback || console.log;
    }
    
    // Логування
    log(message) {
        this.logCallback(`[SearchEngine] ${message}`);
    }
    
    // Пошук в Google за допомогою Google Custom Search API
    async searchGoogle(query) {
        // Перевірка кешу
        if (this.cacheEnabled && this.cache[query]) {
            this.log(`Використання кешованих результатів для запиту: "${query}"`);
            return this.cache[query];
        }
        
        try {
            this.log(`Виконання пошуку Google для: "${query}"`);
            
            // Формування URL для запиту до Google Custom Search API
            const params = new URLSearchParams({
                key: this.apiKey,
                cx: this.searchEngineId,
                q: query
            });
            
            let url = `https://www.googleapis.com/customsearch/v1?${params.toString()}`;
            
            // Використання проксі, якщо необхідно
            if (this.useProxy) {
                url = `${this.proxyUrl}?url=${encodeURIComponent(url)}`;
            }
            
            // Виконання запиту
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Помилка пошуку: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Обробка результатів
            const results = this.parseGoogleResults(data);
            
            // Кешування результатів
            if (this.cacheEnabled) {
                this.cache[query] = results;
            }
            
            return results;
        } catch (error) {
            this.log(`Помилка пошуку Google: ${error.message}`);
            return [];
        }
    }
    
    // Розбір результатів пошуку Google
    parseGoogleResults(data) {
        if (!data.items || !Array.isArray(data.items)) {
            return [];
        }
        
        return data.items.map(item => ({
            title: item.title,
            snippet: item.snippet,
            link: item.link
        }));
    }
    
    // Альтернативний метод пошуку через DuckDuckGo (без API ключа)
    async searchDuckDuckGo(query) {
        try {
            this.log(`Виконання пошуку DuckDuckGo для: "${query}"`);
            
            // Формування URL для запиту до DuckDuckGo
            const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`;
            
            // Виконання запиту
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Помилка пошуку: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Обробка результатів
            const results = this.parseDuckDuckGoResults(data);
            
            return results;
        } catch (error) {
            this.log(`Помилка пошуку DuckDuckGo: ${error.message}`);
            return [];
        }
    }
    
    // Розбір результатів пошуку DuckDuckGo
    parseDuckDuckGoResults(data) {
        const results = [];
        
        // Додавання AbstractText, якщо є
        if (data.AbstractText) {
            results.push({
                title: data.Heading,
                snippet: data.AbstractText,
                link: data.AbstractURL
            });
        }
        
        // Додавання RelatedTopics
        if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
            for (const topic of data.RelatedTopics) {
                if (topic.Text) {
                    results.push({
                        title: topic.FirstURL,
                        snippet: topic.Text,
                        link: topic.FirstURL
                    });
                }
            }
        }
        
        return results;
    }
    
    // Аналіз результатів пошуку та знаходження найбільш релевантної відповіді
    async findBestAnswer(question, options) {
        try {
            this.log(`Пошук найкращої відповіді для питання: "${question}"`);
            
            // Формування запиту
            const query = question;
            
            // Виконання пошуку
            const results = await this.searchGoogle(query);
            
            if (results.length === 0) {
                this.log('Не знайдено результатів пошуку');
                return { index: -1, confidence: 0 };
            }
            
            // Об'єднання всіх сніппетів для аналізу
            const fullText = results.map(r => `${r.title} ${r.snippet}`).join(' ');
            
            // Оцінка кожного варіанту відповіді на основі кількості збігів у результатах пошуку
            const scores = options.map((option, index) => {
                const optionText = option.toLowerCase();
                const mainText = fullText.toLowerCase();
                
                // Простий підрахунок входжень
                const wordMatches = optionText.split(/\s+/).filter(word => {
                    if (word.length <= 2) return false; // Ігноруємо короткі слова
                    const regex = new RegExp(`\\b${word}\\b`, 'gi');
                    return mainText.match(regex);
                }).length;
                
                // Перевірка на точне входження фрази
                const exactMatch = mainText.includes(optionText) ? 3 : 0;
                
                // Загальний бал
                const score = wordMatches + exactMatch;
                
                return { index, score };
            });
            
            // Вибір варіанту з найвищим балом
            scores.sort((a, b) => b.score - a.score);
            const bestOption = scores[0];
            
            // Нормалізація впевненості (від 0 до 1)
            const maxPossibleScore = options[bestOption.index].split(/\s+/).length + 3;
            const confidence = Math.min(bestOption.score / maxPossibleScore, 1);
            
            // Логування результатів
            this.log(`Найкраща відповідь: "${options[bestOption.index]}" з впевненістю ${confidence.toFixed(2)}`);
            
            return {
                index: bestOption.index,
                confidence: confidence
            };
        } catch (error) {
            this.log(`Помилка пошуку відповіді: ${error.message}`);
            return { index: -1, confidence: 0 };
        }
    }
    
    // Використання TensorFlow для аналізу релевантності результатів
    async analyzeTfIdf(question, options, searchResults) {
        try {
            // Створення корпусу документів з результатів пошуку і варіантів відповідей
            const documents = searchResults.map(r => `${r.title} ${r.snippet}`);
            
            // Додавання питання та варіантів відповідей до корпусу
            documents.push(question);
            options.forEach(opt => documents.push(opt));
            
            // Створення словника термінів
            const terms = new Set();
            documents.forEach(doc => {
                const words = doc.toLowerCase().match(/\b\w+\b/g) || [];
                words.forEach(word => {
                    if (word.length > 2) { // Ігноруємо короткі слова
                        terms.add(word);
                    }
                });
            });
            
            // Обчислення TF-IDF матриці
            const termsList = Array.from(terms);
            const tfidfMatrix = [];
            
            documents.forEach(doc => {
                const vector = new Array(termsList.length).fill(0);
                const words = doc.toLowerCase().match(/\b\w+\b/g) || [];
                const wordCount = words.length;
                
                // Term Frequency (TF)
                words.forEach(word => {
                    if (word.length > 2) {
                        const index = termsList.indexOf(word);
                        if (index !== -1) {
                            vector[index] += 1 / wordCount;
                        }
                    }
                });
                
                // Inverse Document Frequency (IDF)
                termsList.forEach((term, i) => {
                    // Кількість документів, що містять термін
                    const docFreq = documents.filter(d => 
                        d.toLowerCase().match(new RegExp(`\\b${term}\\b`, 'g'))
                    ).length;
                    
                    // IDF
                    const idf = Math.log(documents.length / (1 + docFreq));
                    
                    // TF-IDF
                    vector[i] *= idf;
                });
                
                tfidfMatrix.push(vector);
            });
            
            // Обчислення косинусної подібності між питанням та варіантами відповідей
            const questionVector = tfidfMatrix[tfidfMatrix.length - options.length - 1];
            const similarities = [];
            
            for (let i = 0; i < options.length; i++) {
                const optionVector = tfidfMatrix[tfidfMatrix.length - options.length + i];
                const similarity = this.cosineSimilarity(questionVector, optionVector);
                similarities.push({ index: i, score: similarity });
            }
            
            // Вибір варіанту з найвищою подібністю
            similarities.sort((a, b) => b.score - a.score);
            
            return {
                index: similarities[0].index,
                confidence: similarities[0].score
            };
        } catch (error) {
            this.log(`Помилка TF-IDF аналізу: ${error.message}`);
            return { index: -1, confidence: 0 };
        }
    }
    
    // Розрахунок косинусної подібності між векторами
    cosineSimilarity(vecA, vecB) {
        const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
        
        const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
        const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
        
        if (normA === 0 || normB === 0) return 0;
        
        return dotProduct / (normA * normB);
    }
    
    // Очищення кешу
    clearCache() {
        this.cache = {};
        this.log('Кеш пошуку очищено');
    }
}

export default SearchEngine;