/**
 * Контроллер для страницы преподавателя (teacher.html)
 * Управляет сессиями предметов, генерацией QR-кодов, выводом истории по дням,
 * фильтрацией по группам и сортировкой.
 * Изменен для поддержки асинхронных облачных запросов (Supabase).
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- ПЕРЕМЕННЫЕ СОСТОЯНИЯ ---
    let currentUser = null;
    let selectedSubjectId = null;
    let selectedSessionId = null;
    
    let sortField = 'lastName';
    let sortOrder = 'asc'; 
    
    let qrGenerator = null;
    let fullscreenQrGenerator = null;
    let pollingInterval = null; 
    let qrRotationInterval = null; 

    // --- DOM СЕЛЕКТОРЫ ---
    const header = document.getElementById('main-header');
    const authSection = document.getElementById('auth-section');
    const dashboardSection = document.getElementById('dashboard-section');

    const headerTeacherName = document.getElementById('header-teacher-name');
    const logoutBtn = document.getElementById('logout-btn');

    const tabLoginBtn = document.getElementById('tab-login-btn');
    const tabRegisterBtn = document.getElementById('tab-register-btn');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    const activeSessionWorkspace = document.getElementById('active-session-workspace');
    const noSubjectSelectedWorkspace = document.getElementById('no-subject-selected-workspace');
    const teacherWelcomeTitle = document.getElementById('teacher-welcome-title');

    const addSubjectTriggerBtn = document.getElementById('add-subject-trigger-btn');
    const subjectsContainerList = document.getElementById('subjects-container-list');
    const subjectsEmptyState = document.getElementById('subjects-empty-state');

    const addSubjectModal = document.getElementById('add-subject-modal');
    const addSubjectForm = document.getElementById('add-subject-form');
    const addSubjectCancelBtn = document.getElementById('add-subject-cancel-btn');

    const qrDisplayContainer = document.getElementById('qr-display-container');
    const classQrCanvas = document.getElementById('class-qr-canvas');
    const activeLessonSubjectName = document.getElementById('active-lesson-subject-name');
    const activeLessonDay = document.getElementById('active-lesson-day');
    const activeLessonDate = document.getElementById('active-lesson-date');
    const activeLessonTime = document.getElementById('active-lesson-time');
    const fullscreenQrBtn = document.getElementById('fullscreen-qr-btn');
    const deactivateQrBtn = document.getElementById('deactivate-qr-btn');

    const fullscreenQrModal = document.getElementById('fullscreen-qr-modal');
    const fullscreenQrCanvas = document.getElementById('fullscreen-qr-canvas');
    const fullscreenQrCloseBtn = document.getElementById('fullscreen-qr-close-btn');
    const fullscreenSubjectTitle = document.getElementById('fullscreen-subject-title');
    const fullscreenSessionDetails = document.getElementById('fullscreen-session-details');

    const startNewSessionBtn = document.getElementById('start-new-session-btn');
    const groupFilterDropdown = document.getElementById('group-filter-dropdown');
    const teacherAttendanceTbody = document.getElementById('teacher-attendance-tbody');
    const rosterEmptyState = document.getElementById('roster-empty-state');
    const tableRosterTitle = document.getElementById('table-roster-title');
    const tableRosterSubtitle = document.getElementById('table-roster-subtitle');

    const kpiSubjectsCount = document.getElementById('kpi-subjects-count');
    const kpiSessionsCount = document.getElementById('kpi-sessions-count');
    const kpiPresentCount = document.getElementById('kpi-present-count');

    const sortHeaders = {
        lastName: document.getElementById('sort-lastname'),
        firstName: document.getElementById('sort-firstname'),
        patronymic: document.getElementById('sort-patronymic'),
        group: document.getElementById('sort-group'),
        timestamp: document.getElementById('sort-time')
    };

    // --- ИНИЦИАЛИЗАЦИЯ И СЕССИЯ ---
    checkSession();

    function checkSession() {
        currentUser = Database.getCurrentUser();
        if (currentUser && currentUser.role === 'teacher') {
            loadDashboard();
        } else {
            showAuth();
        }
    }

    function showAuth() {
        header.style.display = 'none';
        dashboardSection.style.display = 'none';
        authSection.style.display = 'flex';
        stopPolling();
        stopQrRotation();
    }

    async function loadDashboard() {
        authSection.style.display = 'none';
        header.style.display = 'flex';
        dashboardSection.style.display = 'grid';

        headerTeacherName.textContent = `${currentUser.lastName} ${currentUser.firstName[0]}. ${currentUser.patronymic[0]}.`;
        teacherWelcomeTitle.textContent = `С возвращением, ${currentUser.firstName} ${currentUser.patronymic}!`;

        await renderSubjects();
        await updateKpis();
    }

    // Обновление KPI (асинхронно)
    async function updateKpis() {
        try {
            const subjects = await Database.getSubjects(currentUser.id);
            kpiSubjectsCount.textContent = subjects.length;

            let totalSessions = 0;
            for (const sub of subjects) {
                const sessions = await Database.getSessions(sub.id);
                totalSessions += sessions.length;
            }
            kpiSessionsCount.textContent = totalSessions;

            if (selectedSessionId) {
                const currentRoster = await Database.getSessionAttendance(selectedSessionId);
                kpiPresentCount.textContent = currentRoster.length;
            } else {
                kpiPresentCount.textContent = 0;
            }
        } catch (err) {
            console.error('Ошибка KPI:', err);
        }
    }

    // --- РЕНДЕРИНГ САЙДБАРА ---

    async function renderSubjects() {
        try {
            const subjects = await Database.getSubjects(currentUser.id);
            subjectsContainerList.innerHTML = '';

            if (subjects.length === 0) {
                subjectsEmptyState.style.display = 'block';
                return;
            }

            subjectsEmptyState.style.display = 'none';

            for (const sub of subjects) {
                const subjectDiv = document.createElement('div');
                subjectDiv.className = 'subject-item';
                subjectDiv.id = `sub-item-${sub.id}`;
                if (sub.id === selectedSubjectId) {
                    subjectDiv.classList.add('active');
                }

                const sessions = await Database.getSessions(sub.id);
                let sessionsHTML = '';
                
                sessions.forEach(ses => {
                    const isActiveClass = ses.id === selectedSessionId ? 'active' : '';
                    const greenActiveDot = ses.isActive ? '<span style="display:inline-block; width:8px; height:8px; background:var(--clr-success); border-radius:50%; margin-left:6px; box-shadow:0 0 8px var(--clr-success);"></span>' : '';
                    
                    sessionsHTML += `
                        <div class="session-link ${isActiveClass}" data-session-id="${ses.id}">
                            <span class="day">${ses.dayOfWeek} ${greenActiveDot}</span>
                            <span class="date">${ses.date} в ${ses.time}</span>
                        </div>
                    `;
                });

                subjectDiv.innerHTML = `
                    <button class="subject-header-btn" data-subject-id="${sub.id}">
                        <span>📚 ${sub.name}</span>
                        <span class="arrow">▼</span>
                    </button>
                    <div class="session-list">
                        ${sessionsHTML || '<div style="color:var(--text-muted); font-size:0.75rem; padding:8px 12px;">Занятий еще не проводилось</div>'}
                    </div>
                `;

                subjectDiv.querySelector('.subject-header-btn').addEventListener('click', async (e) => {
                    const targetSubId = sub.id;
                    
                    const allItems = subjectsContainerList.querySelectorAll('.subject-item');
                    allItems.forEach(item => {
                        if (item.id !== `sub-item-${targetSubId}`) {
                            item.classList.remove('active');
                        }
                    });

                    subjectDiv.classList.toggle('active');
                    
                    if (subjectDiv.classList.contains('active')) {
                        await selectSubject(targetSubId);
                    } else {
                        deselectSubject();
                    }
                });

                subjectDiv.querySelectorAll('.session-link').forEach(link => {
                    link.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        const sesId = link.getAttribute('data-session-id');
                        
                        subjectsContainerList.querySelectorAll('.session-link').forEach(l => l.classList.remove('active'));
                        link.classList.add('active');

                        await selectSession(sesId);
                    });
                });

                subjectsContainerList.appendChild(subjectDiv);
            }
        } catch (err) {
            console.error('Ошибка рендеринга предметов:', err);
        }
    }

    // Выбор предмета
    async function selectSubject(subjectId) {
        selectedSubjectId = subjectId;
        noSubjectSelectedWorkspace.style.display = 'none';
        activeSessionWorkspace.style.display = 'block';

        const sessions = await Database.getSessions(subjectId);
        if (sessions.length > 0) {
            await selectSession(sessions[0].id);
        } else {
            selectedSessionId = null;
            qrDisplayContainer.style.display = 'none';
            tableRosterTitle.textContent = 'Список посещаемости';
            tableRosterSubtitle.textContent = 'Занятий пока не проводилось. Нажмите "Начать занятие"';
            startNewSessionBtn.style.display = 'block';
            groupFilterDropdown.style.display = 'none';
            teacherAttendanceTbody.innerHTML = '';
            rosterEmptyState.style.display = 'block';
            stopPolling();
            stopQrRotation();
            await updateKpis();
        }
    }

    function deselectSubject() {
        selectedSubjectId = null;
        selectedSessionId = null;
        noSubjectSelectedWorkspace.style.display = 'block';
        activeSessionWorkspace.style.display = 'none';
        stopPolling();
        stopQrRotation();
    }

    // Выбор конкретной сессии по дате
    async function selectSession(sessionId) {
        selectedSessionId = sessionId;
        const session = await Database.getSessionById(sessionId);
        if (!session) return;

        const dbSubjects = await Database.getSubjects(currentUser.id);
        // В облачном режиме получим предмет по сессии
        // Для простоты подтянем имя предмета из сайдбара или из сессии
        let subjectName = 'Посещаемость';
        const targetSub = dbSubjects.find(s => s.id === session.subjectId);
        if (targetSub) subjectName = targetSub.name;
        
        tableRosterTitle.textContent = subjectName;
        tableRosterSubtitle.textContent = `Лекция: ${session.dayOfWeek}, ${session.date} (${session.time})`;

        await refreshRoster();
        await updateKpis();

        if (session.isActive) {
            qrDisplayContainer.style.display = 'grid';
            activeLessonSubjectName.textContent = subjectName;
            activeLessonDay.textContent = session.dayOfWeek;
            activeLessonDate.textContent = session.date;
            activeLessonTime.textContent = session.time;

            generateQR(session.activeToken || session.id);
            
            startPolling();
            startQrRotation();

            startNewSessionBtn.style.display = 'none';
        } else {
            qrDisplayContainer.style.display = 'none';
            startNewSessionBtn.style.display = 'block';
            stopPolling();
            stopQrRotation();
        }
    }

    function generateQR(tokenValue) {
        qrGenerator = new QRious({
            element: classQrCanvas,
            value: tokenValue,
            size: 200,
            background: '#ffffff',
            foreground: '#0b0f19',
            level: 'H'
        });

        fullscreenQrGenerator = new QRious({
            element: fullscreenQrCanvas,
            value: tokenValue,
            size: 400,
            background: '#ffffff',
            foreground: '#0b0f19',
            level: 'H'
        });
    }

    // --- ЛОГИКА ТАБЛИЦЫ ---

    async function refreshRoster() {
        if (!selectedSessionId) return;

        try {
            let roster = await Database.getSessionAttendance(selectedSessionId);

            updateGroupFilterDropdown(roster);

            const selectedGroup = groupFilterDropdown.value;
            if (selectedGroup && selectedGroup !== 'all') {
                roster = roster.filter(s => s.group === selectedGroup);
            }

            sortRosterData(roster);
            renderRosterRows(roster);
        } catch (err) {
            console.error('Ошибка обновления списка:', err);
        }
    }

    function updateGroupFilterDropdown(roster) {
        const groups = [...new Set(roster.map(s => s.group))].sort();
        const currentValue = groupFilterDropdown.value;

        groupFilterDropdown.innerHTML = '<option value="all">Все группы</option>';
        groups.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g;
            opt.textContent = g;
            groupFilterDropdown.appendChild(opt);
        });

        if (groups.includes(currentValue)) {
            groupFilterDropdown.value = currentValue;
        } else {
            groupFilterDropdown.value = 'all';
        }

        groupFilterDropdown.style.display = roster.length > 0 ? 'block' : 'none';
    }

    function sortRosterData(roster) {
        roster.sort((a, b) => {
            let valA = a[sortField] ? a[sortField].toString().toLowerCase() : '';
            let valB = b[sortField] ? b[sortField].toString().toLowerCase() : '';

            if (sortField === 'timestamp') {
                valA = a.timestamp;
                valB = b.timestamp;
            }

            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
    }

    function renderRosterRows(roster) {
        teacherAttendanceTbody.innerHTML = '';

        if (roster.length === 0) {
            rosterEmptyState.style.display = 'block';
            return;
        }

        rosterEmptyState.style.display = 'none';

        roster.forEach(rec => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight:600; color:#fff;">${rec.lastName}</td>
                <td>${rec.firstName}</td>
                <td>${rec.patronymic}</td>
                <td><span class="student-group-tag" style="margin-bottom:0;">${rec.group}</span></td>
                <td style="color:#0ea5e9; font-weight:500;">${rec.timestamp}</td>
                <td><span class="status-badge present">✓ Отмечен</span></td>
            `;
            teacherAttendanceTbody.appendChild(tr);
        });
    }

    Object.keys(sortHeaders).forEach(field => {
        sortHeaders[field].addEventListener('click', async () => {
            if (sortField === field) {
                sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
            } else {
                sortField = field;
                sortOrder = 'asc';
            }
            
            Object.values(sortHeaders).forEach(h => h.style.color = 'var(--text-secondary)');
            sortHeaders[field].style.color = '#fff';

            await refreshRoster();
        });
    });

    groupFilterDropdown.addEventListener('change', refreshRoster);

    // --- POLLING ---
    function startPolling() {
        stopPolling();
        pollingInterval = setInterval(async () => {
            await refreshRoster();
            await updateKpis();
        }, 2000);
    }

    function stopPolling() {
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
        }
    }

    // --- QR ROTATION ---
    function startQrRotation() {
        stopQrRotation();
        if (!selectedSessionId) return;

        qrRotationInterval = setInterval(async () => {
            const session = await Database.getSessionById(selectedSessionId);
            if (session && session.isActive) {
                const newToken = await Database.updateSessionToken(selectedSessionId);
                if (newToken) {
                    if (qrGenerator) {
                        qrGenerator.value = newToken;
                    }
                    if (fullscreenQrGenerator) {
                        fullscreenQrGenerator.value = newToken;
                    }
                    console.log("Сгенерирован новый QR-токен:", newToken);
                }
            }
        }, 3000);
    }

    function stopQrRotation() {
        if (qrRotationInterval) {
            clearInterval(qrRotationInterval);
            qrRotationInterval = null;
        }
    }

    // --- КНОПКИ ДЕЙСТВИЙ ---

    startNewSessionBtn.addEventListener('click', async () => {
        if (!selectedSubjectId) return;

        try {
            const newSession = await Database.startSession(selectedSubjectId);
            Toast.show('Урок запущен!', 'Сгенерирован новый QR-код посещаемости', 'success');
            
            await renderSubjects();
            await selectSession(newSession.id);
        } catch (error) {
            Toast.show('Ошибка', error.message, 'error');
        }
    });

    deactivateQrBtn.addEventListener('click', async () => {
        if (!selectedSessionId) return;

        try {
            // В облачном режиме деактивируем сессию в базе
            if (isSupabaseMode) {
                await supabaseClient
                    .from('sessions')
                    .update({ is_active: false })
                    .eq('id', selectedSessionId);
            } else {
                const sessions = Database._get('sessions');
                const session = sessions.find(s => s.id === selectedSessionId);
                if (session) {
                    session.isActive = false;
                    Database._set('sessions', sessions);
                }
            }
            
            Toast.show('Занятие завершено', 'QR-код теперь недействителен для студентов', 'info');
            
            await renderSubjects();
            await selectSession(selectedSessionId);
        } catch (error) {
            Toast.show('Ошибка', error.message, 'error');
        }
    });

    fullscreenQrBtn.addEventListener('click', async () => {
        if (!selectedSessionId) return;

        const session = await Database.getSessionById(selectedSessionId);
        
        let subjectName = '';
        const dbSubjects = await Database.getSubjects(currentUser.id);
        const sub = dbSubjects.find(s => s.id === session.subjectId);
        if (sub) subjectName = sub.name;

        fullscreenSubjectTitle.textContent = subjectName;
        fullscreenSessionDetails.textContent = `${session.dayOfWeek}, ${session.date} (${session.time})`;

        fullscreenQrModal.classList.add('active');
    });

    fullscreenQrCloseBtn.addEventListener('click', () => {
        fullscreenQrModal.classList.remove('active');
    });

    // --- МОДАЛКА ПРЕДМЕТА ---

    addSubjectTriggerBtn.addEventListener('click', () => {
        addSubjectModal.classList.add('active');
        document.getElementById('new-subject-name').focus();
    });

    addSubjectCancelBtn.addEventListener('click', () => {
        addSubjectModal.classList.remove('active');
        addSubjectForm.reset();
    });

    addSubjectForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('new-subject-name').value;

        try {
            const newSubject = await Database.addSubject(name, currentUser.id);
            Toast.show('Предмет создан', `Предмет "${name}" успешно добавлен в ваш список`, 'success');
            
            addSubjectModal.classList.remove('active');
            addSubjectForm.reset();

            await renderSubjects();
            await selectSubject(newSubject.id);
        } catch (error) {
            Toast.show('Ошибка создания', error.message, 'error');
        }
    });

    // --- ВХОД И РЕГИСТРАЦИЯ ---

    tabLoginBtn.addEventListener('click', () => {
        tabLoginBtn.classList.add('active');
        tabRegisterBtn.classList.remove('active');
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
    });

    tabRegisterBtn.addEventListener('click', () => {
        tabRegisterBtn.classList.add('active');
        tabLoginBtn.classList.remove('active');
        registerForm.style.display = 'block';
        loginForm.style.display = 'none';
    });

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const lastName = document.getElementById('reg-lastname').value;
        const firstName = document.getElementById('reg-firstname').value;
        const patronymic = document.getElementById('reg-patronymic').value;
        const username = document.getElementById('reg-username').value;
        const password = document.getElementById('reg-password').value;

        try {
            await Database.registerUser('teacher', lastName, firstName, patronymic, '', username, password);
            Toast.show('Успешно!', 'Преподаватель зарегистрирован. Теперь войдите', 'success');
            
            registerForm.reset();
            tabLoginBtn.click();
        } catch (error) {
            Toast.show('Ошибка регистрации', error.message, 'error');
        }
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;

        try {
            currentUser = await Database.loginUser('teacher', username, password);
            Toast.show('Добро пожаловать!', `Успешный вход в кабинет преподавателя`, 'success');
            
            loginForm.reset();
            await loadDashboard();
        } catch (error) {
            Toast.show('Ошибка входа', error.message, 'error');
        }
    });

    logoutBtn.addEventListener('click', () => {
        Database.logout();
        currentUser = null;
        selectedSubjectId = null;
        selectedSessionId = null;
        Toast.show('Вышли из системы', 'Будем рады видеть вас снова!', 'info');
        showAuth();
    });
});
