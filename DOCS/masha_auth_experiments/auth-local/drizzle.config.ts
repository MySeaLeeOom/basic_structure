export default {
	schema: "./src/db/schema.ts",
	out: "./drizzle",
	dialect: "postgresql", 
	dbCredentials: {
		url: "./data/auth.db",
	},
};
