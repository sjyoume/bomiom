// 환경이 'production(운영)'이 아닐 때만 dotenv를 실행하도록 방어막을 칩니다.
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const express = require('express');
const path = require('path');
const axios = require('axios');
const cors = require('cors'); 

const app = express();
const PORT = process.env.PORT || 8080;

// 1. 기본 설정 (CORS 프리패스)
app.use(cors());
app.use(express.static(path.join(__dirname, 'dist')));
app.use(express.json());

const admin = require('firebase-admin');
const rateLimit = require('express-rate-limit');

// =========================================================
// 🛡️ [보안 방어막 1] Firebase Admin 초기화
// =========================================================
// 클라우드 런(GCP) 환경에서는 별도 키 없이도 자체적으로 권한을 인식합니다.
if (!admin.apps.length) {
  admin.initializeApp({
    // 🔑 대표님 .env에 있는 스토리지 주소를 넣어줍니다.
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "gen-lang-client-0047328822.firebasestorage.app"
  });
}

// =========================================================
// 🛡️ [보안 방어막 2] 매크로/과금 폭탄 방지 (Rate Limit)
// =========================================================
// 조건: 동일한 IP에서 '10분 동안 최대 5번'까지만 AI 생성 허용
const aiApiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10분
  max: 5, 
  message: { success: false, error: "너무 많은 요청이 발생했습니다. 10분 후에 다시 시도해주세요." }
});

// =========================================================
// 🛡️ [보안 방어막 3] 본인 인증 신분증 검사 (Token 검증)
// =========================================================
async function verifyToken(req, res, next) {
  // 🔑 1. VIP 프리패스 (카카오 로그인 유저 등을 위한 내부 비밀번호)
  const vipPass = req.headers['x-bomiom-secret'];
  if (vipPass === 'bomiom-super-secret-2024') {
    return next(); // 비밀번호가 맞으면 무조건 통과!
  }

  // 🛡️ 2. 기존 파이어베이스 신분증 검사 (백업용)
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: "로그인이 필요한 서비스입니다." });
  }
  
  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken; 
    next(); 
  } catch (error) {
    console.error("❌ 토큰 검증 실패:", error.message);
    return res.status(403).json({ success: false, error: "유효하지 않은 로그인 정보입니다. 앱을 껐다 켜주세요." });
  }
}

// =========================================================
// 🔥 [SEO 자동화 파트] 구글/네이버 검색 노출용
// =========================================================
let seoHtmlCache = '<div style="display:none;">임산부 혜택 정보를 불러오는 중입니다...</div>';

async function updateSeoData() {
  try {
    const GAS_URL = process.env.VITE_GOOGLE_SHEET_API_URL; 
    if (!GAS_URL) return;

    const response = await fetch(`${GAS_URL}?action=FETCH_ALL_DATA`);
    const data = await response.json();
    
    if (data.ok) {
      let htmlString = '<div style="display:none; visibility:hidden;">';
      if (data.gov) {
        htmlString += '<h1>전국 지자체 임산부 혜택 및 지원금</h1>';
        data.gov.forEach(b => { htmlString += `<h2>${b.sido} ${b.sigugun} ${b.title}</h2><p>${b.description}</p>`; });
      }
      if (data.private) {
        htmlString += '<h1>임산부 제휴 할인 및 혜택</h1>';
        data.private.forEach(b => { htmlString += `<h2>${b.title}</h2><p>${b.description}</p>`; });
      }
      htmlString += '</div>';
      seoHtmlCache = htmlString;
      console.log("✅ [SEO] 구글 시트 혜택 데이터 갱신 완료!");
    }
  } catch (error) {
    console.error("SEO 갱신 실패:", error.message);
  }
}

updateSeoData(); 
setInterval(updateSeoData, 3600000); 

// =========================================================
// 🚀 외부 API 통신 라우트 (클라우드런이 대신 찔러줍니다!)
// =========================================================

