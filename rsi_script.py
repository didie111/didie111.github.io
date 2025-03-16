import requests
import pandas as pd
import plotly.graph_objects as go
from datetime import datetime

# API 키 없는 무료 버전 (분당 10-30회 제한)
def get_historic_prices():
    url = "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart"
    params = {
        'vs_currency': 'usd',
        'days': '14',
        'interval': 'daily'
    }
    response = requests.get(url, params=params).json()
    return [price[1] for price in response['prices']]

def calculate_rsi(prices, period=14):
    df = pd.DataFrame(prices, columns=['price'])
    delta = df['price'].diff()
    
    gain = delta.where(delta > 0, 0)
    loss = -delta.where(delta < 0, 0)
    
    avg_gain = gain.rolling(period).mean()
    avg_loss = loss.rolling(period).mean()
    
    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    return rsi.iloc[-1]

def generate_chart(rsi_history):
    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=pd.date_range(end=datetime.now(), periods=len(rsi_history), 
        y=rsi_history,
        mode='lines+markers',
        name='RSI'
    ))
    fig.add_hline(y=70, line_dash="dot", line_color="red")
    fig.add_hline(y=30, line_dash="dot", line_color="green")
    fig.update_layout(title='비트코인 14일 RSI 추이')
    fig.write_html("rsi_chart.html")

if __name__ == "__main__":
    prices = get_historic_prices()
    current_rsi = calculate_rsi(prices)
    
    # RSI 기록 업데이트
    try:
        existing = pd.read_csv('rsi_history.csv')
    except:
        existing = pd.DataFrame(columns=['timestamp', 'rsi'])
    
    new_entry = pd.DataFrame({
        'timestamp': [datetime.now()],
        'rsi': [current_rsi]
    })
    updated = pd.concat([existing, new_entry]).tail(50)  # 최근 50개 저장
    updated.to_csv('rsi_history.csv', index=False)
    
    generate_chart(updated['rsi'].tolist())
