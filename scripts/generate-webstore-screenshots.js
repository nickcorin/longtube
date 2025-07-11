import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateWebstoreScreenshots() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const docsDir = path.join(__dirname, '..', 'docs');
  const imagesDir = path.join(docsDir, 'images');

  const screenshots = [
    // Promotional Images
    {
      input: path.join(docsDir, 'promo-small-440x280.html'),
      output: path.join(imagesDir, 'promo-small-440x280.png'),
      width: 440,
      height: 280,
      description: 'Small promotional tile (required for Chrome Web Store)',
    },
    {
      input: path.join(docsDir, 'promo-marquee-1400x560.html'),
      output: path.join(imagesDir, 'promo-marquee-1400x560.png'),
      width: 1400,
      height: 560,
      description: 'Marquee promotional banner (recommended)',
    },
    {
      input: path.join(docsDir, 'promo-large-920x680.html'),
      output: path.join(imagesDir, 'promo-large-920x680.png'),
      width: 920,
      height: 680,
      description: 'Large promotional tile (optional)',
    },
    // Screenshots
    {
      input: path.join(docsDir, 'screenshot-popup-1280x800.html'),
      output: path.join(imagesDir, 'screenshot-popup-1280x800.png'),
      width: 1280,
      height: 800,
      description: 'Screenshot of the extension popup UI',
    },
  ];

  console.log('Generating Chrome Web Store screenshots...\n');
  console.log(`HTML templates: ${docsDir}`);
  console.log(`Output images: ${imagesDir}\n`);

  for (const screenshot of screenshots) {
    try {
      const page = await browser.newPage();
      await page.setViewport({
        width: screenshot.width,
        height: screenshot.height,
        deviceScaleFactor: 1, // Chrome Web Store requires exact pixel dimensions
      });

      // Disable cache to ensure fresh images
      await page.setCacheEnabled(false);
      
      const filePath = `file://${screenshot.input}`;
      await page.goto(filePath, { waitUntil: 'networkidle0' });

      // Wait a bit for any animations or loading
      await new Promise((r) => setTimeout(r, 1000));

      // Always capture full viewport to ensure exact dimensions
      await page.screenshot({
        path: screenshot.output,
        fullPage: false,
        type: 'png',
        omitBackground: true,
      });

      console.log(`✓ ${path.basename(screenshot.output)}`);
      console.log(`  ${screenshot.description}`);
      console.log('');
    } catch (error) {
      console.error(`✗ Error creating ${path.basename(screenshot.output)}:`, error.message);
    }
  }

  await browser.close();
  console.log('Screenshot generation complete!');
  console.log('\nReady for Chrome Web Store submission:');
  console.log('- Small promo tile (required): docs/images/promo-small-440x280.png');
  console.log('- Marquee banner (recommended): docs/images/promo-marquee-1400x560.png');
  console.log('- Screenshots (1-5 allowed): docs/images/screenshot-*.png');
}

generateWebstoreScreenshots().catch(console.error);
