// Single source for the address shown to users on privacy.tsx/terms.tsx.
// Domain-hosted (Cloudflare Email Routing forwards it) rather than a
// personal address, both so it reads as an official contact for the
// service and so a personal inbox doesn't end up harvested from a public
// repo. Kept in its own module (not inlined in either screen) so changing
// it later — a real support inbox, a different forwarding target — only
// ever touches one line.
export const CONTACT_EMAIL = 'contact@pokelids-collect.jp';
