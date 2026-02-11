import fs from 'fs';

export function getJwtSecret(): string {
  // This path must match the 'JWT_SECRET_FILE' env we put in docker-compose
  const secretPath = process.env.JWT_SECRET_FILE || '/run/secrets/jwt_key' || 123;

  try {
    // Read the file from the container's internal storage
    const secret = fs.readFileSync(secretPath, 'utf8');
    // .trim() is essential to remove hidden newlines/spaces
    return secret.trim();
  } catch (err) {
    console.error(`[Myceleum] Error reading secret at ${secretPath}:`, err);
    throw new Error("Could not initialize security: Secret file missing.");
  }
}
