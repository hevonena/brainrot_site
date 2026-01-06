// Gen-Z/meme style emojis (same as InfiniteScroll)
const GENZ_EMOJIS = ['💀', '😭', '🔥', '💯', '🤡', '👀', '😩', '🙏', '⚡', '🧠', '📱', '🎭'];

export class MilestoneCelebration {
  constructor(options = {}) {
    // Configuration - single bubble image
    this.bubbleImage = options.bubbleImage || '/content/bubbles/bubble.svg';
    this.celebrationDuration = options.duration || 2800;

    // State
    this.lastMilestoneReached = 0;
    this.isCelebrating = false;
    this.container = null;

    // Confetti particle system (GPU-accelerated)
    this.confettiContainer = null;
    this.activeParticles = [];
    this.animationId = null;

    // Progressive milestones in meters
    this.milestones = [
      1, 2, 5, 10, 25, 50, 100, 250, 500,
      1000, 2000, 5000, 10000, 25000, 50000, 100000
    ];

    // Self-deprecating exclamations for each milestone
    this.exclamations = {
      1: [
        "1 meter of your life: WASTED",
        "The doom scroll has begun...",
        "First meter down, sanity next"
      ],
      2: [
        "2m deep and no turning back",
        "Twice the scroll, twice the regret"
      ],
      5: [
        "5m closer to enlightenment (jk)",
        "5 meters of pure avoidance"
      ],
      10: [
        "10m deep into the void",
        "Double digits of disappointment",
        "10m = 10 minutes you won't get back"
      ],
      25: [
        "25m of scrolling could've been a walk",
        "A quarter hectometer of regret"
      ],
      50: [
        "Congrats! You scrolled 50m instead of touching grass",
        "50m: Half a football field of wasted potential",
        "Your thumbs have run 50 meters"
      ],
      100: [
        "100m of pure procrastination",
        "You could've sprinted this distance IRL",
        "100m: Usain Bolt would be disappointed"
      ],
      250: [
        "250m scrolled, 0 tasks completed",
        "A quarter kilometer of avoiding responsibilities"
      ],
      500: [
        "Half a km of digital wandering",
        "500m: That's like... 5 football fields",
        "Halfway to a kilometer of shame"
      ],
      1000: [
        "1 KILOMETER of doom scrolling!",
        "You've scrolled 1km. Your ancestors are confused.",
        "1km: This is now a marathon of procrastination"
      ],
      2000: [
        "2km deep in the algorithm",
        "You could've walked to the store by now"
      ],
      5000: [
        "5km: Basically a marathon for your thumb",
        "You've scrolled further than most people walk daily"
      ],
      10000: [
        "10km scrolled. Seek help.",
        "This is concerning. Are you okay?"
      ],
      25000: [
        "25km of scroll. Legend status achieved.",
        "You're either testing this or need an intervention"
      ],
      50000: [
        "50km. At this point, I'm impressed.",
        "The void stares back. It's worried about you."
      ],
      100000: [
        "100km. You win. But at what cost?",
        "Congratulations, you've out-scrolled everyone. Forever alone."
      ]
    };

    this.createUI();
  }

  createUI() {
    // Main container (fullscreen overlay)
    this.container = document.createElement('div');
    this.container.className = 'milestone-celebration';

    // Bubble wrapper (for animation)
    this.bubble = document.createElement('div');
    this.bubble.className = 'milestone-bubble';

    // Bubble image background
    this.bubbleImg = document.createElement('img');
    this.bubbleImg.src = this.bubbleImage;
    this.bubbleImg.alt = '';
    this.bubbleImg.className = 'bubble-image';

    // Content container (text inside bubble)
    this.contentDiv = document.createElement('div');
    this.contentDiv.className = 'bubble-content';

    // Distance display
    this.distanceDiv = document.createElement('div');
    this.distanceDiv.className = 'milestone-distance';

    // Exclamation text
    this.exclamationDiv = document.createElement('div');
    this.exclamationDiv.className = 'milestone-exclamation';

    // Assemble
    this.contentDiv.appendChild(this.distanceDiv);
    this.contentDiv.appendChild(this.exclamationDiv);
    this.bubble.appendChild(this.bubbleImg);
    this.bubble.appendChild(this.contentDiv);
    this.container.appendChild(this.bubble);

    document.body.appendChild(this.container);
  }

