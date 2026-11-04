use super::*;
use near_sdk::test_utils::VMContextBuilder;
use near_sdk::testing_env;

fn account(name: &str) -> AccountId {
    name.parse().unwrap()
}

fn config() -> Config {
    Config {
        admin_id: account("ops.testnet"),
        vault_code_hash: "4ZMWHzZfuDyTwDwnzjb5H4YwVJy7ZPrv2hSYswzx4mYt".parse().unwrap(),
        drill_operator_id: account("ops.testnet"),
        demo_agent_key: "ed25519:3dDywUM4L8D91oewxSAVtwRHWbWXjHRqHfCsJChNs6n7".parse().unwrap(),
        vault_funding: NearToken::from_near(1),
        agent_funding: NearToken::from_millinear(300),
    }
}

fn context(caller: &str, deposit: NearToken, balance: NearToken) {
    testing_env!(VMContextBuilder::new()
        .current_account_id(account("factory.testnet"))
        .predecessor_account_id(account(caller))
        .attached_deposit(deposit)
        .account_balance(balance)
        .build());
}

fn factory() -> Factory {
    context("factory.testnet", NearToken::from_yoctonear(0), NearToken::from_near(50));
    Factory::new(config())
}

#[test]
fn good_names_pass() {
    for name in ["bakery", "my-shop-2", "ab"] {
        Factory::check_name(name);
    }
}

#[test]
#[should_panic(expected = "Use only lowercase letters, digits and hyphens")]
fn capital_letters_are_refused() {
    Factory::check_name("Bakery");
}

#[test]
#[should_panic(expected = "The name can't end in -agent")]
fn names_that_clash_with_agent_accounts_are_refused() {
    Factory::check_name("shop-agent");
}

#[test]
#[should_panic(expected = "Hyphens can't be at the start or end")]
fn trailing_hyphen_is_refused() {
    Factory::check_name("shop-");
}

#[test]
fn the_first_vault_is_free_once() {
    let mut f = factory();
    context("alice.testnet", NearToken::from_yoctonear(0), NearToken::from_near(50));
    let _ = f.create_vault("alice-bakery".into(), None, None);
    assert!(f.get_terms(account("alice.testnet"))["first_vault_free"] == false);
}

#[test]
#[should_panic(expected = "Your first vault was free")]
fn a_second_free_vault_is_refused() {
    let mut f = factory();
    context("alice.testnet", NearToken::from_yoctonear(0), NearToken::from_near(50));
    let _ = f.create_vault("one".into(), None, None);
    let _ = f.create_vault("two".into(), None, None);
}

#[test]
fn a_paid_vault_is_allowed_after_the_free_one() {
    let mut f = factory();
    context("alice.testnet", NearToken::from_yoctonear(0), NearToken::from_near(50));
    let _ = f.create_vault("one".into(), None, None);
    context("alice.testnet", NearToken::from_millinear(1300), NearToken::from_near(50));
    let _ = f.create_vault("two".into(), None, None);
}

#[test]
#[should_panic(expected = "Attach enough NEAR")]
fn too_small_a_deposit_is_refused() {
    let mut f = factory();
    context("alice.testnet", NearToken::from_millinear(500), NearToken::from_near(50));
    let _ = f.create_vault("shop".into(), None, None);
}

#[test]
#[should_panic(expected = "run out of sponsored vaults")]
fn no_free_vault_when_the_factory_is_low() {
    let mut f = factory();
    context("alice.testnet", NearToken::from_yoctonear(0), NearToken::from_near(3));
    let _ = f.create_vault("shop".into(), None, None);
}

#[test]
fn a_created_vault_is_listed_for_its_owner() {
    let mut f = factory();
    context("factory.testnet", NearToken::from_yoctonear(0), NearToken::from_near(50));
    let result = f.settle(
        account("alice.testnet"),
        account("shop.factory.testnet"),
        account("shop-agent.factory.testnet"),
        true,
        NearToken::from_yoctonear(0),
        true,
        true,
    );
    assert!(result.vault_created && result.agent_created);
    assert_eq!(f.get_vaults(account("alice.testnet")), vec![account("shop.factory.testnet")]);
    assert_eq!(f.vault_count(), 1);
    assert!(f.get_vaults(account("bob.testnet")).is_empty());
}

#[test]
fn a_failed_free_vault_gives_the_free_vault_back() {
    let mut f = factory();
    context("alice.testnet", NearToken::from_yoctonear(0), NearToken::from_near(50));
    let _ = f.create_vault("taken".into(), None, None);
    context("factory.testnet", NearToken::from_yoctonear(0), NearToken::from_near(50));
    let result = f.settle(
        account("alice.testnet"),
        account("taken.factory.testnet"),
        account("taken-agent.factory.testnet"),
        true,
        NearToken::from_yoctonear(0),
        false,
        false,
    );
    assert!(!result.vault_created);
    assert!(f.get_vaults(account("alice.testnet")).is_empty());
    assert!(f.get_terms(account("alice.testnet"))["first_vault_free"] == true);
}

#[test]
#[should_panic(expected = "Only the factory admin can do this")]
fn only_the_admin_can_register_vaults() {
    let mut f = factory();
    context("mallory.testnet", NearToken::from_yoctonear(0), NearToken::from_near(50));
    f.register(account("mallory.testnet"), account("someone-elses.testnet"));
}

#[test]
fn the_admin_can_register_an_existing_vault() {
    let mut f = factory();
    context("ops.testnet", NearToken::from_yoctonear(0), NearToken::from_near(50));
    f.register(account("wasback.testnet"), account("wasback-vault.testnet"));
    f.register(account("wasback.testnet"), account("wasback-vault.testnet"));
    assert_eq!(f.get_vaults(account("wasback.testnet")), vec![account("wasback-vault.testnet")]);
}
