# Auth-Gated App Testing Playbook

## Step 1: Create Test User & Session
```bash
mongosh --eval "
use('test_database');
var visitorId = 'user_' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: visitorId,
  email: 'test.user.' + Date.now() + '@example.com',
  name: 'Test User',
  picture: 'https://via.placeholder.com/150',
  tier: 'bronze',
  points_balance: 1250,
  created_at: new Date()
});
db.user_sessions.insertOne({
  user_id: visitorId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});
print('Session token: ' + sessionToken);
print('User ID: ' + visitorId);
"
```

## Step 2: Test Backend API
```bash
# Test auth endpoint
curl -X GET "http://localhost:8001/api/auth/me" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"

# Test protected endpoints
curl -X GET "http://localhost:8001/api/rewards" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

## Step 3: Browser/Mobile Testing
Set cookie and navigate to app.

## Success Indicators
- /api/auth/me returns user data with user_id field
- Dashboard loads without redirect
- CRUD operations work

## Failure Indicators
- "User not found" errors
- 401 Unauthorized responses
- Redirect to login page
