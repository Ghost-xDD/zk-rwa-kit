use http::Uri;

/// Maximum number of bytes that can be sent from prover to server
pub const MAX_SENT_DATA: usize = 512;

/// Maximum number of bytes that can be received by prover from server  
pub const MAX_RECV_DATA: usize = 2048;

/// Server configuration for the TLSNotary prover
pub struct Config {
    /// Host address for WebSocket server
    pub ws_host: String,
    /// Port for WebSocket server
    pub ws_port: u16,
    /// URI of the target server (mock bank API endpoint)
    pub server_uri: Uri,
    /// Port for the wstcp proxy server
    pub wstcp_proxy_port: u16,
    /// Maximum duration for a WebSocket session in seconds
    pub session_timeout_secs: u64,
}

impl Default for Config {
    fn default() -> Self {
        // Get the mock bank URL from environment or use default
        // In Docker, mock-bank service is accessible via its service name
        let mock_bank_url = std::env::var("MOCK_BANK_URL")
            .unwrap_or_else(|_| "https://mock-bank:3002/api/account".to_string());

        Self {
            ws_host: "0.0.0.0".into(),
            ws_port: 9816,
            server_uri: mock_bank_url
                .parse::<Uri>()
                .expect("Invalid MOCK_BANK_URL - check environment variable"),
            wstcp_proxy_port: 55688,
            session_timeout_secs: 120,
        }
    }
}

impl Config {
    /// Get the server domain from the URI
    pub fn server_domain(&self) -> String {
        self.server_uri
            .host()
            .expect("Server URL must have a valid domain")
            .to_string()
    }

    /// Get the server port from the URI (default 443 for HTTPS)
    pub fn server_port(&self) -> u16 {
        self.server_uri.port_u16().unwrap_or(443)
    }

    /// Create config from environment variables
    pub fn from_env() -> Self {
        let ws_port = std::env::var("PROVER_WS_PORT")
            .ok()
            .and_then(|p| p.parse().ok())
            .unwrap_or(9816);

        let wstcp_proxy_port = std::env::var("PROVER_PROXY_PORT")
            .ok()
            .and_then(|p| p.parse().ok())
            .unwrap_or(55688);

        let session_timeout_secs = std::env::var("PROVER_SESSION_TIMEOUT")
            .ok()
            .and_then(|p| p.parse().ok())
            .unwrap_or(120);

        let mut config = Self::default();
        config.ws_port = ws_port;
        config.wstcp_proxy_port = wstcp_proxy_port;
        config.session_timeout_secs = session_timeout_secs;
        config
    }
}
