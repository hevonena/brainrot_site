/**
 * IntroSequence - Displays intro bubble before the main scroll experience
 *
 * Features:
 * - Single centered clickable bubble with "I accept brainrot" text
 * - Background auto-scrolls fast during intro
 * - Bubble swept up by feed on click
 */

export class IntroSequence {
  constructor(options = {}) {
    // Configuration - single bubble image
    this.bubbleImage = options.bubbleImage || '/content/bubbles/bubble.svg';
    this.autoScrollSpeed = options.autoScrollSpeed || 60; // pixels per frame
    this.transitionDuration = options.transitionDuration || 2000; // ms for deceleration

    // Single bubble content
    this.finalBubble = options.finalBubble || {
      title: "do you accept brainrot??!"
    };

    // State
    this.isActive = true;
    this.currentSpeed = this.autoScrollSpeed;
    this.autoScrollAnimationId = null;
    this.bubbleElements = [];
    this.infiniteScroll = null;

    // DOM elements
    this.overlay = null;

    // Callbacks
    this.onComplete = options.onComplete || (() => {});

    // Create UI immediately
    this.createUI();
  }

  /**
   * Connect to InfiniteScroll for auto-scroll control
   */
  connectInfiniteScroll(infiniteScroll) {
    this.infiniteScroll = infiniteScroll;
  }

  /**
   * Create the overlay DOM structure
   */
  createUI() {
    // Create overlay container
    this.overlay = document.createElement('div');
    this.overlay.className = 'intro-overlay';
    document.body.appendChild(this.overlay);
  }

  /**
   * Create the bubble element
   */
  createBubbleElement(content) {
    const bubble = document.createElement('div');
    bubble.className = 'intro-bubble';

    // Center position, no rotation
    bubble.style.setProperty('--offset-x', '0vw');
    bubble.style.setProperty('--offset-y', '0vh');
    bubble.style.setProperty('--final-rotation', '0deg');

    // Animation parameters
    bubble.style.setProperty('--anim-duration', '0.6s');
    bubble.style.setProperty('--bounce-scale', '1.15');
    bubble.style.setProperty('--start-rotation', '-15deg');
    bubble.style.setProperty('--mid-rotation', '5deg');

    // Bubble image
    const bubbleImg = document.createElement('img');
    bubbleImg.src = this.bubbleImage;
    bubbleImg.className = 'intro-bubble-image';
    bubbleImg.alt = '';
    bubble.appendChild(bubbleImg);

    // Content container
    const contentDiv = document.createElement('div');
    contentDiv.className = 'intro-bubble-content';

    // Title
    const title = document.createElement('div');
    title.className = 'intro-title';
    title.textContent = content.title;
    contentDiv.appendChild(title);

    bubble.appendChild(contentDiv);

    // Make whole bubble clickable
    bubble.addEventListener('click', () => this.handleAccept());
    bubble.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.handleAccept();
    });

    return bubble;
  }

  /**
   * Start the intro sequence
   */
  start() {
    if (!this.infiniteScroll) {
      console.error('IntroSequence: InfiniteScroll not connected');
      return;
    }

    // Start auto-scroll
    this.startAutoScroll();

    // Show the bubble
    this.showBubble();
  }

  /**
   * Start auto-scrolling the background
   */
  startAutoScroll() {
    const tick = () => {
      if (!this.isActive) return;

      // Increment virtual offset directly on InfiniteScroll
      this.infiniteScroll.virtualOffset += this.currentSpeed;
      this.infiniteScroll.render();

      this.autoScrollAnimationId = requestAnimationFrame(tick);
    };

    tick();
  }

  /**
   * Show the single bubble
   */
  async showBubble() {
    // Initial delay before bubble appears
    await this.delay(500);

    // Show the bubble
    await this.addBubble(this.finalBubble);
  }

  /**
   * Add the bubble to the overlay (smash in, stays on screen)
   */
  addBubble(content) {
    return new Promise((resolve) => {
      const bubble = this.createBubbleElement(content);
      this.overlay.appendChild(bubble);
      this.bubbleElements.push(bubble);

      // Get the animation duration from the bubble's CSS variable
      const animDuration = parseFloat(bubble.style.getPropertyValue('--anim-duration')) * 1000 || 600;

      // Trigger smash animation
      requestAnimationFrame(() => {
        bubble.classList.add('smashing');
      });

      // After animation, mark as visible (stays on screen)
      setTimeout(() => {
        bubble.classList.remove('smashing');
        bubble.classList.add('visible');
        resolve();
      }, animDuration + 50); // Match animation duration + small buffer
    });
  }

  /**
   * Handle accept button click
   */
  handleAccept() {
    if (!this.isActive) return;
    this.isActive = false;

    // Sweep all bubbles up (staggered)
    this.exitAllBubbles();

    // Transition to user control
    this.transitionToUserControl();
  }

  /**
   * Exit all bubbles with staggered sweep-up animation
   */
  exitAllBubbles() {
    this.bubbleElements.forEach((bubble, index) => {
      setTimeout(() => {
        bubble.classList.remove('visible');
        bubble.classList.add('exiting');
      }, index * 100); // 100ms stagger
    });
  }

  /**
   * Smoothly transition from auto-scroll to user control
   */
  transitionToUserControl() {
    const startSpeed = this.currentSpeed;
    const startTime = performance.now();
    const duration = this.transitionDuration;

    const decelerate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic curve
      const eased = 1 - Math.pow(1 - progress, 3);
      this.currentSpeed = startSpeed * (1 - eased);

      // Continue scrolling at reduced speed
      if (this.infiniteScroll) {
        this.infiniteScroll.virtualOffset += this.currentSpeed;
        this.infiniteScroll.render();
      }

      if (progress < 1) {
        requestAnimationFrame(decelerate);
      } else {
        this.finishTransition();
      }
    };

    // Start fade-out animation on overlay
    this.overlay.classList.add('fading');

    // Cancel the regular auto-scroll loop
    if (this.autoScrollAnimationId) {
      cancelAnimationFrame(this.autoScrollAnimationId);
    }

    decelerate();
  }

  /**
   * Complete the transition and clean up
   */
  finishTransition() {
    // Remove overlay from DOM
    setTimeout(() => {
      if (this.overlay && this.overlay.parentNode) {
        this.overlay.parentNode.removeChild(this.overlay);
      }
    }, 1000); // Wait for fade animation

    // Call completion callback (connects navigator)
    this.onComplete();
  }

  /**
   * Utility: Promise-based delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
