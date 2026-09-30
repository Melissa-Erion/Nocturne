# Auth email templates

Paste into Supabase → Authentication → Emails → Templates (subject + body "Source"):

| Template | Subject | File |
|---|---|---|
| Confirm signup | Confirm your Regimen account | `confirm-signup.html` |
| Reset password | Reset your Regimen password | `reset-password.html` |
| Change email address | Confirm your new email for Regimen | `change-email.html` |
| Magic link | Your Regimen sign-in link | `magic-link.html` |

Sending goes through custom SMTP (Resend, domain regimenfit.ca): Authentication → Emails → SMTP Settings,
host `smtp.resend.com`, port `465`, username `resend`, password = Resend API key,
sender `support@regimenfit.ca`, sender name `Regimen`.
