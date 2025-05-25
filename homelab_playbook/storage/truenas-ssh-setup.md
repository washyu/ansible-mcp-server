# TrueNAS SSH Configuration Steps

To enable password authentication for SSH on TrueNAS:

1. **Access TrueNAS Web UI**
   - Go to: http://192.168.10.164
   - Login with truenas_admin / Tenchi01!

2. **Navigate to SSH Service**
   - Go to: System → Services
   - Find SSH service
   - Click the pencil/edit icon

3. **Enable Password Authentication**
   - Check "Allow Password Authentication"
   - Ensure "Allow TCP Port Forwarding" is checked if needed
   - Make sure SSH is listening on port 22
   - Click Save

4. **Start/Restart SSH Service**
   - Toggle the SSH service off and on
   - Or click Start if it's not running

5. **Alternative: Add SSH Key via UI**
   - Go to: Accounts → Users
   - Edit truenas_admin user
   - In the SSH Public Key field, paste this key:

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDu4P1Z8C5b4s+SuQ9pLPy6pASkeD6PdOzbfUcVVSWJ1 shaun@homelab2
```

After making these changes, we can test the connection again.