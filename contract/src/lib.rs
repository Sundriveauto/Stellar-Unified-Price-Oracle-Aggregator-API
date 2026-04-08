#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, vec, Address, Env, Map, String, Symbol,
    Vec,
};

// ── Storage keys ──────────────────────────────────────────────────────────────

const ADMIN_KEY: Symbol = symbol_short!("ADMIN");
const PRICES_KEY: Symbol = symbol_short!("PRICES");
const HISTORY_KEY: Symbol = symbol_short!("HISTORY");
const MAX_HISTORY: u32 = 1000;

// ── Data types ────────────────────────────────────────────────────────────────

/// A single price entry stored on-chain.
#[contracttype]
#[derive(Clone, Debug)]
pub struct PriceEntry {
    /// Price scaled by 1e7 (7 decimal places) to avoid floats.
    pub price: i128,
    /// Unix timestamp (seconds).
    pub timestamp: u64,
    /// Confidence 0–10000 (basis points, 10000 = 100%).
    pub confidence: u32,
    /// Number of sources that contributed to this price.
    pub sources: u32,
}

/// Submitted price from the aggregator.
#[contracttype]
#[derive(Clone, Debug)]
pub struct PriceSubmission {
    pub asset_pair: String,
    pub price: i128,
    pub timestamp: u64,
    pub confidence: u32,
    pub sources: u32,
}

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct PriceOracleContract;

#[contractimpl]
impl PriceOracleContract {
    // ── Admin ─────────────────────────────────────────────────────────────────

