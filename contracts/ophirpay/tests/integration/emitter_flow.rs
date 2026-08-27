// SPDX-License-Identifier: MIT
#![cfg(test)]

use super::TestFixture;
use ophirpay_emitter::EmitterError;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Address, String};

#[test]
fn test_cross_contract_emitter_linking_and_events() {
    let fix = TestFixture::new();
    let (emitter_id, emitter_client) = fix.setup_emitter();

    // Link emitter to OphirPay contract
    fix.client.set_emitter(&fix.owner, &emitter_id);
    assert_eq!(fix.client.get_emitter(), Some(emitter_id.clone()));

    // Set allow-list on emitter to only accept OphirPay
    emitter_client.set_allowed_source(&fix.owner, &Some(fix.contract_id.clone()));
    assert_eq!(
        emitter_client.get_allowed_source(),
        Some(fix.contract_id.clone())
    );

    // Emit event directly from owner (allowed by owner bypass)
    let payer = Address::generate(&fix.env);
    let payee = Address::generate(&fix.env);
    let source = String::from_str(&fix.env, "OphirPay");
    let tx_hash = String::from_str(&fix.env, "0xemit_1");

    let event_id =
        emitter_client.emit_payment(&fix.owner, &source, &payer, &payee, &500_000i128, &tx_hash);
    assert_eq!(event_id, 1);
    assert_eq!(emitter_client.get_event_count(), 1);

    let evt = emitter_client.get_event(&1);
    assert_eq!(evt.payer, payer);
    assert_eq!(evt.payee, payee);
    assert_eq!(evt.amount, 500_000);
}

#[test]
fn test_cross_contract_emergency_pause_orchestration() {
    let fix = TestFixture::new();
    let (emitter_id, emitter_client) = fix.setup_emitter();

    fix.client.set_emitter(&fix.owner, &emitter_id);

    // Initial state: unpaused
    assert_eq!(fix.client.is_paused(), false);
    assert_eq!(emitter_client.is_paused(), false);

    // Emergency pause all
    fix.client.emergency_pause_all(&fix.owner);
    assert_eq!(fix.client.is_paused(), true);
    assert_eq!(emitter_client.is_paused(), true);

    // Attempting to emit on paused emitter fails
    let payer = Address::generate(&fix.env);
    let payee = Address::generate(&fix.env);
    let source = String::from_str(&fix.env, "OphirPay");
    let tx_hash = String::from_str(&fix.env, "0xpaused_emit");

    let res =
        emitter_client.try_emit_payment(&fix.owner, &source, &payer, &payee, &100i128, &tx_hash);
    assert!(res.is_err());
    assert_eq!(res.err().unwrap().unwrap(), EmitterError::ContractPaused);

    // Emergency unpause all
    fix.client.emergency_unpause_all(&fix.owner);
    assert_eq!(fix.client.is_paused(), false);
    assert_eq!(emitter_client.is_paused(), false);

    // Emitting succeeds again
    let evt_id =
        emitter_client.emit_payment(&fix.owner, &source, &payer, &payee, &100i128, &tx_hash);
    assert_eq!(evt_id, 1);
}
