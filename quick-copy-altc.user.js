// ==UserScript==
// @name         Карточка сотрудника Smartway
// @namespace    https://smartway.today/
// @version      2.3
// @description  Извлекает данные сотрудника и формирует карточку (Стандартная / ЖД / Страховка) + Форматирование
// @author       Smartway
// @match        https://bo.sandbox.smartway.today/*
// @match        https://bo.smartway.today/*
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/HorrorStoryy/smartway-card/main/smartway-card.meta.js
// @downloadURL  https://raw.githubusercontent.com/HorrorStoryy/smartway-card/main/smartway-card.user.js
// ==/UserScript==

(function() {
    'use strict';

    let cachedData = null;
    let lastCardText = '';

    // ---------- КНОПКА-ТРИГГЕР ----------
    function createToggleButton() {
        const oldBtn = document.getElementById('smartway-toggle');
        if (oldBtn) oldBtn.remove();
        const toggle = document.createElement('button');
        toggle.id = 'smartway-toggle';
        toggle.textContent = '📋';
        toggle.title = 'Карточка сотрудника (Ctrl+1/2/3)';
        toggle.style.cssText = `position: fixed; top: 100px; right: 20px; z-index: 999999; background: #4CAF50; color: white; border: none; border-radius: 50%; width: 50px; height: 50px; font-size: 24px; cursor: pointer; box-shadow: 0 2px 10px rgba(0,0,0,0.3); transition: 0.2s; display: flex; align-items: center; justify-content: center; opacity: 0.8;`;
        toggle.onmouseover = () => { toggle.style.opacity = '1'; toggle.style.transform = 'scale(1.05)'; };
        toggle.onmouseout = () => { toggle.style.opacity = '0.8'; toggle.style.transform = 'scale(1)'; };
        toggle.onclick = () => {
            let panel = document.getElementById('smartway-panel');
            if (panel) {
                panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
                if (panel.style.display === 'block' && !cachedData) {
                    cachedData = parsePageData();
                }
            } else {
                createPanel();
            }
        };
        document.body.appendChild(toggle);
    }

    // ---------- ПАРСИНГ СТРАНИЦЫ ----------
    function parsePageData() {
        console.log('[SW] 🕵️ Начинаю парсинг страницы...');
        const text = document.body.innerText;

        function findValue(label) {
            const regex = new RegExp(label.replace(/[.+?^${}()|[\]\\]/g, '\\$&') + '\\s[:–-]?\\s*([^\\n]+)', 'i');
            const match = text.match(regex);
            return match ? match[1].trim() : '';
        }

        function cleanFullName(raw) {
            if (!raw) return '';
            let cleaned = raw.replace(/done_outline/gi, '').trim();
            cleaned = cleaned.replace(/\s+/g, ' ').trim();
            return cleaned;
        }

        function getShortCompanies() {
            const accountIndex = text.indexOf('АККАУНТЫ');
            if (accountIndex === -1) return '';
            const endMarkers = ['БОНУСНЫЕ КАРТЫ', 'ДОКУМЕНТЫ', 'TRAVEL ПОЛИТИКИ', 'ПРАВА'];
            let endPos = text.length;
            for (let marker of endMarkers) {
                const idx = text.indexOf(marker, accountIndex);
                if (idx !== -1 && idx < endPos) endPos = idx;
            }
            const section = text.substring(accountIndex, endPos);
            if (/Структурная группа/i.test(section)) {
                return parseStructuredGroups(section);
            }
            const startLabel = 'Список коротких компаний:';
            const startPos = section.indexOf(startLabel);
            if (startPos === -1) return '';
            let pos = startPos + startLabel.length;
            while (pos < section.length && (section[pos] === ' ' || section[pos] === '\n' || section[pos] === '\r')) pos++;
            const oldEndMarkers = ['Отделы:', 'Структурная группа'];
            let oldEndPos = section.length;
            for (let marker of oldEndMarkers) {
                const idx = section.indexOf(marker, pos);
                if (idx !== -1 && idx < oldEndPos) oldEndPos = idx;
            }
            return section.substring(pos, oldEndPos).trim();
        }

        function parseStructuredGroups(section) {
            const parts = section.split(/(?=Структурная группа)/i).map(p => p.trim()).filter(p => p);
            const results = [];
            for (let part of parts) {
                if (!/^Структурная группа/i.test(part)) continue;
                const lines = part.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '');
                const groupHeader = lines.find(l => /^Структурная группа/i.test(l)) || '';
                let shortCompanies = '';
                const scIdx = lines.findIndex(l => /^Список коротких компаний/i.test(l));
                if (scIdx !== -1) {
                    const labelLine = lines[scIdx];
                    const colonIdx = labelLine.indexOf(':');
                    if (colonIdx !== -1) {
                        const afterColon = labelLine.substring(colonIdx + 1).trim();
                        if (afterColon) {
                            shortCompanies = afterColon;
                        } else {
                            for (let i = scIdx + 1; i < lines.length; i++) {
                                if (lines[i] && !/^(Отделы|Список коротких|Структурная)/i.test(lines[i])) {
                                    shortCompanies = lines[i];
                                    break;
                                }
                            }
                        }
                    }
                }
                let departments = '';
                const deptIdx = lines.findIndex(l => /^Отделы/i.test(l));
                if (deptIdx !== -1) {
                    const labelLine = lines[deptIdx];
                    const colonIdx = labelLine.indexOf(':');
                    if (colonIdx !== -1) {
                        const afterColon = labelLine.substring(colonIdx + 1).trim();
                        if (afterColon) {
                            departments = afterColon;
                        } else {
                            for (let i = deptIdx + 1; i < lines.length; i++) {
                                if (lines[i] && !/^(Отделы|Список коротких|Структурная)/i.test(lines[i])) {
                                    departments = lines[i];
                                    break;
                                }
                            }
                        }
                    }
                }
                let groupText = groupHeader;
                if (shortCompanies) groupText += '\nСписок коротких компаний: ' + shortCompanies;
                if (departments) groupText += '\nОтделы: ' + departments;
                results.push(groupText);
            }
            return results.join('\n\n');
        }

        function getForeignPassports() {
            const results = [];
            const markers = ['Загран.паспорт', 'Паспорт иностранного гр-на'];
            let parts = [];
            for (let marker of markers) {
                let pos = text.indexOf(marker);
                while (pos !== -1) {
                    parts.push({ marker, start: pos });
                    pos = text.indexOf(marker, pos + 1);
                }
            }
            parts.sort((a, b) => a.start - b.start);
            for (let i = 0; i < parts.length; i++) {
                const start = parts[i].start + parts[i].marker.length;
                const nextStart = (i + 1 < parts.length) ? parts[i+1].start : text.length;
                const section = text.substring(start, nextStart);
                const surnameMatch = section.match(/Фамилия\s*[:–-]?\s*([^\n]+)/i);
                const nameMatch = section.match(/Имя\s*[:–-]?\s*([^\n]+)/i);
                const patronymicMatch = section.match(/Отчество\s*[:–-]?\s*([^\n]+)/i);
                const numberMatch = section.match(/Номер\s*[:–-]?\s*([^\n]+)/i);
                const expiryMatch = section.match(/Срок действия\s*[:–-]?\s*([^\n]+)/i);
                results.push({
                    surname: surnameMatch ? surnameMatch[1].trim() : '',
                    name: nameMatch ? nameMatch[1].trim() : '',
                    patronymic: patronymicMatch ? patronymicMatch[1].trim() : '',
                    number: numberMatch ? numberMatch[1].trim() : '',
                    expiry: expiryMatch ? expiryMatch[1].trim() : '',
                    marker: parts[i].marker
                });
            }
            return results;
        }

        function getPassportRF() {
            const section = text.split('Паспорт РФ')[1];
            if (!section) return '';
            const match = section.match(/Номер\s*[:–-]?\s*([^\n]+)/i);
            return match ? match[1].trim() : '';
        }

        // --- ФОРМАТИРОВАНИЕ ДАТЫ С ЛОГАМИ ---
        function formatDate(raw) {
            console.log('[SW] 📅 formatDate получила сырые данные:', raw);
            if (!raw) return '';
            if (/^\d{2}.\d{2}.\d{4}$/.test(raw.trim())) {
                console.log('[SW] 📅 Дата уже в формате ДД.ММ.ГГГГ');
                return raw.trim();
            }
            const months = {
                'янв':'01','фев':'02','мар':'03','апр':'04','мая':'05','май':'05',
                'июн':'06','июл':'07','авг':'08','сен':'09','окт':'10','ноя':'11','дек':'12',
                'января':'01','февраля':'02','марта':'03','апреля':'04',
                'июня':'06','июля':'07','августа':'08','сентября':'09','октября':'10','ноября':'11','декабря':'12'
            };
            const match = raw.match(/(\d+)\s*([а-яё]+).?\s*(\d{4})\s*г?.?/i);
            if (!match) {
                console.log('[SW] 📅 Регулярное выражение не совпало с датой');
                return '';
            }
            const day = match[1].padStart(2, '0');
            const monthKey = match[2].toLowerCase();
            const month = months[monthKey] || months[monthKey.slice(0,3)] || '00';
            if (month === '00') {
                console.log('[SW] 📅 Не удалось определить месяц:', monthKey);
                return '';
            }
            const year = match[3];
            const result = `${day}.${month}.${year}`;
            console.log('[SW] 📅 Отформатированная дата:', result);
            return result;
        }

        // --- ФОРМАТИРОВАНИЕ ПАСПОРТА С ЛОГАМИ ---
        function formatPassportRF(raw) {
            console.log('[SW] 🛂 formatPassportRF получила сырые данные:', raw);
            if (!raw) return '';
            const digits = raw.replace(/\D/g, ''); // Оставляем только цифры
            console.log('[SW] 🛂 Только цифры:', digits, 'Длина:', digits.length);
            if (digits.length === 10) {
                const series = digits.substring(0, 4);
                const number = digits.substring(4, 10);
                const result = `${digits} (${series} ${number})`;
                console.log('[SW] 🛂 Успешно отформатировано:', result);
                return result;
            }
            console.log('[SW] 🛂 Длина не равна 10, возвращаем как есть');
            return raw;
        }

        const fullNameRaw = findValue('ФИО');
        const fullName = cleanFullName(fullNameRaw);
        const birthDateRaw = findValue('Дата рождения');
        const citizenship = findValue('Гражданство');
        const phone = findValue('Телефон');
        const email = findValue('Email') || findValue('Email:');
        const costCenter = findValue('Центр затрат по умолчанию');
        const shortCompanies = getShortCompanies();
        
        const formattedDate = formatDate(birthDateRaw);
        const dateString = (birthDateRaw && formattedDate) ? birthDateRaw + ' (' + formattedDate + ')' : birthDateRaw || '';
        
        const passportRFRaw = getPassportRF();
        const passportRF = formatPassportRF(passportRFRaw);
        
        const foreignPassports = getForeignPassports();
        const isRussian = citizenship.toLowerCase().includes('россия') || citizenship.toLowerCase().includes('russia');

        console.log('[SW] ✅ Итоговые данные для карточки:', { fullName, dateString, passportRF });

        return {
            link: window.location.href,
            fullName, dateString, phone, citizenship, email, costCenter, shortCompanies,
            passportRF, foreignPassports, isRussian
        };
    }

    // ---------- СОЗДАНИЕ ПАНЕЛИ ----------
    function createPanel() {
        const existing = document.getElementById('smartway-panel');
        if (existing) {
            existing.style.display = 'block';
            return;
        }
        const panel = document.createElement('div');
        panel.id = 'smartway-panel';
        panel.style.cssText = `position: fixed; top: 80px; right: 20px; z-index: 999999; width: 380px; max-height: 70vh; background: white; border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,0.2); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; display: flex; flex-direction: column; overflow: hidden; border: 1px solid #e0e0e0;`;

        const header = document.createElement('div');
        header.style.cssText = `background: #4CAF50; color: white; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; cursor: move; user-select: none;`;
        header.innerHTML = `<span style="font-weight: bold; font-size: 16px;">📋 Карточка сотрудника</span> <button id="smartway-close" style="background: none; border: none; color: white; font-size: 20px; cursor: pointer;">✕</button>`;
        panel.appendChild(header);

        const typeSelector = document.createElement('div');
        typeSelector.style.cssText = `display: flex; gap: 6px; padding: 10px 12px; background: #f9f9f9; border-bottom: 1px solid #eee; flex-wrap: wrap;`;
        const types = [
            { id: 'standard', label: '📋 Стандартная' },
            { id: 'rail', label: '🚄 ЖД' },
            { id: 'insurance', label: '🛡️ Страховка' }
        ];
        types.forEach(t => {
            const btn = document.createElement('button');
            btn.dataset.type = t.id;
            btn.textContent = t.label;
            btn.style.cssText = `background: white; border: 1px solid #ccc; border-radius: 20px; padding: 4px 12px; font-size: 13px; cursor: pointer; transition: 0.2s; flex: 1; white-space: nowrap;`;
            btn.onmouseover = () => { btn.style.background = '#e8f5e9'; };
            btn.onmouseout = () => { btn.style.background = 'white'; };
            btn.onclick = () => {
                document.querySelectorAll('#smartway-panel .type-btn').forEach(b => b.style.background = 'white');
                btn.style.background = '#c8e6c9';
                generateCard(t.id);
            };
            btn.className = 'type-btn';
            typeSelector.appendChild(btn);
        });
        panel.appendChild(typeSelector);

        const contentArea = document.createElement('div');
        contentArea.id = 'smartway-content';
        contentArea.style.cssText = `padding: 12px 16px; overflow-y: auto; flex: 1; background: #fafafa; min-height: 100px; max-height: 40vh; font-size: 13px; line-height: 1.6; white-space: pre-wrap; word-wrap: break-word; font-family: 'Courier New', monospace;`;
        contentArea.textContent = 'Выберите тип карточки';
        panel.appendChild(contentArea);

        const copyBtn = document.createElement('button');
        copyBtn.id = 'smartway-copy';
        copyBtn.textContent = '📋 Копировать';
        copyBtn.style.cssText = `margin: 8px 16px 16px 16px; padding: 8px 0; background: #4CAF50; color: white; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; transition: 0.2s; font-weight: bold;`;
        copyBtn.onmouseover = () => { copyBtn.style.background = '#45a049'; };
        copyBtn.onmouseout = () => { copyBtn.style.background = '#4CAF50'; };
        copyBtn.onclick = () => {
            if (!lastCardText || lastCardText === 'Выберите тип карточки' || lastCardText === '⏳ Загрузка...') {
                return;
            }
            const ta = document.createElement('textarea');
            ta.value = lastCardText;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            ta.style.top = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            try {
                document.execCommand('copy');
                copyBtn.textContent = '✅ Скопировано!';
                setTimeout(() => { copyBtn.textContent = '📋 Копировать'; }, 1500);
            } catch (err) {
                navigator.clipboard.writeText(lastCardText).then(() => {
                    copyBtn.textContent = '✅ Скопировано!';
                    setTimeout(() => { copyBtn.textContent = '📋 Копировать'; }, 1500);
                }).catch(() => {
                    alert('Не удалось скопировать текст. Попробуйте вручную.');
                });
            }
            ta.remove();
        };
        panel.appendChild(copyBtn);

        header.querySelector('#smartway-close').onclick = () => {
            panel.style.display = 'none';
        };

        let isDragging = false;
        let offsetX, offsetY;
        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            const rect = panel.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            panel.style.cursor = 'grabbing';
        });
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            let left = e.clientX - offsetX;
            let top = e.clientY - offsetY;
            left = Math.max(10, Math.min(window.innerWidth - panel.offsetWidth - 10, left));
            top = Math.max(10, Math.min(window.innerHeight - panel.offsetHeight - 10, top));
            panel.style.left = left + 'px';
            panel.style.top = top + 'px';
            panel.style.right = 'auto';
        });
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                panel.style.cursor = 'default';
            }
        });

        document.body.appendChild(panel);
        if (!cachedData) {
            cachedData = parsePageData();
        }
    }

    // ---------- ГЕНЕРАЦИЯ КАРТОЧКИ ----------
    function generateCard(type) {
        const contentArea = document.getElementById('smartway-content');
        if (!contentArea) return;
        if (!cachedData) {
            cachedData = parsePageData();
        }
        const data = cachedData;
        if (!data) {
            contentArea.textContent = '❌ Не удалось извлечь данные';
            lastCardText = '';
            return;
        }
        contentArea.textContent = '⏳ Загрузка...';
        lastCardText = '';
        setTimeout(() => {
            let cardText = '';
            const { link, fullName, dateString, phone, citizenship, email, costCenter, shortCompanies,
                passportRF, foreignPassports, isRussian } = data;

            function formatPassports(passports) {
                if (!passports || passports.length === 0) return '';
                let result = '';
                passports.forEach((p, index) => {
                    if (index > 0) result += '\n---\n';
                    result += p.marker + ':\n';
                    result += p.surname + '\n' + p.name;
                    if (p.patronymic) result += '\n' + p.patronymic;
                    result += '\n' + p.number + '\n' + p.expiry;
                });
                return result;
            }

            if (type === 'standard') {
                if (isRussian) {
                    cardText = `${link}\n\n${fullName}\n${dateString}\n${phone}\n${passportRF}\n\n${shortCompanies}`;
                    if (costCenter) cardText += `\n\nЦЗ: **${costCenter}**`;
                } else {
                    let foreignPart = '';
                    if (foreignPassports.length > 0) {
                        foreignPart = '\n\n' + formatPassports(foreignPassports);
                    } else {
                        foreignPart = '\n\nПаспорт иностранного гр-на не найден';
                    }
                    cardText = `${link}\n\n${fullName}\n${dateString}\n${phone}\n\n${citizenship}${foreignPart}\n\n${shortCompanies}`;
                    if (costCenter) cardText += `\n\nЦЗ: **${costCenter}**`;
                }
            } else if (type === 'rail') {
                let foreignPart = '';
                if (foreignPassports.length > 0) {
                    foreignPart = '\n\n' + formatPassports(foreignPassports);
                } else {
                    foreignPart = '\n\nЗагран.паспорт не найден';
                }
                cardText = `${link}\n\n${fullName}\n${dateString}\n${phone}`;
                if (!isRussian) {
                    cardText += `\n\n${citizenship}`;
                }
                cardText += foreignPart + `\n\n${shortCompanies}`;
                if (costCenter) cardText += `\n\nЦЗ: **${costCenter}**`;
            } else if (type === 'insurance') {
                let foreignPart = '';
                if (foreignPassports.length > 0) {
                    foreignPart = '\n\n' + formatPassports(foreignPassports);
                } else {
                    foreignPart = '\n\nЗагран.паспорт не найден';
                }
                cardText = `${link}\n\n${fullName}\n${dateString}\n${phone}`;
                if (isRussian) {
                    cardText += `\n${passportRF}`;
                } else {
                    cardText += `\n\n${citizenship}`;
                }
                cardText += `\n\nEmail: ${email}` + foreignPart + `\n\n${shortCompanies}`;
                if (costCenter) cardText += `\n\nЦЗ: **${costCenter}**`;
            }

            lastCardText = cardText;
            contentArea.textContent = cardText;
            console.log('📋 Текст для копирования сохранён, длина:', lastCardText.length);
        }, 50);
    }

    // ---------- ОТКРЫТИЕ ПО КЛАВИШАМ ----------
    function openPanelAndGenerate(type) {
        let panel = document.getElementById('smartway-panel');
        if (!panel) {
            createPanel();
            panel = document.getElementById('smartway-panel');
        } else {
            panel.style.display = 'block';
        }
        if (!cachedData) {
            cachedData = parsePageData();
        }
        const btn = document.querySelector(`#smartway-panel .type-btn[data-type="${type}"]`);
        if (btn) btn.click();
    }

    // ---------- ГОРЯЧИЕ КЛАВИШИ ----------
    function hotkeyHandler(e) {
        if (e.ctrlKey && !e.altKey && !e.shiftKey) {
            const key = e.key;
            if (key === '1') {
                e.preventDefault();
                e.stopPropagation();
                openPanelAndGenerate('standard');
                return;
            }
            if (key === '2') {
                e.preventDefault();
                e.stopPropagation();
                openPanelAndGenerate('rail');
                return;
            }
            if (key === '3') {
                e.preventDefault();
                e.stopPropagation();
                openPanelAndGenerate('insurance');
                return;
            }
        }
    }

    function setupHotkeys() {
        window.removeEventListener('keydown', hotkeyHandler);
        document.removeEventListener('keydown', hotkeyHandler);
        window.addEventListener('keydown', hotkeyHandler, true);
        document.addEventListener('keydown', hotkeyHandler, true);
    }

    // ---------- ИНИЦИАЛИЗАЦИЯ ----------
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            createToggleButton();
            setupHotkeys();
        });
    } else {
        createToggleButton();
        setupHotkeys();
    }

})();
