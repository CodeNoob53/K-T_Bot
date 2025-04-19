// Адаптований для Render.com клас KahootBot
class KahootBot {
  constructor (name, pin, options = {}) {
    this.name = name;
    this.pin = pin;
    this.socket = null;
    this.clientId = '';
    this.sessionToken = '';
    this.challengeToken = '';
    
    // Налаштування сервера проксі
    // За замовчуванням використовуємо Render.com URL
    this.proxyServerUrl = options.proxyServerUrl || 'https://kahootbot-serve.onrender.com';
    
    this.options = {
      useTensorflow: options.useTensorflow || false,
      useML5: options.useML5 || false,
      useSearch: options.useSearch || false,
      delay: options.delay || { min: 500, max: 2000 }, // Затримка перед відповіддю в мс
      proxy: {
        enabled: options.proxy?.enabled || false,
        url: options.proxy?.url || '',
        auth: {
          username: options.proxy?.auth?.username || '',
          password: options.proxy?.auth?.password || ''
        }
      }
    };

    this.currentQuestion = null;
    this.currentQuestionIndex = 0;
    this.answers = {};
    this.questionHistory = [];

    // Стан підключення
    this.connected = false;
    this.logCallback = options.logCallback || console.log;

    // Прив'язка зовнішніх модулів, якщо вони надані
    this.mlAnalyzer = options.mlAnalyzer || null;
    this.searchEngine = options.searchEngine || null;

    // Ініціалізація ML компонентів, якщо увімкнено
    if (
      (this.options.useTensorflow || this.options.useML5) &&
      !this.mlAnalyzer
    ) {
      this.initMLComponents();
    }
  }

  // Логування з часовою міткою
  log (message) {
    this.logCallback(`[${new Date().toLocaleTimeString()}] ${message}`);
  }

  // Ініціалізація ML компонентів
  async initMLComponents () {
    try {
      this.log('Ініціалізація ML компонентів...');

      // Ініціалізація TensorFlow.js
      if (this.options.useTensorflow) {
        await this.initTensorflow();
      }

      // Ініціалізація ML5.js
      if (this.options.useML5) {
        await this.initML5();
      }

      this.log('ML компоненти ініціалізовано');
    } catch (error) {
      this.log(`Помилка ініціалізації ML компонентів: ${error.message}`);
    }
  }

  // Ініціалізація TensorFlow.js
  async initTensorflow () {
    try {
      this.log('Ініціалізація TensorFlow.js...');

      // Перевірка наявності TF
      if (typeof tf === 'undefined') {
        throw new Error(
          'TensorFlow.js не доступний. Переконайтеся, що бібліотека завантажена.'
        );
      }

      // Завантаження моделі для NLP аналізу
      this.tfModel = await tf.loadLayersModel('models/model.json');

      // Завантаження токенізатора або відображення слів
      const response = await fetch('models/word_index.json');
      if (!response.ok) {
        throw new Error(`Помилка завантаження словника: ${response.status}`);
      }

      this.wordIndex = await response.json();

      this.log('TensorFlow.js модель успішно завантажена');
    } catch (error) {
      this.log(`Помилка ініціалізації TensorFlow: ${error.message}`);
    }
  }

