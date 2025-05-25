# Quick Setup Tasks While Waiting for DNS

## 1. Password Changes (Priority!)
- [ ] NPM: http://192.168.10.108:81
- [ ] Keycloak: http://192.168.10.108:8090
- [ ] Poste.io: http://192.168.10.108:8085
- [ ] Grafana: http://192.168.10.108:3000

## 2. Fix Prometheus
```bash
# Copy fixed config
docker cp /tmp/fix-prometheus.yml prometheus:/etc/prometheus/prometheus.yml
docker restart prometheus
```

## 3. Configure Services

### Nginx Proxy Manager
- [ ] Change admin password
- [ ] Add SSL certificate settings
- [ ] Configure default site

### Poste.io Mail
- [ ] Complete setup wizard
- [ ] Create admin@shaunjackson.space
- [ ] Configure spam settings

### Keycloak
- [ ] Change admin password
- [ ] Create 'homelab' realm
- [ ] Add your user account

### Heimdall
- [ ] Add all service tiles
- [ ] Organize by category
- [ ] Set as browser homepage

## 4. Network Security
- [ ] Check firewall rules on linuxrwifi
- [ ] Verify only needed ports are open
- [ ] Consider fail2ban installation

## 5. Backup Strategy
- [ ] Document what needs backing up
- [ ] Plan backup locations
- [ ] Schedule regular backups

## 6. Monitoring Setup
- [ ] Fix Prometheus config
- [ ] Add all servers to monitoring
- [ ] Create Grafana dashboards
- [ ] Set up alerts

## 7. Documentation
- [ ] Create network diagram
- [ ] Document all services
- [ ] Create runbook for common tasks
- [ ] Password manager setup