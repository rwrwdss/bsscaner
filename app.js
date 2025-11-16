// Состояние приложения
let accounts = []; // Массив аккаунтов
let currentAccountIndex = -1; // Индекс текущего аккаунта
let currentUser = null;
let userProfile = null;
let isAuthenticated = false;
let accessJwt = null;
let refreshJwt = null;
let llmModule = null;
let sessionCheckInterval = null;

// Максимальное количество аккаунтов
const MAX_ACCOUNTS = 3;

// Bluesky API конфигурация
const BLUESKY_API_BASE = 'https://bsky.social/xrpc';

// Элементы DOM
const loginScreen = document.getElementById('login-screen');
const mainScreen = document.getElementById('main-screen');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');
const userName = document.getElementById('user-name');

// Элементы настроек
const modelSelect = document.getElementById('model-select');
const contentLanguageSelect = document.getElementById('content-language');
const apiKeyInput = document.getElementById('api-key');
const saveApiKeyBtn = document.getElementById('save-api-key');
const testApiBtn = document.getElementById('test-api');
const testResult = document.getElementById('test-result');

// Инициализация приложения
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
});

async function initializeApp() {
    console.log('🚀 Initializing Bluesky App...');
    
    // Инициализируем LLM модуль
    llmModule = new LLMModule();
    console.log('🤖 LLM Module initialized');
    
    // Загружаем настройки LLM в интерфейс
    loadLLMSettings();
    
    // Загружаем сохранённые аккаунты
    loadAccounts();
    
    // Очищаем истекшие аккаунты
    await cleanupExpiredAccounts();
    
    // Проверяем, есть ли активный аккаунт
    if (accounts.length > 0 && currentAccountIndex >= 0) {
        const activeAccount = accounts[currentAccountIndex];
        console.log('👤 Active account found:', activeAccount.handle);
        
        // Устанавливаем данные активного аккаунта
        setCurrentAccount(activeAccount);
        
        // Проверяем валидность сессии
        checkSession().then(isValid => {
            console.log('🔍 Session Validation Result:', isValid);
            if (isValid) {
                isAuthenticated = true;
                showMainScreen();
                
                // Загружаем профили всех аккаунтов
                loadAllAccountProfiles();
            } else {
                // Токены недействительны, удаляем аккаунт
                console.log('🧹 Removing invalid account');
                removeAccount(currentAccountIndex);
                showLoginScreen();
            }
        }).catch((error) => {
            console.error('❌ Session validation failed:', error);
            removeAccount(currentAccountIndex);
            showLoginScreen();
        });
    } else {
        console.log('📝 No accounts found, showing login screen');
        showLoginScreen();
    }
}

function setupEventListeners() {
    // Обработка формы авторизации
    loginForm.addEventListener('submit', handleLogin);
    
    // Обработка кнопки выхода
    logoutBtn.addEventListener('click', handleLogout);
    
    // Обработка навигации
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            const section = this.getAttribute('data-section');
            switchSection(section);
        });
    });
    
    // Обработка настроек LLM
    if (saveApiKeyBtn) {
        saveApiKeyBtn.addEventListener('click', handleSaveApiKey);
    }
    
    if (testApiBtn) {
        testApiBtn.addEventListener('click', handleTestApi);
    }
    
    if (modelSelect) {
        modelSelect.addEventListener('change', handleModelChange);
    }
    
    if (contentLanguageSelect) {
        contentLanguageSelect.addEventListener('change', handleLanguageChange);
    }
    
    // Обработка аккаунта
    const refreshProfileBtn = document.getElementById('refresh-profile');
    if (refreshProfileBtn) {
        refreshProfileBtn.addEventListener('click', handleRefreshProfile);
    }
    
    // Обработка постов
    const generateTopicBtn = document.getElementById('generate-topic');
    const generatePostBtn = document.getElementById('generate-post');
    const regeneratePostBtn = document.getElementById('regenerate-post');
    const publishPostBtn = document.getElementById('publish-post');
    const editPostBtn = document.getElementById('edit-post');
    const schedulePostBtn = document.getElementById('schedule-post');
    const confirmScheduleBtn = document.getElementById('confirm-schedule');
    const cancelScheduleBtn = document.getElementById('cancel-schedule');
    
    // Обработчики для анализа
    const startAnalysisBtn = document.getElementById('start-analysis-btn');
    const refreshAnalysisBtn = document.getElementById('refresh-analysis');
    const exportAnalysisBtn = document.getElementById('export-analysis');
    const analysisLimitSelect = document.getElementById('analysis-limit');
    const analysisTypeSelect = document.getElementById('analysis-type');
    
    if (generateTopicBtn) {
        generateTopicBtn.addEventListener('click', handleGenerateTopic);
    }
    
    if (generatePostBtn) {
        generatePostBtn.addEventListener('click', handleGeneratePost);
    }
    
    if (regeneratePostBtn) {
        regeneratePostBtn.addEventListener('click', handleRegeneratePost);
    }
    
    if (publishPostBtn) {
        publishPostBtn.addEventListener('click', handlePublishPost);
    }
    
    // Обработчики для анализа
    if (startAnalysisBtn) {
        startAnalysisBtn.addEventListener('click', handleStartAnalysis);
    }
    
    if (refreshAnalysisBtn) {
        refreshAnalysisBtn.addEventListener('click', handleStartAnalysis);
    }
    
    if (exportAnalysisBtn) {
        exportAnalysisBtn.addEventListener('click', handleExportAnalysis);
    }
    
    if (editPostBtn) {
        editPostBtn.addEventListener('click', handleEditPost);
    }
    
    if (schedulePostBtn) {
        schedulePostBtn.addEventListener('click', () => {
            const scheduleOptions = document.getElementById('schedule-options');
            if (scheduleOptions) {
                scheduleOptions.style.display = scheduleOptions.style.display === 'none' ? 'block' : 'none';
            }
        });
    }
    
    if (confirmScheduleBtn) {
        confirmScheduleBtn.addEventListener('click', handleSchedulePost);
    }
    
    if (cancelScheduleBtn) {
        cancelScheduleBtn.addEventListener('click', () => {
            const scheduleOptions = document.getElementById('schedule-options');
            if (scheduleOptions) {
                scheduleOptions.style.display = 'none';
            }
        });
    }
    
    // Обработчики для аналитики
    const refreshAnalyticsBtn = document.getElementById('refresh-analytics-btn');
    if (refreshAnalyticsBtn) {
        refreshAnalyticsBtn.addEventListener('click', refreshAnalytics);
    }
}

function handleLogin(event) {
    event.preventDefault();
    
    const identifier = document.getElementById('identifier').value.trim();
    const password = document.getElementById('password').value;
    
    console.log('🔐 Login Attempt:', {
        identifier: identifier,
        hasPassword: !!password
    });
    
    if (!identifier || !password) {
        console.log('❌ Login Failed: Empty fields');
        showError('Пожалуйста, заполните все поля');
        return;
    }
    
    // Минимальная валидация - проверяем только непустые поля
    // Остальную валидацию делаем на стороне API
    
    // Показываем индикатор загрузки
    const submitBtn = loginForm.querySelector('.btn-primary');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Вход...';
    submitBtn.disabled = true;
    
    console.log('⏳ Starting Bluesky authentication...');
    
    // Выполняем авторизацию через Bluesky API
    blueskyLogin(identifier, password)
        .then(sessionData => {
            console.log('✅ Authentication successful, processing session data...');
            
            // Создаем данные пользователя
            const userData = {
                did: sessionData.did,
                handle: sessionData.handle,
                email: sessionData.email || identifier,
                displayName: sessionData.displayName || sessionData.handle,
                avatar: sessionData.avatar || null
            };
            
            const tokens = {
                accessJwt: sessionData.accessJwt,
                refreshJwt: sessionData.refreshJwt
            };
            
            console.log('💾 Adding account to storage...');
            
            try {
                // Добавляем аккаунт (или обновляем существующий)
                const existingAccount = getAccountByHandle(userData.handle);
                if (existingAccount) {
                    // Обновляем существующий аккаунт
                    existingAccount.accessJwt = tokens.accessJwt;
                    existingAccount.refreshJwt = tokens.refreshJwt;
                    existingAccount.user = userData;
                    currentAccountIndex = accounts.indexOf(existingAccount);
                    saveAccounts();
                    console.log('🔄 Updated existing account');
                } else {
                    // Добавляем новый аккаунт
                    addAccount(userData, tokens);
                }
                
                // Устанавливаем текущий аккаунт
                setCurrentAccount(accounts[currentAccountIndex]);
                
                console.log('🎉 Login completed successfully, switching to main screen');
                
                // Переключаемся на главный экран
                showMainScreen();
                
                // Загружаем профиль с аватаром
                loadUserProfile();
                
            } catch (error) {
                console.error('❌ Error adding account:', error);
                showError(error.message);
            }
        })
        .catch(error => {
            console.error('❌ Authentication failed:', error);
            showError(error.message || 'Не удалось войти: проверьте хэндл/пароль или попробуйте позже');
        })
        .finally(() => {
            // Восстанавливаем кнопку
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        });
}

// Функции для работы с Bluesky API
async function blueskyLogin(identifier, password) {
    const url = `${BLUESKY_API_BASE}/com.atproto.server.createSession`;
    
    console.log('🔐 Bluesky Login Request:', {
        url: url,
        identifier: identifier,
        password: password ? '[HIDDEN]' : 'undefined'
    });
    
    const requestBody = {
        identifier: identifier,
        password: password
    };
    
    console.log('📤 Request Body:', requestBody);
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });
    
    console.log('📥 Response Status:', response.status, response.statusText);
    console.log('📥 Response Headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Login Error Response:', errorData);
        
        // Более детальная обработка ошибок
        let errorMessage = 'Не удалось войти';
        let errorDetails = '';
        
        if (response.status === 401) {
            errorMessage = 'Ошибка авторизации';
            
            // Анализируем тип ошибки более детально
            if (errorData.error) {
                console.log('🔍 Error details:', errorData.error);
                
                if (errorData.error === 'InvalidIdentifier') {
                    errorDetails = 'Указанный email или хэндл не найден в системе Bluesky.';
                } else if (errorData.error === 'InvalidPassword') {
                    errorDetails = 'Неверный пароль для данного аккаунта.';
                } else if (errorData.error === 'AccountTakedown') {
                    errorDetails = 'Аккаунт заблокирован или удалён.';
                } else if (errorData.error === 'AccountSuspended') {
                    errorDetails = 'Аккаунт приостановлен.';
                } else {
                    errorDetails = `Ошибка: ${errorData.error}`;
                }
            } else {
                errorDetails = 'Возможные причины:\n• Неверный email или хэндл\n• Неверный пароль\n• Аккаунт не существует в Bluesky\n• Используйте app-password вместо основного пароля';
            }
            
            errorMessage = `${errorMessage}\n\n${errorDetails}`;
            
        } else if (response.status === 400) {
            errorMessage = 'Некорректные данные';
            errorDetails = 'Проверьте формат:\n• Email: user@example.com\n• Хэндл: @username.bsky.social';
            errorMessage = `${errorMessage}\n\n${errorDetails}`;
            
        } else if (response.status >= 500) {
            errorMessage = 'Ошибка сервера Bluesky';
            errorDetails = 'Сервер временно недоступен. Попробуйте позже.';
            errorMessage = `${errorMessage}\n\n${errorDetails}`;
            
        } else if (errorData.message) {
            errorMessage = errorData.message;
        } else {
            errorMessage = `Ошибка ${response.status}: ${response.statusText}`;
        }
        
        throw new Error(errorMessage);
    }
    
    const data = await response.json();
    console.log('✅ Login Success Response:', {
        did: data.did,
        handle: data.handle,
        email: data.email,
        accessJwt: data.accessJwt ? '[PRESENT]' : 'undefined',
        refreshJwt: data.refreshJwt ? '[PRESENT]' : 'undefined',
        accessJwtLength: data.accessJwt ? data.accessJwt.length : 0,
        refreshJwtLength: data.refreshJwt ? data.refreshJwt.length : 0
    });
    
    if (!data.accessJwt || !data.refreshJwt) {
        console.error('❌ Incomplete response - missing tokens');
        throw new Error('Неполный ответ от сервера');
    }
    
    return data;
}

async function checkSession() {
    if (!accessJwt) {
        console.log('🔍 Session Check: No access token available');
        return false;
    }
    
    try {
        const url = `${BLUESKY_API_BASE}/com.atproto.server.getSession`;
        
        console.log('🔍 Session Check Request:', {
            url: url,
            accessJwt: accessJwt ? '[PRESENT]' : 'undefined',
            accessJwtLength: accessJwt ? accessJwt.length : 0
        });
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessJwt}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('📥 Session Check Response:', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok
        });
        
        if (response.ok) {
            const sessionData = await response.json();
            console.log('✅ Session Valid:', {
                did: sessionData.did,
                handle: sessionData.handle,
                email: sessionData.email
            });
        } else {
            console.log('❌ Session Invalid');
        }
        
        return response.ok;
    } catch (error) {
        console.error('❌ Session Check Error:', error);
        return false;
    }
}

function clearStoredData() {
    console.log('🧹 Clearing stored data...');
    
    // Очищаем старые данные (для совместимости)
    localStorage.removeItem('blueskyTokens');
    localStorage.removeItem('currentUser');
    
    // НЕ удаляем аккаунты - они должны остаться для быстрого входа
    // Просто сбрасываем текущую сессию
    currentAccountIndex = -1;
    
    console.log('✅ Stored data cleared');
    
    accessJwt = null;
    refreshJwt = null;
    currentUser = null;
    userProfile = null;
    isAuthenticated = false;
    stopSessionMonitoring();
}

// Функции для работы с профилем пользователя
async function getUserProfile(handleOrDid) {
    if (!accessJwt) {
        throw new Error('Не авторизован');
    }
    
    console.log('👤 Fetching user profile:', handleOrDid);
    
    const url = `${BLUESKY_API_BASE}/app.bsky.actor.getProfile?actor=${encodeURIComponent(handleOrDid)}`;
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessJwt}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('📥 Profile Response:', {
            status: response.status,
            statusText: response.statusText
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const profileData = await response.json();
        console.log('✅ Profile loaded:', {
            did: profileData.did,
            handle: profileData.handle,
            displayName: profileData.displayName,
            description: profileData.description?.substring(0, 50) + '...',
            followersCount: profileData.followersCount,
            followsCount: profileData.followsCount,
            postsCount: profileData.postsCount
        });
        
        return profileData;
        
    } catch (error) {
        console.error('❌ Failed to fetch profile:', error);
        throw error;
    }
}

// Постоянная проверка сессии
function startSessionMonitoring() {
    if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
    }
    
    // Проверяем сессию каждые 30 секунд
    sessionCheckInterval = setInterval(async () => {
        if (isAuthenticated && accessJwt) {
            try {
                const isValid = await checkSession();
                if (!isValid) {
                    console.log('🚪 Session expired, logging out');
                    handleSessionExpired();
                }
            } catch (error) {
                console.error('❌ Session check failed:', error);
                handleSessionExpired();
            }
        }
    }, 30000); // 30 секунд
    
    console.log('🔄 Session monitoring started');
}

function stopSessionMonitoring() {
    if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
        sessionCheckInterval = null;
        console.log('⏹️ Session monitoring stopped');
    }
}

function handleSessionExpired() {
    console.log('⏰ Session expired, clearing data and returning to login');
    
    // Обновляем статус сессии
    updateSessionStatus(false);
    
    stopSessionMonitoring();
    clearStoredData();
    showLoginScreen();
    
    // Показываем уведомление пользователю
    showError('Сессия истекла. Пожалуйста, войдите снова.');
}

function showError(message) {
    // Создаём элемент для отображения ошибки
    let errorElement = document.querySelector('.error-message');
    if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.className = 'error-message';
        errorElement.style.cssText = `
            background-color: var(--accent-danger);
            color: white;
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 16px;
            font-size: 13px;
            text-align: left;
            line-height: 1.4;
            white-space: pre-line;
            max-width: 100%;
            word-wrap: break-word;
        `;
        loginForm.insertBefore(errorElement, loginForm.firstChild);
    }
    
    errorElement.textContent = message;
    
    // Автоматически скрываем ошибку через 8 секунд (увеличено для чтения)
    setTimeout(() => {
        if (errorElement && errorElement.parentNode) {
            errorElement.parentNode.removeChild(errorElement);
        }
    }, 8000);
}

function handleLogout() {
    console.log('🚪 Logout initiated');
    
    // Очищаем все данные
    clearStoredData();
    
    console.log('🧹 All data cleared, returning to login screen');
    
    // Переключаемся на экран авторизации
    showLoginScreen();
    
    // Очищаем форму
    loginForm.reset();
}

