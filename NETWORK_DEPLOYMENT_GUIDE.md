# 🌐 Network Deployment Guide - Time Attendance System

## Your Server PC Information
- **Server IP Address**: `10.70.4.186`
- **Backend Port**: `5000`
- **Frontend Port**: `3000`

## 📋 Quick Access URLs

### For Users on Your Network:
- **Main Application**: `http://10.70.4.186:3000`
- **Backend API**: `http://10.70.4.186:5000`

### On This Server PC:
- **Main Application**: `http://localhost:3000`
- **Backend API**: `http://localhost:5000`

---

## 🚀 Quick Start Deployment

### Step 1: Configure Backend for Network Access
The backend is already configured to accept connections from your network IP.

### Step 2: Configure Frontend for Network Access  
Run the setup script to update frontend configuration:
```batch
setup_network_access.bat
```

### Step 3: Start the System
```batch
start_system.bat
```

### Step 4: Access from Other Computers
On any computer in the same network, open a browser and go to:
```
http://10.70.4.186:3000
```

---

## 🔧 Manual Setup Instructions

### Backend Configuration (Already Done ✓)
Your `.env` file already includes network access:
```
CORS_ORIGIN=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000,http://10.70.4.186:3000
```

### Frontend Configuration (Run Setup Script)
The frontend needs to know the backend API URL. The setup script will:
1. Create/update `.env` file in frontend folder
2. Set backend URL to your network IP
3. Configure proper API endpoints

### Firewall Configuration
Windows Firewall needs to allow incoming connections:
1. Open **Windows Defender Firewall**
2. Click **Advanced settings**
3. Click **Inbound Rules** → **New Rule**
4. Select **Port** → Next
5. Select **TCP** and enter ports: `3000, 5000`
6. Select **Allow the connection**
7. Apply to all profiles (Domain, Private, Public)
8. Name it: "Time Attendance System"

**OR** Run this PowerShell command as Administrator:
```powershell
New-NetFirewallRule -DisplayName "Time Attendance System" -Direction Inbound -Protocol TCP -LocalPort 3000,5000 -Action Allow
```

---

## 📱 Access from Different Devices

### Desktop Computers on Same Network
```
http://10.70.4.186:3000
```

### Mobile Devices (Smartphones/Tablets)
1. Connect mobile to the same WiFi network
2. Open mobile browser
3. Enter: `http://10.70.4.186:3000`

### Different Network/Remote Access
For access from outside your local network, you'll need:
1. **Port Forwarding** on your router (forward ports 3000, 5000)
2. **Static IP** or **Dynamic DNS** service
3. **Security considerations** (HTTPS, authentication)

---

## 🔐 Security Recommendations

### For Local Network (Current Setup)
- ✅ System is accessible only within your local network
- ✅ Users need login credentials
- ✅ Role-based access control is active

### For Internet Access (Future)
If you want to make this accessible from the internet:
1. **Use HTTPS** (SSL certificate required)
2. **Strong passwords** for all users
3. **Firewall rules** to restrict access
4. **Regular backups** of database
5. **Consider using a reverse proxy** (nginx or IIS)

---

## 🔧 Troubleshooting

### Problem: Cannot access from other computers
**Solutions:**
1. Check Windows Firewall settings
2. Verify both computers are on same network
3. Try pinging the server: `ping 10.70.4.186`
4. Ensure backend and frontend are running
5. Check if antivirus is blocking connections

### Problem: "Cannot connect to backend"
**Solutions:**
1. Ensure backend is running on port 5000
2. Check backend .env file has correct CORS settings
3. Verify frontend .env has correct API URL

### Problem: Login not working
**Solutions:**
1. Clear browser cache
2. Check backend logs for errors
3. Verify MySQL database is running
4. Check Redis is running (if enabled)

### Problem: Slow performance
**Solutions:**
1. Enable Redis caching (already configured)
2. Check database indexes are applied
3. Monitor server resources (CPU, RAM)
4. Limit concurrent users if needed

---

## 📊 System Requirements

### Server PC (Your Current PC)
- ✅ Windows OS
- ✅ Node.js installed
- ✅ MySQL server running
- ✅ Redis server running (optional but recommended)
- 📌 Keep the server PC running for 24/7 access

### Client Devices
- Any modern web browser (Chrome, Firefox, Edge, Safari)
- Network connection to your local network
- No installation required

---

## 🛠️ Maintenance

### Daily Operations
- Server PC must remain powered on
- MySQL service must be running
- Backend and Frontend must be running

### Starting the System
Use the provided batch files:
```batch
start_system.bat
```

### Stopping the System
Press `Ctrl+C` in each terminal window or close them

### Automatic Startup (Optional)
To make the system start automatically when the PC boots:
1. Use the `install_windows_service.bat` script (if created)
2. Or add batch files to Windows startup folder

---

## 📞 Support

### Check System Status
- Backend: `http://10.70.4.186:5000/health` (if endpoint exists)
- Frontend: `http://10.70.4.186:3000`

### Logs Location
- Backend logs: Check terminal window
- MySQL logs: Check MySQL data directory
- Redis logs: Check Redis installation directory

---

## ⚡ Performance Tips

1. **Enable Redis Caching** (already configured in your .env)
2. **Apply Database Indexes** - Run: `apply_indexes.bat`
3. **Use Modern Browser** - Chrome or Edge recommended
4. **Limit Browser Tabs** - Close unused tabs
5. **Regular Database Maintenance** - Clean old logs periodically

---

## 🌟 Next Steps

1. ✅ Run `setup_network_access.bat`
2. ✅ Configure Windows Firewall
3. ✅ Start the system with `start_system.bat`
4. ✅ Test access from another device: `http://10.70.4.186:3000`
5. ✅ Share URL with your team members

---

**Your System is Ready for Network Access! 🎉**
