/**
 * InfiniteScroll - Displays images and videos in an infinite vertical scroll
 *
 * Features:
 * - Infinite scroll in both directions
 * - Shuffled content with repetitions
 * - Content fits width with no height cropping (natural aspect ratio)
 * - Connects to ScrollNavigator for scroll events
 * - Gen-Z images include comment overlay and text overlay with parallax
 */

// Gen-Z/meme style emojis for random selection
const GENZ_EMOJIS = ['💀', '😭', '🔥', '💯', '🤡', '👀', '😩', '🙏', '⚡', '🧠', '📱', '🎭'];

export class InfiniteScroll {
  constructor(options = {}) {
    this.manifestUrl = options.manifestUrl || '/content-manifest.json';
    this.bufferSize = options.bufferSize || 3; // Items to keep above/below viewport
    this.scrollSpeed = options.scrollSpeed || 1; // Multiplier for scroll distance
    this.items = [];
    this.shuffledItems = [];
    this.flashcards = [];
    this.container = null;
    this.track = null; // Track for videos (back layer)
    this.genzTrack = null; // Track for gen-z items (front layer)
    this.virtualOffset = 0; // Current scroll position in virtual space
    this.defaultItemHeight = 0; // Fallback height estimate
    this.navigator = null;

    // Separate tracking for videos and gen-z items
    this.videoItems = []; // Only video items
    this.genzItems = []; // Only gen-z items
    this.videoElements = new Map(); // Map of index -> video DOM element
    this.genzElements = new Map(); // Map of index -> gen-z DOM element
    this.genzItemHeights = new Map(); // Heights of gen-z items
    this.genzGapMin = 48; // Minimum gap between posts
    this.genzGapMax = 1200; // Maximum gap (2-3x post height to show videos behind)
    this.genzRandomGaps = new Map(); // Random gaps per item index
  }

