// ==UserScript==
// @name         Quick Copy Alt+C
// @namespace    https://smartway.today/
// @version      1.0
// @description  Быстрое копирование выделенного текста по Alt+C с историей
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

    // Unicode-иконки
    var ICON_COPY = '\uD83D\uDCCB';
    var ICON_CHECK = '\u2705';
    var ICON_HISTORY = '\uD83D\uDCDC';
    var ICON_CLOSE = '\u2715';
    var ICON_TRASH = '\uD83D\uDDD1';

    var HISTORY_KEY = 'quickCopyHistory';
    var MAX_HISTORY = 50;

    // ===== УВЕДОМЛЕНИЕ =====
    function showNotification(icon, message, duration) {
        duration = duration || 2000;
        var existing = document.getElementById('quick-copy-notification');
        if (existing) existing.remove();

        var notif = document.createElement('div');
        notif.id = 'quick-copy-notification';
        notif.style.cssText = 'position:fixed;top:20px;right:20px;z-index:2147483647;background:#10b981;color:#fff;padding:14px 20px;border-radius:10px;box-shadow:0 10px 25px rgba(0,0,0,0.2);font-family:system-ui,-apple-system,sans-serif;font-size:14px;display:flex;align-items:center;gap:10px;animation:slideIn 0.3s ease;max-width:400px;';

        var style = document.createElement('style');
        style.textContent = '@keyframes slideIn { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }';
        document.head.appendChild(style);

        notif.innerHTML = '<span style="font-size:20px;">' + icon + '</span><span>' + escapeHtml(message) + '</span>';
        document.body.appendChild(notif);

        setTimeout(function() {
            notif.style.transition = 'opacity 0.3s';
            notif.style.opacity = '0';
            setTimeout(function() { notif.remove(); }, 300);
        }, duration);
    }

    function showError(message) {
        var existing = document.getElementById('quick-copy-notification');
        if (existing) existing.remove();

        var notif = document.createElement('div');
        notif.id = 'quick-copy-notification';
        notif.style.cssText = 'position:fixed;top:20px;right:20px;z-index:2147483647;background:#ef4444;color:#fff;padding:14px 20px;border-radius:10px;box-shadow:0 10px 25px rgba(0,0,0,0.2);font-family:system-ui,-apple-system,sans-serif;font-size:14px;display:flex;align-items:center;gap:10px;animation:slideIn 0.3s ease;max-width:400px;';

        var style = document.createElement('style');
        style.textContent = '@keyframes slideIn { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }';
        document.head.appendChild(style);

        notif.innerHTML = '<span style="font-size:20px;">\u26A0\uFE0F</span><span>' + escapeHtml(message) + '</span>';
        document.body.appendChild(notif);

        setTimeout(function() {
            notif.style.transition = 'opacity 0.3s';
            notif.style.opacity = '0';
            setTimeout(function() { notif.remove(); }, 300);
        }, 3000);
    }

    function escapeHtml(text) {
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ===== КОПИРОВАНИЕ =====
    function copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text);
        }
        return new Promise(function(resolve, reject) {
            var ta = document.createElement('textarea');
            ta.value = text;
            ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
            document.body.appendChild(ta);
            ta.select();
            try {
                document.execCommand('copy');
                resolve();
            } catch (err) {
                reject(err);
            }
            ta.remove();
        });
    }

    // ===== ИСТОРИЯ =====
    function getHistory() {
        try {
            var raw = GM_getValue(HISTORY_KEY, '[]');
            return JSON.parse(raw);
        } catch (e) {
            return [];
        }
    }

    function saveToHistory(text) {
        var history = getHistory();
        history.unshift({
            text: text,
            timestamp: Date.now(),
            length: text.length,
            preview: text.substring(0, 100)
        });
        if (history.length > MAX_HISTORY) {
            history = history.slice(0, MAX_HISTORY);
        }
        GM_setValue(HISTORY_KEY, JSON.stringify(history));
    }

    function clearHistory() {
        GM_setValue(HISTORY_KEY, '[]');
        showNotification(ICON_TRASH, 'История очищена');
    }

    // ===== ПАНЕЛЬ ИСТОРИИ =====
    function showHistoryPanel() {
        var existing = document.getElementById('quick-copy-history-panel');
        if (existing) {
            existing.remove();
            return;
        }

        var history = getHistory();
        var panel = document.createElement('div');
        panel.id = 'quick-copy-history-panel';
        panel.style.cssText = 'position:fixed;top:80px;right:20px;z-index:2147483647;width:420px;max-height:70vh;background:#fff;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,0.2);font-family:system-ui,-apple-system,sans-serif;display:flex;flex-direction:column;overflow:hidden;border:1px solid #e5e7eb;';

        var header = document.createElement('div');
        header.style.cssText = 'background:#3b82f6;color:#fff;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;cursor:move;user-select:none;';
        header.innerHTML = '<span style="font-weight:700;font-size:15px;">' + ICON_HISTORY + ' История копирований (' + history.length + ')</span><button id="qc-history-close" style="background:none;border:none;color:#fff;font-size:20px;cursor:pointer;">' + ICON_CLOSE + '</button>';
        panel.appendChild(header);

        var actions = document.createElement('div');
        actions.style.cssText = 'display:flex;gap:8px;padding:10px 14px;background:#f9fafb;border-bottom:1px solid #e5e7eb;';
        actions.innerHTML = '<button id="qc-clear-history" style="flex:1;padding:8px;background:#ef4444;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;">' + ICON_TRASH + ' Очистить</button>';
        panel.appendChild(actions);

        var content = document.createElement('div');
        content.style.cssText = 'padding:12px 14px;overflow-y:auto;flex:1;max-height:50vh;background:#fafafa;';

        if (history.length === 0) {
            content.innerHTML = '<div style="text-align:center;color:#9ca3af;padding:30px 10px;font-size:14px;">\uD83D\uDCED История пуста.<br>Выделите текст и нажмите Alt+C</div>';
        } else {
            for (var i = 0; i < history.length; i++) {
                (function(item, idx) {
                    var entry = document.createElement('div');
                    entry.style.cssText = 'background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;margin-bottom:8px;cursor:pointer;transition:all 0.15s;';
                    entry.onmouseover = function() { this.style.borderColor = '#3b82f6'; this.style.background = '#eff6ff'; };
                    entry.onmouseout = function() { this.style.borderColor = '#e5e7eb'; this.style.background = '#fff'; };

                    var time = new Date(item.timestamp);
                    var timeStr = time.toLocaleDateString('ru-RU') + ' ' + time.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

                    var preview = item.preview || item.text.substring(0, 100);
                    if (item.text.length > 100) preview = preview + '...';

                    entry.innerHTML = '<div style="font-size:11px;color:#6b7280;margin-bottom:4px;display:flex;justify-content:space-between;">' +
                        '<span>' + timeStr + '</span>' +
                        '<span>' + item.length + ' симв.</span>' +
                        '</div>' +
                        '<div style="font-size:13px;color:#1f2937;white-space:pre-wrap;word-break:break-word;line-height:1.4;">' + escapeHtml(preview) + '</div>' +
                        '<div style="font-size:11px;color:#3b82f6;margin-top:6px;font-weight:600;">' + ICON_COPY + ' Нажмите, чтобы скопировать</div>';

                    entry.onclick = function() {
                        copyToClipboard(item.text).then(function() {
                            showNotification(ICON_CHECK, 'Скопировано из истории');
                        }).catch(function() {
                            showError('Не удалось скопировать');
                        });
                    };

                    content.appendChild(entry);
                })(history[i], i);
            }
        }

        panel.appendChild(content);
        document.body.appendChild(panel);

        header.querySelector('#qc-history-close').onclick = function() { panel.remove(); };
        actions.querySelector('#qc-clear-history').onclick = function() {
            clearHistory();
            panel.remove();
        };

        // Перетаскивание
        var isDragging = false, offsetX = 0, offsetY = 0;
        header.addEventListener('mousedown', function(e) {
            isDragging = true;
            var rect = panel.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
        });
        document.addEventListener('mousemove', function(e) {
            if (!isDragging) return;
            var left = e.clientX - offsetX;
            var top = e.clientY - offsetY;
            left = Math.max(10, Math.min(window.innerWidth - panel.offsetWidth - 10, left));
            top = Math.max(10, Math.min(window.innerHeight - panel.offsetHeight - 10, top));
            panel.style.left = left + 'px';
            panel.style.top = top + 'px';
            panel.style.right = 'auto';
        });
        document.addEventListener('mouseup', function() { isDragging = false; });
    }

    // ===== ГЛАВНАЯ ФУНКЦИЯ КОПИРОВАНИЯ =====
    function doQuickCopy() {
        var selection = window.getSelection().toString().trim();
        if (!selection) {
            showError('Сначала выделите текст');
            return;
        }

        copyToClipboard(selection).then(function() {
            saveToHistory(selection);
            var preview = selection.length > 60 ? selection.substring(0, 60) + '...' : selection;
            showNotification(ICON_CHECK, 'Скопировано: ' + preview);
            console.log('[QuickCopy] Скопировано ' + selection.length + ' символов');
        }).catch(function(err) {
            console.error('[QuickCopy] Ошибка:', err);
            showError('Не удалось скопировать');
        });
    }

    // ===== ГОРЯЧИЕ КЛАВИШИ =====
    document.addEventListener('keydown', function(e) {
        // Alt+C — копировать выделенное
        if (e.altKey && e.code === 'KeyC') {
            e.preventDefault();
            e.stopPropagation();
            doQuickCopy();
            return;
        }

        // Alt+V — показать историю
        if (e.altKey && e.code === 'KeyV') {
            e.preventDefault();
            e.stopPropagation();
            showHistoryPanel();
            return;
        }

        // Escape — закрыть панель истории
        if (e.key === 'Escape') {
            var panel = document.getElementById('quick-copy-history-panel');
            if (panel) panel.remove();
        }
    }, true);

    console.log('[Quick Copy Alt+C] Загружен. Горячие клавиши: Alt+C (копировать), Alt+V (история)');

})();
