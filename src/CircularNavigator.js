export class CircularNavigator {
  constructor(element, options = {}) {
    this.element = element;
    this.lastAngle = null;
    this.isActive = false;
    this.centerX = 0;
    this.centerY = 0;
    this.currentValue = 0;
    this.currentAngle = 0;

    // Distance tracking
    this.totalDistance = 0; // Net signed distance (augments clockwise, diminishes counterclockwise)
    this.absoluteDistance = 0; // Total distance traveled regardless of direction
    this.currentRadius = 0; // Current radius from center

    // Options
    this.stepsPerRotation = options.stepsPerRotation || 150;
    this.showTrail = options.showTrail !== undefined ? options.showTrail : true;

    // Event listeners
    this.listeners = {
      rotate: [],
      start: [],
      end: [],
      update: []
    };

    this.init();
  }

  init() {
    this.element.addEventListener('mousedown', this.handleStart.bind(this));
    this.element.addEventListener('touchstart', this.handleStart.bind(this), { passive: false });

    document.addEventListener('mousemove', this.handleMove.bind(this));
    document.addEventListener('touchmove', this.handleMove.bind(this), { passive: false });

    document.addEventListener('mouseup', this.handleEnd.bind(this));
    document.addEventListener('touchend', this.handleEnd.bind(this));

    window.addEventListener('resize', this.updateCenter.bind(this));
    this.updateCenter();
  }

  // Event system
  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
    return this;
  }

  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
    return this;
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }

  updateCenter() {
    const rect = this.element.getBoundingClientRect();
    this.centerX = rect.left + rect.width / 2;
    this.centerY = rect.top + rect.height / 2;
  }

  handleStart(e) {
    this.isActive = true;
    this.lastAngle = null;
    this.updateCenter();
    e.preventDefault();

    this.emit('start', {
      value: this.currentValue
    });
  }

  handleMove(e) {
    if (!this.isActive) return;

    e.preventDefault();

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const dx = clientX - this.centerX;
    const dy = clientY - this.centerY;
    const angle = Math.atan2(dy, dx);

    // Calculate radius (distance from center to cursor)
    const radius = Math.sqrt(dx * dx + dy * dy);
    this.currentRadius = radius;
    this.currentAngle = angle;

    // Show trail if enabled
    if (this.showTrail) {
      this.createTrail(clientX, clientY);
    }

    if (this.lastAngle !== null) {
      let delta = angle - this.lastAngle;

      // Handle wrap-around at -π/π boundary
      if (delta > Math.PI) {
        delta -= 2 * Math.PI;
      } else if (delta < -Math.PI) {
        delta += 2 * Math.PI;
      }

      // Calculate real distance traveled along the arc
      // Arc length = radius × angle (in radians)
      const arcDistance = radius * delta; // Signed distance (positive = clockwise, negative = counterclockwise)
      const arcDistanceAbs = Math.abs(arcDistance); // Absolute distance

      // Update distance tracking
      this.totalDistance += arcDistance; // Net signed distance
      this.absoluteDistance += arcDistanceAbs; // Total distance traveled

      // Convert radians to rotation delta
      const rotationDelta = delta / (2 * Math.PI);
      const stepChange = rotationDelta * this.stepsPerRotation;

      this.currentValue += stepChange;

      // Emit rotation event with delta and current value
      this.emit('rotate', {
        delta: stepChange,
        rotationDelta: rotationDelta,
        value: this.currentValue,
        angle: angle,
        direction: stepChange > 0 ? 'clockwise' : 'counterclockwise',
        // Distance information
        distance: {
          total: this.totalDistance, // Net signed distance (augments clockwise, diminishes counterclockwise)
          absolute: this.absoluteDistance, // Total distance traveled (always increases)
          delta: arcDistance, // Distance traveled this frame (signed)
          deltaAbs: arcDistanceAbs, // Distance traveled this frame (absolute)
          radius: radius // Current radius in pixels
        }
      });
    }

    this.lastAngle = angle;
  }

  handleEnd() {
    this.isActive = false;
    this.lastAngle = null;

    this.emit('end', {
      value: this.currentValue
    });
  }

  createTrail(x, y) {
    const trail = document.createElement('div');
    trail.className = 'rotation-trail';
    trail.style.left = x + 'px';
    trail.style.top = y + 'px';
    document.body.appendChild(trail);

    setTimeout(() => trail.remove(), 600);
  }

  // Getters and setters
  getValue() {
    return this.currentValue;
  }

  setValue(value) {
    this.currentValue = value;
    this.emit('update', { value: this.currentValue });
  }

  getAngle() {
    return this.currentAngle;
  }

  setStepsPerRotation(steps) {
    this.stepsPerRotation = steps;
  }

  getStepsPerRotation() {
    return this.stepsPerRotation;
  }

  getIsActive() {
    return this.isActive;
  }

  // Distance tracking getters
  getTotalDistance() {
    return this.totalDistance; // Net signed distance
  }

  getAbsoluteDistance() {
    return this.absoluteDistance; // Total distance traveled
  }

  getCurrentRadius() {
    return this.currentRadius; // Current radius in pixels
  }

  // Reset distance tracking
  resetDistance() {
    this.totalDistance = 0;
    this.absoluteDistance = 0;
  }

  // Get distance in specific units (optional helper)
  getDistanceInUnits(pixelsPerUnit = 1) {
    return {
      total: this.totalDistance / pixelsPerUnit,
      absolute: this.absoluteDistance / pixelsPerUnit
    };
  }

  // Estimate pixels per meter based on screen DPI
  static estimatePixelsPerMeter() {
    // Try to estimate screen PPI (pixels per inch)
    // Default assumptions for common devices:
    // - Desktop monitors: ~96 PPI
    // - Laptops: ~110-140 PPI
    // - Tablets: ~130-160 PPI
    // - Phones: ~300-400 PPI

    const devicePixelRatio = window.devicePixelRatio || 1;

    // Rough heuristic based on screen size and pixel density
    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;
    const screenDiagonal = Math.sqrt(screenWidth * screenWidth + screenHeight * screenHeight);

    let estimatedPPI;

    // Simple heuristic: smaller screens with high pixel ratios are likely phones
    if (screenDiagonal < 1000 && devicePixelRatio >= 2) {
      estimatedPPI = 350; // Phone
    } else if (screenDiagonal < 2000 && devicePixelRatio >= 1.5) {
      estimatedPPI = 140; // High-DPI laptop or tablet
    } else if (screenDiagonal < 2000) {
      estimatedPPI = 110; // Standard laptop
    } else {
      estimatedPPI = 96; // Desktop monitor
    }

    // Convert PPI to pixels per meter
    // 1 inch = 0.0254 meters
    // pixels per meter = PPI / 0.0254
    const pixelsPerMeter = estimatedPPI / 0.0254;

    return {
      pixelsPerMeter,
      estimatedPPI,
      devicePixelRatio,
      screenDiagonal
    };
  }

  // Get distance in meters (estimated based on screen DPI)
  getDistanceInMeters() {
    const { pixelsPerMeter, estimatedPPI } = CircularNavigator.estimatePixelsPerMeter();

    return {
      total: this.totalDistance / pixelsPerMeter,
      absolute: this.absoluteDistance / pixelsPerMeter,
      pixelsPerMeter,
      estimatedPPI
    };
  }
}
