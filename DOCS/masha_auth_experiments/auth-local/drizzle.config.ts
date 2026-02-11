export default {
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "sqlite", // Use 'dialect' instead of 'driver' in newer versions
  dbCredentials: {
    url: "./data/auth.db",
  },
};