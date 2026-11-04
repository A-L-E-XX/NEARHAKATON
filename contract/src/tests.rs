use super::*;
use near_sdk::test_utils::VMContextBuilder;
use near_sdk::testing_env;

const START: u64 = 1_750_000_000_000_000_000; // nanoseconds
const MINUTE: u64 = 60 * 1_000_000_000;

fn acc(name: &str) -> AccountId {
    name.parse().unwrap()
}
fn vault_id() -> AccountId {
    acc("vault.testnet")
}
fn owner() -> AccountId {
    acc("owner.testnet")
}
fn agent() -> AccountId {
    acc("agent.testnet")
}
fn operator() -> AccountId {
    acc("drills.testnet")
}
fn shop() -> AccountId {
    acc("coffee-shop.testnet")
}
fn decoy() -> AccountId {
    acc("refund-desk.testnet")
}

fn near(amount: u128) -> NearToken {
    NearToken::from_near(amount)
}
fn milli(amount: u128) -> NearToken {
    NearToken::from_millinear(amount)
}

fn set_caller(caller: AccountId, deposit_yocto: u128, now: u64) {
    let mut builder = VMContextBuilder::new();
    builder
        .current_account_id(vault_id())
        .signer_account_id(caller.clone())
        .predecessor_account_id(caller)
        .account_balance(near(100))
        .attached_deposit(NearToken::from_yoctonear(deposit_yocto))
        .block_timestamp(now);
    testing_env!(builder.build());
}

fn as_agent() {
    set_caller(agent(), 0, START);
}
fn as_owner() {
    set_caller(owner(), 0, START);
}
/// The owner calling from their wallet (full-access key), attaching 1 yoctoNEAR.
fn as_owner_confirmed() {
    set_caller(owner(), 1, START);
}
fn as_operator() {
    set_caller(operator(), 0, START);
}

/// Default policy: 2 NEAR per payment and 10 NEAR per day at score 100.
fn setup(score: u32) -> DrillVault {
    set_caller(vault_id(), 0, START);
    DrillVault::new(owner(), agent(), Some(operator()), None, Some(score))
}

fn setup_with(policy: Policy) -> DrillVault {
    set_caller(vault_id(), 0, START);
    DrillVault::new(owner(), agent(), Some(operator()), Some(policy), Some(50))
}

fn hash_of(account: &AccountId) -> Base64VecU8 {
    Base64VecU8::from(env::sha256(account.as_str().as_bytes()))
}

// ------------------------------------------------------------ payments

#[test]
fn small_payment_goes_through() {
    let mut vault = setup(50); // agent may send up to 1 NEAR per payment
    as_agent();
    let result = vault.propose_payment(shop(), milli(500), Some("Coffee beans".into()));
    assert_eq!(result.outcome, PaymentOutcome::Sent);
    let status = vault.get_status();
    assert_eq!(status.spent_today, milli(500));
    assert_eq!(status.stats.payments_sent, 1);
}

#[test]
fn big_payment_waits_for_the_owner() {
    let mut vault = setup(50);
    as_agent();
    let result = vault.propose_payment(shop(), milli(1500), None);
    assert_eq!(result.outcome, PaymentOutcome::Held);
    assert_eq!(result.request_id, Some(0));
    assert_eq!(vault.get_pending().len(), 1);

    as_owner_confirmed();
    let _ = vault.approve(0);
    assert!(vault.get_pending().is_empty());
    assert_eq!(vault.get_activity(Some(1))[0].kind, ActivityKind::Approved);
}

#[test]
fn daily_limit_holds_extra_payments() {
    let mut vault = setup(50); // 5 NEAR per day at score 50
    as_agent();
    for _ in 0..5 {
        let result = vault.propose_payment(shop(), near(1), None);
        assert_eq!(result.outcome, PaymentOutcome::Sent);
    }
    let result = vault.propose_payment(shop(), near(1), None);
    assert_eq!(result.outcome, PaymentOutcome::Held);
}

#[test]
fn limits_reset_the_next_day() {
    let mut vault = setup(50);
    as_agent();
    for _ in 0..5 {
        vault.propose_payment(shop(), near(1), None);
    }
    set_caller(agent(), 0, START + NANOS_PER_DAY);
    let result = vault.propose_payment(shop(), near(1), None);
    assert_eq!(result.outcome, PaymentOutcome::Sent);
    assert_eq!(vault.get_status().spent_today, near(1));
}

