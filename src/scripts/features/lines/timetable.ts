// Timetable — ported from js/features/lines/timetable.js
// Key changes:
//   - FetchHelper.fetchJSON → fetch().then(r => r.json())
//   - Translations resolved via safeGet(getTranslations(), getCurrentLanguage(), ...)
//   - TypeScript types added throughout

import { debounce, escapeHtml, sortLinesByID, withBase } from '../../core/utils';
import { safeGet, getTranslations, getCurrentLanguage } from '../../core/i18n';
import { LINE_CONFIG, getLineTypeTitle } from './line-config';
import { isReducedScheduleDay } from './school-holidays';
import type { TimetableEntry } from '../../../types/timetable';

let realTimetableData: (TimetableEntry & { lineType: string })[] | null = null;
let timetableLanguageListenerAdded = false;
let mapBusLineListenerAdded = false;
let timeHighlightInterval: ReturnType<typeof setInterval> | null = null;

// ─── escapeHTML helper (no DOMPurify dependency in TS modules) ──────────────

const escapeHTML = (text: string | number | null | undefined): string =>
    escapeHtml(text === null || text === undefined ? '' : String(text));

// ─── Public entry point ─────────────────────────────────────────────────────

export function setupTimetableSelection(): void {
    const lineSelect = document.getElementById('line-select') as HTMLSelectElement | null;
    const timetableDisplay = document.getElementById('timetable-display');

    if (!lineSelect || !timetableDisplay) {
        return;
    }

    const timetablePromises: Promise<(TimetableEntry & { lineType: string })[]>[] = [];

    for (const [lineType, config] of Object.entries(LINE_CONFIG)) {
        if (config.enabled && config.timetableFile) {
            timetablePromises.push(
                fetch(config.timetableFile)
                    .then((r) => r.json())
                    .then((data) => {
                        const timetableArray: TimetableEntry[] = data[lineType] || data;
                        if (!Array.isArray(timetableArray)) {
                            console.warn(`Timetable data for ${lineType} is not an array:`, timetableArray);
                            return [];
                        }
                        return timetableArray.map((t) => ({ ...t, lineType }));
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
            updateTimetableSelect(lineSelect, realTimetableData);

            if (lineSelect.dataset.timetableChangeBound !== 'true') {
                lineSelect.addEventListener('change', function (this: HTMLSelectElement) {
                    if (this.value) {
                        loadTimetable(this.value);
                    } else {
                        const lang = getCurrentLanguage();
                        const welcomeMessage =
                            safeGet(getTranslations(), lang, 'sections', 'timetable', 'welcome') ||
                            (lang === 'bhs'
                                ? 'Redovi vožnje će biti prikazani nakon izbora linije.'
                                : 'Timetables will be displayed after selecting a line.');
                        timetableDisplay.innerHTML = `<p class="timetable-welcome">${welcomeMessage}</p>`;
                    }
                });
                lineSelect.dataset.timetableChangeBound = 'true';
            }

            if (!timetableLanguageListenerAdded) {
                document.addEventListener('languageChanged', () => {
                    if (realTimetableData) {
                        updateTimetableSelect(lineSelect, realTimetableData);
                    }
                    if (lineSelect.value) {
                        loadTimetable(lineSelect.value);
                    }
                });
                timetableLanguageListenerAdded = true;
            }

            if (!mapBusLineListenerAdded) {
                document.addEventListener('mapBusLineSelected', (event) => {
                    const lineId = (event as CustomEvent<{ lineId?: string }>).detail?.lineId;
                    if (!lineId) {
                        return;
                    }
                    lineSelect.value = lineId.toUpperCase();
                    lineSelect.dispatchEvent(new Event('change', { bubbles: true }));
                    document.getElementById('timetable')?.scrollIntoView({ behavior: 'smooth' });
                });
                mapBusLineListenerAdded = true;
            }

            const savedLine = sessionStorage.getItem('selectedLine');
            if (savedLine) {
                lineSelect.value = savedLine;
                loadTimetable(savedLine);
                sessionStorage.removeItem('selectedLine');
            } else {
                const lang = getCurrentLanguage();
                const welcomeMessage =
                    safeGet(getTranslations(), lang, 'sections', 'timetable', 'welcome') ||
                    (lang === 'bhs'
                        ? 'Redovi vožnje će biti prikazani nakon izbora linije.'
                        : 'Timetables will be displayed after selecting a line.');
                timetableDisplay.innerHTML = `<p class="timetable-welcome">${welcomeMessage}</p>`;
            }
        })
        .catch((error) => {
            console.error('Error loading timetable data:', error);
            const lang = getCurrentLanguage();
            const errorMessage =
                safeGet(getTranslations(), lang, 'ui', 'error') ||
                'Failed to load timetable data. Please try again later.';
            const retryText = safeGet(getTranslations(), lang, 'ui', 'retry') || 'Retry';
            timetableDisplay.innerHTML = `
        <div class="error-message">
          <i class="fas fa-exclamation-triangle"></i>
          <p>${errorMessage}</p>
          <button class="retry-btn" type="button">${retryText}</button>
        </div>
      `;
            timetableDisplay
                .querySelector<HTMLButtonElement>('.retry-btn')
                ?.addEventListener('click', setupTimetableSelection);
        });
}

// ─── Select population ──────────────────────────────────────────────────────

function updateTimetableSelect(
    lineSelect: HTMLSelectElement,
    timetableData: (TimetableEntry & { lineType: string })[],
): void {
    const lang = getCurrentLanguage();
    const selectPrompt = safeGet(getTranslations(), lang, 'sections', 'timetable', 'select') || 'Select a bus line';
    lineSelect.innerHTML = `<option value="">${selectPrompt}</option>`;

    if (!timetableData || timetableData.length === 0) {
        return;
    }

    const linesByType: Record<string, (TimetableEntry & { lineType: string })[]> = {};
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
        if (lines.length === 0) {
            return;
        }

        const optgroup = document.createElement('optgroup');
        const configuredTitle = getLineTypeTitle(lineType, lang);
        optgroup.label =
            configuredTitle === lineType
                ? lineType.charAt(0).toUpperCase() + lineType.slice(1) + ' Lines'
                : configuredTitle;

        lines.forEach((line) => {
            const option = document.createElement('option');
            option.value = line.lineId;
            option.textContent = line.lineName[lang] || line.lineName.en;
            optgroup.appendChild(option);
        });

        lineSelect.appendChild(optgroup);
    });
}

// ─── Load single timetable ──────────────────────────────────────────────────

export function loadTimetable(lineId: string): void {
    const timetableDisplay = document.getElementById('timetable-display');
    if (!timetableDisplay) {
        return;
    }

    const lang = getCurrentLanguage();
    const loadingText = safeGet(getTranslations(), lang, 'sections', 'timetable', 'loading') || 'Loading timetable...';
    timetableDisplay.innerHTML = `<p>${loadingText}</p>`;

    if (realTimetableData) {
        const timetable = realTimetableData.find((t) => t.lineId === lineId);
        if (timetable) {
            renderTimetable(timetable, timetableDisplay);
            return;
        }
    }

    const resolvedLineType = realTimetableData?.find((t) => t.lineId === lineId)?.lineType ?? 'urban';
    const timetableFile = LINE_CONFIG[resolvedLineType]?.timetableFile ?? withBase('data/transport/timetables/urban_timetables.json');

    fetch(timetableFile)
        .then((r) => r.json())
        .then((data) => {
            const rawArray: TimetableEntry[] = data[resolvedLineType] || data;
            const loaded = Array.isArray(rawArray) ? rawArray.map((t) => ({ ...t, lineType: resolvedLineType })) : [];
            realTimetableData = loaded;
            const timetable = loaded.find((t) => t.lineId === lineId);
            if (timetable) {
                renderTimetable(timetable, timetableDisplay);
            } else {
                const notFoundText =
                    safeGet(getTranslations(), lang, 'sections', 'timetable', 'notFound') ||
                    'Timetable not found for the selected line.';
                timetableDisplay.innerHTML = `<p>${notFoundText}</p>`;
            }
        })
        .catch((error) => {
            console.error('Error loading timetable:', error);
            const errorMessage =
                safeGet(getTranslations(), lang, 'ui', 'error') ||
                'Failed to load timetable data. Please try again later.';
            const retryText = safeGet(getTranslations(), lang, 'ui', 'retry') || 'Retry';
            timetableDisplay.innerHTML = `
        <div class="error-message">
          <i class="fas fa-exclamation-triangle"></i>
          <p>${errorMessage}</p>
          <button class="retry-btn" type="button">${retryText}</button>
        </div>
      `;
            timetableDisplay
                .querySelector<HTMLButtonElement>('.retry-btn')
                ?.addEventListener('click', () => loadTimetable(lineId));
        });
}

// ─── Day type ───────────────────────────────────────────────────────────────

function getTodayDayType(): 'weekday' | 'saturday' | 'sunday' {
    const day = new Date().getDay(); // 0=Sunday, 6=Saturday
    if (day === 0) {
        return 'sunday';
    }
    if (day === 6) {
        return 'saturday';
    }
    return 'weekday';
}

// ─── Render timetable ───────────────────────────────────────────────────────

function renderTimetable(timetable: TimetableEntry & { lineType?: string }, container: HTMLElement): void {
    const todayDayType = getTodayDayType();
    const lang = getCurrentLanguage();
    const reducedToday = isReducedScheduleDay();
    const hasReducedData = timetable.stations.some(
        (s) => s.times.weekdayReduced ?? s.times.saturdayReduced ?? s.times.sundayReduced,
    );
    const showingReduced = reducedToday && hasReducedData;
    const t = safeGet<Record<string, unknown>>(getTranslations(), lang, 'sections', 'timetable');
    const timetableDays = t?.days && typeof t.days === 'object' ? (t.days as Record<string, string>) : null;

    const weekdayLabel = timetableDays?.weekday || 'Weekdays';
    const saturdayLabel = timetableDays?.saturday || 'Saturday';
    const sundayHolidayFull =
        timetableDays?.sundayHoliday || (lang === 'bhs' ? 'Nedjelja i praznik' : 'Sunday & Holiday');
    const sundayHolidayShort = lang === 'bhs' ? 'Ned. / praznik' : 'Sun / Holiday';
    const relationLabelText =
        (typeof t?.relationLabel === 'string' ? t.relationLabel : null) || (lang === 'bhs' ? 'Relacija' : 'Direction');
    const timetableForLabelText =
        (typeof t?.timetableForLabel === 'string' ? t.timetableForLabel : null) ||
        (lang === 'bhs' ? 'Red vožnje' : 'Schedule');
    const hourLabel = (typeof t?.hourLabel === 'string' ? t.hourLabel : null) || (lang === 'bhs' ? 'Sat' : 'Hour');
    const minutesLabel =
        (typeof t?.minutesLabel === 'string' ? t.minutesLabel : null) || (lang === 'bhs' ? 'Minute' : 'Minutes');
    const swapDirectionLabel = lang === 'bhs' ? 'Zamijeni smjer' : 'Swap direction';

    const directions = timetable.directions;
    const directionAId = timetable.lineId + 'a';
    const directionBId = timetable.lineId + 'b';

    let html = `
    <div class="timetable-controls">
      <div class="timetable-control-row">
        <div class="direction-toggle">
          <p id="direction-label" class="timetable-control-label">${relationLabelText}</p>
          <div class="direction-buttons-wrapper">
            <div class="direction-buttons" role="group" aria-labelledby="direction-label">
              <button class="direction-btn active" data-direction="${escapeHTML(directionAId)}" aria-pressed="true" aria-label="${escapeHTML(directions[lang][0] ?? directions.bhs[0] ?? '')}">${escapeHTML(directions[lang][0] ?? directions.bhs[0] ?? '')}</button>
              <button class="direction-btn" data-direction="${escapeHTML(directionBId)}" aria-pressed="false" aria-label="${escapeHTML(directions[lang][1] ?? directions.bhs[1] ?? '')}">${escapeHTML(directions[lang][1] ?? directions.bhs[1] ?? '')}</button>
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
            <button class="day-btn${todayDayType === 'sunday' ? ' active' : ''}" data-day="sunday" aria-pressed="${todayDayType === 'sunday'}" aria-label="${sundayHolidayFull}"><span class="day-label-full">${sundayHolidayFull}</span><span class="day-label-short">${sundayHolidayShort}</span></button>
          </div>
        </div>
      </div>
    </div>
  `;

    const notes = timetable.notes;
    if (notes?.[lang]) {
        html += `
      <div class="timetable-notes">
        <div class="notes-icon"><i class="fas fa-info-circle"></i></div>
        <div class="notes-content">
          <strong>${lang === 'bhs' ? 'Napomene:' : 'Notes:'}</strong>
          <p>${escapeHTML(notes[lang])}</p>
        </div>
      </div>
    `;
    }

    if (showingReduced) {
        const reducedLabel =
            lang === 'bhs'
                ? 'Prikazan redukovani red vožnje (školski raspust)'
                : 'Showing reduced schedule (school holidays)';
        html += `
      <div class="timetable-reduced-notice">
        <i class="fas fa-calendar-alt"></i>
        <span>${reducedLabel}</span>
      </div>
    `;
    }

    html += `<div class="timetable-container">`;

    const dayTypes: ('weekday' | 'saturday' | 'sunday')[] = ['weekday', 'saturday', 'sunday'];
    const directionIds = [directionAId, directionBId];

    dayTypes.forEach((dayType) => {
        directionIds.forEach((direction, dirIndex) => {
            const isActive = dayType === todayDayType && dirIndex === 0 ? '' : 'style="display: none;"';
            const tableId = `timetable-${dayType}-${direction}`;

            html += `
        <div class="timetable-view" id="${tableId}" ${isActive}>
          <table class="hours-minutes-table">
            <thead><tr><th>${hourLabel}</th><th>${minutesLabel}</th></tr></thead>
            <tbody>
      `;

            type Departure = { timeStr: string; note: string | null };
            const seen = new Set<string>();
            const allDepartures: Departure[] = [];
            const reducedKey = `${dayType}Reduced` as keyof (typeof timetable.stations)[0]['times'];
            timetable.stations.forEach((station) => {
                const reduced = showingReduced ? station.times[reducedKey] : undefined;
                const stationTimes = (reduced ?? station.times[dayType])[dirIndex];
                stationTimes.forEach((t) => {
                    const timeStr = typeof t === 'string' ? t : t.time;
                    const note = typeof t === 'string' ? null : t.note;
                    const key = note ? `${timeStr}|${note}` : timeStr;
                    if (!seen.has(key)) {
                        seen.add(key);
                        allDepartures.push({ timeStr, note });
                    }
                });
            });
            allDepartures.sort((a, b) => a.timeStr.localeCompare(b.timeStr));

            const departuresByHour: Record<string, Departure[]> = {};
            allDepartures.forEach(({ timeStr, note }) => {
                const [hour, minute] = timeStr.split(':');
                if (!departuresByHour[hour]) {
                    departuresByHour[hour] = [];
                }
                departuresByHour[hour].push({ timeStr: minute, note });
            });

            const now = new Date();
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();

            let nextDepartureHour: number | null = null;
            let nextDepartureMinute: number | null = null;

            Object.keys(departuresByHour)
                .sort()
                .forEach((hour) => {
                    if (nextDepartureHour !== null) {
                        return;
                    }
                    const hourValue = parseInt(hour, 10);
                    if (hourValue > currentHour) {
                        nextDepartureHour = hourValue;
                        nextDepartureMinute = Math.min(...departuresByHour[hour].map((d) => parseInt(d.timeStr, 10)));
                        return;
                    }
                    if (hourValue === currentHour) {
                        const sortedMinutes = departuresByHour[hour]
                            .map((d) => parseInt(d.timeStr, 10))
                            .sort((a, b) => a - b);
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
                    const departures = departuresByHour[hour].sort(
                        (a, b) => parseInt(a.timeStr, 10) - parseInt(b.timeStr, 10),
                    );
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

                    departures.forEach(({ timeStr: minute, note }) => {
                        const minuteValue = parseInt(minute, 10);
                        let timeClass: string;
                        if (hourValue < currentHour || (hourValue === currentHour && minuteValue < currentMinute)) {
                            timeClass = 'past';
                        } else if (hourValue === nextDepartureHour && minuteValue === nextDepartureMinute) {
                            timeClass = 'next';
                        } else {
                            timeClass = 'upcoming';
                        }
                        const noteHtml = note ? `<sup class="time-note">${escapeHTML(note)}</sup>` : '';
                        html += `<span class="minute-box ${timeClass}" data-minute="${minuteValue}">${minute}${noteHtml}</span>`;
                    });

                    html += `</div></td></tr>`;
                });

            html += `</tbody></table></div>`;
        });
    });

    html += `</div>`;

    const noteDescriptions = timetable.noteDescriptions;
    if (noteDescriptions && Object.keys(noteDescriptions).length > 0) {
        html += `<div class="timetable-note-descriptions">`;
        Object.entries(noteDescriptions).forEach(([key, desc]) => {
            const text = desc[lang as 'bhs' | 'en'] ?? desc.en;
            html += `<p><sup class="time-note time-note--legend">${escapeHTML(key)}</sup>${escapeHTML(text)}</p>`;
        });
        html += `</div>`;
    }

    container.innerHTML = html;

    // ── Direction button handlers ────────────────────────────────────────────
    container.querySelectorAll<HTMLElement>('.direction-btn').forEach((button) => {
        button.addEventListener('click', function (this: HTMLElement) {
            container.querySelectorAll<HTMLElement>('.direction-btn').forEach((btn) => {
                btn.classList.remove('active');
                btn.setAttribute('aria-pressed', 'false');
            });
            this.classList.add('active');
            this.setAttribute('aria-pressed', 'true');

            const activeDay =
                container.querySelector<HTMLElement>('.day-btn.active')?.getAttribute('data-day') ?? 'weekday';
            const direction = this.getAttribute('data-direction') ?? '';

            container.querySelectorAll<HTMLElement>('.timetable-view').forEach((v) => (v.style.display = 'none'));
            const target = container.querySelector<HTMLElement>(`#timetable-${activeDay}-${direction}`);
            if (target) {
                target.style.display = 'block';
            }

            updateTimeHighlighting();
            scrollToCurrentHour();
        });
    });

    const swapBtn = container.querySelector<HTMLElement>('.direction-swap-btn');
    swapBtn?.addEventListener('click', () => {
        const directionBtns = container.querySelectorAll<HTMLElement>('.direction-btn');
        if (directionBtns.length === 2) {
            const inactiveBtn = Array.from(directionBtns).find((btn) => !btn.classList.contains('active'));
            inactiveBtn?.click();
        }
    });

    // ── Day button handlers ──────────────────────────────────────────────────
    container.querySelectorAll<HTMLElement>('.day-btn').forEach((button) => {
        button.addEventListener('click', function (this: HTMLElement) {
            container.querySelectorAll<HTMLElement>('.day-btn').forEach((btn) => {
                btn.classList.remove('active');
                btn.setAttribute('aria-pressed', 'false');
            });
            this.classList.add('active');
            this.setAttribute('aria-pressed', 'true');

            const activeDirection =
                container.querySelector<HTMLElement>('.direction-btn.active')?.getAttribute('data-direction') ??
                directionAId;
            const day = this.getAttribute('data-day') ?? 'weekday';

            container.querySelectorAll<HTMLElement>('.timetable-view').forEach((v) => (v.style.display = 'none'));
            const target = container.querySelector<HTMLElement>(`#timetable-${day}-${activeDirection}`);
            if (target) {
                target.style.display = 'block';
            }

            updateTimeHighlighting();
            scrollToCurrentHour();
        });
    });

    setupTimeHighlighting();
    setTimeout(scrollToCurrentHour, 100);
}

// ─── Time highlighting ──────────────────────────────────────────────────────

const setupTimeHighlighting = (): void => {
    if (timeHighlightInterval) {
        clearInterval(timeHighlightInterval);
    }
    updateTimeHighlighting();
    const debouncedUpdate = debounce(updateTimeHighlighting, 300);
    timeHighlightInterval = setInterval(debouncedUpdate, 60000);
};

const scrollToCurrentHour = (): void => {
    const currentHour = new Date().getHours();

    let visibleView = document.querySelector<HTMLElement>('.timetable-view:not([style*="display: none"])');
    if (!visibleView) {
        visibleView =
            Array.from(document.querySelectorAll<HTMLElement>('.timetable-view')).find(
                (v) => window.getComputedStyle(v).display !== 'none',
            ) ?? null;
    }
    if (!visibleView) {
        return;
    }

    let targetRow = visibleView.querySelector<HTMLElement>(`tr[data-hour="${currentHour}"]`);
    if (!targetRow) {
        const allRows = visibleView.querySelectorAll<HTMLElement>('tbody tr[data-hour]');
        for (const row of allRows) {
            if (parseInt(row.getAttribute('data-hour') ?? '0', 10) >= currentHour) {
                targetRow = row;
                break;
            }
        }
        if (!targetRow && allRows.length > 0) {
            targetRow = allRows[allRows.length - 1];
        }
    }
    targetRow?.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

const updateTimeHighlighting = (): void => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;

    let visibleViews = Array.from(
        document.querySelectorAll<HTMLElement>('.timetable-view:not([style*="display: none"])'),
    );
    if (visibleViews.length === 0) {
        visibleViews = Array.from(document.querySelectorAll<HTMLElement>('.timetable-view')).filter(
            (v) => window.getComputedStyle(v).display !== 'none',
        );
    }

    visibleViews.forEach((tableView) => {
        // Update current-hour row class
        tableView.querySelectorAll<HTMLElement>('tbody tr').forEach((row) => {
            const hourAttr = row.getAttribute('data-hour');
            if (hourAttr !== null) {
                const rowHour = parseInt(hourAttr, 10);
                row.classList.toggle('current-hour', rowHour === currentHour);
            }
        });

        // Collect all departure times from this view
        const allDepartureTimes: { hour: number; minute: number; timeInMinutes: number; element: HTMLElement }[] = [];
        tableView.querySelectorAll<HTMLElement>('tbody tr').forEach((row) => {
            const hourCell = row.querySelector<HTMLElement>('.hour-cell');
            if (!hourCell) {
                return;
            }
            const hourValue = parseInt(hourCell.textContent ?? '', 10);
            if (isNaN(hourValue)) {
                return;
            }

            row.querySelectorAll<HTMLElement>('.minute-box').forEach((minuteBox) => {
                const minuteValue = parseInt(minuteBox.getAttribute('data-minute') ?? minuteBox.textContent ?? '', 10);
                if (isNaN(minuteValue)) {
                    return;
                }
                allDepartureTimes.push({
                    hour: hourValue,
                    minute: minuteValue,
                    timeInMinutes: hourValue * 60 + minuteValue,
                    element: minuteBox,
                });
            });
        });

        allDepartureTimes.sort((a, b) => a.timeInMinutes - b.timeInMinutes);

        let nextDepartureTime: (typeof allDepartureTimes)[0] | null = null;
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
            nextDepartureTime !== null && allDepartureTimes.every((time) => time.timeInMinutes < currentTimeInMinutes);

        allDepartureTimes.forEach((time) => {
            time.element.classList.remove('past', 'next', 'upcoming');

            if (time.timeInMinutes < currentTimeInMinutes) {
                if (
                    isNextDepartureTomorrow &&
                    nextDepartureTime &&
                    time.timeInMinutes === nextDepartureTime.timeInMinutes
                ) {
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
