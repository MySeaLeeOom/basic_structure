pub mod legacy_sync;
pub mod notes;
pub mod persistence;
pub mod websocket;

pub use legacy_sync::{apply_update, get_updates_since};
pub use notes::{create_note, delete_note, get_all_notes, get_note};
pub use websocket::ws_sync;