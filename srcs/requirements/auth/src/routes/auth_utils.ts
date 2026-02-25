import type { FastifyRequest } from "fastify";

// path we want the user to go to by default
const fallback = "/notes";

/**
 * A 'Pure helper' to reconstruct the absolute Origin of the request.
 * It is outside the registration logic because it is a universal truth
 * regardless of which route is calling it.
 * Purpose: regirect back to the URL the login happened, in case we do a login popout
 * Allow it to be dynamic instead of always redirecting to the profile page.
 */
export function getOrigin(request: FastifyRequest): string {
	const protocol = (request.headers["x-forwarded-proto"] as string) || "http";
	const host = request.headers["host"];
	const origin = `${protocol}://${host}`;

	// We check if the referer exists AND if it belongs to our own website
	// (We don't want to redirect them to a malicious site by accident!)
	const referer = request.headers["referer"];
	const targetUrl = referer && referer.startsWith(origin) ? referer : `${origin}${fallback}`;

	console.log("Redirect after login to: ", targetUrl);
	return targetUrl;
}

export function getHomeURL(request: FastifyRequest): string {
	const protocol = (request.headers["x-forwarded-proto"] as string) || "http";
	const host = request.headers["host"];
	const url = `${protocol}://${host}`;

	console.log("Redirect after login to: ", url);
	return url;
}
