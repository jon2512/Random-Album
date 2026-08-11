FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src

ENV PORT=8787
ENV SPIN_DATA_DIR=/data
ENV SPIN_MAX_PROFILES=8

VOLUME ["/data"]
EXPOSE 8787

CMD ["npm", "start"]
