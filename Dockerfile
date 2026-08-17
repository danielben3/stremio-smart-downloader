FROM node:20-alpine

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm install

COPY src ./src
COPY public ./public

RUN npm run build

EXPOSE 7000

ENV PORT=7000
ENV NODE_ENV=production

CMD ["npm", "start"]