// 🔥 1. 네이버 쇼핑 트렌드 API
app.get('/api/trend/:keyword', async (req, res) => {
  const { keyword } = req.params;
  const searchDictionary = { '손수건': '아기손수건', '물티슈': '아기 물티슈', '바디워시': '아기 바디워시', '기저귀': '아기 기저귀' };
  const searchKeyword = searchDictionary[keyword] || keyword;

  try {
    const response = await axios.get('https://openapi.naver.com/v1/search/shop.json', {
      params: { query: searchKeyword, display: 50, sort: 'sim' },
      headers: { 'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID, 'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET }
    });

    const uniqueTrends = [];
    const seenBrands = new Set();

    for (const item of response.data.items || []) {
      const cleanTitle = item.title.replace(/<[^>]*>?/g, ''); 
      let brand = item.brand || cleanTitle.replace(/\[.*?\]|\(.*?\)/g, '').split(' ')[0].replace(/[^a-zA-Z가-힣]/g, '');

      const ignoreWords = ['무료배송', '정품', '신상', '특가', '아기', '신생아', '유아', '국민'];
      if (!brand || brand.length <= 1 || /^\d+$/.test(brand) || ignoreWords.includes(brand)) continue; 

      if (!seenBrands.has(brand)) {
        seenBrands.add(brand);
        const currentRank = uniqueTrends.length + 1;
        let badgeText = currentRank <= 3 ? '👑 스테디셀러' : currentRank <= 6 ? '🔥 급상승' : '📈 주목받는';
        uniqueTrends.push({ rank: currentRank, name: brand, trend: badgeText });
      }
      if (uniqueTrends.length === 10) break;
    }
    res.json({ ok: true, data: uniqueTrends });
  } catch (error) {
    console.error("네이버 API 에러:", error.message);
    res.json({ ok: true, data: [] }); 
  }
});

// 🔥 2. 유튜브 큐레이션 API
app.get('/api/youtube/:query', async (req, res) => {
  try {
    const query = req.params.query;
    const apiKey = process.env.YOUTUBE_API_KEY; 
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=4&q=${encodeURIComponent(query)}&type=video&key=${apiKey}`;
    
    const response = await axios.get(url);
    const videos = response.data.items.map(item => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails.medium.url,
      channelTitle: item.snippet.channelTitle
    }));
    res.json({ status: 'success', data: videos });
  } catch (error) {
    console.error("유튜브 API 에러:", error.message);
    res.json({ status: 'error', data: [] });
  }
});

// 🔥 3. 대법원 이름 순위 API
app.get('/api/names', async (req, res) => {
  try {
    const GAS_URL = process.env.VITE_GOOGLE_SHEET_API_URL;
    const response = await axios.get(`${GAS_URL}?action=FETCH_NAME_RANK`);
    
    if (response.data && response.data.ok) {
      res.json({ ok: true, boys: response.data.boys || [], girls: response.data.girls || [] });
    } else {
      res.json({ ok: false, boys: [], girls: [] });
    }
  } catch (error) {
    console.error("이름 순위 로드 에러:", error.message);
    res.json({ ok: false, boys: [], girls: [] });
  }
});

// =========================================================
// 🚨 [여기에 추가!!] 4. 카카오 로컬 API (병원/조리원 검색 심부름꾼)
// =========================================================
app.get('/api/search/hospital', async (req, res) => {
  try {
    const query = req.query.query;
    if (!query) return res.json([]);

    // 🔑 아까 클라우드 런 시크릿 매니저에 등록하신 바로 그 변수명!
    const kakaoRestKey = process.env.KAKAO_REST_KEY; 

    const response = await axios.get(`https://dapi.kakao.com/v2/local/search/keyword.json`, {
      params: { query: query },
      headers: { Authorization: `KakaoAK ${kakaoRestKey}` } // 카카오 본사에 VIP 신분증 제시!
    });

    res.json(response.data.documents || []);
  } catch (error) {
    console.error("카카오 API 에러:", error.message);
    res.json([]);
  }
});

// =========================================================
// 🚨 [여기에 추가!!] 5. 카카오 로그인 토큰 발급 심부름꾼 (보안 100%)
// =========================================================
app.get('/api/auth/kakao', async (req, res) => {
  try {
    const { code, redirectUri } = req.query;
    if (!code) return res.json({ ok: false, msg: '코드가 없습니다.' });

    const REST_API_KEY = process.env.KAKAO_REST_KEY || process.env.KAKAO_JAVA_KEY;

    // 1단계: 토큰 발급
    const tokenResponse = await axios.post('https://kauth.kakao.com/oauth/token', null, {
      params: {
        grant_type: 'authorization_code', 
        client_id: REST_API_KEY,
        redirect_uri: redirectUri,
        code: code,
      },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' }
    });

    // 2단계: 유저 정보 조회
    const userResponse = await axios.get('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${tokenResponse.data.access_token}` }
    });

    // 3단계: 프론트에 데이터 전달
    res.json({ ok: true, user: userResponse.data });
  } catch (error) {
    console.error("카카오 로그인 에러:", error.response?.data || error.message);
    res.json({ ok: false, msg: '토큰 발급 실패' });
  }
});

const FormData = require('form-data');

