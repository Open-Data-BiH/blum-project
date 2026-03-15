export const initLineDetailTabs = (): void => {
    const root = document.getElementById('line-detail');
    if (!root) {
        return;
    }

    const activateDirection = (targetId: string): void => {
        root.querySelectorAll<HTMLElement>('.ldp-direction-tab[data-direction-target]').forEach((tab) => {
            const isActive = tab.getAttribute('data-direction-target') === targetId;
            tab.classList.toggle('is-active', isActive);
            tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        root.querySelectorAll<HTMLElement>('.ldp-direction-panel[data-direction-panel]').forEach((panel) => {
            const isActive = panel.getAttribute('data-direction-panel') === targetId;
            panel.classList.toggle('is-active', isActive);
            panel.hidden = !isActive;
        });
    };

    const activateDay = (panel: Element, dayKey: string): void => {
        panel.querySelectorAll<HTMLElement>('.ldp-day-tab[data-day-target]').forEach((tab) => {
            const isActive = tab.getAttribute('data-day-target') === dayKey;
            tab.classList.toggle('is-active', isActive);
            tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        panel.querySelectorAll<HTMLElement>('.ldp-day-panel[data-day-panel]').forEach((dayPanel) => {
            const isActive = dayPanel.getAttribute('data-day-panel') === dayKey;
            dayPanel.classList.toggle('is-active', isActive);
            dayPanel.hidden = !isActive;
        });
    };

    root.querySelectorAll<HTMLElement>('.ldp-direction-tab[data-direction-target]').forEach((tab) => {
        tab.addEventListener('click', () => {
            const targetId = tab.getAttribute('data-direction-target');
            if (targetId) {
                activateDirection(targetId);
            }
        });
    });

    root.querySelectorAll<HTMLElement>('.ldp-direction-panel[data-direction-panel]').forEach((panel) => {
        const defaultDayTab = panel.querySelector<HTMLElement>('.ldp-day-tab.is-active[data-day-target]');
        if (defaultDayTab) {
            const defaultDay = defaultDayTab.getAttribute('data-day-target');
            if (defaultDay) {
                activateDay(panel, defaultDay);
            }
        }

        panel.querySelectorAll<HTMLElement>('.ldp-day-tab[data-day-target]').forEach((tab) => {
            tab.addEventListener('click', () => {
                const targetDay = tab.getAttribute('data-day-target');
                if (targetDay) {
                    activateDay(panel, targetDay);
                }
            });
        });
    });
};
