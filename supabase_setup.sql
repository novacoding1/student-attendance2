-- ====================================================================
-- SQL-СКРИПТ ДЛЯ НАСТРОЙКИ БАЗЫ ДАННЫХ В SUPABASE
-- Скопируйте этот код, зайдите в кабинет Supabase -> SQL Editor -> New Query
-- Вставьте данный код и нажмите кнопку "Run" в правом нижнем углу.
-- ====================================================================

-- 1. ТАБЛИЦА ПОЛЬЗОВАТЕЛЕЙ (Студенты и Преподаватели)
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL CHECK (role IN ('student', 'teacher')),
    last_name TEXT NOT NULL,
    first_name TEXT NOT NULL,
    patronymic TEXT NOT NULL,
    student_group TEXT DEFAULT '',
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Включаем публичный доступ (для простоты демонстрации отключаем RLS политики)
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- 2. ТАБЛИЦА ПРЕДМЕТОВ
CREATE TABLE IF NOT EXISTS public.subjects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    teacher_id TEXT REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.subjects DISABLE ROW LEVEL SECURITY;

-- 3. ТАБЛИЦА СЕССИЙ ЗАНЯТИЙ (ДНИ НЕДЕЛИ / ДАТЫ / QR-ТОКЕНЫ)
CREATE TABLE IF NOT EXISTS public.sessions (
    id TEXT PRIMARY KEY,
    subject_id TEXT REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    day_of_week TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    active_token TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.sessions DISABLE ROW LEVEL SECURITY;

-- 4. ТАБЛИЦА ПОСЕЩАЕМОСТИ
CREATE TABLE IF NOT EXISTS public.attendance (
    id TEXT PRIMARY KEY,
    session_id TEXT REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
    student_id TEXT REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    timestamp TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.attendance DISABLE ROW LEVEL SECURITY;

-- ====================================================================
-- ЗАПОЛНЕНИЕ НАЧАЛЬНЫМИ ТЕСТОВЫМИ ДАННЫМИ (SEED DATA)
-- ====================================================================

-- Очистка старых семян для избежания конфликтов при повторном запуске
TRUNCATE public.attendance CASCADE;
TRUNCATE public.sessions CASCADE;
TRUNCATE public.subjects CASCADE;
TRUNCATE public.users CASCADE;

-- Добавляем преподавателя (логин: teacher, пароль: 123)
INSERT INTO public.users (id, role, last_name, first_name, patronymic, student_group, username, password)
VALUES ('usr_teacher_seed', 'teacher', 'Смирнов', 'Дмитрий', 'Алексеевич', '', 'teacher', '123');

-- Добавляем студентов (пароли: 123)
INSERT INTO public.users (id, role, last_name, first_name, patronymic, student_group, username, password)
VALUES 
('usr_stud_1', 'student', 'Иванов', 'Иван', 'Иванович', 'ИС-21', 'student1', '123'),
('usr_stud_2', 'student', 'Петров', 'Петр', 'Петрович', 'ИС-21', 'student2', '123'),
('usr_stud_3', 'student', 'Алиева', 'Амина', 'Сериковна', 'ВТ-22', 'student3', '123'),
('usr_stud_4', 'student', 'Маратов', 'Алишер', 'Ерланович', 'ВТ-22', 'student4', '123');

-- Добавляем тестовые предметы для преподавателя
INSERT INTO public.subjects (id, name, teacher_id)
VALUES 
('sub_seed_1', 'Английский язык (Лекция)', 'usr_teacher_seed'),
('sub_seed_2', 'Программирование на JavaScript', 'usr_teacher_seed');
