/**
 * FAQ Component
 * Handles loading and displaying FAQ content with accordion functionality
 */

class FAQComponent extends BaseComponent {
    constructor() {
        super('faq-content');
        this.faqData = null;
        this.handleContainerClick = this.handleContainerClick.bind(this);
        this.handleContainerKeydown = this.handleContainerKeydown.bind(this);
        this.listenersBound = false;
    }

    /**
     * Initialize the FAQ component
     */
    async init() {
        try {
            await this.loadFAQData();
            this.render();
            this.setupEventListeners();
        } catch (error) {
            console.error('Error initializing FAQ component:', error);
            this.renderError();
        }
    }

    /**
     * Load FAQ data from JSON file
     */
    async loadFAQData() {
        try {
            this.faqData = await FetchHelper.fetchJSON('data/transport/faq.json');
        } catch (error) {
            console.error('Error loading FAQ data:', error);
            throw error;
        }
    }

    /**
     * Render the FAQ component
     */
    render() {
        if (!this.container) {
            console.error('FAQ container not found');
            return;
        }

        if (!this.faqData || !this.faqData.categories) {
            this.renderError();
            return;
        }

        const faqHTML = `
            <div class="faq-container">
                <div class="faq-categories">
                    ${this.faqData.categories.map(category => this.renderCategory(category)).join('')}
                </div>
            </div>
        `;

        this.container.innerHTML = faqHTML;
    }

    /**
     * Render a single FAQ category
     */
    renderCategory(category) {
        const title = category.title[this.currentLang] || category.title.bhs;
        const questions = category.questions || [];

        return `
            <div class="faq-category" data-category-id="${category.id}">
                <h3 class="faq-category__title">${this.escapeHtml(title)}</h3>
                <div class="faq-questions">
                    ${questions.map(question => this.renderQuestion(question, category.id)).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Render a single FAQ question/answer pair
     */
    renderQuestion(question, categoryId) {
        const questionText = question.question[this.currentLang] || question.question.bhs;
        const answerText = question.answer[this.currentLang] || question.answer.bhs;

        return `
            <div class="faq-item" data-question-id="${question.id}" data-category-id="${categoryId}">
                <button class="faq-question" aria-expanded="false" aria-controls="answer-${question.id}">
                    <span class="faq-question__text">${this.escapeHtml(questionText)}</span>
                    <i class="faq-question__icon fas fa-chevron-down" aria-hidden="true"></i>
                </button>
                <div class="faq-answer" id="answer-${question.id}" aria-hidden="true">
                    <div class="faq-answer__content">
                        <p>${this.escapeHtml(answerText)}</p>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Set up event listeners for FAQ interactions
     */
    setupEventListeners() {
        if (!this.container) { return; }

        if (this.listenersBound) { return; }

        this.container.addEventListener('click', this.handleContainerClick);
        this.container.addEventListener('keydown', this.handleContainerKeydown);
        this.listenersBound = true;
    }

    /**
     * Handle click events from FAQ container
     */
    handleContainerClick(event) {
        const target = event.target instanceof Element ? event.target : event.target?.parentElement;
        const questionButton = target?.closest('.faq-question');
        if (questionButton) {
            event.preventDefault();
            this.toggleQuestion(questionButton);
        }
    }

    /**
     * Handle keyboard events from FAQ container
     */
    handleContainerKeydown(event) {
        const target = event.target instanceof Element ? event.target : event.target?.parentElement;
        const questionButton = target?.closest('.faq-question');
        if (questionButton && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            this.toggleQuestion(questionButton);
        }
    }

    /**
     * Toggle a FAQ question/answer pair
     */
    toggleQuestion(questionButton) {
        const faqItem = questionButton.closest('.faq-item');
        const answer = faqItem.querySelector('.faq-answer');
        const isActive = faqItem.classList.contains('active');

        if (isActive) {
            // Close the question
            faqItem.classList.remove('active');
            answer.classList.remove('active');
            questionButton.setAttribute('aria-expanded', 'false');
            answer.setAttribute('aria-hidden', 'true');
        } else {
            // Open the question
            faqItem.classList.add('active');
            answer.classList.add('active');
            questionButton.setAttribute('aria-expanded', 'true');
            answer.setAttribute('aria-hidden', 'false');

            // Smooth scroll to question if it's not fully visible
            setTimeout(() => {
                this.scrollToQuestion(faqItem);
            }, 300); // Wait for animation to start
        }
    }

    /**
     * Scroll to question if needed
     */
    scrollToQuestion(faqItem) {
        const rect = faqItem.getBoundingClientRect();
        const isVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;

        if (!isVisible) {
            faqItem.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    }

    /**
     * Update language and re-render
     */
    updateLanguage(newLang) {
        super.updateLanguage(newLang);
        if (this.faqData) {
            this.render();
        }
    }

    /**
     * Render loading state - override to customize message
     */
    renderLoading() {
        const message = this.currentLang === 'en' ? 'Loading FAQ...' : 'Učitavanje FAQ-a...';
        super.renderLoading(message);
    }

    /**
     * Render error state - override to customize message
     */
    renderError() {
        const errorMessage = this.currentLang === 'en'
            ? 'Sorry, we could not load the FAQ content at this time. Please try again later.'
            : 'Izvinjavam se, nismo mogli učitati FAQ sadržaj u ovom trenutku. Molimo pokušajte kasnije.';
        super.renderError(errorMessage);
    }

    /**
     * Close all open questions
     */
    closeAllQuestions() {
        if (!this.container) { return; }

        const activeItems = this.container.querySelectorAll('.faq-item.active');
        activeItems.forEach(item => {
            const questionButton = item.querySelector('.faq-question');
            this.toggleQuestion(questionButton);
        });
    }

    /**
     * Open a specific question by ID
     */
    openQuestion(questionId) {
        if (!this.container) { return; }

        const questionItem = this.container.querySelector(`[data-question-id="${questionId}"]`);
        if (questionItem && !questionItem.classList.contains('active')) {
            const questionButton = questionItem.querySelector('.faq-question');
            this.toggleQuestion(questionButton);
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FAQComponent;
}

// Make available globally
window.FAQComponent = FAQComponent; 
