# 🚂 Railway Environment Variables Setup

## ✅ Migration Complete! Now Update Railway

Your data has been successfully migrated to Supabase! Now you need to update Railway's environment variables to point to Supabase.

---

## 📋 Step-by-Step Instructions

### 1. Go to Railway Dashboard
1. Open https://railway.app/dashboard
2. Click on your **backend project**
3. Click on the **Variables** tab

---

### 2. Update These Variables

**Find and UPDATE these existing variables:**

#### ✏️ DATABASE_URL
**Old value:** (Your Neon URL)
**New value:**
```
postgresql://postgres.pewtaqiljwqzzvzcoscf:Bo37zap3BkeWhfom@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

#### ✏️ DIRECT_DATABASE_URL  
**Old value:** (Your Neon direct URL)
**New value:**
```
postgresql://postgres.pewtaqiljwqzzvzcoscf:Bo37zap3BkeWhfom@aws-1-eu-west-1.pooler.supabase.com:5432/postgres
```

---

### 3. Add These NEW Variables (Optional - for future use)

Click **"+ New Variable"** and add:

#### SUPABASE_URL
```
https://pewtaqiljwqzzvzcoscf.supabase.co
```

#### SUPABASE_ANON_KEY
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBld3RhcWlsandxenp2emNvc2NmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MTUzMjUsImV4cCI6MjA4NzA5MTMyNX0.ECPLj3acRzLb1yFhVHLOFQBdsDx-JLlKif8_DmboQAw
```

---

### 4. Deploy

Once you've updated the variables:

1. Railway will **automatically redeploy** your backend
2. Wait for the build to complete (~2-3 minutes)
3. Check the deployment logs for any errors

---

## 🔍 What to Look For in Logs

You should see:
```
✅ Connected to PostgreSQL database (Supabase) - X users found
🚀 Server running on port XXXX
```

---

## ⚠️ Important Notes

### About the Connection Strings:

- **DATABASE_URL (port 6543)**: Transaction pooler - used for app runtime
  - Includes `?pgbouncer=true` parameter
  - Fast connection pooling

- **DIRECT_DATABASE_URL (port 5432)**: Session pooler - used for migrations
  - No pgbouncer parameter
  - Needed for Prisma migrations during build

### Why Two URLs?

- Prisma needs direct connection for migrations (`prisma db push`)
- App needs pooled connection for better performance
- Railway build process uses DIRECT_DATABASE_URL
- Runtime uses DATABASE_URL

---

## 🧪 Testing After Deployment

### 1. Test Web App
1. Open your web app
2. Try logging in
3. Check if data loads correctly

### 2. Test Mobile App
1. Open mobile app
2. Login
3. Verify all features work

### 3. Check Railway Logs
```bash
# Look for successful connection
✅ Connected to PostgreSQL database (Supabase)
```

---

## 🆘 Troubleshooting

### Build Still Fails?

**Error: "Tenant or user not found"**
- Check that you copied the URLs exactly as shown above
- Make sure there are no extra spaces
- Username should be `postgres.pewtaqiljwqzzvzcoscf` (with the dot)

**Error: "Can't reach database"**
- Railway might not be able to reach that pooler
- Try using port 6543 for both URLs temporarily

### App Deploys But Doesn't Work?

- Check Railway logs for connection errors
- Verify DATABASE_URL is set correctly
- Make sure you migrated the data successfully (you did! ✅)

---

## 🎉 Success Checklist

- [ ] Updated DATABASE_URL in Railway
- [ ] Updated DIRECT_DATABASE_URL in Railway  
- [ ] Added SUPABASE_URL (optional)
- [ ] Added SUPABASE_ANON_KEY (optional)
- [ ] Railway deployed successfully
- [ ] Web app works
- [ ] Mobile app works
- [ ] All data is accessible

---

## 🗑️ Optional: Delete Neon Later

**DON'T DELETE NEON YET!**

Keep your Neon database for at least a week as backup:
1. Make sure everything works perfectly
2. Test all app features
3. Verify no data is missing
4. Then you can safely delete Neon

---

## 📊 What Was Migrated

✅ 6 users
✅ 1 room
✅ 9 room tasks
✅ 2 room members
✅ 374 task completions
✅ 25 room MVPs
✅ 19 appreciations
✅ 46 direct messages
✅ 2 friendships
✅ 481 notifications
✅ 19 nudges

**All your data is safe in Supabase!** 🎉

---

Need help? Let me know which step you're stuck on!
