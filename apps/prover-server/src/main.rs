use std::net::{IpAddr, Ipv4Addr, SocketAddr, ToSocketAddrs};
use zk_rwa_prover::{config::Config, run_ws_server};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};
use wstcp::ProxyServer;

const TRACING_FILTER: &str = "INFO";

#[tokio::main]
async fn main() -> Result<(), eyre::ErrReport> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| TRACING_FILTER.into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = Config::from_env();

    println!("==================================================");
    println!("  Zk-RWA-Kit TLSNotary Prover Server");
    println!("==================================================");
    tracing::info!("WebSocket port: {}", config.ws_port);
    tracing::info!("Target server: {}", config.server_uri);
    tracing::info!("WSTCP proxy port: {}", config.wstcp_proxy_port);
    tracing::info!("Session timeout: {}s", config.session_timeout_secs);
    println!("==================================================");

    // Run both servers in parallel
    let (ws_result, proxy_result) =
        tokio::join!(run_ws_server(&config), run_wstcp_proxy_async(&config));

    // Handle results - if either fails, propagate the error
    ws_result?;
    proxy_result?;

    Ok(())
}

async fn run_wstcp_proxy_async(config: &Config) -> Result<(), eyre::ErrReport> {
    let bind_addr = SocketAddr::new(
        IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1)),
        config.wstcp_proxy_port,
    );
    
    let server_port = config.server_port();
    let tcp_server_addr = format!("{}:{}", config.server_domain(), server_port)
        .to_socket_addrs()?
        .next()
        .ok_or_else(|| eyre::eyre!("Failed to resolve hostname: {}", config.server_domain()))?;

    tracing::info!("Starting WSTCP proxy on {} -> {:?}", bind_addr, tcp_server_addr);

    let listener = async_std::net::TcpListener::bind(bind_addr)
        .await
        .map_err(|e| eyre::eyre!("Failed to bind proxy listener: {}", e))?;

    let proxy = ProxyServer::new(listener.incoming(), tcp_server_addr)
        .await
        .map_err(|e| eyre::eyre!("Failed to create proxy server: {}", e))?;

    proxy
        .await
        .map_err(|e| eyre::eyre!("Proxy server error: {}", e))?;

    Ok(())
}
