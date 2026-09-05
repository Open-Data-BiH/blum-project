import { debounce, escapeHtml, sortLinesByID, withBase } from '../../core/utils';
import { safeGet, getTranslations, getCurrentLanguage } from '../../core/i18n';
import { renderRouteRelation } from '../../core/route-relation';
import { formatSpokenRouteRelation } from '../../../lib/route-relation';
import { LINE_CONFIG, getLineTypeTitle } from './line-config';
import { isReducedScheduleDay } from './school-holidays';
import {
    findNextServiceDay,
    formatServiceDate,
    getTimetableDay,
    getUpcomingServiceDays,
    type TimetableDay,
    type TimetableServiceDay,
} from './timetable-day';
import { getUniqueSortedDepartures, parseTimeToMinutes } from '../../../lib/timetable-departures';
import type { TimetableEntry, TimetableTime } from '../../../types/timetable';

let realTimetableData: (TimetableEntry & { lineType: string })[] | null = null;
let timetableLanguageListenerAdded = false;
let mapBusLineListenerAdded = false;
let timeHighlightInterval: ReturnType<typeof setInterval> | null = null;

const escapeHTML = (text: string | number | null | undefined): string =>
    escapeHtml(text === null || text === undefined ? '' : String(text));

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
                        sessionStorage.removeItem('selectedLine');
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
    const timetableFile =
        LINE_CONFIG[resolvedLineType]?.timetableFile ?? withBase('data/transport/timetables/urban_timetables.json');

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

