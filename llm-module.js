// LLM Module для работы с OpenRouter API
class LLMModule {
    constructor() {
        this.apiKey = null;
        this.selectedModel = 'deepseek/deepseek-chat-v3-0324';
        this.contentLanguage = 'ru';
        this.apiBase = 'https://openrouter.ai/api/v1';
        
        // Загружаем сохранённые настройки
        this.loadSettings();
    }
    
    // Загрузка настроек из localStorage
    loadSettings() {
        const savedApiKey = localStorage.getItem('openrouter_api_key');
        const savedModel = localStorage.getItem('selected_model');
        const savedLanguage = localStorage.getItem('content_language');
        
        if (savedApiKey) {
            this.apiKey = savedApiKey;
        }
        
        if (savedModel) {
            this.selectedModel = savedModel;
        }
        
        if (savedLanguage) {
            this.contentLanguage = savedLanguage;
        }
        
        console.log('🔧 LLM Settings loaded:', {
            hasApiKey: !!this.apiKey,
            selectedModel: this.selectedModel,
            contentLanguage: this.contentLanguage
        });
    }
    
    // Сохранение API ключа
    saveApiKey(apiKey) {
        if (!apiKey || apiKey.trim() === '') {
            throw new Error('API ключ не может быть пустым');
        }
        
        // Очищаем API ключ от недопустимых символов
        const cleanApiKey = apiKey.trim().replace(/[^\x00-\x7F]/g, '');
        
        if (cleanApiKey !== apiKey.trim()) {
            console.warn('⚠️ API key contained non-ASCII characters, cleaned');
        }
        
        this.apiKey = cleanApiKey;
        localStorage.setItem('openrouter_api_key', this.apiKey);
        
        console.log('💾 API Key saved successfully');
        return true;
    }
    
    // Сохранение выбранной модели
    saveSelectedModel(model) {
        if (!model) {
            throw new Error('Модель не может быть пустой');
        }
        
        this.selectedModel = model;
        localStorage.setItem('selected_model', this.selectedModel);
        
        console.log('💾 Model saved:', this.selectedModel);
        return true;
    }
    
    // Сохранение языка контента
    saveLanguage(language) {
        if (!language) {
            throw new Error('Язык не может быть пустым');
        }
        
        this.contentLanguage = language;
        localStorage.setItem('content_language', this.contentLanguage);
        
        console.log('💾 Language saved:', this.contentLanguage);
        return true;
    }
    
    // Проверка подключения к API
    async testConnection() {
        if (!this.apiKey) {
            throw new Error('API ключ не настроен');
        }
        
        // Дополнительная проверка API ключа
        if (!this.isValidApiKey(this.apiKey)) {
            throw new Error('API ключ содержит недопустимые символы');
        }
        
        console.log('🧪 Testing OpenRouter API connection...');
        
        const testMessage = {
            model: this.selectedModel,
            messages: [
                {
                    role: "user",
                    content: "Hello! This is a test message. Please respond with 'Connection successful'."
                }
            ],
            max_tokens: 50
        };
        
        try {
            const response = await fetch(`${this.apiBase}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify(testMessage)
            });
            
            console.log('📥 Test API Response:', {
                status: response.status,
                statusText: response.statusText
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('❌ API Test Error:', errorData);
                
                if (response.status === 401) {
                    throw new Error('Неверный API ключ');
                } else if (response.status === 429) {
                    throw new Error('Превышен лимит запросов');
                } else if (response.status >= 500) {
                    throw new Error('Ошибка сервера OpenRouter');
                } else {
                    throw new Error(`Ошибка API: ${response.status} ${response.statusText}`);
                }
            }
            
            const data = await response.json();
            console.log('✅ API Test Success:', {
                model: data.model,
                usage: data.usage,
                responseLength: data.choices[0]?.message?.content?.length || 0
            });
            
            return {
                success: true,
                message: 'Подключение к API успешно!',
                response: data.choices[0]?.message?.content || 'Тест прошёл успешно'
            };
            
        } catch (error) {
            console.error('❌ API Test Failed:', error);
            throw error;
        }
    }
    
    // Отправка сообщения в LLM
    async sendMessage(messages, options = {}) {
        if (!this.apiKey) {
            throw new Error('API ключ не настроен');
        }
        
        // Дополнительная проверка API ключа
        if (!this.isValidApiKey(this.apiKey)) {
            throw new Error('API ключ содержит недопустимые символы');
        }
        
        if (!messages || !Array.isArray(messages)) {
            throw new Error('Сообщения должны быть массивом');
        }
        
        console.log('🤖 Sending message to LLM:', {
            model: this.selectedModel,
            messageCount: messages.length,
            options: options
        });
        
        const requestBody = {
            model: this.selectedModel,
            messages: messages,
            max_tokens: options.maxTokens || 1000,
            temperature: options.temperature || 0.7,
            ...options
        };
        
        try {
            const response = await fetch(`${this.apiBase}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('❌ LLM API Error:', errorData);
                
                if (response.status === 401) {
                    throw new Error('Неверный API ключ');
                } else if (response.status === 429) {
                    throw new Error('Превышен лимит запросов');
                } else if (response.status >= 500) {
                    throw new Error('Ошибка сервера OpenRouter');
                } else {
                    throw new Error(`Ошибка API: ${response.status} ${response.statusText}`);
                }
            }
            
            const data = await response.json();
            console.log('✅ LLM Response received:', {
                model: data.model,
                usage: data.usage,
                responseLength: data.choices[0]?.message?.content?.length || 0
            });
            
            return {
                success: true,
                content: data.choices[0]?.message?.content || '',
                usage: data.usage,
                model: data.model
            };
            
        } catch (error) {
            console.error('❌ LLM Request Failed:', error);
            throw error;
        }
    }
    
    // Валидация API ключа
    isValidApiKey(apiKey) {
        if (!apiKey || typeof apiKey !== 'string') {
            return false;
        }
        
        // Проверяем, что ключ содержит только ASCII символы
        return /^[\x00-\x7F]*$/.test(apiKey);
    }
    
    // Получение списка доступных моделей
    getAvailableModels() {
        return [
            {
                value: 'deepseek/deepseek-chat-v3-0324',
                label: 'DeepSeek Chat V3',
                description: 'Мощная модель для сложных задач'
            },
            {
                value: 'openai/gpt-4o-mini',
                label: 'GPT-4o Mini',
                description: 'Быстрая и эффективная модель'
            }
        ];
    }
    
    // Получение текущих настроек
    getSettings() {
        return {
            apiKey: this.apiKey ? '***' + this.apiKey.slice(-4) : null,
            selectedModel: this.selectedModel,
            contentLanguage: this.contentLanguage,
            hasApiKey: !!this.apiKey
        };
    }
}

// Экспортируем модуль для использования
window.LLMModule = LLMModule;