// 💡 Stability AI 호출 전용 헬퍼 함수 (반드시 있어야 작동합니다!)
async function generateStabilityImage(imageUrl, prompt, label, strengthValue = '0.6') {
  try {
    console.log(`[${label}] 1. 파이어베이스 이미지 다운로드 시작...`);
    // 🚨 1차 안전장치: 파이어베이스 다운로드가 10초 넘으면 끊음
    const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 10000 });
    const imageBuffer = Buffer.from(imgRes.data, 'binary');

    const form = new FormData();
    form.append('image', imageBuffer, { filename: 'upload.png', contentType: 'image/png' });
    form.append('prompt', prompt);
    form.append('strength', strengthValue); 
    form.append('mode', 'image-to-image'); 
    form.append('model', 'sd3-large'); // 🚨 핵심: 최신 SD3 모델 명시
    form.append('output_format', 'png');

    console.log(`[${label}] 2. AI 서버 전송 완료! 결과 대기 중...`);
    
    // 🚨 2차 안전장치: Stability AI가 30초 안에 응답 안 주면 무한로딩 방지를 위해 강제 에러 발생
    const response = await axios.post(
      "https://api.stability.ai/v2beta/stable-image/generate/sd3", // 🚨 핵심: /core 대신 /sd3 주소 사용
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${process.env.STABILITY_API_KEY}`,
          Accept: "image/*", 
        },
        responseType: "arraybuffer", 
        timeout: 60000 // 🚨 타임아웃 60초로 넉넉하게 연장
      }
    );

    console.log(`✅ [${label}] AI 사진 완성!`);
    return Buffer.from(response.data).toString('base64');
  } catch (error) {
    let detailMsg = error.message;
    if (error.response && error.response.data) {
      detailMsg = Buffer.from(error.response.data).toString('utf-8');
    }
    console.error(`❌ [${label}] 에러 발생:`, detailMsg);
    throw new Error(`[${label}] 작업 실패 - ${detailMsg}`);
  }
}

// =========================================================
// 🚀 AI 사진관 통합 API 라우트
// =========================================================
app.post('/api/generate-ai-baby', verifyToken, aiApiLimiter, async (req, res) => {
  const { type, gender, imageUrl, imageUrl1, imageUrl2 } = req.body;

  try {
    // 👶 1. 부모 닮은꼴 (아들/딸 동시 고속 생성 - 강도 0.55 안전 구역)
    if (type === 'parent-mix') {
      console.log(`▶ [부모합성] 아들/딸 동시 고속 생성 시작...`);
      
      const boyPrompt = "Professional studio portrait photography of a 5-year-old cute Korean boy, wearing a clean white t-shirt. Solid pastel blue seamless paper background. Shot on 85mm lens, f/1.8 aperture, soft softbox lighting, Rembrandt lighting, highly detailed face, sharp focus, 8k resolution, photorealistic, cinematic quality.";
    
      const girlPrompt = "Professional studio portrait photography of a 5-year-old cute Korean girl, wearing a clean white t-shirt. Solid pastel pink seamless paper background. Shot on 85mm lens, f/1.8 aperture, soft softbox lighting, Rembrandt lighting, highly detailed face, sharp focus, 8k resolution, photorealistic, cinematic quality.";

      const [boyBase64, girlBase64] = await Promise.all([
        generateStabilityImage(imageUrl2 || imageUrl1, boyPrompt, "아들사진", "0.55"),
        generateStabilityImage(imageUrl1 || imageUrl2, girlPrompt, "딸사진", "0.55")
      ]);

      return res.json({ 
        success: true, 
        imageBoy: boyBase64,
        imageGirl: girlBase64
      });
    }
    
    // (더 이상 combo 패키지가 없으므로, else 하나로 깔끔하게 처리합니다!)
    else {
      console.log(`▶ [단품] 초음파 초고화질 실사화 생성 시작...`);
      let genderText = gender === 'boy' ? 'boy' : gender === 'girl' ? 'girl' : 'baby';
      let prompt = `Award-winning high-end studio portrait photography of a beautiful sleeping Korean newborn ${genderText} baby. Flawless smooth warm baby skin with fine pores, chubby rosy cheeks, realistic closed eyes, soft fine baby hair. Wearing a clean, simple white organic cotton baby bodysuit. Wrapped comfortably in a soft premium cream-colored swaddle blanket. Solid light pastel warm-gray seamless background. Soft softbox studio lighting, Rembrandt lighting style, highly detailed facial features matching the reference skeletal structure perfectly, photorealistic, ultra-realistic, 8k resolution, cinematic quality, single subject, masterpiece.`;
      const singleBase64 = await generateStabilityImage(imageUrl, prompt, "실사화아기", "0.58");
      return res.json({ success: true, imageBase64: singleBase64 });
    }

  } catch (error) {
    console.error("❌ 최종 서버 에러:", error.message);
    res.json({ 
      success: false, 
      error: error.message 
    });
  }
});

// =========================================================
// 🎙️ [스튜디오 1] 태담 동화 & 동요 작사 (GPT-4o-mini)
// =========================================================
app.post('/api/studio/generate-content', verifyToken, aiApiLimiter, async (req, res) => {
  const { type, babyName, theme, wishes } = req.body; 
  try {
    let prompt = "";
    if (type === 'song') {
      prompt = `당신은 천재 동요 작사가입니다. 주인공 아기 태명은 '${babyName}'. 테마: '${theme}'.
부모님 요청사항: ${wishes}
위 내용을 바탕으로 리듬감 있고 톡톡 튀는 경쾌한 1절 분량(A-B-A-C 구조)의 동요 가사를 써주세요. 유행어나 매력 포인트가 후렴구에 반복되게 해주세요. (가사만 출력)`;
    } else {
      prompt = `당신은 감동적인 태담 동화 작가입니다. 주인공 아기 태명은 '${babyName}'.
부모님이 제공한 오늘 에피소드: ${wishes}
이 정보를 엮어 기승전결이 확실하고 부모가 소리 내어 읽기 좋은 장편 동화 대본을 써주세요. 최소 400자 이상, 3~4문단으로 아주 길고 풍성하게 작성하고, 마지막은 부모님의 진심으로 따뜻하게 마무리해주세요. (대본만 출력)`;
    }

    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1200,
      temperature: 0.8
    }, { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` } });

    res.json({ ok: true, content: response.data.choices[0].message.content.trim() });
  } catch (error) { res.json({ ok: false, msg: "대본 생성 실패" }); }
});

