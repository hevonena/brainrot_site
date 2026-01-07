import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createCanvas, loadImage, registerFont } from 'canvas';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const PROJECT_ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');
const FONT_PATH = path.join(PUBLIC_DIR, 'font', 'RuderPlakatLL-Regular.otf');
const FLASHCARDS_PATH = path.join(PUBLIC_DIR, 'flashcards.json');
const MANIFEST_PATH = path.join(PUBLIC_DIR, 'content-manifest.json');

// Input directories (check dist first, then public)
const INPUT_DIRS = [
  path.join(DIST_DIR, 'content', 'gen-z'),
  path.join(PUBLIC_DIR, 'content', 'gen-z')
];
const OUTPUT_DIR = path.join(PUBLIC_DIR, 'content', 'gen-z-rendered');

// Quality scale factor (2x for higher quality)
const SCALE = 2;

// Target aspect ratio: 9:16 portrait
const TARGET_ASPECT = 9 / 16;

// Emojis used on the website with their Apple emoji CDN codes
// Using emoji.aranja.com which serves Apple emojis
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

// Helper: Load emoji image from Apple emoji CDN
async function loadEmojiImage(emojiCode) {
  if (emojiCache.has(emojiCode)) {
    return emojiCache.get(emojiCode);
  }

  try {
    // Try multiple sources for Apple emojis
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

    console.warn(`  Warning: Could not load emoji ${emojiCode}`);
    return null;
  } catch (error) {
    console.warn(`  Warning: Could not load emoji ${emojiCode}: ${error.message}`);
    return null;
  }
}

// Helper: Draw emoji with black outline
async function drawEmojiWithOutline(ctx, emojiCode, x, y, size, outlineWidth) {
  const emojiImage = await loadEmojiImage(emojiCode);
  if (!emojiImage) return;

  // Draw black outline by drawing the emoji multiple times around the center
  // First, create a temporary canvas to make the emoji black
  const tempCanvas = createCanvas(size + outlineWidth * 2, size + outlineWidth * 2);
  const tempCtx = tempCanvas.getContext('2d');

  // Draw emoji in center of temp canvas
  tempCtx.drawImage(emojiImage, outlineWidth, outlineWidth, size, size);

  // Get image data and make it black (keep alpha)
  const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 0) { // If pixel has alpha
      data[i] = 0;     // R
      data[i + 1] = 0; // G
      data[i + 2] = 0; // B
    }
  }
  tempCtx.putImageData(imageData, 0, 0);

  // Draw the black version multiple times around center position to create outline
  const offsets = [];
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
    offsets.push({
      x: Math.cos(angle) * outlineWidth,
      y: Math.sin(angle) * outlineWidth
    });
  }

  for (const offset of offsets) {
    ctx.drawImage(tempCanvas,
      x - outlineWidth + offset.x,
      y - outlineWidth + offset.y
    );
  }

  // Draw the colored emoji on top
  ctx.drawImage(emojiImage, x, y, size, size);
}