    /// Initialise the contract with an admin address.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&ADMIN_KEY) {
            panic!("already initialized");
        }
        env.storage().instance().set(&ADMIN_KEY, &admin);
        env.storage()
            .instance()
            .set(&PRICES_KEY, &Map::<String, PriceEntry>::new(&env));
    }

    /// Transfer admin rights.
    pub fn set_admin(env: Env, new_admin: Address) {
        Self::require_admin(&env);
        env.storage().instance().set(&ADMIN_KEY, &new_admin);
    }

    /// Return the current admin address.
    pub fn get_admin(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&ADMIN_KEY)
            .expect("not initialized")
    }

    // ── Price submission ──────────────────────────────────────────────────────

    /// Submit a single price update (admin only).
    pub fn submit_price(env: Env, submission: PriceSubmission) {
        Self::require_admin(&env);
        Self::validate_submission(&submission);

        let entry = PriceEntry {
            price: submission.price,
            timestamp: submission.timestamp,
            confidence: submission.confidence,
            sources: submission.sources,
        };

        // Update latest price map.
        let mut prices: Map<String, PriceEntry> = env
            .storage()
            .instance()
            .get(&PRICES_KEY)
            .unwrap_or_else(|| Map::new(&env));
        prices.set(submission.asset_pair.clone(), entry.clone());
        env.storage().instance().set(&PRICES_KEY, &prices);

        // Append to history.
        Self::append_history(&env, &submission.asset_pair, &entry);

        // Emit event.
        env.events().publish(
            (symbol_short!("price"), submission.asset_pair),
            (entry.price, entry.timestamp, entry.confidence),
        );
    }

    /// Submit multiple price updates in one transaction (admin only).
    pub fn submit_prices(env: Env, submissions: Vec<PriceSubmission>) {
        Self::require_admin(&env);

        let mut prices: Map<String, PriceEntry> = env
            .storage()
            .instance()
            .get(&PRICES_KEY)
            .unwrap_or_else(|| Map::new(&env));

        for submission in submissions.iter() {
            Self::validate_submission(&submission);
            let entry = PriceEntry {
                price: submission.price,
                timestamp: submission.timestamp,
                confidence: submission.confidence,
                sources: submission.sources,
            };
            prices.set(submission.asset_pair.clone(), entry.clone());
            Self::append_history(&env, &submission.asset_pair, &entry);
            env.events().publish(
                (symbol_short!("price"), submission.asset_pair),
                (entry.price, entry.timestamp, entry.confidence),
            );
        }

        env.storage().instance().set(&PRICES_KEY, &prices);
    }

    // ── Price queries ─────────────────────────────────────────────────────────

    /// Get the latest price for an asset pair.
    pub fn get_price(env: Env, asset_pair: String) -> Option<PriceEntry> {
        let prices: Map<String, PriceEntry> = env
            .storage()
            .instance()
            .get(&PRICES_KEY)
            .unwrap_or_else(|| Map::new(&env));
        prices.get(asset_pair)
    }

    /// Get all latest prices.
    pub fn get_all_prices(env: Env) -> Map<String, PriceEntry> {
        env.storage()
            .instance()
            .get(&PRICES_KEY)
            .unwrap_or_else(|| Map::new(&env))
    }

    /// Get price history for an asset pair (up to `limit` most recent entries).
    pub fn get_price_history(
        env: Env,
        asset_pair: String,
        limit: u32,
    ) -> Vec<PriceEntry> {
        let key = Self::history_key(&env, &asset_pair);
        let history: Vec<PriceEntry> = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| vec![&env]);

        let len = history.len();
        let take = limit.min(len);
        let start = len - take;

        let mut result = vec![&env];
        for i in start..len {
            result.push_back(history.get(i).unwrap());
        }
        result
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    fn require_admin(env: &Env) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&ADMIN_KEY)
            .expect("not initialized");
        admin.require_auth();
    }

    fn validate_submission(s: &PriceSubmission) {
        assert!(s.price > 0, "price must be positive");
        assert!(s.timestamp > 0, "timestamp must be positive");
        assert!(s.confidence <= 10000, "confidence must be <= 10000");
        assert!(s.sources > 0, "sources must be > 0");
    }

    fn history_key(env: &Env, asset_pair: &String) -> (Symbol, String) {
        (HISTORY_KEY, asset_pair.clone())
    }

    fn append_history(env: &Env, asset_pair: &String, entry: &PriceEntry) {
        let key = Self::history_key(env, asset_pair);
        let mut history: Vec<PriceEntry> = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| vec![env]);

        history.push_back(entry.clone());

        // Trim to MAX_HISTORY.
        while history.len() > MAX_HISTORY {
            history.pop_front();
        }

        env.storage().persistent().set(&key, &history);
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env, String};

    fn setup() -> (Env, Address, PriceOracleContractClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, PriceOracleContract);
        let client = PriceOracleContractClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        client.initialize(&admin);
        (env, admin, client)
    }

    #[test]
    fn test_initialize() {
        let (env, admin, client) = setup();
        assert_eq!(client.get_admin(), admin);
    }

    #[test]
    #[should_panic(expected = "already initialized")]
    fn test_double_initialize() {
        let (env, admin, client) = setup();
        client.initialize(&admin);
    }

    #[test]
    fn test_submit_and_get_price() {
        let (_env, _admin, client) = setup();
        let env = _env;

        let submission = PriceSubmission {
            asset_pair: String::from_str(&env, "XLM/USD"),
            price: 1_234_5678, // $1.2345678 scaled by 1e7
            timestamp: 1_700_000_000,
            confidence: 9800,
            sources: 3,
        };

        client.submit_price(&submission);

        let entry = client.get_price(&String::from_str(&env, "XLM/USD")).unwrap();
        assert_eq!(entry.price, 1_234_5678);
        assert_eq!(entry.confidence, 9800);
        assert_eq!(entry.sources, 3);
    }

    #[test]
    fn test_submit_prices_batch() {
        let (_env, _admin, client) = setup();
        let env = _env;

        let submissions = vec![
            &env,
            PriceSubmission {
                asset_pair: String::from_str(&env, "XLM/USD"),
                price: 1_000_0000,
                timestamp: 1_700_000_000,
                confidence: 9500,
                sources: 4,
            },
            PriceSubmission {
                asset_pair: String::from_str(&env, "BTC/USD"),
                price: 450_000_000_0000,
                timestamp: 1_700_000_000,
                confidence: 9900,
                sources: 4,
            },
        ];

        client.submit_prices(&submissions);

        let xlm = client.get_price(&String::from_str(&env, "XLM/USD")).unwrap();
        let btc = client.get_price(&String::from_str(&env, "BTC/USD")).unwrap();
        assert_eq!(xlm.price, 1_000_0000);
        assert_eq!(btc.price, 450_000_000_0000);
    }

    #[test]
    fn test_price_history() {
        let (_env, _admin, client) = setup();
        let env = _env;

        for i in 0..5u64 {
            client.submit_price(&PriceSubmission {
                asset_pair: String::from_str(&env, "XLM/USD"),
                price: (i as i128 + 1) * 1_000_0000,
                timestamp: 1_700_000_000 + i,
                confidence: 9000,
                sources: 2,
            });
        }

        let history = client.get_price_history(&String::from_str(&env, "XLM/USD"), &3);
        assert_eq!(history.len(), 3);
        // Most recent 3 entries
        assert_eq!(history.get(2).unwrap().price, 5 * 1_000_0000);
    }

    #[test]
    fn test_get_all_prices() {
        let (_env, _admin, client) = setup();
        let env = _env;

        client.submit_price(&PriceSubmission {
            asset_pair: String::from_str(&env, "XLM/USD"),
            price: 1_000_0000,
            timestamp: 1_700_000_000,
            confidence: 9000,
            sources: 2,
        });

        let all = client.get_all_prices();
        assert_eq!(all.len(), 1);
    }

    #[test]
    #[should_panic(expected = "price must be positive")]
    fn test_invalid_price() {
        let (_env, _admin, client) = setup();
        let env = _env;

        client.submit_price(&PriceSubmission {
            asset_pair: String::from_str(&env, "XLM/USD"),
            price: 0,
            timestamp: 1_700_000_000,
            confidence: 9000,
            sources: 2,
        });
    }
}
