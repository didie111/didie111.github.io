import requests
import pandas as pd

def get_bitcoin_price():
    url = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"
    response = requests.get(url).json()
    return response['bitcoin']['usd']

def calculate_rsi(prices, period=14):
    delta = pd.Series(prices).diff()
    gain = delta.where(delta > 0, 0)
    loss = -delta.where(delta < 0, 0)
    
    avg_gain = gain.rolling(period).mean()
    avg_loss = loss.rolling(period).mean()
    
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))

# 실행 부분
if __name__ == "__main__":
    price = get_bitcoin_price()
    # 임시 가격 데이터 (실제로는 API에서 과거 데이터 가져와야 함)
    prices = [50000, 51000, 52000, 53000, 54000, 53000, 52000]  
    current_rsi = calculate_rsi(prices)[-1]
    print(f"현재 RSI: {current_rsi}")
