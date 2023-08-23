import debug from 'debug';
import * as puppeteer from 'puppeteer';
import { KnownDevices } from 'puppeteer';
const iPhone = KnownDevices['iPhone 6'];
const log = debug('scraper');

const isDebugMode = log.enabled;

log('Launching browser...');
const browser = await puppeteer.launch({
    headless: isDebugMode ? false : 'new',
});
log('Browser launched');

log('Opening new page...');
const page = await browser.newPage();
page.setDefaultNavigationTimeout(isDebugMode ? 0 : 30000);
await page.emulate(iPhone);
log('New page opened');

log('Navigating to URL...');
await page.goto('https://www.instagram.com/');
log('Navigation complete');

log('Setting viewport...');
await page.setViewport({
    width: 1024,
    height: 1024,
});
log('Viewport set!');

log('Waiting for selector...');
await page.waitForSelector('button');

const buttons = await page.$$('button');
log(`Found ${buttons.length} buttons!`);

const cookieButton = await page.$x('//button[contains(text(),"Allow all cookies")]')

if (cookieButton.length > 0) {
    await (cookieButton[0] as puppeteer.ElementHandle).click();
    log(`Clicked on Allow all cookies`);
} else {
    log(`Could not find Allow all cookies button`);
    throw new Error(`Could not find Allow all cookies button`);
}

if (!isDebugMode) {
    await browser.close();
}
