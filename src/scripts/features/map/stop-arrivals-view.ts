import type { Language } from '../../core/i18n';
import { escapeHtml } from '../../core/utils';
import { getLineColor, type TransitIndex } from '../../../lib/transit';
import type { TimetableEntry } from '../../../types/timetable';
import type { TransitStop } from '../../../types/transit';
import { lineAccentStyle } from './map-core';
import {
    formatEstimatedClock,
    getDirectionDestination,
    getStopArrivalEstimates,
    type StopArrivalEstimate,
} from './arrival-estimates';

interface StopArrivalsLabels {
    heading: string;
    towards: string;
    directionUnavailable: string;
    unavailable: string;
    noMoreToday: string;
    tomorrow: string;
    nextArrival: string;
    afterThat: string;
    disclaimer: string;
    showRoute: string;
    openLine: string;
    estimatedArrival: string;
}

const getLabels = (language: Language): StopArrivalsLabels =>
    language === 'bhs'
        ? {
              heading: 'Sljedeći dolasci',
              towards: 'prema',
              directionUnavailable: 'Smjer nije dostupan',
              unavailable: 'Procjena trenutno nije dostupna',
              noMoreToday: 'Nema više polazaka danas',
              tomorrow: 'sutra',
              nextArrival: 'Sljedeći',
              afterThat: 'Nakon toga',
              disclaimer:
                  'Procijenjena vremena na osnovu reda vožnje i očekivanog vremena vožnje do ovog stajališta. Stvarni dolazak može odstupati.',
              showRoute: 'Prikaži trasu',
              openLine: 'Otvori stranicu linije',
              estimatedArrival: 'Procijenjeni dolazak',
          }
        : {
              heading: 'Next arrivals',
              towards: 'towards',
              directionUnavailable: 'Direction unavailable',
              unavailable: 'Estimate is currently unavailable',
              noMoreToday: 'No more departures today',
              tomorrow: 'tomorrow',
              nextArrival: 'Next',
              afterThat: 'After that',
              disclaimer:
                  'Estimated from the timetable and expected travel time to this stop. The actual arrival may differ.',
              showRoute: 'Show route',
              openLine: 'Open line page',
              estimatedArrival: 'Estimated arrival',
          };

const formatLocalDateTime = (date: Date): string => {
    const datePart = [date.getFullYear(), date.getMonth() + 1, date.getDate()]
        .map((value, index) => String(value).padStart(index === 0 ? 4 : 2, '0'))
        .join('-');
    return `${datePart}T${formatEstimatedClock(date)}`;
};

const renderTimes = (estimate: StopArrivalEstimate, labels: StopArrivalsLabels): string => {
    if (estimate.status === 'no-more-today') {
        return `<span class="stop-arrival__status">${escapeHtml(labels.noMoreToday)}</span>`;
    }
    if (estimate.status === 'unavailable' || estimate.arrivals.length === 0) {
        return `<span class="stop-arrival__status">${escapeHtml(labels.unavailable)}</span>`;
    }

    return `<span class="stop-arrival__times">
        ${estimate.arrivals
            .map((arrival, position) => {
                const clock = formatEstimatedClock(arrival.at);
                const tomorrow = arrival.dayOffset > 0;
                const sequenceLabel = position === 0 ? labels.nextArrival : labels.afterThat;
                const accessible = `${sequenceLabel}: ${labels.estimatedArrival} ${clock}${tomorrow ? `, ${labels.tomorrow}` : ''}`;
                return `<span class="stop-arrival__time${position > 0 ? ' stop-arrival__time--secondary' : ''}" aria-label="${escapeHtml(accessible)}">
                    <span class="stop-arrival__time-label" aria-hidden="true">${escapeHtml(sequenceLabel)}</span>
                    <span class="stop-arrival__time-value">
                        <span aria-hidden="true">~</span><time datetime="${formatLocalDateTime(arrival.at)}">${clock}</time>
                        ${tomorrow ? `<span class="stop-arrival__day">${escapeHtml(labels.tomorrow)}</span>` : ''}
                    </span>
                </span>`;
            })
            .join('')}
    </span>`;
};

