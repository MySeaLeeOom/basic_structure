<script setup lang="ts">
import { shallowRef, watch, watchEffect } from "vue";
import { Editor, EditorContent } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import Card from "@/volt/Card.vue";
import InputText from "@/volt/InputText.vue";
import { useCollaboration } from "@/composables/useCollaboration";
import { useNoteStore } from "@/stores/noteStore";

const props = defineProps<{
  noteId: string;
}>();

const noteStore = useNoteStore();
const { ydoc, provider, titleText, connectedUsers, updateTitle } =
  useCollaboration(() => props.noteId);

watch(titleText, (newTitle) => {
  noteStore.updateNoteTitle(props.noteId, newTitle);
});

const editor = shallowRef<Editor>();

watchEffect((onCleanup) => {
  const doc = ydoc.value;
  const prov = provider.value;
  if (!doc || !prov) return;

  const ed = new Editor({
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      Collaboration.configure({ document: doc }),
      CollaborationCaret.configure({
        provider: prov,
        user: { name: "Anonymous", color: "#958DF1" },
      }),
    ],
  });

  editor.value = ed;
  onCleanup(() => ed.destroy());
});
</script>

<template>
  <Card pt:root:class="card-document">
    <template #title>
      <InputText
        :model-value="titleText"
        @update:model-value="updateTitle"
        placeholder="Title"
        fluid
      />
    </template>
    <template #content>
      <div class="flex flex-col gap-4 h-full">
        <EditorContent :editor="editor" class="tiptap-editor" />
        <span v-if="connectedUsers > 1" class="text-sm text-gray-500">
          {{ connectedUsers }} users editing
        </span>
      </div>
    </template>
  </Card>
</template>
