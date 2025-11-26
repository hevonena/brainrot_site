/**
 * DistanceGenerator - Generates card spawn distances for flashcards
 * Supports both fixed intervals and random spacing
 */
export class DistanceGenerator {
  /**
   * Generate distances for flashcards
   * @param {number} cardCount - Number of cards
   * @param {Object} options - Configuration options
   * @param {string} options.mode - 'fixed' or 'random'
   * @param {number} options.metersPerCard - Base distance between cards (for fixed mode or random average)
   * @param {number} options.randomMinMeters - Minimum distance between cards (random mode only)
   * @param {number} options.randomMaxMeters - Maximum distance between cards (random mode only)
   * @returns {Array} Array of spawn distances for each card
   */
  static generateDistances(cardCount, options = {}) {
    const {
      mode = 'fixed',
      metersPerCard = 5,
      randomMinMeters = 3,
      randomMaxMeters = 15
    } = options;

    const distances = [];

    if (mode === 'random') {
      // Random mode: each card appears at a random interval from the previous one
      let currentDistance = 0;

      for (let i = 0; i < cardCount; i++) {
        distances.push(currentDistance);

        // Generate random distance to next card
        const randomInterval = randomMinMeters + Math.random() * (randomMaxMeters - randomMinMeters);
        currentDistance += randomInterval;
      }
    } else {
      // Fixed mode: cards appear at regular intervals
      for (let i = 0; i < cardCount; i++) {
        distances.push(i * metersPerCard);
      }
    }

    return distances;
  }

  /**
   * Generate notification windows based on card distances
   * @param {Array} cardDistances - Array of card spawn distances
   * @param {number} cardLifetimeMeters - How long each card is visible
   * @param {number} marginBeforeNextCard - Distance margin before next card where notification should disappear
   * @returns {Array} Array of notification windows: [{ startDistance, endDistance, nextCardIndex, nextCardDistance }]
   */
  static generateNotificationWindows(cardDistances, cardLifetimeMeters, marginBeforeNextCard) {
    const windows = [];

    // Create a notification between each pair of cards
    for (let i = 0; i < cardDistances.length - 1; i++) {
      const cardEndDistance = cardDistances[i] + cardLifetimeMeters;
      const nextCardDistance = cardDistances[i + 1];

      // Notification starts when current card disappears
      const notificationStart = cardEndDistance;

      // Notification ends at margin before next card
      const notificationEnd = nextCardDistance - marginBeforeNextCard;

      // Only create notification if there's space for it (at least some gap)
      if (notificationEnd > notificationStart) {
        windows.push({
          startDistance: notificationStart,
          endDistance: notificationEnd,
          nextCardIndex: i + 1,
          nextCardDistance: nextCardDistance
        });
      }
    }

    return windows;
  }

  /**
   * Get card lifecycle information for a specific card
   * @param {number} cardIndex - Index of the card
   * @param {Array} cardDistances - Array of card spawn distances
   * @param {number} cardLifetimeMeters - How long each card is visible
   * @returns {Object} { spawnDistance, disappearDistance }
   */
  static getCardLifecycle(cardIndex, cardDistances, cardLifetimeMeters) {
    if (cardIndex < 0 || cardIndex >= cardDistances.length) {
      return null;
    }

    return {
      spawnDistance: cardDistances[cardIndex],
      disappearDistance: cardDistances[cardIndex] + cardLifetimeMeters
    };
  }
}
