// SPDX-License-Identifier: MIT
#![cfg(test)]

pub mod batch_flow;
pub mod emitter_flow;
pub mod governance_flow;
pub mod payment_flow;
pub mod refund_flow;

use ophirpay_contract::{OphirPayContract, OphirPayContractClient};
use ophirpay_emitter::{PaymentEventEmitter, PaymentEventEmitterClient};
use soroban_sdk::testutils::{Address as _, Ledger as _};
use soroban_sdk::{token, Address, Env};

#[allow(dead_code)]
pub struct TestFixture<'a> {
    pub env: Env,
    pub contract_id: Address,
    pub client: OphirPayContractClient<'a>,
    pub owner: Address,
    pub token_admin: Address,
    pub token_id: Address,
    pub token_client: token::Client<'a>,
    pub token_admin_client: token::StellarAssetClient<'a>,
}

impl<'a> TestFixture<'a> {
    pub fn new() -> Self {
        let env = Env::default();
        env.mock_all_auths();
        env.ledger().set_timestamp(1_000_000);

        let owner = Address::generate(&env);
        let token_admin = Address::generate(&env);

        let token_id = env.register_stellar_asset_contract(token_admin.clone());
        let token_client = token::Client::new(&env, &token_id);
        let token_admin_client = token::StellarAssetClient::new(&env, &token_id);

        let contract_id = env.register(OphirPayContract, ());
        let client = OphirPayContractClient::new(&env, &contract_id);
        client.init(&owner);

        TestFixture {
            env,
            contract_id,
            client,
            owner,
            token_admin,
            token_id,
            token_client,
            token_admin_client,
        }
    }

    pub fn setup_emitter(&self) -> (Address, PaymentEventEmitterClient<'_>) {
        let emitter_id = self.env.register(PaymentEventEmitter, ());
        let emitter_client = PaymentEventEmitterClient::new(&self.env, &emitter_id);
        emitter_client.init(&self.owner);
        (emitter_id, emitter_client)
    }

    pub fn mint(&self, to: &Address, amount: i128) {
        self.token_admin_client.mint(to, &amount);
    }
}
