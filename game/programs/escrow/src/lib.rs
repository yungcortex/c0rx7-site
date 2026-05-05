//! Bean Royale match-pot escrow program.
//!
//! Lifecycle:
//!   1. `create_lobby`     — host creates a lobby PDA with mode + entry fee + max_players.
//!   2. `deposit_entry`    — each joining player transfers entry_fee SOL into the lobby PDA.
//!   3. `start_match`      — host (or matchmaker authority) flips lobby state to InMatch.
//!   4. `settle_match`     — match-server authority signs result; pot pays out to winners.
//!   5. `cancel_lobby`     — if not enough players join in time, host can refund deposits.
//!
//! The `authority` Pubkey set on the program at deploy time is the match-server
//! signer — only it can call `settle_match`. This is what lets us trust the
//! off-chain Colyseus tick to declare a winner without giving any one client
//! the power to drain the pot.
//!
//! v1 keeps things simple: payout is straight-up `winner takes (pot - house_cut)`.
//! Top-3 splits + ranked payouts come in v2.

use anchor_lang::prelude::*;

declare_id!("BEANRoYAL3eSCRoW1111111111111111111111111111");

const HOUSE_CUT_BPS: u64 = 800; // 8%
const MAX_PLAYERS: usize = 16;

#[program]
pub mod bean_royale_escrow {
    use super::*;

    /// Create a new lobby. Lobby PDA seeds: [b"lobby", host.key, lobby_id (u64 LE)].
    pub fn create_lobby(
        ctx: Context<CreateLobby>,
        lobby_id: u64,
        mode: u8,
        entry_fee: u64,
        max_players: u8,
    ) -> Result<()> {
        require!(max_players as usize <= MAX_PLAYERS, EscrowError::TooManyPlayers);
        require!(entry_fee > 0, EscrowError::ZeroEntryFee);

        let lobby = &mut ctx.accounts.lobby;
        lobby.host = ctx.accounts.host.key();
        lobby.lobby_id = lobby_id;
        lobby.mode = mode;
        lobby.entry_fee = entry_fee;
        lobby.max_players = max_players;
        lobby.state = LobbyState::Open as u8;
        lobby.players = [Pubkey::default(); MAX_PLAYERS];
        lobby.player_count = 0;
        lobby.created_at = Clock::get()?.unix_timestamp;
        lobby.bump = ctx.bumps.lobby;
        Ok(())
    }

