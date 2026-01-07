import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createCanvas, loadImage, registerFont } from 'canvas';
import { execSync } from 'child_process';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const PROJECT_ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');
const FONT_PATH = path.join(PUBLIC_DIR, 'font', 'RuderPlakatLL-Regular.otf');
const FLASHCARDS_PATH = path.join(PUBLIC_DIR, 'flashcards.json');

const INPUT_DIR = path.join(PUBLIC_DIR, 'content', 'videos');
const OUTPUT_DIR = path.join(PUBLIC_DIR, 'content', 'videos-rendered');
const TEMP_DIR = path.join(PROJECT_ROOT, 'scripts', 'temp-overlays');

// Target aspect ratio: 9:16 portrait
const TARGET_ASPECT = 9 / 16;

// Emojis with Apple emoji CDN codes
const GENZ_EMOJIS = [
  { char: '💀', code: '1f480' },
  { char: '😭', code: '1f62d' },
  { char: '🔥', code: '1f525' },
  { char: '💯', code: '1f4af' },
  { char: '🤡', code: '1f921' },
  { char: '👀', code: '1f440' },
  { char: '😩', code: '1f629' },
  { char: '🙏', code: '1f64f' },
  { char: '⚡', code: '26a1' },
  { char: '🧠', code: '1f9e0' },
  { char: '📱', code: '1f4f1' },
  { char: '🎭', code: '1f3ad' }
];

// Cache for loaded emoji images
const emojiCache = new Map();

// Register the Ruder font
registerFont(FONT_PATH, { family: 'Ruder', weight: '900' });

// Helper: Get random emojis (1-2)
function getRandomEmojis() {
  const numEmojis = Math.random() > 0.5 ? 2 : 1;
  const emojis = [];
  for (let i = 0; i < numEmojis; i++) {
    const randomIndex = Math.floor(Math.random() * GENZ_EMOJIS.length);
    emojis.push(GENZ_EMOJIS[randomIndex]);
  }
  return emojis;
}

// Helper: Get random flashcard
function getRandomFlashcard(flashcards) {
  const index = Math.floor(Math.random() * flashcards.length);
  return flashcards[index];
}

// Helper: Load emoji image from Apple emoji CDN
async function loadEmojiImage(emojiCode) {
  if (emojiCache.has(emojiCode)) {
    return emojiCache.get(emojiCode);
  }

  try {
    const urls = [
      `https://em-content.zobj.net/source/apple/391/${emojiCode}.png`,
      `https://raw.githubusercontent.com/iamcal/emoji-data/master/img-apple-160/${emojiCode}.png`,
    ];

    for (const url of urls) {
      try {
        const image = await loadImage(url);
        emojiCache.set(emojiCode, image);
        return image;
      } catch (e) {
        continue;
      }
    }
    return null;
  } catch (error) {
    return null;
  }
}

// Helper: Draw emoji with black outline
async function drawEmojiWithOutline(ctx, emojiCode, x, y, size, outlineWidth) {
  const emojiImage = await loadEmojiImage(emojiCode);
  if (!emojiImage) return;

  const tempCanvas = createCanvas(size + outlineWidth * 2, size + outlineWidth * 2);
  const tempCtx = tempCanvas.getContext('2d');

  tempCtx.drawImage(emojiImage, outlineWidth, outlineWidth, size, size);

  const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 0) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
    }
  }
  tempCtx.putImageData(imageData, 0, 0);

  const offsets = [];
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
    offsets.push({
      x: Math.cos(angle) * outlineWidth,
      y: Math.sin(angle) * outlineWidth
    });
  }

  for (const offset of offsets) {
    ctx.drawImage(tempCanvas, x - outlineWidth + offset.x, y - outlineWidth + offset.y);
  }

  ctx.drawImage(emojiImage, x, y, size, size);
}

// Helper: Parse text into words
function parseTextIntoWords(text, emojis) {
  const words = [];
  const textWords = text.split(' ').filter(w => w.length > 0);

  for (const word of textWords) {
    words.push({ type: 'text', text: word });
  }

  for (const emoji of emojis) {
    words.push({ type: 'emoji', code: emoji.code, char: emoji.char });
  }

  return words;
}

