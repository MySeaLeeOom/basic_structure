import { defineStore } from "pinia";
import { ref, computed } from "vue";

interface User {
	id: string;
	email: string | null;
	role: string | null;
	status: string | null;
	loginName: string | null;
	imageURL: string | null;
	createdAt: string | null;
}

export const useAuthStore = defineStore("auth", () => {
	const user = ref<User | null>(null);
	const error = ref<string | null>(null);
	const sessionCookie = ref<string | null>(null); // Store cookie for SSR requests

	const isAuthenticated = computed(() => !!user.value);

	// Check if session cookie is valid
	async function checkAuth(serverCookie?: string) {
		// Capture headers at the very start (Magic must happen before any await)
		const isServer = typeof window === "undefined";
		const capturedCookie = serverCookie || (isServer ? useRequestHeaders(["cookie"]).cookie : undefined);

		// If user is already set, skip.
		if (user.value) return;

		error.value = null;
		if (capturedCookie) sessionCookie.value = capturedCookie;

		try {
			// Headers setup
			const headers: HeadersInit = {};
			if (isServer && capturedCookie) {
				headers["Cookie"] = capturedCookie;
			}

			// Thick Check: Fetch Profile (This internally verifies the session)
			// If server, we MUST use the internal docker network URL
			// If client, we use the relative URL (proxied by Nginx)
			const url = isServer ? "http://auth:3000/me" : "/api/auth/me";

			const res = await fetch(url, { headers });
			if (res.ok) {
				const data = await res.json();
				user.value = data.user;
			} else {
				user.value = null; // Session invalid or profile not found
			}
		} catch (e) {
			console.error("Auth check failed", e);
			user.value = null;
		}
	}

	function resetStore() {
		user.value = null;
		error.value = null;
		sessionCookie.value = null;
	}

	async function logout() {
		try {
			await fetch("/api/auth/logout", { method: "POST" });
		} catch (e) {
			console.error("Logout failed", e);
		} finally {
			resetStore();
			// Clear Note Store
			// Dynamic import to avoid circular dependency since noteStore uses authStore
			try {
				const { useNoteStore } = await import("@/stores/noteStore");
				const noteStore = useNoteStore();
				noteStore.resetStore();
			} catch (err) {
				console.error("Failed to reset note store", err);
			}

			window.location.href = "/";
		}
	}

	// Helper for manual login (if we build a form)
	async function loginLocal(identifier: string, password: string) {
		error.value = null;
		try {
			const res = await fetch("/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ identifier, password }),
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || "Login failed");
			}

			// success
			await checkAuth(); // refresh user data
			return true;
		} catch (e: any) {
			error.value = e.message;
			return false;
		}
	}

	async function registerLocal(loginName: string, email: string, password: string) {
		error.value = null;
		try {
			const res = await fetch("/api/auth/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ loginName, email, password }),
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || "Registration failed");
			}

			// success
			await checkAuth();
			return true;
		} catch (e: any) {
			error.value = e.message;
			return false;
		}
	}

	/**
	 * Adds a local password to an existing (e.g. OAuth) account.
	 * Follows the "First Principles": Return the data, let the UI decide how to show it.
	 */
	async function addPassword(password: string, email?: string) {
		error.value = null;
		try {
			const res = await fetch("/api/auth/add-password", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ password, email }),
			});

			const data = await res.json();

			if (!res.ok) {
				return {
					success: false,
					error: data.error || "Failed",
					message: data.message || "An error occurred",
					detail: data.detail || "",
				};
			}

			return { success: true, ...data };
		} catch (e: any) {
			return {
				success: false,
				error: "Network Error",
				message: "Could not reach the authentication service.",
				detail: e.message,
			};
		}
	}

	async function updateLoginName(loginName: string) {
		error.value = null;
		try {
			const res = await fetch("/api/auth/change-login", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ loginName }),
			});

			const data = await res.json();

			if (!res.ok) {
				return {
					success: false,
					error: data.error || "Update Failed",
					message: data.message || "An error occurred",
					detail: data.detail || "",
				};
			}

			await checkAuth();

			return { success: true, ...data };
		} catch (e: any) {
			return {
				success: false,
				error: "Network Error",
				message: "Could not contact the Identity service.",
				detail: e.message,
			};
		}
	}

	async function updateEmail(email: string) {
		error.value = null;
		try {
			const res = await fetch("/api/auth/change-email", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email }),
			});

			const data = await res.json();

			if (!res.ok) {
				return {
					success: false,
					error: data.error || "Update Failed",
					message: data.message || "An error occurred",
					detail: data.detail || "",
				};
			}

			await checkAuth();

			return { success: true, ...data };
		} catch (e: any) {
			return {
				success: false,
				error: "Network Error",
				message: "Could not contact the Identity service.",
				detail: e.message,
			};
		}
	}

	return {
		user,
		isAuthenticated,
		error,
		checkAuth,
		sessionCookie,
		logout,
		resetStore,
		loginLocal,
		registerLocal,
		addPassword,
		updateLoginName,
		updateEmail,
	};
});