function showMainScreen() {
    if (currentUser) {
        // Обновляем информацию о пользователе
        updateUserInfo();
        
        // Загружаем детальный профиль пользователя
        loadUserProfile();
        
        // Переключаемся на главный экран
        loginScreen.classList.remove('active');
        mainScreen.classList.add('active');
        
        // Показываем раздел аккаунта по умолчанию
        switchSection('account');
        
        // Запускаем мониторинг сессии
        startSessionMonitoring();
    }
}

function updateUserInfo() {
    if (currentUser) {
        // Обновляем основную информацию в сайдбаре
        if (userName) {
            userName.textContent = currentUser.displayName || currentUser.handle;
        }
        
        // Обновляем аватар в user-indicator
        const userAvatarSmall = document.getElementById('user-avatar-small');
        const userIconDefault = document.getElementById('user-icon-default');
        
        if (userAvatarSmall && userIconDefault) {
            if (userProfile && userProfile.avatar) {
                userAvatarSmall.src = userProfile.avatar;
                userAvatarSmall.alt = currentUser.displayName || currentUser.handle;
                userAvatarSmall.style.display = 'block';
                userIconDefault.style.display = 'none';
            } else {
                userAvatarSmall.style.display = 'none';
                userIconDefault.style.display = 'block';
            }
        }
        
        // Обновляем информацию в заголовке аккаунта (если элементы существуют)
        const accountNameEl = document.getElementById('account-name');
        if (accountNameEl) {
            accountNameEl.textContent = currentUser.displayName || currentUser.handle;
        }
        
        const accountHandleEl = document.getElementById('account-handle');
        if (accountHandleEl) {
            accountHandleEl.textContent = currentUser.handle;
        }
        
        console.log('✅ Basic user info updated');
    }
}

async function loadUserProfile() {
    if (!currentUser || !currentUser.handle) {
        console.log('⚠️ No user handle available for profile loading');
        return;
    }
    
    try {
        console.log('🔄 Loading detailed user profile...');
        userProfile = await getUserProfile(currentUser.handle);
        
        // Обновляем интерфейс с детальной информацией
        updateDetailedUserInfo();
        
    } catch (error) {
        console.error('❌ Failed to load user profile:', error);
        // Продолжаем работу с базовой информацией
    }
}

function updateDetailedUserInfo() {
    if (!userProfile) return;
    
    // Обновляем основную информацию
    if (userProfile.displayName) {
        const userNameEl = document.getElementById('user-name');
        if (userNameEl) {
            userNameEl.textContent = userProfile.displayName;
        }
    }
    
    // Обновляем детальную информацию в интерфейсе
    updateAccountSection();
    
    // Обновляем статус сессии как активную
    updateSessionStatus(true);
}

function switchSection(sectionName) {
    // Убираем активный класс со всех навигационных элементов
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.classList.remove('active');
    });
    
    // Добавляем активный класс к выбранному элементу
    const activeNavItem = document.querySelector(`[data-section="${sectionName}"]`);
    if (activeNavItem) {
        activeNavItem.classList.add('active');
    }
    
    // Скрываем все разделы контента
    const contentSections = document.querySelectorAll('.content-section');
    contentSections.forEach(section => {
        section.style.display = 'none';
        section.classList.remove('active');
    });
    
    // Показываем выбранный раздел
    const targetSection = document.getElementById(`${sectionName}-section`);
    if (targetSection) {
        targetSection.style.display = 'block';
        targetSection.classList.add('active');
    }
    
    // Проверяем токен LLM для соответствующих разделов
    if (sectionName === 'posts' || sectionName === 'analysis') {
        checkLLMTokenAndUpdateUI(sectionName);
    }
    
    // Обновляем UI отложенных постов при переходе в этот раздел
    if (sectionName === 'scheduled') {
        scheduledPostsManager.updateUI();
    }
    
    // Проверяем токен Bluesky для аналитики
    if (sectionName === 'analytics') {
        if (currentAccountIndex === -1 || !accounts[currentAccountIndex] || !accounts[currentAccountIndex].accessJwt) {
            showAnalyticsAuthMessage();
        } else {
            hideAnalyticsAuthMessage();
        }
    }
    
    // Обновляем заголовок
    const contentHeader = document.querySelector('.content-header h1');
    if (contentHeader) {
        if (sectionName === 'account') {
            contentHeader.textContent = 'Информация об аккаунте';
        } else if (sectionName === 'posts') {
            contentHeader.textContent = 'Генератор постов';
        } else if (sectionName === 'analysis') {
            contentHeader.textContent = 'Анализ трендов';
        } else if (sectionName === 'analytics') {
            contentHeader.textContent = 'Аналитика постов';
        } else if (sectionName === 'neurocommenting') {
            contentHeader.textContent = 'Нейрокомментинг';
        } else if (sectionName === 'settings') {
            contentHeader.textContent = 'Настройки';
        }
    }
    
    // Обработка раздела нейрокомментирования
    if (sectionName === 'neurocommenting') {
        if (currentAccountIndex === -1 || !accounts[currentAccountIndex] || !accounts[currentAccountIndex].accessJwt) {
            showNeurocommentingAuthMessage();
        } else {
            hideNeurocommentingAuthMessage();
            // Загружаем сохраненные результаты
            loadSavedNeurocommentingResults();
        }
    }
}

function checkLLMTokenAndUpdateUI(sectionName) {
    const hasValidToken = llmModule && llmModule.apiKey && llmModule.apiKey.trim() !== '';
    
    const tokenMessage = document.getElementById(`${sectionName}-token-message`);
    const content = document.getElementById(`${sectionName}-content`);
    
    if (tokenMessage && content) {
        if (hasValidToken) {
            // Токен есть - показываем контент
            tokenMessage.style.display = 'none';
            content.style.display = 'block';
            console.log(`✅ LLM token valid for ${sectionName} section`);
        } else {
            // Токена нет - показываем сообщение
            tokenMessage.style.display = 'flex';
            content.style.display = 'none';
            console.log(`⚠️ LLM token missing for ${sectionName} section`);
        }
    }
}

function updateLLMTokenStatus() {
    // Обновляем статус для всех разделов, которые используют LLM
    checkLLMTokenAndUpdateUI('posts');
    checkLLMTokenAndUpdateUI('analysis');
}

// Дополнительные функции для улучшения UX
function addHoverEffects() {
    // Добавляем эффекты наведения для кнопок
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
        button.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-1px)';
        });
        
        button.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    });
}

// Инициализируем эффекты наведения после загрузки DOM
document.addEventListener('DOMContentLoaded', addHoverEffects);

// Обработка ошибок
window.addEventListener('error', function(event) {
    console.error('Ошибка приложения:', event.error);
});

// Обработка необработанных промисов
window.addEventListener('unhandledrejection', function(event) {
    console.error('Необработанная ошибка промиса:', event.reason);
});

// Функции для работы с LLM настройками
function loadLLMSettings() {
    if (!llmModule) return;
    
    const settings = llmModule.getSettings();
    
    // Загружаем выбранную модель
    if (modelSelect && settings.selectedModel) {
        modelSelect.value = settings.selectedModel;
    }
    
    // Загружаем выбранный язык
    if (contentLanguageSelect && settings.contentLanguage) {
        contentLanguageSelect.value = settings.contentLanguage;
    }
    
    // Показываем статус API ключа
    if (apiKeyInput) {
        if (settings.hasApiKey) {
            apiKeyInput.placeholder = `API ключ сохранён (${settings.apiKey})`;
            apiKeyInput.value = ''; // Очищаем поле, но показываем что ключ есть
        } else {
            apiKeyInput.placeholder = 'Введите ваш API ключ';
            apiKeyInput.value = '';
        }
    }
    
    console.log('🔧 LLM Settings loaded to UI:', settings);
}

function handleSaveApiKey() {
    if (!llmModule || !apiKeyInput) return;
    
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
        showLLMError('Пожалуйста, введите API ключ');
        return;
    }
    
    // Проверяем на недопустимые символы
    if (!/^[\x00-\x7F]*$/.test(apiKey)) {
        showLLMError('API ключ содержит недопустимые символы. Используйте только латинские буквы, цифры и специальные символы.');
        return;
    }
    
    try {
        llmModule.saveApiKey(apiKey);
        showLLMSuccess('API ключ успешно сохранён!');
        
        // Не очищаем поле, а показываем что ключ сохранён
        apiKeyInput.placeholder = 'API ключ сохранён';
        apiKeyInput.classList.add('success');
        
        // Возвращаем обычный стиль через 2 секунды
        setTimeout(() => {
            apiKeyInput.classList.remove('success');
        }, 2000);
        
        console.log('✅ API Key saved successfully');
        
        // Обновляем статус токена для всех разделов
        updateLLMTokenStatus();
        
    } catch (error) {
        console.error('❌ Failed to save API key:', error);
        showLLMError(error.message);
    }
}

function handleModelChange() {
    if (!llmModule || !modelSelect) return;
    
    const selectedModel = modelSelect.value;
    
    try {
        llmModule.saveSelectedModel(selectedModel);
        showLLMSuccess(`Модель изменена на: ${modelSelect.options[modelSelect.selectedIndex].text}`);
        
        console.log('✅ Model changed to:', selectedModel);
    } catch (error) {
        console.error('❌ Failed to save model:', error);
        showLLMError(error.message);
    }
}

function handleLanguageChange() {
    if (!llmModule || !contentLanguageSelect) return;
    
    const selectedLanguage = contentLanguageSelect.value;
    
    try {
        llmModule.saveLanguage(selectedLanguage);
        showLLMSuccess(`Язык контента изменен на: ${contentLanguageSelect.options[contentLanguageSelect.selectedIndex].text}`);
        
        console.log('✅ Language changed to:', selectedLanguage);
    } catch (error) {
        console.error('❌ Failed to save language:', error);
        showLLMError(error.message);
    }
}

async function handleTestApi() {
    if (!llmModule || !testApiBtn || !testResult) return;
    
    // Показываем состояние загрузки
    testApiBtn.disabled = true;
    testApiBtn.textContent = 'Тестирование...';
    
    showTestResult('Тестирование подключения к API...', 'loading');
    
    try {
        const result = await llmModule.testConnection();
        
        showTestResult(result.message, 'success');
        console.log('✅ API Test successful:', result);
        
    } catch (error) {
        showTestResult(error.message, 'error');
        console.error('❌ API Test failed:', error);
    } finally {
        // Восстанавливаем кнопку
        testApiBtn.disabled = false;
        testApiBtn.textContent = 'Тестировать подключение';
    }
}

function showTestResult(message, type) {
    if (!testResult) return;
    
    testResult.textContent = message;
    testResult.className = `test-result show ${type}`;
    
    // Автоматически скрываем через 5 секунд
    setTimeout(() => {
        testResult.classList.remove('show');
    }, 5000);
}

function showLLMSuccess(message) {
    console.log('✅ LLM Success:', message);
    // Можно добавить toast уведомления в будущем
}

function showLLMError(message) {
    console.error('❌ LLM Error:', message);
    // Можно добавить toast уведомления в будущем
}

// Функции для работы с аккаунтом
function updateAccountSection() {
    if (!userProfile) return;
    
    // Обновляем основную информацию
    const accountNameEl = document.getElementById('account-name');
    const accountHandleEl = document.getElementById('account-handle');
    const accountDescEl = document.getElementById('account-description');
    
    if (accountNameEl) {
        accountNameEl.textContent = userProfile.displayName || userProfile.handle;
    }
    
    if (accountHandleEl) {
        accountHandleEl.textContent = userProfile.handle;
    }
    
    if (accountDescEl) {
        accountDescEl.textContent = userProfile.description || 'Описание не указано';
    }
    
    // Обновляем статистику
    const followersCountEl = document.getElementById('followers-count');
    const followingCountEl = document.getElementById('following-count');
    const postsCountEl = document.getElementById('posts-count');
    
    if (followersCountEl) {
        followersCountEl.textContent = userProfile.followersCount || 0;
    }
    
    if (followingCountEl) {
        followingCountEl.textContent = userProfile.followsCount || 0;
    }
    
    if (postsCountEl) {
        postsCountEl.textContent = userProfile.postsCount || 0;
    }
    
    // Обновляем детальную информацию
    const displayDidEl = document.getElementById('display-did');
    const displayHandleEl = document.getElementById('display-handle');
    const displayCreatedEl = document.getElementById('display-created');
    
    if (displayDidEl) {
        displayDidEl.textContent = userProfile.did;
    }
    
    if (displayHandleEl) {
        displayHandleEl.textContent = userProfile.handle;
    }
    
    if (displayCreatedEl && userProfile.indexedAt) {
        const createdDate = new Date(userProfile.indexedAt);
        displayCreatedEl.textContent = createdDate.toLocaleDateString('ru-RU');
    }
    
    // Обновляем аватар
    const avatarImg = document.getElementById('user-avatar');
    const defaultAvatar = document.getElementById('default-avatar');
    
    if (avatarImg && defaultAvatar) {
        if (userProfile.avatar) {
            avatarImg.src = userProfile.avatar;
            avatarImg.alt = userProfile.displayName || userProfile.handle;
            avatarImg.style.display = 'block';
            defaultAvatar.style.display = 'none';
        } else {
            avatarImg.style.display = 'none';
            defaultAvatar.style.display = 'flex';
        }
    }
    
    console.log('✅ Account section updated with profile data');
}

async function handleRefreshProfile() {
    const refreshBtn = document.getElementById('refresh-profile');
    if (!refreshBtn) return;
    
    const originalText = refreshBtn.textContent;
    refreshBtn.textContent = 'Обновление...';
    refreshBtn.disabled = true;
    
    try {
        await loadUserProfile();
        console.log('✅ Profile refreshed successfully');
    } catch (error) {
        console.error('❌ Failed to refresh profile:', error);
    } finally {
        refreshBtn.textContent = originalText;
        refreshBtn.disabled = false;
    }
}

function updateSessionStatus(isActive) {
    const sessionStatusEl = document.getElementById('session-status');
    const statusIndicatorEl = document.querySelector('.status-indicator');
    
    if (sessionStatusEl && statusIndicatorEl) {
        if (isActive) {
            sessionStatusEl.innerHTML = '<span class="status-indicator active"></span>Активна';
        } else {
            sessionStatusEl.innerHTML = '<span class="status-indicator expired"></span>Истекла';
        }
    }
}

// Функции для работы с постами
let currentGeneratedPost = null;

// Темы для автогенерации
const TOPIC_SUGGESTIONS = [
    'Искусственный интеллект и будущее',
    'Криптовалюты и блокчейн',
    'Климат и экология',
    'Социальные сети и технологии',
    'Работа и карьера',
    'Здоровье и медицина',
    'Образование и наука',
    'Политика и общество',
    'Спорт и фитнес',
    'Путешествия и культура',
    'Еда и кулинария',
    'Мода и стиль',
    'Музыка и искусство',
    'Кино и сериалы',
    'Игры и развлечения'
];

function handleGenerateTopic() {
    const topicInput = document.getElementById('topic-input');
    if (!topicInput) return;
    
    const randomTopic = TOPIC_SUGGESTIONS[Math.floor(Math.random() * TOPIC_SUGGESTIONS.length)];
    topicInput.value = randomTopic;
    
    console.log('🎲 Generated topic:', randomTopic);
}

async function handleGeneratePost() {
    if (!llmModule) {
        showPostStatus('error', 'LLM модуль не инициализирован');
        return;
    }
    
    // Проверяем токен LLM
    if (!llmModule.apiKey || llmModule.apiKey.trim() === '') {
        showPostStatus('error', 'LLM не настроен. Проверьте API ключ в настройках.');
        console.log('⚠️ LLM token not configured for post generation');
        return;
    }
    
    const topicInput = document.getElementById('topic-input');
    const postStyleSelect = document.getElementById('post-style');
    const generateBtn = document.getElementById('generate-post');
    
    if (!topicInput || !postStyleSelect || !generateBtn) return;
    
    const topic = topicInput.value.trim();
    const style = postStyleSelect.value;
    
    if (!topic) {
        showPostStatus('error', 'Введите тему поста или сгенерируйте автоматически');
        return;
    }
    
    // Показываем состояние загрузки
    generateBtn.disabled = true;
    generateBtn.innerHTML = '<span class="btn-icon">⏳</span>Генерация...';
    showPostStatus('loading', 'Генерируем пост...');
    
    try {
        const postText = await generatePostText(topic, style);
        currentGeneratedPost = {
            text: postText,
            topic: topic,
            style: style,
            createdAt: new Date().toISOString()
        };
        
        displayGeneratedPost(postText);
        showPostStatus('success', 'Пост успешно сгенерирован!');
        
        console.log('✅ Post generated:', postText);
        
    } catch (error) {
        console.error('❌ Failed to generate post:', error);
        showPostStatus('error', `Ошибка генерации: ${error.message}`);
    } finally {
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<span class="btn-icon">🤖</span>Сгенерировать пост';
    }
}

