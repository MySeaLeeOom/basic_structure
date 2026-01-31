# Vue Primer

## Facts
#### Progressive Nature
- Can be addded inside an html <script></script> tag
```
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="styles.css"/>
    <title>Vue.js Basics</title>
	<!-- VUE VIS A CDN LINK -->
    <script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
</head>
<body>
    <div id="app">
        <header>
            <span>👋🏻</span>
        </header>
        <main>
            <h1>Hello, {{name}}!</h1>
            <p>I'm about to learn <a href="https://vuejs.org/" target="_blank">Vue.js</a>!</p>
        </main>
        <footer>
            <p>&copy; 2025</p>
        </footer>
    </div>
    <script>
        const {createApp, ref} = Vue
        createApp({
            setup() {
                const name = ref("Rachel")
                return {name}
            }
        }).mount("#app")
    </script>
</body>
</html>
```
- Can be used with *.vue files as a "Framework" with Vite


#### Technical Aspects
- Declarative (describe what things should look like not step by step what to do)
- When the value of a ref() changes, the page updates automatically
- Creates a Virtual DOM to track changes. Calculated the smallest possible change necessary in actual DOM

#### Component based architecture
Single File Components:
- <script setup></script>
- <template></template>
- <style scoped></style>

#### Options vs Composition API styles
- Options API: The traditional way. You organize code by "options" like data, methods, and mounted.
```
<script>
export default {
  data() {
    return {
      text: ''
    }
  },
  methods: {
    onInput(e) {
      this.text = e.target.value
    }
  }
}
</script>

<template>
  <input :value="text" @input="onInput" placeholder="Type here">
  <p>{{ text }}</p>
</template>
```
- Composition API
```
<script setup>
import { ref } from 'vue'

const text = ref('')

function onInput(e) {
  text.value = e.target.value
}
</script>

<template>
  <input :value="text" @input="onInput" placeholder="Type here">
  <p>{{ text }}</p>
</template>
```

### We will be using the modern Composition API

## LEARN HERE:
https://vuejs.org/tutorial/#step-1

## Vue Cheat Sheet

- `import {ref} from 'vue'`
	- a ref is a variable that will be tracked by the Framework if the value of this variable (variable.value) changes, it will be reactively updated
	- `const text = ref("")`
	- `const someArray = ref([])` 
	- and so on

- `v-bind:src="imgSrc"`
	- this is how you use a variable name in place of text in an html element `<img src="https://image.com/image"/>`
	- binding a variable to an html element's attribute
	- equivalent `:src="ingSrc`
	- equivalent if `:src="src"` >> `:src`
```
<script setup>
import { ref } from 'vue'
const logoUrl = ref('https://vuejs.org/images/logo.png')
const description = ref('The official Vue.js logo')
</script>

<template>
  <div class="image-container">
    <img 
      :src="logoUrl" 
      :alt="description" 	  
    >
  </div>
</template>

<style scoped>
</style>
```
	
- `'v-on:click="handleClick'`
	- binding a function to *event handler attributes*
	- equivalent to `@click="handleClick"`

- `v-model:"variableName"` abstracts the form element complexity
	- FOR FORMS
	- combines `v-bind` + `v-on` in `<input :value="text" @input="onInput" placeholder="Type here">`
	- new version `<input v-model="text" placeholder="Type here">`
		- in this case you don't need to have a function to keep track of the input value, it is automatic!!!
		- maybe this is why people love vue
	- we add this to sync the value of a form elemnt with variable automatically. Just remember that checkboxes need an array as a ref()
	- two way binding: 
		- updating variable will change the form field, 
		- updating the form field will change the variable
	- v-model is actually just a "shortcut" (syntax sugar). It’s doing the work of listening for keystrokes and updating the value so you don't have to code that in.

- `v-if/v-else`
```
<h1 v-if="awesome">Vue is awesome!</h1>
<h1 v-else>Oh no 😢</h1>
```


### Form Things to Know

* **`<label>`**: Text for the human user to read.
* **`name`**: Data category key for computer/server identification.
* **`value`**: The actual content or choice being recorded.
* **Text Inputs**: Value is created by user typing.
* **Radios/Checkboxes**: Require hard-coded value to identify selection.
* **`for` / `id**`: Connects label to input for accessibility.

* **`v-model`**: Syncs HTML value to Vue variable automatically.

---

### FUN: Image Style Submit Button
<input 
      type="image" 
      src="<image_url>" 
      alt="Submit Form"
      class="img-submit"
>

**Would you like me to show you how to add an image-style submit button to this form?**

#### HTML CHEAT SHEET
https://web.stanford.edu/group/csp/cs21/htmlcheatsheet.pdf

#### No Vue
```
// Grab the elements from the DOM
const nameInput = document.getElementById('userBio');

// Listen for the 'input' event (triggers every time you type)
nameInput.addEventListener('input', (event) => {
    // Manually update the data and the UI
    const currentValue = event.target.value;
    nameDisplay.textContent = `Live Name: ${currentValue}`;
});

	<label for="userBio">Bio:</label>
  	<textarea id="userBio" name="userBio" rows="4" cols="30"></textarea>

const bio = form.elements['userBio'].value;
```

#### Vue way
```
<script setup>
import { ref } from 'vue'
const userBio = ref('')
</script>

<template>
    <label for="bio">Bio:</label>
    <textarea id="bio" v-model="userBio" rows="4" cols="30"></textarea>
</template>
//automatically updates in variable with every click
```
