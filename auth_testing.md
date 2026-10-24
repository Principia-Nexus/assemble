# Auth testing (Assemble)
- JWT email/password: POST /api/auth/login sets httpOnly cookies access_token (60m) + refresh_token (7d). Bearer header with the access token is also accepted.
- Demo accounts: see /app/memory/test_credentials.md. The body must include visitor_id (8-64 chars [A-Za-z0-9-]). Same visitor_id = same sandbox.
- Google (Emergent): POST /api/auth/session {session_id} -> session_token cookie. For tests, insert db.users {user_id, email, name, firm_id, sandbox_id:null, partner_access:[]} and db.user_sessions {user_id, session_token, expires_at ISO future}, then send Authorization: Bearer <session_token>.
- Mutating requests with a foreign Origin header are rejected (403).
