use yrs::{Doc, Transact, StateVector};
fn main() {
    let doc = Doc::new();
    let txn = doc.transact();
    let state = txn.encode_state_as_update_v1(&StateVector::default());
    println!("{:?}", state);
}
