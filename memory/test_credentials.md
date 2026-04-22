# Luna Group — Test Credentials

## Mobile User (regular customer)
- Email: `luna@test.com`
- Password: `test123`
- Role: `user`
- ~20,099 points, Supernova tier, already email_verified
- ⚠️ Also used as the **App Store Reviewer demo account**

## Admin (full access — mobile + admin portal)
- Email: `admin@lunagroup.com.au`
- Password: `Trent69!`
- Role: `admin`

## Venue Manager / Staff Portal (QR scanning)
- Email: `venue@eclipse.com`
- Password: `venue123`
- Role: `venue_manager`

## Email Service (Resend — verified and live)
- Verified domain: `lunagroupapp.com.au` (note: `app` in the middle)
- Sender: `Luna Group <noreply@lunagroupapp.com.au>`
- Free tier: 3,000 emails/month, 2 sends/sec burst limit
- API key stored in `/app/backend/.env` as `RESEND_API_KEY`

## Signup / Email Verification (6-digit OTP flow)
- On `/api/auth/register`, backend sends a 6-digit OTP to the user's email (valid 15 min, bcrypt-hashed in DB)
- User enters OTP in app → `POST /api/auth/verify-email` with `{"code":"123456"}` + Bearer token
- Max 5 incorrect attempts per OTP before user must request a new one
- `POST /api/auth/resend-verification` generates a fresh OTP + resets attempt counter
- For testing: inspect `users.email_otp_hash` in Mongo. You can overwrite it via:
  ```python
  import bcrypt
  new = bcrypt.hashpw(b'123456', bcrypt.gensalt()).decode()
  # db.users.update_one({'email':'...'}, {'$set':{'email_otp_hash': new, 'email_otp_attempts':0}})
  ```
  Then verify with code `123456`.
