@echo off
echo === EOD Refresh - Chunk 1 (RE HDFCBANK INFY ICICIBANK) ===
curl -s --max-time 30 -X POST https://nirajstock.vercel.app/api/admin/refresh-eod -H "Content-Type: application/json" -d "{\"secret\":\"stockpulse-eod\",\"symbols\":[\"RELIANCE\",\"TCS\",\"HDFCBANK\",\"INFY\",\"ICICIBANK\"]}"
echo.

echo === EOD Refresh - Chunk 2 (HINDUNILVR SBIN BHARTIARTL ITC KOTAKBANK) ===
curl -s --max-time 30 -X POST https://nirajstock.vercel.app/api/admin/refresh-eod -H "Content-Type: application/json" -d "{\"secret\":\"stockpulse-eod\",\"symbols\":[\"HINDUNILVR\",\"SBIN\",\"BHARTIARTL\",\"ITC\",\"KOTAKBANK\"]}"
echo.

echo === EOD Refresh - Chunk 3 (LT AXISBANK ASIANPAINT MARUTI SUNPHARMA) ===
curl -s --max-time 30 -X POST https://nirajstock.vercel.app/api/admin/refresh-eod -H "Content-Type: application/json" -d "{\"secret\":\"stockpulse-eod\",\"symbols\":[\"LT\",\"AXISBANK\",\"ASIANPAINT\",\"MARUTI\",\"SUNPHARMA\"]}"
echo.

echo === EOD Refresh - Chunk 4 (TITAN BAJFINANCE HCLTECH WIPRO TATAMOTORS) ===
curl -s --max-time 30 -X POST https://nirajstock.vercel.app/api/admin/refresh-eod -H "Content-Type: application/json" -d "{\"secret\":\"stockpulse-eod\",\"symbols\":[\"TITAN\",\"BAJFINANCE\",\"HCLTECH\",\"WIPRO\",\"TATAMOTORS\"]}"
echo.

echo === EOD Refresh - Chunk 5 (ULFINSV) ===
curl -s --max-time 30 -X POST https://nirajstock.vercel.app/api/admin/refresh-eod -H "Content-Type: application/json" -d "{\"secret\":\"stockpulse-eod\",\"symbols\":[\"ULTRACEMCO\",\"POWERGRID\",\"NTPC\",\"NESTLEIND\",\"BAJAJFINSV\"]}"
echo.

echo === EOD Refresh - Chunk 6 (JSWSTEEL HINDALCO ADANIENT ADANIPORTS ONGC) ===
curl -s --max-time 30 -X POST https://nirajstock.vercel.app/api/admin/refresh-eod -H "Content-Type: application/json" -d "{\"secret\":\"stockpulse-eod\",\"symbols\":[\"JSWSTEEL\",\"HINDALCO\",\"ADANIENT\",\"ADANIPORTS\",\"ONGC\"]}"
echo.

echo === EOD Refresh - Chunk 7 (COALINDIA TATASTEEL TECHM GRASIM INDUSINDBK) ===
curl -s --max-time 30 -X POST https://nirajstock.vercel.app/api/admin/refresh-eod -H "Content-Type: application/json" -d "{\"secret\":\"stockpulse-eod\",\"symbols\":[\"COALINDIA\",\"TATASTEEL\",\"TECHM\",\"GRASIM\",\"INDUSINDBK\"]}"
echo.

echo === EOD Refresh - Chunk 8 (CIPLA DRREDDY EICHERMOT HEROMOTOCO BPCL) ===
curl -s --max-time 30 -X POST https://nirajstock.vercel.app/api/admin/refresh-eod -H "Content-Type: application/json" -d "{\"secret\":\"stockpulse-eod\",\"symbols\":[\"CIPLA\",\"DRREDDY\",\"EICHERMOT\",\"HEROMOTOCO\",\"BPCL\"]}"
echo.

echo === EOD Refresh - Chunk 9 (TANNIA SBILIFE) ===
curl -s --max-time 30 -X POST https://nirajstock.vercel.app/api/admin/refresh-eod -H "Content-Type: application/json" -d "{\"secret\":\"stockpulse-eod\",\"symbols\":[\"TATACONSUM\",\"APOLLOHOSP\",\"DIVISLAB\",\"BRITANNIA\",\"SBILIFE\"]}"
echo.

echo === EOD Refresh - Chunk 10 (HDFCLIFE SHREECEM LICI BEL IRFC) ===
curl -s --max-time 30 -X POST https://nirajstock.vercel.app/api/admin/refresh-eod -H "Content-Type: application/json" -d "{\"secret\":\"stockpulse-eod\",\"symbols\":[\"HDFCLIFE\",\"SHREECEM\",\"LICI\",\"BEL\",\"IRFC\"]}"
echo.

