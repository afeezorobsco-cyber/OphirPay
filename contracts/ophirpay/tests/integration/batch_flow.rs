// SPDX-License-Identifier: MIT
#![cfg(test)]

use super::TestFixture;
use ophirpay_contract::PaymentError;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Address, String, Vec};

#[test]
fn test_batch_payment_happy_path() {
    let fix = TestFixture::new();
    let creator = Address::generate(&fix.env);

    let p1 = Address::generate(&fix.env);
    let p2 = Address::generate(&fix.env);
    let p3 = Address::generate(&fix.env);
    let p4 = Address::generate(&fix.env);

    let mut payees = Vec::new(&fix.env);
    payees.push_back(p1.clone());
    payees.push_back(p2.clone());
    payees.push_back(p3.clone());
    payees.push_back(p4.clone());

    let mut amounts = Vec::new(&fix.env);
    amounts.push_back(100_000i128);
    amounts.push_back(250_000i128);
    amounts.push_back(500_000i128);
    amounts.push_back(150_000i128);

    let tx_hash = String::from_str(&fix.env, "0xbatch_tx_hash_123");
    let result = fix.client.create_batch(
        &creator,
        &payees,
        &amounts,
        &fix.token_id,
        &tx_hash,
    );

    assert_eq!(result.batch_id, 1);
    assert_eq!(result.total_requests, 4);
    assert_eq!(result.successful, 4);
    assert_eq!(result.failed, 0);
    assert_eq!(result.total_amount, 1_000_000);

    // Verify batch count & stats
    assert_eq!(fix.client.get_batch_count(), 1);
    let stats = fix.client.get_stats();
    assert_eq!(stats.total_batches_processed, 1);
    assert_eq!(stats.total_amount_batched, 1_000_000);
    assert_eq!(stats.total_payments_recorded, 4);

    // Verify batch structure
    let batch = fix.client.get_batch(&1);
    assert_eq!(batch.id, 1);
    assert_eq!(batch.creator, creator);
    assert_eq!(batch.total_recipients, 4);
    assert_eq!(batch.total_amount, 1_000_000);
    assert_eq!(batch.payment_ids.len(), 4);

    // Verify payments by batch
    let batch_payments = fix.client.get_payments_by_batch(&1);
    assert_eq!(batch_payments.len(), 4);
    assert_eq!(batch_payments.get(0).unwrap().payee, p1);
    assert_eq!(batch_payments.get(0).unwrap().amount, 100_000);
    assert_eq!(batch_payments.get(3).unwrap().payee, p4);
    assert_eq!(batch_payments.get(3).unwrap().amount, 150_000);
}

#[test]
fn test_batch_payment_partial_failure_handling() {
    let fix = TestFixture::new();
    let creator = Address::generate(&fix.env);

    let p1 = Address::generate(&fix.env);
    let p2 = Address::generate(&fix.env);
    let p3 = Address::generate(&fix.env);

    let mut payees = Vec::new(&fix.env);
    payees.push_back(p1.clone());
    payees.push_back(p2.clone());
    payees.push_back(p3.clone());

    // Amount 2 is 0 (invalid), Amount 1 and 3 are valid
    let mut amounts = Vec::new(&fix.env);
    amounts.push_back(500_000i128);
    amounts.push_back(0i128);
    amounts.push_back(300_000i128);

    let tx_hash = String::from_str(&fix.env, "0xpartial_batch");
    let result = fix.client.create_batch(
        &creator,
        &payees,
        &amounts,
        &fix.token_id,
        &tx_hash,
    );

    assert_eq!(result.batch_id, 1);
    assert_eq!(result.total_requests, 3);
    assert_eq!(result.successful, 2);
    assert_eq!(result.failed, 1);
    assert_eq!(result.total_amount, 800_000);

    let batch = fix.client.get_batch(&1);
    assert_eq!(batch.total_recipients, 2);
    assert_eq!(batch.payment_ids.len(), 2);
}

#[test]
fn test_batch_empty_and_overflow_errors() {
    let fix = TestFixture::new();
    let creator = Address::generate(&fix.env);

    // Empty payees
    let empty_payees = Vec::new(&fix.env);
    let empty_amounts = Vec::new(&fix.env);
    let tx_hash = String::from_str(&fix.env, "0xempty");

    assert_eq!(
        fix.client.try_create_batch(
            &creator,
            &empty_payees,
            &empty_amounts,
            &fix.token_id,
            &tx_hash,
        ),
        Err(Ok(PaymentError::BatchEmpty))
    );

    // All zero amounts
    let mut payees = Vec::new(&fix.env);
    payees.push_back(Address::generate(&fix.env));
    let mut zero_amounts = Vec::new(&fix.env);
    zero_amounts.push_back(0i128);

    assert_eq!(
        fix.client.try_create_batch(
            &creator,
            &payees,
            &zero_amounts,
            &fix.token_id,
            &tx_hash,
        ),
        Err(Ok(PaymentError::BatchEmpty))
    );
}
