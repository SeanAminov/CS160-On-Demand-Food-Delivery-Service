# The OFS web server. docker-compose.yml runs it next to a MySQL database,
# so most people should run "docker compose up --build" instead of using this alone.
FROM node:20-bookworm-slim

WORKDIR /app

# The packages go in first, so Docker can reuse this step when only the code changes
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3000
CMD ["node", "server.js"]