// =========================================================
// 🎙️ [스튜디오 2] 보컬 생성 (ElevenLabs)
// =========================================================
app.post('/api/studio/generate-audio', verifyToken, aiApiLimiter, async (req, res) => {
  const { text, voiceType } = req.body; 
  const VOICE_IDS = { dad: "MgugV8tLa3KQE4mfYTw5", mom: "F7wT70V3u09d2rY9pNa6" };

  try {
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_IDS[voiceType] || VOICE_IDS.dad}`,
      { text: text, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.5, similarity_boost: 0.75 } },
      { headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' }, responseType: 'arraybuffer' }
    );
    res.json({ ok: true, audio: Buffer.from(response.data, 'binary').toString('base64') });
  } catch (error) {
    let errMsg = error.message;
    if (error.response?.data) errMsg = Buffer.from(error.response.data).toString('utf-8');
    console.error("ElevenLabs 보컬 에러:", errMsg);
    res.json({ ok: false, msg: `보컬 실패: ${errMsg.substring(0, 60)}` });
  }
});

// =========================================================
// 🎙️ [스튜디오 통합] 작사 + 보컬 생성 + 업로드 + DB 저장 한방에 해결! (무한로딩 방지)
// =========================================================
// =========================================================
// 🎙️ [스튜디오 통합 1단계] GPT로 동요 작사만 먼저 하기 (무료)
// =========================================================
app.post('/api/studio/generate-lyrics', verifyToken, aiApiLimiter, async (req, res) => {
  const { babyName, theme, wishes } = req.body; 
  try {
    const gptPrompt = `당신은 천재 동요 작사가입니다. 주인공 아기 태명은 '${babyName}'. 테마: '${theme}'. 부모님 요청사항: ${wishes}
위 내용을 바탕으로 리듬감 있고 톡톡 튀는 경쾌한 1절 분량(A-B-A-C 구조)의 동요 가사를 써주세요. (가사만 출력)`;

    const gptRes = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: "gpt-4o-mini", messages: [{ role: "user", content: gptPrompt }], max_tokens: 1200, temperature: 0.8
    }, { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` } });
    
    res.json({ ok: true, content: gptRes.data.choices[0].message.content.trim() });
  } catch (error) {
    res.status(500).json({ ok: false, error: "작사 실패" });
  }
});

