import { Counter, Histogram, register as prometheusRegister } from "prom-client";

export const authLoginLocalTotal = new Counter({
	name: "auth_login_local_total",
	help: "POST /login credential validation outcomes.",
	labelNames: ["result"],
	registers: [prometheusRegister],
});

export const authPasswordVerifySeconds = new Histogram({
	name: "auth_password_verify_seconds",
	help: "argon2.verify duration on POST /login when a local password hash exists.",
	buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
	registers: [prometheusRegister],
});

export const authRegisterTotal = new Counter({
	name: "auth_register_total",
	help: "POST /register outcomes.",
	labelNames: ["result"],
	registers: [prometheusRegister],
});

export const authGithubCallbackTotal = new Counter({
	name: "auth_github_callback_total",
	help: "GET /login/github/callback outcomes.",
	labelNames: ["result"],
	registers: [prometheusRegister],
});

export const authMeTotal = new Counter({
	name: "auth_me_total",
	help: "GET /me responses by HTTP status.",
	labelNames: ["status"],
	registers: [prometheusRegister],
});

export const authVerifyTotal = new Counter({
	name: "auth_verify_total",
	help: "GET /verify session verification outcomes.",
	labelNames: ["result"],
	registers: [prometheusRegister],
});

export const authLogoutTotal = new Counter({
	name: "auth_logout_total",
	help: "POST /logout outcomes.",
	labelNames: ["result"],
	registers: [prometheusRegister],
});

export { prometheusRegister };
