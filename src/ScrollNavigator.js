/**
 * ScrollNavigator - A scroll-based alternative to CircularNavigator
 * Drop-in replacement that responds to mouse wheel and touch swipe gestures
 * instead of circular rotation.
 */
export class ScrollNavigator {
  constructor(element, options = {}) {
    // Configuration
    this.element = element;
    this.stepsPerRotation = options.stepsPerRotation || 150;
    this.showTrail = options.showTrail || false; // Accepted but ignored for compatibility

    // State
    this.value = 0;
    this.isActive = false;
    this.eventListeners = {};

    // Distance tracking
    this.totalDistance = 0;        // Signed distance (+ down, - up)
    this.absoluteDistance = 0;     // Always positive total distance

    // Touch tracking
    this.touchStartY = null;
    this.lastTouchY = null;
    this.touchIdentifier = null;

    // Velocity tracking for momentum
    this.lastTouchTime = null;
    this.velocity = 0;
    this.velocityHistory = []; // Store recent velocities for smoothing
    this.velocityHistoryMax = 5;

    // Momentum animation
    this.momentumAnimationId = null;
    this.friction = 0.95; // Friction coefficient (lower = more friction)
    this.minVelocity = 0.5; // Stop momentum when velocity drops below this

    // Scroll end detection
    this.scrollEndTimer = null;
    this.scrollEndDelay = 150; // ms to wait before firing 'end' event

    // Bind methods
    this._handleWheel = this._handleWheel.bind(this);
    this._handleTouchStart = this._handleTouchStart.bind(this);
    this._handleTouchMove = this._handleTouchMove.bind(this);
    this._handleTouchEnd = this._handleTouchEnd.bind(this);

    // Initialize
    this._attachListeners();
  }

  /**
   * Attach event listeners
   */
  _attachListeners() {
    // Mouse wheel events - use window with capture to intercept before flashcards
    // This ensures scroll works even when hovering over flashcards
    window.addEventListener('wheel', this._handleWheel, { passive: false, capture: true });

    // Touch events - keep on element since they don't have the same propagation issue
    this.element.addEventListener('touchstart', this._handleTouchStart, { passive: false });
    this.element.addEventListener('touchmove', this._handleTouchMove, { passive: false });
    this.element.addEventListener('touchend', this._handleTouchEnd);
    this.element.addEventListener('touchcancel', this._handleTouchEnd);
  }

  /**
   * Remove event listeners (cleanup)
   */
  destroy() {
    // Stop any ongoing momentum animation
    this._stopMomentum();

    // Remove window listener with same capture flag
    window.removeEventListener('wheel', this._handleWheel, { capture: true });

    // Remove element listeners
    this.element.removeEventListener('touchstart', this._handleTouchStart);
    this.element.removeEventListener('touchmove', this._handleTouchMove);
    this.element.removeEventListener('touchend', this._handleTouchEnd);
    this.element.removeEventListener('touchcancel', this._handleTouchEnd);

    if (this.scrollEndTimer) {
      clearTimeout(this.scrollEndTimer);
    }
  }

  /**
   * Handle mouse wheel scroll
   */
  _handleWheel(event) {
    event.preventDefault();

    // Get scroll delta (positive = scroll down = clockwise)
    const scrollDelta = event.deltaY;

    // Fire start event if not already active
    if (!this.isActive) {
      this.isActive = true;
      this.emit('start', { value: this.value });
    }

    // Convert scroll pixels to steps
    const delta = this._pixelsToSteps(scrollDelta);

    // Update tracking
    this._updateDistance(scrollDelta);
    this.value += delta;

    // Determine direction
    const direction = scrollDelta > 0 ? 'clockwise' : 'counterclockwise';

    // Emit rotate event
    this.emit('rotate', {
      delta: delta,
      rotationDelta: scrollDelta / this.stepsPerRotation, // Fraction of rotation
      value: this.value,
      angle: 0, // Not applicable for scroll, but provided for compatibility
      direction: direction,
      distance: {
        total: this.totalDistance,
        absolute: this.absoluteDistance,
        delta: scrollDelta,
        deltaAbs: Math.abs(scrollDelta),
        radius: 0 // Not applicable for scroll
      }
    });

    // Reset scroll end timer
    this._resetScrollEndTimer();
  }

  /**
   * Handle touch start
   */
  _handleTouchStart(event) {
    // Only handle single touch
    if (event.touches.length === 1) {
      event.preventDefault();

      // Stop any ongoing momentum animation
      this._stopMomentum();

      const touch = event.touches[0];
      this.touchIdentifier = touch.identifier;
      this.touchStartY = touch.clientY;
      this.lastTouchY = touch.clientY;
      this.lastTouchTime = performance.now();
      this.velocityHistory = [];
      this.velocity = 0;

      // Fire start event
      this.isActive = true;
      this.emit('start', { value: this.value });
    }
  }

