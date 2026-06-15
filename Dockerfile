# 1. 빌드 및 실행 환경 세팅 (Node 20버전)
FROM node:20-alpine
WORKDIR /app

# 2. 패키지 설치
COPY package*.json ./
RUN npm install

# 3. 소스코드 전체 복사 (server.cjs 포함!)
COPY . .

# 4. 프론트엔드 요리(Build) - 구글 클라우드 슈퍼컴퓨터가 알아서 척척!
# 💡 메모리 부족으로 뻗지 않도록 넉넉하게 메모리 4기가 할당
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

# 5. 서버 포트 및 환경변수 설정
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# 🚨 6. 깡통 서버(serve)가 아닌, 진짜 우리의 백엔드(server.cjs)를 실행합니다!
CMD ["node", "server.cjs"]