// Helper: Wrap text
function wrapText(ctx, words, maxWidth, fontSize) {
  const lines = [];
  let currentLine = '';

  ctx.font = `900 ${fontSize}px "Ruder", sans-serif`;

  for (const word of words) {
    if (word.type === 'emoji') {
      const testLine = currentLine ? currentLine + ' [E]' : '[E]';
      const testWidth = ctx.measureText(testLine.replace(/\[E\]/g, 'MM')).width;

      if (testWidth > maxWidth && currentLine) {
        lines.push({ text: currentLine });
        currentLine = '[E:' + word.code + ']';
      } else {
        currentLine = currentLine ? currentLine + ' [E:' + word.code + ']' : '[E:' + word.code + ']';
      }
    } else {
      const testLine = currentLine ? `${currentLine} ${word.text}` : word.text;
      const metrics = ctx.measureText(testLine.replace(/\[E:[^\]]+\]/g, 'MM'));

      if (metrics.width > maxWidth && currentLine) {
        lines.push({ text: currentLine });
        currentLine = word.text;
      } else {
        currentLine = testLine;
      }
    }
  }

  if (currentLine) {
    lines.push({ text: currentLine });
  }

  return lines;
}

// Helper: Draw a line with text and emojis
async function drawLine(ctx, lineText, centerX, y, fontSize, strokeWidth, emojiSize) {
  const parts = [];
  let remaining = lineText;

  while (remaining.length > 0) {
    const emojiMatch = remaining.match(/\[E:([^\]]+)\]/);
    if (emojiMatch) {
      const beforeEmoji = remaining.slice(0, emojiMatch.index);
      if (beforeEmoji) {
        parts.push({ type: 'text', content: beforeEmoji });
      }
      parts.push({ type: 'emoji', code: emojiMatch[1] });
      remaining = remaining.slice(emojiMatch.index + emojiMatch[0].length);
    } else {
      parts.push({ type: 'text', content: remaining });
      break;
    }
  }

  let totalWidth = 0;
  ctx.font = `900 ${fontSize}px "Ruder", sans-serif`;

  for (const part of parts) {
    if (part.type === 'text') {
      totalWidth += ctx.measureText(part.content).width;
    } else {
      totalWidth += emojiSize;
    }
  }

  let x = centerX - totalWidth / 2;

  for (const part of parts) {
    if (part.type === 'text') {
      ctx.font = `900 ${fontSize}px "Ruder", sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      ctx.strokeStyle = '#000000';
      ctx.lineWidth = strokeWidth * 2;
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.strokeText(part.content, x, y);

      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(part.content, x, y);

      x += ctx.measureText(part.content).width;
    } else {
      const emojiY = y - emojiSize / 2;
      await drawEmojiWithOutline(ctx, part.code, x, emojiY, emojiSize, strokeWidth);
      x += emojiSize;
    }
  }
}

// Get video dimensions using ffprobe
function getVideoDimensions(videoPath) {
  try {
    const result = execSync(
      `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "${videoPath}"`,
      { encoding: 'utf-8' }
    ).trim();
    const [width, height] = result.split('x').map(Number);
    return { width, height };
  } catch (error) {
    console.error(`Error getting video dimensions: ${error.message}`);
    return null;
  }
}

// Calculate 9:16 crop dimensions
function calculate916Crop(width, height) {
  const currentAspect = width / height;

  let cropWidth, cropHeight, cropX, cropY;

  if (currentAspect > TARGET_ASPECT) {
    cropHeight = height;
    cropWidth = Math.floor(height * TARGET_ASPECT);
    cropX = Math.floor((width - cropWidth) / 2);
    cropY = 0;
  } else {
    cropWidth = width;
    cropHeight = Math.floor(width / TARGET_ASPECT);
    cropX = 0;
    cropY = Math.floor((height - cropHeight) / 2);
  }

  // Ensure even dimensions for video encoding
  cropWidth = Math.floor(cropWidth / 2) * 2;
  cropHeight = Math.floor(cropHeight / 2) * 2;

  return { cropX, cropY, cropWidth, cropHeight };
}

// Create transparent PNG overlay
async function createOverlayPNG(flashcard, width, height, outputPath) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Transparent background
  ctx.clearRect(0, 0, width, height);

  // Prepare text and emojis
  const textContent = flashcard.genZ.toLowerCase();
  const emojis = getRandomEmojis();
  const words = parseTextIntoWords(textContent, emojis);

  // Calculate font size (~9% of width)
  const fontSize = Math.min(Math.max(width * 0.09, 40), 140);
  const emojiSize = fontSize * 1.0;
  const maxWidth = width * 0.85;

  const lines = wrapText(ctx, words, maxWidth, fontSize);
  const lineHeight = fontSize * 1.3;
  const totalHeight = lines.length * lineHeight;
  const startY = (height - totalHeight) / 2 + lineHeight / 2;
  const strokeWidth = Math.max(5, fontSize * 0.1);

  for (let i = 0; i < lines.length; i++) {
    const y = startY + i * lineHeight;
    await drawLine(ctx, lines[i].text, width / 2, y, fontSize, strokeWidth, emojiSize);
  }

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
}

// Process a single video
async function processVideo(videoPath, flashcard, outputPath, tempOverlayPath) {
  const filename = path.basename(videoPath);

  // Get video dimensions
  const dims = getVideoDimensions(videoPath);
  if (!dims) {
    throw new Error('Could not get video dimensions');
  }

  // Calculate crop for 9:16
  const crop = calculate916Crop(dims.width, dims.height);

  // Create overlay PNG at cropped dimensions
  await createOverlayPNG(flashcard, crop.cropWidth, crop.cropHeight, tempOverlayPath);

  // Build ffmpeg command:
  // 1. Crop video to 9:16
  // 2. Overlay the PNG
  const ffmpegCmd = [
    'ffmpeg',
    '-y',  // Overwrite output
    '-i', `"${videoPath}"`,  // Input video
    '-i', `"${tempOverlayPath}"`,  // Overlay image
    '-filter_complex',
    `"[0:v]crop=${crop.cropWidth}:${crop.cropHeight}:${crop.cropX}:${crop.cropY}[cropped];[cropped][1:v]overlay=0:0"`,
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '23',
    '-c:a', 'aac',
    '-b:a', '128k',
    `"${outputPath}"`
  ].join(' ');

  try {
    execSync(ffmpegCmd, { stdio: 'pipe' });
    console.log(`  Rendered: ${filename} (${crop.cropWidth}x${crop.cropHeight})`);
  } catch (error) {
    // Try without audio if it fails (some videos might not have audio)
    const ffmpegCmdNoAudio = [
      'ffmpeg',
      '-y',
      '-i', `"${videoPath}"`,
      '-i', `"${tempOverlayPath}"`,
      '-filter_complex',
      `"[0:v]crop=${crop.cropWidth}:${crop.cropHeight}:${crop.cropX}:${crop.cropY}[cropped];[cropped][1:v]overlay=0:0"`,
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '23',
      '-an',  // No audio
      `"${outputPath}"`
    ].join(' ');

    execSync(ffmpegCmdNoAudio, { stdio: 'pipe' });
    console.log(`  Rendered: ${filename} (${crop.cropWidth}x${crop.cropHeight}) [no audio]`);
  }
}

async function main() {
  console.log('Gen-Z Video Renderer');
  console.log('====================\n');
  console.log(`Format: 9:16 portrait crop`);
  console.log(`Text: Random flashcard per video`);
  console.log(`Emojis: Apple style with black outline\n`);

  // Ensure directories exist
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }

  // Load flashcards
  const flashcards = JSON.parse(fs.readFileSync(FLASHCARDS_PATH, 'utf-8'));
  console.log(`Loaded ${flashcards.length} flashcards`);

  // Get video files
  const videoFiles = fs.readdirSync(INPUT_DIR)
    .filter(f => f.endsWith('.mp4'))
    .map(f => path.join(INPUT_DIR, f));

  console.log(`Found ${videoFiles.length} videos to render\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const videoPath of videoFiles) {
    const filename = path.basename(videoPath);
    const outputPath = path.join(OUTPUT_DIR, filename);
    const tempOverlayPath = path.join(TEMP_DIR, `overlay_${filename}.png`);

    try {
      const flashcard = getRandomFlashcard(flashcards);
      await processVideo(videoPath, flashcard, outputPath, tempOverlayPath);
      successCount++;

      // Clean up temp file
      if (fs.existsSync(tempOverlayPath)) {
        fs.unlinkSync(tempOverlayPath);
      }
    } catch (error) {
      console.error(`  Error rendering ${filename}: ${error.message}`);
      errorCount++;
    }
  }

  // Clean up temp directory
  if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true });
  }

  console.log(`\nDone! Rendered ${successCount} videos, ${errorCount} errors`);
  console.log(`Output: ${OUTPUT_DIR}`);
}

main().catch(console.error);
