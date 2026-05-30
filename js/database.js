/**
 * Модуль базы данных (Database Engine) - ДВУХРЕЖИМНЫЙ (Local Storage & Supabase Cloud)
 * 
 * ПОДДЕРЖИВАЕТ ДВА РЕЖИМА:
 * 1. Локальный режим (localStorage) - если ключи Supabase не заполнены. Работает оффлайн.
 * 2. Облачный режим (Supabase) - если указаны SUPABASE_URL и SUPABASE_KEY. Синхронизирует телефон и ПК!
 */

// ====================================================================
// УКАЖИТЕ ЗДЕСЬ ВАШИ КЛЮЧИ ИЗ КАБИНЕТА SUPABASE ДЛЯ СИНХРОНИЗАЦИИ С ТЕЛЕФОНОМ:
// ====================================================================
const SUPABASE_URL = 'https://bxgtxtbwiiltabolfcph.supabase.co';
const SUPABASE_KEY = 'sb_publishable_RQatZXJ0ZXwC3fV9tu9XMg_HN56FOzP';

let supabase = null;
let isSupabaseMode = false;

// Инициализация Supabase
if (SUPABASE_URL !== 'YOUR_SUPABASE_URL' && SUPABASE_KEY !== 'YOUR_SUPABASE_ANON_KEY' && SUPABASE_URL && SUPABASE_KEY) {
    try {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        isSupabaseMode = true;
        console.log('☁️ Подключена облачная база данных Supabase!');
    } catch (e) {
        console.error('Не удалось подключить Supabase. Используется локальный localStorage.', e);
    }
} else {
    console.log('📦 Ключи Supabase не заполнены. Используется локальный localStorage.');
}

