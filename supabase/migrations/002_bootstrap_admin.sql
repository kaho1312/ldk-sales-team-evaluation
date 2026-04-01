-- Bootstrap admin access for Kay Honig
-- Run once in the Supabase SQL editor to grant the first admin account.
-- After this, use the /admin → Agentes tab to manage other users' admin status.

UPDATE users SET is_admin = true WHERE email = 'kay@ldk.lat';
