/**
 * Контроллер для страницы студента (student.html)
 * Управляет авторизацией, статистикой и запуском веб-камеры для QR сканирования.
 * Изменен для поддержки асинхронной базы данных (Supabase/localStorage Promises).
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- ПЕРЕМЕННЫЕ СОСТОЯНИЯ ---
    let currentUser = null;
    let qrScanner = null; // Инстанс Html5Qrcode

    // --- DOM СЕЛЕКТОРЫ ---
    const header = document.getElementById('main-header');
    const authSection = document.getElementById('auth-section');
    const dashboardSection = document.getElementById('dashboard-section');

    const headerUserName = document.getElementById('header-user-name');
    const headerUserGroup = document.getElementById('header-user-group');
    const logoutBtn = document.getElementById('logout-btn');

    const tabLoginBtn = document.getElementById('tab-login-btn');
    const tabRegisterBtn = document.getElementById('tab-register-btn');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    const scanQrTriggerBtn = document.getElementById('scan-qr-trigger-btn');
    const scannerModal = document.getElementById('scanner-modal');
    const scannerCloseBtn = document.getElementById('scanner-close-btn');
    
    const successModal = document.getElementById('success-modal');
    const successModalDetails = document.getElementById('success-modal-class-details');
    const successModalCloseBtn = document.getElementById('success-modal-close-btn');

    const studentAvatarLetter = document.getElementById('student-avatar-letter');
    const studentFullName = document.getElementById('student-full-name');
    const studentGroupName = document.getElementById('student-group-name');
    const statAttended = document.getElementById('stat-attended');
    const statMissed = document.getElementById('stat-missed');

    const attendanceTbody = document.getElementById('student-attendance-tbody');
    const attendanceEmptyState = document.getElementById('attendance-empty-state');

    // --- ИНИЦИАЛИЗАЦИЯ И СЕССИЯ ---
    checkSession();

    function checkSession() {
        currentUser = Database.getCurrentUser();
        if (currentUser && currentUser.role === 'student') {
            loadDashboard();
        } else {
            showAuth();
        }
    }

    function showAuth() {
        header.style.display = 'none';
        dashboardSection.style.display = 'none';
        authSection.style.display = 'flex';
    }

    function loadDashboard() {
        authSection.style.display = 'none';
        header.style.display = 'flex';
        dashboardSection.style.display = 'grid';

        // Заполняем данные шапки
        headerUserName.textContent = `${currentUser.lastName} ${currentUser.firstName[0]}.`;
        headerUserGroup.textContent = `Группа: ${currentUser.group}`;

        // Заполняем профиль
        studentAvatarLetter.textContent = currentUser.lastName[0].toUpperCase();
        studentFullName.textContent = `${currentUser.lastName} ${currentUser.firstName} ${currentUser.patronymic}`;
        studentGroupName.textContent = `ГРУППА ${currentUser.group.toUpperCase()}`;

        // Обновляем статистику и историю (асинхронно)
        refreshDashboardData();
    }

    async function refreshDashboardData() {
        try {
            // Получаем статистику асинхронно
            const stats = await Database.getStudentStats(currentUser.id);
            statAttended.textContent = stats.attended;
            statMissed.textContent = stats.missed;

            // Рисуем круговую диаграмму посещаемости
            Charts.renderProgressRing('attendance-chart-container', stats.rate);

            // Рендерим историю посещений асинхронно
            const records = await Database.getStudentAttendance(currentUser.id);
            attendanceTbody.innerHTML = '';

            if (records.length === 0) {
                attendanceEmptyState.style.display = 'block';
            } else {
                attendanceEmptyState.style.display = 'none';
                records.forEach(rec => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td style="font-weight: 600;">${rec.subjectName}</td>
                        <td>${rec.dayOfWeek}</td>
                        <td>${rec.date}</td>
                        <td>${rec.time}</td>
                        <td style="color: #38bdf8;">${rec.timestamp}</td>
                        <td><span class="status-badge present">Присутствовал</span></td>
                    `;
                    attendanceTbody.appendChild(tr);
                });
            }
        } catch (err) {
            console.error('Ошибка обновления дашборда:', err);
        }
    }

    // --- ОБРАБОТКА ВХОДА И РЕГИСТРАЦИИ ---

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

    // Отправка формы регистрации (асинхронная)
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const lastName = document.getElementById('reg-lastname').value;
        const firstName = document.getElementById('reg-firstname').value;
        const patronymic = document.getElementById('reg-patronymic').value;
        const group = document.getElementById('reg-group').value;
        const username = document.getElementById('reg-username').value;
        const password = document.getElementById('reg-password').value;

        try {
            await Database.registerUser('student', lastName, firstName, patronymic, group, username, password);
            Toast.show('Успешно!', 'Регистрация прошла успешно. Войдите в аккаунт', 'success');
            
            registerForm.reset();
            tabLoginBtn.click();
        } catch (error) {
            Toast.show('Ошибка!', error.message, 'error');
        }
    });

    // Отправка формы входа (асинхронная)
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;

        try {
            currentUser = await Database.loginUser('student', username, password);
            Toast.show('С возвращением!', `Приветствуем, ${currentUser.firstName}!`, 'success');
            
            loginForm.reset();
            loadDashboard();
        } catch (error) {
            Toast.show('Ошибка входа', error.message, 'error');
        }
    });

    // Кнопка Выхода
    logoutBtn.addEventListener('click', () => {
        Database.logout();
        currentUser = null;
        Toast.show('Вышли из системы', 'Будем ждать вас снова!', 'info');
        showAuth();
    });

    // --- ЛОГИКА КАМЕРЫ И QR СКАНИРОВАНИЯ ---

    // Запуск сканера
    scanQrTriggerBtn.addEventListener('click', () => {
        scannerModal.classList.add('active');
        
        qrScanner = new Html5Qrcode("camera-reader-element");
        
        const config = { 
            fps: 15, 
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
        };

        qrScanner.start(
            { facingMode: "environment" }, 
            config, 
            onScanSuccess, 
            onScanError
        ).catch(err => {
            console.error("Ошибка камеры: ", err);
            Toast.show('Камера недоступна', 'Проверьте разрешения на доступ к веб-камере', 'error');
            closeScanner();
        });
    });

    scannerCloseBtn.addEventListener('click', closeScanner);

    function closeScanner() {
        scannerModal.classList.remove('active');
        if (qrScanner) {
            qrScanner.stop().then(() => {
                qrScanner = null;
            }).catch(err => {
                console.warn("Не удалось остановить камеру корректно: ", err);
            });
        }
    }

    function onScanSuccess(decodedText, decodedResult) {
        console.log(`Сканирован код: ${decodedText}`);
        
        if (qrScanner) {
            qrScanner.stop().then(() => {
                qrScanner = null;
                processCheckIn(decodedText);
            }).catch(err => {
                console.error("Ошибка остановки камеры: ", err);
                processCheckIn(decodedText);
            });
        } else {
            processCheckIn(decodedText);
        }
    }

    // Обработка отметки присутствия (асинхронная)
    async function processCheckIn(sessionId) {
        scannerModal.classList.remove('active');
        
        try {
            // Отмечаем студента по ID сессии асинхронно
            const result = await Database.checkInStudent(currentUser.id, sessionId);
            
            // Получаем информацию о занятии для модального окна асинхронно
            const session = await Database.getSessionById(sessionId.split('_tok_')[0]);
            
            let subjectName = 'Неизвестный предмет';
            if (session) {
                const sub = await Database.getSubjectById(session.subjectId);
                if (sub) subjectName = sub.name;
            }
            
            if (result.success) {
                successModalDetails.innerHTML = `
                    <strong>Предмет:</strong> ${subjectName}<br>
                    <strong>Дата:</strong> ${session ? session.date : 'Нет даты'} (${session ? session.dayOfWeek : ''})<br>
                    <strong>Время отметки:</strong> ${session ? session.time : 'Нет времени'}
                `;
                successModal.classList.add('active');
                
                await refreshDashboardData();
                Toast.show('Успешно отмечено!', 'Посещение лекции подтверждено', 'success');
            }
        } catch (error) {
            Toast.show('Ошибка сканирования', error.message, 'error');
        }
    }

    function onScanError(errorMessage) {}

    successModalCloseBtn.addEventListener('click', () => {
        successModal.classList.remove('active');
    });
});
