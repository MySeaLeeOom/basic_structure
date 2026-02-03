## Composables Vs. Pinia

Great observation. Let me clarify the pros and cons:

Composables (like `useNotes`) are less safe/reliable than Pinia stores for several reasons:

1. State Persistence
- Composables: State resets every time the component unmounts
- Pinia: Maintains global state across component lifecycle

2. Global Access
- Composables: Limited to component or manual state sharing
- Pinia: Accessible from anywhere in the application

3. Performance
- Composables: Recreate state each time they're used
- Pinia: More efficient state management

4. Scalability
- Composables: Good for small, component-specific logic
- Pinia: Better for complex, app-wide state management

In your case, since you're managing notes which seem to be app-wide and potentially used for RAG, a Pinia store is definitely more appropriate.

The current `useNotes` composable is essentially duplicating functionality that's now in the Pinia store, which suggests you're in a transition phase or have some redundant code.

Recommendation: 
1. Consolidate to the Pinia store
2. Remove this composable
3. Update components to use the Pinia store directly

Would you like me to help you migrate components to use the Pinia store?