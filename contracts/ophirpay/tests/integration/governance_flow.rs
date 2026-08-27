// SPDX-License-Identifier: MIT
#![cfg(test)]

use super::TestFixture;
use ophirpay_contract::PaymentError;
use soroban_sdk::testutils::{Address as _, Ledger as _};
use soroban_sdk::{Address, String};

#[test]
fn test_governance_proposal_passing_flow() {
    let fix = TestFixture::new();
    let proposer = Address::generate(&fix.env);
    let voter_1 = Address::generate(&fix.env);
    let voter_2 = Address::generate(&fix.env);
    let voter_3 = Address::generate(&fix.env);

    // 1. Configure governance
    fix.client.configure_governance(
        &fix.owner,
        &500_000i128, // min proposal deposit: 500k
        &86400u64,    // voting period: 24 hours
        &5000u32,     // quorum: 50%
        &true,
    );

    let config = fix.client.get_governance_config().unwrap();
    assert_eq!(config.min_proposal_deposit, 500_000);
    assert_eq!(config.voting_period, 86400);
    assert_eq!(config.enabled, true);

    // 2. Fund proposer with deposit tokens
    fix.mint(&proposer, 1_000_000);

    // 3. Propose action
    let title = String::from_str(&fix.env, "Update Fee Config");
    let desc = String::from_str(&fix.env, "Reduce payment fees by 10 bps");
    let action_type = String::from_str(&fix.env, "set_fee_config");
    let target = String::from_str(&fix.env, "fee_manager");
    let data = String::from_str(&fix.env, "{\"payment_fee_bps\":15}");

    let proposal_id = fix.client.create_proposal(
        &proposer,
        &title,
        &desc,
        &action_type,
        &target,
        &data,
        &fix.token_id,
        &500_000i128,
    );
    assert_eq!(proposal_id, 1);
    assert_eq!(fix.client.get_proposal_count(), 1);

    // Proposer balance decreased by deposit
    assert_eq!(fix.token_client.balance(&proposer), 500_000);

    let proposal = fix.client.get_proposal(&1);
    assert_eq!(proposal.title, title);
    assert_eq!(proposal.yes_votes, 0);
    assert_eq!(proposal.no_votes, 0);
    assert_eq!(proposal.executed, false);

    // 4. Voters cast votes
    fix.client.vote_on_proposal(&voter_1, &1, &true);
    fix.client.vote_on_proposal(&voter_2, &1, &true);
    fix.client.vote_on_proposal(&voter_3, &1, &false);

    // Duplicate vote attempt fails
    let res = fix.client.try_vote_on_proposal(&voter_1, &1, &true);
    assert!(res.is_err());
    assert_eq!(res.err().unwrap().unwrap(), PaymentError::AlreadyVoted);

    let proposal_after_votes = fix.client.get_proposal(&1);
    assert_eq!(proposal_after_votes.yes_votes, 2);
    assert_eq!(proposal_after_votes.no_votes, 1);

    // 5. Early execution fails before voting period ends
    let res = fix.client.try_execute_proposal(&1);
    assert!(res.is_err());
    assert_eq!(res.err().unwrap().unwrap(), PaymentError::VotingPeriodEnded);

    // 6. Fast-forward time past voting period (24h + 1s)
    fix.env
        .ledger()
        .set_timestamp(fix.env.ledger().timestamp() + 86401);

    // 7. Execute proposal
    let passed = fix.client.execute_proposal(&1);
    assert_eq!(passed, true);

    // Verify proposal marked executed
    let proposal_final = fix.client.get_proposal(&1);
    assert_eq!(proposal_final.executed, true);

    // Verify deposit refunded to proposer
    assert_eq!(fix.token_client.balance(&proposer), 1_000_000);

    // Double execution fails
    let res = fix.client.try_execute_proposal(&1);
    assert!(res.is_err());
    assert_eq!(
        res.err().unwrap().unwrap(),
        PaymentError::ProposalAlreadyExecuted
    );
}

#[test]
fn test_governance_proposal_defeated_flow() {
    let fix = TestFixture::new();
    let proposer = Address::generate(&fix.env);
    let voter_1 = Address::generate(&fix.env);
    let voter_2 = Address::generate(&fix.env);

    fix.client
        .configure_governance(&fix.owner, &100_000i128, &3600u64, &1000u32, &true);

    fix.mint(&proposer, 200_000);

    let title = String::from_str(&fix.env, "Defeated Prop");
    let desc = String::from_str(&fix.env, "This should fail");
    let action_type = String::from_str(&fix.env, "test");
    let target = String::from_str(&fix.env, "test");
    let data = String::from_str(&fix.env, "{}");

    let pid = fix.client.create_proposal(
        &proposer,
        &title,
        &desc,
        &action_type,
        &target,
        &data,
        &fix.token_id,
        &100_000i128,
    );

    // Vote no
    fix.client.vote_on_proposal(&voter_1, &pid, &false);
    fix.client.vote_on_proposal(&voter_2, &pid, &false);

    fix.env
        .ledger()
        .set_timestamp(fix.env.ledger().timestamp() + 3601);

    // Defeated proposal returns false
    let passed = fix.client.execute_proposal(&pid);
    assert_eq!(passed, false);

    // Proposer deposit is still refunded
    assert_eq!(fix.token_client.balance(&proposer), 200_000);
}
