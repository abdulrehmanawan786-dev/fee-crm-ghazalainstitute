#!/bin/bash
cd /var/www/ghazala-fee-crm
git pull origin main
cd client
npm run build
cd ../server
npm install
pm2 restart all
