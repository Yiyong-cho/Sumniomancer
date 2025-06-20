// Gemini AI API 設定
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
let GEMINI_API_KEY = 'AIzaSyDL12z-qYxT4uAv2v2hwjMHUe8iXcK0ETU';// <請填入您的API金鑰>

// 將音訊分析結果傳送給AI，取得建議或判斷
async function sendToAI(audioSummary) {
    if (!GEMINI_API_KEY) {
        alert('請先設定Gemini API金鑰！');
        return '';
    }
    const prompt = `請根據以下音訊分析結果，判斷目前音樂的節奏、重音、鼓點，並建議對應的LED燈號（1~5）應該如何亮起：\n${JSON.stringify(audioSummary)}`;
    try {
        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });
        if (!response.ok) throw new Error('AI API 請求失敗');
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (e) {
        console.error('AI API錯誤:', e);
        return '';
    }
}

// 取得所有音訊輸入裝置並填入下拉選單
async function populateAudioSources() {
    const select = document.getElementById('audioSource');
    select.innerHTML = '';
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(d => d.kind === 'audioinput');
        audioInputs.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.text = device.label || `音訊輸入裝置 (${device.deviceId.substr(0,6)})`;
            select.appendChild(option);
        });
    } catch (e) {
        select.innerHTML = '<option value="">無法取得音訊裝置</option>';
    }
}

// 音訊處理類別
class AudioProcessor {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.isProcessing = false;
        this.canvas = document.getElementById('audioVisualizer');
        this.canvasCtx = this.canvas.getContext('2d');
        this.frequencyData = null;
        this.arduino = null;
    }

    // 初始化音訊處理
    async init() {
        try {
            // 取得選擇的音訊來源
            const sourceId = document.getElementById('audioSource').value;
            const constraints = sourceId ? { audio: { deviceId: { exact: sourceId } } } : { audio: true };
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.analyser = this.audioContext.createAnalyser();
            
            // 設定FFT大小和平滑時間
            this.analyser.fftSize = 2048;
            this.analyser.smoothingTimeConstant = 0.8;
            
            this.microphone.connect(this.analyser);
            this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
            
            // 設定視覺化尺寸
            this.resizeCanvas();
            window.addEventListener('resize', () => this.resizeCanvas());
            
            return true;
        } catch (error) {
            console.error('音訊初始化失敗:', error);
            return false;
        }
    }

    // 調整canvas尺寸
    resizeCanvas() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
    }

    // 開始處理音訊
    start(arduino) {
        this.arduino = arduino;
        this.isProcessing = true;
        this.processAudio();
    }

    // 停止處理音訊
    stop() {
        this.isProcessing = false;
    }

    // 處理音訊並控制LED
    async processAudio() {
        if (!this.isProcessing) return;

        // 獲取頻率數據
        this.analyser.getByteFrequencyData(this.frequencyData);

        // 將頻率數據分為5個區段
        const sectionSize = Math.floor(this.frequencyData.length / 5);
        const sections = Array(5).fill(0);

        // 計算每個區段的平均能量
        for (let i = 0; i < this.frequencyData.length; i++) {
            const section = Math.floor(i / sectionSize);
            if (section < 5) {
                sections[section] += this.frequencyData[i];
            }
        }

        // 正規化每個區段的能量
        const maxEnergy = Math.max(...sections);
        const normalizedSections = sections.map(energy => energy / (sectionSize * 255));

        // --- 變動音量亮滅邏輯 ---
        if (!this.prevSections) {
            this.prevSections = normalizedSections.slice();
        }
        normalizedSections.forEach((energy, index) => {
            // 若本次能量大於上次，亮；否則滅
            if (energy > this.prevSections[index]) {
                document.getElementById(`led${index + 1}`).classList.add('active');
                if (this.arduino) {
                    this.arduino.sendLED(index + 1);
                }
            } else {
                document.getElementById(`led${index + 1}`).classList.remove('active');
            }
        });
        this.prevSections = normalizedSections.slice();

        // AI判斷（每2秒呼叫一次）
        const audioSummary = {
            sections,
            normalizedSections,
            maxEnergy
        };
        if (this.arduino && GEMINI_API_KEY) {
            if (!this.lastAISend || Date.now() - this.lastAISend > 2000) {
                this.lastAISend = Date.now();
                sendToAI(audioSummary).then(aiResult => {
                    try {
                        const leds = JSON.parse(aiResult);
                        for (let i = 1; i <= 5; i++) {
                            if (leds.includes(i)) {
                                document.getElementById(`led${i}`).classList.add('active');
                                this.arduino.sendLED(i);
                            } else {
                                document.getElementById(`led${i}`).classList.remove('active');
                            }
                        }
                    } catch {
                        // 若AI回應非陣列，忽略
                    }
                });
            }
        }

        // 繪製視覺化效果
        this.drawVisualization(normalizedSections);

        // 循環處理
        requestAnimationFrame(() => this.processAudio());
    }

    // 繪製音訊視覺化
    drawVisualization(normalizedSections) {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const barWidth = width / 5;

        this.canvasCtx.fillStyle = '#2a2a2a';
        this.canvasCtx.fillRect(0, 0, width, height);

        normalizedSections.forEach((energy, index) => {
            const barHeight = energy * height;
            
            this.canvasCtx.fillStyle = energy > 0.3 ? '#ff0000' : '#4a4a4a';
            this.canvasCtx.fillRect(
                index * barWidth,
                height - barHeight,
                barWidth - 2,
                barHeight
            );
        });
    }
}

// 初始化控制
document.addEventListener('DOMContentLoaded', () => {
    populateAudioSources();
    const processor = new AudioProcessor();
    const arduino = window.ArduinoController;
    
    document.getElementById('startBtn').addEventListener('click', async () => {
        const success = await processor.init();
        if (success) {
            processor.start(arduino);
            document.getElementById('status').textContent = '正在分析音訊...';
        } else {
            document.getElementById('status').textContent = '無法初始化音訊處理';
        }
    });
});