  /**
   * Connect to a ScrollNavigator instance
   */
  connectNavigator(navigator) {
    navigator.on('rotate', () => {
      const distanceData = navigator.getDistanceInMeters();
      this.checkMilestone(distanceData.absolute);
    });
  }

  /**
   * Check if a milestone has been crossed
   */
  checkMilestone(absoluteMeters) {
    if (this.isCelebrating) return;

    // Find the highest milestone that has been crossed
    for (let i = this.milestones.length - 1; i >= 0; i--) {
      const milestone = this.milestones[i];
      if (absoluteMeters >= milestone && milestone > this.lastMilestoneReached) {
        this.lastMilestoneReached = milestone;
        this.celebrate(milestone);
        break;
      }
    }
  }

  /**
   * Trigger celebration for a milestone
   */
  celebrate(milestone) {
    this.isCelebrating = true;

    // Update content
    this.distanceDiv.textContent = this.formatMilestone(milestone);
    this.exclamationDiv.textContent = this.getExclamation(milestone);

    // Show and trigger animation
    this.container.classList.add('active');

    // Trigger confetti
    this.triggerConfetti();

    // Remove after animation completes
    setTimeout(() => {
      this.container.classList.remove('active');
      this.isCelebrating = false;
    }, this.celebrationDuration);
  }

  /**
   * Trigger confetti burst with GPU-accelerated CSS transforms
   */
  triggerConfetti() {
    // Create container if not exists
    if (!this.confettiContainer) {
      this.confettiContainer = document.createElement('div');
      this.confettiContainer.className = 'confetti-container';
      document.body.appendChild(this.confettiContainer);
    }

    // Clear any previous particles
    this.clearParticles();

    // Adaptive particle count for mobile
    const isMobile = window.innerWidth <= 768;
    const multiplier = isMobile ? 0.5 : 0.8;

    // Queue all bursts to be staggered across frames
    this.pendingBursts = [
      // Frame 1: Main center explosion
      {
        count: Math.floor(50 * multiplier),
        origin: { x: 0.5, y: 0.5 },
        spread: 360,
        angle: 270,
        velocity: { min: 600, max: 1200 },
        emojis: this.pickRandomEmojis(3)
      },
      // Frame 2: Secondary ring
      {
        count: Math.floor(40 * multiplier),
        origin: { x: 0.5, y: 0.5 },
        spread: 360,
        angle: 270,
        velocity: { min: 400, max: 900 },
        emojis: this.pickRandomEmojis(2)
      },
      // Frame 3: Left side
      {
        count: Math.floor(25 * multiplier),
        origin: { x: 0, y: 0.5 },
        spread: 80,
        angle: 320,
        velocity: { min: 500, max: 1000 },
        emojis: this.pickRandomEmojis(2)
      },
      // Frame 4: Right side
      {
        count: Math.floor(25 * multiplier),
        origin: { x: 1, y: 0.5 },
        spread: 80,
        angle: 220,
        velocity: { min: 500, max: 1000 },
        emojis: this.pickRandomEmojis(2)
      },
      // Frame 5: Top burst
      {
        count: Math.floor(30 * multiplier),
        origin: { x: 0.5, y: 0.15 },
        spread: 140,
        angle: 270,
        velocity: { min: 400, max: 700 },
        gravity: 1400,
        emojis: this.pickRandomEmojis(3)
      },
      // Frame 6: Bottom left
      {
        count: Math.floor(15 * multiplier),
        origin: { x: 0.2, y: 0.8 },
        spread: 60,
        angle: 300,
        velocity: { min: 450, max: 850 },
        emojis: this.pickRandomEmojis(2)
      },
      // Frame 7: Bottom right
      {
        count: Math.floor(15 * multiplier),
        origin: { x: 0.8, y: 0.8 },
        spread: 60,
        angle: 240,
        velocity: { min: 450, max: 850 },
        emojis: this.pickRandomEmojis(2)
      }
    ];

    // Process bursts across frames to avoid jank
    this.processNextBurst();
  }

  /**
   * Process bursts one per frame to avoid blocking
   */
  processNextBurst() {
    if (!this.pendingBursts || this.pendingBursts.length === 0) {
      return;
    }

    const burst = this.pendingBursts.shift();
    this.createBurst(burst);

    // Start animation immediately on first burst
    if (!this.animationId) {
      this.animateParticles();
    }

    // Schedule next burst on next frame
    if (this.pendingBursts.length > 0) {
      requestAnimationFrame(() => this.processNextBurst());
    }
  }