  async init() {
    // Load manifest and flashcards in parallel
    const [manifestResponse, flashcardsResponse] = await Promise.all([
      fetch(this.manifestUrl),
      fetch('/flashcards.json')
    ]);

    this.items = await manifestResponse.json();
    this.flashcards = await flashcardsResponse.json();

    console.log(`Loaded ${this.items.length} items and ${this.flashcards.length} flashcards`);

    // Separate video and gen-z items
    this.videoItems = this.items.filter(item => item.type === 'video' && !item.isGenZ);
    this.genzItems = this.items.filter(item => item.isGenZ);

    // Shuffle gen-z items
    this.shuffleArray(this.genzItems);
    // Shuffle video items
    this.shuffleArray(this.videoItems);

    console.log(`Found ${this.videoItems.length} videos and ${this.genzItems.length} gen-z items`);

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
   * Shuffle array in place using Fisher-Yates
   */
  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  /**
   * Get the container element (for adding overlays like distance display)
   */
  getContainer() {
    return this.container;
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

  createContainer() {
    // Create main container
    this.container = document.createElement('div');
    this.container.className = 'infinite-scroll-container';

    // Create track for videos (back layer - continuous background)
    this.track = document.createElement('div');
    this.track.className = 'infinite-scroll-track';

    // Create track for gen-z items (front layer)
    this.genzTrack = document.createElement('div');
    this.genzTrack.className = 'infinite-scroll-track genz-track';

    // Add layers to container
    this.container.appendChild(this.track);
    this.container.appendChild(this.genzTrack);
    document.body.insertBefore(this.container, document.body.firstChild);
  }

  calculateDimensions() {
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // Default height estimate (viewport height as fallback)
    this.defaultItemHeight = viewportHeight;
    this.viewportHeight = viewportHeight;
    this.viewportWidth = viewportWidth;
  }

  /**
   * Get video item for a given index (with wrapping)
   */
  getVideoForIndex(index) {
    if (this.videoItems.length === 0) return null;
    const normalizedIndex = ((index % this.videoItems.length) + this.videoItems.length) % this.videoItems.length;
    return this.videoItems[normalizedIndex];
  }

  /**
   * Get gen-z item for a given index (with wrapping)
   */
  getGenzForIndex(index) {
    if (this.genzItems.length === 0) return null;
    const normalizedIndex = ((index % this.genzItems.length) + this.genzItems.length) % this.genzItems.length;
    return this.genzItems[normalizedIndex];
  }

  /**
   * Get flashcard for a given index, cycling if needed
   */
  getFlashcard(flashcardIndex) {
    if (this.flashcards.length === 0) return null;
    // Use modulo to cycle through flashcards if index exceeds count
    const normalizedIndex = flashcardIndex % this.flashcards.length;
    return this.flashcards[normalizedIndex];
  }

  /**
   * Create the comment overlay for gen-z items
   */
  createGenZOverlay(flashcardIndex) {
    const flashcard = this.getFlashcard(flashcardIndex);
    if (!flashcard) return null;

    const overlay = document.createElement('div');
    overlay.className = 'genz-overlay';

    // Header with avatar and username
    const header = document.createElement('div');
    header.className = 'genz-header';
    header.innerHTML = `
      <img class="avatar" src="/content/profile_pic/genzzz.jpg" alt="genzzz">
      <span class="username">genzzz</span>
    `;
    overlay.appendChild(header);

    // Divider line
    const divider = document.createElement('div');
    divider.className = 'genz-divider';
    overlay.appendChild(divider);

    // Comments section
    const comments = document.createElement('div');
    comments.className = 'genz-comments';

    // First comment: @mind_sanity_patrol + title
    const comment1 = document.createElement('div');
    comment1.className = 'genz-comment';
    comment1.innerHTML = `
      <img class="avatar" src="/content/profile_pic/mind_sanity_patrol.jpg" alt="mind_sanity_patrol">
      <span class="comment-text">
        <span class="mention">@mind_sanity_patrol</span> ${flashcard.title}
      </span>
    `;
    comments.appendChild(comment1);

    // Second comment: @mind_sanity_patrol + content
    const comment2 = document.createElement('div');
    comment2.className = 'genz-comment';
    comment2.innerHTML = `
      <img class="avatar" src="/content/profile_pic/mind_sanity_patrol.jpg" alt="mind_sanity_patrol">
      <span class="comment-text">
        <span class="mention">@mind_sanity_patrol</span> ${flashcard.content}
      </span>
    `;
    comments.appendChild(comment2);

    overlay.appendChild(comments);

    return overlay;
  }

  /**
   * Create the text overlay for gen-z items (displayed on the image)
   */
  createGenZTextOverlay(flashcardIndex) {
    const flashcard = this.getFlashcard(flashcardIndex);
    if (!flashcard || !flashcard.genZ) return null;

    const overlay = document.createElement('div');
    overlay.className = 'genz-text-overlay';

    // Pick 1-2 random emojis
    const numEmojis = Math.random() > 0.5 ? 2 : 1;
    let emojis = '';
    for (let i = 0; i < numEmojis; i++) {
      const randomIndex = Math.floor(Math.random() * GENZ_EMOJIS.length);
      emojis += ' ' + GENZ_EMOJIS[randomIndex];
    }

    overlay.textContent = flashcard.genZ + emojis;
    return overlay;
  }

  /**
   * Create a video element for the background
   */
  createVideoElement(index) {
    const item = this.getVideoForIndex(index);
    if (!item) return null;

    const wrapper = document.createElement('div');
    wrapper.className = 'infinite-scroll-item';
    wrapper.dataset.videoIndex = index;

    const video = document.createElement('video');
    video.src = item.src;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.autoplay = true;
    video.preload = 'auto';
    wrapper.appendChild(video);

    video.play().catch(() => {});

    return wrapper;
  }

  /**
   * Create a gen-z element with overlays
   */
  createGenzElement(index) {
    const item = this.getGenzForIndex(index);
    if (!item) return null;

    const wrapper = document.createElement('div');
    wrapper.className = 'infinite-scroll-item genz-item';
    wrapper.dataset.genzIndex = index;
    wrapper.dataset.isGenZ = 'true';
    wrapper.dataset.flashcardIndex = item.flashcardIndex;

    const onMediaLoad = () => {
      const height = wrapper.offsetHeight;
      if (height > 0) {
        const oldHeight = this.genzItemHeights.get(index);
        this.genzItemHeights.set(index, height);
        if (!oldHeight || Math.abs(oldHeight - height) > 10) {
          this.render();
        }
      }
    };

    // Create media container
    const mediaContainer = document.createElement('div');
    mediaContainer.className = 'genz-image-container';

    if (item.type === 'video') {
      const video = document.createElement('video');
      video.src = item.src;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.autoplay = true;
      video.preload = 'auto';
      video.addEventListener('loadedmetadata', onMediaLoad);
      mediaContainer.appendChild(video);
      video.play().catch(() => {});
    } else {
      const img = document.createElement('img');
      img.src = item.src;
      img.alt = '';
      img.loading = 'eager';
      img.addEventListener('load', onMediaLoad);
      mediaContainer.appendChild(img);
    }

    // Add text overlay
    const textOverlay = this.createGenZTextOverlay(item.flashcardIndex);
    if (textOverlay) {
      mediaContainer.appendChild(textOverlay);
    }

    wrapper.appendChild(mediaContainer);

    // Add comment overlay
    const overlay = this.createGenZOverlay(item.flashcardIndex);
    if (overlay) {
      wrapper.appendChild(overlay);
    }

    return wrapper;
  }

  /**
   * Generate gap pattern: 2-5 posts with small gaps, then one big gap
   */
  generateGapPattern() {
    this.genzRandomGaps.clear();
    let index = 0;

    // Generate pattern for a large number of items (will wrap with modulo)
    while (index < 1000) {
      // 2-5 posts with small gaps
      const groupSize = 2 + Math.floor(Math.random() * 4); // 2, 3, 4, or 5

      for (let i = 0; i < groupSize && index < 1000; i++) {
        // Small gap with slight variation
        this.genzRandomGaps.set(index, this.genzGapMin + Math.random() * 30);
        index++;
      }

      // One big gap after the group
      if (index < 1000) {
        this.genzRandomGaps.set(index, this.genzGapMin + 400 + Math.random() * (this.genzGapMax - 400));
        index++;
      }
    }
  }

  /**
   * Get gap for a gen-z item (from pre-generated pattern)
   */
  getGenzGap(index) {
    // Generate pattern if not exists
    if (this.genzRandomGaps.size === 0) {
      this.generateGapPattern();
    }

    // Use modulo to wrap for infinite scroll
    const normalizedIndex = ((index % 1000) + 1000) % 1000;
    return this.genzRandomGaps.get(normalizedIndex) || this.genzGapMin;
  }

  /**
   * Get height of a gen-z item (with random gap)
   */
  getGenzItemHeight(index) {
    return (this.genzItemHeights.get(index) || this.defaultItemHeight) + this.getGenzGap(index);
  }

  /**
   * Get cumulative position for a gen-z item (including gaps)
   */
  getGenzPosition(index) {
    let position = 0;
    if (index > 0) {
      for (let i = 0; i < index; i++) {
        position += this.getGenzItemHeight(i);
      }
    } else if (index < 0) {
      for (let i = -1; i >= index; i--) {
        position -= this.getGenzItemHeight(i);
      }
    }
    return position;
  }

  /**
   * Find which gen-z index is at a given scroll position
   */
  findGenzIndexAtPosition(scrollY) {
    if (scrollY >= 0) {
      let position = 0;
      let index = 0;
      while (position + this.getGenzItemHeight(index) < scrollY) {
        position += this.getGenzItemHeight(index);
        index++;
        if (index > 1000) break;
      }
      return index;
    } else {
      let position = 0;
      let index = -1;
      while (position > scrollY) {
        position -= this.getGenzItemHeight(index);
        index--;
        if (index < -1000) break;
      }
      return index + 1;
    }
  }

  render() {
    const scrollY = this.virtualOffset;

    // === RENDER VIDEOS (continuous background with parallax) ===
    // Videos scroll slower for depth effect
    const videoParallax = 0.5;
    const videoScrollY = scrollY * videoParallax;
    const videoHeight = this.viewportHeight;
    const videoStartIndex = Math.floor(videoScrollY / videoHeight) - this.bufferSize;
    const videoEndIndex = Math.ceil((videoScrollY + this.viewportHeight) / videoHeight) + this.bufferSize;

    // Remove videos that are no longer in range
    for (const [index, element] of this.videoElements) {
      if (index < videoStartIndex || index > videoEndIndex) {
        const video = element.querySelector('video');
        if (video) video.pause();
        element.remove();
        this.videoElements.delete(index);
      }
    }

    // Add and position videos
    for (let i = videoStartIndex; i <= videoEndIndex; i++) {
      if (!this.videoElements.has(i)) {
        const element = this.createVideoElement(i);
        if (element) {
          this.track.appendChild(element);
          this.videoElements.set(i, element);
          const video = element.querySelector('video');
          if (video) video.play().catch(() => {});
        }
      }

      const element = this.videoElements.get(i);
      if (element) {
        // Videos positioned at exact 100vh intervals - no gaps
        const yPosition = i * videoHeight;
        element.style.transform = `translateY(${yPosition}px)`;
      }
    }

    // === RENDER GEN-Z ITEMS (with gaps) ===
    const genzStartIndex = this.findGenzIndexAtPosition(scrollY) - this.bufferSize;
    const genzEndIndex = this.findGenzIndexAtPosition(scrollY + this.viewportHeight) + this.bufferSize;

    // Remove gen-z items that are no longer in range
    for (const [index, element] of this.genzElements) {
      if (index < genzStartIndex || index > genzEndIndex) {
        const video = element.querySelector('video');
        if (video) video.pause();
        element.remove();
        this.genzElements.delete(index);
      }
    }

    // Add and position gen-z items
    for (let i = genzStartIndex; i <= genzEndIndex; i++) {
      if (!this.genzElements.has(i)) {
        const element = this.createGenzElement(i);
        if (element) {
          this.genzTrack.appendChild(element);
          this.genzElements.set(i, element);
          const video = element.querySelector('video');
          if (video) video.play().catch(() => {});
        }
      }

      const element = this.genzElements.get(i);
      if (element) {
        const yPosition = this.getGenzPosition(i);
        element.style.transform = `translateY(${yPosition}px)`;

        // Apply parallax effect to text overlays
        const textOverlay = element.querySelector('.genz-text-overlay');
        if (textOverlay) {
          const itemHeight = this.getGenzItemHeight(i) - this.getGenzGap(i);
          const itemCenterY = yPosition + itemHeight / 2 - scrollY;
          const viewportCenterY = this.viewportHeight / 2;
          const distanceFromCenter = itemCenterY - viewportCenterY;
          const parallaxOffset = distanceFromCenter * 0.08;
          textOverlay.style.transform = `translate(-50%, calc(-50% + ${parallaxOffset}px))`;
        }
      }
    }

    // Update both tracks' positions
    this.track.style.transform = `translateY(${-videoScrollY}px)`;
    this.genzTrack.style.transform = `translateY(${-scrollY}px)`;
  }
}
