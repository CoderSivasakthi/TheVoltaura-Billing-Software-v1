const puppeteer = require('puppeteer');

async function run() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  
  await page.goto('http://localhost:5001/approvals', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: 'approvals_test.png' });
  console.log("Screenshot saved.");
  
  await browser.close();
}
run();
