<script setup lang="ts">
import { useUiI18n } from '~/composables/useUiI18n';
const { t } = useUiI18n();
</script>

<template>
	<div class="max-w-3xl mx-auto px-6 py-10 overflow-y-auto h-full text-surface-800 dark:text-surface-200">
		<h1 class="text-2xl font-bold mb-1">{{ t('legal.terms.title') }}</h1>
		<p class="text-sm text-surface-500 mb-8">{{ t('legal.lastUpdated') }}: 17/04/2026</p>

		<p class="mb-6">By creating an account or using Mycelium Notes ("the Service"), you agree to these terms. If you do not agree, do not use the Service.</p>

		<section class="mb-6">
			<h2 class="text-lg font-semibold mb-2">1. Definitions</h2>
			<ul class="list-disc pl-6 space-y-1">
				<li><strong>"Service"</strong> refers to the Mycelium Notes web application and all associated backend services.</li>
				<li><strong>"User"</strong> refers to any individual who creates an account or accesses the Service.</li>
				<li><strong>"Content"</strong> refers to any notes, text, documents, or other material created, uploaded, or edited through the Service.</li>
				<li><strong>"We", "us", and "our"</strong> refer to the operator(s) of the Service.</li>
			</ul>
		</section>

		<section class="mb-6">
			<h2 class="text-lg font-semibold mb-2">2. Account Registration</h2>
			<p class="mb-2">2.1 You may register using a local account (email and password) or by authenticating through GitHub OAuth. You are responsible for maintaining the security of your credentials.</p>
			<p class="mb-2">2.2 You agree to provide accurate information during registration. Each account must have a unique email address and login name.</p>
			<p class="mb-2">2.3 During registration, you must confirm that you have read and accept these Terms of Service and the Privacy Policy. This confirmation is required before your account can be created.</p>
			<p class="mb-2">2.4 If you sign in via GitHub, you authorize us to receive your profile information (display name, email, avatar URL) from GitHub. Your use of GitHub is subject to GitHub's own terms of service.</p>
			<p>2.5 You are responsible for all activity that occurs under your account. Notify us immediately if you believe your account has been compromised.</p>
		</section>

		<section class="mb-6">
			<h2 class="text-lg font-semibold mb-2">3. User Content</h2>
			<p class="mb-2">3.1 <strong>Ownership.</strong> You retain ownership of the Content you create through the Service. We do not claim intellectual property rights over your Content.</p>
			<p class="mb-2">3.2 <strong>License to operate.</strong> By storing Content on the Service, you grant us a limited, non-exclusive license to store, process, transmit, and display your Content solely for the purpose of providing and maintaining the Service. This includes synchronizing Content across collaborative sessions and generating vector embeddings for the AI assistant feature.</p>
			<p class="mb-2">3.3 <strong>Collaborative editing.</strong> The Service supports real-time collaborative editing. When you share a note or collaborate with other users, those users may view, edit, and modify the shared Content. You acknowledge that collaborative edits are merged automatically and may not be individually reversible.</p>
			<p class="mb-2">3.4 <strong>AI assistant.</strong> The Service includes an AI-powered assistant that uses your note content to answer queries. Note text is processed into vector embeddings stored in a separate database. The AI assistant operates on notes you own and notes shared with you. No content is sent to external AI providers; all processing uses locally hosted models.</p>
			<p>3.5 <strong>Content format.</strong> Document bodies are stored as binary CRDT state vectors. We do not guarantee that Content can be exported in any particular format beyond what the Service's interface provides.</p>
		</section>

		<section class="mb-6">
			<h2 class="text-lg font-semibold mb-2">4. Acceptable Use</h2>
			<p class="mb-2">You agree not to:</p>
			<ul class="list-[lower-alpha] pl-6 space-y-1">
				<li>Use the Service to store or transmit unlawful, defamatory, harassing, or otherwise objectionable material.</li>
				<li>Attempt to gain unauthorized access to other users' accounts, notes, or any part of the Service's infrastructure.</li>
				<li>Interfere with or disrupt the Service, including its servers, networks, or WebSocket connections.</li>
				<li>Use automated tools (bots, scrapers) to access the Service without prior written permission.</li>
				<li>Circumvent any access controls, rate limits, or security measures.</li>
				<li>Impersonate another person or misrepresent your affiliation with any entity.</li>
			</ul>
		</section>

		<section class="mb-6">
			<h2 class="text-lg font-semibold mb-2">5. Account Suspension and Termination</h2>
			<p class="mb-2">5.1 We may change your account status to blocked or suspended, temporarily or permanently, if we reasonably believe you have violated these terms or pose a risk to other users or the Service.</p>
			<p class="mb-2">5.2 You may delete your account at any time from your Account settings. Account deletion will remove your sessions, linked provider accounts, notes, AI-generated embeddings, and all other data associated with your account. See our Privacy Policy for full details.</p>
			<p class="mb-2">5.3 You may export your personal data at any time from your Account settings before deleting your account.</p>
			<p>5.4 We reserve the right to discontinue the Service at any time, with reasonable notice where practicable.</p>
		</section>

		<section class="mb-6">
			<h2 class="text-lg font-semibold mb-2">6. Third-Party Services</h2>
			<p class="mb-2">6.1 The Service integrates with GitHub solely for authentication purposes. We are not responsible for GitHub's availability, terms, or handling of your data.</p>
			<p>6.2 The Service does not currently integrate advertising networks, payment processors, or third-party analytics. If this changes, these terms will be updated accordingly.</p>
		</section>

		<section class="mb-6">
			<h2 class="text-lg font-semibold mb-2">7. Availability and Warranties</h2>
			<p class="mb-2">7.1 The Service is provided "as is" and "as available" without warranties of any kind, whether express or implied, including but not limited to merchantability, fitness for a particular purpose, or non-infringement.</p>
			<p class="mb-2">7.2 We do not guarantee that the Service will be uninterrupted, error-free, or secure. Real-time collaboration depends on WebSocket connectivity, which may be affected by network conditions outside our control.</p>
			<p>7.3 We do not guarantee the integrity or durability of stored Content. You are responsible for maintaining your own backups.</p>
		</section>

		<section class="mb-6">
			<h2 class="text-lg font-semibold mb-2">8. Limitation of Liability</h2>
			<p>To the maximum extent permitted by applicable law, we shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of data, profits, or goodwill, arising from or related to your use of the Service.</p>
		</section>

		<section class="mb-6">
			<h2 class="text-lg font-semibold mb-2">9. Indemnification</h2>
			<p>You agree to indemnify and hold us harmless from any claims, damages, or expenses (including reasonable legal fees) arising from your use of the Service, your Content, or your violation of these terms.</p>
		</section>

		<section class="mb-6">
			<h2 class="text-lg font-semibold mb-2">10. Privacy</h2>
			<p>Your use of the Service is also governed by our <NuxtLink to="/privacy" class="text-primary-500 hover:underline">Privacy Policy</NuxtLink>, which describes how we collect, use, and store your personal data.</p>
		</section>

		<section class="mb-6">
			<h2 class="text-lg font-semibold mb-2">11. Modifications to These Terms</h2>
			<p>We may update these terms at any time. The "Last updated" date at the top will reflect the most recent revision. Continued use of the Service after changes are posted constitutes acceptance of the revised terms.</p>
		</section>

		<section class="mb-6">
			<h2 class="text-lg font-semibold mb-2">12. Governing Law</h2>
			<p>These terms shall be governed by and construed in accordance with the laws of Germany. Any disputes arising under these terms shall be subject to the exclusive jurisdiction of the courts of Berlin, Germany.</p>
		</section>

		<section class="mb-6">
			<h2 class="text-lg font-semibold mb-2">13. Severability</h2>
			<p>If any provision of these terms is found to be unenforceable, the remaining provisions shall continue in full force and effect.</p>
		</section>

		<section class="mb-6">
			<h2 class="text-lg font-semibold mb-2">14. Contact</h2>
			<p>For questions about these terms, contact us at <a href="mailto:myakoven@student.42berlin.de" class="text-primary-500 hover:underline">myakoven@student.42berlin.de</a>.</p>
		</section>
	</div>
</template>
