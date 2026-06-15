import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css'; // 스타일 파일 불러오기

// 🚨 [긴급 수술] 기존에 유저들 폰에 깔려서 데이터를 막고 있는 서비스 워커를 강제로 삭제합니다!
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for (let registration of registrations) {
      registration.unregister();
      console.log('✅ 꼬여있던 서비스 워커 강제 삭제 완료!');
    }
  }).catch(function(err) {
    console.log('❌ 서비스 워커 삭제 실패: ', err);
  });
}

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}