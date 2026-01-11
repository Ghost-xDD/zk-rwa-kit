use axum::{
    extract::{Request, State},
    response::IntoResponse,
    routing::get,
    Router,
};
use eyre::eyre;
use http::Uri;
use hyper::{body::Incoming, server::conn::http1};
use hyper_util::rt::TokioIo;
use std::{
    net::{IpAddr, SocketAddr},
    sync::Arc,
    time::Duration,
};
use tokio::net::TcpListener;
use tokio::time::timeout;
use tower_service::Service;
use tracing::{debug, error, info};
use ws_stream_tungstenite::WsStream;

pub mod axum_websocket;
pub mod config;
pub mod prover;
pub mod verifier;

use axum_websocket::{WebSocket, WebSocketUpgrade};
use prover::prover;
use verifier::verifier;

/// Global data shared with axum handlers
#[derive(Clone, Debug)]
struct ServerGlobals {
    pub server_uri: Uri,
    pub session_timeout: Duration,
}

/// Socket type enum for prover vs verifier
#[derive(Clone, Debug)]
enum SocketType {
    Prover,
    Verifier,
}

/// Run the WebSocket server
pub async fn run_ws_server(config: &config::Config) -> Result<(), eyre::ErrReport> {
    let ws_server_address = SocketAddr::new(
        IpAddr::V4(config.ws_host.parse().map_err(|err| {
            eyre!("Failed to parse websocket host address: {err}")
        })?),
        config.ws_port,
    );
    
    let listener = TcpListener::bind(ws_server_address)
        .await
        .map_err(|err| eyre!("Failed to bind server address: {err}"))?;

    info!("WebSocket server listening on {}", ws_server_address);

    let protocol = Arc::new(http1::Builder::new());
    let router = Router::new()
        .route(
            "/prove",
            get(|ws, state| ws_handler(ws, state, SocketType::Prover)),
        )
        .route(
            "/verify",
            get(|ws, state| ws_handler(ws, state, SocketType::Verifier)),
        )
        .route("/health", get(health_handler))
        .with_state(ServerGlobals {
            server_uri: config.server_uri.clone(),
            session_timeout: Duration::from_secs(config.session_timeout_secs),
        });

    loop {
        let stream = match listener.accept().await {
            Ok((stream, addr)) => {
                debug!("Accepted connection from {}", addr);
                stream
            }
            Err(err) => {
                error!("Failed to accept TCP connection: {err}");
                continue;
            }
        };
        
        stream.set_nodelay(true).unwrap();

        let tower_service = router.clone();
        let protocol = protocol.clone();

        tokio::spawn(async move {
            let io = TokioIo::new(stream);

            let hyper_service = hyper::service::service_fn(move |request: Request<Incoming>| {
                tower_service.clone().call(request)
            });
            
            if let Err(err) = protocol
                .serve_connection(io, hyper_service)
                .with_upgrades()
                .await
            {
                error!("Connection serving failed: {err}");
            }
        });
    }
}

/// Health check handler
async fn health_handler() -> impl IntoResponse {
    axum::Json(serde_json::json!({
        "status": "ok",
        "service": "zk-rwa-prover",
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}

/// WebSocket upgrade handler
async fn ws_handler(
    ws: WebSocketUpgrade,
    State(globals): State<ServerGlobals>,
    socket_type: SocketType,
) -> impl IntoResponse {
    let operation = match socket_type {
        SocketType::Prover => "proving",
        SocketType::Verifier => "verification",
    };
    info!("Received WebSocket request for {}", operation);
    ws.on_upgrade(move |socket| handle_socket(socket, globals, socket_type))
}

/// Handle WebSocket connection
async fn handle_socket(socket: WebSocket, globals: ServerGlobals, socket_type: SocketType) {
    let stream = WsStream::new(socket.into_inner());
    let session_timeout = globals.session_timeout;

    fn handle_operation_result<T>(
        result: Result<Result<T, eyre::ErrReport>, tokio::time::error::Elapsed>,
        operation: &str,
        on_success: impl FnOnce(T),
    ) {
        match result {
            Ok(Ok(value)) => {
                on_success(value);
            }
            Ok(Err(err)) => {
                error!("{} failed: {err}", operation);
            }
            Err(elapsed) => {
                error!("{} timed out after {:?}", operation, elapsed);
            }
        }
    }

    match socket_type {
        SocketType::Prover => {
            let result = timeout(session_timeout, prover(stream, &globals.server_uri)).await;
            handle_operation_result(result, "Proving", |_| {
                info!("Proving completed successfully");
            });
        }
        SocketType::Verifier => {
            let domain = globals
                .server_uri
                .authority()
                .map(|a| a.host().to_string())
                .unwrap_or_else(|| "unknown".to_string());

            let result = timeout(session_timeout, verifier(stream, &domain)).await;
            handle_operation_result(result, "Verification", |(sent, received)| {
                info!("Verification completed for {}", domain);
                info!("Sent data length: {} bytes", sent.len());
                info!("Received data length: {} bytes", received.len());
            });
        }
    }
}
