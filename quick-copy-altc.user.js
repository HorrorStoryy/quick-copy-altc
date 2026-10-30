// ==UserScript==
// @name         Буфер обмена
// @namespace    https://smartway.today/
// @version      3.1
// @description  Постоянный светлый виджет "Буфер обмена" + автоформатирование даты и паспорта
// @author       Smartway
// @match        https://*/*
// @match        http://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addValueChangeListener
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/HorrorStoryy/quick-copy-altc/main/quick-copy-altc.meta.js
// @downloadURL  https://raw.githubusercontent.com/HorrorStoryy/quick-copy-altc/main/quick-copy-altc.user.js
// ==/UserScript==

(function() {
    'use strict';

    const ICON_COPY = '\uD83D\uDCCB';
    const ICON_CHECK = '\u2705';
    const ICON_HISTORY = '\uD83D\uDCDC';
    const ICON_CLOSE = '\u2715';
    const ICON_TRASH = '\uD83D\uDDD1';

    const REFERENCE_KEY = 'quickCopyReference';
    const HISTORY_KEY = 'quickCopyHistory';
    const WIDGET_VISIBLE_KEY = 'quickCopyWidgetVisible';
    const MAX_HISTORY = 50;

    // ===== АВТОФОРМАТИРОВАНИЕ ТЕКСТА =====
    function formatCopiedText(text) {
        let result = text;
        const months = {
            'янв':'01','фев':'02','мар':'03','апр':'04','мая':'05','май':'05',
            'июн':'06','июл':'07','авг':'08','сен':'09','окт':'10','ноя':'11','дек':'12',
            'января':'01','февраля':'02','марта':'03','апреля':'04',
            'июня':'06','июля':'07','августа':'08','сентября':'09','октября':'10','ноября':'11','декабря':'12'
        };

        // 1. Форматирование даты: "3 авг. 1981 г." -> "3 авг. 1981 г. (03.08.1981)"
        // (?!\s*\() защищает от повторного форматирования, если скобки уже есть
        result = result.replace(/(\d{1,2})\s+([а-яё]+)\.?\s+(\d{4})\s*г\.?(?!\s*\()/gi, function(match, day, monthName, year) {
            let mKey = monthName.toLowerCase();
            if (mKey.length > 3) mKey = mKey.slice(0, 3);
            const monthNum = months[mKey] || '00';
            if (monthNum !== '00') {
                const dayFormatted = day.padStart(2, '0');
                return `${match} (${dayFormatted}.${monthNum}.${year})`;
            }
            return match;
        });

        // 2. Форматирование паспорта: "1226129892" -> "1226129892 (1226 129892)"
        // \b ищет ровно 10 цифр, (?!\s*\() защищает от повторного форматирования
        result = result.replace(/\b(\d{10})\b(?!\s*\()/g, function(match, digits) {
            const series = digits.slice(0, 4);
            const number = digits.slice(4);
            return `${digits} (${series} ${number})`;
        });

        return result;
    }

    // ===== УВЕДОМЛЕНИЕ =====
    function showNotification(icon, message, duration = 2000) {
        const existing = document.getElementById('quick-copy-notification');
        if (existing) existing.remove();
        const notif = document.createElement('div');
        notif.id = 'quick-copy-notification';
        notif.style.cssText = 'position:fixed;top:20px;right:20px;z-index:2147483647;background:#10b981;color:#fff;padding:14px 20px;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,0.15);font-family:system-ui,-apple-system,sans-serif;font-size:14px;display:flex;align-items:center;gap:10px;animation:slideIn 0.3s ease;max-width:400px;';
        const style = document.createElement('style');
        style.textContent = '@keyframes slideIn { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }';
        document.head.appendChild(style);
        notif.innerHTML = `<span style="font-size:20px;">${icon}</span><span>${escapeHtml(message)}</span>`;
        document.body.appendChild(notif);
        setTimeout(() => {
            notif.style.transition = 'opacity 0.3s';
            notif.style.opacity = '0';
            setTimeout(() => notif.remove(), 300);
        }, duration);
    }

    function showError(message) {
        const existing = document.getElementById('quick-copy-notification');
        if (existing) existing.remove();
        const notif = document.createElement('div');
        notif.id = 'quick-copy-notification';
        notif.style.cssText = 'position:fixed;top:20px;right:20px;z-index:2147483647;background:#ef4444;color:#fff;padding:14px 20px;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,0.15);font-family:system-ui,-apple-system,sans-serif;font-size:14px;display:flex;align-items:center;gap:10px;animation:slideIn 0.3s ease;max-width:400px;';
        const style = document.createElement('style');
        style.textContent = '@keyframes slideIn { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }';
        document.head.appendChild(style);
        notif.innerHTML = `<span style="font-size:20px;">\u26A0\uFE0F</span><span>${escapeHtml(message)}</span>`;
        document.body.appendChild(notif);
        setTimeout(() => {
            notif.style.transition = 'opacity 0.3s';
            notif.style.opacity = '0';
            setTimeout(() => notif.remove(), 300);
        }, 3000);
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
        return new Promise((resolve, reject) => {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); resolve(); } catch (err) { reject(err); }
            ta.remove();
        });
    }

    function getHistory() {
        try { return JSON.parse(GM_getValue(HISTORY_KEY, '[]')); } catch (e) { return []; }
    }

    function saveToHistory(text) {
        const history = getHistory();
        history.unshift({ text, timestamp: Date.now(), length: text.length, preview: text.substring(0, 100) });
        if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
        GM_setValue(HISTORY_KEY, JSON.stringify(history));
    }

    // ===== СВЕТЛЫЙ ПОСТОЯННЫЙ ВИДЖЕТ "БУФЕР ОБМЕНА" =====
    function updateFloatingWidget(text, isVisible) {
        const widgetRoot = document.getElementById('quick-copy-widget-root');
        if (!text || isVisible === false) { if (widgetRoot) widgetRoot.remove(); return; }
        if (widgetRoot) {
            const textElement = widgetRoot.shadowRoot.getElementById('widget-text');
            if (textElement) textElement.textContent = text;
            return;
        }

        const root = document.createElement('div');
        root.id = 'quick-copy-widget-root';
        document.body.appendChild(root);
        const shadow = root.attachShadow({ mode: 'open' });

        const style = document.createElement('style');
        style.textContent = `.info-card{position:fixed;bottom:20px;right:20px;width:380px;background:#ffffff;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,0.12),0 2px 8px rgba(0,0,0,0.08);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;border:1px solid #e5e7eb;overflow:hidden;z-index:2147483647;}.header{background:linear-gradient(135deg,#3b82f6 0%,#2563eb 100%);color:#ffffff;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;cursor:move;user-select:none;}.header-title{font-weight:700;font-size:14px;display:flex;align-items:center;gap:8px;letter-spacing:0.3px;}.header-actions{display:flex;gap:6px;align-items:center;}.icon-btn{background:rgba(255,255,255,0.2);border:none;color:#ffffff;width:28px;height:28px;border-radius:6px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;transition:background 0.15s;}.icon-btn:hover{background:rgba(255,255,255,0.3);}.content{background:#f9fafb;padding:16px 18px;max-height:220px;overflow-y:auto;white-space:pre-wrap;word-wrap:break-word;font-size:13px;color:#1f2937;line-height:1.6;font-family:"SF Mono","Monaco","Consolas",monospace;border-top:1px solid #e5e7eb;}.footer{background:#ffffff;padding:10px 18px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#6b7280;}.footer-hint{display:flex;align-items:center;gap:4px;}.kbd{background:#f3f4f6;border:1px solid #d1d5db;border-radius:4px;padding:2px 6px;font-size:10px;font-family:system-ui,sans-serif;color:#374151;}.close{cursor:pointer;opacity:0.9;font-size:16px;}.close:hover{opacity:1;}`;

        const container = document.createElement('div');
        container.className = 'info-card';
        container.innerHTML = `<div class="header" id="widget-header"><div class="header-title">${ICON_COPY} Буфер обмена</div><div class="header-actions"><button class="icon-btn" id="copy-widget-btn" title="Копировать">${ICON_COPY}</button><button class="icon-btn" id="history-widget-btn" title="История">${ICON_HISTORY}</button><button class="icon-btn close" id="close-widget" title="Закрыть">${ICON_CLOSE}</button></div></div><div class="content" id="widget-text"></div><div class="footer"><div class="footer-hint"><span class="kbd">Alt</span>+<span class="kbd">C</span> сохранить</div><div class="footer-hint"><span class="kbd">Alt</span>+<span class="kbd">V</span> история</div></div>`;

        shadow.appendChild(style);
        shadow.appendChild(container);

        shadow.getElementById('close-widget').onclick = () => GM_setValue(WIDGET_VISIBLE_KEY, false);
        shadow.getElementById('copy-widget-btn').onclick = () => {
            const textEl = shadow.getElementById('widget-text');
            if (textEl && textEl.textContent) {
                copyToClipboard(textEl.textContent).then(() => showNotification(ICON_CHECK, 'Скопировано из буфера'));
            }
        };
        shadow.getElementById('history-widget-btn').onclick = () => showHistoryPanel();

        const header = shadow.getElementById('widget-header');
        let isDragging = false, offsetX = 0, offsetY = 0;
        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            const rect = root.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            root.style.cursor = 'grabbing';
        });
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const left = Math.max(10, Math.min(window.innerWidth - root.offsetWidth - 10, e.clientX - offsetX));
            const top = Math.max(10, Math.min(window.innerHeight - root.offsetHeight - 10, e.clientY - offsetY));
            root.style.position = 'fixed';
            root.style.left = left + 'px';
            root.style.top = top + 'px';
            root.style.bottom = 'auto';
            root.style.right = 'auto';
        });
        document.addEventListener('mouseup', () => { if (isDragging) { isDragging = false; root.style.cursor = 'default'; } });

        shadow.getElementById('widget-text').textContent = text;
    }

    function showHistoryPanel() {
        const existing = document.getElementById('quick-copy-history-panel');
        if (existing) { existing.remove(); return; }

        const history = getHistory();
        const panel = document.createElement('div');
        panel.id = 'quick-copy-history-panel';
        panel.style.cssText = 'position:fixed;top:80px;right:20px;z-index:2147483647;width:420px;max-height:70vh;background:#ffffff;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,0.15);font-family:system-ui,-apple-system,sans-serif;display:flex;flex-direction:column;overflow:hidden;border:1px solid #e5e7eb;';

        const header = document.createElement('div');
        header.style.cssText = 'background:linear-gradient(135deg,#3b82f6 0%,#2563eb 100%);color:#fff;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;cursor:move;user-select:none;';
        header.innerHTML = `<span style="font-weight:700;font-size:14px;display:flex;align-items:center;gap:8px;">${ICON_HISTORY} История (${history.length})</span><button id="qc-history-close" style="background:rgba(255,255,255,0.2);border:none;color:#fff;width:28px;height:28px;border-radius:6px;cursor:pointer;font-size:16px;">${ICON_CLOSE}</button>`;
        panel.appendChild(header);

        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex;gap:8px;padding:10px 14px;background:#f9fafb;border-bottom:1px solid #e5e7eb;';
        actions.innerHTML = `<button id="qc-clear-history" style="flex:1;padding:8px;background:#ef4444;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;transition:background 0.15s;">${ICON_TRASH} Очистить</button>`;
        panel.appendChild(actions);

        const content = document.createElement('div');
        content.style.cssText = 'padding:12px 14px;overflow-y:auto;flex:1;max-height:50vh;background:#fafafa;';

        if (history.length === 0) {
            content.innerHTML = '<div style="text-align:center;color:#9ca3af;padding:30px 10px;font-size:14px;">📭 История пуста.<br>Выделите текст и нажмите Alt+C</div>';
        } else {
            history.forEach((item) => {
                const entry = document.createElement('div');
                entry.style.cssText = 'background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;padding:10px 12px;margin-bottom:8px;cursor:pointer;transition:all 0.15s;';
                entry.onmouseover = () => { entry.style.borderColor = '#3b82f6'; entry.style.background = '#eff6ff'; };
                entry.onmouseout = () => { entry.style.borderColor = '#e5e7eb'; entry.style.background = '#ffffff'; };

                const time = new Date(item.timestamp);
                const timeStr = time.toLocaleDateString('ru-RU') + ' ' + time.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                const preview = item.preview + (item.text.length > 100 ? '...' : '');

                entry.innerHTML = `<div style="font-size:11px;color:#6b7280;margin-bottom:4px;display:flex;justify-content:space-between;"><span>${timeStr}</span><span>${item.length} симв.</span></div><div style="font-size:13px;color:#1f2937;white-space:pre-wrap;word-break:break-word;line-height:1.4;">${escapeHtml(preview)}</div><div style="font-size:11px;color:#3b82f6;margin-top:6px;font-weight:600;">${ICON_COPY} Нажмите, чтобы активировать</div>`;

                entry.onclick = () => {
                    GM_setValue(REFERENCE_KEY, item.text);
                    GM_setValue(WIDGET_VISIBLE_KEY, true);
                    updateFloatingWidget(item.text, true);
                    showNotification(ICON_CHECK, 'Запись из истории активирована');
                };
                content.appendChild(entry);
            });
        }

        panel.appendChild(content);
        document.body.appendChild(panel);

        header.querySelector('#qc-history-close').onclick = () => panel.remove();
        actions.querySelector('#qc-clear-history').onclick = () => {
            GM_setValue(HISTORY_KEY, '[]');
            showNotification(ICON_TRASH, 'История очищена');
            panel.remove();
        };

        let isDragging = false, offsetX = 0, offsetY = 0;
        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            const rect = panel.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
        });
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const left = Math.max(10, Math.min(window.innerWidth - panel.offsetWidth - 10, e.clientX - offsetX));
            const top = Math.max(10, Math.min(window.innerHeight - panel.offsetHeight - 10, e.clientY - offsetY));
            panel.style.left = left + 'px';
            panel.style.top = top + 'px';
            panel.style.right = 'auto';
        });
        document.addEventListener('mouseup', () => { isDragging = false; });
    }

    // ===== ГЛАВНАЯ ФУНКЦИЯ: Alt+C С АВТОФОРМАТИРОВАНИЕМ =====
    function doQuickCopy() {
        const selection = window.getSelection().toString().trim();
        if (!selection) {
            showError('Сначала выделите текст');
            return;
        }

        // Применяем автоформатирование (дата и паспорт)
        const formattedSelection = formatCopiedText(selection);

        GM_setValue(REFERENCE_KEY, formattedSelection);
        GM_setValue(WIDGET_VISIBLE_KEY, true);
        saveToHistory(formattedSelection); // В историю тоже сохраняется уже отформатированный текст
        updateFloatingWidget(formattedSelection, true);

        showNotification(ICON_CHECK, 'Сохранено: ' + formattedSelection.substring(0, 60) + (formattedSelection.length > 60 ? '...' : ''));
        console.log('[Буфер обмена] Сохранено и отформатировано');
    }

    // ===== ИНИЦИАЛИЗАЦИЯ =====
    const savedData = GM_getValue(REFERENCE_KEY, '');
    const savedVisible = GM_getValue(WIDGET_VISIBLE_KEY, true);
    if (savedData && savedVisible) updateFloatingWidget(savedData, true);

    if (typeof GM_addValueChangeListener === 'function') {
        GM_addValueChangeListener(REFERENCE_KEY, (name, old_value, new_value) => {
            updateFloatingWidget(new_value, GM_getValue(WIDGET_VISIBLE_KEY, true));
        });
        GM_addValueChangeListener(WIDGET_VISIBLE_KEY, (name, old_value, new_value) => {
            const data = GM_getValue(REFERENCE_KEY, '');
            if (data) updateFloatingWidget(data, new_value);
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.altKey && e.code === 'KeyC') { e.preventDefault(); e.stopPropagation(); doQuickCopy(); return; }
        if (e.altKey && e.code === 'KeyV') { e.preventDefault(); e.stopPropagation(); showHistoryPanel(); return; }
        if (e.key === 'Escape') {
            const panel = document.getElementById('quick-copy-history-panel');
            if (panel) panel.remove();
        }
    }, true);

    console.log('[Буфер обмена v3.1] Загружен. Горячие клавиши: Alt+C (сохранить), Alt+V (история)');
})();
