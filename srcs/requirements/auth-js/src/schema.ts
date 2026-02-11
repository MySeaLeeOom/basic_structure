/**
 * User Identity Table
 * Stores who the person is and their account status.
 */
export interface User {
	id: number; // Internal database ID (SERIAL)
	provider: "github" | "local";
	provider_id: string; // The unique ID from GitHub (doesn't change)
	username: string;
	role: "user" | "admin";
	status: "active" | "blocked" | "suspended";
	created_at: Date;
}

/**
 * Session Table (Temporary Tickets)
 * Stores the active login "keys" (UUIDs) that go into the cookies.
 * 
	 * FOREIGN KEY logic:
	 * This property "points" to a specific User.id.
	 * It creates a relationship: 1 User can have Many Sessions (laptop, phone, etc.)
 */
export interface Session {
	id: string; // UUID, generated in indesx.ts for direct session response
	user_id: User["id"]; //key to the user table
	role: User["role"]; // We "cache" the role here so we don't have to look up the User table every time
	expires_at: Date; // When this specific login ticket becomes invalid
}