async function generatePostText(topic, style) {
    // Получаем выбранный язык
    const language = llmModule?.contentLanguage || 'ru';
    
    const stylePrompts = {
        viral: {
            ru: 'Ты - креативный комментатор уровня Aviasales. У тебя дерзкий, умный, цепляющий стиль. Ты умеешь одной фразой врезаться в память. Не повторяй банальностей. Не используй клише вроде "сильная мысль", "поддерживаю", "так и есть". Твоя задача - превратить коммент в вирусную фразу. Используй юмор, сарказм, неожиданные образы, аналогии. Иногда - абсурд или философскую хлесткость. Ты пишешь комментарий на пост автора в Threads. Сгенерируй 1 комментарий в стиле: язвительный, как будто сказал комик, максимально очеловеченный, со словами паразитами, как будто писал на эмоциях и таким чуть неряшливым сообщением без банальностей и сложных смыслов, должно быть понятно каждому о чем речь и вызывать реакцию. Коротко 1 предложение, максимум 12 слов. Так, чтобы захотелось лайкнуть или отвветить, то есть вирусный такой должен быть ответ по теме ветки',
            en: 'You are a creative commentator at Aviasales level. You have a bold, smart, catchy style. You can cut into memory with one phrase. Don\'t repeat platitudes. Don\'t use clichés like "strong thought", "I support", "that\'s right". Your task is to turn a comment into a viral phrase. Use humor, sarcasm, unexpected images, analogies. Sometimes - absurdity or philosophical sharpness. You are writing a comment on an author\'s post on Threads. Generate 1 comment in the style: caustic, as if said by a comedian, maximally humanized, with parasitic words, as if written on emotions and such a slightly sloppy message without platitudes and complex meanings, should be understandable to everyone what it\'s about and cause a reaction. Short 1 sentence, maximum 12 words. So that you want to like or respond, that is, viral should be the answer on the topic of the thread',
            es: 'Eres un comentarista creativo de nivel Aviasales. Tienes un estilo audaz, inteligente y pegadizo. Puedes cortar en la memoria con una frase. No repitas lugares comunes. No uses clichés como "pensamiento fuerte", "apoyo", "así es". Tu tarea es convertir un comentario en una frase viral. Usa humor, sarcasmo, imágenes inesperadas, analogías. A veces - absurdo o agudeza filosófica. Estás escribiendo un comentario en el post de un autor en Threads. Genera 1 comentario en el estilo: cáustico, como si lo dijera un comediante, maximamente humanizado, con palabras parásitas, como si estuviera escrito en emociones y tal mensaje un poco descuidado sin lugares comunes y significados complejos, debe ser comprensible para todos de qué se trata y causar una reacción. Corto 1 oración, máximo 12 palabras. Para que quieras dar me gusta o responder, es decir, viral debe ser la respuesta sobre el tema del hilo',
            fr: 'Tu es un commentateur créatif de niveau Aviasales. Tu as un style audacieux, intelligent et accrocheur. Tu peux couper dans la mémoire avec une phrase. Ne répète pas les platitudes. N\'utilise pas de clichés comme "pensée forte", "je soutiens", "c\'est ça". Ta tâche est de transformer un commentaire en phrase virale. Utilise l\'humour, le sarcasme, les images inattendues, les analogies. Parfois - l\'absurdité ou la netteté philosophique. Tu écris un commentaire sur le post d\'un auteur sur Threads. Génère 1 commentaire dans le style: caustique, comme si dit par un comédien, maximement humanisé, avec des mots parasites, comme si écrit sur les émotions et un tel message un peu bâclé sans platitudes et significations complexes, doit être compréhensible à tous de quoi il s\'agit et causer une réaction. Court 1 phrase, maximum 12 mots. Pour que tu veuilles aimer ou répondre, c\'est-à-dire viral doit être la réponse sur le sujet du fil',
            de: 'Du bist ein kreativer Kommentator auf Aviasales-Niveau. Du hast einen mutigen, klugen, einprägsamen Stil. Du kannst mit einem Satz ins Gedächtnis schneiden. Wiederhole keine Platitüden. Verwende keine Klischees wie "starker Gedanke", "ich unterstütze", "das ist richtig". Deine Aufgabe ist es, einen Kommentar in eine virale Phrase zu verwandeln. Verwende Humor, Sarkasmus, unerwartete Bilder, Analogien. Manchmal - Absurdität oder philosophische Schärfe. Du schreibst einen Kommentar zu einem Post eines Autors auf Threads. Generiere 1 Kommentar im Stil: beißend, als ob von einem Komiker gesagt, maximal humanisiert, mit Parasitenwörtern, als ob auf Emotionen geschrieben und so eine etwas schlampige Nachricht ohne Platitüden und komplexe Bedeutungen, sollte für jeden verständlich sein, worum es geht und eine Reaktion hervorrufen. Kurz 1 Satz, maximal 12 Wörter. Damit du möchtest zu liken oder zu antworten, das heißt viral sollte die Antwort zum Thema des Threads sein',
            it: 'Sei un commentatore creativo di livello Aviasales. Hai uno stile audace, intelligente, accattivante. Puoi tagliare nella memoria con una frase. Non ripetere banalità. Non usare cliché come "pensiero forte", "sostengo", "è così". Il tuo compito è trasformare un commento in una frase virale. Usa umorismo, sarcasmo, immagini inaspettate, analogie. A volte - assurdità o acutezza filosofica. Stai scrivendo un commento sul post di un autore su Threads. Genera 1 commento nello stile: caustico, come se detto da un comico, massimamente umanizzato, con parole parassite, come se scritto sulle emozioni e un tale messaggio un po\' sciatto senza banalità e significati complessi, dovrebbe essere comprensibile a tutti di cosa si tratta e causare una reazione. Breve 1 frase, massimo 12 parole. Così che tu voglia mettere mi piace o rispondere, cioè virale dovrebbe essere la risposta sul tema del thread',
            pt: 'Você é um comentarista criativo de nível Aviasales. Você tem um estilo ousado, inteligente e cativante. Você pode cortar na memória com uma frase. Não repita platitudes. Não use clichês como "pensamento forte", "eu apoio", "é isso". Sua tarefa é transformar um comentário em uma frase viral. Use humor, sarcasmo, imagens inesperadas, analogias. Às vezes - absurdo ou agudeza filosófica. Você está escrevendo um comentário no post de um autor no Threads. Gere 1 comentário no estilo: cáustico, como se dito por um comediante, maximamente humanizado, com palavras parasitas, como se escrito nas emoções e tal mensagem um pouco desleixada sem platitudes e significados complexos, deve ser compreensível para todos sobre o que se trata e causar uma reação. Curto 1 frase, máximo 12 palavras. Para que você queira curtir ou responder, ou seja, viral deve ser a resposta sobre o tópico do thread',
            ja: 'あなたはAviasalesレベルの創造的なコメンテーターです。大胆で、スマートで、キャッチーなスタイルを持っています。一つのフレーズで記憶に刻み込むことができます。陳腐な表現は繰り返さないでください。「強い考え」「支持する」「その通り」のような決まり文句は使わないでください。あなたの任務は、コメントをバイラルフレーズに変えることです。ユーモア、皮肉、予期しないイメージ、類推を使いましょう。時には - 不条理や哲学的な鋭さを。あなたはThreadsで作者の投稿にコメントを書いています。スタイルで1つのコメントを生成してください：辛辣で、コメディアンが言ったかのように、最大限に人間らしく、寄生語で、感情で書かれたかのような、少しだらしないメッセージで、陳腐さや複雑な意味はなく、誰にでも何について話しているのかが理解でき、反応を引き起こすべきです。短い1文、最大12語。いいねや返信をしたくなるように、つまりバイラルはスレッドのトピックに関する回答であるべきです',
            ko: '당신은 Aviasales 수준의 창의적인 코멘테이터입니다. 대담하고, 똑똑하고, 매력적인 스타일을 가지고 있습니다. 한 문장으로 기억에 남을 수 있습니다. 진부한 표현을 반복하지 마세요. "강한 생각", "지지한다", "맞다"와 같은 클리셰를 사용하지 마세요. 당신의 임무는 댓글을 바이럴 문구로 바꾸는 것입니다. 유머, 풍자, 예상치 못한 이미지, 유추를 사용하세요. 때로는 - 부조리나 철학적 예리함을. 당신은 Threads에서 작가의 게시물에 댓글을 쓰고 있습니다. 스타일로 1개의 댓글을 생성하세요: 신랄하고, 코미디언이 말한 것처럼, 최대한 인간적으로, 기생어로, 감정에 써진 것처럼, 약간 엉성한 메시지로, 진부함이나 복잡한 의미 없이, 모든 사람이 무엇에 대해 이야기하는지 이해할 수 있고 반응을 일으켜야 합니다. 짧은 1문장, 최대 12단어. 좋아요나 답글을 하고 싶게 만들도록, 즉 바이럴은 스레드 주제에 대한 답변이어야 합니다',
            zh: '你是一个Aviasales级别的创意评论员。你有一个大胆、聪明、引人注目的风格。你可以用一个短语切入记忆。不要重复陈词滥调。不要使用"强烈想法"、"我支持"、"就是这样"等陈词滥调。你的任务是将评论变成病毒式短语。使用幽默、讽刺、意想不到的图像、类比。有时 - 荒谬或哲学敏锐。你在Threads上写作者帖子的评论。生成1个评论，风格：尖刻，就像喜剧演员说的，最大程度人性化，带有寄生词，就像写在情感上一样，有点草率的消息，没有陈词滥调和复杂含义，应该让每个人都明白在谈论什么并引起反应。简短1句话，最多12个词。这样你就想点赞或回复，即病毒式应该是关于线程主题的回答'
        },
        humorous: {
            ru: 'Ты - остроумный комедиант. Пиши смешные, но умные посты. Используй иронию, неожиданные повороты, играй словами. Максимум 15 слов.',
            en: 'You are a witty comedian. Write funny but smart posts. Use irony, unexpected twists, play with words. Maximum 15 words.',
            es: 'Eres un comediante ingenioso. Escribe posts divertidos pero inteligentes. Usa ironía, giros inesperados, juega con las palabras. Máximo 15 palabras.',
            fr: 'Tu es un comédien spirituel. Écris des posts drôles mais intelligents. Utilise l\'ironie, les rebondissements inattendus, joue avec les mots. Maximum 15 mots.',
            de: 'Du bist ein witziger Komiker. Schreibe lustige aber kluge Posts. Verwende Ironie, unerwartete Wendungen, spiele mit Wörtern. Maximum 15 Wörter.',
            it: 'Sei un comico spiritoso. Scrivi post divertenti ma intelligenti. Usa ironia, svolte inaspettate, gioca con le parole. Massimo 15 parole.',
            pt: 'Você é um comediante espirituoso. Escreva posts engraçados mas inteligentes. Use ironia, reviravoltas inesperadas, brinque com as palavras. Máximo 15 palavras.',
            ja: 'あなたは機知に富んだコメディアンです。面白くて賢い投稿を書いてください。皮肉、予期しない展開、言葉遊びを使いましょう。最大15語。',
            ko: '당신은 재치있는 코미디언입니다. 재미있지만 똑똑한 게시물을 쓰세요. 아이러니, 예상치 못한 전환, 말장난을 사용하세요. 최대 15단어.',
            zh: '你是一个机智的喜剧演员。写有趣但聪明的帖子。使用讽刺、意想不到的转折、文字游戏。最多15个词。'
        },
        sarcastic: {
            ru: 'Ты - мастер сарказма. Пиши едкие, но умные комментарии. Используй иронию и подтекст. Максимум 12 слов.',
            en: 'You are a master of sarcasm. Write caustic but smart comments. Use irony and subtext. Maximum 12 words.',
            es: 'Eres un maestro del sarcasmo. Escribe comentarios cáusticos pero inteligentes. Usa ironía y subtexto. Máximo 12 palabras.',
            fr: 'Tu es un maître du sarcasme. Écris des commentaires caustiques mais intelligents. Utilise l\'ironie et le sous-texte. Maximum 12 mots.',
            de: 'Du bist ein Meister des Sarkasmus. Schreibe beißende aber kluge Kommentare. Verwende Ironie und Unterton. Maximum 12 Wörter.',
            it: 'Sei un maestro del sarcasmo. Scrivi commenti caustici ma intelligenti. Usa ironia e sottotesto. Massimo 12 parole.',
            pt: 'Você é um mestre do sarcasmo. Escreva comentários cáusticos mas inteligentes. Use ironia e subtexto. Máximo 12 palavras.',
            ja: 'あなたは皮肉の達人です。辛辣だが賢いコメントを書いてください。皮肉とサブテキストを使いましょう。最大12語。',
            ko: '당신은 풍자의 달인입니다. 신랄하지만 똑똑한 댓글을 쓰세요. 아이러니와 서브텍스트를 사용하세요. 최대 12단어.',
            zh: '你是讽刺大师。写尖刻但聪明的评论。使用讽刺和潜台词。最多12个词。'
        },
        philosophical: {
            ru: 'Ты - мудрый философ. Пиши глубокие, размышляющие посты. Используй метафоры и аллегории. Максимум 20 слов.',
            en: 'You are a wise philosopher. Write deep, reflective posts. Use metaphors and allegories. Maximum 20 words.',
            es: 'Eres un filósofo sabio. Escribe posts profundos y reflexivos. Usa metáforas y alegorías. Máximo 20 palabras.',
            fr: 'Tu es un philosophe sage. Écris des posts profonds et réfléchis. Utilise des métaphores et des allégories. Maximum 20 mots.',
            de: 'Du bist ein weiser Philosoph. Schreibe tiefe, nachdenkliche Posts. Verwende Metaphern und Allegorien. Maximum 20 Wörter.',
            it: 'Sei un filosofo saggio. Scrivi post profondi e riflessivi. Usa metafore e allegorie. Massimo 20 parole.',
            pt: 'Você é um filósofo sábio. Escreva posts profundos e reflexivos. Use metáforas e alegorias. Máximo 20 palavras.',
            ja: 'あなたは賢い哲学者です。深く、思慮深い投稿を書いてください。メタファーとアレゴリーを使いましょう。最大20語。',
            ko: '당신은 현명한 철학자입니다. 깊고 사려깊은 게시물을 쓰세요. 은유와 우화를 사용하세요. 최대 20단어.',
            zh: '你是一个明智的哲学家。写深刻、反思的帖子。使用隐喻和寓言。最多20个词。'
        }
    };
    
    // Извлекаем хештеги из темы в новом формате "Tags: {хештеги}"
    let hashtags = [];
    let cleanTopic = topic;
    
    // Ищем формат "Tags: {хештеги}"
    const tagsMatch = topic.match(/Tags:\s*\{([^}]+)\}/);
    if (tagsMatch) {
        // Извлекаем хештеги из фигурных скобок
        const hashtagsText = tagsMatch[1].trim();
        hashtags = hashtagsText.split(/\s+/).filter(tag => tag.startsWith('#'));
        // Убираем всю часть "Tags: {хештеги}" из темы
        cleanTopic = topic.replace(/Tags:\s*\{[^}]+\}/, '').trim();
        console.log('🏷️ Parsed hashtags from Tags format:', { hashtagsText, hashtags, cleanTopic });
    } else {
        // Fallback: ищем обычные хештеги в теме
        hashtags = topic.match(/#\w+/g) || [];
        cleanTopic = topic.replace(/#\w+/g, '').trim();
        console.log('🏷️ Parsed hashtags from fallback:', { hashtags, cleanTopic });
    }
    
    // Добавляем информацию о языке и хештегах к системному промпту
    let baseSystemPrompt = stylePrompts[style]?.[language] || stylePrompts.viral[language] || stylePrompts.viral.ru;
    
    // Добавляем инструкции о языке и хештегах
    const languageInstructions = {
        ru: `ВАЖНО: Пиши ТОЛЬКО на русском языке. Если есть хештеги, ОБЯЗАТЕЛЬНО добавляй их в конце поста на русском языке.`,
        en: `IMPORTANT: Write ONLY in English. If there are hashtags, you MUST add them at the end of the post in English.`,
        es: `IMPORTANTE: Escribe SOLO en español. Si hay hashtags, DEBES añadirlos al final del post en español.`,
        fr: `IMPORTANT: Écris SEULEMENT en français. S'il y a des hashtags, tu DOIS les ajouter à la fin du post en français.`,
        de: `WICHTIG: Schreibe NUR auf Deutsch. Wenn es Hashtags gibt, MUSST du sie am Ende des Posts auf Deutsch hinzufügen.`,
        it: `IMPORTANTE: Scrivi SOLO in italiano. Se ci sono hashtag, DEVI aggiungerli alla fine del post in italiano.`,
        pt: `IMPORTANTE: Escreva APENAS em português. Se houver hashtags, você DEVE adicioná-las no final do post em português.`,
        ja: `重要：日本語でのみ書いてください。ハッシュタグがある場合は、必ず日本語でポストの最後に追加してください。`,
        ko: `중요: 한국어로만 작성하세요. 해시태그가 있다면 반드시 한국어로 포스트 끝에 추가하세요.`,
        zh: `重要：只用中文写作。如果有标签，必须在帖子末尾用中文添加。`
    };
    
    const languageInstruction = languageInstructions[language] || languageInstructions.ru;
    const systemPrompt = `${baseSystemPrompt}\n\n${languageInstruction}`;
    
    // Многоязычные сообщения пользователя
    const userMessages = {
        ru: `Тема: ${cleanTopic}${hashtags.length > 0 ? `\nХештеги: ${hashtags.join(' ')}` : ''}\n\nСоздай пост на эту тему в указанном стиле.${hashtags.length > 0 ? ' ОБЯЗАТЕЛЬНО добавь хештеги в конце поста на русском языке.' : ''}`,
        en: `Topic: ${cleanTopic}${hashtags.length > 0 ? `\nHashtags: ${hashtags.join(' ')}` : ''}\n\nCreate a post on this topic in the specified style.${hashtags.length > 0 ? ' You MUST add hashtags at the end of the post in English.' : ''}`,
        es: `Tema: ${cleanTopic}${hashtags.length > 0 ? `\nHashtags: ${hashtags.join(' ')}` : ''}\n\nCrea una publicación sobre este tema en el estilo especificado.${hashtags.length > 0 ? ' DEBES añadir hashtags al final del post en español.' : ''}`,
        fr: `Sujet: ${cleanTopic}${hashtags.length > 0 ? `\nHashtags: ${hashtags.join(' ')}` : ''}\n\nCréez un post sur ce sujet dans le style spécifié.${hashtags.length > 0 ? ' Tu DOIS ajouter des hashtags à la fin du post en français.' : ''}`,
        de: `Thema: ${cleanTopic}${hashtags.length > 0 ? `\nHashtags: ${hashtags.join(' ')}` : ''}\n\nErstelle einen Post zu diesem Thema im angegebenen Stil.${hashtags.length > 0 ? ' Du MUSST Hashtags am Ende des Posts auf Deutsch hinzufügen.' : ''}`,
        it: `Argomento: ${cleanTopic}${hashtags.length > 0 ? `\nHashtag: ${hashtags.join(' ')}` : ''}\n\nCrea un post su questo argomento nello stile specificato.${hashtags.length > 0 ? ' DEVI aggiungere hashtag alla fine del post in italiano.' : ''}`,
        pt: `Tópico: ${cleanTopic}${hashtags.length > 0 ? `\nHashtags: ${hashtags.join(' ')}` : ''}\n\nCrie uma postagem sobre este tópico no estilo especificado.${hashtags.length > 0 ? ' Você DEVE adicionar hashtags no final do post em português.' : ''}`,
        ja: `トピック: ${cleanTopic}${hashtags.length > 0 ? `\nハッシュタグ: ${hashtags.join(' ')}` : ''}\n\n指定されたスタイルでこのトピックについて投稿を作成してください。${hashtags.length > 0 ? ' 必ず日本語でハッシュタグを投稿の最後に追加してください。' : ''}`,
        ko: `주제: ${cleanTopic}${hashtags.length > 0 ? `\n해시태그: ${hashtags.join(' ')}` : ''}\n\n지정된 스타일로 이 주제에 대한 게시물을 만드세요.${hashtags.length > 0 ? ' 반드시 한국어로 해시태그를 게시물 끝에 추가하세요.' : ''}`,
        zh: `主题: ${cleanTopic}${hashtags.length > 0 ? `\n标签: ${hashtags.join(' ')}` : ''}\n\n以指定风格创建关于此主题的帖子。${hashtags.length > 0 ? ' 必须在帖子末尾用中文添加标签。' : ''}`
    };
    
    const userMessage = userMessages[language] || userMessages.ru;
    
    console.log('🌍 Generating post:', { language, style, cleanTopic, hashtags });
    
    const messages = [
        {
            role: "system",
            content: systemPrompt
        },
        {
            role: "user",
            content: userMessage
        }
    ];
    
    const response = await llmModule.sendMessage(messages, {
        maxTokens: 100,
        temperature: 0.8
    });
    
    if (response.success && response.content) {
        let postText = response.content.trim();
        
        // Проверяем, добавил ли LLM хештеги сам
        const hasHashtagsInPost = /#\w+/g.test(postText);
        
        if (hasHashtagsInPost) {
            console.log('✅ LLM added hashtags automatically');
        } else {
            console.log('⚠️ LLM did not add hashtags - this is expected behavior');
        }
        
        console.log('📝 Generated post:', { language, cleanTopic, hashtags, finalPost: postText });
        return postText;
    } else {
        throw new Error('Не удалось сгенерировать пост');
    }
}

function displayGeneratedPost(postText) {
    const generatedPostEl = document.getElementById('generated-post');
    const postContentEl = document.getElementById('post-content');
    const postLengthEl = document.getElementById('post-length');
    const postTimeEl = document.getElementById('post-time');
    const regenerateBtn = document.getElementById('regenerate-post');
    const scheduleBtn = document.getElementById('schedule-post');
    
    if (postContentEl) {
        postContentEl.textContent = postText;
    }
    
    if (postLengthEl) {
        postLengthEl.textContent = `${postText.length} символов`;
    }
    
    if (postTimeEl) {
        postTimeEl.textContent = new Date().toLocaleTimeString('ru-RU');
    }
    
    if (generatedPostEl) {
        generatedPostEl.style.display = 'block';
    }
    
    if (regenerateBtn) {
        regenerateBtn.style.display = 'inline-flex';
    }
    
    // Активируем кнопку "Отложить" при показе нового поста
    if (scheduleBtn) {
        scheduleBtn.disabled = false;
        scheduleBtn.style.opacity = '1';
        scheduleBtn.style.cursor = 'pointer';
    }
}

function hideGeneratedPost() {
    const generatedPostEl = document.getElementById('generated-post');
    const regenerateBtn = document.getElementById('regenerate-post');
    const topicInput = document.getElementById('topic-input');
    
    if (generatedPostEl) {
        generatedPostEl.style.display = 'none';
    }
    
    if (regenerateBtn) {
        regenerateBtn.style.display = 'none';
    }
    
    // Очищаем поле темы для нового поста
    if (topicInput) {
        topicInput.value = '';
    }
    
    // Очищаем текущий пост
    currentGeneratedPost = null;
    
    console.log('🔄 Generated post hidden and form cleared');
}

function handleRegeneratePost() {
    if (!currentGeneratedPost) return;
    
    const topicInput = document.getElementById('topic-input');
    const postStyleSelect = document.getElementById('post-style');
    
    if (topicInput) {
        topicInput.value = currentGeneratedPost.topic;
    }
    
    if (postStyleSelect) {
        postStyleSelect.value = currentGeneratedPost.style;
    }
    
    handleGeneratePost();
}

function handleEditPost() {
    const postContentEl = document.getElementById('post-content');
    if (!postContentEl) return;
    
    const currentText = postContentEl.textContent;
    const newText = prompt('Редактировать пост:', currentText);
    
    if (newText && newText.trim() !== currentText) {
        postContentEl.textContent = newText.trim();
        
        const postLengthEl = document.getElementById('post-length');
        if (postLengthEl) {
            postLengthEl.textContent = `${newText.trim().length} символов`;
        }
        
        if (currentGeneratedPost) {
            currentGeneratedPost.text = newText.trim();
        }
        
        console.log('✏️ Post edited');
    }
}

function handleSchedulePost() {
    if (!currentGeneratedPost || !accessJwt) {
        showPostStatus('error', 'Нет поста для отложенной публикации или не авторизован');
        return;
    }
    
    const dateInput = document.getElementById('schedule-date');
    const timeInput = document.getElementById('schedule-time');
    
    if (!dateInput || !timeInput) {
        showPostStatus('error', 'Не удалось найти поля для ввода даты и времени');
        return;
    }
    
    const date = dateInput.value;
    const time = timeInput.value;
    
    if (!date || !time) {
        showPostStatus('error', 'Пожалуйста, выберите дату и время для публикации');
        return;
    }
    
    const scheduledDateTime = new Date(`${date}T${time}`);
    const now = new Date();
    
    if (scheduledDateTime <= now) {
        showPostStatus('error', 'Дата и время публикации должны быть в будущем');
        return;
    }
    
    const scheduledPost = {
        text: currentGeneratedPost.text,
        scheduledTime: scheduledDateTime.toISOString(),
        createdAt: new Date().toISOString()
    };
    
    scheduledPostsManager.addScheduledPost(scheduledPost);
    showPostStatus('success', `Пост запланирован на ${scheduledDateTime.toLocaleString('ru-RU')}`);
    
    // Скрываем опции расписания
    const scheduleOptions = document.getElementById('schedule-options');
    if (scheduleOptions) {
        scheduleOptions.style.display = 'none';
    }
    
    // Скрываем превью поста
    hideGeneratedPost();
    
    // Отключаем кнопку "Отложить" после успешного планирования
    const scheduleBtn = document.getElementById('schedule-post');
    if (scheduleBtn) {
        scheduleBtn.disabled = true;
        scheduleBtn.style.opacity = '0.5';
        scheduleBtn.style.cursor = 'not-allowed';
    }
}

async function handlePublishPost() {
    if (!currentGeneratedPost || !accessJwt) {
        showPostStatus('error', 'Нет поста для публикации или не авторизован');
        return;
    }
    
    const publishBtn = document.getElementById('publish-post');
    if (!publishBtn) return;
    
    publishBtn.disabled = true;
    publishBtn.innerHTML = '<span class="btn-icon">⏳</span>Публикация...';
    showPostStatus('loading', 'Публикуем пост в Bluesky...');
    
    try {
        const result = await publishPostToBluesky(currentGeneratedPost.text);
        
        if (result.success) {
            showPostStatus('success', 'Пост успешно опубликован!');
            addPostToHistory(currentGeneratedPost.text, result.uri);
            
            // Добавляем пост в статистику аналитики
            const hashtags = currentGeneratedPost.text.match(/#\w+/g) || [];
            const postData = {
                uri: result.uri,
                cid: result.cid,
                text: currentGeneratedPost.text,
                createdAt: new Date().toISOString(),
                hashtags: hashtags
            };
            
            console.log('📊 Adding post to analytics:', postData);
            postStatsStorage.addPost(postData);
            console.log('✅ Post added to analytics storage');
            
            // Скрываем окно предварительного просмотра после публикации
            hideGeneratedPost();
            
            console.log('✅ Post published:', result.uri);
        } else {
            throw new Error(result.error || 'Неизвестная ошибка');
        }
        
    } catch (error) {
        console.error('❌ Failed to publish post:', error);
        showPostStatus('error', `Ошибка публикации: ${error.message}`);
    } finally {
        publishBtn.disabled = false;
        publishBtn.innerHTML = '<span class="btn-icon">🚀</span>Опубликовать';
    }
}

// ==================== АНАЛИЗ ТРЕНДОВ ====================

let analysisInProgress = false;
let analysisResults = null;

async function handleStartAnalysis() {
    if (analysisInProgress) {
        console.log('⚠️ Analysis already in progress');
        return;
    }
    
    if (!accessJwt) {
        showAnalysisStatus('error', 'Необходима авторизация для анализа');
        return;
    }
    
    // Проверяем токен LLM
    if (!llmModule || !llmModule.apiKey || llmModule.apiKey.trim() === '') {
        showAnalysisStatus('error', 'LLM не настроен. Проверьте API ключ в настройках.');
        console.log('⚠️ LLM token not configured for analysis');
        return;
    }
    
    console.log('🔄 Starting fresh analysis - fetching latest posts from API');
    
        const analysisTypeSelect = document.getElementById('analysis-type');
        
        const type = analysisTypeSelect?.value || 'whatshot';
        
        console.log('📊 Starting analysis:', { type });
    
    analysisInProgress = true;
    updateAnalysisIndicator('progress');
    
    try {
        // Показываем прогресс
        showAnalysisProgress(true);
        updateProgress(0, 'Загружаем посты...');
        
            // Получаем посты (фиксированное количество для актуального анализа)
            const posts = await fetchPostsForAnalysis(type, 50);
        updateProgress(50, 'Анализируем посты...');
        
        // Анализируем через LLM
        const analysis = await analyzePostsWithLLM(posts);
        updateProgress(100, 'Анализ завершен!');
        
        // Сохраняем результаты
        analysisResults = analysis;
        
        // Показываем результаты
        showAnalysisResults(analysis);
        updateAnalysisIndicator('completed');
        
        console.log('✅ Analysis completed:', analysis);
        
    } catch (error) {
        console.error('❌ Analysis failed:', error);
        showAnalysisStatus('error', `Ошибка анализа: ${error.message}`);
        updateAnalysisIndicator('error');
    } finally {
        analysisInProgress = false;
        showAnalysisProgress(false);
    }
}

async function fetchPostsForAnalysis(type, limit) {
    console.log('📥 Fetching posts for analysis:', { type, limit });
    
    let url;
    let params = new URLSearchParams();
    params.append('limit', limit);
    
    switch (type) {
        case 'timeline':
            url = `${BLUESKY_API_BASE}/app.bsky.feed.getTimeline`;
            break;
        case 'discover':
            // Попробуем получить популярные посты через поиск
            url = `${BLUESKY_API_BASE}/app.bsky.feed.searchPosts`;
            params.append('q', 'lang:ru OR lang:en'); // Поиск по языкам для получения большего количества постов
            params.append('sort', 'top'); // Популярные посты
            break;
        case 'search':
            // Поиск по популярным хештегам
            url = `${BLUESKY_API_BASE}/app.bsky.feed.searchPosts`;
            params.append('q', '#trending OR #viral OR #popular OR #news');
            params.append('sort', 'top');
            break;
        case 'whatshot':
            // Попробуем получить "What's Hot" фид
            url = `${BLUESKY_API_BASE}/app.bsky.feed.getFeed`;
            params.append('feed', 'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot');
            break;
        default:
            url = `${BLUESKY_API_BASE}/app.bsky.feed.getTimeline`;
    }
    
    const fullUrl = `${url}?${params.toString()}`;
    console.log('📥 Request URL:', fullUrl);
    
    const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessJwt}`,
            'Content-Type': 'application/json'
        }
    });
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('📥 Posts fetched:', {
        totalPosts: data.feed?.length || data.posts?.length || 0,
        hasFeed: !!data.feed,
        hasPosts: !!data.posts,
        dataKeys: Object.keys(data)
    });
    
    // Возвращаем посты из разных возможных полей ответа
    return data.feed || data.posts || [];
}

async function analyzePostsWithLLM(posts) {
    if (!llmModule || !llmModule.apiKey) {
        throw new Error('LLM не настроен. Проверьте API ключ в настройках.');
    }
    
    console.log('🤖 Analyzing posts with LLM:', posts.length);
    
    // Подготавливаем данные для анализа
    const postsData = posts.map(post => ({
        text: post.post?.record?.text || '',
        author: post.post?.author?.handle || '',
        likes: post.post?.likeCount || 0,
        reposts: post.post?.repostCount || 0,
        replies: post.post?.replyCount || 0
    })).filter(post => post.text.length > 10); // Фильтруем короткие посты
    
    console.log('📊 Posts data prepared for analysis:', {
        totalPosts: posts.length,
        filteredPosts: postsData.length,
        samplePosts: postsData.slice(0, 3).map(p => ({ author: p.author, text: p.text.substring(0, 50) + '...' }))
    });
    
    const analysisPrompt = `Проанализируй следующие посты из социальной сети Bluesky и определи ТОЛЬКО актуальные тренды и популярные хештеги:

${postsData.map((post, i) => `${i + 1}. @${post.author}: "${post.text}" (👍${post.likes} 🔄${post.reposts} 💬${post.replies})`).join('\n')}

Определи ТОЛЬКО:
1. Топ-5 актуальных тем/трендов (кратко, по 1-2 слова)
2. Популярные хештеги для каждой темы

Формат ответа:
ТЕМА 1: [название темы]
ХЕШТЕГИ: #хештег1 #хештег2 #хештег3

ТЕМА 2: [название темы]  
ХЕШТЕГИ: #хештег1 #хештег2 #хештег3

ТЕМА 3: [название темы]
ХЕШТЕГИ: #хештег1 #хештег2 #хештег3

ТЕМА 4: [название темы]
ХЕШТЕГИ: #хештег1 #хештег2 #хештег3

ТЕМА 5: [название темы]
ХЕШТЕГИ: #хештег1 #хештег2 #хештег3

Ответь только в этом формате, без дополнительных объяснений.`;
    
    try {
        const messages = [
            {
                role: 'user',
                content: analysisPrompt
            }
        ];
        
        const response = await llmModule.sendMessage(messages);
        return {
            summary: response,
            postsAnalyzed: postsData.length,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('❌ LLM analysis failed:', error);
        throw new Error(`Ошибка анализа ИИ: ${error.message}`);
    }
}

function showAnalysisProgress(show) {
    const progressElement = document.getElementById('analysis-progress');
    if (progressElement) {
        progressElement.style.display = show ? 'block' : 'none';
    }
}

function updateProgress(percent, text) {
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    
    if (progressFill) {
        progressFill.style.width = `${percent}%`;
    }
    
    if (progressText) {
        progressText.textContent = text;
    }
}

function showAnalysisResults(analysis) {
    const resultsElement = document.getElementById('analysis-results');
    if (!resultsElement) return;
    
    resultsElement.style.display = 'block';
    
    // Обновляем статус
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    
    if (statusIndicator) {
        statusIndicator.style.backgroundColor = 'var(--accent-success)';
    }
    
    if (statusText) {
        statusText.textContent = 'Анализ завершен';
    }
    
    // Обновляем результаты
    const trendsSummary = document.getElementById('trends-summary');
    if (trendsSummary) {
        // Извлекаем контент из ответа LLM
        const summaryContent = analysis.summary?.content || analysis.summary || 'Анализ не выполнен';
        
        // Парсим тренды и создаем виджеты
        const trends = parseTrendsFromLLM(summaryContent);
        
        trendsSummary.innerHTML = `
            <div class="trends-widgets">
                ${trends.map(trend => createTrendWidget(trend)).join('')}
            </div>
            <div class="analysis-meta">
                <small>Проанализировано постов: ${analysis.postsAnalyzed} | ${new Date(analysis.timestamp).toLocaleString()}</small>
            </div>
        `;
    }
}

function parseTrendsFromLLM(content) {
    const trends = [];
    const lines = content.split('\n');
    
    let currentTrend = null;
    
    for (const line of lines) {
        const trimmedLine = line.trim();
        
        if (trimmedLine.startsWith('ТЕМА')) {
            if (currentTrend) {
                trends.push(currentTrend);
            }
            const themeMatch = trimmedLine.match(/ТЕМА \d+: (.+)/);
            if (themeMatch) {
                currentTrend = {
                    theme: themeMatch[1].trim(),
                    hashtags: []
                };
            }
        } else if (trimmedLine.startsWith('ХЕШТЕГИ:')) {
            if (currentTrend) {
                const hashtagsText = trimmedLine.replace('ХЕШТЕГИ:', '').trim();
                const hashtags = hashtagsText.split(/\s+/).filter(tag => tag.startsWith('#'));
                currentTrend.hashtags = hashtags;
            }
        }
    }
    
    if (currentTrend) {
        trends.push(currentTrend);
    }
    
    console.log('📊 Parsed trends:', trends);
    return trends;
}

function createTrendWidget(trend) {
    const hashtagsText = trend.hashtags.join(' ');
    
    return `
        <div class="trend-widget">
            <div class="trend-header">
                <h4>${trend.theme}</h4>
                <button class="btn btn-primary generate-post-btn" onclick="generatePostFromTrend('${trend.theme}', '${hashtagsText}')">
                    <span class="btn-icon icon"><span class="material-symbols-outlined">edit_document</span></span>
                    Создать пост
                </button>
            </div>
            <div class="trend-hashtags">
                ${trend.hashtags.map(tag => `<span class="hashtag">${tag}</span>`).join('')}
            </div>
        </div>
    `;
}

function generatePostFromTrend(theme, hashtags) {
    // Переключаемся на вкладку постов
    switchSection('posts');
    
    // Заполняем поле темы в новом формате
    const topicInput = document.getElementById('topic-input');
    if (topicInput) {
        topicInput.value = `${theme} Tags: {${hashtags}}`;
    }
    
    console.log('📝 Generating post for trend:', { theme, hashtags, format: `${theme} Tags: {${hashtags}}` });
}

function showAnalysisStatus(type, message) {
    console.log(`📊 Analysis status [${type}]:`, message);
    
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    
    if (statusIndicator) {
        switch (type) {
            case 'error':
                statusIndicator.style.backgroundColor = 'var(--accent-danger)';
                break;
            case 'success':
                statusIndicator.style.backgroundColor = 'var(--accent-success)';
                break;
            case 'loading':
                statusIndicator.style.backgroundColor = 'var(--accent-warning)';
                break;
        }
    }
    
    if (statusText) {
        statusText.textContent = message;
    }
}

function updateAnalysisIndicator(status) {
    const indicator = document.getElementById('analysis-indicator');
    if (!indicator) return;
    
    indicator.style.display = 'block';
    
    switch (status) {
        case 'progress':
            indicator.className = 'analysis-indicator';
            break;
        case 'completed':
            indicator.className = 'analysis-indicator completed';
            break;
        case 'error':
            indicator.style.backgroundColor = 'var(--accent-danger)';
            indicator.className = 'analysis-indicator';
            break;
        case 'none':
            indicator.style.display = 'none';
            break;
    }
}

function handleExportAnalysis() {
    if (!analysisResults) {
        showAnalysisStatus('error', 'Нет результатов для экспорта');
        return;
    }
    
    const exportData = {
        timestamp: analysisResults.timestamp,
        postsAnalyzed: analysisResults.postsAnalyzed,
        summary: analysisResults.summary,
        exportedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `bluesky-analysis-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('📤 Analysis exported');
}

// ==================== ПРОВЕРКА СЕССИЙ ====================

async function checkSessionValidity(accessJwt) {
    if (!accessJwt) {
        console.log('❌ No access token provided');
        return false;
    }
    
    try {
        const url = `${BLUESKY_API_BASE}/com.atproto.server.getSession`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessJwt}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Session valid for:', data.handle);
            return true;
        } else {
            console.log('❌ Session invalid:', response.status, response.statusText);
            return false;
        }
    } catch (error) {
        console.error('❌ Session check failed:', error);
        return false;
    }
}

