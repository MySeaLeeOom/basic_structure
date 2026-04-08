<script setup lang="ts">
import { shallowRef, watch, watchEffect } from "vue";
import { Editor, EditorContent } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { useCollaboration } from "@/composables/useCollaboration";
import { useNoteStore } from "@/stores/noteStore";
import { useAuthStore } from "@/stores/authStore";
import { userColor, createCaretRenderer } from "@/utils/caretRenderer";
import { useUiI18n } from "~/composables/useUiI18n";

const props = defineProps<{
  noteId: string;
}>();

const noteStore = useNoteStore();
const authStore = useAuthStore();
const { t } = useUiI18n();
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

  const renderCaret = createCaretRenderer(prov.awareness) as (user: Record<string, any>) => HTMLElement;

  const ed = new Editor({
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      Collaboration.configure({ document: doc }),
      CollaborationCaret.configure({
        provider: prov,
        user: {
          name: authStore.user?.loginName ?? "Anonymous",
          color: userColor(authStore.user?.id),
        },
        render: renderCaret,
      }),
    ],
  });

  editor.value = ed;
  onCleanup(() => ed.destroy());
});

function focusEditorEnd(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (target.closest(".editor-scroll")) return;
  const ed = editor.value;
  if (!ed) return;
  ed.commands.focus("end");
}
</script>

<template>
  <div ref="wrapper" class="editor-wrapper" @click="focusEditorEnd">
  <div class="editor-surface">
    <div class="editor-scroll">
      <input
        ref="titleInput"
        :value="titleText"
        @input="updateTitle(($event.target as HTMLInputElement).value)"
        :placeholder="t('noteEditor.untitled')"
        class="editor-title"
      />
      <EditorContent :editor="editor" class="tiptap-editor" />
    </div>
    <div v-if="connectedUsers > 1" class="editor-status">
      <span class="editor-status-dot" />
      {{ connectedUsers }} {{ t('noteEditor.collaborators') }}
    </div>
  </div>
  </div>
</template>
