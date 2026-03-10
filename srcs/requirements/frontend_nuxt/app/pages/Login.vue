<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import Card from "@/volt/Card.vue";
import Button from "@/volt/Button.vue";
import InputText from "@/volt/InputText.vue";
import Tabs from "@/volt/Tabs.vue";
import TabList from "@/volt/TabList.vue";
import Tab from "@/volt/Tab.vue";
import TabPanels from "@/volt/TabPanels.vue";
import TabPanel from "@/volt/TabPanel.vue";
import { useAuthStore } from "@/stores/authStore";

const authStore = useAuthStore();
const router = useRouter();

const identifier = ref("");
const password = ref("");
const regLogin = ref("");
const regEmail = ref("");
const regPassword = ref("");

async function handleLogin() {
	const success = await authStore.loginLocal(identifier.value, password.value);
	if (success) {
		router.push("/");
	}
}

async function handleRegister() {
	const success = await authStore.registerLocal(regLogin.value, regEmail.value, regPassword.value);
	if (success) {
		router.push("/");
	}
}

</script>

<template>
	<div class="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
		<Card class="w-full max-w-md">
			<template #title>
				<div class="text-center text-2xl font-bold mb-4">Welcome</div>
			</template>
			<template #content>
				<Tabs value="0">
					<TabList>
						<Tab value="0">Login</Tab>
						<Tab value="1">Register</Tab>
					</TabList>
					<TabPanels>
						<TabPanel value="0">
							<div class="flex flex-col gap-4 mt-4">
								<InputText v-model="identifier" placeholder="Username or Email" fluid />
								<InputText v-model="password" type="password" placeholder="Password" fluid />
								<Button label="Sign In" @click="handleLogin" :loading="authStore.loading" fluid />

								<div class="text-center text-sm text-gray-500 my-2">OR</div>

								<a href="/api/auth/login/github" class="w-full">
									<Button label="Login with GitHub" icon="pi pi-github" severity="secondary" fluid />
								</a>
							</div>
						</TabPanel>
						<TabPanel value="1">
							<div class="flex flex-col gap-4 mt-4">
								<InputText v-model="regLogin" placeholder="Username" fluid />
								<InputText v-model="regEmail" placeholder="Email" fluid />
								<InputText v-model="regPassword" type="password" placeholder="Password" fluid />
								<Button label="Create Account" @click="handleRegister" :loading="authStore.loading"
									fluid />
							</div>
						</TabPanel>
					</TabPanels>
				</Tabs>

				<div v-if="authStore.error" class="text-red-500 text-sm mt-4 text-center">
					{{ authStore.error }}
				</div>
			</template>
		</Card>
	</div>
</template>
