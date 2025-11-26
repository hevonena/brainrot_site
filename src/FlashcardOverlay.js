export class FlashcardOverlay {
  constructor(options = {}) {
    this.container = null;
    this.flashcards = [];
    this.options = {
      metersPerCard: options.metersPerCard || 10,
      cardLifetimeMeters: options.cardLifetimeMeters || 1.0,
      cardDistances: options.cardDistances || null,
      // Animation phases as percentages of cardLifetimeMeters
      questionEnterEnd: options.questionEnterEnd || 0.15, // Question finishes entering at 15%
      answerEnterStart: options.answerEnterStart || 0.15, // Answer starts entering at 15%
      answerEnterEnd: options.answerEnterEnd || 0.35, // Answer finishes entering at 35%
      exitStart: options.exitStart || 0.70, // Both start exiting at 70%
      // Vertical positions (from bottom of screen)
      questionRestY: options.questionRestY || 0.55, // Question rests at 55% from bottom
      answerRestY: options.answerRestY || 0.35, // Answer rests at 35% from bottom (below question visually)
      ...options
    };

    this.cardDistances = this.options.cardDistances;
    this.navigator = null;
    this.activeCards = new Map();

    // Question templates
    this.questionTemplates = [
      (title) => `Sooo what's the deal with ${title}?`,
      (title) => `Okay but what even is ${title}?`,
      (title) => `Wait, ${title}? What's that about?`,
      (title) => `Can someone explain ${title} to me?`,
      (title) => `${title}... like what does that even mean?`,
      (title) => `Hmm ${title}, what's the tea on that?`,
      (title) => `So about ${title}...`,
      (title) => `Real talk, what is ${title}?`
    ];
  }

  async init() {
    await this.loadFlashcards();
    this.createUI();
  }

  async loadFlashcards() {
    try {
      const response = await fetch('/flashcards.json');
      this.flashcards = await response.json();
      console.log(`Loaded ${this.flashcards.length} flashcards`);
    } catch (error) {
      console.error('Error loading flashcards:', error);
      this.flashcards = [];
    }
  }

  createUI() {
    this.container = document.createElement('div');
    this.container.className = 'flashcard-overlay';
    document.body.appendChild(this.container);
  }

  connectNavigator(navigator) {
    this.navigator = navigator;
    this.navigator.on('rotate', () => this.handleDistanceUpdate());
  }

  handleDistanceUpdate() {
    if (!this.navigator) return;

    const distanceInMeters = this.navigator.getDistanceInMeters();
    const currentDistance = distanceInMeters.total;

    for (let cardIndex = 0; cardIndex < this.flashcards.length; cardIndex++) {
      let spawnDistance, disappearDistance;

      if (this.cardDistances && cardIndex < this.cardDistances.length) {
        spawnDistance = this.cardDistances[cardIndex];
        disappearDistance = spawnDistance + this.options.cardLifetimeMeters;
      } else {
        spawnDistance = cardIndex * this.options.metersPerCard;
        disappearDistance = spawnDistance + this.options.cardLifetimeMeters;
      }

      const shouldBeActive = currentDistance >= spawnDistance && currentDistance < disappearDistance;
      const isActive = this.activeCards.has(cardIndex);

      if (shouldBeActive && !isActive) {
        this.spawnCard(cardIndex, spawnDistance);
      } else if (!shouldBeActive && isActive) {
        this.removeCard(cardIndex);
      }

      if (this.activeCards.has(cardIndex)) {
        this.updateCardPosition(cardIndex, currentDistance);
      }
    }
  }

  getQuestionText(title) {
    const template = this.questionTemplates[Math.floor(Math.random() * this.questionTemplates.length)];
    return template(title);
  }

  // Easing function for smooth animations
  easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  easeInCubic(t) {
    return t * t * t;
  }

  createTailSvg() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 20 20');
    svg.setAttribute('class', 'imessage-tail');

    // iMessage-style curved tail path
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M0,0 C0,8 4,14 20,17 Q8,17 0,8 Z');
    path.setAttribute('fill', 'currentColor');

    svg.appendChild(path);
    return svg;
  }

  spawnCard(cardIndex, spawnDistance) {
    const flashcard = this.flashcards[cardIndex];
    if (!flashcard) return;

    const cardContainer = document.createElement('div');
    cardContainer.className = 'imessage-container';
    cardContainer.dataset.cardIndex = cardIndex;

    const question = document.createElement('p');
    question.className = 'imessage-bubble imessage-question';
    question.textContent = this.getQuestionText(flashcard.title);
    question.appendChild(this.createTailSvg());

    const answer = document.createElement('p');
    answer.className = 'imessage-bubble imessage-answer';
    answer.textContent = flashcard.content;
    answer.appendChild(this.createTailSvg());

    cardContainer.appendChild(question);
    cardContainer.appendChild(answer);
    this.container.appendChild(cardContainer);

    // Store the question text so it doesn't change on scroll
    this.activeCards.set(cardIndex, {
      container: cardContainer,
      question: question,
      answer: answer,
      spawnDistance: spawnDistance,
      questionText: question.textContent
    });

    console.log(`Card ${cardIndex} spawned at ${spawnDistance.toFixed(2)}m`);
  }

  updateCardPosition(cardIndex, currentDistance) {
    const cardState = this.activeCards.get(cardIndex);
    if (!cardState) return;

    const { question, answer, spawnDistance } = cardState;
    const screenHeight = window.innerHeight;
    const lifetime = this.options.cardLifetimeMeters;

    // Calculate progress through this card's lifetime (0 to 1)
    const progress = (currentDistance - spawnDistance) / lifetime;

    // Calculate Y positions based on progress
    const questionY = this.calculateQuestionY(progress, screenHeight);
    const answerY = this.calculateAnswerY(progress, screenHeight);

    // Apply transforms
    question.style.transform = `translateY(${questionY}px)`;
    answer.style.transform = `translateY(${answerY}px)`;
  }

  calculateQuestionY(progress, screenHeight) {
    const { questionEnterEnd, exitStart, questionRestY } = this.options;

    // Rest position (from top of screen)
    const restY = screenHeight * (1 - questionRestY);
    // Start position (below screen)
    const startY = screenHeight + 100;
    // End position (above screen)
    const endY = -200;

    if (progress < questionEnterEnd) {
      // Phase 1: Entering from bottom
      const enterProgress = progress / questionEnterEnd;
      const eased = this.easeOutCubic(enterProgress);
      return startY + (restY - startY) * eased;
    } else if (progress < exitStart) {
      // Phase 2: Holding at rest position
      return restY;
    } else {
      // Phase 3: Exiting to top
      const exitProgress = (progress - exitStart) / (1 - exitStart);
      const eased = this.easeInCubic(exitProgress);
      return restY + (endY - restY) * eased;
    }
  }

  calculateAnswerY(progress, screenHeight) {
    const { answerEnterStart, answerEnterEnd, exitStart, answerRestY, questionRestY } = this.options;

    // Rest position (from top of screen)
    const restY = screenHeight * (1 - answerRestY);
    // Start position (below screen)
    const startY = screenHeight + 100;

    // Calculate the gap between question and answer at rest
    const questionRestPx = screenHeight * (1 - questionRestY);
    const gapAtRest = restY - questionRestPx;

    // End position: maintain gap from question's end position
    const questionEndY = -200;
    const endY = questionEndY + gapAtRest;

    if (progress < answerEnterStart) {
      // Not yet entering - stay below screen
      return startY;
    } else if (progress < answerEnterEnd) {
      // Phase 1: Entering from bottom
      const enterProgress = (progress - answerEnterStart) / (answerEnterEnd - answerEnterStart);
      const eased = this.easeOutCubic(enterProgress);
      return startY + (restY - startY) * eased;
    } else if (progress < exitStart) {
      // Phase 2: Holding at rest position
      return restY;
    } else {
      // Phase 3: Exiting to top - maintain fixed gap from question
      const exitProgress = (progress - exitStart) / (1 - exitStart);
      const eased = this.easeInCubic(exitProgress);
      return restY + (endY - restY) * eased;
    }
  }

  removeCard(cardIndex) {
    const cardState = this.activeCards.get(cardIndex);
    if (!cardState) return;

    const { container } = cardState;
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }

    this.activeCards.delete(cardIndex);
    console.log(`Card ${cardIndex} removed`);
  }

  destroy() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.activeCards.clear();
  }
}
