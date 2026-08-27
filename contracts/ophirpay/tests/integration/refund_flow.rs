// SPDX-License-Identifier: MIT
#![cfg(test)]

use super::TestFixture;
use ophirpay_contract::{PaymentError, RefundReasonCode, RefundStatus};
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Address, String};

#[test]
fn test_refund_lifecycle_approval_and_processing() {
    let fix = TestFixture::new();
    let payer = Address::generate(&fix.env);
    let payee = Address::generate(&fix.env);

    // Record initial payment
    let tx_hash = String::from_str(&fix.env, "0xpayment_for_refund");
    let meta = String::from_str(&fix.env, "order_#5501");
    let payment_id = fix.client.record_payment(
        &payer,
        &payee,
        &2_000_000i128,
        &fix.token_id,
        &tx_hash,
        &meta,
    );

    // Requester (payer) requests refund
    let reason = String::from_str(&fix.env, "Item defective upon delivery");
    let refund_id = fix.client.request_refund(
        &payer,
        &payment_id,
        &2_000_000i128,
        &fix.token_id,
        &reason,
        &RefundReasonCode::ProductDefect,
    );
    assert_eq!(refund_id, 1);
    assert_eq!(fix.client.get_refund_count(), 1);

    // Inspect initial refund state
    let refund = fix.client.get_refund(&1);
    assert_eq!(refund.id, 1);
    assert_eq!(refund.payment_id, payment_id);
    assert_eq!(refund.requester, payer);
    assert_eq!(refund.amount, 2_000_000);
    assert_eq!(refund.reason_code, RefundReasonCode::ProductDefect);
    assert_eq!(refund.status, RefundStatus::Requested);

    // Owner approves refund
    fix.client.approve_refund(&fix.owner, &refund_id);
    let approved_refund = fix.client.get_refund(&1);
    assert_eq!(approved_refund.status, RefundStatus::Approved);
    assert!(approved_refund.resolved_at > 0);

    // Fund contract so it has tokens to disburse
    fix.mint(&fix.contract_id, 5_000_000);

    // Owner processes refund (token payout)
    let payer_bal_before = fix.token_client.balance(&payer);
    fix.client.process_refund(&fix.owner, &refund_id);
    let payer_bal_after = fix.token_client.balance(&payer);
    assert_eq!(payer_bal_after - payer_bal_before, 2_000_000);

    let processed_refund = fix.client.get_refund(&1);
    assert_eq!(processed_refund.status, RefundStatus::Processed);

    // Reprocessing fails
    let res = fix.client.try_process_refund(&fix.owner, &refund_id);
    assert!(res.is_err());
    assert_eq!(
        res.err().unwrap().unwrap(),
        PaymentError::RefundAlreadyProcessed
    );
}

#[test]
fn test_refund_rejection_and_guards() {
    let fix = TestFixture::new();
    let payer = Address::generate(&fix.env);
    let payee = Address::generate(&fix.env);
    let stranger = Address::generate(&fix.env);

    let tx_hash = String::from_str(&fix.env, "0xguard_payment");
    let meta = String::from_str(&fix.env, "order_#5502");
    let payment_id = fix.client.record_payment(
        &payer,
        &payee,
        &1_000_000i128,
        &fix.token_id,
        &tx_hash,
        &meta,
    );

    // Stranger cannot request refund
    let reason = String::from_str(&fix.env, "I want free money");
    let res = fix.client.try_request_refund(
        &stranger,
        &payment_id,
        &1_000_000i128,
        &fix.token_id,
        &reason,
        &RefundReasonCode::Other,
    );
    assert!(res.is_err());
    assert_eq!(res.err().unwrap().unwrap(), PaymentError::Unauthorized);

    // Amount exceeding payment amount fails
    let res = fix.client.try_request_refund(
        &payer,
        &payment_id,
        &2_000_000i128,
        &fix.token_id,
        &reason,
        &RefundReasonCode::ProductDefect,
    );
    assert!(res.is_err());
    assert_eq!(res.err().unwrap().unwrap(), PaymentError::InvalidAmount);

    // Payee requests valid refund
    let valid_reason = String::from_str(&fix.env, "Duplicate charge");
    let refund_id = fix.client.request_refund(
        &payee,
        &payment_id,
        &1_000_000i128,
        &fix.token_id,
        &valid_reason,
        &RefundReasonCode::DuplicateCharge,
    );

    // Owner rejects refund
    fix.client.reject_refund(&fix.owner, &refund_id);
    let rejected = fix.client.get_refund(&refund_id);
    assert_eq!(rejected.status, RefundStatus::Rejected);

    // Processing a rejected refund fails
    let res = fix.client.try_process_refund(&fix.owner, &refund_id);
    assert!(res.is_err());
    assert_eq!(
        res.err().unwrap().unwrap(),
        PaymentError::RefundAlreadyProcessed
    );
}

#[test]
fn test_refund_reason_code_analytics() {
    let fix = TestFixture::new();
    let payer = Address::generate(&fix.env);
    let payee = Address::generate(&fix.env);

    let tx_hash = String::from_str(&fix.env, "0xanalytics_payment");
    let meta = String::from_str(&fix.env, "analytics");
    let pid = fix.client.record_payment(
        &payer,
        &payee,
        &10_000_000i128,
        &fix.token_id,
        &tx_hash,
        &meta,
    );

    // Create refunds with various reason codes
    let codes = [
        RefundReasonCode::ProductDefect,
        RefundReasonCode::ProductDefect,
        RefundReasonCode::NonDelivery,
        RefundReasonCode::DuplicateCharge,
        RefundReasonCode::Unauthorized,
        RefundReasonCode::CustomerRequest,
        RefundReasonCode::Other,
    ];

    for code in codes.iter() {
        let reason_str = String::from_str(&fix.env, "reason");
        fix.client
            .request_refund(&payer, &pid, &100_000i128, &fix.token_id, &reason_str, code);
    }

    let analytics = fix.client.get_reason_code_analytics();
    // 6 distinct reason codes
    assert_eq!(analytics.len(), 6);
    // ProductDefect (code 0) has 2 occurrences
    assert_eq!(analytics.get(0).unwrap().1, 2);
    // NonDelivery (code 1) has 1 occurrence
    assert_eq!(analytics.get(1).unwrap().1, 1);
    // DuplicateCharge (code 2) has 1 occurrence
    assert_eq!(analytics.get(2).unwrap().1, 1);
}
