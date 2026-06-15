import React from 'react';
// 🔥 제공해주신 꽃 로고를 src/assets 폴더에 넣고 경로를 맞춰주세요!
// import logo from '../assets/bomiom_logo.png'; 

const Splash: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-[9999] transition-opacity duration-1000 ease-in-out opacity-0 scale-95" 
         style={{ animation: 'fadeInScale 1s forwards, fadeOut 1s forwards 2s' }}>
      
      {/* 로고 이미지 - image_5.png의 로고 활용 */}
      <img src={logo} alt="봄이옴" className="w-40 h-40 mb-10 object-contain" />
      
      {/* 브랜드 명칭 - 한글로 "봄이옴", 세련된 앱 전용 폰트 권장 */}
      <h1 className="text-5xl font-extrabold text-slate-800 tracking-wider">
        봄이옴
      </h1>

      {/* Tailwind CSS를 사용하여 부드러운 애니메이션 구현 */}
      <style>{`
        /* tailwind.config.js에서 'Pretendard' 등의 고급 앱 전용 폰트를 기본 폰트로 정의하는 것을 권장합니다 */
        @keyframes fadeInScale {
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes fadeOut {
          to {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default Splash;