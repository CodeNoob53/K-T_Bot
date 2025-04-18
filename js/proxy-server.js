// proxy-server.js
// Проксі-сервер для обходу обмежень CORS

const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Налаштування CORS для доступу з вашого локального сервера
app.use(cors({
  origin: ['http://localhost:5500', 'http://127.0.0.1:5500'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Налаштування проксі для API Kahoot
app.use('/kahoot-api', createProxyMiddleware({
  target: 'https://kahoot.it',
  changeOrigin: true,
  pathRewrite: {
    '^/kahoot-api': '/'
  },
  onProxyRes: function(proxyRes, req, res) {
    // Додаємо необхідні CORS заголовки
    proxyRes.headers['Access-Control-Allow-Origin'] = '*';
    proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
  }
}));

// Проксі для Google Search API
app.use('/search-api/customsearch', async (req, res) => {
  try {
    const url = `https://www.googleapis.com/customsearch/v1?${new URLSearchParams(req.query).toString()}`;
    
    console.log(`Proxying Google search request to: ${url}`);
    
    const response = await fetch(url);
    const data = await response.json();
    
    res.json(data);
  } catch (error) {
    console.error('Google search proxy error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Проксі для DuckDuckGo API
app.use('/search-api/duckduckgo', async (req, res) => {
  try {
    const url = `https://api.duckduckgo.com/?${new URLSearchParams(req.query).toString()}`;
    
    console.log(`Proxying DuckDuckGo request to: ${url}`);
    
    const response = await fetch(url);
    const data = await response.json();
    
    res.json(data);
  } catch (error) {
    console.error('DuckDuckGo proxy error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Тестовий маршрут
app.get('/', (req, res) => {
  res.send('Kahoot Proxy Server працює!');
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Проксі-сервер запущено на порту ${PORT}`);
});