async function cleanupExpiredAccounts() {
    console.log('🧹 Checking for expired accounts...');
    
    const validAccounts = [];
    let removedCount = 0;
    
    for (let i = 0; i < accounts.length; i++) {
        const account = accounts[i];
        
        try {
            const isValid = await checkSessionValidity(account.accessJwt);
            
            if (isValid) {
                validAccounts.push(account);
                console.log('✅ Account valid:', account.handle);
            } else {
                console.log('❌ Removing expired account:', account.handle);
                removedCount++;
            }
        } catch (error) {
            console.error('❌ Error checking account:', account.handle, error);
            removedCount++;
        }
    }
    
    if (removedCount > 0) {
        accounts = validAccounts;
        saveAccounts();
        console.log(`🧹 Cleaned up ${removedCount} expired accounts`);
        
        // Обновляем индекс текущего аккаунта
        if (currentAccountIndex >= accounts.length) {
            currentAccountIndex = accounts.length > 0 ? 0 : -1;
            saveCurrentAccountIndex();
        }
    }
}

// ==================== УТИЛИТЫ ДЛЯ ХЕШТЕГОВ ====================

function generateHashtagFacets(text) {
    const facets = [];
    const hashtagRegex = /#(\w+)/g;
    let match;
    
    // Проверяем, содержит ли текст кириллические символы
    const hasCyrillic = /[а-яё]/i.test(text);
    
    while ((match = hashtagRegex.exec(text)) !== null) {
        const hashtag = match[0]; // #inktober
        const tagName = match[1];  // inktober
        const start = match.index;
        const end = start + hashtag.length;
        
        // Если текст содержит кириллицу, пропускаем кириллические хештеги
        if (hasCyrillic && /[а-яё]/i.test(tagName)) {
            console.log('🚫 Skipping Cyrillic hashtag:', hashtag);
            continue;
        }
        
        // Конвертируем позиции символов в байты UTF-8
        const byteStart = new TextEncoder().encode(text.substring(0, start)).length;
        const byteEnd = new TextEncoder().encode(text.substring(0, end)).length;
        
        facets.push({
            index: { byteStart, byteEnd },
            features: [
                { 
                    "$type": "app.bsky.richtext.facet#tag", 
                    tag: tagName 
                }
            ]
        });
    }
    
    console.log('🏷️ Generated hashtag facets:', facets);
    console.log('🏷️ Text has Cyrillic:', hasCyrillic);
    return facets;
}

