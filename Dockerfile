FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install

COPY wrangler.toml ./
COPY public ./public
COPY functions ./functions

EXPOSE 8788

CMD ["npm", "run", "dev", "--", "--ip", "0.0.0.0", "--port", "8788"]
