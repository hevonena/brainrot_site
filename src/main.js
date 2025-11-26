import './style.css'
// import { VideoController } from './VideoController.js'
// import { CircularNavigator } from './CircularNavigator.js'
import { DistanceDisplay } from './DistanceDisplay.js'
import { FlashcardOverlay } from './FlashcardOverlay.js'
import { ScrollNavigator } from './ScrollNavigator.js'
import NotificationBanner from './NotificationBanner.js'
import { DistanceGenerator } from './DistanceGenerator.js'
import { InfiniteScroll } from './InfiniteScroll.js'

// Get DOM elements
// const video = document.getElementById('backgroundVideo');
const interactionArea = document.getElementById('interactionArea');

// // Initialize circular navigator (generic, reusable - no UI dependencies)
// const navigator = new CircularNavigator(interactionArea, {
//   stepsPerRotation: 150,
//   showTrail: true
// });
const navigator = new ScrollNavigator(interactionArea);

// Initialize video controller
// const videoController = new VideoController(video);

// Initialize distance display UI
const distanceDisplay = new DistanceDisplay({
  showAbsolute: false,
  showSigned: true
});

// Connect the navigator to the video controller
// videoController.connectNavigator(navigator);

// Connect the distance display to the navigator
distanceDisplay.connectNavigator(navigator);

// Log distance info on first rotation
let hasLoggedScreenInfo = false;

// Log signed distance for debugging
navigator.on('rotate', (data) => {
  // Log screen info once
  if (!hasLoggedScreenInfo) {
    const screenInfo = ScrollNavigator.estimatePixelsPerMeter();
    console.log('Screen Info:');
    console.log('  Estimated PPI:', screenInfo.estimatedPPI);
    console.log('  Device Pixel Ratio:', screenInfo.devicePixelRatio);
    console.log('  Pixels per meter:', screenInfo.pixelsPerMeter.toFixed(2));
    console.log('---');
    hasLoggedScreenInfo = true;
  }

  // Get distance in meters
//   const distanceInMeters = navigator.getDistanceInMeters();

//   console.log('Distance (px):', data.distance.total.toFixed(2) + 'px',
//               '| Distance (m):', distanceInMeters.total.toFixed(4) + 'm',
//               '| Delta (m):', (data.distance.delta / distanceInMeters.pixelsPerMeter).toFixed(6) + 'm',
//               '| Direction:', data.direction);
});

// Distance configuration for cards and notifications
const distanceConfig = {
  mode: 'random', // 'fixed' or 'random'
  metersPerCard: 10, // Base distance between cards (for fixed mode or random average)
  cardLifetimeMeters: 1.0, // Each card remains visible for 1 meter
  marginBeforeNextCard: 0.0, // Notification disappears this many meters before next card
  randomMinMeters: 2, // Minimum distance between cards (random mode only)
  randomMaxMeters: 8, // Maximum distance between cards (random mode only)
};

// Initialize components with distance generation
async function initializeApp() {
  try {
    // Initialize infinite scroll background
    const infiniteScroll = new InfiniteScroll();
    await infiniteScroll.init();
    infiniteScroll.connectNavigator(navigator);

    // Load flashcards first to know the count
    const response = await fetch('/flashcards.json');
    const flashcards = await response.json();

    console.log(`Loaded ${flashcards.length} flashcards`);

    // Generate card distances based on mode
    const cardDistances = DistanceGenerator.generateDistances(flashcards.length, {
      mode: distanceConfig.mode,
      metersPerCard: distanceConfig.metersPerCard,
      randomMinMeters: distanceConfig.randomMinMeters,
      randomMaxMeters: distanceConfig.randomMaxMeters
    });

    // Generate notification windows based on card distances
    const notificationWindows = DistanceGenerator.generateNotificationWindows(
      cardDistances,
      distanceConfig.cardLifetimeMeters,
      distanceConfig.marginBeforeNextCard
    );

    console.log(`Generated ${cardDistances.length} card distances (${distanceConfig.mode} mode)`);
    console.log(`Generated ${notificationWindows.length} notification windows`);

    // Detect mobile for different rest positions
    const isMobile = window.innerWidth < 768;

    // Initialize flashcard overlay with pre-generated distances
    const flashcardOverlay = new FlashcardOverlay({
      metersPerCard: distanceConfig.metersPerCard,
      cardLifetimeMeters: distanceConfig.cardLifetimeMeters,
      cardDistances: cardDistances,
      // Animation phases (as percentage of cardLifetimeMeters)
      questionEnterEnd: 0.15, // Question finishes entering at 15%
      answerEnterStart: 0.15, // Answer starts entering at 15%
      answerEnterEnd: 0.35, // Answer finishes entering at 35%
      exitStart: 0.70, // Both start exiting at 70%
      // Rest positions (from bottom of screen, 0-1) - higher on mobile
      questionRestY: isMobile ? 0.40 : 0.35,
      answerRestY: isMobile ? 0.29 : 0.22
    });

    await flashcardOverlay.init();

    // Connect the flashcard overlay to the navigator for distance tracking
    flashcardOverlay.connectNavigator(navigator);

    // Create notification banner with pre-generated windows
    const notificationBanner = new NotificationBanner(flashcards, {
      ...distanceConfig,
      notificationWindows: notificationWindows // Pass pre-generated notification windows
    });

    // Connect the notification banner to the navigator
    notificationBanner.connectNavigator(navigator);

    console.log('App initialized successfully');
  } catch (error) {
    console.error('Failed to initialize app:', error);
  }
}

// Initialize the app
initializeApp();