  // Ініціалізація ML5.js
  async initML5 () {
    try {
      this.log('Ініціалізація ML5.js...');

      // Перевірка наявності ML5
      if (typeof ml5 === 'undefined') {
        throw new Error(
          'ML5.js не доступний. Переконайтеся, що бібліотека завантажена.'
        );
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

  // Підключення до сервера Kahoot через проксі-сервер на Render.com
// Оновлений метод connect() для класу KahootBot
async connect() {
  try {
      this.log(`Підключення до гри Kahoot з PIN: ${this.pin}...`);
      
      // Формування URL для відправки запиту через проксі на Render
      const proxyKahootSessionUrl = `${this.proxyServerUrl}/kahoot-api/reserve/session/${this.pin}`;
      
      this.log(`Отримання сесійного токену через проксі-сервер: ${proxyKahootSessionUrl}`);
      
      // Отримання сесійного токену через проксі-сервер
      const response = await fetch(proxyKahootSessionUrl);
      
      if (!response.ok) {
          throw new Error(`Помилка відповіді від проксі-сервера: ${response.status} ${response.statusText}`);
      }
      
      const sessionData = await response.json();
      this.log(`Отримана відповідь від сервера: ${JSON.stringify(sessionData)}`);
      
      // Перевірка отриманих даних
      if (!sessionData || !sessionData.liveGameId) {
          throw new Error('Не вдалося отримати токен сесії (liveGameId)');
      }
      
      // Зберігаємо токени з правильних полів
      this.sessionToken = sessionData.liveGameId;
      
      // Розв'язання challenge-токену якщо він є
      if (sessionData.challenge) {
          this.log('Розшифрування challenge-токену...');
          
          try {
              const solveResponse = await fetch(`${this.proxyServerUrl}/kahoot-api/solve-challenge`, {
                  method: 'POST',
                  headers: {
                      'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ challenge: sessionData.challenge })
              });
              
              if (!solveResponse.ok) {
                  throw new Error(`Помилка розшифрування токену: ${solveResponse.status} ${solveResponse.statusText}`);
              }
              
              const solveData = await solveResponse.json();
              
              if (solveData.success && solveData.token) {
                  this.challengeToken = solveData.token;
                  this.log(`Отримано розшифрований challenge-токен: ${this.challengeToken.substring(0, 10)}...`);
              } else {
                  throw new Error('Не вдалося отримати розшифрований токен');
              }
          } catch (solveError) {
              this.log(`Помилка розшифрування challenge-токену: ${solveError.message}`);
              // Продовжуємо підключення без challenge-токену
          }
      }
      
      this.log(`Отримано токен сесії: ${this.sessionToken.substring(0, 10)}...`);
      
      // Формування URL для WebSocket з'єднання
      // Змінено формат звернення до проксі-сервера з додаванням challenge-токену
      let wsUrl;
      
      const wsProtocol = this.proxyServerUrl.startsWith('https://') ? 'wss://' : 'ws://';
      const hostPart = this.proxyServerUrl.replace('https://', '').replace('http://', '');
      
      if (this.challengeToken) {
          // Додаємо challenge-токен до URL
          wsUrl = `${wsProtocol}${hostPart}/kahoot-ws/cometd/${this.pin}/${this.sessionToken}/${this.challengeToken}`;
      } else {
          // Підключення без challenge-токену
          wsUrl = `${wsProtocol}${hostPart}/kahoot-ws/cometd/${this.pin}/${this.sessionToken}`;
      }
      
      this.log(`Підключення WebSocket через проксі: ${wsUrl}`);
      
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
              this.log(`Помилка WebSocket з'єднання: ${error.message || 'Невідома помилка'}`);
              reject(error);
          }, { once: true });
      });
  } catch (error) {
      this.log(`Помилка підключення: ${error.message}`);
      return false;
  }
}

// Оновлення обробки challenge-токену класу KahootBot
async solveChallenge(challengeData) {
  try {
      // Отримуємо функцію decode з challenge-токену
      const challenge = challengeData.challenge;
      if (!challenge) {
          throw new Error('Challenge токен не знайдено');
      }
      
      this.log('Розв\'язання challenge-токену...');
      
      // Надсилаємо запит до проксі-сервера для декодування challenge
      const solveUrl = `${this.proxyServerUrl}/kahoot-api/solve-challenge`;
      const response = await fetch(solveUrl, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json'
          },
          body: JSON.stringify({ challenge })
      });
      
      if (!response.ok) {
          throw new Error(`Помилка вирішення challenge: ${response.status}`);
      }
      
      const result = await response.json();
      if (!result.token) {
          throw new Error('Не вдалося отримати розв\'язаний токен');
      }
      
      return result.token;
  } catch (error) {
      this.log(`Помилка розв'язання challenge: ${error.message}`);
      return null;
  }
}

  // Обробник відкриття WebSocket з'єднання
  handleSocketOpen () {
    this.log("WebSocket з'єднання встановлено");
    this.sendClientInfo();
  }

  // Відправка інформації про клієнта