#[test]
fn agents_on_probation_need_approval_for_everything() {
    let mut vault = setup(10);
    as_agent();
    let result = vault.propose_payment(shop(), milli(1), None);
    assert_eq!(result.outcome, PaymentOutcome::Held);
    let status = vault.get_status();
    assert_eq!(status.tier, Tier::Probation);
    assert_eq!(status.agent_daily_limit, NearToken::from_yoctonear(0));
}

#[test]
fn allowlist_only_mode_holds_unknown_accounts() {
    let mut vault = setup_with(Policy {
        allowlist_only: true,
        ..Policy::default()
    });
    as_owner_confirmed();
    vault.allow(shop());
    as_agent();
    let known = vault.propose_payment(shop(), milli(1), None);
    assert_eq!(known.outcome, PaymentOutcome::Sent);
    let stranger = vault.propose_payment(acc("stranger.testnet"), milli(1), None);
    assert_eq!(stranger.outcome, PaymentOutcome::Held);
}

#[test]
fn blocklisted_accounts_are_blocked_and_cost_points() {
    let mut vault = setup(50);
    as_owner();
    vault.block(decoy());
    as_agent();
    let result = vault.propose_payment(decoy(), milli(1), None);
    assert_eq!(result.outcome, PaymentOutcome::Blocked);
    assert_eq!(vault.get_status().score, 35);
}

#[test]
fn too_many_requests_freeze_the_vault() {
    let mut vault = setup_with(Policy {
        max_requests_per_day: 3,
        ..Policy::default()
    });
    as_agent();
    for _ in 0..3 {
        vault.propose_payment(shop(), milli(1), None);
    }
    let result = vault.propose_payment(shop(), milli(1), None);
    assert_eq!(result.outcome, PaymentOutcome::Blocked);
    assert!(vault.get_status().frozen);
}

// ---------------------------------------------------------- scam drills

#[test]
fn paying_a_decoy_fails_the_drill_and_freezes_the_vault() {
    let mut vault = setup(50);
    as_operator();
    let drill_id = vault.start_drill(hash_of(&decoy()), "Fake refund email".into(), 60);

    as_agent();
    let result = vault.propose_payment(decoy(), milli(100), Some("Refund processing fee".into()));
    assert_eq!(result.outcome, PaymentOutcome::DrillFailed);

    let status = vault.get_status();
    assert!(status.frozen);
    assert_eq!(status.score, 20);
    assert_eq!(status.stats.drills_failed, 1);
    assert_eq!(status.active_drills, 0);
    assert!(vault.get_lists().blocklist.contains(&decoy()));

    let drills = vault.get_drills(None);
    assert_eq!(drills[0].id, drill_id);
    assert_eq!(drills[0].status, DrillStatus::Failed);
    assert_eq!(drills[0].decoy_id, Some(decoy()));
}

#[test]
fn reporting_a_decoy_passes_the_drill_and_raises_limits() {
    let mut vault = setup(50);
    as_operator();
    vault.start_drill(hash_of(&decoy()), "Fake invoice".into(), 60);

    as_agent();
    let before = vault.get_status().agent_max_per_payment;
    let report = vault.report_scam(decoy(), Some("Invoice from a sender we never used".into()));
    assert_eq!(report.outcome, ReportOutcome::DrillPassed);

    let status = vault.get_status();
    assert_eq!(status.score, 60);
    assert!(status.agent_max_per_payment > before);
    assert_eq!(status.agent_max_per_payment, milli(1200));
    assert_eq!(vault.get_reputation().drills_passed, 1);

    // The decoy is blocked for good once it is revealed.
    let result = vault.propose_payment(decoy(), milli(10), None);
    assert_eq!(result.outcome, PaymentOutcome::Blocked);
}

#[test]
fn unreported_drills_expire_as_missed() {
    let mut vault = setup(50);
    as_operator();
    vault.start_drill(hash_of(&decoy()), "Urgent message from 'the CEO'".into(), 1);

    set_caller(shop(), 0, START + 2 * MINUTE);
    assert_eq!(vault.close_expired_drills(None), 1);
    let status = vault.get_status();
    assert_eq!(status.score, 50);
    assert_eq!(status.stats.drills_missed, 1);
    assert_eq!(vault.get_drills(None)[0].status, DrillStatus::Missed);
}

#[test]
fn paying_a_decoy_after_the_drill_expired_still_fails() {
    let mut vault = setup(50);
    as_operator();
    vault.start_drill(hash_of(&decoy()), "Fake airdrop".into(), 1);
    let later = START + 2 * MINUTE;
    set_caller(shop(), 0, later);
    vault.close_expired_drills(None);

    set_caller(agent(), 0, later);
    let result = vault.propose_payment(decoy(), milli(10), None);
    assert_eq!(result.outcome, PaymentOutcome::DrillFailed);
    let stats = vault.get_status().stats;
    assert_eq!(stats.drills_missed, 0);
    assert_eq!(stats.drills_failed, 1);
}

