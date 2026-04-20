FROM node:22-alpine

WORKDIR /app

# Install dependencies first exactly as in package.json
COPY package.json package-lock.json* ./
RUN npm ci

# Copy full application code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build frontend and backend processes
RUN npm run build || true

EXPOSE 3000
EXPOSE 5173

# Start the application
CMD ["npm", "run", "start"]
