/**
 * Модуль вспомогательных компонентов (UI Components)
 * Содержит Toast-уведомления и анимированные SVG-графики.
 */

const Toast = {
    _getContainer() {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }
        return container;
    },

    /**
     * Показать всплывающее уведомление
     * @param {string} title - Заголовок
     * @param {string} message - Сообщение
     * @param {string} type - 'success' | 'error' | 'info' | 'warning'
     */
    show(title, message, type = 'success') {
        const container = this._getContainer();
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        // Подбираем иконку
        let icon = '🔔';
        if (type === 'success') icon = '✅';
        if (type === 'error') icon = '❌';
        if (type === 'warning') icon = '⚠️';
        if (type === 'info') icon = 'ℹ️';

        toast.innerHTML = `
            <div class="toast-icon">${icon}</div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-desc">${message}</div>
            </div>
            <button class="toast-close">&times;</button>
        `;

        container.appendChild(toast);

        // Кнопка закрытия
        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.classList.add('toast-exit');
            setTimeout(() => toast.remove(), 300);
        });

        // Автоматическое закрытие через 4 секунды
        setTimeout(() => {
            if (toast.parentNode) {
                toast.classList.add('toast-exit');
                setTimeout(() => toast.remove(), 300);
            }
        }, 4000);
    }
};

const Charts = {
    /**
     * Отрисовать анимированное кольцо прогресса
     * @param {string} containerId - ID элемента-контейнера
     * @param {number} percentage - Процент от 0 до 100
     */
    renderProgressRing(containerId, percentage) {
        const container = document.getElementById(containerId);
        if (!container) return;

        percentage = Math.min(100, Math.max(0, percentage));
        
        const radius = 60;
        const strokeWidth = 10;
        const normalizedRadius = radius - strokeWidth * 2;
        const circumference = normalizedRadius * 2 * Math.PI;
        const strokeDashoffset = circumference - (percentage / 100) * circumference;

        container.innerHTML = `
            <div class="progress-ring-wrapper">
                <svg class="progress-ring" width="130" height="130">
                    <circle 
                        class="progress-ring-bg" 
                        stroke="rgba(255, 255, 255, 0.05)" 
                        stroke-width="${strokeWidth}" 
                        fill="transparent" 
                        r="${normalizedRadius}" 
                        cx="65" 
                        cy="65"
                    />
                    <circle 
                        class="progress-ring-circle" 
                        stroke="url(#progressGradient)" 
                        stroke-width="${strokeWidth}" 
                        stroke-dasharray="${circumference} ${circumference}" 
                        style="stroke-dashoffset: ${circumference};"
                        fill="transparent" 
                        r="${normalizedRadius}" 
                        cx="65" 
                        cy="65"
                    />
                    <defs>
                        <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="#818cf8" />
                            <stop offset="100%" stop-color="#4f46e5" />
                        </linearGradient>
                    </defs>
                </svg>
                <div class="progress-ring-label">
                    <span class="progress-ring-percent">0%</span>
                    <span class="progress-ring-sub">посещаемость</span>
                </div>
            </div>
        `;

        const circle = container.querySelector('.progress-ring-circle');
        const percentLabel = container.querySelector('.progress-ring-percent');

        // Анимация кольца
        setTimeout(() => {
            circle.style.transition = 'stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)';
            circle.style.strokeDashoffset = strokeDashoffset;
        }, 50);

        // Анимация счетчика процентов
        let current = 0;
        if (percentage === 0) {
            percentLabel.textContent = '0%';
            return;
        }

        const duration = 1500; // мс
        const stepTime = Math.abs(Math.floor(duration / percentage));
        
        const timer = setInterval(() => {
            current += 1;
            percentLabel.textContent = `${current}%`;
            if (current >= percentage) {
                clearInterval(timer);
            }
        }, stepTime);
    }
};
