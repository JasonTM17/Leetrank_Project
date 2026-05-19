use prometheus::{
    register_counter_vec, register_histogram_vec, CounterVec, HistogramVec, Registry,
};
use std::sync::OnceLock;

static REGISTRY: OnceLock<Registry> = OnceLock::new();
static REQ_COUNTER: OnceLock<CounterVec> = OnceLock::new();
static REQ_LATENCY: OnceLock<HistogramVec> = OnceLock::new();

pub fn registry() -> &'static Registry {
    REGISTRY.get_or_init(Registry::new)
}

pub fn req_counter() -> &'static CounterVec {
    REQ_COUNTER.get_or_init(|| {
        let counter = register_counter_vec!(
            "leaderboard_http_requests_total",
            "Total HTTP requests",
            &["route", "status"]
        )
        .expect("counter");
        registry().register(Box::new(counter.clone())).ok();
        counter
    })
}

pub fn req_latency() -> &'static HistogramVec {
    REQ_LATENCY.get_or_init(|| {
        let h = register_histogram_vec!(
            "leaderboard_http_request_duration_seconds",
            "HTTP request latency in seconds",
            &["route"],
            vec![0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0]
        )
        .expect("histogram");
        registry().register(Box::new(h.clone())).ok();
        h
    })
}
