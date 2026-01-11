# Prover Server

WebSocket server that acts as the TLSNotary prover in the DevConnect demo.

## Running the server
```bash
cargo run --release
```

## WebSocket APIs
### /prove
For prover connections via websocket, i.e. `ws://localhost:9816/prove`

### /verify
For verification via websocket, i.e. `ws://localhost:9816/verify`
