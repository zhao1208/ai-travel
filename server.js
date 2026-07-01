const path = require('path');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const WechatStrategy = require('passport-wechat').Strategy;

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;

// OAuth Configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const WECHAT_APP_ID = process.env.WECHAT_APP_ID || '';
const WECHAT_APP_SECRET = process.env.WECHAT_APP_SECRET || '';
const SESSION_SECRET = process.env.SESSION_SECRET || 'travelmate-secret-key';

// ==================== Express App Setup ====================
const app = express();

// Session configuration
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Serialize/deserialize user
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

// Google OAuth Strategy
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback"
  }, (accessToken, refreshToken, profile, done) => {
    const user = {
      id: profile.id,
      name: profile.displayName,
      email: profile.emails?.[0]?.value || `${profile.id}@google.com`,
      avatar: profile.photos?.[0]?.value || 'G',
      provider: 'google'
    };
    return done(null, user);
  }));
}

// WeChat OAuth Strategy
if (WECHAT_APP_ID && WECHAT_APP_SECRET) {
  passport.use(new WechatStrategy({
    appID: WECHAT_APP_ID,
    appSecret: WECHAT_APP_SECRET,
    callbackURL: "/auth/wechat/callback",
    scope: 'snsapi_userinfo'
  }, (accessToken, refreshToken, profile, done) => {
    const user = {
      id: profile.openid,
      name: profile.nickname || '微信用户',
      email: `${profile.openid}@wechat.com`,
      avatar: profile.headimgurl || '微',
      provider: 'wechat'
    };
    return done(null, user);
  }));
}

const LLM_API_URL = process.env.LLM_API_URL || 'https://api.xiaomimimo.com/v1/chat/completions';
const LLM_API_KEY = process.env.LLM_API_KEY || '';
const LLM_MODEL = process.env.LLM_MODEL || 'mimo-v2-flash';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

// ==================== API Routes ====================

