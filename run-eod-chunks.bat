@echo off
echo === EOD Refresh - Chunk 1 ===
curl -s --max-time 30 -X POST https://nirajstock.vercel.app/api/admin/refresh-eod -H "Content-Type: application/json" -d "{\"secret\":\"stockpulse-eod\",\"symbols\":[\"RELIANCE\",\"TCS\",\"HDFCBANK\",\"INFY\",\"ICICIBANK\",\"HINDUNILVR\",\"SBIN\",\"BHARTIARTL\",\"ITC\",\"KOTAKBANK\",\"LT\",\"AXISBANK\",\"ASIANPAINT\",\"MARUTI\",\"SUNPHARMA\"]}"
echo.

echo === EOD Refresh - Chunk 2 ===
curl -s --max-time 30 -X POST https://nirajstock.vercel.app/api/admin/refresh-eod -H "Content-Type: application/json" -d "{\"secret\":\"stockpulse-eod\",\"symbols\":[\"TITAN\",\"BAJFINANCE\",\"HCLTECH\",\"WIPRO\",\"TATAMOTORS\",\"ULTRACEMCO\",\"POWERGRID\",\"NTPC\",\"NESTLEIND\",\"BAJAJFINSV\",\"JSWSTEEL\",\"HINDALCO\",\"ADANIENT\",\"ADANIPORTS\",\"ONGC\"]}"
echo.

echo === EOD Refresh - Chunk 3 ===
curl -s --max-time 30 -X POST https://nirajstock.vercel.app/api/admin/refresh-eod -H "Content-Type: application/json" -d "{\"secret\":\"stockpulse-eod\",\"symbols\":[\"COALINDIA\",\"TATASTEEL\",\"TECHM\",\"GRASIM\",\"INDUSINDBK\",\"CIPLA\",\"DRREDDY\",\"EICHERMOT\",\"HEROMOTOCO\",\"BPCL\",\"TATACONSUM\",\"APOLLOHOSP\",\"DIVISLAB\",\"BRITANNIA\",\"SBILIFE\"]}"
echo.

echo === EOD Refresh - Chunk 4 ===
curl -s --max-time 30 -X POST https://nirajstock.vercel.app/api/admin/refresh-eod -H "Content-Type: application/json" -d "{\"secret\":\"stockpulse-eod\",\"symbols\":[\"HDFCLIFE\",\"SHREECEM\",\"LICI\",\"BEL\",\"IRFC\",\"LTIM\",\"CGPOWER\",\"BHEL\",\"ZOMATO\",\"DLF\",\"BANKBARODA\",\"AMBUJACEM\",\"CHOLAFIN\",\"HDFCAMC\",\"IDFCFIRSTB\"]}"
echo.

echo === EOD Refresh - Chunk 5 ===
curl -s --max-time 30 -X POST https://nirajstock.vercel.app/api/admin/refresh-eod -H "Content-Type: application/json" -d "{\"secret\":\"stockpulse-eod\",\"symbols\":[\"FEDERALBNK\",\"AUBANK\",\"BANDHANBNK\",\"CANBK\",\"PNB\",\"RECLTD\",\"SAIL\",\"VEDL\",\"NMDC\",\"GAIL\",\"IOC\",\"HINDPETRO\",\"IGL\",\"GSPL\",\"BAJAJ-AUTO\"]}"
echo.

echo === EOD Refresh - Chunk 6 ===
curl -s --max-time 30 -X POST https://nirajstock.vercel.app/api/admin/refresh-eod -H "Content-Type: application/json" -d "{\"secret\":\"stockpulse-eod\",\"symbols\":[\"BALKRISIND\",\"BHARATFORG\",\"ESCORTS\",\"EXIDEIND\",\"CEATLTD\",\"BOSCHLTD\",\"TRENT\",\"INDHOTEL\",\"JUBLFOOD\",\"IRCTC\",\"INDIGO\",\"DELHIVERY\",\"GMRINFRA\",\"CONCOR\",\"DIXON\"]}"
echo.

echo === EOD Refresh - Chunk 7 ===
curl -s --max-time 30 -X POST https://nirajstock.vercel.app/api/admin/refresh-eod -H "Content-Type: application/json" -d "{\"secret\":\"stockpulse-eod\",\"symbols\":[\"KPITTECH\",\"COFORGE\",\"LTTS\",\"NAUKRI\",\"PAYTM\",\"NYKAA\",\"POLICYBZR\",\"MUTHOOTFIN\",\"MANAPPURAM\",\"MCX\",\"ABCAPITAL\",\"LICHSGFIN\",\"CANFINHOME\",\"BIOCON\",\"AUROPHARMA\"]}"
echo.

echo === EOD Refresh - Chunk 8 ===
curl -s --max-time 30 -X POST https://nirajstock.vercel.app/api/admin/refresh-eod -H "Content-Type: application/json" -d "{\"secret\":\"stockpulse-eod\",\"symbols\":[\"LUPIN\",\"ALKEM\",\"IPCALAB\",\"LALPATHLAB\",\"LAURUSLABS\",\"GRANULES\",\"GLENMARK\",\"FORTIS\",\"MAXHEALTH\",\"DEEPAKNTR\",\"SRF\",\"ATUL\",\"PIDILITIND\",\"BERGEPAINT\",\"KANSAINER\"]}"
echo.

echo === EOD Refresh - Chunk 9 ===
curl -s --max-time 30 -X POST https://nirajstock.vercel.app/api/admin/refresh-eod -H "Content-Type: application/json" -d "{\"secret\":\"stockpulse-eod\",\"symbols\":[\"KAJARIACER\",\"JKCEMENT\",\"ASTRAL\",\"KEC\",\"SIEMENS\",\"HAVELLS\",\"CROMPTON\",\"VOLTAS\",\"JSWENERGY\",\"ADANIGREEN\",\"ADANITRANS\",\"INOXWIND\",\"INDUSTOWER\",\"GODREJPROP\",\"GODREJCP\"]}"
echo.

echo === EOD Refresh - Chunk 10 ===
curl -s --max-time 30 -X POST https://nirajstock.vercel.app/api/admin/refresh-eod -H "Content-Type: application/json" -d "{\"secret\":\"stockpulse-eod\",\"symbols\":[\"DABUR\",\"MARICO\",\"COLPAL\",\"ABFRL\",\"BATAINDIA\",\"PAGEIND\",\"UBL\",\"MCDOWELL-N\",\"JUBILANT\",\"PIIND\",\"TORNTPHARM\",\"AIAENG\",\"HONAUT\",\"CUMMINSIND\",\"JSWENERGY\"]}"
echo.

echo === Final Status ===
curl -s --max-time 15 https://nirajstock.vercel.app/api/admin/refresh-eod/status
