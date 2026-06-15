import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs, getCountFromServer, where } from "firebase/firestore";
import { ChevronLeft, Timer, Trophy, CheckCircle, XCircle, ChevronRight, Medal, Flame, RotateCcw, Share2, X, Play, Music, Sparkles, Baby, HeartPulse, ArrowLeft, Flower2 } from 'lucide-react';
import NamingPage from './NamingPage';
import AIBabyStudio from './AIBabyStudio';
import AIStoryStudio from './AIStoryStudio'; // 태담동화
import AISongStudio from './AISongStudio';   // AI동요

// --- 📚 50일 서바이벌 DB (실제로는 50개) ---
// --- 📚 50일 서바이벌 DB (정답 균등 분배 완료) ---
const SURVIVAL_DB = [
  { day: 1, title: "첫 만남과 태지", question: "아기 피부에 하얀 크림 같은 '태지'가 묻어있습니다. 대처법은?", options: ["감염 증상이므로 의사를 부른다.", "자연스러운 보호막이므로 억지로 닦지 않는다.", "물티슈로 빡빡 닦아낸다.", "오일로 문질러 벗겨낸다."], correctIdx: 1, explanation: "태지는 피부를 보호하는 천연 크림입니다. 억지로 닦아내면 피부가 상하며 자연스럽게 흡수됩니다. [참고: 대한소아청소년과학회]", tip: "보기엔 지저분해 보여도 절대 억지로 떼지 마세요!" },
  { day: 2, title: "충격적인 첫 기저귀", question: "끈적하고 까만 콜타르 같은 변이 들어있습니다. 대처법은?", options: ["장출혈을 의심하고 응급실에 간다.", "물티슈로 대충 닦고 덮는다.", "분유 알레르기이므로 분유를 바꾼다.", "정상적인 '태변'이므로 따뜻한 물로 닦아준다."], correctIdx: 3, explanation: "생후 1~2일째 나오는 흑녹색 변은 '태변'으로 엄마 뱃속 분비물입니다. 매우 정상입니다. [참고: 대한소아청소년과학회]", tip: "태변은 엄청 끈적거려 미지근한 물로 씻기는 게 좋습니다." },
  { day: 3, title: "황달의 시작", question: "아기 얼굴이 노랗게 변하기 시작했습니다. 가장 적절한 행동은?", options: ["정상적인 생리적 황달인지 수치를 확인하며 모유/분유를 잘 먹인다.", "수유를 중단하고 물을 먹인다.", "햇빛을 직접 쐬게 한다.", "황달약을 처방받아 즉시 먹인다."], correctIdx: 0, explanation: "생후 2~3일경 나타나는 생리적 황달은 흔하며, 잘 먹고 잘 싸면 빌리루빈이 배출되어 호전됩니다. [참고: 질병관리청 국가건강정보포털]", tip: "소변과 대변으로 배출되니 수유량을 충분히 유지하세요." },
  { day: 4, title: "초유의 기적", question: "양이 아주 적고 끈적한 노란 모유(초유)가 나옵니다. 어떻게 할까요?", options: ["양이 적으니 짜서 버린다.", "상한 모유이므로 먹이지 않는다.", "분유랑 섞어서 양을 늘려 먹인다.", "면역 성분이 농축된 것이므로 한 방울이라도 먹인다."], correctIdx: 3, explanation: "초유는 양은 적지만 면역글로불린이 풍부한 '천연 예방주사'입니다. [참고: 보건복지부 모유수유 가이드]", tip: "초유는 아기 위 크기(포도알 크기)에 딱 맞는 양입니다." },
  { day: 5, title: "공포의 젖몸살", question: "가슴이 돌덩이처럼 딱딱해지고 열이 납니다. 올바른 대처법은?", options: ["뜨거운 수건으로 계속 찜질한다.", "차가운 양배추 잎을 올려 열을 내리고 부드럽게 마사지한다.", "수분 섭취를 완전히 중단한다.", "수유를 며칠간 쉰다."], correctIdx: 1, explanation: "열감이 심할 때는 냉찜질(양배추 잎 등)이 부기를 빼는 데 도움을 줍니다. [참고: 대한모유수유의사회]", tip: "뜨거운 찜질은 젖을 더 돌게 해 통증을 악화시킬 수 있습니다." },
  { day: 6, title: "딸꾹질의 이유", question: "아기가 딸꾹질을 멈추지 않습니다. 가장 안전한 대처법은?", options: ["따뜻한 모유/분유를 조금 먹이거나 모자를 씌워준다.", "깜짝 놀라게 한다.", "차거운 물을 먹인다.", "거꾸로 안아준다."], correctIdx: 0, explanation: "신생아 딸꾹질은 체온 변화에 민감해서 발생합니다. 모자를 씌워 따뜻하게 하거나 수유를 조금 하면 멈춥니다. [참고: 대한소아청소년과학회]", tip: "스스로 멈출 때까지 기다려도 괜찮습니다." },
  { day: 7, title: "탯줄의 관리", question: "배꼽이 아직 안 떨어졌습니다. 목욕과 소독은 어떻게 할까요?", options: ["통목욕을 시키고 소독하지 않는다.", "밴드로 꽁꽁 싸맨다.", "부분 목욕을 시키고 알코올/소독솜으로 배꼽 주변을 잘 말려준다.", "탯줄을 손으로 뜯어낸다."], correctIdx: 2, explanation: "탯줄이 떨어지기 전에는 물에 푹 담그는 통목욕을 피하고, 건조하게 관리하는 것이 가장 중요합니다. [참고: WHO 신생아 관리 가이드]", tip: "배꼽 관리는 '통풍과 건조'가 핵심입니다." },
  { day: 8, title: "신생아 여드름", question: "아기 얼굴에 오톨도톨한 붉은 좁쌀(태열/여드름)이 올라왔습니다.", options: ["어른용 연고를 바른다.", "매일 비누로 씻긴다.", "손톱으로 짠다.", "시원하게 해 주고 보습을 철저히 한다."], correctIdx: 3, explanation: "신생아 여드름과 태열은 호르몬과 온도 때문에 발생하며, 서늘한 환경과 보습으로 자연스럽게 호전됩니다. [참고: 대한피부과학회]", tip: "방 온도를 22도 내외로 서늘하게 맞춰주세요." },
  { day: 9, title: "수면 시간", question: "아기가 하루에 16~18시간을 잡니다. 정상인가요?", options: ["매우 정상이다. 먹고 자는 것이 일이다.", "비정상이니 깨워서 놀아준다.", "발달 지연이 의심된다.", "수면제를 먹은 것 같다."], correctIdx: 0, explanation: "신생아는 하루 16~20시간을 자며 뇌를 발달시킵니다. [참고: 질병관리청 국가건강정보포털]", tip: "수유 텀만 잘 지켜진다면 푹 자도록 두는 것이 좋습니다." },
  { day: 10, title: "첫 손톱깎이", question: "아기 손톱이 길어 얼굴을 긁습니다. 언제 깎아줄까요?", options: ["깨어있을 때 재빨리 깎는다.", "이빨로 물어뜯어 준다.", "아기가 깊이 잠들었을 때 유아용 가위로 조심스럽게 자른다.", "한 달 전에는 절대 자르지 않는다."], correctIdx: 2, explanation: "신생아는 깊은 잠(수면 주기)에 빠졌을 때 깎는 것이 가장 안전합니다. [참고: 보건복지부 초보아빠수첩]", tip: "손가락 살을 누르면서 깎아야 상처를 예방할 수 있습니다." },
  { day: 11, title: "녹변의 공포", question: "아기 똥이 쑥색(녹변)입니다. 병원에 가야 할까요?", options: ["장염이므로 즉시 응급실에 간다.", "유산균을 하루 5포 먹인다.", "분유를 당장 끊는다.", "담즙이 섞여 나오는 정상적인 변이므로 잘 놀면 괜찮다."], correctIdx: 3, explanation: "녹변은 담즙이 산화되어 나오는 색으로, 정상적인 변의 한 종류입니다. [참고: 대한소아소화기영양학회]", tip: "황금똥만 정상이 아닙니다. 아기가 잘 먹고 잘 놀면 괜찮습니다." },
  { day: 12, title: "트림 지옥", question: "수유 후 트림을 안 합니다. 어떻게 할까요?", options: ["안 했으니 그냥 눕힌다.", "10~15분 정도 등을 쓸어주며 세워 안아준 뒤, 고개를 옆으로 돌려 눕힌다.", "트림할 때까지 1시간이고 등을 때린다.", "엎드려 재운다."], correctIdx: 1, explanation: "트림을 못 하더라도 15분 정도 세워 안아 소화를 돕고, 게워낼 것을 대비해 고개를 옆으로 돌려 눕힙니다. [참고: 보건복지부 초보아빠수첩]", tip: "등을 두드리기보다 아래에서 위로 쓸어올리는 것이 효과적입니다." },
  { day: 13, title: "모로 반사", question: "아기가 자다가 자기 팔에 놀라 깨며 웁니다. 대처법은?", options: ["팔을 묶어둔다.", "놀라지 않게 곁에서 계속 팔을 잡아준다.", "속싸개나 스와들업으로 안정감 있게 감싸준다.", "적응하도록 그냥 울게 둔다."], correctIdx: 2, explanation: "신생아의 모로 반사는 속싸개로 감싸주면 엄마 뱃속 같은 안정감을 느껴 줄어듭니다. [참고: 대한소아청소년과학회]", tip: "속싸개는 생후 1달 전후로 아기가 답답해할 때 풀어주면 됩니다." },
  { day: 14, title: "수유 텀 맞추기", question: "아기가 1시간마다 젖을 찾습니다. 올바른 행동은?", options: ["한 번에 푹 먹여서 2.5~3시간의 텀을 천천히 만들어준다.", "달라는 대로 계속 준다.", "안 주고 굶긴다.", "물로 배를 채워준다."], correctIdx: 0, explanation: "조금씩 자주 먹으면 전축유(앞젖)만 먹게 되어 소화가 안 됩니다. 한 번에 푹 먹여 텀을 늘려야 합니다. [참고: 대한모유수유의사회]", tip: "울 때마다 젖을 물리면 배앓이의 원인이 됩니다." },
  { day: 15, title: "집으로 가는 날", question: "조리원 퇴소 후 집에 오자마자 아기가 자지러지게 웁니다. 이유는?", options: ["집 냄새가 싫어서", "간호사가 없어서", "어디가 크게 아파서", "환경, 온도, 소리의 변화로 인한 극심한 스트레스"], correctIdx: 3, explanation: "조리원과 집은 아기에게 완전히 다른 세계입니다. 스트레스로 우는 것이니 조용하고 따뜻하게 안아주세요. [참고: 보건복지부 육아 가이드]", tip: "백색소음을 틀고 실내 온도를 22~24도로 맞춰주세요." },
  { day: 16, title: "등 센서 발동", question: "안으면 자고 바닥에 눕히면 5분 만에 깹니다. 가장 먼저 확인할 것은?", options: ["바닥이 너무 푹신한지", "아기가 천재인지", "아기가 깊은 잠(약 20분 소요)에 들었는지 확인 후 눕히기", "침대가 불량인지"], correctIdx: 2, explanation: "신생아는 얕은 잠 단계가 깁니다. 완전히 깊은 잠에 빠진 후 눕혀야 덜 깹니다. [참고: 수면발달 전문가 가이드]", tip: "아기 팔을 살짝 들어 올렸을 때 툭 떨어지면 깊은 잠에 든 것입니다." },
  { day: 17, title: "첫 목욕의 온도", question: "아기 목욕물 온도는 몇 도가 적당할까요?", options: ["38~40도 (엄마 팔꿈치를 넣었을 때 따뜻한 정도)", "30도 (미지근하게)", "20도 (시원하게)", "45도 (뜨끈하게)"], correctIdx: 0, explanation: "38~40도가 가장 이상적입니다. 팔꿈치를 물에 넣었을 때 기분 좋게 따뜻하면 됩니다. [참고: 보건복지부 초보아빠수첩]", tip: "목욕 시간은 5~10분 이내로 짧게 끝내는 것이 좋습니다." },
  { day: 18, title: "배꼽 탈락", question: "기저귀를 갈다 보니 탯줄이 떨어졌습니다. 진물이 조금 나는데 대처법은?", options: ["연고를 바른다.", "물을 붓는다.", "밴드를 붙여 막아둔다.", "알코올 솜으로 가볍게 소독하고 완전히 건조시킨다."], correctIdx: 3, explanation: "배꼽이 떨어지고 약간의 진물이나 피가 나는 것은 정상입니다. 소독 후 건조가 필수입니다. [참고: 질병관리청 국가건강정보포털]", tip: "기저귀 윗부분을 접어 배꼽이 덮이지 않게 통풍시켜 주세요." },
  { day: 19, title: "밤낮의 구분", question: "새벽에 아기가 깨서 눈이 말똥말똥합니다. 올바른 행동은?", options: ["불을 훤히 켜고 놀아준다.", "최대한 어둡고 조용한 상태에서 수유만 하고 바로 재운다.", "거실로 데리고 나온다.", "노래를 크게 부른다."], correctIdx: 1, explanation: "생후 한 달 이후부터는 밤낮을 가르쳐야 합니다. 밤 수유는 '재미없고 조용하게' 하는 것이 원칙입니다. [참고: 대한소아청소년과학회]", tip: "수면등 하나만 켜고 눈맞춤도 최소화하세요." },
  { day: 20, title: "머리의 숨구멍", question: "아기 정수리가 콩닥콩닥 뛰고 뼈가 말랑합니다. 정상인가요?", options: ["정상적인 '대천문'이므로 강하게 누르지 않도록 주의한다.", "비타민 D 부족이다.", "뇌수막염 증상이다.", "당장 수술해야 한다."], correctIdx: 0, explanation: "아기 머리뼈가 덜 굳어 생긴 숨구멍(대천문)이며, 돌 전후로 자연스럽게 닫힙니다. [참고: 질병관리청 국가건강정보포털]", tip: "일상적인 샴푸나 쓰다듬기는 괜찮지만 강한 압박은 피하세요." },
  { day: 21, title: "갑작스런 게워냄", question: "분유를 먹고 분수처럼 토했습니다. 대처법은?", options: ["다시 억지로 100ml를 먹인다.", "등을 세게 때린다.", "즉시 고개를 옆으로 돌려 기도가 막히지 않게 하고 진정시킨다.", "물을 먹인다."], correctIdx: 2, explanation: "토사물이 기도를 막지 않도록 고개를 돌리거나 세워 안는 것이 최우선입니다. [참고: 대한소아소화기영양학회]", tip: "신생아 위는 일자형이라 잘 게워냅니다. 지속적인 분수토면 병원에 가세요." },
  { day: 22, title: "배앓이의 시작", question: "매일 같은 시간(주로 초저녁)에 이유 없이 악을 쓰고 웁니다.", options: ["감기 증상이다.", "배가 고픈 것이니 수유를 계속한다.", "귀신을 본 것이다.", "영아산통(배앓이)일 수 있으니 배를 따뜻하게 하고 I-L-U 마사지를 해준다."], correctIdx: 3, explanation: "소화기관 미숙으로 가스가 차서 아픈 영아산통입니다. 마사지와 트림이 해결책입니다. [참고: 대한소아청소년과학회]", tip: "분유 수유 시 젖병에 공기가 들어가지 않게 주의하세요." },
  { day: 23, title: "응애! 암호 해독", question: "입을 '쩝쩝'거리며 주먹을 빨고 고개를 돌립니다. 무슨 신호일까요?", options: ["졸리다는 신호", "배가 고프다는 초기 신호", "기저귀를 갈아달라는 신호", "놀아달라는 신호"], correctIdx: 1, explanation: "울기 시작하면 이미 늦은 배고픔 신호입니다. 쩝쩝거릴 때 미리 수유를 준비하세요. [참고: 대한모유수유의사회]", tip: "자지러지게 울 때 수유하면 공기를 삼켜 배앓이를 할 수 있습니다." },
  { day: 24, title: "안구 진탕?", question: "아기 눈동자가 가끔 모이거나(사시) 바깥으로 돌아갑니다.", options: ["신생아는 눈 근육이 미발달하여 흔한 증상이다. (가성사시)", "안과 수술이 시급하다.", "스마트폰을 보여준다.", "눈을 비벼준다."], correctIdx: 0, explanation: "생후 3~4개월 전에는 눈동자를 제어하는 근육이 미숙해 자주 사시처럼 보입니다. [참고: 대한안과학회]", tip: "6개월 이후에도 계속되면 안과 검진이 필요합니다." },
  { day: 25, title: "소변 횟수", question: "하루에 기저귀가 몇 개 정도 젖어야 밥을 잘 먹고 있는 걸까요?", options: ["1~2개", "6개 이상 흠뻑 젖은 기저귀", "10개 이상", "3~4개"], correctIdx: 1, explanation: "하루 6개 이상의 젖은 기저귀가 나오면 수유량이 충분하다는 객관적인 지표입니다. [참고: 보건복지부 육아 가이드]", tip: "소변 색이 진한 벽돌색(요산뇨)이면 수분이 부족한 것입니다." },
  { day: 26, title: "BCG 예방접종", question: "예방접종 후 아기 몸이 뜨겁습니다. 38도가 넘었을 때 대처는?", options: ["얼음물로 닦아준다.", "옷을 껴입혀 땀을 낸다.", "당황하지 않고 해열제를 먹인다.", "119에 전화한다."], correctIdx: 2, explanation: "접종 후 미열은 흔한 면역 반응입니다. 38도 이상이면 개월 수에 맞는 해열제(아세트아미노펜)를 먹이세요. [참고: 질병관리청 예방접종도우미]", tip: "생후 100일 이전의 신생아가 '접종 없이' 38도 이상 열이 나면 무조건 응급실로 가야 합니다." },
  { day: 27, title: "수면 의식", question: "아기가 쉽게 잠들게 하려면 매일 똑같이 해줘야 하는 것은?", options: ["강렬한 놀이", "수면 의식 (목욕 -> 마사지 -> 수유 -> 어둡게 하기)", "새로운 음악 들려주기", "장소 계속 바꾸기"], correctIdx: 1, explanation: "매일 같은 패턴(수면 의식)을 반복하면 아기는 '아, 이제 잘 시간이구나'라고 몸으로 배웁니다. [참고: 영유아 수면 가이드]", tip: "목욕 후 차분한 환경을 조성하는 것이 포인트입니다." },
  { day: 28, title: "비타민 D", question: "신생아에게 매일 먹이라고 권장되는 영양제는?", options: ["비타민 D 드롭", "오메가3", "홍삼", "철분제"], correctIdx: 0, explanation: "햇빛을 보지 못하는 신생아의 뼈 발달과 면역력을 위해 비타민 D 액상을 매일 먹이는 것이 권장됩니다. [참고: 대한소아청소년과학회 권고안]", tip: "분유나 모유에 똑 떨어뜨려 먹이면 편합니다." },
  { day: 29, title: "터미타임", question: "아기 목 가누기를 돕는 '터미타임(엎드려 놓기)'은 언제가 좋을까요?", options: ["수유 직후", "기저귀를 갈고 기분이 좋을 때, 부모가 지켜보는 앞", "잠잘 때", "아기가 피곤해할 때"], correctIdx: 1, explanation: "수유 직후는 토할 수 있으므로, 깨어있고 컨디션이 좋을 때 안전한 곳에서 짧게 시켜줍니다. [참고: 미국소아과학회(AAP)]", tip: "처음엔 엄마 배 위에서부터 시작해 보세요." },
  { day: 30, title: "두피의 각질", question: "아기 머리에 노란 딱지(지루성 두피염)가 생겼습니다.", options: ["손톱으로 긁어 뗀다.", "식초로 감긴다.", "오일을 발라 불린 후 샴푸로 부드럽게 씻어낸다.", "바리깡으로 머리를 민다."], correctIdx: 2, explanation: "신생아 지루성 피부염은 피지 분비 때문에 생깁니다. 베이비 오일로 불려서 부드럽게 제거해야 합니다. [참고: 대한피부과학회]", tip: "억지로 떼면 상처가 나고 감염될 수 있습니다." },
  { day: 31, title: "코 막힘", question: "아기가 '그렁그렁' 소리를 내며 코막힘으로 힘들어합니다.", options: ["어른용 코 스프레이를 뿌린다.", "식염수를 한두 방울 넣고 콧물 흡입기로 살짝 빼준다.", "코딱지를 핀셋으로 뽑는다.", "항생제를 먹인다."], correctIdx: 1, explanation: "신생아는 비강이 좁아 잘 막힙니다. 식염수로 콧물을 부드럽게 한 뒤 조심스럽게 빼주거나 가습기를 트세요. [참고: 질병관리청 국가건강정보포털]", tip: "온습도(온도 22도, 습도 50-60%) 조절이 코막힘 예방의 1순위입니다." },
  { day: 32, title: "원더윅스 (급성장기)", question: "평소 잘 자던 아기가 갑자기 껌딱지가 되어 계속 웁니다.", options: ["몸과 뇌가 폭발적으로 성장하는 '원더윅스' 시기이므로 평소보다 더 많이 안아준다.", "어디 아픈 것이니 병원만 다닌다.", "버릇 나빠지니 방치한다.", "분유를 바꾼다."], correctIdx: 0, explanation: "급성장기(원더윅스)에는 아기도 성장통과 뇌 발달로 두려움을 느낍니다. 부모의 따뜻한 스킨십이 약입니다. [참고: 영유아 발달심리 가이드]", tip: "이 시기는 보통 며칠에서 일주일 안에 지나갑니다. 멘탈을 챙기세요!" },
  { day: 33, title: "공갈젖꼭지(쪽쪽이)", question: "아기가 계속 빨고 싶어 합니다. 쪽쪽이는 언제부터 물릴까요?", options: ["조리원 퇴소 즉시", "절대 물리지 않는다.", "돌 이후에", "생후 4주(한 달) 이후, 유두 혼동이 없을 때"], correctIdx: 3, explanation: "모유 수유아의 경우 유두 혼동을 막기 위해 한 달 이후에 물리는 것이 정석입니다. [참고: 미국소아과학회(AAP)]", tip: "영아산통 완화와 수면 연장에 쪽쪽이는 부모의 구원템이 될 수 있습니다." },
  { day: 34, title: "눈물샘 막힘", question: "아기 한쪽 눈에 자꾸 노란 눈곱이 낍니다.", options: ["항생제 안약을 무조건 넣는다.", "식염수로 눈 앞머리를 닦아주고, 코쪽 눈물샘을 부드럽게 마사지해준다.", "물티슈로 세게 닦는다.", "안대로 가린다."], correctIdx: 1, explanation: "신생아 눈물샘 막힘은 흔합니다. 깨끗한 손으로 눈물샘을 마사지해주면 보통 돌 전에 뚫립니다. [참고: 대한안과학회]", tip: "눈곱이 초록색이거나 흰자위가 충혈되면 결막염일 수 있으니 병원에 가세요." },
  { day: 35, title: "외출의 기준", question: "신생아 첫 외출(산책)은 언제가 가장 적당할까요?", options: ["생후 100일 전후, 아기 목 가누기가 안정되고 날씨가 좋을 때", "생후 1주", "무조건 생후 1년 뒤", "비 오는 날"], correctIdx: 0, explanation: "50일 전 예방접종을 제외한 일반적인 산책은 아기 면역력과 목 가누기가 어느 정도 형성된 100일 전후가 안전합니다. [참고: 보건복지부 초보아빠수첩]", tip: "외출 시 햇빛은 피하고 미세먼지 수치를 꼭 확인하세요." },
  { day: 36, title: "수면 교육 (안눈법)", question: "자다 깬 아기를 울리지 않고 재우는 '안눈법'의 핵심은?", options: ["안아서 눕히기를 무한 반복", "안아서 재운 뒤 눕히기", "울면 안아주고, 진정되면 완전히 잠들기 전에 바닥에 눕히는 것", "눕혀놓고 방 나가기"], correctIdx: 2, explanation: "안눈법은 스스로 잠드는 법을 배우게 하되, 심하게 울 때는 안아서 진정시켜 안정감을 주는 방식입니다. [참고: 대한소아청소년과학회 수면 권고]", tip: "잠들락 말락 할 때 바닥에 눕혀야 등 센서를 극복할 수 있습니다." },
  { day: 37, title: "변비 확인", question: "아기가 3일째 똥을 안 쌉니다. 어떻게 할까요?", options: ["당장 관장약을 넣는다.", "어른 변비약을 먹인다.", "유산균을 3배로 먹인다.", "모유 수유아의 경우 일주일까지도 안 쌀 수 있으니, 배가 빵빵하지 않고 방귀를 잘 뀌면 지켜본다."], correctIdx: 3, explanation: "모유는 소화 흡수가 잘 되어 변으로 나올 찌꺼기가 적어 여러 날 안 싸기도 합니다. [참고: 대한소아소화기영양학회]", tip: "응가가 염소 똥처럼 딱딱하게 나오면 수분 부족(변비)입니다." },
  { day: 38, title: "분유 타기", question: "분유를 탈 때 올바른 방법은?", options: ["끓여서 70도로 식힌 물을 반 넣고, 분유를 녹인 후 최종 눈금까지 물을 채운다.", "뜨거운 물로 완전히 탄 뒤 얼음물에 식힌다.", "가루를 먼저 넣고 물을 맞춘다.", "찬물에 마구 흔든다."], correctIdx: 0, explanation: "정확한 농도를 맞추기 위해 물을 먼저 조금 넣고 조제한 뒤 총량을 맞추는 것이 정석입니다. [참고: 세계보건기구(WHO) 조제분유 수유 가이드]", tip: "거품이 생기지 않도록 양손으로 비비듯 돌려 섞어주세요." },
  { day: 39, title: "아빠의 역할", question: "퇴근 후 아빠가 할 수 있는 가장 좋은 육아 참여는?", options: ["아기 옆에서 스마트폰 하기", "엄마에게 훈수 두기", "엄마를 푹 자거나 쉴 수 있게 아기를 전담 마크하기", "아기 자면 같이 자기"], correctIdx: 2, explanation: "엄마의 체력 회복과 우울증 예방을 위해 퇴근 후 최소 1~2시간은 아빠가 온전히 육아를 전담하는 것이 부부 금실의 비결입니다. [참고: 여성가족부 아빠 육아 가이드]", tip: "이 시간에 아빠와 아기의 애착도 가장 많이 형성됩니다." },
  { day: 40, title: "두상 관리", question: "아기 뒷통수가 납작해지는 것(사두증)을 예방하려면?", options: ["딱딱한 바닥에 눕힌다.", "깨어있을 때 터미타임을 자주 하고, 눕힐 때 고개 방향을 양쪽으로 번갈아 돌려준다.", "엎드려 재운다 (SIDS 위험 증가).", "짱구베개에 하루종일 둔다."], correctIdx: 1, explanation: "엎드려 재우는 것은 영아돌연사증후군 위험이 매우 큽니다. 깨어있을 때 방향을 바꿔주는 것이 가장 좋습니다. [참고: 미국소아과학회(AAP)]", tip: "아기는 빛이나 소리가 나는 쪽을 바라보는 습성이 있습니다." },
  { day: 41, title: "옷 입히기", question: "실내에서 신생아 옷은 어느 정도 입혀야 할까요?", options: ["기저귀만 채운다", "어른보다 두 겹 더 입히기", "수면조끼에 패딩까지", "어른보다 얇게 (태열 예방)"], correctIdx: 3, explanation: "신생아는 기초 체온이 높고 땀샘 조절이 미숙해 어른보다 한 겹 정도 얇게 입혀 서늘하게 키우는 것이 태열 예방에 좋습니다. [참고: 질병관리청 건강가이드]", tip: "아기가 추운지 확인하려면 손발이 아닌 뒷목의 온도를 만져보세요." },
  { day: 42, title: "침독의 습격", question: "아기가 옹알이를 하며 침을 흘려 턱 주변이 빨개졌습니다.", options: ["연고를 치덕치덕 바른다.", "침을 흘릴 때마다 마른 가제수건으로 톡톡 두드려 닦고 보습제를 발라준다.", "침샘을 막는다.", "물티슈로 박박 닦는다."], correctIdx: 1, explanation: "물티슈의 마찰은 피부를 자극합니다. 부드러운 수건으로 흡수시키듯 닦고 보습 장벽을 만들어주세요. [참고: 대한피부과학회]", tip: "심할 경우 침독 크림(비판텐 등)을 자기 전에 발라주면 좋습니다." },
  { day: 43, title: "이앓이 증상?", question: "50일인데 아기가 주먹을 입에 넣고 쩝쩝거리며 웁니다.", options: ["벌써 이가 나는 것이다.", "배가 고파서 손을 먹는 것이다.", "구강기 시작으로 손과 입으로 세상을 탐색하는 지극히 정상적인 발달 과정이다.", "손에 꿀이 묻은 것이다."], correctIdx: 2, explanation: "보통 이앓이는 6개월 전후에 시작됩니다. 이 시기의 주먹 빨기는 뇌 발달을 위한 자연스러운 탐색입니다. [참고: 대한소아치과학회]", tip: "손에 벙어리장갑을 씌워 막기보다 손을 깨끗하게 닦아주세요." },
  { day: 44, title: "카시트 탑승", question: "병원 외출 시 카시트 탑승의 올바른 방법은?", options: ["엄마가 안고 탄다.", "카시트를 앞보기로 설치한다.", "짐칸에 싣는다.", "카시트를 뒤보기(후방장착)로 설치하고 벨트를 손가락 하나 들어갈 정도로 꽉 조인다."], correctIdx: 3, explanation: "돌 전 아기는 목에 힘이 없어 충돌 시 목 꺾임을 방지하기 위해 무조건 '뒤보기' 장착이 법적/안전 의무입니다. [참고: 한국교통안전공단]", tip: "두꺼운 패딩을 입힌 채 벨트를 매면 공간이 떠서 위험합니다." },
  { day: 45, title: "단유의 결정", question: "엄마의 복직과 피로 때문에 분유로 갈아타려 합니다. 죄책감이 드나요?", options: ["분유도 영양성분이 훌륭하며, 엄마의 멘탈과 체력 회복이 아기에게 주는 사랑보다 중요하다.", "모유를 안 주면 나쁜 엄마다.", "모유를 안 먹여서 아기가 자주 아플 것이다.", "주변 사람들에게 핑계를 댄다."], correctIdx: 0, explanation: "완모든 완분이든 정답은 없습니다. 가장 중요한 것은 '행복하고 건강한 엄마'가 곁에 있는 것입니다. [참고: 보건복지부 산후우울증 예방 가이드]", tip: "분유를 먹일 때 눈을 맞추고 다정하게 말을 건네주면 애착 형성에 완벽합니다." },
  { day: 46, title: "수유 시 핸드폰", question: "수유하면서 스마트폰을 봐도 될까요?", options: ["자유시간이니 맘껏 본다.", "수유 시간은 아기와 눈을 맞추고 애착을 형성하는 최고의 골든타임이므로 스마트폰을 내려놓는다.", "전자파가 안 좋으니 버린다.", "아기에게 유튜브를 보여준다."], correctIdx: 1, explanation: "아기의 시력 범위(20~30cm)는 딱 젖을 먹으며 엄마 얼굴을 볼 수 있는 거리입니다. 눈맞춤으로 애착을 쌓아주세요. [참고: 소아청소년정신의학회]", tip: "새벽 수유 때는 졸음을 깨기 위해 오디오북이나 팟캐스트를 듣는 것을 추천합니다." },
  { day: 47, title: "옹알이 대답", question: "아기가 '아구~ 우~' 하고 소리를 냅니다.", options: ["무시한다.", "조용히 하라고 한다.", "하이톤의 목소리(Motherese)로 아기의 눈을 맞추고 리액션하며 대답해 준다.", "외계어라 못 알아듣는 척한다."], correctIdx: 2, explanation: "아기의 옹알이에 부모가 적극적으로 반응해주면 아기의 뇌 발달과 언어 능력이 폭발적으로 성장합니다. [참고: 영유아 뇌발달 가이드]", tip: "과장된 표정과 목소리로 '그랬어~?' 하고 핑퐁 대화를 해주세요." },
  { day: 48, title: "엄마의 탈모", question: "엄마의 머리카락이 한 움큼씩 빠지기 시작합니다.", options: ["대머리가 될 징조다.", "아기 머리카락도 빠질 것이다.", "스트레스 때문이니 약을 먹는다.", "임신 중 안 빠지던 머리카락이 호르몬 변화로 한꺼번에 빠지는 '산후 휴지기 탈모'로, 돌 무렵 다시 돌아온다."], correctIdx: 3, explanation: "산후 탈모는 출산 후 100일 전후로 최고조에 달하며, 자연스러운 현상이니 너무 스트레스받지 마세요. [참고: 대한산부인과학회]", tip: "단백질을 잘 섭취하고 검은콩 등이 도움이 될 수 있습니다." },
  { day: 49, title: "통잠의 조짐?", question: "아기가 밤에 깨지 않고 6시간을 연달아 잡니다. 깨워서 먹일까요?", options: ["아기 몸무게가 정상적으로 늘고 있다면, 깨우지 않고 푹 자게 둔다.", "시간 맞춰 깨워 먹인다.", "낮잠을 안 재운다.", "분유를 아주 진하게 타서 더 재운다."], correctIdx: 0, explanation: "생후 1달이 지나고 체중이 잘 늘고 있다면 굳이 깨워서 수유할 필요 없이 통잠의 기적을 누리세요. [참고: 대한소아청소년과학회]", tip: "수면 교육의 첫 결실입니다! 부모님도 이 기회에 푹 주무세요." },
  { day: 50, title: "50일의 기적", question: "드디어 50일입니다. 부부가 서로에게 해야 할 가장 중요한 말은?", options: ["다음 100일을 향해 달려!", "누가 더 힘들었는지 따지기.", "우리 진짜 고생 많았어. 당신 덕분에 무사히 왔어. 고마워.", "앞으로 돈 많이 벌어와."], correctIdx: 2, explanation: "가장 치열했던 50일 생존 게임을 무사히 넘긴 부부의 팀워크에 스스로 박수를 보내야 합니다. [참고: 가족심리전문가 권고]", tip: "육아는 긴 마라톤입니다. 서로를 향한 칭찬과 격려가 최고의 원동력입니다." }
];

