import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const docsDir = path.join(__dirname, '..', 'docs');
const imagesDir = path.join(docsDir, 'images');

const targets = [
  {
    html: 'promo-small-440x280.html',
    png: 'promo-small-440x280.png',
    width: 440,
    height: 280,
    description: 'Small promotional tile',
  },
  {
    html: 'promo-marquee-1400x560.html',
    png: 'promo-marquee-1400x560.png',
    width: 1400,
    height: 560,
    description: 'Marquee promotional banner',
  },
  {
    html: 'promo-large-920x680.html',
    png: 'promo-large-920x680.png',
    width: 920,
    height: 680,
    description: 'Large promotional tile',
  },
  {
    html: 'screenshot-popup-1280x800.html',
    png: 'screenshot-popup-1280x800.png',
    width: 1280,
    height: 800,
    description: 'Extension popup screenshot',
  },
];

const renderTarget = async (browser, target) => {
  const page = await browser.newPage();
  try {
    await page.setViewport({
      width: target.width,
      height: target.height,
      deviceScaleFactor: 1,
    });
    await page.setCacheEnabled(false);
    await page.goto(`file://${path.join(docsDir, target.html)}`, { waitUntil: 'networkidle0' });
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await page.screenshot({
      path: path.join(imagesDir, target.png),
      type: 'png',
      fullPage: false,
      omitBackground: true,
    });
    console.log(`✓ ${target.png} - ${target.description}`);
  } finally {
    await page.close();
  }
};

const main = async () => {
  console.log('Generating web store screenshots...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    for (const target of targets) {
      await renderTarget(browser, target);
    }
  } finally {
    await browser.close();
  }

  console.log('Done.');
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
