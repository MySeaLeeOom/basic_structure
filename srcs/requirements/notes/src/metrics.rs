use prometheus::{CounterVec, Encoder, Opts, TextEncoder};
use std::sync::OnceLock;

/// Exposition format for `TextEncoder` (stable, does not depend on encoder instance).
const PROMETHEUS_CONTENT_TYPE: &str = "text/plain; version=0.0.4; charset=utf-8";

fn mutations_counter() -> &'static CounterVec {
	static M: OnceLock<CounterVec> = OnceLock::new();
	M.get_or_init(|| {
		let v = CounterVec::new(
			Opts::new("notes_mutations_total", "Note create/delete operations."),
			&["op"],
		)
		.expect("notes_mutations_total vec");
		prometheus::default_registry()
			.register(Box::new(v.clone()))
			.expect("register notes_mutations_total");
		v
	})
}

pub fn init() {
	let _ = mutations_counter();
}

pub fn inc_mutation(op: &'static str) {
	mutations_counter().with_label_values(&[op]).inc();
}

/// Prometheus text exposition for the default registry.
pub fn gather_prometheus_text() -> Result<(String, &'static str), prometheus::Error> {
	let encoder = TextEncoder::new();
	let metric_families = prometheus::gather();
	let mut buf = vec![];
	encoder.encode(&metric_families, &mut buf)?;
	Ok((
		String::from_utf8_lossy(&buf).into_owned(),
		PROMETHEUS_CONTENT_TYPE,
	))
}