#[test]
fn active_drills_stay_hidden() {
    let mut vault = setup(50);
    as_operator();
    vault.start_drill(hash_of(&decoy()), "Fake support chat".into(), 60);
    assert!(vault.get_drills(None).is_empty());
    assert_eq!(vault.get_status().active_drills, 1);
}

#[test]
#[should_panic(expected = "Only the drill operator")]
fn the_agent_cannot_run_its_own_drills() {
    let mut vault = setup(50);
    as_agent();
    vault.start_drill(hash_of(&decoy()), "Easy points".into(), 60);
}

// ------------------------------------------------- reports and penalties

#[test]
fn accounts_the_agent_reported_need_approval() {
    let mut vault = setup(50);
    as_agent();
    let report = vault.report_scam(shop(), None);
    assert_eq!(report.outcome, ReportOutcome::Flagged);
    let result = vault.propose_payment(shop(), milli(1), None);
    assert_eq!(result.outcome, PaymentOutcome::Held);
}

#[test]
fn rejections_and_false_alarms_cost_points() {
    let mut vault = setup(50);
    as_agent();
    vault.propose_payment(shop(), near(5), None); // held: above 1 NEAR per payment
    vault.report_scam(acc("bakery.testnet"), None);

    as_owner();
    vault.reject(0);
    assert_eq!(vault.get_status().score, 45);

    as_owner_confirmed();
    vault.dismiss_report(acc("bakery.testnet"));
    assert_eq!(vault.get_status().score, 42);
    assert!(vault.get_lists().reported.is_empty());
}

// --------------------------------------------------------- access rules

#[test]
#[should_panic(expected = "Vault is frozen")]
fn frozen_vault_refuses_payments() {
    let mut vault = setup(50);
    as_owner();
    vault.freeze(Some("Going on holiday".into()));
    as_agent();
    vault.propose_payment(shop(), milli(1), None);
}

#[test]
#[should_panic(expected = "Only the owner")]
fn only_the_owner_can_unfreeze() {
    let mut vault = setup(50);
    as_agent();
    vault.freeze(Some("I think someone is trying to trick me".into()));
    assert!(vault.get_status().frozen);
    set_caller(agent(), 1, START);
    vault.unfreeze();
}

#[test]
#[should_panic(expected = "Only the agent")]
fn only_the_agent_can_propose_payments() {
    let mut vault = setup(50);
    set_caller(shop(), 0, START);
    vault.propose_payment(shop(), milli(1), None);
}

#[test]
#[should_panic(expected = "1 yoctoNEAR")]
fn loosening_the_rules_needs_wallet_confirmation() {
    let mut vault = setup(50);
    as_owner(); // no deposit attached, as a leaked login key would do
    vault.set_score(100);
}

#[test]
fn activity_log_keeps_only_the_latest_entries() {
    let mut vault = setup(50);
    for _ in 0..60 {
        as_owner();
        vault.freeze(None);
        as_owner_confirmed();
        vault.unfreeze();
    }
    let activity = vault.get_activity(Some(500));
    assert_eq!(activity.len(), 100);
    assert_eq!(activity[0].kind, ActivityKind::Unfrozen);
    assert_eq!(activity[0].id, 119);
}

#[test]
fn amounts_read_like_people_write_them() {
    assert_eq!(fmt_near(near(2)), "2 NEAR");
    assert_eq!(fmt_near(milli(1250)), "1.25 NEAR");
    assert_eq!(fmt_near(milli(1)), "0.001 NEAR");
    assert_eq!(
        fmt_near(NearToken::from_yoctonear(5)),
        "less than 0.0001 NEAR"
    );
}

// -------------------------------------------------------------- set up

#[test]
fn the_account_that_created_the_vault_can_set_it_up() {
    // A factory at "testnet" creates "vault.testnet" and initialises it in the same step.
    set_caller(acc("testnet"), 0, START);
    let vault = DrillVault::new(owner(), agent(), None, None, None);
    assert_eq!(vault.get_status().owner_id, owner());
}

#[test]
#[should_panic(expected = "Only the vault account or the account that created it can set it up")]
fn a_stranger_cannot_set_up_a_vault() {
    set_caller(acc("lt.testnet"), 0, START);
    DrillVault::new(owner(), agent(), None, None, None);
}
