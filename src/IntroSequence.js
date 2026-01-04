/**
 * IntroSequence - Displays intro bubbles before the main scroll experience
 *
 * Features:
 * - Sequential bubbles that smash on screen and stack
 * - Final bubble with accept button
 * - Background auto-scrolls fast during intro
 * - Bubbles swept up by feed on accept
 */

export class IntroSequence {
  constructor(options = {}) {
    // Configuration - support multiple bubble images
    this.bubbleImages = options.bubbleImages || [
      '/content/bubbles/bubble.png',
      '/content/bubbles/bubble_1.png',
      '/content/bubbles/bubble_2.png',
      '/content/bubbles/bubble_3.png',
      '/content/bubbles/bubble_4.png',
    ];
    // Filter to only existing images (handled gracefully if some don't exist)
    this.autoScrollSpeed = options.autoScrollSpeed || 60; // pixels per frame
    this.bubbleDelay = options.bubbleDelay || 1500; // ms between bubbles
    this.transitionDuration = options.transitionDuration || 2000; // ms for deceleration

    // Bubble content (configurable)
    this.bubbles = options.bubbles || [
      { title: "WARNING", subtext: "This content may cause brainrot" },
      { title: "CAUTION", subtext: "Excessive scrolling ahead" },
      { title: "PSA", subtext: "Your attention is being harvested" },
      { title: "CREDITS", subtext: "A project by Alice Gillioz, Morea Gërxhaliu, David Zwicker and Jonathan Vögele" },
    ];
    this.finalBubble = options.finalBubble || {
      title: "ENTER",
      subtext: "Proceed at your own risk",
      buttonText: "I ACCEPT"
    };

    // State
    this.isActive = true;
    this.currentSpeed = this.autoScrollSpeed;
    this.autoScrollAnimationId = null;
    this.bubbleElements = [];
    this.bubblePositions = []; // Track positions for overlap avoidance
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
   * Get a random bubble image
   */
  getRandomBubbleImage() {
    const index = Math.floor(Math.random() * this.bubbleImages.length);
    return this.bubbleImages[index];
  }

  /**
   * Calculate overlap between two positions (as percentage 0-1)
   */
  calculateOverlap(pos1, pos2, radius) {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxDistance = radius * 2; // Two circles touching

    if (distance >= maxDistance) return 0;
    return 1 - (distance / maxDistance);
  }

  /**
   * Calculate total overlap score for a position against all existing bubbles
   */
  getTotalOverlap(x, y, radius) {
    let totalOverlap = 0;
    for (const pos of this.bubblePositions) {
      totalOverlap += this.calculateOverlap({ x, y }, pos, radius);
    }
    return totalOverlap;
  }

  /**
   * Find a position with minimal overlap using rejection sampling
   * @param {boolean} avoidCenter - If true, avoid the center area (reserved for final bubble)
   */
  findBestPosition(maxAttempts = 50, avoidCenter = true) {
    // Bubble radius in vw/vh units (approximate)
    const radius = 35; // Half of 70vw spread range
    const centerExclusionRadius = 20; // Reserve center area for final bubble

    let bestPosition = null;
    let bestOverlap = Infinity;

    for (let i = 0; i < maxAttempts; i++) {
      // Generate random position
      let x = (Math.random() - 0.5) * 70; // -35 to +35
      let y = (Math.random() - 0.5) * 60; // -30 to +30

      // If avoiding center, reject positions too close to center
      if (avoidCenter) {
        const distFromCenter = Math.sqrt(x * x + y * y);
        if (distFromCenter < centerExclusionRadius) {
          // Push position outward
          const angle = Math.atan2(y, x);
          const newDist = centerExclusionRadius + Math.random() * 15;
          x = Math.cos(angle) * newDist;
          y = Math.sin(angle) * newDist;
        }
      }

      // If no existing bubbles, use this position
      if (this.bubblePositions.length === 0) {
        return { x, y, overlap: 0 };
      }

      // Calculate overlap with existing bubbles
      const overlap = this.getTotalOverlap(x, y, radius);

      // If no overlap, use immediately
      if (overlap === 0) {
        return { x, y, overlap: 0 };
      }

      // Track best position
      if (overlap < bestOverlap) {
        bestOverlap = overlap;
        bestPosition = { x, y, overlap };
      }
    }

    return bestPosition || { x: 0, y: 0, overlap: 0 };
  }

  /**
   * Create a single bubble element
   */
  createBubbleElement(content, isFinal = false) {
    const bubble = document.createElement('div');
    bubble.className = 'intro-bubble';

    // Random rotation for organic stacking (-20 to 20 degrees)
    const rotation = (Math.random() - 0.5) * 40;
    bubble.style.setProperty('--final-rotation', `${rotation}deg`);

    // Final bubble goes in center, others avoid center
    let position;
    if (isFinal) {
      position = { x: 0, y: 0 }; // Center for final bubble
    } else {
      position = this.findBestPosition(50, true); // Avoid center
    }
    bubble.style.setProperty('--offset-x', `${position.x}vw`);
    bubble.style.setProperty('--offset-y', `${position.y}vh`);

    // Store position for future overlap calculations
    this.bubblePositions.push({ x: position.x, y: position.y });

    // Randomize animation parameters for variety
    const animDuration = 0.5 + Math.random() * 0.3; // 0.5s to 0.8s
    const bounceScale = 1.1 + Math.random() * 0.2; // 1.1 to 1.3 overshoot
    const startRotation = -30 + Math.random() * 20; // -30 to -10 deg start
    const midRotation = 5 + Math.random() * 10; // 5 to 15 deg bounce
    bubble.style.setProperty('--anim-duration', `${animDuration}s`);
    bubble.style.setProperty('--bounce-scale', bounceScale);
    bubble.style.setProperty('--start-rotation', `${startRotation}deg`);
    bubble.style.setProperty('--mid-rotation', `${midRotation}deg`);

    // Random bubble image
    const bubbleImg = document.createElement('img');
    bubbleImg.src = this.getRandomBubbleImage();
    bubbleImg.className = 'intro-bubble-image';
    bubbleImg.alt = '';
    // If image fails to load, fallback to first image
    bubbleImg.onerror = () => {
      bubbleImg.src = this.bubbleImages[0];
    };
    bubble.appendChild(bubbleImg);

    // Content container
    const contentDiv = document.createElement('div');
    contentDiv.className = 'intro-bubble-content';

    // Title
    const title = document.createElement('div');
    title.className = 'intro-title';
    title.textContent = content.title;
    contentDiv.appendChild(title);

    // Subtext
    const subtext = document.createElement('div');
    subtext.className = 'intro-subtext';
    subtext.textContent = content.subtext;
    contentDiv.appendChild(subtext);

    // Accept button (only for final bubble)
    if (isFinal) {
      const button = document.createElement('button');
      button.className = 'intro-accept-btn';
      button.textContent = content.buttonText;
      button.addEventListener('click', () => this.handleAccept());
      button.addEventListener('touchend', (e) => {
        e.preventDefault();
        this.handleAccept();
      });
      contentDiv.appendChild(button);
    }

    bubble.appendChild(contentDiv);
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

    // Show bubbles sequentially
    this.showBubblesSequentially();
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
   * Show all bubbles sequentially with stacking
   */
  async showBubblesSequentially() {
    // Initial delay before first bubble
    await this.delay(500);

    // Show each regular bubble
    for (let i = 0; i < this.bubbles.length; i++) {
      await this.addBubble(this.bubbles[i]);
      await this.delay(this.bubbleDelay);
    }

    // Show final bubble with accept button
    await this.addBubble(this.finalBubble, true);
  }

  /**
   * Add a bubble to the overlay (smash in, stays on screen)
   */
  addBubble(content, isFinal = false) {
    return new Promise((resolve) => {
      const bubble = this.createBubbleElement(content, isFinal);
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
