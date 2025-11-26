export class DistanceDisplay {
  constructor(options = {}) {
    this.container = null;
    this.options = {
      showAbsolute: options.showAbsolute !== undefined ? options.showAbsolute : true,
      showSigned: options.showSigned !== undefined ? options.showSigned : true,
      ...options
    };

    this.createUI();
  }

  createUI() {
    // Create container
    this.container = document.createElement('div');
    this.container.className = 'distance-display';

    // Create single distance value element (no label)
    this.valueElement = document.createElement('div');
    this.valueElement.className = 'distance-value';
    this.container.appendChild(this.valueElement);

    document.body.appendChild(this.container);

    // Initialize with zero
    this.update(0, 0);
  }

  /**
   * Format distance with appropriate units (cm, m, km)
   * @param {number} meters - Distance in meters
   * @returns {string} Formatted distance string
   */
  formatDistance(meters) {
    const absMeters = Math.abs(meters);
    const sign = meters >= 0 ? ' ' : '-';

    if (absMeters < 0.01) {
      // Very small distances: show in millimeters
      return `${sign}${(absMeters * 1000).toFixed(1)} mm`;
    } else if (absMeters < 1) {
      // Less than 1 meter: show in centimeters
      return `${sign}${(absMeters * 100).toFixed(1)} cm`;
    } else if (absMeters < 1000) {
      // Less than 1 km: show in meters
      return `${sign}${absMeters.toFixed(2)} m`;
    } else {
      // 1 km or more: show in kilometers
      return `${sign}${(absMeters / 1000).toFixed(3)} km`;
    }
  }

  /**
   * Format absolute distance (always positive, no sign)
   * @param {number} meters - Distance in meters
   * @returns {string} Formatted distance string
   */
  formatAbsoluteDistance(meters) {
    const absMeters = Math.abs(meters);

    if (absMeters < 0.01) {
      return `${(absMeters * 1000).toFixed(1)} mm`;
    } else if (absMeters < 1) {
      return `${(absMeters * 100).toFixed(1)} cm`;
    } else if (absMeters < 1000) {
      return `${absMeters.toFixed(2)} m`;
    } else {
      return `${(absMeters / 1000).toFixed(3)} km`;
    }
  }

  /**
   * Update the distance display
   * @param {number} signedMeters - Signed distance in meters
   * @param {number} absoluteMeters - Absolute distance in meters
   */
  update(signedMeters, absoluteMeters) {
    if (this.valueElement) {
      // Show absolute distance by default, or signed if that's the preference
      const distanceToShow = this.options.showAbsolute ? absoluteMeters : signedMeters;
      const formattedDistance = this.options.showAbsolute
        ? this.formatAbsoluteDistance(distanceToShow)
        : this.formatDistance(distanceToShow);

      this.valueElement.textContent = formattedDistance;
    }
  }

  /**
   * Connect to a CircularNavigator instance
   * @param {CircularNavigator} navigator - The navigator to connect to
   */
  connectNavigator(navigator) {
    navigator.on('rotate', (data) => {
      const distanceData = navigator.getDistanceInMeters();
      this.update(distanceData.total, distanceData.absolute);
    });

    // Update on start/end as well
    navigator.on('start', () => {
      const distanceData = navigator.getDistanceInMeters();
      this.update(distanceData.total, distanceData.absolute);
    });

    navigator.on('end', () => {
      const distanceData = navigator.getDistanceInMeters();
      this.update(distanceData.total, distanceData.absolute);
    });
  }

  /**
   * Hide the display
   */
  hide() {
    if (this.container) {
      this.container.style.display = 'none';
    }
  }

  /**
   * Show the display
   */
  show() {
    if (this.container) {
      this.container.style.display = 'flex';
    }
  }

  /**
   * Remove the display from DOM
   */
  destroy() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}