const MAX_TIME_MS = 15000; // 15초를 밀리초로 설정

// ✅ [신규 추가] 구글 애드센스 배너용 React 컴포넌트 (대표님 고유 ID 적용 완료)
const GoogleAdBanner = () => {
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
      }
    } catch (e) {
      console.error("AdSense loading error:", e);
    }
  }, []);

  return (
    <div className="w-full flex justify-center items-center mt-2 mb-2 min-h-[60px]">
      <ins className="adsbygoogle"
           style={{ display: 'block' }}
           data-ad-client="ca-pub-5918542219077560"
           data-ad-slot="2827909704"
           data-ad-format="auto"
           data-full-width-responsive="true"></ins>
    </div>
  );
};

const KakaoAdFit = ({ unit }: { unit: string }) => {
  const adRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (adRef.current) adRef.current.innerHTML = '';
    const ins = document.createElement('ins');
    ins.className = 'kakao_ad_area';
    ins.style.display = 'none';
    ins.setAttribute('data-ad-width', '320');
    ins.setAttribute('data-ad-height', '100');
    ins.setAttribute('data-ad-unit', unit);
    const script = document.createElement('script');
    script.src = '//t1.daumcdn.net/kas/static/ba.min.js';
    script.async = true;
    if (adRef.current) {
      adRef.current.appendChild(ins);
      adRef.current.appendChild(script);
    }
  }, [unit]);
  return (
    <div className="w-full flex justify-center items-center mt-2 mb-2">
      <div ref={adRef} className="w-full flex justify-center"></div>
    </div>
  );
};

