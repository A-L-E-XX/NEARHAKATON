//! Phishbowl vault factory.
//!
//! Anyone with a NEAR wallet can ask for a vault. The factory creates two
//! sub-accounts of itself in one go:
//!
//! - `<name>.<factory>`: the vault. It runs the Phishbowl vault code, which is
//!   published once as a NEAR global contract, so each new vault only pays for
//!   its own data. The caller becomes the owner.
//! - `<name>-agent.<factory>`: the agent's account. Its only key is a
//!   function-call key that can call `propose_payment`, `report_scam` and
//!   `freeze` on that vault, nothing else. The key is either the caller's own
//!   agent key or the demo agent's key (Phishbowl then runs a demo agent and
//!   scam drills on the vault, so a new user can try everything).
//!
//! The factory pays for each wallet's first vault from its own balance, so a new
//! user only needs a little NEAR for gas. Further vaults are paid by the caller.
//! It also remembers which wallet owns which vault, so the dashboard can show a
//! user their vaults as soon as they connect.

use near_sdk::json_types::Base58CryptoHash;
use near_sdk::serde_json::{self, json, Value};
use near_sdk::store::{LookupMap, LookupSet, Vector};
use near_sdk::{
    env, near, require, AccountId, Allowance, BorshStorageKey, Gas, NearToken, PanicOnDefault, Promise,
    PromiseResult, PublicKey,
};

#[cfg(test)]
mod tests;

const AGENT_METHODS: &str = "propose_payment,report_scam,freeze";
const GAS_FOR_INIT: Gas = Gas::from_tgas(30);
const GAS_FOR_CALLBACK: Gas = Gas::from_tgas(15);
/// Gas the agent's key may burn before the owner has to top it up.
const AGENT_KEY_ALLOWANCE: NearToken = NearToken::from_millinear(250);
/// Kept back so the factory can always pay for its own storage.
const FACTORY_RESERVE: NearToken = NearToken::from_near(2);
const MIN_NAME_LEN: usize = 2;
const MAX_NAME_LEN: usize = 32;
const MAX_VAULTS_PER_OWNER: usize = 10;

#[near]
#[derive(BorshStorageKey)]
enum StorageKey {
    VaultsByOwner,
    AllVaults,
    Sponsored,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct Config {
    pub admin_id: AccountId,
    /// Hash of the vault code published as a global contract.
    pub vault_code_hash: Base58CryptoHash,
    /// Runs scam drills on every vault the factory makes.
    pub drill_operator_id: AccountId,
    /// Key of the demo agent Phishbowl runs for users who don't bring one.
    pub demo_agent_key: PublicKey,
    /// NEAR each new vault starts with: storage plus money the agent can ask to spend.
    pub vault_funding: NearToken,
    /// NEAR each new agent account starts with, mostly for its key's gas allowance.
    pub agent_funding: NearToken,
}

#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq)]
pub struct CreateResult {
    pub vault_id: AccountId,
    pub agent_id: AccountId,
    pub vault_created: bool,
    pub agent_created: bool,
    pub message: String,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Factory {
    config: Config,
    vaults_by_owner: LookupMap<AccountId, Vec<AccountId>>,
    all_vaults: Vector<AccountId>,
    /// Wallets whose first vault the factory has paid for.
    sponsored: LookupSet<AccountId>,
}

#[near]
impl Factory {
    #[init]
    #[private]
    pub fn new(config: Config) -> Self {
        Self::check_config(&config);
        Self {
            config,
            vaults_by_owner: LookupMap::new(StorageKey::VaultsByOwner),
            all_vaults: Vector::new(StorageKey::AllVaults),
            sponsored: LookupSet::new(StorageKey::Sponsored),
        }
    }

    // ------------------------------------------------------------ for anyone