// Helper: Wrap text to fit within maxWidth
function wrapText(ctx, words, maxWidth, fontSize) {
  const lines = [];
  let currentLine = '';

  ctx.font = `900 ${fontSize}px "Ruder", sans-serif`;

  for (const word of words) {
    if (word.type === 'emoji') {
      // Emoji - treat as a word
      const testLine = currentLine ? currentLine + ' [E]' : '[E]';
      const testWidth = ctx.measureText(testLine.replace(/\[E\]/g, 'MM')).width;

      if (testWidth > maxWidth && currentLine) {
        lines.push({ text: currentLine, endsWithEmoji: false });
        currentLine = '[E:' + word.code + ']';
      } else {
        currentLine = currentLine ? currentLine + ' [E:' + word.code + ']' : '[E:' + word.code + ']';
      }
    } else {
      // Regular text word
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

// Helper: Parse text into words (text and emoji placeholders)
function parseTextIntoWords(text, emojis) {
  const words = [];
  const textWords = text.split(' ').filter(w => w.length > 0);

  for (const word of textWords) {
    words.push({ type: 'text', text: word });
  }

  // Add emojis at the end
  for (const emoji of emojis) {
    words.push({ type: 'emoji', code: emoji.code, char: emoji.char });
  }

  return words;
}

// Helper: Draw a line with text and emojis
async function drawLine(ctx, lineText, centerX, y, fontSize, strokeWidth, emojiSize) {
  // Parse the line to find emoji placeholders
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

  // Calculate total width
  let totalWidth = 0;
  ctx.font = `900 ${fontSize}px "Ruder", sans-serif`;

  for (const part of parts) {
    if (part.type === 'text') {
      totalWidth += ctx.measureText(part.content).width;
    } else {
      totalWidth += emojiSize;
    }
  }

  // Draw from center
  let x = centerX - totalWidth / 2;

  for (const part of parts) {
    if (part.type === 'text') {
      ctx.font = `900 ${fontSize}px "Ruder", sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      // Draw black stroke
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = strokeWidth * 2;
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.strokeText(part.content, x, y);

      // Draw white fill
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(part.content, x, y);

      x += ctx.measureText(part.content).width;
    } else {
      // Draw emoji with outline
      const emojiY = y - emojiSize / 2;
      await drawEmojiWithOutline(ctx, part.code, x, emojiY, emojiSize, strokeWidth);
      x += emojiSize;
    }
  }
}

// Helper: Calculate 9:16 crop dimensions (centered)
function calculate916Crop(width, height) {
  const currentAspect = width / height;

  let cropWidth, cropHeight, cropX, cropY;

  if (currentAspect > TARGET_ASPECT) {
    // Image is wider than 9:16, crop sides
    cropHeight = height;
    cropWidth = height * TARGET_ASPECT;
    cropX = (width - cropWidth) / 2;
    cropY = 0;
  } else {
    // Image is taller than 9:16, crop top/bottom
    cropWidth = width;
    cropHeight = width / TARGET_ASPECT;
    cropX = 0;
    cropY = (height - cropHeight) / 2;
  }

  return { cropX, cropY, cropWidth, cropHeight };
}

// Find input file in available directories
function findInputFile(filename) {
  for (const dir of INPUT_DIRS) {
    const filePath = path.join(dir, filename);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }
  return null;
}

async function renderImage(imagePath, flashcard, outputPath) {
  // Load the image
  const image = await loadImage(imagePath);
  const { width, height } = image;

  // Calculate 9:16 crop
  const crop = calculate916Crop(width, height);

  // Create canvas at cropped dimensions with scale
  const outputWidth = Math.round(crop.cropWidth);
  const outputHeight = Math.round(crop.cropHeight);

  const canvas = createCanvas(outputWidth * SCALE, outputHeight * SCALE);
  const ctx = canvas.getContext('2d');

  // Enable high-quality rendering
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Scale for high-res
  ctx.scale(SCALE, SCALE);

  // Draw the cropped image
  ctx.drawImage(
    image,
    crop.cropX, crop.cropY, crop.cropWidth, crop.cropHeight,  // Source
    0, 0, outputWidth, outputHeight  // Destination
  );

  // Prepare the text and emojis
  const textContent = flashcard.genZ.toLowerCase();
  const emojis = getRandomEmojis();
  const words = parseTextIntoWords(textContent, emojis);

  // Calculate font size - BIGGER (approximately 9% of image width)
  const baseFontSize = Math.min(Math.max(outputWidth * 0.09, 40), 140);
  const fontSize = baseFontSize;

  // Emoji size matches font
  const emojiSize = fontSize * 1.0;

  // Calculate max width for text wrapping (85% of image width)
  const maxWidth = outputWidth * 0.85;

  // Wrap the text
  const lines = wrapText(ctx, words, maxWidth, fontSize);

  // Calculate line height
  const lineHeight = fontSize * 1.3;

  // Calculate total text block height
  const totalHeight = lines.length * lineHeight;

  // Starting Y position (centered)
  const startY = (outputHeight - totalHeight) / 2 + lineHeight / 2;

  // Stroke width for outline
  const strokeWidth = Math.max(5, fontSize * 0.1);

  // Draw each line
  for (let i = 0; i < lines.length; i++) {
    const y = startY + i * lineHeight;
    await drawLine(ctx, lines[i].text, outputWidth / 2, y, fontSize, strokeWidth, emojiSize);
  }

  // Save the image
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);

  console.log(`  Rendered: ${path.basename(outputPath)} (${outputWidth}x${outputHeight})`);
}

async function main() {
  console.log('Gen-Z Image Renderer');
  console.log('====================\n');
  console.log(`Quality: ${SCALE}x scale`);
  console.log(`Format: 9:16 portrait crop`);
  console.log(`Font size: ~9% of image width`);
  console.log(`Emojis: Apple style with black outline\n`);

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`Created output directory: ${OUTPUT_DIR}\n`);
  }

  // Load flashcards
  const flashcards = JSON.parse(fs.readFileSync(FLASHCARDS_PATH, 'utf-8'));
  console.log(`Loaded ${flashcards.length} flashcards`);

  // Load manifest
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));

  // Filter gen-z images from manifest
  const genzItems = manifest.filter(item => item.isGenZ === true);
  console.log(`Found ${genzItems.length} gen-z images to render\n`);

  // Process each image
  let successCount = 0;
  let errorCount = 0;

  for (const item of genzItems) {
    const filename = path.basename(item.src);
    const inputPath = findInputFile(filename);
    const outputFilename = filename.replace(/\.(png|jpg|jpeg)$/i, '.png');
    const outputPath = path.join(OUTPUT_DIR, outputFilename);

    if (!inputPath) {
      console.log(`  Skipped (not found): ${filename}`);
      errorCount++;
      continue;
    }

    try {
      const flashcard = flashcards[item.flashcardIndex];
      if (!flashcard || !flashcard.genZ) {
        console.log(`  Skipped (no flashcard): ${filename}`);
        errorCount++;
        continue;
      }

      await renderImage(inputPath, flashcard, outputPath);
      successCount++;
    } catch (error) {
      console.error(`  Error rendering ${filename}: ${error.message}`);
      errorCount++;
    }
  }

  console.log(`\nDone! Rendered ${successCount} images, ${errorCount} skipped/errors`);
  console.log(`Output: ${OUTPUT_DIR}`);
}

main().catch(console.error);