  /**
   * Handle touch move (swipe)
   */
  _handleTouchMove(event) {
    if (this.touchIdentifier === null) return;

    // Find our touch
    const touch = Array.from(event.touches).find(t => t.identifier === this.touchIdentifier);
    if (!touch) return;

    event.preventDefault();

    const currentTime = performance.now();
    const currentY = touch.clientY;
    const scrollDelta = this.lastTouchY - currentY; // Inverted: dragging up = scrolling down
    const timeDelta = currentTime - this.lastTouchTime;

    this.lastTouchY = currentY;
    this.lastTouchTime = currentTime;

    if (Math.abs(scrollDelta) < 0.5) return; // Ignore tiny movements

    // Calculate and store velocity (pixels per ms)
    if (timeDelta > 0) {
      const instantVelocity = scrollDelta / timeDelta;
      this.velocityHistory.push(instantVelocity);
      if (this.velocityHistory.length > this.velocityHistoryMax) {
        this.velocityHistory.shift();
      }
      // Average recent velocities for smoother momentum
      this.velocity = this.velocityHistory.reduce((a, b) => a + b, 0) / this.velocityHistory.length;
    }

    // Convert scroll pixels to steps
    const delta = this._pixelsToSteps(scrollDelta);

    // Update tracking
    this._updateDistance(scrollDelta);
    this.value += delta;

    // Determine direction
    const direction = scrollDelta > 0 ? 'clockwise' : 'counterclockwise';

    // Emit rotate event
    this.emit('rotate', {
      delta: delta,
      rotationDelta: scrollDelta / this.stepsPerRotation,
      value: this.value,
      angle: 0,
      direction: direction,
      distance: {
        total: this.totalDistance,
        absolute: this.absoluteDistance,
        delta: scrollDelta,
        deltaAbs: Math.abs(scrollDelta),
        radius: 0
      }
    });
  }

  /**
   * Handle touch end
   */
  _handleTouchEnd(event) {
    if (this.touchIdentifier === null) return;

    // Check if our touch ended
    const touchEnded = !Array.from(event.touches).some(t => t.identifier === this.touchIdentifier);

    if (touchEnded) {
      this.touchIdentifier = null;
      this.touchStartY = null;
      this.lastTouchY = null;

      // Start momentum if velocity is high enough
      if (Math.abs(this.velocity) > this.minVelocity / 16) { // Convert to pixels/ms threshold
        this._startMomentum();
      } else {
        // Fire end event immediately if no momentum
        this.isActive = false;
        this.emit('end', { value: this.value });
      }
    }
  }

  /**
   * Start momentum animation
   */
  _startMomentum() {
    this.lastMomentumTime = performance.now();
    this._momentumStep();
  }

  /**
   * Stop momentum animation
   */
  _stopMomentum() {
    if (this.momentumAnimationId) {
      cancelAnimationFrame(this.momentumAnimationId);
      this.momentumAnimationId = null;
    }
    this.velocity = 0;
  }

  /**
   * Single step of momentum animation
   */
  _momentumStep() {
    const currentTime = performance.now();
    const timeDelta = currentTime - this.lastMomentumTime;
    this.lastMomentumTime = currentTime;

    // Calculate scroll delta based on velocity (convert from px/ms to px)
    const scrollDelta = this.velocity * timeDelta;

    // Apply friction
    this.velocity *= this.friction;

    // Stop if velocity is too low
    if (Math.abs(this.velocity * 16) < this.minVelocity) { // Check at ~60fps rate
      this._stopMomentum();
      this.isActive = false;
      this.emit('end', { value: this.value });
      return;
    }

    // Convert scroll pixels to steps
    const delta = this._pixelsToSteps(scrollDelta);

    // Update tracking
    this._updateDistance(scrollDelta);
    this.value += delta;

    // Determine direction
    const direction = scrollDelta > 0 ? 'clockwise' : 'counterclockwise';

    // Emit rotate event
    this.emit('rotate', {
      delta: delta,
      rotationDelta: scrollDelta / this.stepsPerRotation,
      value: this.value,
      angle: 0,
      direction: direction,
      distance: {
        total: this.totalDistance,
        absolute: this.absoluteDistance,
        delta: scrollDelta,
        deltaAbs: Math.abs(scrollDelta),
        radius: 0
      }
    });

    // Schedule next frame
    this.momentumAnimationId = requestAnimationFrame(() => this._momentumStep());
  }

