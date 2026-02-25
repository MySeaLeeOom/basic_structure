## flow of editor service 
(I named the collab service - editor because I think it's more accurate since you can edit the docs on your own as well)


(rest api is used for displaying titles -> this is what we see now + maybe permissions already)


on click on a title -> frontend creates the websocket connection by calling /ws/ from nginx.  
Once this reaches the editor service we have to make a check if this is the first User - create room(query Postgres) + load blob into RAM(yrs::Doc). If it is the second User we don't have to query db/ create the room -> it already exists + already on RAM.  
After that we send the current state of the file (binary state vector from RAM). The user's local yjs syncs that data with the existing one.  
Then the live editing - on every keystroke the UI is updated immediately and a tiny binary payload gets sent back to the editor service, where in RAM it is being applied to the yrs::Doc. Then this update gets sent back to all users (tiny binary payload and their yjs syncs it).  


Now how do we save things in the db? -> option one user stops typing for x seconds -> then save, option two last user disconnects -> save.
How the update works -> when a save is supposed to happen, first we lock the room in the RAM, then we extract the fully combined binary state from the RAM and we update the db with UPDATE note_states ...  
If we saved because last user left we free up the RAM.  


Mouse awareness -> frontend sends awareness message (user id, color and cursor pos) to editor service, editor sends it right back to all users. (Note: It is temporarily stored in RAM so new users joining get the current cursor positions, but it is NEVER applied to the yrs::Doc and NEVER saved to the DB).


here are some new concepts:
DashMap instead of HashMap(with RwLock) it is thread safe no manual lock needed.
different approach on when to save to db (its called debounced save loop). from saving on every MSG_SYNC payload -> saving with timer.
yrs::Doc  holds the in-memory collaborative CRDT state for each room.
y-sync instead of manual byte parsing. It automatically handles the synchronization protocol between clients.