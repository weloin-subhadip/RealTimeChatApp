# --- build stage: compile TypeScript to dist/ ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- runtime stage: prod deps + compiled output only ---
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
# Uploads dir (also backed by a named volume at runtime).
RUN mkdir -p uploads
EXPOSE 4000
CMD ["node", "dist/server.js"]
