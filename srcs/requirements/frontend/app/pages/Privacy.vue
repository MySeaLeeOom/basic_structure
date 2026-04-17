<script setup lang="ts">
import { useUiI18n } from '~/composables/useUiI18n';
const { t } = useUiI18n();
</script>

<template>
	<div class="max-w-3xl mx-auto px-6 py-10 overflow-y-auto h-full text-surface-800 dark:text-surface-200">
		<h1 class="text-2xl font-bold mb-1">{{ t('legal.privacy.title') }}</h1>
		<p class="text-sm text-surface-500 mb-8">{{ t('legal.lastUpdated') }}: 17/04/2026</p>

		<p class="mb-6">This policy describes what personal data Mycelium Notes ("the Service") collects, why, and how it is handled.</p>

		<section class="mb-6">
			<h2 class="text-lg font-semibold mb-2">1. Data We Collect</h2>

			<h3 class="font-medium mt-3 mb-1">1.1 Account information</h3>
			<p>When you register a local account, we store your email address, a display name (login name), and a password hash (Argon2). When you sign in via GitHub OAuth, we store the provider account identifier and any profile data GitHub returns (display name, email, avatar URL). We do not store your GitHub password or OAuth token long-term.</p>

			<h3 class="font-medium mt-3 mb-1">1.2 Session data</h3>
			<p>Each time you sign in, we create a server-side session record containing a session token, your IP address, your browser's User-Agent string, and an expiry timestamp. Sessions expire after seven days.</p>

			<h3 class="font-medium mt-3 mb-1">1.3 Content</h3>
			<p>Notes you create — including titles, metadata, and collaborative document state — are stored in our database. Document bodies are stored as binary CRDT (Yjs/Yrs) state vectors, not plain text.</p>

			<h3 class="font-medium mt-3 mb-1">1.4 AI-generated data</h3>
			<p>When you use the AI assistant feature, the text content of your notes is split into chunks, converted into numerical vector embeddings, and stored in a separate vector database. These embeddings are used to retrieve relevant context when you query the AI assistant. The embeddings are tied to your user ID and note ID.</p>

			<h3 class="font-medium mt-3 mb-1">1.5 Cookies</h3>
			<p class="mb-2">We set two cookies:</p>
			<ul class="list-disc pl-6 mb-2 space-y-1">
				<li><strong>session_id</strong>: An HTTP-only, Secure cookie with SameSite=Lax. It contains only the session token used to authenticate your requests.</li>
				<li><strong>lang</strong>: A preference cookie that stores your selected interface language.</li>
			</ul>
			<p>We do not use advertising, analytics, or tracking cookies. Both cookies are strictly necessary for the operation of the Service.</p>

			<h3 class="font-medium mt-3 mb-1">1.6 Server logs and metrics</h3>
			<p>Application logs may contain request metadata (timestamps, URLs, status codes). Sensitive fields — request bodies containing passwords, cookie headers, and authorization headers — are redacted before logging. OAuth tokens and third-party user profiles are not logged. We run self-hosted Prometheus and Grafana for operational metrics; no data is sent to third-party analytics or monitoring services.</p>
		</section>

		<section class="mb-6">
			<h2 class="text-lg font-semibold mb-2">2. Data We Do Not Collect</h2>
			<p>We do not integrate third-party analytics (Google Analytics, Segment, etc.), advertising networks, or payment processors. There is no client-side telemetry, no local-storage tracking, and no fingerprinting beyond the User-Agent string stored in your session record.</p>
		</section>

		<section class="mb-6">
			<h2 class="text-lg font-semibold mb-2">3. How We Use Your Data</h2>
			<ul class="list-disc pl-6 space-y-1">
				<li><strong>Account information</strong>: to authenticate you and display your identity within the application.</li>
				<li><strong>Session data</strong> (IP, User-Agent): to maintain your login session, detect session anomalies, and comply with security best practices.</li>
				<li><strong>Content</strong>: to provide the note-taking and real-time collaboration features of the Service.</li>
				<li><strong>AI embeddings</strong>: to power contextual retrieval for the AI assistant feature. Embeddings are derived only from your own notes and notes shared with you.</li>
				<li><strong>Operational metrics</strong>: to monitor service health, performance, and error rates.</li>
			</ul>
		</section>

		<section class="mb-6">
			<h2 class="text-lg font-semibold mb-2">4. Consent</h2>
			<p>When you create an account, you are asked to confirm that you have read and accept this Privacy Policy and the Terms of Service. This confirmation is required before your account can be created.</p>
		</section>

		<section class="mb-6">
			<h2 class="text-lg font-semibold mb-2">5. Third-Party Services</h2>
			<p class="mb-2">The only external service the application communicates with is GitHub, and only when you choose to sign in via GitHub OAuth. In that flow, GitHub receives a standard OAuth authorization request and returns your profile information. GitHub's own privacy policy governs its handling of that data.</p>
			<p>The AI assistant uses a locally hosted language model. No note content or queries are sent to external AI providers.</p>
		</section>

		<section class="mb-6">
			<h2 class="text-lg font-semibold mb-2">6. Data Storage and Security</h2>
			<p>All data is stored in self-hosted PostgreSQL databases: one for account and note data, and one for vector embeddings used by the AI assistant. Passwords are hashed with Argon2 and never stored or logged in cleartext. Session secrets and database credentials are managed via Docker secrets files. Communication between the browser and the server passes through an Nginx reverse proxy configured with TLS.</p>
		</section>

		<section class="mb-6">
			<h2 class="text-lg font-semibold mb-2">7. Data Retention</h2>
			<ul class="list-disc pl-6 space-y-1">
				<li>Sessions are automatically deleted after their seven-day expiry.</li>
				<li>Account and note data are retained for as long as your account exists.</li>
				<li>Vector embeddings are retained for as long as the associated notes exist.</li>
				<li>Server logs are retained according to the deployment's log-rotation configuration.</li>
			</ul>
		</section>

		<section class="mb-6">
			<h2 class="text-lg font-semibold mb-2">8. Data Export</h2>
			<p class="mb-2">You can export your personal data at any time from your Account settings. The export includes:</p>
			<ul class="list-disc pl-6 space-y-1">
				<li>Your profile information (login name, email, role, status, avatar URL, creation date).</li>
				<li>Linked authentication providers and their account identifiers.</li>
				<li>Active sessions (expiry time, user-agent, IP address).</li>
				<li>All notes you own, including their CRDT state vectors.</li>
			</ul>
			<p class="mt-2">The export is provided as a JSON file.</p>
		</section>

		<section class="mb-6">
			<h2 class="text-lg font-semibold mb-2">9. Data Deletion</h2>
			<p class="mb-2">You can delete your account at any time from your Account settings. Account deletion cascades to:</p>
			<ul class="list-disc pl-6 space-y-1">
				<li>All associated sessions and provider-account links.</li>
				<li>All notes owned by the account and their collaborative state entries.</li>
				<li>All vector embeddings associated with the account.</li>
			</ul>
			<p class="mt-2">Deletion is permanent and cannot be undone.</p>
		</section>

		<section class="mb-6">
			<h2 class="text-lg font-semibold mb-2">10. Children</h2>
			<p>The Service is not directed at children. We do not knowingly collect data from children.</p>
		</section>

		<section class="mb-6">
			<h2 class="text-lg font-semibold mb-2">11. Changes to This Policy</h2>
			<p>We will update the "Last updated" date at the top of this page when we make material changes. Continued use of the Service after changes constitutes acceptance.</p>
		</section>

		<section class="mb-6">
			<h2 class="text-lg font-semibold mb-2">12. Contact</h2>
			<p>For questions about this policy, contact us at <a href="mailto:myakoven@student.42berlin.de" class="text-primary-500 hover:underline">myakoven@student.42berlin.de</a>.</p>
		</section>
	</div>
</template>
