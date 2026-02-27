# Luna Venue Portal

A standalone web analytics dashboard for Luna Group venue managers and staff.

## Features

- **Revenue Analytics**: Track spending by category, daily trends, average spend per customer
- **Check-in Analytics**: Monitor visitor patterns, peak hours, top loyal customers
- **Demographics**: View membership tier distribution, age/gender breakdown
- **Real-time Dashboard**: Recent redemptions, pending validations, venue metrics

## Running Locally

The portal runs on **localhost:5173** via Vite dev server:

```bash
cd /app/venue-portal
yarn dev
```

Access at: `http://localhost:5173`

## Credentials

**Demo Venue Manager Account:**
- Email: `venue@eclipse.com`
- Password: `venue123`
- Venue: Eclipse Nightclub

## API Integration

The portal connects to the same backend API as the mobile app:
- Base URL: `https://luna-venue-admin.preview.emergentagent.com/api`
- Authentication: JWT Bearer tokens
- Endpoints:
  - `POST /api/auth/login` - Staff login
  - `GET /api/venue/analytics/revenue?period=week|month|year`
  - `GET /api/venue/analytics/checkins?period=week|month|year`
  - `GET /api/venue/analytics/demographics`
  - `GET /api/venue/dashboard` - Real-time metrics

## Tech Stack

- **Framework**: React 18 + TypeScript + Vite
- **Charts**: Recharts
- **HTTP Client**: Axios
- **Routing**: React Router DOM v6
- **Styling**: Inline styles with dark theme

## Deployment

For production deployment:
1. Build the app: `yarn build`
2. Serve the `dist/` folder via nginx/caddy
3. Update `VITE_API_URL` in `.env` to production backend URL

## Development Notes

- Analytics APIs require `venue_staff`, `venue_manager`, or `admin` role
- Admin users can see analytics across ALL venues
- Venue staff can only see their assigned venue's data
- The portal shares authentication with the mobile app backend
