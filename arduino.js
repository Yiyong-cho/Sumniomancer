// Arduino控制類別
class ArduinoController {
    constructor() {
        this.port = null;
        this.writer = null;
        this.reader = null;
        this.isConnected = false;
    }

    // 連接到Arduino
    async connect() {
        try {
            // 請求串口訪問權限
            this.port = await navigator.serial.requestPort();
            await this.port.open({ baudRate: 9600 });

            this.writer = this.port.writable.getWriter();
            this.reader = this.port.readable.getReader();
            
            this.isConnected = true;
            document.getElementById('status').textContent = 'Arduino已連接';
            
            // 開始讀取串口數據
            this.startReading();
            
            return true;
        } catch (error) {
            console.error('Arduino連接失敗:', error);
            document.getElementById('status').textContent = 'Arduino連接失敗';
            return false;
        }
    }

    // 持續讀取串口數據
    async startReading() {
        while (this.isConnected) {
            try {
                const { value, done } = await this.reader.read();
                if (done) {
                    break;
                }
                // 處理來自Arduino的數據
                console.log('收到Arduino數據:', value);
            } catch (error) {
                console.error('讀取串口失敗:', error);
                break;
            }
        }
    }

    // 發送LED控制指令
    async sendLED(ledNumber) {
        if (!this.isConnected) return;
        
        try {
            // 發送LED編號 (1-5)
            const data = new Uint8Array([ledNumber.toString().charCodeAt(0)]);
            await this.writer.write(data);
        } catch (error) {
            console.error('發送LED指令失敗:', error);
        }
    }

    // 關閉連接
    async disconnect() {
        if (this.writer) {
            await this.writer.releaseLock();
        }
        if (this.reader) {
            await this.reader.releaseLock();
        }
        if (this.port) {
            await this.port.close();
        }
        this.isConnected = false;
    }
}

// 初始化Arduino控制器
window.ArduinoController = new ArduinoController();

// 設置連接按鈕事件
document.getElementById('connectBtn').addEventListener('click', async () => {
    const arduino = window.ArduinoController;
    if (!arduino.isConnected) {
        await arduino.connect();
    }
});
