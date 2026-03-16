<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue';
import { useAuthStore } from '../stores/authStore';
import Card from '../volt/Card.vue';
import Divider from '../volt/Divider.vue';
import InputText from '../volt/InputText.vue';
import Button from '../volt/Button.vue';

const auth = useAuthStore();
const isSubmitting = ref(false);
const activeForm = ref<'login' | 'email' | 'password' | null>(null);
const successMessage = ref('');

const formLogin = ref('');
const formEmail = ref('');
const oldPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');

const errors = reactive({
	login: '',
	email: '',
	password: ''
});

onMounted(() => {
	if (auth.user) {
		formLogin.value = '';
		formEmail.value = '';
	}
});

async function handleUpdateLogin() {
	if (!formLogin.value || formLogin.value === auth.user?.loginName) return;

	isSubmitting.value = true;
	activeForm.value = 'login';
	errors.login = '';
	successMessage.value = '';

	const result = await auth.updateLoginName(formLogin.value);

	if (!result.success) {
		errors.login = result.message; // Display error strictly under the field
	} else {
		formLogin.value = ''; // Clear the field on success
		successMessage.value = "Username updated successfully";
	}

	isSubmitting.value = false;
	activeForm.value = null;
}

async function handleUpdateEmail() {
	if (formEmail.value === auth.user?.email) return;

	isSubmitting.value = true;
	activeForm.value = 'email';
	errors.email = '';
	successMessage.value = '';

	const result = await auth.updateEmail(formEmail.value);

	if (!result.success) {
		errors.email = result.message; // Display error strictly under the field
	} else {
		successMessage.value = "Email updated successfully";
	}

	isSubmitting.value = false;
	activeForm.value = null;
}

async function handleChangePassword() {
	if (!oldPassword.value || !newPassword.value) return;

	if (newPassword.value !== confirmPassword.value) {
		errors.password = "New passwords do not match";
		return;
	}

	isSubmitting.value = true;
	activeForm.value = 'password';
	errors.password = '';
	successMessage.value = '';

	const result = await auth.changePassword(oldPassword.value, newPassword.value);

	if (!result.success) {
		errors.password = result.message;
	} else {
		oldPassword.value = '';
		newPassword.value = '';
		confirmPassword.value = '';
		successMessage.value = "Password changed successfully";
	}

	isSubmitting.value = false;
	activeForm.value = null;
}
</script>


<template>
	<Card>
		<template #title>
			Profile Settings
			<p v-if="successMessage" class="text-sm text-green-500 font-normal mt-1">{{ successMessage }}</p>
		</template>
		<template #content>
			<h3>Login Name</h3>
			<p v-if="auth.user?.loginName">Current Username: <strong>{{ auth.user.loginName }}</strong></p>
			<form @submit.prevent="handleUpdateLogin">
				<label>Update Username</label>
				<InputText v-model="formLogin" placeholder="Enter new username" />
				<Button label="Update" type="submit"
					:disabled="isSubmitting || !formLogin || formLogin === (auth.user?.loginName || '')" />
				<small v-if="errors.login">{{ errors.login }}</small>
			</form>

			<Divider />

			<h3>Email Address</h3>
			<p>Current Email: <strong>{{ auth.user?.email || 'none' }}</strong></p>
			<form @submit.prevent="handleUpdateEmail">
				<label>Update Email Address</label>
				<InputText v-model="formEmail" />
				<Button label="Update" type="submit"
					:disabled="isSubmitting || formEmail === (auth.user?.email || '')" />
				<small v-if="errors.email">{{ errors.email }}</small>
			</form>

			<Divider />

			<h3>Change Password</h3>
			<form @submit.prevent="handleChangePassword">
				<div>
					<label>Current Password</label>
					<InputText v-model="oldPassword" type="password" />
				</div>
				<div>
					<label>New Password</label>
					<InputText v-model="newPassword" type="password" />
				</div>
				<div>
					<label>Confirm New Password</label>
					<InputText v-model="confirmPassword" type="password" />
				</div>
				<Button label="Change Password" type="submit"
					:disabled="isSubmitting || !oldPassword || !newPassword || !confirmPassword" />
				<small v-if="errors.password">{{ errors.password }}</small>
			</form>

			<Divider />

			<h3>Danger Zone</h3>
			<div>
				<p>Delete Account</p>
				<Button label="Delete" severity="danger" />
			</div>
		</template>
	</Card>
</template>
