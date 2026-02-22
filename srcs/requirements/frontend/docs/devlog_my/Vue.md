Mini TypescriptTypescript is basically a way to write JS that controls for types, it can also help IDEs help you know what to expect. If you misspell a property when inputting an object into a function, Typescript will put red squiggle line for you, so you know :) 

Utility Types in TS

Partial<Person>, Omit<Person, id>

Generics 

Simplified template things, can control if what we return is same type as what went in

function arrayAdd<T>(array: T[], item: T): T {
array.push(item);
return item;
Vue.js



## Vue.JS

HTML elements have attributes and event attributes!

## SFCs: Single File Components syntax
```
<script setup>
import { ref } from 'vue'
const count = ref(0)
function increment() {
  count.value++
}
</script>
<template>
   <h1>{{count}}</h1>
</template>
<style scoped>
</style>
```
### Bing a variable to an element's attribute:

`v-bind:href="href" || :href="href || :href (if var name is same as attribute name)`

### Set up an event attribute with a variable

`v-on:click="handleClick" || @click="handleClick"`

Two way binding for FORM input elements

`<input v-model="textVariable">`

This replaces a v-bind and v-on here 

`<input :value="text" @input="onInput">`

So we don't have to think which attribute on which element of a form we have to bind to. Since forms are the primary interacting components of the web, this simplifies out life immensely!
Replace this:
```
<script setup>
import { ref } from 'vue';
const myText = ref('Initial text');
// Update the ref with the value from the event
function updateText(event) {
  myText.value = event.target.value;
}
</script>
<template>
  <textarea v-bind:value="myText" v-on:input="updateText"></textarea>
  <p>Preview: {{ myText }}</p>
</template>
```
with this:

```
<script setup>
import { ref } from 'vue';
const myText = ref('Initial text');
</script>
<template>
  <textarea v-model="myText"></textarea>
  <p>Preview: {{ myText }}</p>
</template>
if else
<h1 v-if="awesome">Vue is awesome!</h1>
<h1 v-else>Oh no 😢</h1>
```
