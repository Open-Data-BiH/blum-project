import { FetchHelper } from '../../core/fetch-helper.js';
import { debounce, sortLinesByID } from '../../core/utils.js';
import { escapeHTML } from '../../core/sanitize.js';
import { AppI18n } from '../../core/i18n.js';
import { LINE_CONFIG, lineManager } from './line-manager.js';

let realTimetableData = null;
let timetableLanguageListenerAdded = false;
let timeHighlightInterval = null;

function setupTimetableSelection() {
    const lineSelect = document.getElementById('line-select');
    const timetableDisplay = document.getElementById('timetable-display');

    if (!lineSelect || !timetableDisplay) {
        return;
    }

    const timetablePromises = [];

    for (const [lineType, config] of Object.entries(LINE_CONFIG)) {
        if (config.enabled && config.timetableFile) {
            timetablePromises.push(
                FetchHelper.fetchJSON(config.timetableFile)
                    .then((data) => {
                        const timetableArray = data[lineType] || data;
                        if (!Array.isArray(timetableArray)) {
                            console.warn(`Timetable data for ${lineType} is not an array:`, timetableArray);
                            return [];
                        }
                        return timetableArray.map((timetable) => ({ ...timetable, lineType }));
                    })
                    .catch((error) => {
                        console.warn(`Failed to load timetables for ${lineType}:`, error);
                        return [];
                    }),
            );
        }
    }

    Promise.all(timetablePromises)
        .then((timetableArrays) => {
            realTimetableData = timetableArrays.flat();
            updateTimetableSelect(null, lineSelect, realTimetableData);

            lineSelect.addEventListener('change', function () {
                if (this.value) {
                    loadTimetable(this.value);
                } else {
                    const welcomeMessage =
                        AppI18n.safeGet(AppI18n.translations, AppI18n.currentLang, 'sections', 'timetable', 'welcome') ||
                        (AppI18n.currentLang === 'bhs'
                            ? 'Redovi voznje ce biti prikazani nakon izbora linije.'
                            : 'Timetables will be displayed after selecting a line.');
                    timetableDisplay.innerHTML = `<p class="timetable-welcome">${welcomeMessage}</p>`;
                }
            });

            if (!timetableLanguageListenerAdded) {
                document.addEventListener('languageChanged', () => {
                    if (realTimetableData) {
                        updateTimetableSelect(null, lineSelect, realTimetableData);
                    }

                    if (lineSelect.value) {
                        loadTimetable(lineSelect.value);
                    }
                });
                timetableLanguageListenerAdded = true;
            }

            const savedLine = sessionStorage.getItem('selectedLine');
            if (savedLine) {
                lineSelect.value = savedLine;
                loadTimetable(savedLine);
                sessionStorage.removeItem('selectedLine');
            } else {
                const welcomeMessage =
                    AppI18n.safeGet(AppI18n.translations, AppI18n.currentLang, 'sections', 'timetable', 'welcome') ||
                    (AppI18n.currentLang === 'bhs'
                        ? 'Redovi voznje ce biti prikazani nakon izbora linije.'
                        : 'Timetables will be displayed after selecting a line.');
                timetableDisplay.innerHTML = `<p class="timetable-welcome">${welcomeMessage}</p>`;
            }
        })
        .catch((error) => {
            console.error('Error loading timetable data:', error);
            const errorMessage =
                AppI18n.safeGet(AppI18n.translations, AppI18n.currentLang, 'ui', 'error') ||
                'Failed to load timetable data. Please try again later.';
            const retryText = AppI18n.safeGet(AppI18n.translations, AppI18n.currentLang, 'ui', 'retry') || 'Retry';
            timetableDisplay.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${errorMessage}</p>
                    <button class="retry-btn" type="button">
                        ${retryText}
                    </button>
                </div>
            `;
            timetableDisplay.querySelector('.retry-btn').addEventListener('click', setupTimetableSelection);
        });
}

function updateTimetableSelect(_data, lineSelect, timetableData) {
    const selectPrompt =
        AppI18n.safeGet(AppI18n.translations, AppI18n.currentLang, 'sections', 'timetable', 'select') ||
        'Select a bus line';
    lineSelect.innerHTML = `<option value="">${selectPrompt}</option>`;

    if (timetableData && timetableData.length > 0) {
        const linesByType = {};

        timetableData.forEach((line) => {
            const lineType = line.lineType || 'urban';
            if (!linesByType[lineType]) {
                linesByType[lineType] = [];
            }
            linesByType[lineType].push(line);
        });

        Object.keys(linesByType).forEach((lineType) => {
            linesByType[lineType].sort(sortLinesByID);
        });

        Object.keys(linesByType).forEach((lineType) => {
            const lines = linesByType[lineType];
            if (lines.length > 0) {
                const optgroup = document.createElement('optgroup');

                const configuredTitle = lineManager.getTypeTitle(lineType, AppI18n.currentLang);
                optgroup.label =
                    configuredTitle === lineType
                        ? lineType.charAt(0).toUpperCase() + lineType.slice(1) + ' Lines'
                        : configuredTitle;

                lines.forEach((line) => {
                    const option = document.createElement('option');
                    option.value = line.lineId;
                    option.textContent = `${line.lineName[AppI18n.currentLang] || line.lineName.en}`;
                    optgroup.appendChild(option);
                });

                lineSelect.appendChild(optgroup);
            }
        });
    }
}

function loadTimetable(lineId) {
    const timetableDisplay = document.getElementById('timetable-display');
    const loadingText =
        AppI18n.safeGet(AppI18n.translations, AppI18n.currentLang, 'sections', 'timetable', 'loading') ||
        'Loading timetable...';
    timetableDisplay.innerHTML = `<p>${loadingText}</p>`;

    if (realTimetableData) {
        const timetable = realTimetableData.find((t) => t.lineId === lineId);

        if (timetable) {
            renderTimetable(timetable, timetableDisplay);
            return;
        }
    }

    let timetableFile = null;

    for (const [lineType, config] of Object.entries(LINE_CONFIG)) {
        if (config.enabled && lineManager && lineManager.getLines(lineType)) {
            const lines = lineManager.getLines(lineType);
            const lineExists = lines.some((line) => line.lineId === lineId);
            if (lineExists) {
                timetableFile = config.timetableFile;
                break;
            }
        }
    }

    if (!timetableFile) {
        timetableFile = 'data/transport/timetables/urban_timetables.json';
    }

    FetchHelper.fetchJSON(timetableFile)
        .then((data) => {
            realTimetableData = data;

            const timetable = data.find((t) => t.lineId === lineId);

            if (timetable) {
                renderTimetable(timetable, timetableDisplay);
            } else {
                const notFoundText =
                    AppI18n.safeGet(AppI18n.translations, AppI18n.currentLang, 'sections', 'timetable', 'notFound') ||
                    'Timetable not found for the selected line.';
                timetableDisplay.innerHTML = `<p>${notFoundText}</p>`;
            }
        })
        .catch((error) => {
            console.error('Error loading timetable:', error);
            const errorMessage =
                AppI18n.safeGet(AppI18n.translations, AppI18n.currentLang, 'ui', 'error') ||
                'Failed to load timetable data. Please try again later.';
            const retryText = AppI18n.safeGet(AppI18n.translations, AppI18n.currentLang, 'ui', 'retry') || 'Retry';
            timetableDisplay.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${errorMessage}</p>
                    <button class="retry-btn" type="button">
                        ${retryText}
                    </button>
                </div>
            `;
            timetableDisplay.querySelector('.retry-btn').addEventListener('click', () => loadTimetable(lineId));
        });
}

