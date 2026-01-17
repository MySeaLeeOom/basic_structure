# Step 1: The Build Environment
# We use 'alpine' to keep the image size small—the "minimum viable environment."
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Step 2: The Execution Environment
# We start a fresh stage to discard the heavy 'node_modules' used during building.
FROM node:20-alpine AS runner

WORKDIR /app

# Set the environment to production
ENV NODE_ENV=production
ENV NUXT_HOST=0.0.0.0
ENV NUXT_PORT=3000

# Copy only the necessary outputs from the builder stage
# For Nuxt 3, the output is in the .output directory
COPY --from=builder /app/.output ./.output

# Expose the port the app runs on
EXPOSE 3000

# The command to start the server
CMD ["node", ".output/server/index.mjs"]