  /**
   * Pick random emojis from the list
   */
  pickRandomEmojis(count) {
    const shuffled = [...GENZ_EMOJIS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  /**
   * Create a burst of confetti particles using DocumentFragment for batched insertion
   */
  createBurst({ count, origin, spread, angle, velocity, gravity = 900, emojis = GENZ_EMOJIS }) {
    const centerX = window.innerWidth * origin.x;
    const centerY = window.innerHeight * origin.y;

    // Use DocumentFragment for single DOM insertion
    const fragment = document.createDocumentFragment();
    const newParticles = [];

    for (let i = 0; i < count; i++) {
      const emoji = emojis[Math.floor(Math.random() * emojis.length)];

      // Create particle element
      const particle = document.createElement('div');
      particle.className = 'confetti-particle';
      particle.textContent = emoji;

      // Random angle within spread (convert to radians)
      const particleAngle = (angle + (Math.random() - 0.5) * spread) * (Math.PI / 180);
      const speed = velocity.min + Math.random() * (velocity.max - velocity.min);

      // Initial physics state
      const state = {
        element: particle,
        x: centerX - 16, // center the emoji
        y: centerY - 16,
        vx: Math.cos(particleAngle) * speed,
        vy: Math.sin(particleAngle) * speed,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 720, // degrees per second
        scale: 0.7 + Math.random() * 0.6,
        opacity: 1,
        gravity: gravity + Math.random() * 300,
        drag: 0.98,
        fadeDelay: 1200 + Math.random() * 800, // ms before fading
        lifetime: 0
      };

      // Apply initial transform before adding to DOM
      particle.style.transform = `translate3d(${state.x}px, ${state.y}px, 0) rotate(${state.rotation}deg) scale(${state.scale})`;
      particle.style.opacity = state.opacity;

      newParticles.push(state);
      fragment.appendChild(particle);
    }

    // Single DOM insertion for all particles in this burst
    this.confettiContainer.appendChild(fragment);
    this.activeParticles.push(...newParticles);
  }

  /**
   * Animation loop using requestAnimationFrame
   */
  animateParticles() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }

    let lastTime = performance.now();

    const animate = (currentTime) => {
      const deltaTime = (currentTime - lastTime) / 1000; // seconds
      lastTime = currentTime;

      let hasActiveParticles = false;

      for (let i = this.activeParticles.length - 1; i >= 0; i--) {
        const p = this.activeParticles[i];
        p.lifetime += deltaTime * 1000;

        // Apply physics
        p.vy += p.gravity * deltaTime;
        p.vx *= p.drag;
        p.vy *= p.drag;
        p.x += p.vx * deltaTime;
        p.y += p.vy * deltaTime;
        p.rotation += p.rotationSpeed * deltaTime;

        // Fade out after delay
        if (p.lifetime > p.fadeDelay) {
          p.opacity -= deltaTime * 2.5; // fade over ~0.4s
        }

        // Remove if off-screen or faded
        if (p.opacity <= 0 || p.y > window.innerHeight + 100) {
          p.element.remove();
          this.activeParticles.splice(i, 1);
        } else {
          hasActiveParticles = true;
          this.updateParticleTransform(p);
        }
      }

      if (hasActiveParticles) {
        this.animationId = requestAnimationFrame(animate);
      } else {
        this.animationId = null;
      }
    };

    this.animationId = requestAnimationFrame(animate);
  }

  /**
   * Update particle CSS transform (GPU-accelerated)
   */
  updateParticleTransform(p) {
    p.element.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) rotate(${p.rotation}deg) scale(${p.scale})`;
    p.element.style.opacity = p.opacity;
  }

  /**
   * Clear all active particles
   */
  clearParticles() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    for (const p of this.activeParticles) {
      p.element.remove();
    }
    this.activeParticles = [];
  }

  /**
   * Get a random exclamation for a milestone
   */
  getExclamation(milestone) {
    const options = this.exclamations[milestone] || [`${milestone}m of scrolling!`];
    return options[Math.floor(Math.random() * options.length)];
  }

  /**
   * Format milestone distance for display
   */
  formatMilestone(meters) {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(0)}km`;
    }
    return `${meters}m`;
  }

  /**
   * Remove the component from DOM
   */
  destroy() {
    this.clearParticles();
    if (this.confettiContainer && this.confettiContainer.parentNode) {
      this.confettiContainer.parentNode.removeChild(this.confettiContainer);
    }
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}