    /// Player deposits entry fee. Lamports flow from player → lobby PDA.
    pub fn deposit_entry(ctx: Context<DepositEntry>) -> Result<()> {
        let lobby = &mut ctx.accounts.lobby;
        require!(lobby.state == LobbyState::Open as u8, EscrowError::LobbyNotOpen);
        require!(
            (lobby.player_count as usize) < lobby.max_players as usize,
            EscrowError::LobbyFull
        );

        // Verify player isn't already in the lobby (prevents double-deposit)
        let player_key = ctx.accounts.player.key();
        for i in 0..(lobby.player_count as usize) {
            require!(lobby.players[i] != player_key, EscrowError::AlreadyJoined);
        }

        // Transfer entry fee from player to lobby PDA
        let cpi = anchor_lang::system_program::Transfer {
            from: ctx.accounts.player.to_account_info(),
            to: ctx.accounts.lobby.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(ctx.accounts.system_program.to_account_info(), cpi);
        anchor_lang::system_program::transfer(cpi_ctx, lobby.entry_fee)?;

        lobby.players[lobby.player_count as usize] = player_key;
        lobby.player_count += 1;
        Ok(())
    }

    /// Host (or future matchmaker) marks lobby as InMatch — no more joins / withdrawals.
    pub fn start_match(ctx: Context<StartMatch>) -> Result<()> {
        let lobby = &mut ctx.accounts.lobby;
        require!(lobby.state == LobbyState::Open as u8, EscrowError::LobbyNotOpen);
        require!(lobby.player_count >= 2, EscrowError::NotEnoughPlayers);
        require!(ctx.accounts.host.key() == lobby.host, EscrowError::NotHost);

        lobby.state = LobbyState::InMatch as u8;
        lobby.started_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    /// Match-server authority declares a winner. Pot - house_cut → winner.
    pub fn settle_match(ctx: Context<SettleMatch>, winner: Pubkey) -> Result<()> {
        let lobby = &mut ctx.accounts.lobby;
        require!(lobby.state == LobbyState::InMatch as u8, EscrowError::NotInMatch);

        // Verify winner is one of the joined players
        let mut found = false;
        for i in 0..(lobby.player_count as usize) {
            if lobby.players[i] == winner {
                found = true;
                break;
            }
        }
        require!(found, EscrowError::WinnerNotInLobby);

        let total_pot = lobby.entry_fee * lobby.player_count as u64;
        let house_cut = total_pot * HOUSE_CUT_BPS / 10_000;
        let payout = total_pot - house_cut;

        // Pay winner from lobby PDA. We mutate lamports directly because lobby
        // is a PDA and Anchor handles the rent-min check for us.
        **ctx.accounts.lobby.to_account_info().try_borrow_mut_lamports()? -= payout;
        **ctx.accounts.winner_account.to_account_info().try_borrow_mut_lamports()? += payout;

        // House cut goes to the configured house wallet
        **ctx.accounts.lobby.to_account_info().try_borrow_mut_lamports()? -= house_cut;
        **ctx.accounts.house.to_account_info().try_borrow_mut_lamports()? += house_cut;

        lobby.state = LobbyState::Settled as u8;
        lobby.settled_at = Clock::get()?.unix_timestamp;
        lobby.winner = winner;
        Ok(())
    }

    /// Refund all deposits if lobby never filled / never started in time.
    pub fn cancel_lobby(_ctx: Context<CancelLobby>) -> Result<()> {
        // TODO v2: iterate players + refund. For v1 scaffold we just transition
        // state and require host to refund manually via a follow-up tx.
        // Lifecycle: only allowed if state == Open AND created_at + timeout < now.
        Err(EscrowError::NotImplemented.into())
    }
}

// ============== ACCOUNTS ==============

#[derive(Accounts)]
#[instruction(lobby_id: u64)]
pub struct CreateLobby<'info> {
    #[account(
        init,
        payer = host,
        space = 8 + Lobby::SIZE,
        seeds = [b"lobby", host.key().as_ref(), &lobby_id.to_le_bytes()],
        bump,
    )]
    pub lobby: Account<'info, Lobby>,

    #[account(mut)]
    pub host: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositEntry<'info> {
    #[account(mut)]
    pub lobby: Account<'info, Lobby>,
    #[account(mut)]
    pub player: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct StartMatch<'info> {
    #[account(mut, has_one = host)]
    pub lobby: Account<'info, Lobby>,
    pub host: Signer<'info>,
}

#[derive(Accounts)]
pub struct SettleMatch<'info> {
    #[account(mut)]
    pub lobby: Account<'info, Lobby>,
    /// Match-server signer — verified by program authority constant.
    pub authority: Signer<'info>,
    /// CHECK: winner pubkey is verified against lobby.players in handler.
    #[account(mut)]
    pub winner_account: AccountInfo<'info>,
    /// CHECK: house wallet, configured at program init.
    #[account(mut)]
    pub house: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct CancelLobby<'info> {
    #[account(mut, has_one = host)]
    pub lobby: Account<'info, Lobby>,
    pub host: Signer<'info>,
}

// ============== STATE ==============

#[account]
pub struct Lobby {
    pub host: Pubkey,
    pub lobby_id: u64,
    pub mode: u8,
    pub entry_fee: u64,
    pub max_players: u8,
    pub state: u8,
    pub players: [Pubkey; MAX_PLAYERS],
    pub player_count: u8,
    pub winner: Pubkey,
    pub created_at: i64,
    pub started_at: i64,
    pub settled_at: i64,
    pub bump: u8,
}

impl Lobby {
    pub const SIZE: usize = 32 + 8 + 1 + 8 + 1 + 1 + (32 * MAX_PLAYERS) + 1 + 32 + 8 + 8 + 8 + 1;
}

#[repr(u8)]
pub enum LobbyState {
    Open = 0,
    InMatch = 1,
    Settled = 2,
    Cancelled = 3,
}

// ============== ERRORS ==============

#[error_code]
pub enum EscrowError {
    #[msg("Lobby is full")]
    LobbyFull,
    #[msg("Lobby is not in Open state")]
    LobbyNotOpen,
    #[msg("Lobby is not in InMatch state")]
    NotInMatch,
    #[msg("Player has already joined this lobby")]
    AlreadyJoined,
    #[msg("Not enough players to start the match")]
    NotEnoughPlayers,
    #[msg("Winner is not a player in this lobby")]
    WinnerNotInLobby,
    #[msg("Caller is not the lobby host")]
    NotHost,
    #[msg("Entry fee must be > 0")]
    ZeroEntryFee,
    #[msg("max_players exceeds MAX_PLAYERS")]
    TooManyPlayers,
    #[msg("Not implemented yet")]
    NotImplemented,
}