async function publishPostToBluesky(postText) {
    if (!userProfile || !userProfile.did) {
        throw new Error('Информация о пользователе не загружена');
    }
    
    console.log('📝 Publishing post to Bluesky:', {
        did: userProfile.did,
        text: postText.substring(0, 50) + '...'
    });
    
    const url = `${BLUESKY_API_BASE}/com.atproto.repo.createRecord`;
    
    // Генерируем facets для хештегов
    const facets = generateHashtagFacets(postText);
    console.log('🏷️ Post text:', postText);
    console.log('🏷️ Facets count:', facets.length);
    
    const requestBody = {
        repo: userProfile.did,
        collection: "app.bsky.feed.post",
        record: {
            "$type": "app.bsky.feed.post",
            "text": postText,
            "createdAt": new Date().toISOString(),
            ...(facets.length > 0 && { facets })
        }
    };
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessJwt}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        console.log('📥 Publish Response:', {
            status: response.status,
            statusText: response.statusText
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`HTTP ${response.status}: ${errorData.message || response.statusText}`);
        }
        
        const data = await response.json();
        console.log('✅ Post published successfully:', {
            uri: data.uri,
            cid: data.cid
        });
        
        return {
            success: true,
            uri: data.uri,
            cid: data.cid
        };
        
    } catch (error) {
        console.error('❌ Publish Error:', error);
        throw error;
    }
}

function showPostStatus(type, message) {
    const statusEl = document.getElementById('post-status');
    if (!statusEl) return;
    
    statusEl.className = `post-status ${type}`;
    statusEl.textContent = message;
    
    // Скрываем статус через 5 секунд для success/error
    if (type === 'success' || type === 'error') {
        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 5000);
    }
}

function addPostToHistory(postText, uri) {
    const postsListEl = document.getElementById('posts-list');
    if (!postsListEl) return;
    
    // Убираем empty state если есть
    const emptyState = postsListEl.querySelector('.empty-state');
    if (emptyState) {
        emptyState.remove();
    }
    
    // Создаем новый элемент поста
    const postItem = document.createElement('div');
    postItem.className = 'post-item';
    
    postItem.innerHTML = `
        <div class="post-item-content">${postText}</div>
        <div class="post-item-meta">
            <span class="post-item-time">${new Date().toLocaleTimeString('ru-RU')}</span>
            <span class="post-item-uri">${uri.split('/').pop()}</span>
        </div>
    `;
    
    // Добавляем в начало списка
    postsListEl.insertBefore(postItem, postsListEl.firstChild);
    
    // Ограничиваем количество постов в истории
    const posts = postsListEl.querySelectorAll('.post-item');
    if (posts.length > 10) {
        posts[posts.length - 1].remove();
    }
}

// Функции для работы с множественными аккаунтами
async function loadAccounts() {
    try {
        let savedAccounts = null;
        let savedCurrentIndex = null;
        
        // Пытаемся загрузить из файлового хранилища (Electron)
        if (window.electronAPI && window.electronAPI.loadUserData) {
            try {
                const accountsResult = await window.electronAPI.loadUserData('accounts');
                const indexResult = await window.electronAPI.loadUserData('currentAccountIndex');
                
                if (accountsResult.success && accountsResult.data) {
                    savedAccounts = JSON.stringify(accountsResult.data);
                }
                if (indexResult.success && indexResult.data !== null) {
                    savedCurrentIndex = indexResult.data.toString();
                }
                console.log('📂 Loaded from file storage');
            } catch (error) {
                console.log('📂 Falling back to localStorage');
            }
        }
        
        // Fallback на localStorage
        if (!savedAccounts) {
            savedAccounts = localStorage.getItem('blueskyAccounts');
        }
        if (savedCurrentIndex === null) {
            savedCurrentIndex = localStorage.getItem('currentAccountIndex');
        }
        
        if (savedAccounts) {
            accounts = JSON.parse(savedAccounts);
            console.log('📚 Loaded accounts:', accounts.length);
        }
        
        if (savedCurrentIndex !== null) {
            currentAccountIndex = parseInt(savedCurrentIndex);
            console.log('📍 Current account index:', currentAccountIndex);
        }
        
    } catch (error) {
        console.error('❌ Error loading accounts:', error);
        accounts = [];
        currentAccountIndex = -1;
    }
}

async function saveAccounts() {
    try {
        // Пытаемся сохранить в файловое хранилище (Electron)
        if (window.electronAPI && window.electronAPI.saveUserData) {
            try {
                await window.electronAPI.saveUserData('accounts', accounts);
                await window.electronAPI.saveUserData('currentAccountIndex', currentAccountIndex);
                console.log('💾 Accounts saved to file storage');
            } catch (error) {
                console.log('📂 Falling back to localStorage');
            }
        }
        
        // Fallback на localStorage
        localStorage.setItem('blueskyAccounts', JSON.stringify(accounts));
        localStorage.setItem('currentAccountIndex', currentAccountIndex.toString());
        console.log('💾 Accounts saved:', accounts.length);
    } catch (error) {
        console.error('❌ Error saving accounts:', error);
    }
}

function setCurrentAccount(account) {
    currentUser = account.user;
    userProfile = account.profile;
    accessJwt = account.accessJwt;
    refreshJwt = account.refreshJwt;
    isAuthenticated = true;
    
    console.log('👤 Switched to account:', account.handle);
}

function addAccount(userData, tokens, profile = null) {
    if (accounts.length >= MAX_ACCOUNTS) {
        throw new Error(`Максимум ${MAX_ACCOUNTS} аккаунтов`);
    }
    
    // Проверяем, не существует ли уже такой аккаунт
    const existingAccount = accounts.find(acc => acc.handle === userData.handle);
    if (existingAccount) {
        throw new Error('Аккаунт уже добавлен');
    }
    
    const newAccount = {
        handle: userData.handle,
        did: userData.did,
        email: userData.email,
        displayName: userData.displayName,
        accessJwt: tokens.accessJwt,
        refreshJwt: tokens.refreshJwt,
        user: userData,
        profile: profile,
        addedAt: new Date().toISOString(),
        avatar: userData.avatar || null
    };
    
    accounts.push(newAccount);
    currentAccountIndex = accounts.length - 1;
    
    saveAccounts();
    console.log('✅ Account added:', newAccount.handle);
    
    // Загружаем профиль с аватаром для нового аккаунта
    loadAccountProfile(newAccount);
    
    return newAccount;
}

function removeAccount(index) {
    if (index >= 0 && index < accounts.length) {
        const removedAccount = accounts.splice(index, 1)[0];
        
        // Обновляем индекс текущего аккаунта
        if (currentAccountIndex === index) {
            currentAccountIndex = accounts.length > 0 ? 0 : -1;
        } else if (currentAccountIndex > index) {
            currentAccountIndex--;
        }
        
        saveAccounts();
        console.log('🗑️ Account removed:', removedAccount.handle);
        
        return removedAccount;
    }
    return null;
}

function switchToAccount(index) {
    if (index >= 0 && index < accounts.length) {
        currentAccountIndex = index;
        const account = accounts[index];
        
        setCurrentAccount(account);
        saveAccounts();
        
        // Обновляем интерфейс
        updateUserInfo();
        loadUserProfile();
        
        console.log('🔄 Switched to account:', account.handle);
        return true;
    }
    return false;
}

function getAccountByHandle(handle) {
    return accounts.find(acc => acc.handle === handle);
}

function updateAccountProfile(handle, profile) {
    const account = getAccountByHandle(handle);
    if (account) {
        account.profile = profile;
        account.avatar = profile.avatar;
        saveAccounts();
        console.log('🔄 Profile updated for:', handle);
    }
}

