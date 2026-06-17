// ─────────────────────────────────────────────────────────────
//  Login mode
// ─────────────────────────────────────────────────────────────
// PASSWORDLESS = true  → users sign in with just their email, no password.
//                        Convenient for getting started. NOT real security:
//                        anyone with the app link who knows an approved email
//                        could sign in as them. Admin approval still gates who
//                        can see data. Requires "Confirm email" turned OFF in
//                        Supabase (Authentication → Providers → Email).
//
// PASSWORDLESS = false → normal email + password login.
//
// To switch back to passwords later, set this to false and redeploy. Accounts
// created while passwordless will then need a password reset to sign in.
export const PASSWORDLESS = true
