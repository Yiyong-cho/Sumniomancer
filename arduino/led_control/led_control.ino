// 使用 Firmata 協議
// 讓 Arduino 能夠接收來自網頁的控制指令

int sensitivity = 100; // 靈敏度預設值(0~1023)

void setup() {
  // 設定 LED 腳位為輸出
  for(int i = 2; i <= 6; i++) {
    pinMode(i, OUTPUT);
  }
  // 初始化串口通訊，波特率設為 9600
  Serial.begin(9600);
}

void loop() {
  // 讀取可變電阻(假設接A0)
  sensitivity = analogRead(A0); // 0~1023
  // 將其轉換為LED觸發門檻(例如: map到20~800)
  int ledThreshold = map(sensitivity, 0, 1023, 20, 800);

  if(Serial.available() > 0) {
    // 讀取一個字節的數據
    char data = Serial.read();
    
    // 根據接收到的數據控制LED
    switch(data) {
      case '1':
        if (ledThreshold < 200) digitalWrite(2, HIGH); // 靈敏度高時才亮
        break;
      case '2':
        if (ledThreshold < 400) digitalWrite(3, HIGH);
        break;
      case '3':
        if (ledThreshold < 600) digitalWrite(4, HIGH);
        break;
      case '4':
        if (ledThreshold < 700) digitalWrite(5, HIGH);
        break;
      case '5':
        if (ledThreshold < 800) digitalWrite(6, HIGH);
        break;
      case '0':
        // 關閉所有LED
        for(int i = 2; i <= 6; i++) {
          digitalWrite(i, LOW);
        }
        break;
    }
    
    // 短暫延遲以防止LED閃爍過快
    delay(50);
  }
  
  // 每次循環結束後關閉所有LED
  for(int i = 2; i <= 6; i++) {
    digitalWrite(i, LOW);
  }
}
