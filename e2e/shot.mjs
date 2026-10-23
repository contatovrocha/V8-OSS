// Captura de telas para revisão visual: node e2e/shot.mjs <url-path> <arquivo> [email] [largura]
import { chromium } from 'playwright'
const [, , path = '/', file = 'shot.png', email = 'admin@launchos.demo', width = '1440'] = process.argv
const pass = email.startsWith('admin') ? 'admin123' : 'expert123'
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: +width, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
await page.goto('http://localhost:5173/')
await page.fill('input[type=email]', email)
await page.fill('input[type=password]', pass)
await page.click('button[type=submit]')
await page.waitForTimeout(1200)
if (path !== '/') { await page.goto('http://localhost:5173' + path); await page.waitForTimeout(1500) }
await page.screenshot({ path: file, fullPage: true })
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no errors')
await browser.close()