    /// Create a vault owned by the caller, and its agent account.
    ///
    /// - `name`: 2-32 lowercase letters, digits or hyphens. The vault becomes
    ///   `<name>.<factory>` and the agent `<name>-agent.<factory>`.
    /// - `agent_public_key`: the key your agent will sign with. Leave it out to
    ///   use Phishbowl's demo agent.
    /// - `policy`: optional starting limits, passed to the vault unchanged.
    ///
    /// The first vault for each wallet is free. Otherwise attach at least
    /// `vault_funding + agent_funding`.
    #[payable]
    pub fn create_vault(&mut self, name: String, agent_public_key: Option<PublicKey>, policy: Option<Value>) -> Promise {
        let owner_id = env::predecessor_account_id();
        Self::check_name(&name);
        let owned = self.vaults_by_owner.get(&owner_id).map_or(0, Vec::len);
        require!(owned < MAX_VAULTS_PER_OWNER, "This wallet already has the most vaults allowed");

        let cost = self.creation_cost();
        let deposit = env::attached_deposit();
        let sponsored = if deposit.is_zero() {
            require!(
                !self.sponsored.contains(&owner_id),
                "Your first vault was free. Attach NEAR to create another one"
            );
            require!(
                env::account_balance() >= cost.saturating_add(FACTORY_RESERVE),
                "The factory has run out of sponsored vaults. Attach NEAR to pay for this one"
            );
            self.sponsored.insert(owner_id.clone());
            true
        } else {
            require!(deposit >= cost, "Attach enough NEAR to fund the vault and its agent");
            false
        };

        let factory = env::current_account_id();
        let vault_id: AccountId = format!("{name}.{factory}").parse().unwrap_or_else(|_| env::panic_str("Invalid name"));
        let agent_id: AccountId =
            format!("{name}-agent.{factory}").parse().unwrap_or_else(|_| env::panic_str("Invalid name"));
        let agent_key = agent_public_key.unwrap_or_else(|| self.config.demo_agent_key.clone());

        let mut init = json!({
            "owner_id": owner_id,
            "agent_id": agent_id,
            "drill_operator_id": self.config.drill_operator_id,
        });
        if let Some(policy) = policy {
            init["policy"] = policy;
        }
        let init_args = serde_json::to_vec(&init).unwrap_or_else(|_| env::panic_str("Invalid policy"));

        let vault = Promise::new(vault_id.clone())
            .create_account()
            .transfer(self.config.vault_funding)
            .use_global_contract(self.config.vault_code_hash.clone())
            .function_call("new".to_string(), init_args, NearToken::from_yoctonear(0), GAS_FOR_INIT);

        let allowance = Allowance::limited(AGENT_KEY_ALLOWANCE).unwrap_or_else(|| env::panic_str("Bad allowance"));
        let agent = Promise::new(agent_id.clone())
            .create_account()
            .transfer(self.config.agent_funding)
            .add_access_key_allowance(agent_key, allowance, vault_id.clone(), AGENT_METHODS.to_string());

        vault.and(agent).then(
            Self::ext(factory)
                .with_static_gas(GAS_FOR_CALLBACK)
                .on_created(owner_id, vault_id, agent_id, sponsored, deposit),
        )
    }

    // ----------------------------------------------------------------- views

    pub fn get_vaults(&self, owner_id: AccountId) -> Vec<AccountId> {
        self.vaults_by_owner.get(&owner_id).cloned().unwrap_or_default()
    }

    pub fn list_vaults(&self, from_index: Option<u32>, limit: Option<u32>) -> Vec<AccountId> {
        let from = from_index.unwrap_or(0);
        let limit = limit.unwrap_or(50).min(100);
        self.all_vaults.iter().skip(from as usize).take(limit as usize).cloned().collect()
    }

    pub fn vault_count(&self) -> u32 {
        self.all_vaults.len()
    }

    pub fn get_config(&self) -> Config {
        self.config.clone()
    }

    /// What a vault costs if you pay for it, and whether this wallet still gets one free.
    pub fn get_terms(&self, owner_id: AccountId) -> Value {
        json!({
            "cost": self.creation_cost(),
            "first_vault_free": !self.sponsored.contains(&owner_id),
            "sponsored_available": env::account_balance() >= self.creation_cost().saturating_add(FACTORY_RESERVE),
        })
    }

    // -------------------------------------------------------------- callback

    #[private]
    pub fn on_created(
        &mut self,
        owner_id: AccountId,
        vault_id: AccountId,
        agent_id: AccountId,
        sponsored: bool,
        deposit: NearToken,
    ) -> CreateResult {
        let ok = |index: u64| matches!(env::promise_result(index), PromiseResult::Successful(_));
        let (vault_created, agent_created) = (ok(0), ok(1));
        self.settle(owner_id, vault_id, agent_id, sponsored, deposit, vault_created, agent_created)
    }

