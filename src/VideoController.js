export class VideoController {
  constructor(videoElement) {
    this.video = videoElement;
    this.fps = 30;
    this.duration = 0;
    this.totalFrames = 0;
    this.isSeeking = false;
    this.pendingSeek = false;
    this.rafId = null;
    this.currentFrame = 0;
    this.targetFrame = 0;

    // Optional CircularNavigator
    this.navigator = null;

    this.init();
  }

  init() {
    this.video.addEventListener('loadedmetadata', () => {
      this.duration = this.video.duration;
      this.detectFPS();
      this.totalFrames = Math.floor(this.duration * this.fps);
      console.log('Video duration:', this.duration);
      console.log('Total frames:', this.totalFrames);
      console.log('FPS:', this.fps);
    });

    this.video.addEventListener('seeking', () => {
      this.isSeeking = true;
    });

    this.video.addEventListener('seeked', () => {
      this.isSeeking = false;
      if (this.pendingSeek) {
        this.pendingSeek = false;
        this.updateVideo();
      }
    });
  }

  // Connect to a CircularNavigator
  connectNavigator(navigator) {
    this.navigator = navigator;

    // Listen to navigator events
    navigator.on('start', (data) => {
      // Sync navigator value with current video frame
      this.currentFrame = this.getCurrentFrame();
      this.navigator.setValue(this.currentFrame);
    });

    navigator.on('rotate', (data) => {
      // Calculate new frame based on navigator delta
      let newFrame = this.currentFrame + data.delta;

      // Clamp to video bounds
      if (this.totalFrames > 0) {
        newFrame = Math.max(0, Math.min(this.totalFrames - 1, newFrame));
      }

      this.currentFrame = newFrame;
      this.setFrame(newFrame);
    });

    navigator.on('end', (data) => {
      this.cancelPendingUpdate();
    });

    return this;
  }

  detectFPS() {
    if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
      let lastTime = null;
      let frameCount = 0;
      let fpsSum = 0;

      const measureFPS = (now, metadata) => {
        if (lastTime !== null && metadata.mediaTime > 0) {
          const timeDelta = metadata.mediaTime - lastTime;

          // Only count valid frame deltas
          if (timeDelta > 0 && isFinite(timeDelta)) {
            const fps = 1 / timeDelta;

            // Sanity check: FPS should be reasonable (between 1 and 240)
            if (fps > 1 && fps < 240 && isFinite(fps)) {
              fpsSum += fps;
              frameCount++;
            }
          }

          if (frameCount >= 10) {
            const detectedFPS = Math.round(fpsSum / frameCount);
            if (isFinite(detectedFPS) && detectedFPS > 0) {
              this.fps = detectedFPS;
              this.totalFrames = Math.floor(this.duration * this.fps);
              console.log('Detected FPS:', this.fps);
            }
            return;
          }
        }
        lastTime = metadata.mediaTime;
        this.video.requestVideoFrameCallback(measureFPS);
      };

      this.video.play().then(() => {
        this.video.requestVideoFrameCallback(measureFPS);
        setTimeout(() => {
          this.video.pause();
          this.video.currentTime = 0;
        }, 500);
      }).catch(() => {
        console.log('Could not detect FPS, using default:', this.fps);
      });
    } else {
      console.log('requestVideoFrameCallback not supported, using default FPS:', this.fps);
    }
  }

  getCurrentFrame() {
    return this.video.currentTime * this.fps;
  }

  setFrame(frameNumber) {
    // Validate frame number is finite
    if (!isFinite(frameNumber)) {
      console.warn('Invalid frame number:', frameNumber);
      return;
    }

    this.targetFrame = Math.max(0, Math.min(this.totalFrames - 1, frameNumber));

    if (!this.rafId) {
      this.rafId = requestAnimationFrame(() => this.updateVideo());
    }
  }

  updateVideo() {
    this.rafId = null;

    if (!this.isSeeking) {
      const targetTime = this.targetFrame / this.fps;

      // Validate that targetTime is finite and within video duration
      if (isFinite(targetTime) && targetTime >= 0 && targetTime <= this.duration) {
        this.video.currentTime = targetTime;
        this.currentFrame = this.targetFrame;
      } else {
        console.warn('Invalid target time:', targetTime, 'fps:', this.fps, 'frame:', this.targetFrame);
      }
    } else {
      this.pendingSeek = true;
    }
  }

  getTotalFrames() {
    return this.totalFrames;
  }

  getFPS() {
    return this.fps;
  }

  cancelPendingUpdate() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}
