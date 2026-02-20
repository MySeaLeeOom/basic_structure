import { ref, watch, onUnmounted, type Ref, shallowRef } from "vue";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import { WebSocketProvider } from "@/collaboration/WebSocketProvider";

interface UseCollaborationOptions {
  noteId: Ref<number | null>;
}

interface UseCollaborationReturn {
  ydoc: Y.Doc;
  yContent: Y.XmlFragment;
  yTitle: Y.Text;
  awareness: Awareness;
  provider: Ref<WebSocketProvider | null>;
  titleText: Ref<string>;
  isConnected: Ref<boolean>;
  connectedUsers: Ref<number>;
  updateTitle: (value: string) => void;
}

export function useCollaboration(
  options: UseCollaborationOptions,
): UseCollaborationReturn {
  const ydoc = new Y.Doc();
  const yContent = ydoc.getXmlFragment("content");
  const yTitle = ydoc.getText("title");
  const awareness = new Awareness(ydoc);

  const provider = shallowRef<WebSocketProvider | null>(null);
  const titleText = ref("");
  const isConnected = ref(false);
  const connectedUsers = ref(0);

  // --- Title sync: remote → local ---
  yTitle.observe(() => {
    titleText.value = yTitle.toString();
  });

  // --- Title sync: local → remote ---
  function updateTitle(value: string): void {
    ydoc.transact(() => {
      yTitle.delete(0, yTitle.length);
      yTitle.insert(0, value);
    });
  }

  // --- Awareness tracking ---
  awareness.on(
    "change",
    () => {
      connectedUsers.value = awareness.getStates().size;
    },
  );

  // --- Provider lifecycle ---
  function connectToNote(noteId: number): void {
    provider.value?.disconnect();

    const p = new WebSocketProvider({
      noteId,
      doc: ydoc,
      awareness,
    });
    p.connect();
    provider.value = p;
    isConnected.value = true;
  }

  function disconnect(): void {
    provider.value?.disconnect();
    provider.value = null;
    isConnected.value = false;
  }

  // Watch noteId — connect when set, disconnect when cleared
  watch(
    options.noteId,
    (id, oldId) => {
      if (oldId != null) {
        disconnect();
      }
      if (id != null) {
        connectToNote(id);
      }
    },
    { immediate: true },
  );

  onUnmounted(() => {
    disconnect();
    ydoc.destroy();
  });

  return {
    ydoc,
    yContent,
    yTitle,
    awareness,
    provider,
    titleText,
    isConnected,
    connectedUsers,
    updateTitle,
  };
}
