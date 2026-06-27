FROM mcr.microsoft.com/playwright:v1.49.1-noble

WORKDIR /repo

COPY package.json package-lock.json ./
COPY apps/worker/package.json apps/worker/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/crypto/package.json packages/crypto/package.json

RUN npm install --omit=optional

COPY packages/db packages/db
COPY packages/crypto packages/crypto
COPY apps/worker apps/worker

WORKDIR /repo/apps/worker

CMD ["sh", "-c", "cd /repo/packages/db && npx tsx src/migrate.ts && cd /repo/apps/worker && npx tsx src/index.ts"]