export function renderTimetable(timetable: TimetableEntry & { lineType?: string }, container: HTMLElement): void {
    const now = new Date();
    const todayDayType = getTimetableDay(now);
    const lang = getCurrentLanguage();
    const hasReducedData = timetable.stations.some(
        (s) => s.times.weekdayReduced ?? s.times.saturdayReduced ?? s.times.sundayReduced,
    );
    const t = safeGet<Record<string, unknown>>(getTranslations(), lang, 'sections', 'timetable');
    const timetableDays = t?.days && typeof t.days === 'object' ? (t.days as Record<string, string>) : null;

    const weekdayLabel = timetableDays?.weekday || 'Weekdays';
    const saturdayLabel = timetableDays?.saturday || 'Saturday';
    const sundayHolidayFull =
        timetableDays?.sundayHoliday || (lang === 'bhs' ? 'Nedjelja i praznik' : 'Sunday & Holiday');
    const directionLabelText = lang === 'bhs' ? 'Smjer' : 'Direction';
    const timetableForLabelText =
        (typeof t?.timetableForLabel === 'string' ? t.timetableForLabel : null) ||
        (lang === 'bhs' ? 'Red vožnje' : 'Schedule');
    const hourLabel = (typeof t?.hourLabel === 'string' ? t.hourLabel : null) || (lang === 'bhs' ? 'Sat' : 'Hour');
    const minutesLabel =
        (typeof t?.minutesLabel === 'string' ? t.minutesLabel : null) || (lang === 'bhs' ? 'Minute' : 'Minutes');
    const swapDirectionLabel = lang === 'bhs' ? 'Zamijeni smjer' : 'Swap direction';

    const directions = timetable.directions;
    const directionA = directions[lang][0] ?? directions.bhs[0] ?? '';
    const directionB = directions[lang][1] ?? directions.bhs[1] ?? '';
    const directionALabel = lang === 'bhs' ? 'Smjer A' : 'Direction A';
    const directionBLabel = lang === 'bhs' ? 'Smjer B' : 'Direction B';
    const relationLabels = {
        toLabel: lang === 'bhs' ? 'prema' : 'to',
        viaLabel: lang === 'bhs' ? 'preko' : 'via',
    };
    const directionAId = timetable.lineId + 'a';
    const directionBId = timetable.lineId + 'b';
    const dayTypes: TimetableDay[] = ['weekday', 'saturday', 'sunday'];
    const directionIds = [directionAId, directionBId];
    const dayLabelByType = {
        weekday: weekdayLabel,
        saturday: saturdayLabel,
        sunday: sundayHolidayFull,
    };
    const noServiceTitleText = lang === 'bhs' ? 'Linija ne saobraća ovaj dan' : 'Line does not operate on this day';
    const noServiceBodyPrefix = lang === 'bhs' ? 'Nema planiranih polazaka za' : 'No departures are scheduled for';
    const noServiceLabelSuffix =
        lang === 'bhs' ? ' - linija ne saobraća ovaj dan' : ' - line does not operate on this day';
    const noServiceHintText = lang === 'bhs' ? 'linija ne saobraća' : 'line does not operate';

    type Departure = { timeStr: string; note: string | null };
    const departureCache = new Map<string, Departure[]>();

    const collectDepartures = (dayType: TimetableDay, dirIndex: number, useReduced: boolean): Departure[] => {
        const cacheKey = `${dayType}-${dirIndex}-${useReduced ? 'reduced' : 'regular'}`;
        const cached = departureCache.get(cacheKey);
        if (cached) {
            return cached;
        }

        const stationDayTimes: TimetableTime[] = [];
        const reducedKey = `${dayType}Reduced` as keyof (typeof timetable.stations)[0]['times'];

        timetable.stations.forEach((station) => {
            const reduced = useReduced ? station.times[reducedKey] : undefined;
            const stationTimes = (reduced ?? station.times[dayType])[dirIndex] ?? [];
            stationDayTimes.push(...stationTimes);
        });

        const departures = getUniqueSortedDepartures(stationDayTimes).map(({ time, note }) => ({
            timeStr: time,
            note,
        }));
        departureCache.set(cacheKey, departures);
        return departures;
    };

    const usesReducedSchedule = (serviceDay: TimetableServiceDay): boolean =>
        hasReducedData && isReducedScheduleDay(serviceDay.date);
    const getServiceDepartures = (serviceDay: TimetableServiceDay, dirIndex: number): Departure[] =>
        collectDepartures(serviceDay.day, dirIndex, usesReducedSchedule(serviceDay));
    const findDirectionServiceDay = (date: Date, dirIndex: number): TimetableServiceDay | null =>
        findNextServiceDay(date, (serviceDay, earliestMinute) =>
            getServiceDepartures(serviceDay, dirIndex).some(
                ({ timeStr }) => parseTimeToMinutes(timeStr) >= earliestMinute,
            ),
        );
    const nextServiceByDirection = directionIds.map((_, dirIndex) => findDirectionServiceDay(now, dirIndex));
    const fallbackServiceDay = getUpcomingServiceDays(now, 0)[0] ?? {
        date: now,
        day: todayDayType,
        dayOffset: 0,
    };
    const startServiceDay = nextServiceByDirection[0] ?? fallbackServiceDay;
    const startDayType = startServiceDay.day;
    const upcomingServiceDays = getUpcomingServiceDays(now);
    const serviceDayByView: Record<string, TimetableServiceDay> = {};
    const departuresByView: Record<string, Departure[]> = {};

    dayTypes.forEach((dayType) => {
        directionIds.forEach((_, dirIndex) => {
            const nextDirectionService = nextServiceByDirection[dirIndex];
            const serviceDay =
                nextDirectionService?.day === dayType
                    ? nextDirectionService
                    : (upcomingServiceDays.find((candidate) => candidate.day === dayType) ?? fallbackServiceDay);
            const viewKey = `${dayType}-${dirIndex}`;
            serviceDayByView[viewKey] = serviceDay;
            departuresByView[viewKey] = getServiceDepartures(serviceDay, dirIndex);
        });
    });

    const dayHasService = {
        weekday: directionIds.some((_, dirIndex) => departuresByView[`weekday-${dirIndex}`].length > 0),
        saturday: directionIds.some((_, dirIndex) => departuresByView[`saturday-${dirIndex}`].length > 0),
        sunday: directionIds.some((_, dirIndex) => departuresByView[`sunday-${dirIndex}`].length > 0),
    };
    const showingReduced = usesReducedSchedule(serviceDayByView[`${startDayType}-0`]);
    const buildDayButton = (
        dayType: 'weekday' | 'saturday' | 'sunday',
        labelHtml: string,
        fullLabel: string,
    ): string => {
        const hasService = dayHasService[dayType];
        const buttonClass = `day-btn${startDayType === dayType ? ' active' : ''}${!hasService ? ' is-unavailable' : ''}`;
        const dayAriaLabel = hasService ? fullLabel : `${fullLabel}${noServiceLabelSuffix}`;
        const titleAttr = hasService ? '' : ` title="${escapeHTML(`${fullLabel}: ${noServiceHintText}`)}"`;
        return `<button class="${buttonClass}" data-day="${dayType}" data-has-service="${hasService}" aria-pressed="${startDayType === dayType}" aria-label="${escapeHTML(dayAriaLabel)}"${titleAttr}>${labelHtml}</button>`;
    };

    let html = `
    <div class="timetable-controls">
      <div class="timetable-control-row">
        <div class="direction-toggle">
          <p id="direction-label" class="timetable-control-label">${directionLabelText}</p>
          <div class="direction-buttons-wrapper">
            <div class="direction-buttons" role="group" aria-labelledby="direction-label">
              <button class="direction-btn active" data-direction="${escapeHTML(directionAId)}" aria-pressed="true" aria-label="${escapeHTML(`${directionALabel}: ${formatSpokenRouteRelation(directionA, relationLabels)}`)}">
                <span class="direction-btn__label">${directionALabel}</span>
                <span class="direction-btn__relation">${renderRouteRelation(directionA, relationLabels)}</span>
              </button>
              <button class="direction-btn" data-direction="${escapeHTML(directionBId)}" aria-pressed="false" aria-label="${escapeHTML(`${directionBLabel}: ${formatSpokenRouteRelation(directionB, relationLabels)}`)}">
                <span class="direction-btn__label">${directionBLabel}</span>
                <span class="direction-btn__relation">${renderRouteRelation(directionB, relationLabels)}</span>
              </button>
            </div>
            <button class="direction-swap-btn" aria-label="${swapDirectionLabel}" title="${swapDirectionLabel}">
              <i class="fas fa-exchange-alt"></i>
            </button>
          </div>
        </div>

        <div class="day-toggle">
          <p id="day-label" class="timetable-control-label">${timetableForLabelText}</p>
          <div class="day-buttons" role="group" aria-labelledby="day-label">
            ${buildDayButton('weekday', escapeHTML(weekdayLabel), weekdayLabel)}
            ${buildDayButton('saturday', escapeHTML(saturdayLabel), saturdayLabel)}
            ${buildDayButton('sunday', escapeHTML(sundayHolidayFull), sundayHolidayFull)}
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

    if (hasReducedData) {
        const reducedLabel =
            lang === 'bhs'
                ? 'Prikazan redukovani red vožnje (školski raspust)'
                : 'Showing reduced schedule (school holidays)';
        html += `
      <div class="timetable-reduced-notice"${showingReduced ? '' : ' hidden'}>
        <i class="fas fa-calendar-alt"></i>
        <span>${reducedLabel}</span>
      </div>
    `;
    }

    html += `<div class="timetable-container">`;

    dayTypes.forEach((dayType) => {
        directionIds.forEach((direction, dirIndex) => {
            const isActive = dayType === startDayType && dirIndex === 0 ? '' : 'style="display: none;"';
            const tableId = `timetable-${dayType}-${direction}`;
            const viewKey = `${dayType}-${dirIndex}`;
            const allDepartures = departuresByView[viewKey];
            const serviceDay = serviceDayByView[viewKey];
            const serviceDate = formatServiceDate(serviceDay.date);
            const today = formatServiceDate(now);
            const isCurrentServiceDate = serviceDate === today;
            const isFutureServiceDate = serviceDate > today;
            const reducedAttribute = usesReducedSchedule(serviceDay) ? 'true' : 'false';

            if (allDepartures.length === 0) {
                html += `
        <div class="timetable-view" id="${tableId}" data-service-date="${serviceDate}" data-reduced="${reducedAttribute}" ${isActive}>
          <div class="no-service-message" role="status" aria-live="polite">
            <i class="fas fa-ban" aria-hidden="true"></i>
            <strong>${noServiceTitleText}</strong>
            <p>${noServiceBodyPrefix} ${escapeHTML(dayLabelByType[dayType])}.</p>
          </div>
        </div>
      `;
                return;
            }

            html += `
        <div class="timetable-view" id="${tableId}" data-service-date="${serviceDate}" data-reduced="${reducedAttribute}" ${isActive}>
          <table class="hours-minutes-table">
            <thead><tr><th>${hourLabel}</th><th>${minutesLabel}</th></tr></thead>
            <tbody>
      `;

            const departuresByHour: Record<string, Departure[]> = {};
            allDepartures.forEach(({ timeStr, note }) => {
                const [hour, minute] = timeStr.split(':');
                if (!departuresByHour[hour]) {
                    departuresByHour[hour] = [];
                }
                departuresByHour[hour].push({ timeStr: minute, note });
            });

            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();

            let nextDepartureHour: number | null = null;
            let nextDepartureMinute: number | null = null;

            if (isFutureServiceDate) {
                const firstHour = Object.keys(departuresByHour).sort()[0];
                if (firstHour !== undefined) {
                    nextDepartureHour = parseInt(firstHour, 10);
                    nextDepartureMinute = Math.min(
                        ...departuresByHour[firstHour].map((departure) => parseInt(departure.timeStr, 10)),
                    );
                }
            } else if (isCurrentServiceDate) {
                Object.keys(departuresByHour)
                    .sort()
                    .forEach((hour) => {
                        if (nextDepartureHour !== null) {
                            return;
                        }
                        const hourValue = parseInt(hour, 10);
                        if (hourValue > currentHour) {
                            nextDepartureHour = hourValue;
                            nextDepartureMinute = Math.min(
                                ...departuresByHour[hour].map((departure) => parseInt(departure.timeStr, 10)),
                            );
                            return;
                        }
                        if (hourValue === currentHour) {
                            const sortedMinutes = departuresByHour[hour]
                                .map((departure) => parseInt(departure.timeStr, 10))
                                .sort((a, b) => a - b);
                            nextDepartureMinute = sortedMinutes.find((minute) => minute >= currentMinute) ?? null;
                            if (nextDepartureMinute !== null) {
                                nextDepartureHour = hourValue;
                            }
                        }
                    });
            }

            Object.keys(departuresByHour)
                .sort()
                .forEach((hour) => {
                    const departures = departuresByHour[hour].sort(
                        (a, b) => parseInt(a.timeStr, 10) - parseInt(b.timeStr, 10),
                    );
                    const hourValue = parseInt(hour, 10);
                    const isCurrentHour = isCurrentServiceDate && hourValue === currentHour;
                    const isPastHour = !isFutureServiceDate && (!isCurrentServiceDate || hourValue < currentHour);
                    const rowClass = [isCurrentHour && 'current-hour', isPastHour && 'past-hour']
                        .filter(Boolean)
                        .join(' ');
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
                        if (
                            !isFutureServiceDate &&
                            (!isCurrentServiceDate ||
                                hourValue < currentHour ||
                                (hourValue === currentHour && minuteValue < currentMinute))
                        ) {
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
    let automaticDaySelection = true;

    const setActiveDayButton = (day: TimetableDay): void => {
        container.querySelectorAll<HTMLElement>('.day-btn').forEach((button) => {
            const isActive = button.getAttribute('data-day') === day;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
    };

    const updateReducedNotice = (): void => {
        const activeView = Array.from(container.querySelectorAll<HTMLElement>('.timetable-view')).find(
            (view) => view.style.display !== 'none',
        );
        const notice = container.querySelector<HTMLElement>('.timetable-reduced-notice');
        if (notice) {
            notice.hidden = activeView?.dataset.reduced !== 'true';
        }
    };

    const showTimetableView = (day: TimetableDay, direction: string): void => {
        const targetId = `timetable-${day}-${direction}`;
        container.querySelectorAll<HTMLElement>('.timetable-view').forEach((view) => {
            view.style.display = view.id === targetId ? 'block' : 'none';
        });
        updateReducedNotice();
    };

    const refreshAutomaticSelection = (): void => {
        if (!automaticDaySelection) {
            return;
        }

        const direction =
            container.querySelector<HTMLElement>('.direction-btn.active')?.getAttribute('data-direction') ??
            directionAId;
        const directionIndex = directionIds.indexOf(direction);
        const serviceDay = directionIndex >= 0 ? findDirectionServiceDay(new Date(), directionIndex) : null;
        if (!serviceDay) {
            return;
        }

        const targetView = container.querySelector<HTMLElement>(`#timetable-${serviceDay.day}-${direction}`);
        const needsReducedSchedule = usesReducedSchedule(serviceDay);
        if (targetView && targetView.dataset.reduced !== String(needsReducedSchedule)) {
            renderTimetable(timetable, container);
            if (direction !== directionAId) {
                container.querySelector<HTMLElement>(`.direction-btn[data-direction="${direction}"]`)?.click();
            }
            return;
        }

        if (targetView) {
            targetView.dataset.serviceDate = formatServiceDate(serviceDay.date);
        }
        setActiveDayButton(serviceDay.day);
        showTimetableView(serviceDay.day, direction);
    };

    container.querySelectorAll<HTMLElement>('.direction-btn').forEach((button) => {
        button.addEventListener('click', function (this: HTMLElement) {
            container.querySelectorAll<HTMLElement>('.direction-btn').forEach((btn) => {
                btn.classList.remove('active');
                btn.setAttribute('aria-pressed', 'false');
            });
            this.classList.add('active');
            this.setAttribute('aria-pressed', 'true');

            const direction = this.getAttribute('data-direction') ?? '';
            if (direction) {
                if (automaticDaySelection) {
                    refreshAutomaticSelection();
                } else {
                    const activeDay = (container
                        .querySelector<HTMLElement>('.day-btn.active')
                        ?.getAttribute('data-day') ?? 'weekday') as TimetableDay;
                    showTimetableView(activeDay, direction);
                }
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

    container.querySelectorAll<HTMLElement>('.day-btn').forEach((button) => {
        button.addEventListener('click', function (this: HTMLElement) {
            automaticDaySelection = false;

            const activeDirection =
                container.querySelector<HTMLElement>('.direction-btn.active')?.getAttribute('data-direction') ??
                directionAId;
            const day = (this.getAttribute('data-day') ?? 'weekday') as TimetableDay;

            if (activeDirection) {
                setActiveDayButton(day);
                showTimetableView(day, activeDirection);
            }

            updateTimeHighlighting();
            scrollToCurrentHour();
        });
    });

    setupTimeHighlighting(refreshAutomaticSelection);
    setTimeout(scrollToCurrentHour, 100);
}

const setupTimeHighlighting = (refreshSelection: () => void): void => {
    if (timeHighlightInterval) {
        clearInterval(timeHighlightInterval);
    }
    updateTimeHighlighting();
    const debouncedUpdate = debounce(() => {
        refreshSelection();
        updateTimeHighlighting();
    }, 300);
    timeHighlightInterval = setInterval(debouncedUpdate, 60000);
};

const scrollToCurrentHour = (): void => {
    const now = new Date();
    const currentHour = now.getHours();
    const today = formatServiceDate(now);

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

    const allRows = visibleView.querySelectorAll<HTMLElement>('tbody tr[data-hour]');
    let targetRow =
        (visibleView.dataset.serviceDate ?? today) > today
            ? (allRows[0] ?? null)
            : visibleView.querySelector<HTMLElement>(`tr[data-hour="${currentHour}"]`);

    if (!targetRow) {
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
    const today = formatServiceDate(now);

    let visibleViews = Array.from(
        document.querySelectorAll<HTMLElement>('.timetable-view:not([style*="display: none"])'),
    );
    if (visibleViews.length === 0) {
        visibleViews = Array.from(document.querySelectorAll<HTMLElement>('.timetable-view')).filter(
            (v) => window.getComputedStyle(v).display !== 'none',
        );
    }

    visibleViews.forEach((tableView) => {
        const serviceDate = tableView.dataset.serviceDate ?? today;
        const isToday = serviceDate === today;
        const isFuture = serviceDate > today;

        tableView.querySelectorAll<HTMLElement>('tbody tr').forEach((row) => {
            const hourAttr = row.getAttribute('data-hour');
            if (hourAttr !== null) {
                const rowHour = parseInt(hourAttr, 10);
                const isCurrentHour = isToday && rowHour === currentHour;
                const isPastHour = !isFuture && (!isToday || rowHour < currentHour);
                row.classList.toggle('current-hour', isCurrentHour);
                row.classList.toggle('past-hour', isPastHour);
            }
        });

        const allDepartureTimes: { timeInMinutes: number; element: HTMLElement }[] = [];
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
                    timeInMinutes: hourValue * 60 + minuteValue,
                    element: minuteBox,
                });
            });
        });

        allDepartureTimes.sort((a, b) => a.timeInMinutes - b.timeInMinutes);
        const nextDepartureMinute = isFuture
            ? (allDepartureTimes[0]?.timeInMinutes ?? null)
            : isToday
              ? (allDepartureTimes.find((time) => time.timeInMinutes >= currentTimeInMinutes)?.timeInMinutes ?? null)
              : null;

        allDepartureTimes.forEach((time) => {
            time.element.classList.remove('past', 'next', 'upcoming');

            if (!isFuture && (!isToday || time.timeInMinutes < currentTimeInMinutes)) {
                time.element.classList.add('past');
            } else if (nextDepartureMinute !== null && time.timeInMinutes === nextDepartureMinute) {
                time.element.classList.add('next');
            } else {
                time.element.classList.add('upcoming');
            }
        });
    });
};
