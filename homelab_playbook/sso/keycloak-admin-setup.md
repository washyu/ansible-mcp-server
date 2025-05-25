# Setting Up Admin Privileges in Keycloak

## Option 1: Using Realm Roles (Recommended)

### Step 1: Create Admin Role
1. In Keycloak (homelab realm)
2. Left menu → Realm roles → Create role
3. Fill in:
   - Role name: `admin`
   - Description: `Administrator role for all services`
4. Click Save

### Step 2: Assign Role to Your User
1. Left menu → Users
2. Click on `shaun`
3. Go to "Role mapping" tab
4. Click "Assign role"
5. Filter by: "Filter by realm roles"
6. Select `admin`
7. Click Assign

## Option 2: Using Groups (Better for Multiple Users)

### Step 1: Create Admin Group
1. Left menu → Groups → Create group
2. Name: `admins`
3. Click Create

### Step 2: Add User to Group
1. Still in Groups → Click `admins`
2. Members tab → Add member
3. Search for `shaun`
4. Select and click Add

### Step 3: Assign Roles to Group
1. In the admins group
2. Role mapping tab
3. Assign role → Filter by realm roles
4. Create and assign an `admin` role if not exists

## Configure Services to Recognize Admin Role

### For Grafana:
The config line we'll add handles this:
```
role_attribute_path = contains(groups[*], 'admins') && 'Admin' || 'Viewer'
```
This means: If user is in 'admins' group → Grafana Admin, otherwise → Viewer

### For Portainer:
Portainer can map groups/roles in its OAuth settings

## Quick Method - Just Grafana Admin

If you just want Grafana admin access without setting up roles:

1. In Grafana's OAuth config, change:
```
role_attribute_path = email == 'shaun@shaunjackson.space' && 'Admin' || 'Viewer'
```

This gives admin access based on your email address.