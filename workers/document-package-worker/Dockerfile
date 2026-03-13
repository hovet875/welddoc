FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY workers/document-package-worker/package.json workers/document-package-worker/package-lock.json ./workers/document-package-worker/
RUN npm --prefix workers/document-package-worker ci

COPY . .

RUN npm run build

FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY --from=build /app/dist ./dist
COPY --from=build /app/workers/document-package-worker ./workers/document-package-worker

RUN npx --prefix workers/document-package-worker playwright install --with-deps chromium

CMD ["node", "workers/document-package-worker/index.mjs"]