const renderRow = (
    estimate: StopArrivalEstimate,
    index: TransitIndex,
    language: Language,
    labels: StopArrivalsLabels,
    getLineHref: (lineId: string) => string,
    canSelectRoute: boolean,
): string => {
    const destination = getDirectionDestination(
        estimate.timetable,
        estimate.directionIndex,
        language,
        estimate.route?.destination ?? null,
    );
    const destinationText = destination
        ? `<span class="stop-arrival__destination">${escapeHtml(destination)}</span>`
        : `<span class="stop-arrival__destination stop-arrival__destination--missing">${escapeHtml(labels.directionUnavailable)}</span>`;
    const selectsRoute = estimate.route !== null && canSelectRoute;
    const routeId = selectsRoute ? estimate.route?.id : null;
    const action = selectsRoute ? labels.showRoute : labels.openLine;
    const statusText =
        estimate.status === 'estimated'
            ? estimate.arrivals
                  .map((arrival, position) => {
                      const clock = formatEstimatedClock(arrival.at);
                      const sequenceLabel = position === 0 ? labels.nextArrival : labels.afterThat;
                      return `${sequenceLabel}: ${labels.estimatedArrival} ${clock}${arrival.dayOffset > 0 ? ` ${labels.tomorrow}` : ''}`;
                  })
                  .join('. ')
            : estimate.status === 'no-more-today'
              ? labels.noMoreToday
              : labels.unavailable;
    const directionText = destination ? `${labels.towards} ${destination}` : labels.directionUnavailable;
    const ariaLabel = `${estimate.lineId}, ${directionText}. ${statusText}. ${action}.`;
    const style = lineAccentStyle(getLineColor(index, estimate.lineId));
    const content = `
        <span class="stop-arrival__badge">${escapeHtml(estimate.lineId)}</span>
        <span class="stop-arrival__content">
            ${destinationText}
            ${renderTimes(estimate, labels)}
        </span>
        <i class="fas ${selectsRoute ? 'fa-chevron-right' : 'fa-arrow-up-right-from-square'} stop-arrival__action" aria-hidden="true"></i>
    `;

    return routeId
        ? `<button type="button" class="stop-arrival" data-route-id="${escapeHtml(routeId)}" style="${style}" aria-label="${escapeHtml(ariaLabel)}">${content}</button>`
        : `<a class="stop-arrival" href="${escapeHtml(getLineHref(estimate.lineId))}" style="${style}" aria-label="${escapeHtml(ariaLabel)}">${content}</a>`;
};

export interface RenderStopArrivalsOptions {
    index: TransitIndex;
    timetables: TimetableEntry[];
    stop: TransitStop;
    language: Language;
    getLineHref: (lineId: string) => string;
    now?: Date;
    canSelectRoute?: boolean;
}

export const renderStopArrivals = ({
    index,
    timetables,
    stop,
    language,
    getLineHref,
    now = new Date(),
    canSelectRoute = true,
}: RenderStopArrivalsOptions): string => {
    const labels = getLabels(language);
    const estimates = getStopArrivalEstimates(index, timetables, stop, now);

    return `<section class="stop-arrivals" aria-label="${escapeHtml(labels.heading)}">
        <p class="stop-arrivals__heading" role="heading" aria-level="3">${escapeHtml(labels.heading)}</p>
        <div class="stop-arrivals__list">
            ${estimates
                .map((estimate) => renderRow(estimate, index, language, labels, getLineHref, canSelectRoute))
                .join('')}
        </div>
        <p class="stop-arrivals__disclaimer">
            <i class="fas fa-circle-info" aria-hidden="true"></i>
            <span>${escapeHtml(labels.disclaimer)}</span>
        </p>
    </section>`;
};
