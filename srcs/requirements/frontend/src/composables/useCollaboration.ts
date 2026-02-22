import { ref, onUnmounted, type Ref } from "vue";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import { WebSocketProvider } from "@/collaboration/WebSocketProvider";

interface UseCollaborationReturn {
  ydoc: Y.Doc;
  yTitle: Y.Text;
  awareness: Awareness;
  provider: WebSocketProvider;
  titleText: Ref<string>;
  isConnected: Ref<boolean>;
  connectedUsers: Ref<number>;
  updateTitle: (value: string) => void;
}

export function useCollaboration(noteId: string): UseCollaborationReturn {
  const ydoc = new Y.Doc();
  const yTitle = ydoc.getText("title");
  const awareness = new Awareness(ydoc);

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
  awareness.on("change", () => {
    connectedUsers.value = awareness.getStates().size;
  });

  // --- Connect immediately ---
  const provider = new WebSocketProvider({ noteId, doc: ydoc, awareness });
  provider.connect();
  isConnected.value = true;

  // --- Cleanup on unmount ---
  onUnmounted(() => {
    provider.disconnect();
    ydoc.destroy();
  });

  return {
    ydoc,
    yTitle,
    awareness,
    provider,
    titleText,
    isConnected,
    connectedUsers,
    updateTitle,
  };
}
