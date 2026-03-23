@echo off
curl -s --max-time 60 -X POST https://nirajstock.vercel.app/api/admin/refresh-eod -H "Content-Type: application/json" -d "{\"secret\":\"stockpulse-eod\",\"symbols\":[\"RELIANCE\",\"TCS\",\"HDFCBANK\",\"INFY\",\"ICICIBANK\"]}"
