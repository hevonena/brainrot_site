import './style.css'
import { MilestoneCelebration } from './MilestoneCelebration.js'
import { ScrollNavigator } from './ScrollNavigator.js'
import { InfiniteScroll } from './InfiniteScroll.js'
import { IntroSequence } from './IntroSequence.js'

// Get DOM elements
const interactionArea = document.getElementById('interactionArea');

const navigator = new ScrollNavigator(interactionArea);

// Initialize milestone celebration
// Uses same bubble images as intro: bubble.png, bubble_1.png, etc.
const milestoneCelebration = new MilestoneCelebration({
  duration: 3500
});

// NOTE: Don't connect milestone celebration yet - wait for intro to complete

// Log screen info on first rotation
let hasLoggedScreenInfo = false;

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
});

// Initialize components
async function initializeApp() {
  try {
    // Initialize infinite scroll (includes gen-z overlays)
    const infiniteScroll = new InfiniteScroll();
    await infiniteScroll.init();

    // NOTE: Don't connect navigator yet - intro will control scrolling first

    // Create and start intro sequence
    const introSequence = new IntroSequence({
      // Bubble images: bubble.png, bubble_1.png, bubble_2.png, etc.
      // Add more images to /content/bubbles/ and they'll be picked randomly
      autoScrollSpeed: 60,
      bubbleDelay: 500,
      onComplete: () => {
        // After intro, connect navigator for user control
        infiniteScroll.connectNavigator(navigator);
        milestoneCelebration.connectNavigator(navigator);
        console.log('Intro complete - user control enabled');
      }
    });

    // Connect intro to infinite scroll for auto-scroll control
    introSequence.connectInfiniteScroll(infiniteScroll);

    // Start the intro sequence
    introSequence.start();

    console.log('App initialized with intro sequence');
  } catch (error) {
    console.error('Failed to initialize app:', error);
  }
}

// Initialize the app
initializeApp();