// =========================================================
// 🎙️ [스튜디오 통합 2단계] 가사 기반으로 10초 가이드 곡 생성 (광고 후)
// =========================================================
app.post('/api/studio/generate-guide', verifyToken, aiApiLimiter, async (req, res) => {
  const { lyricsContent, uid } = req.body; 
  try {
    // 💡 프롬프트에 앞에서 만든 가사를 그대로 꽂아 넣습니다!
    const musicPrompt = `A cheerful, upbeat children's pop song. Cute and energetic singing vocal. Playful melody. Lyrics: ${lyricsContent}`;

    const elevenRes = await axios.post(
      `https://api.elevenlabs.io/v1/sound-generation`, 
      { text: musicPrompt, duration_seconds: 10 },
      { headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' }, responseType: 'arraybuffer' }
    );

    const bucket = admin.storage().bucket();
    const filePath = `ai_studio_audio/guide_${Date.now()}.mp3`;
    const file = bucket.file(filePath);
    const crypto = require('crypto');
    const downloadToken = crypto.randomUUID(); 

    await file.save(elevenRes.data, { 
      contentType: 'audio/mp3', metadata: { metadata: { firebaseStorageDownloadTokens: downloadToken } }
    });
    
    const finalAudioUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filePath)}?alt=media&token=${downloadToken}`;
    res.json({ ok: true, audioUrl: finalAudioUrl });

  } catch (error) {
    res.status(500).json({ ok: false, error: "가이드곡 생성 실패" });
  }
});

// =========================================================
// 🎵 [스튜디오 3] 매주 월요일 자동 MR 작곡 (크론 스케줄러용)
// =========================================================
app.post('/api/cron/generate-weekly-mr', async (req, res) => {
  try {
    console.log("▶ [크론잡] 일레븐랩스 신규 MR 작곡 시작...");
    const prompt = "Super energetic and extremely bouncy children's song instrumental. Fast-paced, very lively tempo, jumping rhythm. Bright marimba, playful xylophone, and staccato acoustic piano. Happy, funny cartoon style, kindergarten dance music. NO pop beats, NO drum kits, NO synth, absolutely no vocals.";
    
    const response = await axios.post(
      'https://api.elevenlabs.io/v1/sound-generation',
      { text: prompt, duration_seconds: 30 },
      { headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' }, responseType: 'arraybuffer' }
    );

    const bucket = admin.storage().bucket();
    const file = bucket.file('system/weekly_mr.mp3');
    
    // 💡 [핵심 해결책] makePublic() 대신, 파이어베이스 전용 다운로드 티켓(Token)을 발급합니다!
    const crypto = require('crypto');
    const downloadToken = crypto.randomUUID(); 

    // 파일 저장 시, 메타데이터에 티켓 번호를 몰래 끼워넣습니다.
    await file.save(response.data, { 
      contentType: 'audio/mp3',
      metadata: {
        metadata: {
          firebaseStorageDownloadTokens: downloadToken
        }
      }
    });
    
    // 💡 브라우저가 권한 없이도 오디오를 재생할 수 있도록, 파이어베이스 공식 URL 형태로 엮어줍니다.
    const mrUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/system%2Fweekly_mr.mp3?alt=media&token=${downloadToken}`;

    await admin.firestore().collection('system').doc('weekly_mr').set({
      url: mrUrl, 
      theme: "통통 튀는 올챙이송 스타일 🐸", // 👈 유저 앱 화면에 보이는 문구!
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ ok: true, msg: "주간 MR 교체 완료", url: mrUrl });
  } catch (error) {
    const errMsg = error.response?.data ? Buffer.from(error.response.data).toString('utf-8') : error.message;
    console.error("MR 작곡 실패:", errMsg);
    res.status(500).json({ ok: false, error: errMsg });
  }
});

// =========================================================
// 🎵 [스튜디오 4] 프론트엔드로 이번 주 MR 전달
// =========================================================
app.get('/api/studio/weekly-mr', async (req, res) => {
  try {
    const doc = await admin.firestore().collection('system').doc('weekly_mr').get();
    if (doc.exists) {
      res.json({ ok: true, mr: doc.data() });
    } else {
      // 💡 픽사베이 제거! DB에 없으면 없다고 프론트에 알려줍니다.
      res.json({ ok: false, msg: "아직 이번 주 MR이 생성되지 않았습니다." });
    }
  } catch (error) { 
    res.json({ ok: false }); 
  }
});

// =========================================================
// 🚀 리액트 연동 및 서빙 (🔥 반드시 맨 마지막에 위치!)
// =========================================================
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  const fs = require('fs');
  fs.readFile(indexPath, 'utf8', (err, htmlData) => {
    if (err) return res.sendFile(indexPath); 
    const finalHtml = htmlData.replace('<div id="root"></div>', `<div id="root"></div>${seoHtmlCache}`);
    res.send(finalHtml);
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});