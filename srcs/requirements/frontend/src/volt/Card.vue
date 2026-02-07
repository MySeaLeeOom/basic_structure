<template>
    <Card unstyled :pt="theme" :ptOptions="{
        mergeProps: ptViewMerge
    }">
        <template v-for="(_, slotName) in $slots" #[slotName]="slotProps">
            <slot :name="slotName" v-bind="slotProps ?? {}" />
        </template>
    </Card>
</template>

<script setup lang="ts">
import Card, { type CardPassThroughOptions, type CardProps } from 'primevue/card';
import { ref } from 'vue';
import { ptViewMerge } from './utils';

interface Props extends /* @vue-ignore */ CardProps { }
defineProps<Props>();

const theme = ref<CardPassThroughOptions>({
    root: `flex flex-col rounded-xl
        bg-surface-0 dark:bg-surface-900 
        text-surface-700 dark:text-surface-0
        shadow-md overflow-hidden`,
    header: ``,
    body: `p-5 flex flex-col gap-2 flex-1 min-h-0`,
    caption: `flex flex-col gap-2`,
    title: `font-medium text-xl`,
    subtitle: `text-surface-500 dark:text-surface-400`,
    content: `flex-1 min-h-0`,
    footer: ``
});
</script>

<!-- body: `p-5 flex flex-col gap-2 flex-1 min-h-0`, // Added flex-1 min-h-0
content: `flex-1 min-h-0`, // Added flex-1 min-h-0 -->