async function loadAccountProfile(account) {
    try {
        console.log('📸 Loading profile for account:', account.handle);
        
        const url = `${BLUESKY_API_BASE}/app.bsky.actor.getProfile?actor=${encodeURIComponent(account.handle)}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${account.accessJwt}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const profileData = await response.json();
        
        // Обновляем профиль аккаунта
        account.profile = profileData;
        account.avatar = profileData.avatar || null;
        account.displayName = profileData.displayName || account.handle;
        
        console.log('📸 Avatar URL for account:', account.handle, account.avatar);
        
        saveAccounts();
        
        console.log('✅ Profile loaded for account:', account.handle, {
            avatar: !!profileData.avatar,
            displayName: profileData.displayName
        });
        
        // Обновляем миниатюры если это текущий аккаунт
        if (account === accounts[currentAccountIndex]) {
            updateAccountThumbnails();
        }
        
    } catch (error) {
        console.error('❌ Error loading profile for account:', account.handle, error);
    }
}

async function loadAllAccountProfiles() {
    console.log('📸 Loading profiles for all accounts...');
    
    for (const account of accounts) {
        await loadAccountProfile(account);
        // Небольшая задержка между запросами
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('✅ All account profiles loaded');
}

async function refreshAccountToken(account) {
    try {
        console.log('🔄 Refreshing token for account:', account.handle);
        
        const url = `${BLUESKY_API_BASE}/com.atproto.server.refreshSession`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                refreshJwt: account.refreshJwt
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const tokenData = await response.json();
        
        // Обновляем токены
        account.accessJwt = tokenData.accessJwt;
        account.refreshJwt = tokenData.refreshJwt;
        
        saveAccounts();
        
        console.log('✅ Token refreshed for account:', account.handle);
        
        return true;
        
    } catch (error) {
        console.error('❌ Error refreshing token for account:', account.handle, error);
        return false;
    }
}

async function checkAndRefreshToken(account) {
    try {
        // Проверяем токен, делая простой запрос
        const url = `${BLUESKY_API_BASE}/com.atproto.server.getSession`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${account.accessJwt}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.status === 401) {
            console.log('🔄 Token expired, refreshing...');
            return await refreshAccountToken(account);
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ Error checking token:', error);
        return false;
    }
}

// Функции для отображения панели быстрого входа
function showQuickLoginPanel() {
    const quickLoginPanel = document.getElementById('quick-login-panel');
    if (!quickLoginPanel) return;
    
    if (accounts.length > 0) {
        quickLoginPanel.style.display = 'block';
        updateAccountThumbnails();
    } else {
        quickLoginPanel.style.display = 'none';
    }
}

function updateAccountThumbnails() {
    const thumbnailsContainer = document.getElementById('account-thumbnails');
    if (!thumbnailsContainer) return;
    
    thumbnailsContainer.innerHTML = '';
    
    accounts.forEach((account, index) => {
        const thumbnail = document.createElement('div');
        thumbnail.className = 'account-thumbnail';
        thumbnail.dataset.accountIndex = index;
        
        if (index === currentAccountIndex) {
            thumbnail.classList.add('active');
        }
        
        // Создаем аватар
        if (account.avatar) {
            const avatarImg = document.createElement('img');
            avatarImg.className = 'avatar';
            avatarImg.src = account.avatar;
            avatarImg.alt = account.handle;
            thumbnail.appendChild(avatarImg);
        } else {
            const defaultAvatar = document.createElement('div');
            defaultAvatar.className = 'default-avatar';
            defaultAvatar.textContent = '👤';
            thumbnail.appendChild(defaultAvatar);
        }
        
        // Добавляем хэндл при наведении
        const handleSpan = document.createElement('span');
        handleSpan.className = 'handle';
        handleSpan.textContent = account.handle;
        thumbnail.appendChild(handleSpan);
        
        // Добавляем кнопку удаления
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '×';
        deleteBtn.title = 'Удалить аккаунт';
        thumbnail.appendChild(deleteBtn);
        
        // Добавляем обработчик клика для входа
        thumbnail.addEventListener('click', (e) => {
            // Не переключаемся если кликнули по кнопке удаления
            if (e.target.classList.contains('delete-btn')) {
                e.stopPropagation();
                return;
            }
            handleQuickLogin(index);
        });
        
        // Добавляем обработчик клика для удаления
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleDeleteAccount(index);
        });
        
        // Добавляем обработчик правого клика для удаления
        thumbnail.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            handleDeleteAccount(index);
        });
        
        // Добавляем обработчик долгого нажатия для удаления (мобильные устройства)
        let longPressTimer;
        thumbnail.addEventListener('mousedown', (e) => {
            if (e.button === 0) { // левая кнопка мыши
                longPressTimer = setTimeout(() => {
                    handleDeleteAccount(index);
                }, 1000); // 1 секунда
            }
        });
        
        thumbnail.addEventListener('mouseup', () => {
            clearTimeout(longPressTimer);
        });
        
        thumbnail.addEventListener('mouseleave', () => {
            clearTimeout(longPressTimer);
        });
        
        thumbnailsContainer.appendChild(thumbnail);
    });
}

function handleDeleteAccount(accountIndex) {
    if (accountIndex < 0 || accountIndex >= accounts.length) {
        console.error('❌ Invalid account index for deletion');
        return;
    }
    
    const account = accounts[accountIndex];
    const accountHandle = account.handle;
    
    // Показываем подтверждение
    const confirmed = confirm(
        `Вы уверены, что хотите удалить аккаунт ${accountHandle}?\n\n` +
        `Это действие нельзя отменить. Аккаунт будет удален из панели быстрого входа.`
    );
    
    if (!confirmed) {
        console.log('🚫 Account deletion cancelled');
        return;
    }
    
    console.log('🗑️ Deleting account:', accountHandle);
    
    // Удаляем аккаунт
    removeAccount(accountIndex);
    
    // Обновляем панель быстрого входа
    updateAccountThumbnails();
    
    // Если удалили текущий аккаунт, показываем экран входа
    if (currentAccountIndex === -1) {
        showLoginScreen();
    }
    
    console.log('✅ Account deleted successfully');
}

async function handleQuickLogin(accountIndex) {
    if (accountIndex >= 0 && accountIndex < accounts.length) {
        const account = accounts[accountIndex];
        
        console.log('⚡ Quick login to:', account.handle);
        
        try {
            // Проверяем сессию перед входом
            const sessionValid = await checkSessionValidity(account.accessJwt);
            
            if (sessionValid) {
                // Переключаемся на аккаунт
                switchToAccount(accountIndex);
                
                // Переходим на главный экран
                showMainScreen();
                
                console.log('✅ Quick login successful');
            } else {
                // Сессия истекла - удаляем аккаунт
                console.log('❌ Session expired for account:', account.handle);
                await handleDeleteAccount(accountIndex);
                
                // Показываем сообщение
                showLoginStatus('error', `Сессия аккаунта ${account.handle} истекла. Аккаунт удален.`);
                
                // Обновляем панель быстрого входа
                updateAccountThumbnails();
            }
        } catch (error) {
            console.error('❌ Quick login failed:', error);
            
            // При ошибке тоже удаляем аккаунт
            await handleDeleteAccount(accountIndex);
            showLoginStatus('error', `Ошибка входа в аккаунт ${account.handle}. Аккаунт удален.`);
            updateAccountThumbnails();
        }
    }
}

function showLoginScreen() {
    const loginScreen = document.getElementById('login-screen');
    const mainScreen = document.getElementById('main-screen');
    
    if (loginScreen) {
        loginScreen.classList.add('active');
    }
    
    if (mainScreen) {
        mainScreen.classList.remove('active');
    }
    
    // Показываем панель быстрого входа если есть аккаунты
    showQuickLoginPanel();
    
    // Очищаем форму
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.reset();
    }
}

// Bluesky API функции
class BlueskyAPI {
    constructor() {
        this.baseURL = 'https://bsky.social/xrpc';
        this.session = null;
    }
    
    setSession(session) {
        this.session = session;
    }
    
    async makeRequest(endpoint, params = {}) {
        if (!this.session || !this.session.accessJwt) {
            throw new Error('Bluesky сессия не найдена. Необходимо авторизоваться.');
        }
        
        const url = new URL(`${this.baseURL}${endpoint}`);
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${this.session.accessJwt}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Bluesky API error: ${response.status}`);
        }
        
        return await response.json();
    }
    
    async getLikes(uri, limit = 100) {
        return await this.makeRequest('/app.bsky.feed.getLikes', {
            uri: uri,
            limit: limit
        });
    }
    
    async getActorLikes(actor, limit = 100) {
        return await this.makeRequest('/app.bsky.feed.getActorLikes', {
            actor: actor,
            limit: limit
        });
    }
    
    async getPostThread(uri) {
        return await this.makeRequest('/app.bsky.feed.getPostThread', {
            uri: uri
        });
    }
    
    async getRepostedBy(uri, limit = 100) {
        return await this.makeRequest('/app.bsky.feed.getRepostedBy', {
            uri: uri,
            limit: limit
        });
    }
    
    async getAuthorFeed(actor, limit = 20, cursor = null) {
        const params = {
            actor: actor,
            limit: limit
        };
        
        if (cursor) {
            params.cursor = cursor;
        }
        
        return await this.makeRequest('/app.bsky.feed.getAuthorFeed', params);
    }
}

// Глобальный экземпляр Bluesky API
const blueskyAPI = new BlueskyAPI();

// Система хранения статистики постов
class PostStatsStorage {
    constructor() {
        this.storageKey = 'postStats';
        this.stats = this.loadStats();
    }
    
    loadStats() {
        const stored = localStorage.getItem(this.storageKey);
        return stored ? JSON.parse(stored) : {};
    }
    
    saveStats() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.stats));
    }
    
    addPost(postData) {
        const { uri, cid, text, createdAt, hashtags } = postData;
        this.stats[uri] = {
            uri,
            cid,
            text,
            createdAt,
            hashtags,
            likes: 0,
            replies: 0,
            reposts: 0,
            lastUpdated: new Date().toISOString(),
            history: []
        };
        this.saveStats();
    }
    
    updatePostStats(uri, stats) {
        if (this.stats[uri]) {
            const oldStats = { ...this.stats[uri] };
            this.stats[uri] = {
                ...this.stats[uri],
                ...stats,
                lastUpdated: new Date().toISOString()
            };
            
            // Добавляем в историю
            this.stats[uri].history.push({
                timestamp: new Date().toISOString(),
                likes: stats.likes || oldStats.likes,
                replies: stats.replies || oldStats.replies,
                reposts: stats.reposts || oldStats.reposts
            });
            
            // Ограничиваем историю последними 30 записями
            if (this.stats[uri].history.length > 30) {
                this.stats[uri].history = this.stats[uri].history.slice(-30);
            }
            
            this.saveStats();
        }
    }
    
    getPostStats(uri) {
        return this.stats[uri] || null;
    }
    
    getAllStats() {
        return this.stats;
    }
    
    getStatsByPeriod(days = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        
        return Object.values(this.stats).filter(post => 
            new Date(post.createdAt) >= cutoffDate
        );
    }
}

// Глобальный экземпляр хранилища статистики
const postStatsStorage = new PostStatsStorage();

// Класс для управления отложенными постами
class ScheduledPostsManager {
    constructor() {
        this.storageKey = 'scheduledPosts';
        this.checkInterval = null;
    }
    
    loadScheduledPosts() {
        const stored = localStorage.getItem(this.storageKey);
        return stored ? JSON.parse(stored) : [];
    }
    
    saveScheduledPosts(posts) {
        localStorage.setItem(this.storageKey, JSON.stringify(posts));
    }
    
    addScheduledPost(post) {
        const posts = this.loadScheduledPosts();
        posts.push(post);
        this.saveScheduledPosts(posts);
        this.updateUI();
        this.startChecking();
    }
    
    removeScheduledPost(index) {
        const posts = this.loadScheduledPosts();
        posts.splice(index, 1);
        this.saveScheduledPosts(posts);
        this.updateUI();
    }
    
    updateUI() {
        const posts = this.loadScheduledPosts();
        const scheduledCount = document.getElementById('scheduled-count');
        if (scheduledCount) {
            scheduledCount.textContent = posts.length;
            scheduledCount.style.display = posts.length > 0 ? 'inline-block' : 'none';
        }
        this.renderScheduledPosts();
    }
    
    renderScheduledPosts() {
        const container = document.getElementById('scheduled-posts-list');
        if (!container) return;
        
        const posts = this.loadScheduledPosts();
        
        if (posts.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon"><span class="material-symbols-outlined">schedule</span></span>
                    <p>Нет отложенных постов</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = posts.map((post, index) => `
            <div class="scheduled-post-item">
                <div class="scheduled-post-header">
                    <div class="scheduled-post-date">
                        <span class="material-symbols-outlined">schedule</span>
                        <span>${new Date(post.scheduledTime).toLocaleString('ru-RU')}</span>
                    </div>
                    <button onclick="scheduledPostsManager.removeScheduledPost(${index})" class="btn-secondary">
                        <span class="material-symbols-outlined">delete</span>
                        Удалить
                    </button>
                </div>
                <div class="scheduled-post-content">
                    ${post.text}
                </div>
            </div>
        `).join('');
    }
    
    startChecking() {
        if (this.checkInterval) return;
        
        // Проверяем каждую минуту
        this.checkInterval = setInterval(async () => {
            await this.checkAndPublish();
        }, 60000);
        
        // Также проверяем при загрузке
        this.checkAndPublish();
    }
    
    async checkAndPublish() {
        const posts = this.loadScheduledPosts();
        if (posts.length === 0) return;
        
        const now = Date.now();
        console.log(`⏰ Checking scheduled posts... Found ${posts.length} posts`);
        
        for (let i = posts.length - 1; i >= 0; i--) {
            const post = posts[i];
            const scheduledTime = new Date(post.scheduledTime).getTime();
            
            console.log(`📅 Post scheduled for ${new Date(scheduledTime).toLocaleString()}, now: ${new Date(now).toLocaleString()}`);
            
            if (now >= scheduledTime) {
                console.log(`🚀 Publishing scheduled post at ${new Date().toLocaleString()}`);
                try {
                    const result = await this.publishScheduledPost(post);
                    
                    if (result && result.success) {
                        this.removeScheduledPost(i);
                        
                        console.log('✅ Scheduled post published successfully');
                        
                        // Показываем уведомление
                        try {
                            if (window.electronAPI && window.electronAPI.showNotification) {
                                window.electronAPI.showNotification(
                                    'Пост опубликован', 
                                    post.text.substring(0, 50) + '...'
                                );
                            } else if ('Notification' in window && Notification.permission === 'granted') {
                                new Notification('Пост опубликован', {
                                    body: post.text.substring(0, 50) + '...',
                                    icon: 'img/bsnotiff.png'
                                });
                            }
                        } catch (error) {
                            console.log('Could not show notification:', error);
                        }
                    } else {
                        console.error('❌ Failed to publish scheduled post:', result);
                    }
                } catch (error) {
                    console.error('❌ Error publishing scheduled post:', error);
                }
            }
        }
    }
    
    async publishScheduledPost(post) {
        const result = await publishPostToBluesky(post.text);
        return result;
    }
}

// Глобальный экземпляр менеджера отложенных постов
const scheduledPostsManager = new ScheduledPostsManager();

// Запускаем проверку при загрузке
setTimeout(() => {
    scheduledPostsManager.updateUI();
    scheduledPostsManager.startChecking();
    requestNotificationPermission();
}, 1000);

// Запрос разрешения на уведомления
function requestNotificationPermission() {
    // Проверяем, запрашивали ли уже разрешение
    const hasAsked = localStorage.getItem('notificationPermissionAsked');
    
    if (hasAsked === 'true') {
        console.log('✅ Notification permission already requested');
        return;
    }
    
    // Для Electron приложений уведомления работают напрямую
    // Проверяем доступность Notification API
    if ('Notification' in window) {
        if (Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
                console.log('Notification permission:', permission);
                localStorage.setItem('notificationPermissionAsked', 'true');
                
                if (permission === 'granted') {
                    // Показываем тестовое уведомление
                    setTimeout(() => {
                        showTestNotification();
                    }, 2000);
                }
            });
        } else if (Notification.permission === 'granted') {
            localStorage.setItem('notificationPermissionAsked', 'true');
            // Показываем тестовое уведомление
            setTimeout(() => {
                showTestNotification();
            }, 2000);
        } else {
            localStorage.setItem('notificationPermissionAsked', 'true');
        }
    } else {
        console.log('Notifications not supported in this browser');
    }
}

// Показываем тестовое уведомление
function showTestNotification() {
    try {
        if (window.electronAPI && window.electronAPI.showNotification) {
            window.electronAPI.showNotification(
                'BSscaner готов к работе!',
                'Уведомления настроены и готовы к использованию'
            );
        } else if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('BSscaner готов к работе!', {
                body: 'Уведомления настроены и готовы к использованию',
                icon: 'img/bsnotiff.png'
            });
        }
    } catch (error) {
        console.log('Could not show test notification:', error);
    }
}