function getTodayDayType() {
    const day = new Date().getDay(); // JS standard: 0=Sunday, 1=Mon, ..., 6=Saturday
    if (day === 0) return 'sunday';
    if (day === 6) return 'saturday';
    return 'weekday';
}

function renderTimetable(timetable, container) {
    const todayDayType = getTodayDayType();
    const t = AppI18n.safeGet(AppI18n.translations, AppI18n.currentLang, 'sections', 'timetable');
    const timetableDays = t ? t.days : null;
    const weekdayLabel = (timetableDays && timetableDays.weekday) || 'Weekdays';
    const saturdayLabel = (timetableDays && timetableDays.saturday) || 'Saturday';
    const sundayHolidayLabelText =
        (timetableDays && timetableDays.sundayHoliday) ||
        (AppI18n.currentLang === 'bhs' ? 'Nedjelja i praznik' : 'Sunday and Holiday');
    const relationLabelText = (t && t.relationLabel) || (AppI18n.currentLang === 'bhs' ? 'Relacija' : 'Direction');
    const timetableForLabelText = (t && t.timetableForLabel) || (AppI18n.currentLang === 'bhs' ? 'Red voznje' : 'Schedule');
    const hourLabel = (t && t.hourLabel) || (AppI18n.currentLang === 'bhs' ? 'Sat' : 'Hour');
    const minutesLabel = (t && t.minutesLabel) || (AppI18n.currentLang === 'bhs' ? 'Minute' : 'Minutes');
    const swapDirectionLabel = AppI18n.currentLang === 'bhs' ? 'Zamijeni smjer' : 'Swap direction';

    const directionAId = timetable.lineId + 'a';
    const directionBId = timetable.lineId + 'b';

    let html = `
        <div class="timetable-controls">
            <div class="timetable-control-row">
                <div class="direction-toggle">
                    <p id="direction-label" class="timetable-control-label">${relationLabelText}</p>
                    <div class="direction-buttons-wrapper">
                        <div class="direction-buttons" role="group" aria-labelledby="direction-label">
                            <button class="direction-btn active" data-direction="${escapeHTML(directionAId)}" aria-pressed="true" aria-label="${escapeHTML(timetable.directions[AppI18n.currentLang][0])}">${escapeHTML(timetable.directions[AppI18n.currentLang][0])}</button>
                            <button class="direction-btn" data-direction="${escapeHTML(directionBId)}" aria-pressed="false" aria-label="${escapeHTML(timetable.directions[AppI18n.currentLang][1])}">${escapeHTML(timetable.directions[AppI18n.currentLang][1])}</button>
                        </div>
                        <button class="direction-swap-btn" aria-label="${swapDirectionLabel}" title="${swapDirectionLabel}">
                            <i class="fas fa-exchange-alt"></i>
                        </button>
                    </div>
                </div>

                <div class="day-toggle">
                    <p id="day-label" class="timetable-control-label">${timetableForLabelText}</p>
                    <div class="day-buttons" role="group" aria-labelledby="day-label">
                        <button class="day-btn${todayDayType === 'weekday' ? ' active' : ''}" data-day="weekday" aria-pressed="${todayDayType === 'weekday'}" aria-label="${weekdayLabel}">${weekdayLabel}</button>
                        <button class="day-btn${todayDayType === 'saturday' ? ' active' : ''}" data-day="saturday" aria-pressed="${todayDayType === 'saturday'}" aria-label="${saturdayLabel}">${saturdayLabel}</button>
                        <button class="day-btn${todayDayType === 'sunday' ? ' active' : ''}" data-day="sunday" aria-pressed="${todayDayType === 'sunday'}" aria-label="${sundayHolidayLabelText}">${sundayHolidayLabelText}</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    if (timetable.notes && timetable.notes[AppI18n.currentLang]) {
        html += `
            <div class="timetable-notes">
                <div class="notes-icon">
                    <i class="fas fa-info-circle"></i>
                </div>
                <div class="notes-content">
                    <strong>${AppI18n.currentLang === 'bhs' ? 'Napomene:' : 'Notes:'}</strong>
                    <p>${escapeHTML(timetable.notes[AppI18n.currentLang])}</p>
                </div>
            </div>
        `;
    }

    html += `<div class="timetable-container">`;

    const dayTypes = ['weekday', 'saturday', 'sunday'];
    const directions = [directionAId, directionBId];

    dayTypes.forEach((dayType) => {
        directions.forEach((direction, dirIndex) => {
            const isActive = dayType === todayDayType && dirIndex === 0 ? '' : 'style="display: none;"';
            const tableId = `timetable-${dayType}-${direction}`;

            html += `
                <div class="timetable-view" id="${tableId}" ${isActive}>
                    <table class="hours-minutes-table">
                        <thead>
                            <tr>
                                <th>${hourLabel}</th>
                                <th>${minutesLabel}</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            let allDepartures = [];

            timetable.stations.forEach((station) => {
                const directionIndex = dirIndex;
                const stationTimes = station.times[dayType][directionIndex];
                stationTimes.forEach((time) => {
                    allDepartures.push(time);
                });
            });

            allDepartures = [...new Set(allDepartures)].sort();

            const departuresByHour = {};
            allDepartures.forEach((time) => {
                const [hour, minute] = time.split(':');
                if (!departuresByHour[hour]) {
                    departuresByHour[hour] = [];
                }
                departuresByHour[hour].push(minute);
            });

            const now = new Date();
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();

            let nextDepartureHour = null;
            let nextDepartureMinute = null;

            Object.keys(departuresByHour)
                .sort()
                .forEach((hour) => {
                    const hourValue = parseInt(hour, 10);
                    if (nextDepartureHour !== null) {
                        return;
                    }

                    if (hourValue > currentHour) {
                        nextDepartureHour = hourValue;
                        nextDepartureMinute = Math.min(...departuresByHour[hour].map((m) => parseInt(m, 10)));
                        return;
                    }

                    if (hourValue === currentHour) {
                        const sortedMinutes = departuresByHour[hour].map((m) => parseInt(m, 10)).sort((a, b) => a - b);

                        for (const minute of sortedMinutes) {
                            if (minute >= currentMinute) {
                                nextDepartureHour = hourValue;
                                nextDepartureMinute = minute;
                                break;
                            }
                        }
                    }
                });

            Object.keys(departuresByHour)
                .sort()
                .forEach((hour) => {
                    const minutes = departuresByHour[hour].sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
                    const hourValue = parseInt(hour, 10);

                    const isCurrentHour = hourValue === currentHour;
                    const rowClass = isCurrentHour ? 'current-hour' : '';
                    const rowId = isCurrentHour ? `current-hour-row-${dayType}-${direction}` : '';

                    html += `
                    <tr class="${rowClass}" ${rowId ? `id="${rowId}"` : ''} data-hour="${hourValue}">
                        <td class="hour-cell">${hour}</td>
                        <td class="minutes-cell">
                            <div class="minutes-wrapper">
                `;

                    minutes.forEach((minute) => {
                        const minuteValue = parseInt(minute, 10);
                        let timeClass;

                        if (hourValue < currentHour || (hourValue === currentHour && minuteValue < currentMinute)) {
                            timeClass = 'past';
                        } else if (hourValue === nextDepartureHour && minuteValue === nextDepartureMinute) {
                            timeClass = 'next';
                        } else {
                            timeClass = 'upcoming';
                        }

                        html += `<span class="minute-box ${timeClass}" data-minute="${minuteValue}">${minute}</span>`;
                    });

                    html += `
                            </div>
                        </td>
                    </tr>
                `;
                });

            html += `
                        </tbody>
                    </table>
                </div>
            `;
        });
    });

    html += `</div>`;
    container.innerHTML = html;

    document.querySelectorAll('.direction-btn').forEach((button) => {
        button.addEventListener('click', function () {
            document.querySelectorAll('.direction-btn').forEach((btn) => {
                btn.classList.remove('active');
                btn.setAttribute('aria-pressed', 'false');
            });
            this.classList.add('active');
            this.setAttribute('aria-pressed', 'true');

            const activeDay = document.querySelector('.day-btn.active').getAttribute('data-day');
            const direction = this.getAttribute('data-direction');

            document.querySelectorAll('.timetable-view').forEach((view) => {
                view.style.display = 'none';
            });

            document.getElementById(`timetable-${activeDay}-${direction}`).style.display = 'block';

            updateTimeHighlighting();
            scrollToCurrentHour();
        });
    });

    const swapBtn = document.querySelector('.direction-swap-btn');
    if (swapBtn) {
        swapBtn.addEventListener('click', () => {
            const directionBtns = document.querySelectorAll('.direction-btn');
            if (directionBtns.length === 2) {
                const inactiveBtn = Array.from(directionBtns).find((btn) => !btn.classList.contains('active'));
                if (inactiveBtn) {
                    inactiveBtn.click();
                }
            }
        });
    }

    document.querySelectorAll('.day-btn').forEach((button) => {
        button.addEventListener('click', function () {
            document.querySelectorAll('.day-btn').forEach((btn) => {
                btn.classList.remove('active');
                btn.setAttribute('aria-pressed', 'false');
            });
            this.classList.add('active');
            this.setAttribute('aria-pressed', 'true');

            const activeDirection = document.querySelector('.direction-btn.active').getAttribute('data-direction');
            const day = this.getAttribute('data-day');

            document.querySelectorAll('.timetable-view').forEach((view) => {
                view.style.display = 'none';
            });

            document.getElementById(`timetable-${day}-${activeDirection}`).style.display = 'block';

            updateTimeHighlighting();
            scrollToCurrentHour();
        });
    });

    setupTimeHighlighting();
    setTimeout(scrollToCurrentHour, 100);
}

