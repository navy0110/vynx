# MVP alias ownership decision

**Status:** implemented for new devnet claims; registry enabled by default.

The frontend/API uses the deployed VYNX Anchor registry at
`AxQxAgndT6ziUr3FBNafhJzF4PpniGpMX4fVRXXmh5y8`. The program is the source
of alias ownership. Supabase stores profiles, chain receipts and registration
intents. Both the canonical alias PDA and wallet owner-index PDA must agree
before editing, publishing, resolving a creator or confirming registration.

Prices come from the config PDA: initially 0.92, 0.53, 0.30, 0.14 and 0.01 SOL
for lengths 1, 2, 3, 4 and 5–30. The configured administrator can change them.
Creator payments include account rent; a separate VYNX sponsor pays network
fees. Authenticated, same-origin preparation binds the displayed price/version,
program, accounts, expiry and random intent to a simulated registration message.
The server signs only messages it builds. Confirmation compares the actual
transaction message with the durable intent and verifies both ownership PDAs.
Plain treasury transfers cannot establish registry ownership.

Existing database-only claims reserve their names and wallet associations, but
cannot authorize editing or public resolution until migrated. Migration remains
a separate pending task; existing owners must not pay again. See the
[registration policy](alias-registration-policy.md).

Apply migration `006_alias_registry.sql` and configure the server-only sponsor
key before serving new claims. No automatic legacy fallback occurs on missing
configuration. `VYNX_ALIAS_REGISTRY_ENABLED=false` retains the old flow solely
for explicit compatibility testing or controlled rollback; never mix ownership
modes across active instances. See [frontend integration](alias-registry-integration.md)
and [chain deployment evidence](../chain/README.md).