// Функции аналитики
async function refreshAnalytics() {
    // Проверяем наличие активного аккаунта
    if (currentAccountIndex === -1 || !accounts[currentAccountIndex]) {
        showAnalyticsAuthMessage();
        return;
    }
    
    const currentAccount = accounts[currentAccountIndex];
    if (!currentAccount.accessJwt) {
        showAnalyticsAuthMessage();
        return;
    }
    
    // Устанавливаем сессию из текущего аккаунта
    blueskyAPI.setSession({
        accessJwt: currentAccount.accessJwt,
        refreshJwt: currentAccount.refreshJwt,
        handle: currentAccount.handle,
        did: currentAccount.did
    });
    
    const progressElement = document.getElementById('analytics-progress');
    if (progressElement) {
        progressElement.style.display = 'block';
    }
    
    try {
        updateAnalyticsProgress(0, 'Загружаем посты пользователя...');
        
        // Получаем handle пользователя
        const actor = currentAccount.handle || currentAccount.did;
        
        console.log(`📊 Fetching author feed for: ${actor}`);
        
        // Получаем последние посты пользователя через getAuthorFeed
        const authorFeedResp = await blueskyAPI.getAuthorFeed(actor, 20);
        
        console.log('📊 Full API Response:', JSON.stringify(authorFeedResp, null, 2));
        
        // Структура ответа: {feed: [...]} а не {data: {feed: [...]}}
        const posts = authorFeedResp.feed || [];
        
        console.log(`✅ Fetched ${posts.length} posts`);
        console.log('📝 Posts structure:', posts);
        
        if (posts.length === 0) {
            updateAnalyticsProgress(100, 'Нет постов для отображения');
            showAnalyticsResults({ posts: [], summary: { totalLikes: 0, totalReplies: 0, totalReposts: 0, avgEngagement: 0, postsCount: 0 } });
            return;
        }
        
        updateAnalyticsProgress(50, 'Обрабатываем посты...');
        
        const analytics = [];
        
        // Обрабатываем каждый пост
        for (let i = 0; i < posts.length; i++) {
            const feedItem = posts[i];
            
            console.log(`📋 Processing feed item ${i + 1}:`, JSON.stringify(feedItem, null, 2));
            
            const post = feedItem.post;
            
            if (!post?.uri) {
                console.log(`⚠️ Skipping feed item ${i + 1} - no URI`);
                continue;
            }
            
            const progress = 50 + (i / posts.length) * 40;
            updateAnalyticsProgress(progress, `Обрабатываем пост ${i + 1} из ${posts.length}...`);
            
            const uri = post.uri;
            const record = post.record;
            const author = post.author;
            
            // Извлекаем текст поста и хештеги
            const text = record?.text || '';
            const hashtags = text.match(/#\w+/g) || [];
            
            // Извлекаем статистику напрямую из объекта поста
            const likeCount = post.likeCount || 0;
            const replyCount = post.replyCount || 0;
            const repostCount = post.repostCount || 0;
            const createdAt = record?.createdAt || post.record?.createdAt || '';
            
            console.log(`📊 Post ${i + 1} stats:`, {
                uri,
                text: text.substring(0, 100),
                likes: likeCount,
                replies: replyCount,
                reposts: repostCount,
                author: author?.handle
            });
            
            // Сохраняем аналитику
            const postAnalytics = {
                uri,
                createdAt,
                text: text.substring(0, 250), // Ограничиваем длину текста
                hashtags,
                likes: likeCount,
                replies: replyCount,
                reposts: repostCount,
                author: {
                    handle: author?.handle || '',
                    displayName: author?.displayName || '',
                    avatar: author?.avatar || ''
                }
            };
            
            analytics.push(postAnalytics);
        }
        
        updateAnalyticsProgress(95, 'Формируем отчет...');
        
        console.log(`📊 Total analytics collected: ${analytics.length}`);
        
        // Вычисляем общую статистику
        const summary = calculateAnalyticsSummary(analytics);
        
        updateAnalyticsProgress(100, 'Загрузка завершена');
        
        // Показываем результаты
        showAnalyticsResults({ posts: analytics, summary });
        
    } catch (error) {
        console.error('Ошибка при загрузке аналитики:', error);
        updateAnalyticsProgress(100, 'Ошибка при загрузке данных');
    }
}

function updateAnalyticsProgress(percent, text) {
    const progressFill = document.getElementById('analytics-progress-fill');
    const progressText = document.getElementById('analytics-progress-text');
    
    if (progressFill) {
        progressFill.style.width = `${percent}%`;
    }
    
    if (progressText) {
        progressText.textContent = text;
    }
}

function calculateAnalyticsSummary(posts) {
    const totalLikes = posts.reduce((sum, post) => sum + (post.likes || 0), 0);
    const totalReplies = posts.reduce((sum, post) => sum + (post.replies || 0), 0);
    const totalReposts = posts.reduce((sum, post) => sum + (post.reposts || 0), 0);
    const totalEngagement = totalLikes + totalReplies + totalReposts;
    const avgEngagement = posts.length > 0 ? Math.round((totalEngagement / posts.length) * 100) / 100 : 0;
    
    return {
        totalLikes,
        totalReplies,
        totalReposts,
        totalEngagement,
        avgEngagement,
        postsCount: posts.length
    };
}

function showAnalyticsResults(data) {
    const resultsElement = document.getElementById('analytics-results');
    if (!resultsElement) return;
    
    resultsElement.style.display = 'block';
    
    // Обновляем общую статистику
    updateStatsOverview(data.summary);
    
    // Показываем топ посты
    showTopPosts(data.posts);
    
    // Показываем график трендов
    showTrendsChart(data.posts);
    
    // Показываем детальную таблицу
    showDetailedStats(data.posts);
    
    // Скрываем прогресс
    const progressElement = document.getElementById('analytics-progress');
    if (progressElement) {
        progressElement.style.display = 'none';
    }
}

function updateStatsOverview(summary) {
    const totalLikesEl = document.getElementById('total-likes');
    const totalRepliesEl = document.getElementById('total-replies');
    const totalRepostsEl = document.getElementById('total-reposts');
    const avgEngagementEl = document.getElementById('avg-engagement');
    
    if (totalLikesEl) totalLikesEl.textContent = summary.totalLikes.toLocaleString();
    if (totalRepliesEl) totalRepliesEl.textContent = summary.totalReplies.toLocaleString();
    if (totalRepostsEl) totalRepostsEl.textContent = summary.totalReposts.toLocaleString();
    if (avgEngagementEl) avgEngagementEl.textContent = `${summary.avgEngagement}%`;
}

function showTopPosts(posts) {
    const topPostsList = document.getElementById('top-posts-list');
    if (!topPostsList) return;
    
    // Сортируем по лайкам
    const sortedPosts = posts
        .sort((a, b) => (b.likes || 0) - (a.likes || 0))
        .slice(0, 5);
    
    topPostsList.innerHTML = sortedPosts.map(post => `
        <div class="post-item-analytics">
            <div class="post-content-analytics">
                <div class="post-text">${post.text.substring(0, 100)}${post.text.length > 100 ? '...' : ''}</div>
                <div class="post-meta-analytics">
                    <span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin-right: 4px;">schedule</span>
                    <span>${new Date(post.createdAt).toLocaleDateString()}</span>
                    ${post.hashtags && post.hashtags.length > 0 ? `<span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle; margin: 0 4px;">tag</span><span>${post.hashtags.join(' ')}</span>` : ''}
                </div>
            </div>
            <div class="post-stats-analytics">
                <div class="post-stat-analytics">
                    <span class="material-symbols-outlined">favorite</span>
                    <span>${post.likes || 0}</span>
                </div>
                <div class="post-stat-analytics">
                    <span class="material-symbols-outlined">comment</span>
                    <span>${post.replies || 0}</span>
                </div>
                <div class="post-stat-analytics">
                    <span class="material-symbols-outlined">repeat</span>
                    <span>${post.reposts || 0}</span>
                </div>
            </div>
        </div>
    `).join('');
}

function showTrendsChart(posts) {
    const chartContainer = document.getElementById('trends-chart');
    if (!chartContainer || posts.length === 0) {
        if (chartContainer) {
            chartContainer.innerHTML = '<div class="no-data-message">Нет данных для графика</div>';
        }
        return;
    }
    
    // Группируем посты по датам
    const postsByDate = {};
    posts.forEach(post => {
        const date = new Date(post.createdAt).toLocaleDateString();
        if (!postsByDate[date]) {
            postsByDate[date] = { likes: 0, replies: 0, reposts: 0, posts: 0 };
        }
        postsByDate[date].likes += post.likes || 0;
        postsByDate[date].replies += post.replies || 0;
        postsByDate[date].reposts += post.reposts || 0;
        postsByDate[date].posts++;
    });
    
    const dates = Object.keys(postsByDate).sort((a, b) => new Date(a) - new Date(b));
    const maxValue = Math.max(...Object.values(postsByDate).map(d => d.likes + d.replies + d.reposts));
    
    // Создаем компактный SVG график со свечами
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const chartWidth = Math.min(dates.length * 40 + 60, 600);
    const chartHeight = 150;
    svg.setAttribute('viewBox', `0 0 ${chartWidth} ${chartHeight}`);
    svg.style.width = '100%';
    svg.style.maxWidth = '600px';
    svg.style.height = '150px';
    svg.style.margin = '0 auto';
    
    dates.forEach((date, index) => {
        const data = postsByDate[date];
        const totalEngagement = data.likes + data.replies + data.reposts;
        const candleHeight = (totalEngagement / maxValue) * (chartHeight - 40);
        const x = index * 40 + 40;
        const y = chartHeight - 30 - candleHeight;
        const candleWidth = 20;
        
        // Тело свечи - общая вовлеченность
        const candle = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        candle.setAttribute('x', x);
        candle.setAttribute('y', y);
        candle.setAttribute('width', candleWidth);
        candle.setAttribute('height', candleHeight);
        candle.setAttribute('fill', '#4A90E2');
        candle.setAttribute('rx', '2');
        svg.appendChild(candle);
        
        // Направляющая линия сверху (wick)
        const topWick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        topWick.setAttribute('x1', x + candleWidth / 2);
        topWick.setAttribute('y1', y - 5);
        topWick.setAttribute('x2', x + candleWidth / 2);
        topWick.setAttribute('y2', y);
        topWick.setAttribute('stroke', '#4A90E2');
        topWick.setAttribute('stroke-width', '1');
        svg.appendChild(topWick);
        
        // Направляющая линия снизу (wick)
        const bottomWick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        bottomWick.setAttribute('x1', x + candleWidth / 2);
        bottomWick.setAttribute('y1', y + candleHeight);
        bottomWick.setAttribute('x2', x + candleWidth / 2);
        bottomWick.setAttribute('y2', chartHeight - 25);
        bottomWick.setAttribute('stroke', '#4A90E2');
        bottomWick.setAttribute('stroke-width', '1');
        svg.appendChild(bottomWick);
        
        // Подпись даты
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', x + candleWidth / 2);
        text.setAttribute('y', chartHeight - 10);
        text.setAttribute('font-size', '9');
        text.setAttribute('fill', '#CCCCCC');
        text.setAttribute('text-anchor', 'middle');
        text.textContent = date.substring(0, 5);
        svg.appendChild(text);
    });
    
    // Легенда
    const legend = document.createElement('div');
    legend.style.cssText = 'display: flex; gap: 20px; margin-top: 15px; justify-content: center; flex-wrap: wrap;';
    legend.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 12px; height: 12px; background: #FF5C5C; border-radius: 2px;"></div>
            <span style="font-size: 11px; color: #CCCCCC;">Лайки</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 12px; height: 12px; background: #4A90E2; border-radius: 2px;"></div>
            <span style="font-size: 11px; color: #CCCCCC;">Комментарии</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 12px; height: 12px; background: #00C875; border-radius: 2px;"></div>
            <span style="font-size: 11px; color: #CCCCCC;">Репосты</span>
        </div>
    `;
    
    chartContainer.innerHTML = '';
    chartContainer.appendChild(svg);
    chartContainer.appendChild(legend);
}

function showDetailedStats(posts) {
    const postsTable = document.getElementById('posts-table');
    if (!postsTable) return;
    
    // Сортируем по дате создания (новые сверху)
    const sortedPosts = posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    postsTable.innerHTML = `
        <div class="table-header">
            <div>Пост</div>
            <div>Лайки</div>
            <div>Комментарии</div>
            <div>Репосты</div>
            <div>Дата</div>
        </div>
        ${sortedPosts.map(post => `
            <div class="table-row">
                <div class="table-cell post-text">${post.text.substring(0, 80)}${post.text.length > 80 ? '...' : ''}</div>
                <div class="table-cell stat-value">${post.likes || 0}</div>
                <div class="table-cell stat-value">${post.replies || 0}</div>
                <div class="table-cell stat-value">${post.reposts || 0}</div>
                <div class="table-cell">${new Date(post.createdAt).toLocaleDateString()}</div>
            </div>
        `).join('')}
    `;
}

function showAnalyticsAuthMessage() {
    const tokenMessage = document.getElementById('analytics-token-message');
    const analyticsContent = document.getElementById('analytics-content');
    
    if (tokenMessage) {
        tokenMessage.innerHTML = `
            <div class="token-message-content">
                <div class="token-icon">🔑</div>
                <h3>Требуется авторизация</h3>
                <p>Для работы аналитики необходимо авторизоваться в Bluesky.</p>
                <p>Перейдите в <strong>Аккаунт</strong> и войдите в систему.</p>
                <button class="btn btn-primary" onclick="switchSection('account')">
                    <span class="btn-icon">👤</span>
                    Перейти к авторизации
                </button>
            </div>
        `;
        tokenMessage.style.display = 'flex';
    }
    
    if (analyticsContent) {
        analyticsContent.style.display = 'none';
    }
}

function hideAnalyticsAuthMessage() {
    const tokenMessage = document.getElementById('analytics-token-message');
    const analyticsContent = document.getElementById('analytics-content');
    
    if (tokenMessage) {
        tokenMessage.style.display = 'none';
    }
    
    if (analyticsContent) {
        analyticsContent.style.display = 'block';
    }
}

// Функция для очистки тестовых данных
function clearTestData() {
    const postStats = localStorage.getItem('postStats');
    if (postStats) {
        try {
            const stats = JSON.parse(postStats);
            const filteredStats = {};
            
            // Удаляем только тестовые посты (с фиктивными URI)
            Object.keys(stats).forEach(key => {
                if (!key.includes('did:plc:test123') && !key.includes('test-cid')) {
                    filteredStats[key] = stats[key];
                }
            });
            
            if (Object.keys(filteredStats).length === 0) {
                localStorage.removeItem('postStats');
            } else {
                localStorage.setItem('postStats', JSON.stringify(filteredStats));
            }
            
            console.log('🧹 Cleared test data from localStorage');
        } catch (error) {
            console.error('Error clearing test data:', error);
            localStorage.removeItem('postStats');
        }
    }
}

// Очищаем тестовые данные при загрузке
clearTestData();

// Инициализация кастомного select для стиля поста
function initCustomSelect() {
    const selectBtn = document.getElementById('post-style-btn');
    const dropdown = document.getElementById('post-style-dropdown');
    const options = dropdown.querySelectorAll('.custom-select-option');
    const hiddenInput = document.getElementById('post-style');
    
    if (!selectBtn || !dropdown) return;
    
    // Открытие/закрытие dropdown
    selectBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        selectBtn.parentElement.classList.toggle('active');
    });
    
    // Выбор опции
    options.forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            const value = option.dataset.value;
            const iconName = option.dataset.icon;
            
            // Обновляем hidden input
            hiddenInput.value = value;
            
            // Обновляем отображение кнопки
            selectBtn.querySelector('.custom-select-text').textContent = option.querySelector('.option-text').textContent;
            selectBtn.querySelector('.custom-select-icon').innerHTML = option.querySelector('.option-icon').innerHTML;
            
            // Обновляем выделение
            options.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            
            // Закрываем dropdown
            dropdown.style.display = 'none';
            selectBtn.parentElement.classList.remove('active');
        });
    });
    
    // Закрытие при клике вне элемента
    document.addEventListener('click', (e) => {
        if (!selectBtn.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
            selectBtn.parentElement.classList.remove('active');
        }
    });
    
    // Устанавливаем начальное значение
    options[0].classList.add('selected');
}

// Инициализируем кастомный select после загрузки DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCustomSelect);
} else {
    initCustomSelect();
}

// ==================== NEUROCOMMENTING FUNCTIONS ====================

// Функции для нейрокомментирования
function showNeurocommentingAuthMessage() {
    const section = document.getElementById('neurocommenting-section');
    if (section) {
        const controls = section.querySelector('.neurocommenting-controls');
        const progress = section.querySelector('#neurocommenting-progress');
        const results = section.querySelector('#neurocommenting-results');
        
        if (results) {
            results.innerHTML = `
                <div class="token-message-content">
                    <span class="empty-icon"><span class="material-symbols-outlined">lock</span></span>
                    <h3>Требуется авторизация</h3>
                    <p>Для работы нейрокомментирования необходимо авторизоваться в Bluesky.</p>
                    <button class="btn-primary" onclick="switchSection('account')">
                        <span class="btn-icon icon"><span class="material-symbols-outlined">account_circle</span></span>
                        Перейти к авторизации
                    </button>
                </div>
            `;
        }
    }
}

function hideNeurocommentingAuthMessage() {
    const section = document.getElementById('neurocommenting-section');
    if (section) {
        const results = section.querySelector('#neurocommenting-results');
        if (results) {
            results.innerHTML = '';
        }
    }
}

// Обработчик кнопки старта нейрокомментирования
document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-neurocommenting');
    if (startBtn) {
        startBtn.addEventListener('click', handleStartNeurocommenting);
    }
});