    // ----------------------------------------------------------------- admin

    pub fn set_config(&mut self, config: Config) {
        self.assert_admin();
        Self::check_config(&config);
        self.config = config;
    }

    /// Record a vault made outside the factory (it must belong to `owner_id`).
    pub fn register(&mut self, owner_id: AccountId, vault_id: AccountId) {
        self.assert_admin();
        self.add_vault(&owner_id, vault_id);
    }
}

impl Factory {
    fn assert_admin(&self) {
        require!(env::predecessor_account_id() == self.config.admin_id, "Only the factory admin can do this");
    }

    fn creation_cost(&self) -> NearToken {
        self.config.vault_funding.saturating_add(self.config.agent_funding)
    }

    pub(crate) fn check_name(name: &str) {
        require!(
            (MIN_NAME_LEN..=MAX_NAME_LEN).contains(&name.len()),
            "The name must be 2 to 32 characters"
        );
        require!(
            name.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-'),
            "Use only lowercase letters, digits and hyphens"
        );
        require!(
            !name.starts_with('-') && !name.ends_with('-') && !name.contains("--"),
            "Hyphens can't be at the start or end, or next to each other"
        );
        require!(!name.ends_with("-agent"), "The name can't end in -agent");
    }

    fn check_config(config: &Config) {
        require!(
            config.vault_funding >= NearToken::from_millinear(100),
            "Vaults need at least 0.1 NEAR for storage"
        );
        require!(
            config.agent_funding > AGENT_KEY_ALLOWANCE,
            "Agents need more NEAR than their key's gas allowance"
        );
    }

    fn add_vault(&mut self, owner_id: &AccountId, vault_id: AccountId) {
        let mut list = self.vaults_by_owner.get(owner_id).cloned().unwrap_or_default();
        if !list.contains(&vault_id) {
            list.push(vault_id.clone());
            self.vaults_by_owner.insert(owner_id.clone(), list);
            self.all_vaults.push(vault_id);
        }
    }

    /// Record the outcome. Failed parts send their NEAR back: to the caller if
    /// they paid, otherwise it stays with the factory (and the free vault is
    /// restored if no vault was made).
    #[allow(clippy::too_many_arguments)]
    pub(crate) fn settle(
        &mut self,
        owner_id: AccountId,
        vault_id: AccountId,
        agent_id: AccountId,
        sponsored: bool,
        deposit: NearToken,
        vault_created: bool,
        agent_created: bool,
    ) -> CreateResult {
        if vault_created {
            self.add_vault(&owner_id, vault_id.clone());
        } else if sponsored {
            self.sponsored.remove(&owner_id);
        }

        if !sponsored {
            let mut refund = NearToken::from_yoctonear(0);
            if !vault_created {
                refund = refund.saturating_add(self.config.vault_funding);
            }
            if !agent_created {
                refund = refund.saturating_add(self.config.agent_funding);
            }
            // Anything attached above the cost goes back too.
            refund = refund.saturating_add(deposit.saturating_sub(self.creation_cost()));
            if !refund.is_zero() {
                let _ = Promise::new(owner_id.clone()).transfer(refund);
            }
        }

        let message = match (vault_created, agent_created) {
            (true, true) => format!("Created {vault_id} with agent {agent_id}."),
            (true, false) => format!(
                "Created {vault_id}, but {agent_id} couldn't be made. Point the vault at another agent with set_agent."
            ),
            (false, _) => format!("Couldn't create {vault_id}. The name may be taken; try another."),
        };
        let event = json!({
            "standard": "phishbowl_factory",
            "version": "1.0.0",
            "event": if vault_created { "vault_created" } else { "vault_failed" },
            "data": [{ "owner_id": owner_id, "vault_id": vault_id, "agent_id": agent_id, "sponsored": sponsored }],
        });
        env::log_str(&format!("EVENT_JSON:{event}"));
        CreateResult { vault_id, agent_id, vault_created, agent_created, message }
    }
}
