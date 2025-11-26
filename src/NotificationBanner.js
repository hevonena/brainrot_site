export default class NotificationBanner {
  constructor(flashcards, config) {
    this.flashcards = flashcards;
    this.config = {
      metersPerCard: config.metersPerCard || 5,
      cardLifetimeMeters: config.cardLifetimeMeters || 1,
      marginBeforeNextCard: config.marginBeforeNextCard || 2,
      animationDuration: config.animationDuration || 500, // milliseconds
      notificationWindows: config.notificationWindows || null // Pre-generated notification windows (optional)
    };

    // Store notification windows
    this.notificationWindows = this.config.notificationWindows;

    this.banner = null;
    this.distanceElement = null;
    this.titleElement = null;
    this.currentlyVisible = false;
    this.currentCardIndex = -1;

    this.createUI();
  }

  createUI() {
    // Create banner container
    this.banner = document.createElement('div');
    this.banner.className = 'notification-banner';

    // Create content wrapper
    const content = document.createElement('div');
    content.className = 'notification-content';

    // Create distance display
    this.distanceElement = document.createElement('div');
    this.distanceElement.className = 'notification-distance';

    // Create title display
    this.titleElement = document.createElement('div');
    this.titleElement.className = 'notification-title';

    content.appendChild(this.distanceElement);
    content.appendChild(this.titleElement);
    this.banner.appendChild(content);

    document.body.appendChild(this.banner);
  }

  connectNavigator(navigator) {
    this.navigator = navigator;
    navigator.on('rotate', (data) => {
      this.updateDistance();
    });
  }

  updateDistance() {
    // Use navigator's meter conversion to stay in sync with flashcards
    const distanceInMeters = this.navigator.getDistanceInMeters();
    const currentDistance = distanceInMeters.total; // Use signed distance for bidirectional support

    // Find which notification window we're in
    let shouldShow = false;
    let nextCardIndex = -1;
    let nextCardDistance = 0;

    if (this.notificationWindows) {
      // Use pre-generated notification windows
      for (const window of this.notificationWindows) {
        if (currentDistance >= window.startDistance && currentDistance < window.endDistance) {
          shouldShow = true;
          nextCardIndex = window.nextCardIndex;
          nextCardDistance = window.nextCardDistance;

          // Calculate distance to next card
          const distanceToNext = nextCardDistance - currentDistance;

          // Update content
          this.updateContent(distanceToNext, this.flashcards[nextCardIndex].title);
          break;
        }
      }
    } else {
      // Fall back to calculated notification windows
      for (let i = 0; i < this.flashcards.length - 1; i++) {
        const cardEndDistance = i * this.config.metersPerCard + this.config.cardLifetimeMeters;
        nextCardDistance = (i + 1) * this.config.metersPerCard;

        const notificationStartDistance = cardEndDistance;
        const notificationEndDistance = nextCardDistance - this.config.marginBeforeNextCard;

        if (currentDistance >= notificationStartDistance && currentDistance < notificationEndDistance) {
          shouldShow = true;
          nextCardIndex = i + 1;

          // Calculate distance to next card
          const distanceToNext = nextCardDistance - currentDistance;

          // Update content
          this.updateContent(distanceToNext, this.flashcards[nextCardIndex].title);
          break;
        }
      }
    }

    // Show or hide based on calculation
    if (shouldShow && !this.currentlyVisible) {
      this.show(nextCardIndex);
    } else if (!shouldShow && this.currentlyVisible) {
      this.hide();
    } else if (shouldShow && this.currentlyVisible && nextCardIndex !== this.currentCardIndex) {
      // Update content if we've moved to a different card's notification window
      this.currentCardIndex = nextCardIndex;
    }
  }

  updateContent(distanceMeters, nextTitle) {
    // Format distance
    let distanceText;
    if (distanceMeters < 1) {
      distanceText = `${(distanceMeters * 100).toFixed(0)} cm to next brain dump`;
    } else {
      distanceText = `${distanceMeters.toFixed(1)} m to next brain dump`;
    }

    this.distanceElement.textContent = distanceText;
    this.titleElement.textContent = `${nextTitle}`;
  }

  show(cardIndex) {
    this.currentlyVisible = true;
    this.currentCardIndex = cardIndex;
    this.banner.classList.add('visible');
  }

  hide() {
    this.currentlyVisible = false;
    this.currentCardIndex = -1;
    this.banner.classList.remove('visible');
  }
}