async function callLLMApi(messages) {
  if (!LLM_API_KEY) {
    console.log('[LLM] No API key, using fallback response');
    // Fallback to mock response if no API key
    return getMockResponse(messages);
  }

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: LLM_MODEL,
      messages: messages,
      stream: false
    });

    const url = new URL(LLM_API_URL);
    const options = {
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LLM_API_KEY}`
      }
    };

    console.log(`[LLM] Calling Xiaomi MiMo API: ${LLM_API_URL} with model: ${LLM_MODEL}`);

    const req = httpsRequest(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          console.log(`[LLM] Response status: ${res.statusCode}`);
          const json = JSON.parse(data);
          if (json.choices && json.choices[0]) {
            console.log('[LLM] Successfully received response from Xiaomi MiMo');
            resolve(json.choices[0].message.content);
          } else {
            console.log('[LLM] Invalid response format, using fallback');
            console.log('[LLM] Response:', data.substring(0, 200));
            resolve(getMockResponse(messages));
          }
        } catch (e) {
          console.error('[LLM] Parse error:', e.message);
          reject(e);
        }
      });
    });

    req.on('error', (e) => {
      console.error('[LLM] Request error:', e.message);
      reject(e);
    });
    req.write(body);
    req.end();
  });
}

function getMockResponse(messages) {
  // Smart fallback responses based on conversation context
  const lastMsg = messages[messages.length - 1]?.content?.toLowerCase() || '';
  
  if (lastMsg.includes('shanghai') || lastMsg.includes('上海') || lastMsg.includes('plan') || lastMsg.includes('行程')) {
    return "Great choice! Here's a 3-day Shanghai itinerary:\n\n**Day 1: Classic Shanghai**\n• Morning: The Bund waterfront walk\n• Afternoon: Yu Garden & Old City\n• Evening: Nanjing Road shopping + dinner\n\n**Day 2: Modern Shanghai**\n• Morning: Shanghai Tower (tallest building)\n• Afternoon: Art Museum or Tianzifang\n• Evening: Xintiandi nightlife\n\n**Day 3: Local Experience**\n• Morning: French Concession walking\n• Afternoon: Propaganda Poster Museum\n• Evening: Huangpu River cruise\n\nWant me to add restaurant recommendations or help with transportation?";
  }
  
  if (lastMsg.includes('food') || lastMsg.includes('restaurant') || lastMsg.includes('美食') || lastMsg.includes('吃')) {
    return "Here are some must-try Chinese foods:\n\n🍜 **Xiaolongbao** (小笼包) - Soup dumplings\n🥘 **Mapo Tofu** (麻婆豆腐) - Spicy tofu\n🥟 **Dumplings** (饺子) - Various fillings\n🦆 **Peking Duck** (北京烤鸭) - Iconic Beijing dish\n\nLocal tip: Look for restaurants with many locals - that's usually a good sign!";
  }
  
  if (lastMsg.includes('translate') || lastMsg.includes('翻译') || lastMsg.includes('say')) {
    return "I can help with translation! What phrase would you like me to translate? Just tell me what you need in English or Chinese, and I'll provide the translation with pinyin pronunciation.";
  }
  
  if (lastMsg.includes('emergency') || lastMsg.includes('紧急') || lastMsg.includes('help')) {
    return "Important emergency information:\n\n🆘 **Emergency Numbers in China:**\n• Police: **110**\n• Ambulance: **120**\n• Fire: **119**\n\nEssential phrases:\n• Help! = 救命! (Jiùmìng!)\n• Call the police = 报警 (Bàojǐng)\n• Hospital = 医院 (Yīyuàn)\n• I need help = 我需要帮助 (Wǒ xūyào bāngzhù)";
  }
  
  const isChinese = /[\u4e00-\u9fa5]/.test(lastMsg);
  if (isChinese) {
    return `好的！我理解你的问题： "${lastMsg}"\n\n我可以帮你：\n• 规划行程安排\n• 推荐美食餐厅\n• 翻译中英文\n• 提供交通建议\n• 介绍中国文化\n\n请告诉我你需要什么帮助？`;
  }
  
  return "Hi! I'm your AI travel assistant for China. I can help you with:\n\n🗺️ **Trip Planning** - Itineraries for any city\n🍜 **Food Recommendations** - Local specialties\n🌐 **Translation** - Chinese ↔ English phrases\n🚇 **Transport Tips** - Metro, taxi, high-speed rail\n📍 **City Guides** - Attractions, culture, tips\n\nWhat would you like to know about traveling in China?";
}

async function translateText(text, fromLang, toLang) {
  if (!LLM_API_KEY) {
    return getMockTranslate(text, fromLang, toLang);
  }

  const systemPrompt = fromLang === 'en' 
    ? `You are a professional translator. Translate the following English text to Chinese. Provide ONLY the translation, no explanations. If it's already Chinese or cannot be translated, return it as-is.`
    : `You are a professional translator. Translate the following Chinese text to English. Provide ONLY the translation, no explanations. If it's already English or cannot be translated, return it as-is.`;

  try {
    const result = await callLLMApi([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text }
    ]);
    return { text: result.trim(), pinyin: null };
  } catch (e) {
    return getMockTranslate(text, fromLang, toLang);
  }
}