const Database = {
    // Вспомогательные локальные методы
    _get(key, defaultValue = []) {
        const data = localStorage.getItem(`qr_attend_${key}`);
        return data ? JSON.parse(data) : defaultValue;
    },

    _set(key, data) {
        localStorage.setItem(`qr_attend_${key}`, JSON.stringify(data));
    },

    // --- УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ (АВТОРИЗАЦИЯ) ---

    /**
     * Регистрация нового пользователя
     */
    async registerUser(role, lastName, firstName, patronymic, group, username, password) {
        if (isSupabaseMode) {
            // Проверка логина
            const { data: existingUser } = await supabase
                .from('users')
                .select('username')
                .eq('username', username.trim().toLowerCase())
                .maybeSingle();

            if (existingUser) {
                throw new Error('Пользователь с таким логином уже существует');
            }

            const newUser = {
                id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                role,
                last_name: lastName.trim(),
                first_name: firstName.trim(),
                patronymic: patronymic.trim(),
                student_group: role === 'student' ? group.trim() : '',
                username: username.trim().toLowerCase(),
                password: password
            };

            const { error } = await supabase
                .from('users')
                .insert([newUser]);

            if (error) throw new Error('Ошибка базы данных: ' + error.message);
            
            return newUser;
        } else {
            // Локальный режим
            const users = this._get('users');
            const exists = users.some(u => u.username.toLowerCase() === username.toLowerCase());
            if (exists) {
                throw new Error('Пользователь с таким логином уже существует');
            }

            const newUser = {
                id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                role,
                lastName: lastName.trim(),
                firstName: firstName.trim(),
                patronymic: patronymic.trim(),
                group: role === 'student' ? group.trim() : '',
                username: username.trim().toLowerCase(),
                password: password
            };

            users.push(newUser);
            this._set('users', users);
            return newUser;
        }
    },

    /**
     * Вход пользователя в систему
     */
    async loginUser(role, username, password) {
        if (isSupabaseMode) {
            const { data: user, error } = await supabase
                .from('users')
                .select('*')
                .eq('username', username.trim().toLowerCase())
                .maybeSingle();

            if (error || !user) {
                throw new Error('Неверный логин или пароль');
            }

            if (user.password !== password) {
                throw new Error('Неверный логин или пароль');
            }

            if (user.role !== role) {
                throw new Error(role === 'teacher' 
                    ? 'Этот аккаунт не преподаватель' 
                    : 'Этот аккаунт не студент'
                );
            }

            const sessionUser = {
                id: user.id,
                role: user.role,
                lastName: user.last_name,
                firstName: user.first_name,
                patronymic: user.patronymic,
                group: user.student_group,
                username: user.username
            };
            
            sessionStorage.setItem('qr_attend_current_session', JSON.stringify(sessionUser));
            return sessionUser;
        } else {
            // Локальный режим
            const users = this._get('users');
            const user = users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());

            if (!user || user.password !== password) {
                throw new Error('Неверный логин или пароль');
            }

            if (user.role !== role) {
                throw new Error(role === 'teacher' 
                    ? 'Этот аккаунт не преподаватель' 
                    : 'Этот аккаунт не студент'
                );
            }

            const sessionUser = {
                id: user.id,
                role: user.role,
                lastName: user.lastName,
                firstName: user.firstName,
                patronymic: user.patronymic,
                group: user.group,
                username: user.username
            };
            
            sessionStorage.setItem('qr_attend_current_session', JSON.stringify(sessionUser));
            return sessionUser;
        }
    },

    getCurrentUser() {
        const session = sessionStorage.getItem('qr_attend_current_session');
        return session ? JSON.parse(session) : null;
    },

    logout() {
        sessionStorage.removeItem('qr_attend_current_session');
    },

    // --- УПРАВЛЕНИЕ ПРЕДМЕТАМИ ---

    async getSubjects(teacherId) {
        if (isSupabaseMode) {
            const { data: subjects } = await supabase
                .from('subjects')
                .select('*')
                .eq('teacher_id', teacherId);
            
            return (subjects || []).map(s => ({
                id: s.id,
                name: s.name,
                teacherId: s.teacher_id
            }));
        } else {
            const subjects = this._get('subjects');
            return subjects.filter(s => s.teacherId === teacherId);
        }
    },

    async addSubject(name, teacherId) {
        if (isSupabaseMode) {
            // Проверка названия
            const { data: existing } = await supabase
                .from('subjects')
                .select('id')
                .eq('name', name.trim())
                .eq('teacher_id', teacherId)
                .maybeSingle();

            if (existing) {
                throw new Error('Предмет с таким названием уже существует');
            }

            const newSubject = {
                id: 'sub_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                name: name.trim(),
                teacher_id: teacherId
            };

            const { error } = await supabase
                .from('subjects')
                .insert([newSubject]);

            if (error) throw new Error(error.message);

            return {
                id: newSubject.id,
                name: newSubject.name,
                teacherId: newSubject.teacher_id
            };
        } else {
            const subjects = this._get('subjects');
            const exists = subjects.some(s => s.name.toLowerCase() === name.trim().toLowerCase() && s.teacherId === teacherId);
            if (exists) {
                throw new Error('Предмет с таким названием уже существует');
            }

            const newSubject = {
                id: 'sub_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                name: name.trim(),
                teacherId
            };

            subjects.push(newSubject);
            this._set('subjects', subjects);
            return newSubject;
        }
    },

    // --- УПРАВЛЕНИЕ СЕССИЯМИ ---

    async startSession(subjectId) {
        // Дни недели на русском
        const daysOfWeek = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
        const now = new Date();
        const dayName = daysOfWeek[now.getDay()];
        const dateStr = now.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const timeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

        const sessionId = 'ses_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const initialToken = sessionId + '_tok_' + Math.random().toString(36).substr(2, 5);

        if (isSupabaseMode) {
            // Деактивируем прошлые сессии
            await supabase
                .from('sessions')
                .update({ is_active: false })
                .eq('subject_id', subjectId);

            const newSession = {
                id: sessionId,
                subject_id: subjectId,
                date: dateStr,
                time: timeStr,
                day_of_week: dayName,
                is_active: true,
                active_token: initialToken
            };

            const { error } = await supabase
                .from('sessions')
                .insert([newSession]);

            if (error) throw new Error(error.message);

            return {
                id: newSession.id,
                subjectId: newSession.subject_id,
                date: newSession.date,
                time: newSession.time,
                dayOfWeek: newSession.day_of_week,
                isActive: newSession.is_active,
                activeToken: newSession.active_token
            };
        } else {
            const sessions = this._get('sessions');
            sessions.forEach(s => {
                if (s.subjectId === subjectId) s.isActive = false;
            });

            const newSession = {
                id: sessionId,
                subjectId,
                date: dateStr,
                time: timeStr,
                dayOfWeek: dayName,
                isActive: true,
                activeToken: initialToken
            };

            sessions.push(newSession);
            this._set('sessions', sessions);
            return newSession;
        }
    },

    async updateSessionToken(sessionId) {
        const newToken = sessionId + '_tok_' + Math.random().toString(36).substr(2, 5);

        if (isSupabaseMode) {
            const { error } = await supabase
                .from('sessions')
                .update({ active_token: newToken })
                .eq('id', sessionId);

            if (error) return null;
            return newToken;
        } else {
            const sessions = this._get('sessions');
            const session = sessions.find(s => s.id === sessionId);
            if (!session || !session.isActive) return null;

            session.activeToken = newToken;
            this._set('sessions', sessions);
            return newToken;
        }
    },

    async getSessions(subjectId) {
        if (isSupabaseMode) {
            const { data: sessions } = await supabase
                .from('sessions')
                .select('*')
                .eq('subject_id', subjectId)
                .order('created_at', { ascending: false });

            return (sessions || []).map(s => ({
                id: s.id,
                subjectId: s.subject_id,
                date: s.date,
                time: s.time,
                dayOfWeek: s.day_of_week,
                isActive: s.is_active,
                activeToken: s.active_token
            }));
        } else {
            const sessions = this._get('sessions');
            return sessions
                .filter(s => s.subjectId === subjectId)
                .sort((a, b) => b.id.localeCompare(a.id));
        }
    },

    async getSessionById(sessionId) {
        if (isSupabaseMode) {
            const { data: session } = await supabase
                .from('sessions')
                .select('*')
                .eq('id', sessionId)
                .maybeSingle();

            if (!session) return null;
            return {
                id: session.id,
                subjectId: session.subject_id,
                date: session.date,
                time: session.time,
                dayOfWeek: session.day_of_week,
                isActive: session.is_active,
                activeToken: session.active_token
            };
        } else {
            const sessions = this._get('sessions');
            return sessions.find(s => s.id === sessionId) || null;
        }
    },

    // --- УЧЕТ ПОСЕЩАЕМОСТИ ---

    async checkInStudent(studentId, scannedToken) {
        const sessionId = scannedToken.split('_tok_')[0];

        if (isSupabaseMode) {
            // Получаем сессию
            const { data: session } = await supabase
                .from('sessions')
                .select('*')
                .eq('id', sessionId)
                .maybeSingle();

            if (!session) {
                throw new Error('Данное занятие не найдено');
            }

            if (!session.is_active) {
                throw new Error('Срок действия QR-кода истек! Попросите преподавателя обновить занятие.');
            }

            if (session.active_token !== scannedToken) {
                throw new Error('QR-код устарел! Отсканируйте свежий код с экрана преподавателя.');
            }

            // Проверка дубликата отметки
            const { data: existing } = await supabase
                .from('attendance')
                .select('id')
                .eq('session_id', sessionId)
                .eq('student_id', studentId)
                .maybeSingle();

            if (existing) {
                return { success: true, message: 'Вы уже отмечены на этом занятии' };
            }

            const now = new Date();
            const timeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

            const newRecord = {
                id: 'att_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                session_id: sessionId,
                student_id: studentId,
                timestamp: timeStr
            };

            const { error } = await supabase
                .from('attendance')
                .insert([newRecord]);

            if (error) throw new Error(error.message);

            return { success: true, message: 'Посещение успешно отмечено!' };
        } else {
            // Локальный режим
            const sessions = this._get('sessions');
            const session = sessions.find(s => s.id === sessionId);

            if (!session) throw new Error('Данное занятие не найдено');
            if (!session.isActive) throw new Error('Срок действия QR-кода истек!');
            if (session.activeToken !== scannedToken) throw new Error('QR-код устарел! Отсканируйте свежий код.');

            const attendance = this._get('attendance');
            const alreadyChecked = attendance.some(a => a.sessionId === sessionId && a.studentId === studentId);
            if (alreadyChecked) {
                return { success: true, message: 'Вы уже отмечены на этом занятии' };
            }

            const now = new Date();
            const timeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

            const newRecord = {
                id: 'att_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                sessionId,
                studentId,
                timestamp: timeStr
            };

            attendance.push(newRecord);
            this._set('attendance', attendance);
            return { success: true, message: 'Посещение успешно отмечено!' };
        }
    },

    async getSessionAttendance(sessionId) {
        if (isSupabaseMode) {
            // Получаем посещения с джоином пользователей
            const { data: records } = await supabase
                .from('attendance')
                .select('id, student_id, timestamp, users(*)')
                .eq('session_id', sessionId);

            return (records || []).map(rec => {
                const student = rec.users;
                return {
                    id: rec.id,
                    studentId: rec.student_id,
                    lastName: student ? student.last_name : 'Неизвестно',
                    firstName: student ? student.first_name : 'Ученик',
                    patronymic: student ? student.patronymic : '',
                    group: student ? student.student_group : 'Без группы',
                    timestamp: rec.timestamp
                };
            });
        } else {
            const attendance = this._get('attendance');
            const users = this._get('users');
            const records = attendance.filter(a => a.sessionId === sessionId);

            return records.map(rec => {
                const student = users.find(u => u.id === rec.studentId);
                return {
                    id: rec.id,
                    studentId: rec.studentId,
                    lastName: student ? student.lastName : 'Неизвестно',
                    firstName: student ? student.firstName : 'Ученик',
                    patronymic: student ? student.patronymic : '',
                    group: student ? student.group : 'Без группы',
                    timestamp: rec.timestamp
                };
            });
        }
    },

    async getStudentAttendance(studentId) {
        if (isSupabaseMode) {
            // Делаем джоин посещений, сессий и предметов
            const { data: records } = await supabase
                .from('attendance')
                .select('id, timestamp, sessions(date, time, day_of_week, subjects(name))')
                .eq('student_id', studentId);

            return (records || []).map(rec => {
                const session = rec.sessions;
                const subject = session ? session.subjects : null;

                return {
                    id: rec.id,
                    subjectName: subject ? subject.name : 'Неизвестный предмет',
                    date: session ? session.date : 'Нет даты',
                    time: session ? session.time : 'Нет времени',
                    dayOfWeek: session ? session.day_of_week : 'Будний день',
                    timestamp: rec.timestamp
                };
            }).sort((a, b) => b.id.localeCompare(a.id));
        } else {
            const attendance = this._get('attendance');
            const sessions = this._get('sessions');
            const subjects = this._get('subjects');
            const studentRecords = attendance.filter(a => a.studentId === studentId);

            return studentRecords.map(rec => {
                const session = sessions.find(s => s.id === rec.sessionId);
                const subject = session ? subjects.find(sub => sub.id === session.subjectId) : null;

                return {
                    id: rec.id,
                    subjectName: subject ? subject.name : 'Неизвестный предмет',
                    date: session ? session.date : 'Нет даты',
                    time: session ? session.time : 'Нет времени',
                    dayOfWeek: session ? session.dayOfWeek : 'Будний день',
                    timestamp: rec.timestamp
                };
            }).sort((a, b) => b.id.localeCompare(a.id));
        }
    },

    async getStudentStats(studentId) {
        if (isSupabaseMode) {
            // Запрашиваем количество сессий и посещений студента
            const { count: totalSessions } = await supabase
                .from('sessions')
                .select('id', { count: 'exact', head: true });

            const { count: attendedSessions } = await supabase
                .from('attendance')
                .select('id', { count: 'exact', head: true })
                .eq('student_id', studentId);

            const total = totalSessions || 0;
            const attended = attendedSessions || 0;
            const rate = total > 0 ? Math.round((attended / total) * 100) : 0;

            return {
                rate,
                attended,
                missed: Math.max(0, total - attended),
                total
            };
        } else {
            const attendance = this._get('attendance');
            const sessions = this._get('sessions');
            
            const totalSessions = sessions.length;
            const attendedSessions = attendance.filter(a => a.studentId === studentId).length;
            
            const rate = totalSessions > 0 ? Math.round((attendedSessions / totalSessions) * 100) : 0;
            
            return {
                rate,
                attended: attendedSessions,
                missed: Math.max(0, totalSessions - attendedSessions),
                total: totalSessions
            };
        }
    },

    // --- Инициализация тестовых данных для localStorage (оффлайн режим) ---
    seedData() {
        if (isSupabaseMode) return; // В Supabase данные сеются через SQL-скрипт

        const users = this._get('users');
        const subjects = this._get('subjects');
        
        if (users.length === 0) {
            const testTeacher = {
                id: 'usr_teacher_seed',
                role: 'teacher',
                lastName: 'Смирнов',
                firstName: 'Дмитрий',
                patronymic: 'Алексеевич',
                group: '',
                username: 'teacher',
                password: '123'
            };
            
            const testStudents = [
                { id: 'usr_stud_1', role: 'student', lastName: 'Иванов', firstName: 'Иван', patronymic: 'Иванович', group: 'ИС-21', username: 'student1', password: '123' },
                { id: 'usr_stud_2', role: 'student', lastName: 'Петров', firstName: 'Петр', patronymic: 'Петрович', group: 'ИС-21', username: 'student2', password: '123' },
                { id: 'usr_stud_3', role: 'student', lastName: 'Алиева', firstName: 'Амина', patronymic: 'Сериковна', group: 'ВТ-22', username: 'student3', password: '123' },
                { id: 'usr_stud_4', role: 'student', lastName: 'Маратов', firstName: 'Алишер', patronymic: 'Ерланович', group: 'ВТ-22', username: 'student4', password: '123' }
            ];

            users.push(testTeacher, ...testStudents);
            this._set('users', users);

            const testSubjects = [
                { id: 'sub_seed_1', name: 'Английский язык (Лекция)', teacherId: 'usr_teacher_seed' },
                { id: 'sub_seed_2', name: 'Программирование на JavaScript', teacherId: 'usr_teacher_seed' }
            ];
            
            subjects.push(...testSubjects);
            this._set('subjects', subjects);
            console.log('Локальные тестовые данные засеяны!');
        }
    }
};

// Сидинг для локального режима
Database.seedData();