  /**
   * Reset the scroll end timer
   */
  _resetScrollEndTimer() {
    if (this.scrollEndTimer) {
      clearTimeout(this.scrollEndTimer);
    }

    this.scrollEndTimer = setTimeout(() => {
      if (this.isActive) {
        this.isActive = false;
        this.emit('end', { value: this.value });
      }
    }, this.scrollEndDelay);
  }

  /**
   * Convert pixels to steps based on stepsPerRotation
   */
  _pixelsToSteps(pixels) {
    // Use same conversion as CircularNavigator
    // Full rotation (2π radians) = stepsPerRotation steps
    // So pixels scroll maps linearly to steps
    return pixels * (this.stepsPerRotation / (2 * Math.PI * 100)); // Scale factor adjusted for feel
  }

  /**
   * Update distance tracking
   */
  _updateDistance(scrollDelta) {
    this.totalDistance += scrollDelta; // Signed distance
    this.absoluteDistance += Math.abs(scrollDelta); // Absolute distance
  }

  /**
   * Event system: subscribe to events
   */
  on(event, callback) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
    return this; // Allow chaining
  }

  /**
   * Event system: unsubscribe from events
   */
  off(event, callback) {
    if (!this.eventListeners[event]) return this;

    if (callback) {
      this.eventListeners[event] = this.eventListeners[event].filter(cb => cb !== callback);
    } else {
      delete this.eventListeners[event];
    }
    return this;
  }

  /**
   * Event system: emit events
   */
  emit(event, data) {
    if (!this.eventListeners[event]) return;

    this.eventListeners[event].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in ${event} event listener:`, error);
      }
    });
  }

  /**
   * Get current accumulated value
   */
  getValue() {
    return this.value;
  }

  /**
   * Set value programmatically
   */
  setValue(value) {
    this.value = value;
    this.emit('update', { value: this.value });
  }

  /**
   * Get current angle (dummy value for compatibility)
   */
  getAngle() {
    return 0; // Not applicable for scroll navigation
  }

  /**
   * Check if user is currently interacting
   */
  getIsActive() {
    return this.isActive;
  }

  /**
   * Set steps per rotation
   */
  setStepsPerRotation(steps) {
    this.stepsPerRotation = steps;
  }

  /**
   * Get steps per rotation
   */
  getStepsPerRotation() {
    return this.stepsPerRotation;
  }

  /**
   * Get total signed distance (+ down, - up)
   */
  getTotalDistance() {
    return this.totalDistance;
  }

  /**
   * Get absolute distance (always positive)
   */
  getAbsoluteDistance() {
    return this.absoluteDistance;
  }

  /**
   * Get current radius (dummy value for compatibility)
   */
  getCurrentRadius() {
    return 0; // Not applicable for scroll navigation
  }

  /**
   * Reset distance tracking
   */
  resetDistance() {
    this.totalDistance = 0;
    this.absoluteDistance = 0;
  }

  /**
   * Get distance in custom units
   */
  getDistanceInUnits(pixelsPerUnit) {
    return {
      total: this.totalDistance / pixelsPerUnit,
      absolute: this.absoluteDistance / pixelsPerUnit
    };
  }

  /**
   * Get distance in meters (estimated)
   */
  getDistanceInMeters() {
    const estimate = ScrollNavigator.estimatePixelsPerMeter();
    return {
      total: this.totalDistance / estimate.pixelsPerMeter,
      absolute: this.absoluteDistance / estimate.pixelsPerMeter
    };
  }

  /**
   * Static method: estimate pixels per meter based on screen DPI
   */
  static estimatePixelsPerMeter() {
    // Use same calculation as CircularNavigator
    const devicePixelRatio = window.devicePixelRatio || 1;
    const screenWidth = window.screen.width * devicePixelRatio;
    const screenHeight = window.screen.height * devicePixelRatio;
    const screenDiagonal = Math.sqrt(screenWidth ** 2 + screenHeight ** 2);

    // Estimate screen diagonal in inches (common laptop: 13-15", desktop: 24-27")
    const estimatedDiagonalInches = screenDiagonal > 3000 ? 27 : 15;
    const estimatedPPI = screenDiagonal / estimatedDiagonalInches;
    const pixelsPerInch = estimatedPPI;
    const pixelsPerMeter = pixelsPerInch * 39.3701; // 1 meter = 39.3701 inches

    return {
      pixelsPerMeter,
      estimatedPPI,
      devicePixelRatio,
      screenDiagonal: estimatedDiagonalInches
    };
  }
}