echo === EOD Refresh - Chunk 11 (LTIM CGPOWER BHEL ZOMATO DLF) ===
curl -s --max-time 30 -X POST https://nirajstock.vercel.app/api/admin/refresh-eod -H "Content-Type: application/json" -d "{\"secret\":\"stockpulse-eod\",\"symbols\":[\"LTIM\",\"CGPOWER\",\"BHEL\",\"ZOMATO\",\"DLF\"]}"
echo.

echo === EOD Refresh - Chunk 12 (BANKBARODA AMBUJACEM CHOLAFIN HDFCAMC IDFCFIRSTB) ===
curl -s --max-time 30 -X POST https://nirajstock.vercel.app/api/admin/refresh-eod -H "Content-Type: application/json" -d "{\"secret\":\"stockpulse-eod\",\"symbols\":[\"BANKBARODA\",\"AMBUJACEM\",\"CHOLAFIN\",\"HDFCAMC\",\"IDFCFIRSTB\"]}"
echo.

echo === EOD Refresh - Chunk 13 (FEDERALBNK AUBANK BANDHANBNK CANBK PNB) ===
curl -s --max-time 30 -X POST https://nirajstock.vercel.app/api/admin/refresh-eod -H "Content-Type: application/json" -d "{\"secret\":\"stockpulse-eod\",\"symbols\":[\"FEDERALBNK\",\"AUBANK\",\"BANDHANBNK\",\"CANBK\",\"PNB\"]}"
echo.

echo === EOD Refresh - Chunk 14 (RECLTD SAIL VEDL NMDC GAIL) ===
curl -s --max-time 30 -X POST https://nirajstock.vercel.app/api/admin/refresh-eod -H "Content-Type: application/json" -d "{\"secret\":\"stockpulse-eod\",\"symbols\":[\"RECLTD\",\"SAIL\",\"VEDL\",\"NMDC\",\"GAIL\"]}"
echo.

echo === EOD Refresh - Chunk 15 (IOC HINDPETRO IGL GSPL BAJAJ-AUTO) ===
curl -s --max-time 30 -X POST https://nirajstock.vercel.app/api/admin/refresh-eod -H "Content-Type: application/json" -d "{\"secret\":\"stockpulse-eod\",\"symbols\":[\"IOC\",\"HINDPETRO\",\"IGL\",\"GSPL\",\"BAJAJ-AUTO\"]}"
DIA\"]}"
echo.

echo === Final Status ===
curl -s --max-time 15 https://nirajstock.vercel.app/api/admin/refresh-eod/status
0 -X POST https://nirajstock.vercel.app/api/admin/refresh-eod -H "Content-Type: application/json" -d "{\"secret\":\"stockpulse-eod\",\"symbols\":[\"ADANITRANS\",\"INOXWIND\",\"INDUSTOWER\",\"GODREJPROP\",\"GODREJCP\"]}"
echo.

echo === EOD Refresh - Chunk 28 (DABUR MARICO COLPAL ABFRL BATAINDIA) ===
curl -s --max-time 30 -X POST https://nirajstock.vercel.app/api/admin/refresh-eod -H "Content-Type: application/json" -d "{\"secret\":\"stockpulse-eod\",\"symbols\":[\"DABUR\",\"MARICO\",\"COLPAL\",\"ABFRL\",\"BATAIN\"symbols\":[\"KAJARIACER\",\"JKCEMENT\",\"ASTRAL\",\"KEC\",\"SIEMENS\"]}"
echo.

echo === EOD Refresh - Chunk 26 (HAVELLS CROMPTON VOLTAS JSWENERGY ADANIGREEN) ===
curl -s --max-time 30 -X POST https://nirajstock.vercel.app/api/admin/refresh-eod -H "Content-Type: application/json" -d "{\"secret\":\"stockpulse-eod\",\"symbols\":[\"HAVELLS\",\"CROMPTON\",\"VOLTAS\",\"JSWENERGY\",\"ADANIGREEN\"]}"
echo.

echo === EOD Refresh - Chunk 27 (ADANITRANS INOXWIND INDUSTOWER GODREJPROP GODREJCP) ===
curl -s --max-time 324 (SRF ATUL PIDILITIND BERGEPAINT KANSAINER) ===
curl -s --max-time 30 -X POST https://nirajstock.vercel.app/api/admin/refresh-eod -H "Content-Type: application/json" -d "{\"secret\":\"stockpulse-eod\",\"symbols\":[\"SRF\",\"ATUL\",\"PIDILITIND\",\"BERGEPAINT\",\"KANSAINER\"]}"
echo.

