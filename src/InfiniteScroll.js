/**
 * InfiniteScroll - Displays images and videos in an infinite vertical scroll
 *
 * Features:
 * - Infinite scroll in both directions
 * - Shuffled content with repetitions
 * - Mobile: content fits width (touches left/right edges)
 * - Desktop: content fits height with center crop for consistent width
 * - Connects to ScrollNavigator for scroll events
 */
export class InfiniteScroll {
  constructor(options = {}) {
    this.manifestUrl = options.manifestUrl || '/content-manifest.json';
    this.bufferSize = options.bufferSize || 5; // Items to keep above/below viewport
    this.scrollSpeed = options.scrollSpeed || 1; // Multiplier for scroll distance
    this.items = [];
    this.shuffledItems = [];
    this.container = null;
    this.track = null;
    this.elements = new Map(); // Map of index -> DOM element
    this.virtualOffset = 0; // Current scroll position in virtual space
    this.itemHeight = 0; // Will be calculated based on viewport
    this.visibleRange = { start: 0, end: 0 };
    this.isDesktop = window.innerWidth >= 768;
    this.navigator = null;
  }

  async init() {
    // Load manifest
    const response = await fetch(this.manifestUrl);
    this.items = await response.json();

    // Create shuffled array with repetitions for infinite scroll
    this.shuffledItems = this.createShuffledSequence();

    // Create DOM structure
    this.createContainer();

    // Calculate item dimensions
    this.calculateDimensions();

    // Initial render
    this.render();

    // Set up resize listener
    window.addEventListener('resize', () => {
      this.calculateDimensions();
      this.render();
    });

    return this;
  }

  /**
   * Connect to ScrollNavigator to receive scroll events
   */
  connectNavigator(navigator) {
    this.navigator = navigator;

    navigator.on('rotate', (data) => {
      // Use the scroll delta to update virtual offset
      const scrollDelta = data.distance.delta * this.scrollSpeed;
      this.virtualOffset += scrollDelta;

      // No clamping - allow infinite scroll in both directions
      // The getItemForIndex method handles wrapping with modulo

      this.render();
    });
  }

  createShuffledSequence() {
    // Shuffle items using Fisher-Yates
    // We use modulo wrapping in getItemForIndex, so we just need one shuffled copy
    const shuffled = [...this.items];
    for (let j = shuffled.length - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1));
      [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
    }
    return shuffled;
  }

  createContainer() {
    // Create main container
    this.container = document.createElement('div');
    this.container.className = 'infinite-scroll-container';

    // Create scrollable track
    this.track = document.createElement('div');
    this.track.className = 'infinite-scroll-track';

    this.container.appendChild(this.track);
    document.body.insertBefore(this.container, document.body.firstChild);
  }

  calculateDimensions() {
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    this.isDesktop = viewportWidth >= 768;

    // On desktop, each item fills the viewport height
    // On mobile, items fill width and have natural aspect ratio
    this.itemHeight = viewportHeight;
    this.viewportHeight = viewportHeight;
    this.viewportWidth = viewportWidth;
  }

  getItemForIndex(virtualIndex) {
    // Map virtual index to actual item (with wrapping)
    const len = this.shuffledItems.length;
    // Handle negative indices too
    const normalizedIndex = ((virtualIndex % len) + len) % len;
    return this.shuffledItems[normalizedIndex];
  }

  createElement(virtualIndex) {
    const item = this.getItemForIndex(virtualIndex);
    const wrapper = document.createElement('div');
    wrapper.className = 'infinite-scroll-item';
    wrapper.dataset.virtualIndex = virtualIndex;

    if (item.type === 'video') {
      const video = document.createElement('video');
      video.src = item.src;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.autoplay = true;
      video.preload = 'auto';
      wrapper.appendChild(video);

      // Attempt to play (may fail without user interaction)
      video.play().catch(() => {});
    } else {
      const img = document.createElement('img');
      img.src = item.src;
      img.alt = '';
      img.loading = 'lazy';
      wrapper.appendChild(img);
    }

    return wrapper;
  }

  render() {
    // Calculate which items should be visible
    const scrollY = this.virtualOffset;
    const startIndex = Math.floor(scrollY / this.itemHeight) - this.bufferSize;
    const endIndex = Math.ceil((scrollY + this.viewportHeight) / this.itemHeight) + this.bufferSize;

    // Remove elements that are no longer in range
    for (const [index, element] of this.elements) {
      if (index < startIndex || index > endIndex) {
        // Pause video if it's a video
        const video = element.querySelector('video');
        if (video) {
          video.pause();
        }
        element.remove();
        this.elements.delete(index);
      }
    }

    // Add elements that should be visible
    for (let i = startIndex; i <= endIndex; i++) {
      if (!this.elements.has(i)) {
        const element = this.createElement(i);
        const yPosition = i * this.itemHeight;
        element.style.transform = `translateY(${yPosition}px)`;
        this.track.appendChild(element);
        this.elements.set(i, element);

        // Play video if visible
        const video = element.querySelector('video');
        if (video) {
          video.play().catch(() => {});
        }
      }
    }

    // Update track position
    this.track.style.transform = `translateY(${-scrollY}px)`;

    this.visibleRange = { start: startIndex, end: endIndex };
  }
}