const setupTimeHighlighting = () => {
    if (timeHighlightInterval) {
        clearInterval(timeHighlightInterval);
    }

    updateTimeHighlighting();

    const debouncedUpdate = debounce(updateTimeHighlighting, 300);
    timeHighlightInterval = setInterval(debouncedUpdate, 60000);
};

const scrollToCurrentHour = () => {
    const now = new Date();
    const currentHour = now.getHours();

    let visibleView = document.querySelector('.timetable-view:not([style*="display: none"])');

    if (!visibleView) {
        const allViews = document.querySelectorAll('.timetable-view');
        visibleView = Array.from(allViews).find((view) => {
            const style = window.getComputedStyle(view);
            return style.display !== 'none';
        });
    }

    if (!visibleView) {
        return;
    }

    let targetRow = visibleView.querySelector(`tr[data-hour="${currentHour}"]`);

    if (!targetRow) {
        const allRows = visibleView.querySelectorAll('tbody tr[data-hour]');
        for (const row of allRows) {
            const rowHour = parseInt(row.getAttribute('data-hour'), 10);
            if (rowHour >= currentHour) {
                targetRow = row;
                break;
            }
        }
        if (!targetRow && allRows.length > 0) {
            targetRow = allRows[allRows.length - 1];
        }
    }

    if (targetRow) {
        targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
};

const updateTimeHighlighting = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;

    let visibleTimetableViews = document.querySelectorAll('.timetable-view:not([style*="display: none"])');

    if (visibleTimetableViews.length === 0) {
        visibleTimetableViews = document.querySelectorAll('.timetable-view');
        visibleTimetableViews = Array.from(visibleTimetableViews).filter((view) => {
            const style = window.getComputedStyle(view);
            return style.display !== 'none';
        });
    }

    visibleTimetableViews.forEach((tableView) => {
        tableView.querySelectorAll('tbody tr').forEach((row) => {
            const hourAttr = row.getAttribute('data-hour');
            if (hourAttr !== null) {
                const rowHour = parseInt(hourAttr, 10);
                if (rowHour === currentHour) {
                    row.classList.add('current-hour');
                } else {
                    row.classList.remove('current-hour');
                }
            }
        });

        const allDepartureTimes = [];

        tableView.querySelectorAll('tbody tr').forEach((row) => {
            const hourCell = row.querySelector('.hour-cell');
            if (!hourCell) {
                return;
            }

            const hourValue = parseInt(hourCell.textContent, 10);
            if (isNaN(hourValue)) {
                return;
            }

            row.querySelectorAll('.minute-box').forEach((minuteBox) => {
                const minuteValue = parseInt(minuteBox.textContent, 10);
                if (isNaN(minuteValue)) {
                    return;
                }

                const timeInMinutes = hourValue * 60 + minuteValue;
                allDepartureTimes.push({
                    hour: hourValue,
                    minute: minuteValue,
                    timeInMinutes,
                    element: minuteBox,
                });
            });
        });

        allDepartureTimes.sort((a, b) => a.timeInMinutes - b.timeInMinutes);

        let nextDepartureTime = null;
        for (const time of allDepartureTimes) {
            if (time.timeInMinutes >= currentTimeInMinutes) {
                nextDepartureTime = time;
                break;
            }
        }

        if (!nextDepartureTime && allDepartureTimes.length > 0) {
            nextDepartureTime = allDepartureTimes[0];
        }

        const isNextDepartureTomorrow =
            nextDepartureTime && allDepartureTimes.every((time) => time.timeInMinutes < currentTimeInMinutes);

        allDepartureTimes.forEach((time) => {
            time.element.classList.remove('past', 'next', 'upcoming');

            if (time.timeInMinutes < currentTimeInMinutes) {
                if (isNextDepartureTomorrow && nextDepartureTime && time.timeInMinutes === nextDepartureTime.timeInMinutes) {
                    time.element.classList.add('next');
                } else if (isNextDepartureTomorrow) {
                    time.element.classList.add('upcoming');
                } else {
                    time.element.classList.add('past');
                }
            } else if (nextDepartureTime && time.timeInMinutes === nextDepartureTime.timeInMinutes) {
                time.element.classList.add('next');
            } else {
                time.element.classList.add('upcoming');
            }
        });
    });
};

document.addEventListener('mapBusLineSelected', (event) => {
    const lineId = event.detail?.lineId;
    if (!lineId) {
        return;
    }

    const lineSelect = document.getElementById('line-select');
    if (!lineSelect) {
        return;
    }

    lineSelect.value = lineId.toUpperCase();
    lineSelect.dispatchEvent(new Event('change', { bubbles: true }));

    const timetableElement = document.getElementById('timetable');
    if (timetableElement) {
        timetableElement.scrollIntoView({ behavior: 'smooth' });
    }
});

export { setupTimetableSelection, loadTimetable };

