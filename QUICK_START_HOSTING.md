# 🚀 Quick Start - Host Your System on Network

## ✅ YOUR SYSTEM IS ALREADY RUNNING!

Your backend and frontend are currently active:
- **Backend**: Running on port 5000
- **Frontend**: Running on port 3000
- **MySQL**: Running ✓
- **Redis**: Running ✓

---

## 🌐 Current Access URLs

### From This Server PC
```
http://localhost:3000
```

### From Any Other Device on Network
```
http://10.70.4.186:3000
```

**Note**: The frontend is already accessible, but you need to configure it to connect to your network IP address.

---

## ⚡ Next Steps to Enable Network Access

### Step 1: Configure for Network (REQUIRED)
The frontend needs to know your network IP address:

**Close the current frontend window first**, then run:
```batch
setup_network_access.bat
```

### Step 2: Restart Frontend
After configuration, restart just the frontend:
```batch
cd frontend
npm start
```

Or restart the entire system:
```batch
start_system.bat
```

### Step 3: Configure Firewall (Administrator Required)
Right-click and "Run as Administrator":
```batch
configure_firewall.bat
```

### Step 4: Verify Setup
```batch
verify_setup.bat
```

---

## 🔐 Default Login

**Email**: `susaraperera33@gmail.com`  
**Password**: `susara_perera`

⚠️ Change these credentials after first login!

---

## ✅ Requirements Checklist

Before starting, ensure:
- [ ] MySQL is installed and running
- [ ] Node.js is installed
- [ ] Redis is running (optional but recommended)
- [ ] Server PC has static/stable IP address
- [ ] All devices are on the same network

---

## 🛠️ Troubleshooting

### Can't access from other devices?
1. Check Windows Firewall (run `configure_firewall.bat` as admin)
2. Verify devices are on same network
3. Try pinging server: `ping 10.70.4.186`
4. Restart the system

### Backend connection error?
1. Ensure backend is running (green console window)
2. Check MySQL is running
3. Verify `.env` files are configured

### Need to stop the system?
Close the backend and frontend console windows that opened.

---

## 📞 Testing Network Access

### Test from another computer:
1. Open Command Prompt on another PC
2. Run: `ping 10.70.4.186`
3. If successful, open browser and go to `http://10.70.4.186:3000`

### Test from mobile:
1. Connect mobile to same WiFi
2. Open browser
3. Enter: `http://10.70.4.186:3000`

---

## 🌟 Important Notes

1. **Keep Server PC Running**: Your PC must stay on for others to access
2. **Same Network**: All users must be on the same network
3. **IP Address**: If your IP changes, rerun `setup_network_access.bat`
4. **Security**: System is protected by login authentication
5. **Performance**: Enable Redis for better performance

---

## 📋 Daily Operations

### Starting Work
1. Power on server PC
2. Run `start_system.bat`
3. Share URL: `http://10.70.4.186:3000` with team

### Ending Work
1. Close backend window
2. Close frontend window
3. Optionally shut down server PC (if not needed 24/7)

---

## 🎯 Success Criteria

You'll know it's working when:
- ✅ Two console windows open (backend and frontend)
- ✅ No error messages in windows
- ✅ You can access `http://localhost:3000` on server PC
- ✅ Others can access `http://10.70.4.186:3000` on their devices
- ✅ Login page appears and works correctly

---

**You're all set! Happy hosting! 🎉**

For detailed information, see: [NETWORK_DEPLOYMENT_GUIDE.md](NETWORK_DEPLOYMENT_GUIDE.md)
