//TODO: import from nuxtjs-i18n instead of this
import { createI18n } from "vue-i18n";


const messages = {
	en: {
		welcome: 'Hello World',
		add: 'add',


	},
	el: {
		welcome: 'Γειά σου, Κόσμε!',
		add: 'add',
	},
	de: {
		welcome: 'willkommen',
		add: 'addieren',
	},
	es: {
		welcome: 'bienvenido',
		add: 'adderar',
	}
}

const i18n = createI18n({
	locale: 'es',
	legacy: false,
	globalInjection: true,
	fallbackLocale: 'en',
	messages
})

export default i18n