echo === EOD Refresh - Chunk 25 (KAJARIACER JKCEMENT ASTRAL KEC SIEMENS) ===
curl -s --max-time 30 -X POST https://nirajstock.vercel.app/api/admin/refresh-eod -H "Content-Type: application/json" -d "{\"secret\":\"stockpulse-eod\",fresh-eod -H "Content-Type: application/json" -d "{\"secret\":\"stockpulse-eod\",\"symbols\":[\"LUPIN\",\"ALKEM\",\"IPCALAB\",\"LALPATHLAB\",\"LAURUSLABS\"]}"
echo.

echo === EOD Refresh - Chunk 23 (GRANULES GLENMARK FORTIS MAXHEALTH DEEPAKNTR) ===
curl -s --max-time 30 -X POST https://nirajstock.vercel.app/api/admin/refresh-eod -H "Content-Type: application/json" -d "{\"secret\":\"stockpulse-eod\",\"symbols\":[\"GRANULES\",\"GLENMARK\",\"FORTIS\",\"MAXHEALTH\",\"DEEPAKNTR\"]}"
echo.

echo === EOD Refresh - Chunk N\",\"MANAPPURAM\",\"MCX\"]}"
echo.

echo === EOD Refresh - Chunk 21 (ABCAPITAL LICHSGFIN CANFINHOME BIOCON AUROPHARMA) ===
curl -s --max-time 30 -X POST https://nirajstock.vercel.app/api/admin/refresh-eod -H "Content-Type: application/json" -d "{\"secret\":\"stockpulse-eod\",\"symbols\":[\"ABCAPITAL\",\"LICHSGFIN\",\"CANFINHOME\",\"BIOCON\",\"AUROPHARMA\"]}"
echo.

echo === EOD Refresh - Chunk 22 (LUPIN ALKEM IPCALAB LALPATHLAB LAURUSLABS) ===
curl -s --max-time 30 -X POST https://nirajstock.vercel.app/api/admin/re=
curl -s --max-time 30 -X POST https://nirajstock.vercel.app/api/admin/refresh-eod -H "Content-Type: application/json" -d "{\"secret\":\"stockpulse-eod\",\"symbols\":[\"KPITTECH\",\"COFORGE\",\"LTTS\",\"NAUKRI\",\"PAYTM\"]}"
echo.

echo === EOD Refresh - Chunk 20 (NYKAA POLICYBZR MUTHOOTFIN MANAPPURAM MCX) ===
curl -s --max-time 30 -X POST https://nirajstock.vercel.app/api/admin/refresh-eod -H "Content-Type: application/json" -d "{\"secret\":\"stockpulse-eod\",\"symbols\":[\"NYKAA\",\"POLICYBZR\",\"MUTHOOTFIlication/json" -d "{\"secret\":\"stockpulse-eod\",\"symbols\":[\"BOSCHLTD\",\"TRENT\",\"INDHOTEL\",\"JUBLFOOD\",\"IRCTC\"]}"
echo.

echo === EOD Refresh - Chunk 18 (INDIGO DELHIVERY GMRINFRA CONCOR DIXON) ===
curl -s --max-time 30 -X POST https://nirajstock.vercel.app/api/admin/refresh-eod -H "Content-Type: application/json" -d "{\"secret\":\"stockpulse-eod\",\"symbols\":[\"INDIGO\",\"DELHIVERY\",\"GMRINFRA\",\"CONCOR\",\"DIXON\"]}"
echo.

echo === EOD Refresh - Chunk 19 (KPITTECH COFORGE LTTS NAUKRI PAYTM) ==cho.

echo === EOD Refresh - Chunk 16 (BALKRISIND BHARATFORG ESCORTS EXIDEIND CEATLTD) ===
curl -s --max-time 30 -X POST https://nirajstock.vercel.app/api/admin/refresh-eod -H "Content-Type: application/json" -d "{\"secret\":\"stockpulse-eod\",\"symbols\":[\"BALKRISIND\",\"BHARATFORG\",\"ESCORTS\",\"EXIDEIND\",\"CEATLTD\"]}"
echo.

echo === EOD Refresh - Chunk 17 (BOSCHLTD TRENT INDHOTEL JUBLFOOD IRCTC) ===
curl -s --max-time 30 -X POST https://nirajstock.vercel.app/api/admin/refresh-eod -H "Content-Type: appe