function getMockTranslate(text, fromLang, toLang) {
  // Basic dictionary for common phrases
  const enToZh = {
    'hello': { text: '你好', pinyin: 'Nǐ hǎo' },
    'thank you': { text: '谢谢', pinyin: 'Xièxiè' },
    'goodbye': { text: '再见', pinyin: 'Zàijiàn' },
    'yes': { text: '是', pinyin: 'Shì' },
    'no': { text: '不是', pinyin: 'Bú shì' },
    'please': { text: '请', pinyin: 'Qǐng' },
    'sorry': { text: '对不起', pinyin: 'Duìbùqǐ' },
    'excuse me': { text: '不好意思', pinyin: 'Bù hǎoyìsi' },
    'how much': { text: '多少钱', pinyin: 'Duōshao qián' },
    'water': { text: '水', pinyin: 'Shuǐ' },
    'food': { text: '食物', pinyin: 'Shíwù' },
    'restaurant': { text: '餐厅', pinyin: 'Cāntīng' },
    'hotel': { text: '酒店', pinyin: 'Jiǔdiàn' },
    'airport': { text: '机场', pinyin: 'Jīchǎng' },
    'train': { text: '火车', pinyin: 'Huǒchē' },
    'taxi': { text: '出租车', pinyin: 'Chūzū chē' },
    'metro': { text: '地铁', pinyin: 'Dìtiě' },
    'bathroom': { text: '洗手间', pinyin: 'Xǐshǒujiān' },
    'help': { text: '救命', pinyin: 'Jiùmìng' },
    'police': { text: '警察', pinyin: 'Jǐngchá' },
    'hospital': { text: '医院', pinyin: 'Yīyuàn' },
    'where': { text: '在哪里', pinyin: 'Zài nǎlǐ' },
    'how': { text: '怎么', pinyin: 'Zěnme' },
    'want': { text: '要', pinyin: 'Yào' },
    'go': { text: '去', pinyin: 'Qù' },
    'i': { text: '我', pinyin: 'Wǒ' },
    'you': { text: '你', pinyin: 'Nǐ' },
    'me': { text: '我', pinyin: 'Wǒ' },
    'to': { text: '到', pinyin: 'Dào' },
  };

  const zhToEn = {
    '你好': { text: 'Hello' },
    '谢谢': { text: 'Thank you' },
    '再见': { text: 'Goodbye' },
    '是': { text: 'Yes' },
    '不是': { text: 'No' },
    '请': { text: 'Please' },
    '对不起': { text: 'Sorry' },
    '救命': { text: 'Help!' },
    '警察': { text: 'Police' },
    '医院': { text: 'Hospital' },
    '机场': { text: 'Airport' },
    '酒店': { text: 'Hotel' },
    '餐厅': { text: 'Restaurant' },
    '多少钱': { text: 'How much?' },
    '洗手间在哪里': { text: 'Where is the bathroom?' },
  };

  const lowerText = text.toLowerCase();
  
  if (fromLang === 'en' && toLang === 'zh') {
    // Try exact match first
    if (enToZh[lowerText]) {
      return enToZh[lowerText];
    }
    // Try partial match
    for (const [key, val] of Object.entries(enToZh)) {
      if (lowerText.includes(key)) {
        return val;
      }
    }
    // Return wrapped text as fallback
    return { text: `【${text}】`, pinyin: '(Translation using AI)' };
  }
  
  if (fromLang === 'zh' && toLang === 'en') {
    if (zhToEn[text]) {
      return zhToEn[text];
    }
    for (const [key, val] of Object.entries(zhToEn)) {
      if (text.includes(key)) {
        return val;
      }
    }
    return { text: `[${text}]`, pinyin: null };
  }
  
  return { text, pinyin: null };
}

function httpsRequest(options, callback) {
  const mod = require(options.protocol === 'http:' ? 'http' : 'https');
  return mod.request(options, callback);
}

// ==================== Server ====================

app.use(express.json());

// Health check
app.all('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    llmConfigured: !!LLM_API_KEY,
    googleAuthConfigured: !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET),
    wechatAuthConfigured: !!(WECHAT_APP_ID && WECHAT_APP_SECRET)
  });
});

// Chat API
app.all('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    const response = await callLLMApi(messages || []);
    res.json({ content: response });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Translate API
app.all('/api/translate', async (req, res) => {
  try {
    const { text, from, to } = req.body;
    const result = await translateText(text || '', from || 'en', to || 'zh');
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Auth routes - only register if configured
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
  
  app.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
      res.redirect('/?auth=success&provider=google');
    }
  );
}

if (WECHAT_APP_ID && WECHAT_APP_SECRET) {
  app.get('/auth/wechat', passport.authenticate('wechat'));
  
  app.get('/auth/wechat/callback', 
    passport.authenticate('wechat', { failureRedirect: '/' }),
    (req, res) => {
      res.redirect('/?auth=success&provider=wechat');
    }
  );
}

app.get('/auth/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/');
  });
});

app.use(express.static(PUBLIC_DIR));

// Catch-all route for SPA - must be after all other routes
app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.get('/chat', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.get('/translate', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n========================================`);
  console.log(`AI Travel Assistant running at http://localhost:${PORT}`);
  console.log(`========================================`);
  console.log(`LLM Provider: Xiaomi MiMo`);
  console.log(`API URL: ${LLM_API_URL}`);
  console.log(`Model: ${LLM_MODEL}`);
  console.log(`API Key: ${LLM_API_KEY ? 'Configured ✓' : 'Not configured ✗ (using fallback)'}`);
  console.log(`Google OAuth: ${GOOGLE_CLIENT_ID ? 'Configured ✓' : 'Not configured ✗'}`);
  console.log(`WeChat OAuth: ${WECHAT_APP_ID ? 'Configured ✓' : 'Not configured ✗'}`);
  console.log(`========================================\n`);
});
