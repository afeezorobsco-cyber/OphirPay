// SPDX-License-Identifier: MIT
#![cfg(test)]

use super::TestFixture;
use ophirpay_contract::PaymentError;
use soroban_sdk::testutils::{Address as _, Ledger as _};
use soroban_sdk::{Address, String};

#[test]
fn test_payment_recording_and_retrieval_flow() {
    let fix = TestFixture::new();
    let payer = Address::generate(&fix.env);
    let payee = Address::generate(&fix.env);

    // Initial stats should be 0
    assert_eq!(fix.client.get_payment_count(), 0);
    let stats = fix.client.get_stats();
    assert_eq!(stats.total_payments_recorded, 0);

    // Record first payment
    let tx_hash_1 = String::from_str(&fix.env, "0x1234abcd5678");
    let meta_1 = String::from_str(&fix.env, "invoice_#1001");
    let id_1 = fix.client.record_payment(
        &payer,
        &payee,
        &5_000_000i128,
        &fix.token_id,
        &tx_hash_1,
        &meta_1,
    );
    assert_eq!(id_1, 1);

    // Record second payment
    let tx_hash_2 = String::from_str(&fix.env, "0x9876fedcba32");
    let meta_2 = String::from_str(&fix.env, "invoice_#1002");
    let id_2 = fix.client.record_payment(
        &payer,
        &payee,
        &12_500_000i128,
        &fix.token_id,
        &tx_hash_2,
        &meta_2,
    );
    assert_eq!(id_2, 2);

    // Verify payment count & stats
    assert_eq!(fix.client.get_payment_count(), 2);
    let stats_after = fix.client.get_stats();
    assert_eq!(stats_after.total_payments_recorded, 2);

    // Fetch and assert payment details
    let payment_1 = fix.client.get_payment(&1);
    assert_eq!(payment_1.id, 1);
    assert_eq!(payment_1.payer, payer);
    assert_eq!(payment_1.payee, payee);
    assert_eq!(payment_1.amount, 5_000_000);
    assert_eq!(payment_1.asset, fix.token_id);
    assert_eq!(payment_1.tx_hash, tx_hash_1);
    assert_eq!(payment_1.metadata, meta_1);
    assert_eq!(payment_1.cancelled, false);
    assert_eq!(payment_1.timestamp, 1_000_000);

    let payment_2 = fix.client.get_payment(&2);
    assert_eq!(payment_2.id, 2);
    assert_eq!(payment_2.amount, 12_500_000);

    // Range retrieval
    let range = fix.client.get_payments_range(&1, &2);
    assert_eq!(range.len(), 2);
}

#[test]
fn test_payment_cancellation_lifecycle() {
    let fix = TestFixture::new();
    let payer = Address::generate(&fix.env);
    let payee = Address::generate(&fix.env);
    let stranger = Address::generate(&fix.env);

    let tx_hash = String::from_str(&fix.env, "0xhash");
    let meta = String::from_str(&fix.env, "cancel_test");
    let pid = fix.client.record_payment(
        &payer,
        &payee,
        &1_000_000i128,
        &fix.token_id,
        &tx_hash,
        &meta,
    );

    // Stranger cannot cancel payment
    let res = fix.client.try_cancel_payment(&stranger, &pid);
    assert!(res.is_err());
    assert_eq!(res.err().unwrap().unwrap(), PaymentError::Unauthorized);

    // Owner cancels payment successfully
    fix.client.cancel_payment(&fix.owner, &pid);
    let payment = fix.client.get_payment(&pid);
    assert_eq!(payment.cancelled, true);

    // Duplicate cancellation fails
    let res = fix.client.try_cancel_payment(&fix.owner, &pid);
    assert!(res.is_err());
    assert_eq!(
        res.err().unwrap().unwrap(),
        PaymentError::PaymentAlreadyCancelled
    );
}

#[test]
fn test_atomic_spend_with_limits_and_rbac() {
    let fix = TestFixture::new();
    let payer = Address::generate(&fix.env);
    let payee = Address::generate(&fix.env);

    // Set daily limit: 10_000_000, monthly limit: 50_000_000
    let expires_at = fix.env.ledger().timestamp() + 86400 * 7;
    fix.client.set_spending_limit(
        &fix.owner,
        &payer,
        &10_000_000i128,
        &50_000_000i128,
        &expires_at,
        &true,
    );

    // Spend within limit
    let tx1 = String::from_str(&fix.env, "0xspend1");
    let meta1 = String::from_str(&fix.env, "spend 1");
    let pid1 = fix
        .client
        .atomic_spend(&payer, &payee, &6_000_000i128, &fix.token_id, &tx1, &meta1);
    assert_eq!(pid1, 1);

    // Second spend exceeding daily limit fails
    let tx2 = String::from_str(&fix.env, "0xspend2");
    let meta2 = String::from_str(&fix.env, "spend 2");
    let res =
        fix.client
            .try_atomic_spend(&payer, &payee, &5_000_000i128, &fix.token_id, &tx2, &meta2);
    assert!(res.is_err());
    assert_eq!(
        res.err().unwrap().unwrap(),
        PaymentError::SpendingLimitExpired
    );

    // Fast-forward 1 day: daily spend resets, spend succeeds
    fix.env
        .ledger()
        .set_timestamp(fix.env.ledger().timestamp() + 86401);
    let pid2 = fix
        .client
        .atomic_spend(&payer, &payee, &4_000_000i128, &fix.token_id, &tx2, &meta2);
    assert_eq!(pid2, 2);

    // Verify audit logs recorded both atomic spend actions
    let audit_count = fix.client.get_audit_log_count();
    assert!(audit_count >= 2);
}

#[test]
fn test_paused_contract_blocks_payments() {
    let fix = TestFixture::new();
    let payer = Address::generate(&fix.env);
    let payee = Address::generate(&fix.env);

    // Pause contract
    fix.client.emergency_pause_all(&fix.owner);
    assert_eq!(fix.client.is_paused(), true);

    let tx = String::from_str(&fix.env, "0xpaused");
    let meta = String::from_str(&fix.env, "meta");
    let res = fix
        .client
        .try_record_payment(&payer, &payee, &100i128, &fix.token_id, &tx, &meta);
    assert!(res.is_err());
    assert_eq!(res.err().unwrap().unwrap(), PaymentError::ContractPaused);

    // Unpause contract
    fix.client.emergency_unpause_all(&fix.owner);
    assert_eq!(fix.client.is_paused(), false);

    let pid = fix
        .client
        .record_payment(&payer, &payee, &100i128, &fix.token_id, &tx, &meta);
    assert_eq!(pid, 1);
}
