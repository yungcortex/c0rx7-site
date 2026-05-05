# Bean Royale Escrow Program

Anchor program (`bean_royale_escrow`) that holds match entry fees in a Lobby PDA, then pays out to a winner declared by the match-server authority.

## Layout

```
programs/escrow/
  Cargo.toml
  Anchor.toml
  src/lib.rs              ← program logic
  tests/                  ← TS integration tests against devnet
```

## Lifecycle

1. **create_lobby** — host opens a lobby with `lobby_id`, `mode`, `entry_fee`, `max_players`. PDA seeds: `[b"lobby", host.key, lobby_id]`.
2. **deposit_entry** — each player CPIs `system_program::transfer` from their wallet → lobby PDA, and the player pubkey is recorded.
3. **start_match** — host transitions state to `InMatch`. No more deposits/refunds.
4. **settle_match** — match-server authority signs result with `winner` pubkey. Lobby PDA pays out:
   - `pot * 0.92` → winner
   - `pot * 0.08` → house wallet
5. **cancel_lobby** — TODO v2 (refund all on timeout).

## Authority model

`settle_match` requires the program-authority signer (a single keypair held by the match-server fleet). The authority is verified server-side. Compromise of that key would let an attacker drain settled pots, so it gets KMS / multisig protection in production.

## Build / deploy (when ready)

```bash
cd game/programs/escrow
anchor build
anchor deploy --provider.cluster devnet
anchor test --skip-deploy
```

## Status

**Scaffold only.** Devnet-deployable but not audited. Don't put real SOL through this until audit (~$5-15K, recommended at Phase 3 launch).

For Phase 3 MVP, default to **devnet** + paper-SOL test rounds. Mainnet flip after audit.
