<script setup lang="ts">
import { watch } from "vue";
import { useEditor, EditorContent } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import Placeholder from "@tiptap/extension-placeholder";
import Card from "@/volt/Card.vue";
import Button from "@/volt/Button.vue";
import InputText from "@/volt/InputText.vue";
import { useCollaboration } from "@/composables/useCollaboration";

const props = defineProps<{
  noteId: string;
  editable: boolean;
}>();

const emit = defineEmits<{
  close: [];
  edit: [];
}>();

const { ydoc, provider, titleText, connectedUsers, updateTitle } =
  useCollaboration(props.noteId);

const editor = useEditor({
  editable: props.editable,
  immediatelyRender: false,
  extensions: [
    StarterKit.configure({ undoRedo: false }),
    Collaboration.configure({ document: ydoc }),
    CollaborationCaret.configure({
      provider: provider,
      user: { name: "Anonymous", color: "#958DF1" },
    }),
    Placeholder.configure({ placeholder: "Start writing..." }),
  ],
});

// Toggle editable when prop changes
watch(() => props.editable, (val) => {
  editor.value?.setEditable(val);
});
</script>

<template>
  <Card pt:root:class="card-document">
    <template #title>
      <div class="flex items-center justify-between">
        <!-- Editable: input field. Read-only: plain text -->
        <InputText
          v-if="editable"
          :model-value="titleText"
          @update:model-value="updateTitle"
          placeholder="Title"
          fluid
        />
        <span v-else>{{ titleText || "Untitled" }}</span>

        <Button
          v-if="editable"
          label="Close"
          severity="secondary"
          text
          @click="emit('close')"
        />
        <Button
          v-else
          label="Edit"
          severity="secondary"
          text
          @click="emit('edit')"
        />
      </div>
    </template>
    <template #content>
      <div class="flex flex-col gap-4 h-full">
        <EditorContent :editor="editor" class="tiptap-editor" />
        <span v-if="editable && connectedUsers > 1" class="text-sm text-gray-500">
          {{ connectedUsers }} users editing
        </span>
      </div>
    </template>
  </Card>
</template>
