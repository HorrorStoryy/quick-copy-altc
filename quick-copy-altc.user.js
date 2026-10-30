// ==UserScript==
// @name         Quick Copy Alt+C
// @namespace    https://smartway.today/
// @version      2.1
// @description  Постоянный светлый виджет "Буфер" + история копирований
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
    var ICON_DRAG = '\u2630';

    var REFERENCE_KEY = 'quickCopyReference';
    var HISTORY_KEY = 'quickCopyHistory';
    var WIDGET_VISIBLE_KEY = 'quickCopyWidgetVisible';
    var MAX_HISTORY = 50;

    // ===== УВЕДОМЛЕНИЕ =====
    function showNotification(icon, message, duration) {
        duration = duration || 2000;
        var existing = document.getElementById('quick-copy-notification');
        if (existing) existing.remove();

        var notif = document.createElement('div');
        notif.id = 'quick-copy-notification';
        notif.style.cssText = 'position:fixed;top:20px;right:20px;z-index:2147483647;background:#10b981;color:#fff;padding:14px 20px;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,0.15);font-family:system-ui,-apple-system,sans-serif;font-size:14px;display:flex;align-items:center;gap:10px;animation:slideIn 0.3s ease;max-width:400px;';

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
        notif.style.cssText = 'position:fixed;top:20px;right:20px;z-index:2147483647;background:#ef4444;color:#fff;padding:14px 20px;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,0.15);font-family:system-ui,-apple-system,sans-serif;font-size:14px;display:flex;align-items:center;gap:10px;animation:slideIn 0.3s ease;max-width:400px;';

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

    // ===== КОПИРОВАНИЕ В БУФЕР =====
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

    // ===== СВЕТЛЫЙ ПОСТОЯННЫЙ ВИДЖЕТ "БУФЕР" =====
    function updateFloatingWidget(text, isVisible) {
        var widgetRoot = document.getElementById('quick-copy-widget-root');
        
        if (!text || isVisible === false) {
            if (widgetRoot) widgetRoot.remove();
            return;
        }

        if (widgetRoot) {
            var textElement = widgetRoot.shadowRoot.getElementById('widget-text');
            if (textElement) {
                textElement.textContent = text;
            }
            return;
        }

        widgetRoot = document.createElement('div');
        widgetRoot.id = 'quick-copy-widget-root';
        document.body.appendChild(widgetRoot);

        var shadow = widgetRoot.attachShadow({ mode: 'open' });

        var style = document.createElement('style');
        style.textContent =
            '.info-card {' +
            '  position: fixed; bottom: 20px; right: 20px; width: 380px;' +
            '  background: #ffffff;' +
            '  border-radius: 16px;' +
            '  box-shadow: 0 10px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08);' +
            '  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;' +
            '  border: 1px solid #e5e7eb;' +
            '  overflow: hidden;' +
            '  z-index: 2147483647;' +
            '}' +
            '.header {' +
            '  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);' +
            '  color: #ffffff;' +
            '  padding: 14px 18px;' +
            '  display: flex;' +
            '  justify-content: space-between;' +
            '  align-items: center;' +
            '  cursor: move;' +
            '  user-select: none;' +
            '}' +
            '.header-title {' +
            '  font-weight: 700;' +
            '  font-size: 14px;' +
            '  display: flex;' +
            '  align-items: center;' +
            '  gap: 8px;' +
            '  letter-spacing: 0.3px;' +
            '}' +
            '.header-actions {' +
            '  display: flex;' +
            '  gap: 6px;' +
            '  align-items: center;' +
            '}' +
            '.icon-btn {' +
            '  background: rgba(255,255,255,0.2);' +
            '  border: none;' +
            '  color: #ffffff;' +
            '  width: 28px;' +
            '  height: 28px;' +
            '  border-radius: 6px;' +
            '  cursor: pointer;' +
            '  font-size: 14px;' +
            '  display: flex;' +
            '  align-items: center;' +
            '  justify-content: center;' +
            '  transition: background 0.15s;' +
            '}' +
            '.icon-btn:hover { background: rgba(255,255,255,0.3); }' +
            '.content {' +
            '  background: #f9fafb;' +
            '  padding: 16px 18px;' +
            '  max-height: 220px;' +
            '  overflow-y: auto;' +
            '  white-space: pre-wrap;' +
            '  word-wrap: break-word;' +
            '  font-size: 13px;' +
            '  color: #1f2937;' +
            '  line-height: 1.6;' +
            '  font-family: "SF Mono", "Monaco", "Consolas", monospace;' +
            '  border-top: 1px solid #e5e7eb;' +
            '}' +
            '.footer {' +
            '  background: #ffffff;' +
            '  padding: 10px 18px;' +
            '  border-top: 1px solid #e5e7eb;' +
            '  display: flex;' +
            '  justify-content: space-between;' +
            '  align-items: center;' +
            '  font-size: 11px;' +
            '  color: #6b7280;' +
            '}' +
            '.footer-hint {' +
            '  display: flex;' +
            '  align-items: center;' +
            '  gap: 4px;' +
            '}' +
            '.kbd {' +
            '  background: #f3f4f6;' +
            '  border: 1px solid #d1d5db;' +
            '  border-radius: 4px;' +
            '  padding: 2px 6px;' +
            '  font-size: 10px;' +
            '  font-family: system-ui, sans-serif;' +
            '  color: #374151;' +
            '}' +
            '.close { cursor: pointer; opacity: 0.9; font-size: 16px; }' +
            '.close:hover { opacity: 1; }';

        var container = document.createElement('div');
        container.className = 'info-card';
        container.innerHTML =
            '<div class="header" id="widget-header">' +
            '  <div class="header-title">' + ICON_COPY + ' Буфер</div>' +
            '  <div class="header-actions">' +
            '    <button class="icon-btn" id="copy-widget-btn" title="Копировать">' + ICON_COPY + '</button>' +
            '    <button class="icon-btn" id="history-widget-btn" title="История">' + ICON_HISTORY + '</button>' +
            '    <button class="icon-btn close" id="close-widget" title="Закрыть">' + ICON_CLOSE + '</button>' +
            '  </div>' +
            '</div>' +
            '<div class="content" id="widget-text"></div>' +
            '<div class="footer">' +
            '  <div class="footer-hint"><span class="kbd">Alt</span>+<span class="kbd">C</span> сохранить</div>' +
            '  <div class="footer-hint"><span class="kbd">Alt</span>+<span class="kbd">V</span> история</div>' +
            '</div>';

        shadow.appendChild(style);
        shadow.appendChild(container);

        // Кнопки
        shadow.getElementById('close-widget').onclick = function() {
            GM_setValue(WIDGET_VISIBLE_KEY, false);
        };
        shadow.getElementById('copy-widget-btn').onclick = function() {
            var textEl = shadow.getElementById('widget-text');
            if (textEl && textEl.textContent) {
                copyToClipboard(textEl.textContent).then(function() {
                    showNotification(ICON_CHECK, 'Скопировано из буфера');
                });
            }
        };
        shadow.getElementById('history-widget-btn').onclick = function() {
            showHistoryPanel();
        };

        // Перетаскивание
        var header = shadow.getElementById('widget-header');
        var isDragging = false, offsetX = 0, offsetY = 0;
        header.addEventListener('mousedown', function(e) {
            isDragging = true;
            var rect = widgetRoot.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            widgetRoot.style.cursor = 'grabbing';
        });
        document.addEventListener('mousemove', function(e) {
            if (!isDragging) return;
            var left = e.clientX - offsetX;
            var top = e.clientY - offsetY;
            left = Math.max(10, Math.min(window.innerWidth - widgetRoot.offsetWidth - 10, left));
            top = Math.max(10, Math.min(window.innerHeight - widgetRoot.offsetHeight - 10, top));
            widgetRoot.style.position = 'fixed';
            widgetRoot.style.left = left + 'px';
            widgetRoot.style.top = top + 'px';
            widgetRoot.style.bottom = 'auto';
            widgetRoot.style.right = 'auto';
        });
        document.addEventListener('mouseup', function() {
            if (isDragging) {
                isDragging = false;
                widgetRoot.style.cursor = 'default';
            }
        });

        var textElement = shadow.getElementById('widget-text');
        if (textElement) {
            textElement.textContent = text;
        }
    }

    // ===== ПАНЕЛЬ ИСТОРИИ (тоже светлая) =====
    function showHistoryPanel() {
        var existing = document.getElementById('quick-copy-history-panel');
        if (existing) {
            existing.remove();
            return;
        }

        var history = getHistory();
        var panel = document.createElement('div');
        panel.id = 'quick-copy-history-panel';
        panel.style.cssText = 'position:fixed;top:80px;right:20px;z-index:2147483647;width:420px;max-height:70vh;background:#ffffff;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,0.15);font-family:system-ui,-apple-system,sans-serif;display:flex;flex-direction:column;overflow:hidden;border:1px solid #e5e7eb;';

        var header = document.createElement('div');
        header.style.cssText = 'background:linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);color:#fff;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;cursor:move;user-select:none;';
        header.innerHTML = '<span style="font-weight:700;font-size:14px;display:flex;align-items:center;gap:8px;">' + ICON_HISTORY + ' История (' + history.length + ')</span><button id="qc-history-close" style="background:rgba(255,255,255,0.2);border:none;color:#fff;width:28px;height:28px;border-radius:6px;cursor:pointer;font-size:16px;">' + ICON_CLOSE + '</button>';
        panel.appendChild(header);

        var actions = document.createElement('div');
        actions.style.cssText = 'display:flex;gap:8px;padding:10px 14px;background:#f9fafb;border-bottom:1px solid #e5e7eb;';
        actions.innerHTML = '<button id="qc-clear-history" style="flex:1;padding:8px;background:#ef4444;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;transition:background 0.15s;">' + ICON_TRASH + ' Очистить</button>';
        panel.appendChild(actions);

        var content = document.createElement('div');
        content.style.cssText = 'padding:12px 14px;overflow-y:auto;flex:1;max-height:50vh;background:#fafafa;';

        if (history.length === 0) {
            content.innerHTML = '<div style="text-align:center;color:#9ca3af;padding:30px 10px;font-size:14px;">\uD83D\uDCED История пуста.<br>Выделите текст и нажмите Alt+C</div>';
        } else {
            for (var i = 0; i < history.length; i++) {
                (function(item, idx) {
                    var entry = document.createElement('div');
                    entry.style.cssText = 'background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;padding:10px 12px;margin-bottom:8px;cursor:pointer;transition:all 0.15s;';
                    entry.onmouseover = function() { this.style.borderColor = '#3b82f6'; this.style.background = '#eff6ff'; };
                    entry.onmouseout = function() { this.style.borderColor = '#e5e7eb'; this.style.background = '#ffffff'; };

                    var time = new Date(item.timestamp);
                    var timeStr = time.toLocaleDateString('ru-RU') + ' ' + time.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

                    var preview = item.preview || item.text.substring(0, 100);
                    if (item.text.length > 100) preview = preview + '...';

                    entry.innerHTML = '<div style="font-size:11px;color:#6b7280;margin-bottom:4px;display:flex;justify-content:space-between;">' +
                        '<span>' + timeStr + '</span>' +
                        '<span>' + item.length + ' симв.</span>' +
                        '</div>' +
                        '<div style="font-size:13px;color:#1f2937;white-space:pre-wrap;word-break:break-word;line-height:1.4;">' + escapeHtml(preview) + '</div>' +
                        '<div style="font-size:11px;color:#3b82f6;margin-top:6px;font-weight:600;">' + ICON_COPY + ' Нажмите, чтобы активировать</div>';

                    entry.onclick = function() {
                        GM_setValue(REFERENCE_KEY, item.text);
                        GM_setValue(WIDGET_VISIBLE_KEY, true);
                        updateFloatingWidget(item.text, true);
                        showNotification(ICON_CHECK, 'Запись из истории активирована');
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

    // ===== ГЛАВНАЯ ФУНКЦИЯ: Alt+C =====
    function doQuickCopy() {
        var selection = window.getSelection().toString().trim();
        if (!selection) {
            showError('Сначала выделите текст');
            return;
        }

        GM_setValue(REFERENCE_KEY, selection);
        GM_setValue(WIDGET_VISIBLE_KEY, true);
        saveToHistory(selection);
        updateFloatingWidget(selection, true);

        showNotification(ICON_CHECK, 'Сохранено в буфер: ' + selection.substring(0, 60) + (selection.length > 60 ? '...' : ''));
        console.log('[QuickCopy] Сохранено ' + selection.length + ' символов');
    }

    // ===== ИНИЦИАЛИЗАЦИЯ =====
    var savedData = GM_getValue(REFERENCE_KEY, '');
    var savedVisible = GM_getValue(WIDGET_VISIBLE_KEY, true);
    if (savedData && savedVisible) {
        updateFloatingWidget(savedData, true);
    }

    if (typeof GM_addValueChangeListener === 'function') {
        GM_addValueChangeListener(REFERENCE_KEY, function(name, old_value, new_value, remote) {
            var visible = GM_getValue(WIDGET_VISIBLE_KEY, true);
            updateFloatingWidget(new_value, visible);
        });
        GM_addValueChangeListener(WIDGET_VISIBLE_KEY, function(name, old_value, new_value, remote) {
            var data = GM_getValue(REFERENCE_KEY, '');
            if (data) updateFloatingWidget(data, new_value);
        });
    }

    document.addEventListener('keydown', function(e) {
        if (e.altKey && e.code === 'KeyC') {
            e.preventDefault();
            e.stopPropagation();
            doQuickCopy();
            return;
        }
        if (e.altKey && e.code === 'KeyV') {
            e.preventDefault();
            e.stopPropagation();
            showHistoryPanel();
            return;
        }
        if (e.key === 'Escape') {
            var panel = document.getElementById('quick-copy-history-panel');
            if (panel) panel.remove();
        }
    }, true);

    console.log('[Quick Copy Alt+C v2.1] Загружен. Горячие клавиши: Alt+C (сохранить), Alt+V (история)');

})();
