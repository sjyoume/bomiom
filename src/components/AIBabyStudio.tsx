import React, { useState, useEffect } from 'react';
import { ChevronLeft, Camera, User, CheckCircle2, Sparkles, ArrowRight, Download } from 'lucide-react';
import { storage, db } from '../firebase'; 
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, query, where, getDocs, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const AIBabyStudio = ({ user, onBack, onUpdateUser, addToast }: any) => {
  const [tab, setTab] = useState(1); 
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000); // 3초 뒤에 스르륵 사라짐
  };
  
  const [history, setHistory] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'work' | 'history'>('work'); // 'work'는 제작, 'history'는 보관함
  
  const [mixResult, setMixResult] = useState<{ boy: string, girl: string } | null>(null);
  const [premiumResult, setPremiumResult] = useState<{ img1: string } | null>(null);
  
  const [momFile, setMomFile] = useState<File | null>(null);
  const [dadFile, setDadFile] = useState<File | null>(null);
  const [momPreview, setMomPreview] = useState<string | null>(null);
  const [dadPreview, setDadPreview] = useState<string | null>(null);
  
  const [premiumFile, setPremiumFile] = useState<File | null>(null);
  const [premiumPreview, setPremiumPreview] = useState<string | null>(null);
  
  const [babyGender, setBabyGender] = useState<'boy' | 'girl'>('boy');
  const [selectedMixGender, setSelectedMixGender] = useState<'boy' | 'girl' | null>(null);

  // ✅ [신규 추가] 광고 시청 완료 트리거 및 리모컨 수신 리스너
  const [adRewardTrigger, setAdRewardTrigger] = useState(0);

  useEffect(() => {
    const handleAdCompletion = (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        // 앱이 "광고 다 봤어!"라고 신호를 주면 트리거를 작동시킵니다.
        if (data.type === 'AD_REWARD_EARNED' && (data.adType === 'STUDIO_PREMIUM' || data.adType === 'STUDIO_REPEAT')) {
          setAdRewardTrigger(prev => prev + 1); 
        }
      } catch (e) {}
    };
    window.addEventListener('message', handleAdCompletion);
    return () => window.removeEventListener('message', handleAdCompletion);
  }, []);

  // ✅ [신규 추가] 트리거가 발동되면 진짜로 사진 생성(startProcess)을 시작합니다.
  useEffect(() => {
    if (adRewardTrigger > 0) {
      setTimeout(() => {
        // subOption 확인 없이 tab이 2면 무조건 ultrasound로 전송
        startProcess(tab === 1 ? 'parent-mix' : 'ultrasound');
      }, 800); 
    }
  }, [adRewardTrigger]);

  // ✅ 앱이 켜지자마자 내 보관함 기록을 가져오는 코드
  useEffect(() => {
    const targetUserId = user?.uid || user?.id; 
    if (!targetUserId) return; 

    // 🔥 onSnapshot을 쓰면 DB에 변화가 생기는 즉시 자동으로 리스트를 갱신합니다.
    const q = query(collection(db, "ai_results"), where("uid", "==", targetUserId));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      let docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      docs.sort((a: any, b: any) => {
        // 🔥 [해결의 핵심] 방금 막 생성해서 서버시간(serverTimestamp)이 아직 null일 때는
        // 현재 시간(Date.now())으로 강제 인식시켜 무조건 맨 위에 뜨게 만듭니다!
        const timeA = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || (a.createdAt == null ? Date.now() : 0);
        const timeB = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || (b.createdAt == null ? Date.now() : 0);
        return timeB - timeA;
      });

      setHistory(docs);
    });

    return () => unsubscribe(); // 화면 끌 때 감시 종료
  }, [user]);

  const loadingMessages = [
    "AI가 사진을 꼼꼼하게 스캔하고 있어요 🧐",
    "엄마의 예쁜 이목구비를 분석하는 중 🌸",
    "아빠의 매력적인 특징을 담아내고 있어요 ✨",
    "수만 장의 아기 사진 데이터를 결합 중입니다 🎨",
    "우리아기 얼굴이 거의 다 완성되어 가요! 👶"
  ];

  useEffect(() => {
    let interval: any;
    if (loading) {
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev + 1) % loadingMessages.length);
      }, 3500);
    } else {
      setLoadingStep(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>, target: 'mom' | 'dad' | 'premium') => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      if (target === 'mom') { setMomFile(file); setMomPreview(url); }
      if (target === 'dad') { setDadFile(file); setDadPreview(url); }
      if (target === 'premium') { setPremiumFile(file); setPremiumPreview(url); }
      setMixResult(null);
      setPremiumResult(null);
    }
  };

  // 💡 웹뷰(앱) 메모리 폭발을 막는 안전한 강제 저장 함수
  const downloadImage = async (imgUrl: string, fileName: string) => {
    try {
      if (typeof window !== 'undefined' && (window as any).ReactNativeWebView) {
        showToast("⏳ 갤러리에 저장 중입니다...");
        
        // URL을 base64로 변환해서 앱으로 전송
        const response = await fetch(imgUrl);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          (window as any).ReactNativeWebView.postMessage(JSON.stringify({ 
            type: 'SAVE_IMAGE', 
            url: imgUrl,
            base64: base64,
            fileName: fileName 
          }));
        };
        reader.readAsDataURL(blob);
        return;
      }
      // 2. PC나 모바일 웹 브라우저로 접속한 경우 ➡️ 기존처럼 파일 다운로드
      else {
        showToast("⏳ 이미지를 준비 중입니다...");
        const response = await fetch(imgUrl);
        const blob = await response.blob();
        const a = document.createElement('a');
        a.href = window.URL.createObjectURL(blob);
        a.download = `${fileName}.jpg`;
        a.click();
        showToast("📸 저장이 완료되었습니다!");
      }
    } catch (e) {
      console.error(e);
      alert("화면캡쳐를 통해 사진을 저장하세요! 📸");
    }
  };

  const startProcess = async (type: string) => {
    if (tab === 1 && (!momFile || !dadFile)) return alert("사진을 모두 등록해 주세요.");
    if (tab === 2 && !premiumFile) return alert("초음파 사진을 등록해 주세요.");

    setLoading(true);
    
    try {
      let payload: any = { type, gender: tab === 1 ? selectedMixGender : babyGender };

      if (tab === 1) {
        const mRef = ref(storage, `ai_studio/${user.uid}/mom_${Date.now()}`);
        const dRef = ref(storage, `ai_studio/${user.uid}/dad_${Date.now()}`);
        payload.imageUrl1 = await getDownloadURL((await uploadBytes(mRef, momFile!)).ref);
        payload.imageUrl2 = await getDownloadURL((await uploadBytes(dRef, dadFile!)).ref); 
      } else {
        const pRef = ref(storage, `ai_studio/${user.uid}/premium_${Date.now()}`);
        payload.imageUrl = await getDownloadURL((await uploadBytes(pRef, premiumFile!)).ref);
      }

      // 1. 현재 로그인한 유저의 인증 토큰을 가져옵니다.
      const auth = getAuth();
      const currentUser = auth.currentUser;
      const idToken = currentUser ? await currentUser.getIdToken() : '';

      // 2. 헤더에 토큰과 VIP 비밀번호를 함께 담아서 보냅니다.
      const response = await fetch('/api/generate-ai-baby', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`, // 🛡️ 기존 파이어베이스 신분증 (백업용)
          'x-bomiom-secret': 'bomiom-super-secret-2024' // 🔑 카카오 로그인 유저용 VIP 프리패스 추가!
        },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      
      if (data.success) {
        const boyImgBase64 = `data:image/png;base64,${data.imageBoy}`;
        const girlImgBase64 = `data:image/png;base64,${data.imageGirl}`;
        
        if (tab === 1) {
          setMixResult({ boy: boyImgBase64, girl: girlImgBase64 });
        } else {
          setPremiumResult({
            img1: `data:image/png;base64,${data.imageBase64}`,
            img2: data.imageBase64_2 ? `data:image/png;base64,${data.imageBase64_2}` : undefined
          });
        }

        const compressAndUpload = async (base64Str: string, fileName: string) => {
          return new Promise<string>((resolve, reject) => {
            const img = new Image();
            img.src = base64Str;
            img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              if (!ctx) { reject('Canvas 생성 실패'); return; }
              ctx.drawImage(img, 0, 0);

              canvas.toBlob(async (blob) => {
                if (!blob) { reject('압축 실패'); return; }
                try {
                  const fileRef = ref(storage, `results/${user?.uid || 'guest'}/${Date.now()}_${fileName}.jpg`);
                  await uploadBytes(fileRef, blob);
                  const url = await getDownloadURL(fileRef);
                  resolve(url);
                } catch (e) { reject(e); }
              }, 'image/jpeg', 0.8);
            };
            img.onerror = (e) => reject(e);
          });
        };

        const handleFinalSave = async () => {
          try {
            // 🔥 1. 30일 뒤 날짜 계산 (TTL 자동 삭제용)
            const expireDate = new Date();
            expireDate.setDate(expireDate.getDate() + 30);

            let finalData: any = {
              uid: user?.id || user?.uid || 'unknown',
              type: type, // 부모닮은꼴인지 초음파인지 정확하게 들어가는 타입
              createdAt: new Date(), // ✅ 서버 시간을 기다리지 않고 폰의 현재 시간으로 즉시 저장! (실시간 반영)
              expireAt: expireDate, 
            };

            if (tab === 1) {
              const [boyUrl, girlUrl] = await Promise.all([
                compressAndUpload(boyImgBase64, 'boy'),
                compressAndUpload(girlImgBase64, 'girl')
              ]);
              finalData.boyUrl = boyUrl;
              finalData.girlUrl = girlUrl;
              setMixResult({ boy: boyUrl, girl: girlUrl });
            } else {
              // img2 처리 로직 완전 삭제, 1장만 압축 후 저장
              const img1Base64 = `data:image/png;base64,${data.imageBase64}`;
              setPremiumResult({ img1: img1Base64 }); // 화면에 먼저 띄우기
              
              const img1Url = await compressAndUpload(img1Base64, 'premium1');
              finalData.img1Url = img1Url; // DB 저장용
              
              setPremiumResult({ img1: img1Url }); // 최종 URL로 교체
            }

            // ✅ DB 저장 실행
            await addDoc(collection(db, "ai_results"), finalData);
            
            // ✅ 핵심: 저장 완료 후 '즉시' 보관함 데이터를 다시 불러와서 싱크를 맞춥니다.
            console.log("✅ 보관함 저장 완료 (실시간 동기화 작동 중)");

          } catch (err) {
            console.error("❌ 저장 실패:", err);
          }
        };

        handleFinalSave();

        if (type === 'parent-mix' && !user?.usedFreeMix) onUpdateUser({ ...user, usedFreeMix: true });
        // ✅ 수정됨: 자체 토스트 함수 사용
        showToast("✨ 사진이 완성되었습니다!"); 
      } else {
        throw new Error(data.error || "서버 응답 실패");
      }
    } catch (e: any) {
      console.error("프론트엔드 에러:", e);
      alert(`[오류] ${e.message}`);
    } finally { setLoading(false); }
  };

  return (
    <div style={s.page}>
      <nav style={s.nav}>
        <button onClick={onBack} style={s.iconBtn}><ChevronLeft size={28} /></button>
        <h1 style={s.navTitle}>봄이옴 AI 스튜디오</h1>
        <div style={{width: 28}}></div>
      </nav>

      <div style={s.container}>
        <div style={{ ...s.hero, width: '100%', minWidth: 0, overflow: 'hidden' }}>
          
          {/* 🔥 1. 제목: style(고정크기)을 지우고, 화면 크기(vw)에 따라 작아지게 만듭니다! */}
          <h1 className="text-[5.5vw] sm:text-2xl font-black text-slate-900 mb-2 whitespace-nowrap tracking-tight">
            {tab === 1 ? "엄마 아빠를 닮은 우리 아이" : "초음파로 미리 만나는 아이"}
          </h1>
          
          {/* 🔥 2. 설명: 마찬가지로 폰이 작으면 글씨도 작아지며 무조건 한 줄 유지! */}
          <p className="text-[3.3vw] sm:text-sm text-slate-600 font-medium whitespace-nowrap truncate tracking-tight">
            {tab === 1 
              ? "부모님의 이목구비를 분석하여 아기 모습을 예측합니다." 
              : "입체 초음파 사진을 분석해 실제 태어날 아기의 모습을 초고화질로 보여드려요."}
          </p>

          {/* ✅ 버튼 위치 하단으로 조정 및 텍스트 명확화 */}
          <div style={s.buttonArea}>
             <button onClick={() => setViewMode(viewMode === 'work' ? 'history' : 'work')} style={s.historyToggleBtn}>
                {viewMode === 'work' ? "📦 내 보관함 확인하기 (보관기간: 30일)" : "🔙 사진 새로 만들기"}
             </button>
          </div>
        </div>

        <div style={s.tabGroup}>
          <button onClick={() => setTab(1)} style={tab === 1 ? s.activeTab : s.inactiveTab}>부모 닮은꼴</button>
          <button onClick={() => setTab(2)} style={tab === 2 ? s.activeTab : s.inactiveTab}>초음파 실사화</button>
        </div>

        {/* ✅ 보관함 모드일 때 보여줄 화면 */}
        {viewMode === 'history' ? (
          <div style={s.historyGrid}>
            {/* ✅ 필터링을 먼저 거친 후, 그 결과가 0개 이상일 때만 화면에 뿌립니다 */}
            {history.filter(item => tab === 1 ? item.type === 'parent-mix' : item.type !== 'parent-mix').length > 0 
              ? history.filter(item => tab === 1 ? item.type === 'parent-mix' : item.type !== 'parent-mix').map((item, idx) => (
              <div key={idx} style={s.historyItem} onClick={() => {
                if (item.boyUrl) {
                  setMixResult({ boy: item.boyUrl, girl: item.girlUrl });
                  setSelectedMixGender('boy'); 
                  setTab(1);
                } 
                if (item.img1Url) {
                  setPremiumResult({ img1: item.img1Url, img2: item.img2Url });
                  setTab(2);
                }
                setViewMode('work');
              }}>
                <img src={item.boyUrl || item.img1Url} style={s.historyImg} alt="보관함 사진" />
                <p style={s.historyDate}>
                  {item.createdAt 
                    ? new Date(item.createdAt?.toMillis?.() || item.createdAt?.seconds * 1000).toLocaleDateString() 
                    : new Date().toLocaleDateString()}
                </p>
              </div>
            )) : <p style={{textAlign:'center', padding:'40px', color:'#8b95a1'}}>아직 보관된 사진이 없어요.</p>}
          </div>
        ) : loading ? (
          <div style={s.loadingBox}>
            <div style={s.spinner}>✨</div>
            <h2 style={s.loadingTitle}>정성스럽게 그리는 중...</h2>
            <p style={s.loadingDynamicText}>{loadingMessages[loadingStep]}</p>
          </div>
        ) : mixResult || premiumResult ? (
          <div style={s.resultBox}>
            <h3 style={s.resultHeader}>🎉 사진이 완성되었어요!</h3>
            
            <div style={s.comboGrid}>
              {/* 💡 부모 닮은꼴 결과 (저장 버튼 삭제, 안내 문구 추가) */}
              {mixResult && selectedMixGender && (
                <div style={s.resultCard}>
                  <div style={s.imageWrapper}>
                    <span style={selectedMixGender === 'boy' ? s.imgTagBoy : s.imgTagGirl}>
                      {selectedMixGender === 'boy' ? '👦 아들' : '👧 딸'}
                    </span>
                    <img src={selectedMixGender === 'boy' ? mixResult.boy : mixResult.girl} style={s.finalImg} alt="Baby" />
                  </div>

                  <div style={s.resultActionArea}>
                    <button 
                      onClick={() => downloadImage(selectedMixGender === 'boy' ? mixResult.boy : mixResult.girl, "bomiom_baby")} 
                      style={s.saveDeviceBtn}
                    >
                      <Download size={18} /> 기기에 저장하기
                    </button>
                    <div style={s.autoSaveNotice}>
                      <CheckCircle2 size={14} color="#3182f6" />
                      <span>이 사진은 보관함에 30일간 자동 보관됩니다.</span>
                    </div>
                  </div>
                  
                  <div style={{padding: '20px', backgroundColor: '#f9fafb', borderTop: '1px solid #f2f4f6'}}>
                    <p style={{fontSize: '14px', color: '#4e5968', marginBottom: '12px', fontWeight: 600}}>
                      다른 성별의 아이 모습도 궁금하신가요?
                    </p>
                    <button 
                      onClick={() => setSelectedMixGender(selectedMixGender === 'boy' ? 'girl' : 'boy')} 
                      style={{...s.secondaryBtn, padding: '14px', fontSize: '15px'}}
                    >
                      {selectedMixGender === 'boy' ? '👧 딸 모습도 확인하기' : '👦 아들 모습도 확인하기'}
                    </button>
                  </div>
                </div>
              )}

              {premiumResult?.img1 && (
                <div style={s.resultCard}>
                  <div style={s.imageWrapper}>
                    <span style={s.imgTag}>3D 아기 캐릭터</span>
                    <img src={premiumResult.img1} style={s.finalImg} alt="Newborn Character" />
                  </div>
                  
                  <div style={s.resultActionArea}>
                    <button 
                      onClick={() => downloadImage(premiumResult.img1, "bomiom_ultrasound")} 
                      style={s.saveDeviceBtn}
                    >
                      <Download size={18} /> 기기에 저장하기
                    </button>
                    <div style={s.autoSaveNotice}>
                      <CheckCircle2 size={14} color="#3182f6" />
                      <span>이 사진은 보관함에 30일간 자동 보관됩니다.</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div style={{marginTop:'30px'}}>
              <button onClick={() => {setMixResult(null); setPremiumResult(null);}} style={s.secondaryBtn}>다른 사진으로 다시 만들기</button>
            </div>
          </div>
        ) : (
          <div style={s.workArea}>
            {tab === 1 ? (
              <>
                <div style={s.splitUpload}>
                  <label style={s.halfCard}>
                    {momPreview ? <img src={momPreview} style={s.preview} /> : <div style={s.emptyCenter}><User size={28} color="#8b95a1"/><p>엄마 사진</p></div>}
                    <input type="file" accept="image/*" onChange={(e)=>onFileChange(e,'mom')} style={{display:'none'}}/>
                  </label>
                  <label style={s.halfCard}>
                    {dadPreview ? <img src={dadPreview} style={s.preview} /> : <div style={s.emptyCenter}><User size={28} color="#8b95a1"/><p>아빠 사진</p></div>}
                    <input type="file" accept="image/*" onChange={(e)=>onFileChange(e,'dad')} style={{display:'none'}}/>
                  </label>
                </div>
                <div style={s.genderGroup}>
                  <p style={s.groupLabel}>어떤 아이의 모습을 먼저 볼까요?</p>
                  <div style={s.genderFlex}>
                    <button onClick={() => setSelectedMixGender('boy')} style={selectedMixGender === 'boy' ? s.gbBoy : s.gbOff}>아들 👦</button>
                    <button onClick={() => setSelectedMixGender('girl')} style={selectedMixGender === 'girl' ? s.gbGirl : s.gbOff}>딸 👧</button>
                  </div>
                </div>

                <div style={s.bottomFixed}>
                  <button 
                    disabled={!momFile || !dadFile || !selectedMixGender}
                    onClick={() => {
                      if (typeof window !== 'undefined' && (window as any).ReactNativeWebView) {
                        // 무조건 바로 광고부터 띄웁니다!
                        (window as any).ReactNativeWebView.postMessage(JSON.stringify({ type: 'SHOW_REWARDED_AD', adType: 'STUDIO_PREMIUM' }));
                      } else {
                        startProcess('parent-mix'); // PC/웹 테스트용
                      }
                    }} 
                    style={(!momFile || !dadFile || !selectedMixGender) ? s.disabledBtn : s.mainBtn}
                  >
                    🎥 30초 광고 보고 사진 완성하기
                  </button>
                </div>
              </>
            ) : (
              <div style={s.ultrasoundSection}>
                <h3 style={s.sectionLabel}>초음파로 만나는 우리 아이 3D 캐릭터</h3>
                
                {/* subOption 조건문 삭제, 탭 진입 시 업로드 창 바로 노출 */}
                <div style={{marginTop:'10px', animation:'fadeIn 0.5s'}}>
                  <label style={s.fullCard}>
                      {premiumPreview ? <img src={premiumPreview} style={s.preview} /> : <div style={s.emptyCenter}><Camera size={32} color="#3182f6"/><p style={{marginTop:'8px', fontWeight:700, color:'#3182f6'}}>초음파 사진 올리기</p></div>}
                      <input type="file" accept="image/*" onChange={(e)=>onFileChange(e,'premium')} style={{display:'none'}}/>
                    </label>

                    <div style={s.genderGroup}>
                      <p style={s.groupLabel}>아이의 성별을 알려주세요</p>
                      <div style={s.genderFlex}>
                        <button onClick={() => setBabyGender('boy')} style={babyGender === 'boy' ? s.gbBoy : s.gbOff}>아들 👦</button>
                        <button onClick={() => setBabyGender('girl')} style={babyGender === 'girl' ? s.gbGirl : s.gbOff}>딸 👧</button>
                      </div>
                    </div>

                    <div style={s.bottomFixed}>
                      {/* 🔥 [수정] 결제 제거 및 보상형 광고(STUDIO_PREMIUM) 재생으로 변경 */}
                      <button 
                        disabled={!premiumFile}
                        onClick={() => {
                          if (typeof window !== 'undefined' && (window as any).ReactNativeWebView) {
                            (window as any).ReactNativeWebView.postMessage(JSON.stringify({ type: 'SHOW_REWARDED_AD', adType: 'STUDIO_PREMIUM' }));
                          } else {
                            startProcess('ultrasound');
                          }
                        }} 
                        style={!premiumFile ? s.disabledBtn : s.mainBtn}
                      >
                        🎥 30초 광고 보고 사진 생성하기
                      </button>
                    </div>
                  </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ✅ 새로 추가: 토스트 메시지가 있을 때만 화면에 렌더링 */}
      {toastMsg && (
        <div style={s.toastWrapper}>
          <div style={s.toastContent}>{toastMsg}</div>
        </div>
      )}
    </div>
  );
};

// 🎨 디자인 시스템 스타일
const s: { [key: string]: React.CSSProperties } = {
  page: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: '#fff', zIndex: 2000, overflowY: 'auto' },
  nav: { padding: '15px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f2f4f6', position: 'sticky', top: 0, backgroundColor: '#fff', zIndex: 100 },
  navTitle: { fontSize: '18px', fontWeight: 800 },
  iconBtn: { border: 'none', background: 'none', cursor: 'pointer' },
  container: { padding: '0 24px 140px', maxWidth: '100%', overflow: 'hidden' }, // 🔥 화면 밖으로 밀림 완벽 차단
  hero: { padding: '30px 0 20px', width: '100%', minWidth: 0 }, // 🔥 줄바꿈 방지가 작동하도록 부모 폭 강제 고정
  title: { fontSize: '26px', fontWeight: 900, color: '#191f28', marginBottom: '8px' },
  subtitle: { fontSize: '15px', color: '#4e5968', lineHeight: 1.6, fontWeight: 500 },
  tabGroup: { display: 'flex', gap: '8px', margin: '20px 0 30px', backgroundColor: '#f2f4f6', padding: '5px', borderRadius: '14px' },
  activeTab: { flex: 1, padding: '12px', border: 'none', borderRadius: '10px', backgroundColor: '#fff', fontWeight: 800, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
  inactiveTab: { flex: 1, padding: '12px', border: 'none', background: 'none', color: '#8b95a1', fontWeight: 700 },
  
  ultrasoundSection: { display: 'flex', flexDirection: 'column' },
  sectionLabel: { fontSize: '14px', fontWeight: 800, color: '#4e5968', marginBottom: '12px' },
  optionList: { display: 'flex', flexDirection: 'column', gap: '10px' },
  optInactive: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', border: '1px solid #e5e8eb', borderRadius: '16px', backgroundColor: '#fff', fontSize: '15px', fontWeight: 700, color: '#191f28', textAlign: 'left', cursor: 'pointer' },
  optActive: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', border: '2px solid #3182f6', borderRadius: '16px', backgroundColor: '#f4f9ff', fontSize: '15px', fontWeight: 800, color: '#3182f6', textAlign: 'left', cursor: 'pointer' },

  splitUpload: { display: 'flex', gap: '12px' },
  halfCard: { flex: 1, height: '200px', backgroundColor: '#f9fafb', borderRadius: '20px', border: '1px dashed #d1d8e0', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  fullCard: { width: '100%', height: '220px', backgroundColor: '#f0f6ff', borderRadius: '24px', border: '2px dashed #3182f6', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  preview: { width: '100%', height: '100%', objectFit: 'cover' },
  emptyCenter: { textAlign: 'center', color: '#8b95a1', fontSize: '14px', fontWeight: 600 },
  
  genderGroup: { marginTop: '24px' },
  groupLabel: { fontSize: '14px', fontWeight: 800, color: '#4e5968', marginBottom: '10px' },
  genderFlex: { display: 'flex', gap: '8px' },
  gbOff: { flex: 1, padding: '14px', border: 'none', borderRadius: '12px', backgroundColor: '#f2f4f6', color: '#8b95a1', fontWeight: 800, fontSize: '15px', cursor: 'pointer' },
  gbBoy: { flex: 1, padding: '14px', border: '1px solid #3182f6', borderRadius: '12px', backgroundColor: '#e8f3ff', color: '#3182f6', fontWeight: 800, fontSize: '15px', cursor: 'pointer' },
  gbGirl: { flex: 1, padding: '14px', border: '1px solid #f03e3e', borderRadius: '12px', backgroundColor: '#fff0f3', color: '#f03e3e', fontWeight: 800, fontSize: '15px', cursor: 'pointer' },

  bottomFixed: { position: 'fixed', bottom: 0, left: 0, right: 0, padding: '20px 24px 30px', backgroundColor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)' },
  mainBtn: { width: '100%', padding: '20px', backgroundColor: '#3182f6', color: '#fff', border: 'none', borderRadius: '20px', fontSize: '17px', fontWeight: 800, boxShadow: '0 8px 20px rgba(49,130,246,0.2)', cursor: 'pointer' },
  disabledBtn: { width: '100%', padding: '20px', backgroundColor: '#d1d8e0', color: '#fff', border: 'none', borderRadius: '20px', fontSize: '17px', fontWeight: 800, cursor: 'not-allowed' },
  
  loadingBox: { textAlign: 'center', padding: '100px 0' },
  spinner: { fontSize: '40px', animation: 'bounce 1s infinite', marginBottom: '20px' },
  loadingTitle: { fontSize: '20px', fontWeight: 900, color: '#191f28' },
  loadingDynamicText: { fontSize: '15px', color: '#3182f6', fontWeight: 700, marginTop: '8px' },

  resultBox: { textAlign: 'center' },
  resultHeader: { fontSize: '22px', fontWeight: 900, marginBottom: '20px' },
  comboGrid: { display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' },
  
  resultCard: { backgroundColor: '#fff', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.08)', border: '1px solid #f2f4f6' },
  imageWrapper: { position: 'relative', width: '100%' },
  saveBtn: { width: '100%', padding: '18px', backgroundColor: '#fff', color: '#191f28', border: 'none', fontWeight: 800, fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' },

  finalImg: { width: '100%', display: 'block' },
  imgTag: { position: 'absolute', top: '15px', left: '15px', backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff', padding: '5px 10px', borderRadius: '10px', fontSize: '12px', fontWeight: 800 },
  imgTagBoy: { position: 'absolute', top: '15px', left: '15px', backgroundColor: '#3182f6', color: '#fff', padding: '5px 10px', borderRadius: '10px', fontSize: '12px', fontWeight: 800 },
  imgTagGirl: { position: 'absolute', top: '15px', left: '15px', backgroundColor: '#f03e3e', color: '#fff', padding: '5px 10px', borderRadius: '10px', fontSize: '12px', fontWeight: 800 },
  secondaryBtn: { width: '100%', padding: '18px', backgroundColor: '#f2f4f6', color: '#4e5968', border: 'none', borderRadius: '18px', fontWeight: 800, cursor: 'pointer' },
  resultActionArea: { display: 'flex', flexDirection: 'column', gap: '12px', padding: '20px 20px 0', backgroundColor: '#fff' },
  saveDeviceBtn: { width: '100%', padding: '16px', backgroundColor: '#3182f6', color: '#fff', border: 'none', borderRadius: '14px', fontWeight: 800, fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' },
  autoSaveNotice: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '13px', color: '#8b95a1', fontWeight: 600, paddingBottom: '10px' },

  /* ✅ 추가된 자체 토스트 스타일 (토스 스타일) */
  toastWrapper: { position: 'fixed', bottom: '100px', left: 0, width: '100%', display: 'flex', justifyContent: 'center', zIndex: 9999, pointerEvents: 'none' },
  toastContent: { backgroundColor: 'rgba(30, 32, 34, 0.9)', color: '#fff', padding: '14px 24px', borderRadius: '100px', fontSize: '14px', fontWeight: 700, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' },

  // ✅ 보관함 관련 디자인 스타일 (새로 수정된 코드 적용)
  buttonArea: { marginTop: '16px', display: 'flex', justifyContent: 'flex-start' }, // 왼쪽 정렬로 안정감 부여
  historyToggleBtn: { 
    padding: '10px 18px', 
    backgroundColor: '#f2f4f6', 
    border: '1px solid #e5e8eb', 
    borderRadius: '12px', 
    color: '#4e5968', 
    fontSize: '13px', 
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  historyGrid: { 
    display: 'grid', 
    gridTemplateColumns: '1fr 1fr', 
    gap: '12px', 
    marginTop: '20px',
    paddingBottom: '40px' 
  },
  historyItem: { 
    backgroundColor: '#fff', 
    borderRadius: '16px', 
    overflow: 'hidden', 
    border: '1px solid #f2f4f6', 
    boxShadow: '0 4px 10px rgba(0,0,0,0.03)',
    cursor: 'pointer'
  },
  historyImg: { width: '100%', aspectRatio: '1/1', objectFit: 'cover' },
  historyDate: { padding: '10px', fontSize: '12px', fontWeight: 600, color: '#8b95a1', textAlign: 'center' },
};

export default AIBabyStudio;