sendClientInfo() {
  this.log(`Відправка інформації про клієнта...`);

  // Формування повідомлення для handshake - оновлено для останньої версії протоколу Kahoot
  const handshakeMessage = {
    id: Date.now(),
    version: '1.0',
    minimumVersion: '1.0',
    channel: '/meta/handshake',
    supportedConnectionTypes: ['websocket', 'long-polling'],
    advice: {
      timeout: 60000,
      interval: 0
    },
    ext: {
      ack: true,
      timesync: {
        tc: Date.now(),
        l: 0,
        o: 0
      }
    }
  };

  try {
    this.socket.send(JSON.stringify([handshakeMessage]));
    this.log('Handshake повідомлення відправлено');
  } catch (error) {
    this.log(`Помилка відправки handshake: ${error.message}`);
  }
}

  // Відправка реєстраційної інформації
  registerUser () {
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
    // Додаємо логування для аналізу формату даних
    this.log(`Отримано WebSocket повідомлення: ${event.data.substring(0, 100)}...`);
    
    let messages;
    try {
      // Спробуємо розпарсити як JSON
      messages = JSON.parse(event.data);
    } catch (parseError) {
      this.log(`Помилка розбору JSON: ${parseError.message}`);
      return;
    }
    
    // Перевіряємо тип даних - масив чи об'єкт
    if (Array.isArray(messages)) {
      // Якщо масив, обробляємо як раніше
      for (const message of messages) {
        await this.processMessage(message);
      }
    } else if (typeof messages === 'object' && messages !== null) {
      // Якщо об'єкт, обробляємо як одне повідомлення
      await this.processMessage(messages);
    } else {
      this.log(`Невідомий формат повідомлення: ${typeof messages}`);
    }
  } catch (error) {
    this.log(`Помилка обробки повідомлення: ${error.message}`);
  }
}

  // Обробка отриманих повідомлень
  async processMessage (message) {
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
  subscribeToChannels () {
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
  async handleGameMessage (data) {
    // Якщо повідомлення не має типу, ігноруємо його
    if (!data || !data.type) return;

    switch (data.type) {
      case 'quiz':
        this.log('Отримано інформацію про квіз');
        break;

      case 'question':
        this.currentQuestionIndex++;
        this.currentQuestion = data.question;
        this.log(
          `Отримано питання #${this.currentQuestionIndex}: "${data.question}"`
        );
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
  async findAnswer (question, options) {
    this.log('Аналіз питання та пошук відповіді...');

    let bestAnswerIndex = -1;
    let confidence = 0;

    try {
      // Використання зовнішнього ML аналізатора, якщо він є
      if (this.mlAnalyzer) {
        this.log('Використання зовнішнього ML аналізатора...');

        const mlResult = await this.mlAnalyzer.analyzeQuestion(
          question,
          options
        );

        if (mlResult.index !== -1 && mlResult.confidence > confidence) {
          bestAnswerIndex = mlResult.index;
          confidence = mlResult.confidence;
          this.log(
            `ML аналізатор вибрав відповідь ${
              bestAnswerIndex + 1
            } з впевненістю ${confidence.toFixed(2)}`
          );
        }
      }
      // Інакше використовуємо вбудовані методи
      else {
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
            this.log(
              `TensorFlow.js вибрав відповідь ${
                bestAnswerIndex + 1
              } з впевненістю ${confidence.toFixed(2)}`
            );
          } else {
            this.log(
              `TensorFlow.js не зміг визначити відповідь з достатньою впевненістю`
            );
          }

          // Очищення ресурсів
          tensor.dispose();
          predictions.dispose();
        }

        // Використання ML5.js для аналізу, якщо TensorFlow не дав результату
        if (
          this.options.useML5 &&
          this.textClassifier &&
          bestAnswerIndex === -1
        ) {
          this.log('Використання ML5.js для аналізу питання...');

          // Аналіз питання за допомогою ML5
          const ml5Results = await this.analyzeWithML5(question, options);

          if (ml5Results.confidence > confidence) {
            bestAnswerIndex = ml5Results.index;
            confidence = ml5Results.confidence;
            this.log(
              `ML5.js вибрав відповідь ${
                bestAnswerIndex + 1
              } з впевненістю ${confidence.toFixed(2)}`
            );
          }
        }
      }

      // Використання зовнішнього пошукового рушія, якщо є
      if (this.searchEngine && bestAnswerIndex === -1) {
        this.log('Використання зовнішнього пошукового рушія...');

        const searchResults = await this.searchEngine.findBestAnswer(
          question,
          options
        );

        if (
          searchResults.index !== -1 &&
          searchResults.confidence > confidence
        ) {
          bestAnswerIndex = searchResults.index;
          confidence = searchResults.confidence;
          this.log(
            `Пошук знайшов відповідь ${
              bestAnswerIndex + 1
            } з впевненістю ${confidence.toFixed(2)}`
          );
        }
      }
      // Інакше використовуємо вбудований пошук, якщо увімкнено
      else if (this.options.useSearch && bestAnswerIndex === -1) {
        this.log('Пошук відповіді в інтернеті...');

        const searchResults = await this.searchOnline(question, options);

        if (searchResults.confidence > confidence) {
          bestAnswerIndex = searchResults.index;
          confidence = searchResults.confidence;
          this.log(
            `Пошук в інтернеті знайшов відповідь ${
              bestAnswerIndex + 1
            } з впевненістю ${confidence.toFixed(2)}`
          );
        }
      }

      // Якщо жоден метод не зміг знайти відповідь, вибираємо випадкову
      if (bestAnswerIndex === -1) {
        bestAnswerIndex = Math.floor(Math.random() * options.length);
        this.log(
          `Не вдалося знайти відповідь. Вибираємо випадкову відповідь: ${
            bestAnswerIndex + 1
          }`
        );
      }

      // Запам'ятовуємо відповідь
      this.answers[this.currentQuestionIndex] = {
        questionText: question,
        selectedIndex: bestAnswerIndex,
        confidence: confidence
      };

      // Відправляємо відповідь з невеликою затримкою для імітації людської поведінки
      const randomDelay = Math.floor(
        Math.random() * (this.options.delay.max - this.options.delay.min) +
          this.options.delay.min
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
  sendAnswer (answerIndex) {
    if (!this.connected || !this.socket) {
      this.log("Неможливо відправити відповідь: відсутнє з'єднання");
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
  tokenizeText (text) {
    if (!this.wordIndex || !this.wordIndex.words) return [];

    // Нормалізація тексту
    const normalized = text.toLowerCase().replace(/[^\w\s]/g, '');
    const words = normalized.split(/\s+/);

    // Перетворення слів у числові токени
    return words.map(word => {
      return this.wordIndex.words[word] || 0; // 0 для невідомих слів
    });
  }

  // Доповнення послідовності до фіксованої довжини
  padSequence (sequence, maxLen) {
    if (sequence.length > maxLen) {
      return sequence.slice(0, maxLen);
    }

    // Доповнення нулями
    return [...sequence, ...Array(maxLen - sequence.length).fill(0)];
  }

  // Аналіз питання за допомогою ML5.js
  async analyzeWithML5 (question, options) {
    try {
      // Симуляція результатів аналізу, оскільки в реальності тут був би код для роботи з ML5
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
  async searchOnline (question, options) {
    try {
      // Формування запиту для пошуку
      const searchQuery = encodeURIComponent(question);

      this.log(`Пошук: "${question}"`);

      // У реальному проекті тут мав би бути запит до пошукової системи
      // Для демонстрації використовуємо симуляцію відповіді
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
  handleSocketError (error) {
    this.log(`WebSocket помилка: ${error.message || 'Невідома помилка'}`);
    this.connected = false;
  }

  // Обробник закриття WebSocket
  handleSocketClose (event) {
    this.log(`WebSocket з'єднання закрито: ${event.code} ${event.reason}`);
    this.connected = false;
  }

  // Відключення від гри
  disconnect () {
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

      // Звільнення ресурсів TensorFlow.js, якщо є
      if (this.tfModel) {
        try {
          this.tfModel.dispose();
        } catch (tfError) {
          this.log(`Помилка звільнення ресурсів TensorFlow: ${tfError.message}`);
        }
      }

      this.log('Бот успішно відключений від гри');
      return true;
    } catch (error) {
      this.log(`Помилка відключення: ${error.message}`);
      return false;
    }
  }
}

export { KahootBot };