const GardenPage = ({ user, onBack, onUpdateUser, addToast }: any) => {
  
  // 🌟 모의고사 서브 리스트 화면 제어용 상태
  const [showQuizList, setShowQuizList] = useState(false);
  // 🌟 라운지 메인에 띄울 실시간 통합 랭킹
  const [hubRankings, setHubRankings] = useState<any[]>([]);

  useEffect(() => {
    const fetchHubRankings = async () => {
      try {
        // Lv.1 점수 기준으로 메인 랭킹 5명을 불러옵니다 (필요시 합산 로직으로 변경 가능)
        const q = query(collection(db, "users"), orderBy("quizBestScore_1", "desc"), limit(5));
        const snap = await getDocs(q);
        setHubRankings(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter((d:any) => d.quizBestScore_1 > 0));
      } catch(e) {}
    };
    fetchHubRankings();
  }, []);

  // 🔥 정확히 17문항, 17문항, 16문항으로 분할!
  const STAGE_DBS: Record<number, any[]> = {
    1: SURVIVAL_DB.slice(0, 17),  // 1단계 (1~17번)
    2: SURVIVAL_DB.slice(17, 34), // 2단계 (18~34번)
    3: SURVIVAL_DB.slice(34, 50)  // 3단계 (35~50번)
  };

  // 🔥 'NAMING' 뷰 상태 추가
  const [view, setView] = useState<'HUB' | 'COUNTDOWN' | 'PLAYING' | 'RESULT' | 'FINAL' | 'NAMING' | 'STUDIO'>('HUB');
  const [countdown, setCountdown] = useState(5); 
  
  // 🔥 스테이지 추적 상태 추가
  const [currentStage, setCurrentStage] = useState<1 | 2 | 3>(1);
  const [userQuizData, setUserQuizData] = useState<any>({}); // 유저의 전체 진행도 캐싱
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [myRank, setMyRank] = useState<number>(0);
  
  // 🔥 [신규 추가] 단순 랭킹 조회 모드인지 확인하는 상태
  const [isViewingRank, setIsViewingRank] = useState(false);

  // 저장된 진행 상황
  const [savedIndex, setSavedIndex] = useState(0);

  // 🔥 [신규 추가] 점수 덮어쓰기 없이 랭킹만 순수하게 가져와서 보여주는 함수
  const viewRanking = async (stageNum: 1 | 2 | 3) => {
    setCurrentStage(stageNum);
    setIsViewingRank(true); // 랭킹 조회 모드 ON
    
    // 1. 해당 스테이지의 TOP 10 랭킹만 긁어오기
    const q = query(collection(db, "users"), orderBy(`quizBestScore_${stageNum}`, "desc"), limit(10));
    const snap = await getDocs(q);
    const top10 = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter((d: any) => d[`quizBestScore_${stageNum}`] > 0);
    setLeaderboard(top10);

    // 2. 내 점수와 등수 계산하기
    const myBestScore = userQuizData[`quizBestScore_${stageNum}`] || 0;
    setCurrentScore(myBestScore); // 결과 화면에 내 최고 점수 띄우기

    if (myBestScore > 0) {
      const countQuery = query(collection(db, "users"), where(`quizBestScore_${stageNum}`, ">", myBestScore));
      const countSnap = await getCountFromServer(countQuery);
      setMyRank(countSnap.data().count + 1);
    } else {
      setMyRank(0);
    }

    setView('FINAL'); // 결과 화면으로 즉시 이동
  };

  const [savedScore, setSavedScore] = useState(0);

  // 🔥 [수정 후: 신규 추가] 전체 랭킹 팝업 상태 및 필터
  const [isRankingPopupOpen, setIsRankingPopupOpen] = useState(false);
  const [rankingFilter, setRankingFilter] = useState<'ALL' | 1 | 2 | 3>('ALL');

  // 🔥 [서버 연동] 실시간 랭킹 불러오기 로직
  const [popupRankings, setPopupRankings] = useState<any[]>([]);
  const [isPopupLoading, setIsPopupLoading] = useState(false);

  useEffect(() => {
    const fetchPopup = async () => {
      if (!isRankingPopupOpen) return;
      setIsPopupLoading(true);
      try {
        if (rankingFilter === 'ALL') {
          const q = query(collection(db, "users"), orderBy("quizBestScore_1", "desc"), limit(30));
          const snap = await getDocs(q);
          let list = snap.docs.map(d => ({id: d.id, ...d.data()}));
          list.forEach((d: any) => d.totalScore = (d.quizBestScore_1||0) + (d.quizBestScore_2||0) + (d.quizBestScore_3||0));
          list.sort((a: any, b: any) => b.totalScore - a.totalScore);
          setPopupRankings(list.filter((d: any) => d.totalScore > 0).slice(0, 20));
        } else {
          const q = query(collection(db, "users"), orderBy(`quizBestScore_${rankingFilter}`, "desc"), limit(20));
          const snap = await getDocs(q);
          setPopupRankings(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter((d: any) => d[`quizBestScore_${rankingFilter}`] > 0));
        }
      } catch (e) {}
      setIsPopupLoading(false);
    }
    fetchPopup();
  }, [isRankingPopupOpen, rankingFilter]);

  // 🔥 [수정 후: 신규 추가] 카카오톡 공유 함수
  useEffect(() => {
    const kakao = (window as any).Kakao;
    if (kakao && !kakao.isInitialized()) {
      // 대표님이 발급받으신 자바스크립트 키 적용
      kakao.init('cef1d01b84acf6b64cabac2fc6c3df18'); 
    }
  }, []);

  // 🔥 [최종 수정] 이미지 없는 텍스트형 카카오톡 공유 함수
  const shareToKakao = () => {
    const kakao = (window as any).Kakao;
    if (!kakao || !kakao.isInitialized()) {
      alert("카카오톡 공유 설정이 아직 완료되지 않았습니다.");
      return;
    }

    const levelNames = { 1: 'Lv.1 조리원 마스터', 2: 'Lv.2 야생 생존 전문가', 3: 'Lv.3 50일의 기적' };
    const levelTitle = levelNames[currentStage as 1|2|3] || '전체';
    const rankText = myRank > 0 ? `${myRank}위` : `상위 1%`; 

    // 텍스트형(text) 레이아웃을 사용하여 이미지 없이 깔끔하게 전송
    kakao.Share.sendDefault({
      objectType: 'text',
      text: `[봄이옴 실전 육아 모의고사 🏆]\n\n내가 "${levelTitle}"에서 ${currentScore.toLocaleString()}점으로 "${rankText}"를 했어!\n\n지금 바로 나의 육아 BQ를 확인해보세요! 👶`,
      link: {
        mobileWebUrl: 'https://bomiom.co.kr',
        webUrl: 'https://bomiom.co.kr',
      },
      buttons: [
        {
          title: '봄이옴 바로가기',
          link: {
            mobileWebUrl: 'https://bomiom.co.kr',
            webUrl: 'https://bomiom.co.kr',
          },
        },
      ],
    });
  };

  // 현재 퀴즈 상태
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeftMs, setTimeLeftMs] = useState(MAX_TIME_MS);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [reactionTimeMs, setReactionTimeMs] = useState(0);
  const [currentScore, setCurrentScore] = useState(0);

  // 현재 스테이지에 맞는 문제 배열 가져오기
  const activeDB = STAGE_DBS[currentStage];
  const currentQuiz = activeDB[currentIndex];
  const isLastQuestion = currentIndex === activeDB.length - 1;

  // --- 💾 진행 상황 관리 ---
  useEffect(() => {
    if (!user?.id) return;
    const loadUserData = async () => {
      const userSnap = await getDoc(doc(db, 'users', user.id));
      if (userSnap.exists()) {
        const data = userSnap.data();
        setUserQuizData(data); // HUB 화면 자물쇠 판별용으로 전체 캐싱
        if (data[`quizIndex_${currentStage}`]) setSavedIndex(data[`quizIndex_${currentStage}`]);
        if (data[`quizScore_${currentStage}`]) setSavedScore(data[`quizScore_${currentStage}`]);
      }
    };
    loadUserData();
  }, [user?.id, currentStage]);

  const saveProgress = async (newIdx: number, newScore: number) => {
    setSavedIndex(newIdx);
    setSavedScore(newScore);
    if (!user?.id) return;
    await setDoc(doc(db, "users", user.id), {
      [`quizIndex_${currentStage}`]: newIdx,
      [`quizScore_${currentStage}`]: newScore,
      quizLastUpdated: new Date()
    }, { merge: true });
  };

  const clearProgress = async () => {
    setSavedIndex(0);
    setSavedScore(0);
    if (!user?.id) return;
    await setDoc(doc(db, "users", user.id), { [`quizIndex_${currentStage}`]: 0, [`quizScore_${currentStage}`]: 0 }, { merge: true });
  };

  const startGame = (stageNum: 1 | 2 | 3, resume: boolean) => {
    setCurrentStage(stageNum);
    // 방금 선택한 스테이지의 최신 저장값 불러오기
    const idx = userQuizData[`quizIndex_${stageNum}`] || 0;
    const score = userQuizData[`quizScore_${stageNum}`] || 0;

    if (resume) {
      setCurrentIndex(idx);
      setCurrentScore(score);
    } else {
      clearProgress();
      setCurrentIndex(0);
      setCurrentScore(0);
    }
    setSelectedOption(null);
    setIsCorrect(null);
    setTimeLeftMs(MAX_TIME_MS);
    
    setCountdown(5);
    setView('COUNTDOWN');
  };

  // 카운트다운 타이머 로직
  useEffect(() => {
    let timer: any;
    if (view === 'COUNTDOWN' && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (view === 'COUNTDOWN' && countdown === 0) {
      setView('PLAYING'); // 0초가 되면 게임 시작
    }
    return () => clearInterval(timer);
  }, [view, countdown]);

  // --- ⏱️ 밀리초(ms) 타임어택 엔진 ---
  useEffect(() => {
    let interval: any;
    if (view === 'PLAYING' && selectedOption === null) {
      interval = setInterval(() => {
        setTimeLeftMs((prev) => {
          if (prev <= 30) {
            clearInterval(interval);
            handleAnswer(-1); // 시간 초과
            return 0;
          }
          return prev - 30; // 30ms 마다 갱신하여 부드럽고 긴장감 있게 렌더링
        });
      }, 30);
    }
    return () => clearInterval(interval);
  }, [view, selectedOption]);

  // --- 🎯 정답 제출 ---
  const handleAnswer = (index: number) => {
    setSelectedOption(index);
    const correct = index === currentQuiz?.correctIdx;
    setIsCorrect(correct);
    
    const usedTime = MAX_TIME_MS - timeLeftMs;
    setReactionTimeMs(usedTime);

    if (correct) {
      // 밀리초 기반 정밀 랭킹 점수: 기본 1000점 + 남은 시간(초) * 100점
      const timeBonus = (timeLeftMs / 1000) * 100;
      setCurrentScore(prev => Math.floor(prev + 1000 + timeBonus));
    }

    setTimeout(() => setView('RESULT'), 1500); // 타격감 후 1.5초 대기
  };

  const fetchRankings = async (finalScore: number) => {
    if (!user?.id) return;
    
    const userRef = doc(db, "users", user.id);
    const userSnap = await getDoc(userRef);
    
    const oldBestScore = userSnap.exists() ? (userSnap.data()[`quizBestScore_${currentStage}`] || 0) : 0;
    const newBestScore = Math.max(oldBestScore, finalScore);

    await setDoc(userRef, {
      [`quizScore_${currentStage}`]: finalScore,      
      [`quizBestScore_${currentStage}`]: newBestScore, 
      [`quizIndex_${currentStage}`]: activeDB.length,
      quizNickname: user.nickname || '익명',
      quizLastUpdated: new Date()
    }, { merge: true });

    // 🔥 정렬 기준을 현재 푸는 스테이지의 최고 점수로 변경!
    const q = query(collection(db, "users"), orderBy(`quizBestScore_${currentStage}`, "desc"), limit(10));
    const snap = await getDocs(q);
    const top10 = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter((d: any) => d[`quizBestScore_${currentStage}`] > 0);
    setLeaderboard(top10);

    const countQuery = query(collection(db, "users"), where(`quizBestScore_${currentStage}`, ">", newBestScore));
    const countSnap = await getCountFromServer(countQuery);
    setMyRank(countSnap.data().count + 1);
  };

  const nextQuestion = async () => {
    if (isLastQuestion) {
      clearProgress();
      await fetchRankings(currentScore); 
      setIsViewingRank(false); // 🔥 진짜 문제를 푼 것이므로 상태 OFF
      setView('FINAL');
    } else {
      const nextIdx = currentIndex + 1;
      saveProgress(nextIdx, currentScore);
      setCurrentIndex(nextIdx);
      setSelectedOption(null);
      setIsCorrect(null);
      setTimeLeftMs(MAX_TIME_MS);
      setView('PLAYING');
    }
  };

  // 타이머 텍스트 포맷 (예: 14.943)
  const timerText = Math.max(0, timeLeftMs / 1000).toFixed(2);
  const timerPercentage = Math.max(0, (timeLeftMs / MAX_TIME_MS) * 100);

  // ==========================================
  // 📱 VIEW: 카운트다운 및 학습 안내
  // ==========================================
  if (view === 'COUNTDOWN') {
    return (
      <div className="min-h-screen bg-indigo-600 text-white flex flex-col items-center justify-center p-6 text-center font-sans pb-24 relative overflow-hidden">
        <motion.div 
          initial={{ opacity: 0, scale: 0.5 }} 
          animate={{ opacity: 1, scale: 1 }} 
          key={countdown}
          className="text-[15rem] font-black leading-none mb-8 text-white/10 absolute z-0"
        >
          {countdown}
        </motion.div>
        
        <div className="relative z-10 w-full max-w-sm">
          <Baby size={64} className="mx-auto mb-6 text-yellow-300 animate-bounce" />
          <h2 className="text-2xl font-black mb-4 tracking-tight">잠시 후 테스트가 시작됩니다!</h2>
          <div className="bg-white/10 p-6 rounded-3xl border border-white/20 backdrop-blur-md shadow-xl text-left">
            <p className="text-sm font-bold leading-relaxed break-keep text-indigo-50">
              출산 이후 <span className="text-yellow-300 text-base font-black">Day 1부터 Day 50까지</span><br />
              우리 부부가 꼭 알아야 하고 앞으로 경험할<br />
              당황스러운 상황들을 함께 학습하고<br />
              올바른 대처 방법을 익혀보겠습니다!
            </p>
            <div className="mt-4 pt-4 border-t border-white/20">
              <p className="text-[11px] text-indigo-200 font-medium">💡 15초 안에 올바른 대처를 고를수록 높은 점수를 받습니다.</p>
              <p className="text-[9px] text-indigo-300/60 font-normal leading-tight">
                ※ 본 서비스의 내용은 일반적인 의학/육아 지식이며 전문적인 의학적 진단을 대신할 수 없습니다. 
                아기의 개별 상태에 따라 전문의와 상담하시기 바랍니다.
              </p>
            </div>
          </div>
          <p className="mt-8 text-white font-black text-xl animate-pulse">{countdown}초 전...</p>
        </div>
      </div>
    );
  }
  
  // ==========================================
  // 📱 VIEW 1: 봄이 라운지 (Apps in Bomiom)
  // ==========================================
  if (view === 'HUB') {
    const STAGE_UI = [
      { id: 1, title: 'Lv.1 조리원 마스터', desc: '퇴소 전 꼭 알아야 할 기초', icon: '🏥', gradient: 'from-blue-500 to-indigo-600', unlocked: true },
      { id: 2, title: 'Lv.2 야생 생존 전문가', desc: '집에 온 첫날 멘붕 방어', icon: '🏡', gradient: 'from-orange-400 to-rose-500', unlocked: (userQuizData.quizBestScore_1 || 0) > 0 },
      { id: 3, title: 'Lv.3 50일의 기적 달성', desc: '초보 엄빠 완벽 졸업 시험', icon: '🎓', gradient: 'from-emerald-400 to-teal-500', unlocked: (userQuizData.quizBestScore_2 || 0) > 0 },
    ];

    // 🌟 1) 서브 화면: 모의고사 레벨 리스트 (배너 클릭 시 등장)
    if (showQuizList) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans pb-28">
          <header className="bg-white px-5 py-4 flex items-center shadow-sm shrink-0 border-b border-slate-100">
            <button onClick={() => setShowQuizList(false)} className="p-2 -ml-2 text-slate-500 active:scale-90"><ChevronLeft size={24} /></button>
            <h1 className="text-lg font-bold text-slate-800 ml-1">실전 육아 모의고사</h1>
          </header>
          <div className="flex-1 overflow-y-auto p-5 pb-4 space-y-4">
            <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl mb-4 shadow-sm">
              <span className="text-indigo-600 font-black text-xs block mb-1">🍼 초보 엄빠 생존 가이드</span>
              <p className="text-[13px] text-slate-700 leading-relaxed break-keep font-medium">
                조리원 퇴소부터 50일의 기적까지! 순서대로 스테이지를 클리어하며 실전 육아 지능(BQ)을 높여보세요.
              </p>
              {/* 🔥 명예의 전당 팝업 버튼 부활 */}
              <button onClick={() => setIsRankingPopupOpen(true)} className="w-full mt-3 bg-white border border-slate-200 text-slate-700 py-2.5 rounded-xl font-black text-xs flex justify-center items-center gap-2 shadow-sm active:scale-95 transition-transform">
                <Trophy size={14} className="text-yellow-500" /> 명예의 전당 (전체 랭킹) 보기
              </button>
            </div>
            {STAGE_UI.map((stage: any) => {
              const sIdx = userQuizData[`quizIndex_${stage.id}`] || 0;
              const isCleared = (userQuizData[`quizBestScore_${stage.id}`] || 0) > 0;
              const totalQ = STAGE_DBS[stage.id].length;
              return (
                <div key={stage.id} className={`relative rounded-[1.5rem] p-5 text-white overflow-hidden transition-all ${stage.unlocked ? `bg-gradient-to-r ${stage.gradient} shadow-md` : 'bg-slate-200 opacity-80'}`}>
                  <div className="relative z-10 flex items-center gap-3 mb-4">
                    <div className={`w-12 h-12 flex items-center justify-center text-2xl rounded-2xl shadow-inner shrink-0 ${stage.unlocked ? 'bg-white/20' : 'bg-white/50'}`}>
                      {stage.unlocked ? stage.icon : '🔒'}
                    </div>
                    <div>
                      <h4 className={`font-black text-[16px] tracking-tight ${stage.unlocked ? 'text-white' : 'text-slate-500'}`}>{stage.title}</h4>
                      <p className={`text-[11px] font-medium mt-0.5 ${stage.unlocked ? 'text-white/80' : 'text-slate-400'}`}>{stage.desc}</p>
                    </div>
                  </div>
                  {stage.unlocked && isCleared && (
                    <div className="relative z-10 bg-black/15 rounded-xl px-4 py-3 mb-4 flex justify-between items-center border border-white/10 shadow-inner">
                      <span className="text-[12px] font-bold text-white/80 tracking-wide">🏆 최고 점수</span>
                      <span className="font-mono font-black text-lg leading-none text-white">{userQuizData[`quizBestScore_${stage.id}`]?.toLocaleString()}<span className="text-xs font-normal ml-1">점</span></span>
                    </div>
                  )}
                  <div className="relative z-10 flex justify-between items-center gap-2">
                    {stage.unlocked ? (
                      isCleared ? (
                        <>
                          <button onClick={() => viewRanking(stage.id as 1|2|3)} className="flex-1 text-[13px] bg-black/20 text-white py-3.5 rounded-xl font-bold shadow-sm active:scale-95 border border-white/10">🏆 랭킹 보기</button>
                          <button onClick={() => startGame(stage.id as 1|2|3, false)} className="flex-1 text-[13px] bg-white text-slate-800 py-3.5 rounded-xl font-black shadow-sm active:scale-95">다시 도전</button>
                        </>
                      ) : sIdx > 0 ? (
                        <>
                          <button onClick={() => startGame(stage.id as 1|2|3, false)} className="flex-[0.8] text-[13px] bg-black/20 text-white py-3.5 rounded-xl font-bold shadow-sm border border-white/10 active:scale-95">처음부터</button>
                          <button onClick={() => startGame(stage.id as 1|2|3, true)} className="flex-[1.2] text-[13px] bg-white text-slate-800 py-3.5 rounded-xl font-black shadow-sm flex items-center justify-center gap-1.5 active:scale-95"><Play size={14} fill="currentColor"/> 이어하기 ({sIdx}/{totalQ})</button>
                        </>
                      ) : (
                        <button onClick={() => startGame(stage.id as 1|2|3, false)} className="w-full text-[14px] bg-white text-slate-900 py-3.5 rounded-xl font-black shadow-md flex items-center justify-center gap-1.5 active:scale-95"><Play size={16} fill="currentColor"/> 시작하기</button>
                      )
                    ) : (
                      <div className="text-[12px] font-bold text-slate-500 bg-white/50 w-full py-3.5 rounded-xl text-center shadow-inner border border-white/20">🔒 이전 단계를 클리어해야 열립니다</div>
                    )}
                  </div>
                </div>
              );
            })}
            
            {/* ✅ [추가됨] 육아 모의고사 로비 화면 하단에도 애드센스 배너 추가 */}
            <div className="mt-4">
              <KakaoAdFit unit="DAN-Nx6FiDTR0QT08Er7" />
              <GoogleAdBanner />
            </div>
            
          </div>

          {/* 🔥 팝업 코드를 이 모의고사 화면 안에도 추가해 줍니다! */}
          <AnimatePresence>
            {isRankingPopupOpen && (
              <>
                <motion.div 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  onClick={() => setIsRankingPopupOpen(false)}
                  className="fixed inset-0 bg-black/60 z-[99998] backdrop-blur-sm"
                />
                <motion.div 
                  initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                  className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-slate-900 rounded-t-[2rem] z-[99999] p-6 flex flex-col h-[80vh] border-t border-slate-700 shadow-2xl"
                >
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-black text-white flex items-center gap-2"><Trophy className="text-yellow-400"/> 명예의 전당</h2>
                    <button onClick={() => setIsRankingPopupOpen(false)} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white"><X size={20}/></button>
                  </div>
                  
                  <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
                    {['ALL', 1, 2, 3].map((f) => (
                      <button 
                        key={f} onClick={() => setRankingFilter(f as any)}
                        className={`px-4 py-2 rounded-xl text-sm font-black whitespace-nowrap transition-colors ${rankingFilter === f ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400'}`}
                      >
                        {f === 'ALL' ? '전체 합산' : `Lv.${f} 랭킹`}
                      </button>
                    ))}
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                    {isPopupLoading ? (
                      <div className="text-center py-10 text-slate-500 text-sm">서버에서 랭킹을 불러오는 중입니다...</div>
                    ) : popupRankings.length > 0 ? (
                      popupRankings.map((u, i) => (
                        <div key={i} className={`flex justify-between items-center p-3.5 rounded-xl border ${u.id === user?.id ? 'bg-indigo-600/20 border-indigo-500/50' : 'bg-slate-800/50 border-white/5'}`}>
                          <div className="flex items-center gap-3">
                            <span className={`w-6 text-center font-black ${i < 3 ? 'text-yellow-400 text-lg' : 'text-slate-500 text-sm'}`}>{i + 1}</span>
                            <span className={`font-bold ${u.id === user?.id ? 'text-indigo-300' : 'text-slate-200'} text-sm`}>
                              {u.quizNickname || '익명'} {u.id === user?.id && '(나)'}
                            </span>
                          </div>
                          <span className="font-mono font-bold text-slate-400 text-xs">
                            {(rankingFilter === 'ALL' ? u.totalScore : u[`quizBestScore_${rankingFilter}`])?.toLocaleString()}점
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-10 text-slate-500 text-sm">아직 등록된 랭킹이 없습니다. 1등에 도전하세요!</div>
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

        </div>
      );
    }

    // 🌟 2) 메인 라운지 화면 (배너 압축 및 랭킹 추가)
    return (
      // 🔥 1. 최상단 박스의 pt-8, px-5를 제거하고 flex 중앙 정렬을 추가합니다.
      <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-28 font-sans flex flex-col items-center">
        
        {/* 🔥 이제 헤더가 화면 좌우 끝에 여백 없이 완벽하게 찰싹 붙습니다! */}
        <header className="w-full flex justify-center bg-white sticky top-0 z-40 border-b border-gray-100 shadow-sm animate-fade-in">
          <div className="w-full max-w-md px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="p-1 -ml-1 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                <ArrowLeft size={24} />
              </button>
              <h2 className="font-bold text-lg leading-tight text-gray-900 flex items-center gap-1.5">
                <Flower2 size={20} className="text-rose-500" /> 비밀정원
              </h2>
            </div>
            <div className="w-6"></div> {/* 가운데 정렬용 빈 공간 */}
          </div>
        </header>

        {/* 🔥 2. 타이틀 영역: mx-auto를 추가해 화면 중앙에 딱 맞게 정렬 */}
        <div className="w-full max-w-md mx-auto px-5 pt-6 mb-6">
          <h1 className="text-2xl font-black tracking-tight text-slate-800">봄이옴 비밀정원</h1>
          <p className="text-slate-500 font-bold mt-1 text-xs">놀다 보면 임신준비가 즐거워지는 에듀테인먼트 🎪</p>
        </div>

        {/* 🔥 3. 배너 영역: mx-auto를 추가하고 간격을 space-y-3으로 압축 */}
        <div className="w-full max-w-md mx-auto px-5 space-y-3">          
          
          {/* 📝 배너 1: 실전 육아 모의고사 (레드/오렌지) */}
          <button 
            onClick={() => setShowQuizList(true)}
            className="w-full text-left bg-gradient-to-br from-[#FF6B00] to-[#E63900] p-5 rounded-[1.5rem] shadow-xl shadow-orange-500/30 relative overflow-hidden active:scale-[0.98] transition-transform"
          >
            <div className="absolute right-0 bottom-0 text-6xl opacity-20 transform translate-x-3 translate-y-3">📝</div>
            <span className="bg-black/20 text-white border border-white/20 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest mb-1.5 inline-block backdrop-blur-sm">BOMIOM TEST</span>
            <h2 className="text-xl font-black text-white mb-1 leading-snug drop-shadow-md">실전 육아 모의고사</h2>
            <p className="text-white/90 text-[13px] break-keep font-medium leading-snug">내 육아 지식은 몇 점? 레벨별로 도전하고<br/>전국 랭킹 1위를 차지해보세요!</p>
          </button>

          {/* 🌸 배너 2: 찰떡 이름 연구소 (블루/네이비) */}
          <div 
            onClick={() => setView('NAMING')}
            className="bg-gradient-to-br from-[#1D4ED8] to-[#4338CA] rounded-[1.5rem] p-5 shadow-xl shadow-blue-600/30 cursor-pointer hover:scale-[1.02] active:scale-95 transition-all relative overflow-hidden"
          >
            <div className="relative z-10 flex justify-between items-center">
              <div>
                <div className="bg-black/20 w-fit px-2 py-0.5 rounded text-[9px] font-black text-white mb-1.5 uppercase tracking-widest backdrop-blur-sm border border-white/20">Premium Naming</div>
                <h3 className="text-white font-black text-lg mb-0.5 flex items-center gap-1.5 drop-shadow-md">🌸 봄이옴 작명 연구소</h3>
                <p className="text-white/80 text-[12px] font-medium tracking-tight whitespace-nowrap">정통 성명학 기반 우리 아기 인생 이름 찾기</p>
              </div>
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-md border border-white/20 shrink-0 shadow-inner">
                <span className="text-2xl drop-shadow-md">👶</span>
              </div>
            </div>
            <div className="absolute -right-4 -top-4 w-28 h-28 bg-white/10 rounded-full blur-3xl"></div>
          </div>

          {/* 📸 배너 3: AI 사진관 (핑크/퍼플 테마 - Tailwind로 깔끔하게 전환) */}
          <div 
            onClick={() => setView('STUDIO')}
            className="bg-gradient-to-br from-[#E11D48] to-[#9333EA] rounded-[1.5rem] p-5 shadow-xl shadow-rose-500/30 cursor-pointer hover:scale-[1.02] active:scale-95 transition-all relative overflow-hidden"
          >
            <div className="relative z-10">
              <div className="bg-black/20 w-fit px-2 py-0.5 rounded text-[9px] font-black text-white mb-1.5 uppercase tracking-widest backdrop-blur-sm border border-white/20">AI STUDIO</div>
              <h3 className="text-white font-black text-lg mb-0.5 drop-shadow-md">📸 프리미엄 AI 사진관</h3>
              <p className="text-white/90 text-[13px] font-medium tracking-tight break-keep leading-snug">엄마 아빠 닮은꼴 예측부터 입체 초음파 초고화질 실사화까지!</p>
            </div>
            <div className="absolute right-0 bottom-0 text-6xl opacity-15 transform translate-x-2 translate-y-4">✨</div>
          </div>

          {/* 📖 배너 4: 맞춤형 태담 동화 (오렌지 톤) */}
          <div 
            onClick={() => setView('EDEN_STORY')}
            className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-[1.5rem] p-5 shadow-xl shadow-orange-500/30 cursor-pointer hover:scale-[1.01] active:scale-95 transition-all relative overflow-hidden"
          >
            <div className="relative z-10">
              <div className="bg-black/20 w-fit px-2 py-0.5 rounded text-[9px] font-black text-white mb-1.5 uppercase tracking-widest backdrop-blur-sm border border-white/20">STORY STUDIO</div>
              <h3 className="text-white font-black text-lg mb-0.5 flex items-center gap-2 drop-shadow-md">📖 맞춤형 태담 동화</h3>
              <p className="text-white/90 text-[13px] font-medium tracking-tight break-keep leading-snug">엄마 아빠의 진심을 담아, 세상에 하나뿐인<br/>우리 아이의 동화책을 만들어주세요.</p>
            </div>
            <div className="absolute right-0 bottom-0 text-6xl opacity-20 transform translate-x-3 translate-y-3">🌙</div>
          </div>

          {/* 🎵 배너 5: 우리 아이 AI 동요 (스카이블루 톤) */}
          <div 
            onClick={() => setView('EDEN_SONG')}
            className="bg-gradient-to-br from-sky-400 to-indigo-500 rounded-[1.5rem] p-5 shadow-xl shadow-indigo-500/30 cursor-pointer hover:scale-[1.01] active:scale-95 transition-all relative overflow-hidden"
          >
            <div className="relative z-10">
              <div className="bg-black/20 w-fit px-2 py-0.5 rounded text-[9px] font-black text-white mb-1.5 uppercase tracking-widest backdrop-blur-sm border border-white/20">MUSIC STUDIO</div>
              <h3 className="text-white font-black text-lg mb-0.5 flex items-center gap-2 drop-shadow-md">🎵 우리 아이 AI 동요</h3>
              <p className="text-white/90 text-[13px] font-medium tracking-tight break-keep leading-snug">이번 주 멜로디에 아기 태명과 사랑을 담아<br/>감동적인 노래를 선물하세요.</p>
            </div>
            <div className="absolute right-0 bottom-0 text-6xl opacity-20 transform translate-x-3 translate-y-3">🎧</div>
          </div>

          {/* 기타 서비스 배너 (준비중 상태로 변경) */}
          <div className="grid grid-cols-1 gap-2 pt-2">
            <HubBanner isComingSoon={true} icon={<Music className="text-slate-400" size={18}/>} title="꿀잠 백색소음 DJ" desc="준비 중입니다. 곧 찾아뵐게요!" />
            <HubBanner isComingSoon={true} icon={<HeartPulse className="text-slate-400" size={18}/>} title="아빠의 임신 체험기" desc="준비 중입니다. 곧 찾아뵐게요!" />
          </div>
        </div>

        {/* 🔥 전체 랭킹 바텀시트 팝업 */}
        <AnimatePresence>
          {isRankingPopupOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setIsRankingPopupOpen(false)}
                className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-slate-900 rounded-t-[2rem] z-50 p-6 flex flex-col h-[80vh] border-t border-slate-700 shadow-2xl"
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-black text-white flex items-center gap-2"><Trophy className="text-yellow-400"/> 명예의 전당</h2>
                  <button onClick={() => setIsRankingPopupOpen(false)} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white"><X size={20}/></button>
                </div>
                
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
                  {['ALL', 1, 2, 3].map((f) => (
                    <button 
                      key={f} onClick={() => setRankingFilter(f as any)}
                      className={`px-4 py-2 rounded-xl text-sm font-black whitespace-nowrap transition-colors ${rankingFilter === f ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400'}`}
                    >
                      {f === 'ALL' ? '전체 합산' : `Lv.${f} 랭킹`}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                  <div className="text-center py-10 text-slate-500 text-sm font-medium">
                    <p className="mb-2">🏆</p>
                    <p>{rankingFilter === 'ALL' ? '모든 레벨을 클리어한 고수들의 합산 랭킹입니다.' : `Level ${rankingFilter} 랭킹 데이터를 불러옵니다.`}</p>
                    <p className="text-xs text-slate-600 mt-4">(서버 연동 시 실제 데이터가 표시됩니다)</p>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

      </div>
    );
  }

  // ==========================================
  // 📱 VIEW 2: 퀴즈 플레이 화면 (밀리초 타임어택)
  // ==========================================
  if (view === 'PLAYING') {
    const isUrgent = timeLeftMs < 5000;

    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col pb-24 font-sans">
        
        {/* 헤더 & 종료 버튼 */}
        <header className="px-6 pt-6 pb-4 bg-white sticky top-0 z-10 flex items-center justify-between border-b border-slate-100">
          <button onClick={() => { saveProgress(currentIndex, currentScore); setView('HUB'); }} className="flex items-center gap-1 text-slate-400 font-bold text-xs bg-slate-100 px-3 py-1.5 rounded-full hover:bg-slate-200">
            <X size={14}/> 저장 후 종료
          </button>
          <div className="font-black text-indigo-600 text-sm tracking-widest">
            {/* 🔥 하드코딩된 50을 지우고 동적 변수로 교체! */}
            Q.{currentIndex + 1} <span className="text-slate-300">/ {activeDB.length}</span>
          </div>
          <div className="font-black text-slate-400 text-sm flex items-center gap-1">
            <Trophy size={14} className="text-yellow-500"/> {currentScore.toLocaleString()}
          </div>
        </header>

        <div className="flex-1 flex flex-col max-w-md mx-auto w-full px-6 pt-8">
          
          {/* 🔥 쫄깃한 타이머 영역 (숫자 + 게이지바) */}
          <div className={`mb-8 p-4 rounded-2xl border-2 transition-colors duration-300 ${isUrgent ? 'border-rose-400 bg-rose-50' : 'border-slate-200 bg-white shadow-sm'}`}>
            <div className="flex justify-between items-end mb-2">
              <span className={`text-xs font-black uppercase tracking-widest ${isUrgent ? 'text-rose-500' : 'text-slate-400'}`}>Remaining Time</span>
              <div className="flex items-center gap-1">
                <Timer className={isUrgent ? 'text-rose-500 animate-pulse' : 'text-slate-700'} size={24}/> 
                {/* 밀리초 텍스트 (고정폭 폰트 적용) */}
                <span className={`text-3xl font-black font-mono tracking-tighter ${isUrgent ? 'text-rose-600' : 'text-slate-800'}`}>
                  {timerText}
                </span>
              </div>
            </div>
            {/* 시각적 타이머 게이지 바 */}
            <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-75 ease-linear ${isUrgent ? 'bg-rose-500' : 'bg-indigo-500'}`}
                style={{ width: `${timerPercentage}%` }}
              />
            </div>
          </div>

          <div className="bg-indigo-50 px-4 py-1.5 rounded-full w-fit mb-4 border border-indigo-100">
            <span className="text-indigo-700 font-black text-xs tracking-tight">{currentQuiz?.title}</span>
          </div>
          <h2 className="text-2xl font-black leading-snug tracking-tight mb-8 text-slate-800 break-keep">
            {currentQuiz?.question}
          </h2>

          <div className="grid grid-cols-1 gap-3 mt-auto mb-4">
            {currentQuiz?.options.map((opt, idx) => {
              let btnClass = "bg-white border-2 border-slate-200 text-slate-600 hover:border-indigo-500 shadow-sm";
              if (selectedOption !== null) {
                if (idx === currentQuiz.correctIdx) btnClass = "bg-emerald-500 border-emerald-600 text-white shadow-lg z-10"; 
                else if (idx === selectedOption) btnClass = "bg-rose-500 border-rose-600 text-white"; 
                else btnClass = "bg-slate-100 border-slate-200 text-slate-400 opacity-40";
              }

              return (
                <button
                  key={idx}
                  disabled={selectedOption !== null}
                  onClick={() => handleAnswer(idx)}
                  className={`p-4 md:p-5 rounded-2xl font-bold text-left transition-all active:scale-95 ${btnClass} text-sm md:text-base`}
                >
                  {opt}
                </button>
              );
            })}
          </div>

          {/* ✅ [추가됨] 문제 선택지 하단 애드센스 배너 출력 */}
          <KakaoAdFit unit="DAN-Nx6FiDTR0QT08Er7" />
          <GoogleAdBanner />

        </div>
      </div>
    );
  }

  // ==========================================
  // 📱 VIEW 3: 해설 및 랭킹 (RESULT)
  // ==========================================
  if (view === 'RESULT') {
    // 🔥 타임오버 판별 (선택지가 -1로 들어온 경우)
    const isTimeOver = selectedOption === -1;
    // 0~15000ms 반응속도를 백분율 랭킹으로 역산 (빨리 풀수록 1%에 수렴)
    const rawPercentile = isCorrect ? Math.max(0.1, (reactionTimeMs / 15000) * 80) : 99.9;
    const percentile = rawPercentile.toFixed(1); 

    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col pb-24 font-sans">
        <header className="px-6 py-4 flex justify-between items-center border-b border-white/10 sticky top-0 bg-slate-900/90 backdrop-blur-md z-10">
          <button onClick={() => { saveProgress(currentIndex, currentScore); setView('HUB'); }} className="text-white/50 hover:text-white font-bold text-xs bg-white/10 px-3 py-1.5 rounded-full">
            <X size={14} className="inline mr-1"/>닫기
          </button>
        </header>

        <div className="max-w-md mx-auto w-full p-6 flex-1 flex flex-col">
          {/* 🔥 타임오버일 땐 회색 배경, 오답일 땐 빨간 배경 */}
          <div className={`p-6 rounded-[2rem] shadow-2xl mb-6 border ${isCorrect ? 'bg-emerald-500 border-emerald-400' : isTimeOver ? 'bg-slate-600 border-slate-500' : 'bg-rose-500 border-rose-400'}`}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className="bg-white/30 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-white">
                  판단 결과
                </span>
                {/* 🔥 타임오버 문구 추가 */}
                <h2 className="text-2xl font-black mt-3">
                  {isCorrect ? '위기 탈출 성공!' : isTimeOver ? '⏳ 타임 오버!' : '아기가 계속 웁니다!'}
                </h2>
              </div>
              {isCorrect ? <CheckCircle size={40} className="text-white"/> : isTimeOver ? <Timer size={40} className="text-white"/> : <XCircle size={40} className="text-white"/>}
            </div>

            <div className="bg-black/20 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-white/70 font-bold mb-1 uppercase tracking-widest">상황 대처 랭킹</p>
                <p className="text-xl font-black flex items-center gap-1.5 font-mono">
                  <Medal className="text-yellow-300" size={18}/> 
                  {isCorrect ? `상위 ${percentile}%` : '순위권 밖'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-white/70 font-bold mb-1 uppercase tracking-widest">획득 점수</p>
                <p className="text-xl font-black font-mono">+{isCorrect ? Math.floor(1000 + (timeLeftMs / 1000) * 100) : 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 p-6 rounded-[2rem] border border-slate-700 mb-8 flex-1 shadow-lg">
            <h3 className="font-black text-lg text-emerald-400 mb-3 flex items-center gap-2">
              <CheckCircle size={18}/> 팩트 체크
            </h3>
            <p className="text-slate-300 leading-relaxed font-medium mb-6 text-sm break-keep">
              {currentQuiz?.explanation}
            </p>
            <div className="bg-indigo-900/40 p-4 rounded-xl border border-indigo-500/30">
              <span className="text-indigo-300 font-black text-xs block mb-1">💡 봄이옴 TIP</span>
              <p className="text-indigo-100 font-bold text-sm leading-relaxed break-keep">{currentQuiz?.tip}</p>
            </div>
          </div>

          {/* ✅ [수정됨] mb-4 추가로 배너와 버튼 사이 여백 확보 */}
          <button 
            onClick={nextQuestion}
            className="w-full bg-white text-slate-900 font-black py-4 rounded-2xl flex justify-center items-center gap-2 active:scale-95 transition-transform mt-auto mb-4"
          >
            {isLastQuestion ? '최종 결과표 확인' : '다음 상황 계속하기'} <ChevronRight size={20}/>
          </button>

          {/* ✅ [추가됨] 다음 문항 버튼 바로 아래 애드센스 배너 배치 */}
          <KakaoAdFit unit="DAN-Nx6FiDTR0QT08Er7" />
          <GoogleAdBanner />

        </div>
      </div>
    );
  }

  // ==========================================
  // 📱 VIEW 4: 최종 엔딩
  // ==========================================
  if (view === 'FINAL') {
    const isMyRankInTop10 = leaderboard.some(u => u.id === user?.id);

    return (
      <div className="min-h-screen bg-slate-950 text-white p-6 pb-28 flex flex-col items-center font-sans overflow-y-auto pt-10">
        <Trophy size={60} className="text-yellow-400 mb-4 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" />
        
        {/* 🔥 단순 조회 모드일 땐 '명예의 전당', 풀고 왔을 땐 '모의고사 완료!' */}
        <h1 className="text-2xl font-black mb-1">
          {isViewingRank ? `Lv.${currentStage} 명예의 전당` : '모의고사 완료!'}
        </h1>
        <p className="text-indigo-300 font-bold mb-6 text-sm">
          {isViewingRank ? '나의 최고 생존 점수' : '나의 최종 육아 생존 점수'}
        </p>
        
        <div className="text-center mb-8">
          <p className="text-5xl font-black text-emerald-400 font-mono mb-2">{currentScore.toLocaleString()}</p>
        </div>

        {/* 🏆 실시간 랭킹 보드 */}
        <div className="w-full max-w-md bg-slate-900 rounded-[2rem] p-6 border border-slate-800 shadow-2xl mb-8">
          <h2 className="text-base font-black mb-4 flex items-center justify-between px-1 text-white">
            <span className="flex items-center gap-2"><Medal className="text-yellow-500" size={18}/> 명예의 전당 TOP 10</span>
            <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-1 rounded">실시간 집계</span>
          </h2>
          
          <div className="space-y-2 mb-2">
            {leaderboard.length > 0 ? leaderboard.map((l_user, idx) => {
              const isMe = l_user.id === user?.id;
              return (
                <div key={idx} className={`flex justify-between items-center p-3.5 rounded-xl border ${isMe ? 'bg-indigo-600/20 border-indigo-500/50' : 'bg-slate-800/50 border-white/5'}`}>
                  <div className="flex items-center gap-3">
                    <span className={`w-6 text-center font-black ${idx < 3 ? 'text-yellow-400 text-lg' : 'text-slate-500 text-sm'}`}>{idx + 1}</span>
                    <span className={`font-bold ${isMe ? 'text-indigo-300' : 'text-slate-200'} text-sm`}>{l_user.quizNickname || '익명'} {isMe && '(나)'}</span>
                  </div>
                  {/* 🔥 l_user.quizScore 대신 l_user.quizBestScore를 출력합니다! */}
                  <span className="font-mono font-bold text-slate-400 text-xs">{l_user[`quizBestScore_${currentStage}`]?.toLocaleString() || 0}</span>
                </div>
              );
            }) : (
              <div className="text-center py-6 text-slate-500 text-xs">랭킹 데이터를 불러오는 중입니다...</div>
            )}
          </div>

          {/* 10등 밖일 때, 내 순위를 맨 아래에 추가 표시 */}
          {!isMyRankInTop10 && myRank > 0 && (
            <div className="pt-3 mt-1 border-t border-dashed border-slate-700">
              <div className="flex justify-between items-center p-3.5 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-600/20 border border-indigo-400/30">
                <div className="flex items-center gap-3">
                  <span className="w-6 text-center font-black text-white">{myRank}</span>
                  <span className="font-black text-white text-sm">{user?.nickname || '나'}</span>
                </div>
                <span className="font-mono font-black text-white text-xs">{currentScore.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 w-full max-w-md mt-auto">
          {/* 🔥 [수정 후] onBack() 제거: 앱이 튕기지 않고 봄이 라운지로 예쁘게 돌아감 */}
          <button onClick={() => setView('HUB')} className="flex-[1] bg-slate-800 text-white py-4 rounded-xl font-black flex justify-center items-center gap-2 border border-slate-700 active:scale-95 text-sm">
            라운지로
          </button>
          
          {/* 🔥 [수정 후] 카카오톡 전용 버튼 디자인 및 함수 연결 */}
          <button onClick={shareToKakao} className="flex-[2] bg-[#FAE100] text-[#371D1E] py-4 rounded-xl font-black flex justify-center items-center gap-2 active:scale-95 shadow-lg shadow-[#FAE100]/20 text-[15px]">
            <Share2 size={18} fill="currentColor" className="opacity-80"/> 카카오톡 랭킹 공유
          </button>
        </div>
      </div>
    );
  }

  // ==========================================
  // 📱 VIEW 5: 찰떡 이름 연구소 화면 렌더링
  // ==========================================
  if (view === 'NAMING') {
    return (
      <NamingPage 
        user={user} 
        onBack={() => setView('HUB')} 
        onUpdateUser={onUpdateUser} 
        addToast={addToast}
      />
    );
  }

  if (view === 'STUDIO') {
    return (
      <AIBabyStudio 
        user={user} 
        onBack={() => setView('HUB')} // 뒤로가기 시 다시 HUB로
        onUpdateUser={onUpdateUser} 
        addToast={addToast}
      />
    );
  }

  // 📖 태담동화 렌더링
  if (view === 'EDEN_STORY') {
    return <AIStoryStudio user={user} onBack={() => setView('HUB')} addToast={addToast} />;
  }

  // 🎵 AI 동요 렌더링
  if (view === 'EDEN_SONG') {
    return <AISongStudio user={user} onBack={() => setView('HUB')} addToast={addToast} />;
  }

  return null;
};

// 기존 미니 앱 배너 컴포넌트를 이 코드로 완전히 갈아끼우세요!
const HubBanner = ({ icon, title, desc, isComingSoon }: any) => (
  <div className={`bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-3 transition-all ${isComingSoon ? 'opacity-60 grayscale-[0.3]' : 'hover:shadow-md'}`}>
    {/* 아이콘 박스 크기 축소: w-14 h-14 -> w-11 h-11 */}
    <div className="w-11 h-11 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-50 shrink-0 shadow-sm">
      {/* 아이콘 자체 크기도 살짝 조정될 수 있도록 처리 */}
      {icon}
    </div>
    <div className="flex-1">
      <div className="flex items-center gap-2">
        {/* 제목 폰트 축소: 15px -> 14px(sm) */}
        <h3 className="font-black text-sm text-slate-800">{title}</h3>
        {isComingSoon && <span className="bg-slate-100 text-slate-400 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">준비중</span>}
      </div>
      {/* 설명 폰트 축소: text-xs -> text-[11px] */}
      <p className="text-[11px] text-slate-500 font-medium tracking-tight break-keep leading-tight">{desc}</p>
    </div>
  </div>
);

export default GardenPage;