async function handleStartNeurocommenting() {
    if (currentAccountIndex === -1 || !accounts[currentAccountIndex] || !accounts[currentAccountIndex].accessJwt) {
        alert('Необходимо войти в аккаунт');
        switchSection('account');
        return;
    }

    const currentAccount = accounts[currentAccountIndex];
    const postType = document.querySelector('input[name="post-type"]:checked')?.value;
    const minLikes = parseInt(document.getElementById('min-likes')?.value || '5');
    const maxPosts = parseInt(document.getElementById('max-posts')?.value || '5');
    const commentStyle = document.getElementById('comment-style')?.value || 'supportive';

    const progress = document.getElementById('neurocommenting-progress');
    const results = document.getElementById('neurocommenting-results');

    if (progress) {
        progress.style.display = 'block';
    }

    try {
        updateNeurocommentingProgress(0, 'Поиск популярных постов...');
        
        console.log('🚀 Starting neurocommenting with params:', { postType, minLikes, maxPosts, commentStyle });
        
        const popularPosts = await getPopularPosts(postType, minLikes, maxPosts);
        
        console.log(`📊 Found ${popularPosts.length} popular posts`);
        
        if (popularPosts.length === 0) {
            updateNeurocommentingProgress(100, 'Популярные посты не найдены');
            showNeurocommentingResults([], 'Не найдено постов, соответствующих критериям');
            return;
        }

        updateNeurocommentingProgress(25, 'Генерируем комментарии...');
        
        const resultsData = [];
        const currentAccountDid = currentAccount.did;
        
        for (let i = 0; i < popularPosts.length; i++) {
            const post = popularPosts[i];
            const progressPercent = 25 + ((i + 1) / popularPosts.length) * 50;
            updateNeurocommentingProgress(progressPercent, `Генерируем комментарий для поста ${i + 1} из ${popularPosts.length}...`);

            // Определяем, является ли пост своим
            const isOwnPost = post.author?.did === currentAccountDid;
            const comment = await generateComment(post, commentStyle, isOwnPost);
            const sent = await sendComment(post.uri, comment);
            
            resultsData.push({
                post,
                comment,
                sent
            });
        }

        updateNeurocommentingProgress(100, 'Готово!');
        
        // Сохраняем результаты в localStorage
        localStorage.setItem('neurocommentingResults', JSON.stringify({
            timestamp: new Date().toISOString(),
            params: { postType, minLikes, maxPosts, commentStyle },
            results: resultsData
        }));
        
        setTimeout(() => {
            if (progress) {
                progress.style.display = 'none';
            }
            showNeurocommentingResults(resultsData, null);
        }, 1000);

    } catch (error) {
        console.error('Error in neurocommenting:', error);
        updateNeurocommentingProgress(100, 'Ошибка');
        showNeurocommentingResults([], error.message);
    }
}

async function getPopularPosts(type, minLikes, maxPosts) {
    const currentAccount = accounts[currentAccountIndex];
    if (!currentAccount || !currentAccount.accessJwt) {
        throw new Error('No valid session');
    }

    // Используем глобальный экземпляр и устанавливаем сессию
    blueskyAPI.setSession({
        accessJwt: currentAccount.accessJwt,
        refreshJwt: currentAccount.refreshJwt,
        handle: currentAccount.handle,
        did: currentAccount.did
    });

    // Получаем handle пользователя
    const actor = currentAccount.handle || currentAccount.did;
    
    console.log(`🤖 Fetching posts for neurocommenting: ${actor}, type: ${type}`);
    
    let posts = [];
    
    if (type === 'my-posts') {
        // Получаем посты текущего пользователя
        const authorFeedResp = await blueskyAPI.getAuthorFeed(actor, 50);
        const feed = authorFeedResp.feed || [];
        
        console.log(`✅ Fetched ${feed.length} posts from my feed`);
        
        for (const feedItem of feed) {
            const post = feedItem.post;
            if (!post?.uri) continue;
            
            // Используем статистику напрямую из объекта поста
            const likeCount = post.likeCount || 0;
            const replyCount = post.replyCount || 0;
            const repostCount = post.repostCount || 0;
            const record = post.record;
            
            // Комментируем только свои посты в режиме "my-posts"
            const isMyPost = post.author?.did === currentAccount.did;
            if (isMyPost && likeCount >= minLikes) {
                posts.push({
                    uri: post.uri,
                    text: record?.text || '',
                    author: post.author,
                    likeCount: likeCount,
                    replyCount: replyCount,
                    repostCount: repostCount,
                    createdAt: record?.createdAt || ''
                });
            }
            
            if (posts.length >= maxPosts) break;
        }
    } else if (type === 'feed-posts') {
        // Для популярных постов в ленте получаем timeline
        console.log('📡 Fetching timeline for popular posts...');
        
        try {
            const timelineResp = await blueskyAPI.makeRequest('/app.bsky.feed.getTimeline', {
                limit: 100
            });
            
            console.log('📡 Timeline response:', timelineResp);
            
            const feed = timelineResp.feed || [];
            console.log(`✅ Fetched ${feed.length} posts from timeline`);
            
            for (const feedItem of feed) {
                const post = feedItem.post;
                if (!post?.uri) continue;
                
                const likeCount = post.likeCount || 0;
                const replyCount = post.replyCount || 0;
                const repostCount = post.repostCount || 0;
                const record = post.record;
                const author = post.author;
                
                // Пропускаем свои посты
                const isMyPost = author?.did === currentAccount.did;
                if (isMyPost) continue;
                
                // Фильтруем по лайкам и популярности
                if (likeCount >= minLikes) {
                    posts.push({
                        uri: post.uri,
                        text: record?.text || '',
                        author: author,
                        likeCount: likeCount,
                        replyCount: replyCount,
                        repostCount: repostCount,
                        createdAt: record?.createdAt || ''
                    });
                }
                
                if (posts.length >= maxPosts) break;
            }
        } catch (error) {
            console.error('❌ Error fetching timeline:', error);
            // Fallback: используем author feed
            const authorFeedResp = await blueskyAPI.getAuthorFeed(actor, 50);
            const feed = authorFeedResp.feed || [];
            
            for (const feedItem of feed) {
                const post = feedItem.post;
                if (!post?.uri) continue;
                
                const likeCount = post.likeCount || 0;
                const replyCount = post.replyCount || 0;
                const repostCount = post.repostCount || 0;
                const record = post.record;
                
                if (likeCount >= minLikes) {
                    posts.push({
                        uri: post.uri,
                        text: record?.text || '',
                        author: post.author,
                        likeCount: likeCount,
                        replyCount: replyCount,
                        repostCount: repostCount,
                        createdAt: record?.createdAt || ''
                    });
                }
                
                if (posts.length >= maxPosts) break;
            }
        }
    }

    // Удаляем дубликаты по URI
    const uniquePosts = [];
    const seenUris = new Set();
    
    for (const post of posts) {
        if (!seenUris.has(post.uri)) {
            seenUris.add(post.uri);
            uniquePosts.push(post);
        }
    }
    
    // Сортируем по убыванию лайков
    uniquePosts.sort((a, b) => b.likeCount - a.likeCount);
    
    console.log(`📊 Filtered ${uniquePosts.length} unique popular posts (min likes: ${minLikes})`);
    
    return uniquePosts.slice(0, maxPosts);
}

function detectPostLanguage(postText) {
    // Простое определение языка по символам и словам
    const text = postText.toLowerCase();
    
    // Проверка на русский язык
    const russianPattern = /[а-яё]/;
    if (russianPattern.test(text)) {
        return 'ru';
    }
    
    // Проверка на китайский, японский, корейский
    const cjkPattern = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/;
    if (cjkPattern.test(text)) {
        if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'ja'; // Японский
        if (/[\uac00-\ud7af]/.test(text)) return 'ko'; // Корейский
        return 'zh'; // Китайский
    }
    
    // Проверка на испанский
    if (/ñ|ú|í|ó|é|á/.test(text) || text.includes(' que ') || text.includes(' el ')) {
        return 'es';
    }
    
    // Проверка на французский
    if (/[àâäéèêëïîôùûü]/i.test(text) || text.includes(' et ') || text.includes(' le ')) {
        return 'fr';
    }
    
    // Проверка на немецкий
    if (/[äöüßÄÖÜ]/i.test(text) || text.includes(' der ') || text.includes(' und ')) {
        return 'de';
    }
    
    // Проверка на итальянский
    if (/[àèéìíîòóù]/i.test(text) || text.includes(' che ') || text.includes(' il ')) {
        return 'it';
    }
    
    // Проверка на португальский
    if (/[ãõáàâãéêíóôõúüç]/i.test(text) || text.includes(' que ') && text.includes(' de ')) {
        return 'pt';
    }
    
    // По умолчанию английский
    return 'en';
}

async function generateComment(post, style, isOwnPost = false) {
    const currentAccount = accounts[currentAccountIndex];
    
    // Автоматически определяем язык поста
    const detectedLanguage = detectPostLanguage(post.text);
    
    // Маппинг языка для LLM
    const languageMap = {
        'ru': 'Russian',
        'en': 'English',
        'es': 'Spanish',
        'fr': 'French',
        'de': 'German',
        'it': 'Italian',
        'pt': 'Portuguese',
        'ja': 'Japanese',
        'ko': 'Korean',
        'zh': 'Chinese'
    };
    
    const languageName = languageMap[detectedLanguage] || 'Russian';
    
    console.log(`🌐 Detected post language: ${detectedLanguage} (${languageName})`);
    
    let systemPrompt = '';
    let userPrompt = '';
    
    if (isOwnPost) {
        // Специальные промпты для комментариев к своим постам
        switch(style) {
            case 'supportive':
                systemPrompt = `You are commenting on YOUR OWN post on Bluesky. Add additional thoughts, expand the idea, or provide more context. Write in ${languageName}. Do NOT address yourself in second person (ты, вас). Simply continue or supplement the original thought.`;
                break;
            case 'question':
                systemPrompt = `You are commenting on YOUR OWN post on Bluesky. Add a clarifying question or expand the topic by asking something new. Write in ${languageName}. Do NOT address yourself in second person.`;
                break;
            case 'analytical':
                systemPrompt = `You are commenting on YOUR OWN post on Bluesky. Provide additional analysis, deeper insights, or expand on the original argument. Write in ${languageName}. Do NOT address yourself in second person.`;
                break;
            case 'humorous':
                systemPrompt = `You are commenting on YOUR OWN post on Bluesky. Add a humorous remark, funny detail, or light observation to your original post. Write in ${languageName}. Do NOT address yourself in second person.`;
                break;
        }
        userPrompt = `My original post: "${post.text.substring(0, 500)}"\n\nAdd a comment that supplements this post naturally, as if you're continuing your own thought. Maximum 300 characters.`;
    } else {
        // Промпты для комментариев к постам других пользователей
        switch(style) {
            case 'supportive':
                systemPrompt = `You are a supportive commenter on Bluesky social network. Write a short, genuine and friendly comment that adds value. Use ${languageName} language.`;
                break;
            case 'question':
                systemPrompt = `You are an engaged user asking thoughtful questions on Bluesky social network. Write a short question that encourages discussion. Be respectful. Use ${languageName} language.`;
                break;
            case 'analytical':
                systemPrompt = `You are an analytical commenter on Bluesky social network. Write a short analytical comment that adds perspective. Be thoughtful. Use ${languageName} language.`;
                break;
            case 'humorous':
                systemPrompt = `You are a witty commenter on Bluesky social network. Write a short humorous comment that's light and funny. Be tasteful. Use ${languageName} language.`;
                break;
        }
        userPrompt = `Post: "${post.text.substring(0, 500)}"\n\nWrite a comment in ${languageName} language. Maximum 300 characters. Make it natural and engaging.`;
    }

    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
    ];

    const response = await llmModule.sendMessage(messages, {
        maxTokens: 150,
        temperature: 0.7
    });
    
    // sendMessage возвращает объект с полем content
    return response.content || '';
}

async function sendComment(uri, text) {
    if (!text || text.trim() === '') {
        return false;
    }

    const currentAccount = accounts[currentAccountIndex];
    if (!currentAccount || !currentAccount.accessJwt) {
        throw new Error('No valid session');
    }

    try {
        // Парсим URI для получения DID и rkey
        // Формат: at://did:plc:.../app.bsky.feed.post/3m...
        const parts = uri.split('/');
        const did = parts[2]; // did:plc:...
        const rkey = parts[4]; // 3m...
        
        console.log('💬 Sending comment to:', { uri, did, rkey });

        // Получаем информацию о посте через API
        const threadResp = await blueskyAPI.makeRequest('/app.bsky.feed.getPostThread', {
            uri: uri
        });
        
        console.log('📋 Thread response:', threadResp);
        
        const threadData = threadResp.thread;
        if (!threadData || !threadData.post) {
            throw new Error('Could not fetch post information');
        }
        
        const parentPost = threadData.post;
        
        // Формируем reply структуру
        const reply = {
            root: {
                uri: parentPost.uri,
                cid: parentPost.cid
            },
            parent: {
                uri: parentPost.uri,
                cid: parentPost.cid
            }
        };

        const commentRecord = {
            $type: 'app.bsky.feed.post',
            text: text,
            createdAt: new Date().toISOString(),
            reply: reply
        };

        const url = `${BLUESKY_API_BASE}/com.atproto.repo.createRecord`;
        
        // Используем DID текущего пользователя для создания комментария
        const userDid = currentAccount.did;
        
        console.log('📤 Sending comment with data:', {
            repo: userDid,
            record: commentRecord
        });
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentAccount.accessJwt}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                repo: userDid,
                collection: 'app.bsky.feed.post',
                record: commentRecord
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('❌ API Error:', errorData);
            throw new Error(`HTTP ${response.status}: ${errorData.message || response.statusText}`);
        }

        const data = await response.json();
        console.log('✅ Comment sent successfully:', data);
        return true;
    } catch (error) {
        console.error('❌ Failed to send comment:', error);
        return false;
    }
}

function updateNeurocommentingProgress(percent, message) {
    const progressFill = document.querySelector('#neurocommenting-progress .progress-fill');
    const progressText = document.querySelector('#neurocommenting-progress .progress-text');
    
    if (progressFill) {
        progressFill.style.width = `${percent}%`;
    }
    
    if (progressText) {
        progressText.textContent = message;
    }
}

function loadSavedNeurocommentingResults() {
    const savedData = localStorage.getItem('neurocommentingResults');
    if (savedData) {
        try {
            const data = JSON.parse(savedData);
            console.log('📂 Loading saved neurocommenting results:', data);
            showNeurocommentingResults(data.results, null);
        } catch (error) {
            console.error('Error loading saved results:', error);
        }
    }
}

function showNeurocommentingResults(results, error) {
    const resultsContainer = document.getElementById('neurocommenting-results');
    if (!resultsContainer) return;
    
    // Очищаем предыдущие результаты
    resultsContainer.innerHTML = '';

    if (error) {
        resultsContainer.innerHTML = `
            <div class="token-message-content">
                <span class="empty-icon"><span class="material-symbols-outlined">error</span></span>
                <h3>Ошибка</h3>
                <p>${error}</p>
            </div>
        `;
        return;
    }

    if (results.length === 0) {
        resultsContainer.innerHTML = `
            <div class="token-message-content">
                <span class="empty-icon"><span class="material-symbols-outlined">info</span></span>
                <p>Результаты не найдены</p>
            </div>
        `;
        return;
    }

    const successful = results.filter(r => r.sent).length;
    const failed = results.filter(r => !r.sent).length;

    resultsContainer.innerHTML = `
        <div class="neurocommenting-summary">
            <h3>Результаты</h3>
            <div class="summary-stats">
                <div class="stat-item">
                    <span class="material-symbols-outlined">check_circle</span>
                    <span>Успешно: ${successful}</span>
                </div>
                <div class="stat-item">
                    <span class="material-symbols-outlined">cancel</span>
                    <span>Ошибок: ${failed}</span>
                </div>
            </div>
        </div>
        <div class="neurocommenting-posts">
            ${results.map((result, index) => `
                <div class="post-comment-item">
                    <div class="post-info">
                        <div class="post-text-preview">${result.post.text.substring(0, 150)}...</div>
                        <div class="post-stats">
                            <span class="material-symbols-outlined">favorite</span>
                            <span>${result.post.likeCount}</span>
                            <span class="material-symbols-outlined">comment</span>
                            <span>${result.post.replyCount}</span>
                        </div>
                    </div>
                    <div class="comment-info">
                        <p class="comment-text">${result.comment}</p>
                        <div class="comment-status">
                            ${result.sent ? 
                                '<span class="material-symbols-outlined" style="color: #00C875;">check_circle</span><span style="color: #00C875;">Отправлено</span>' : 
                                '<span class="material-symbols-outlined" style="color: #FF5C5C;">cancel</span><span style="color: #FF5C5C;">Ошибка</span>'
                            }
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

