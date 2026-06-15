class VideoProcessor {
    constructor(videoElement, canvasElement) {
        this.video = videoElement;
        this.canvas = canvasElement;
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        this.samplingPoints = [];
        for (let y = 0.25; y <= 0.75; y += 0.25) {
            for (let x = 0.2; x <= 0.8; x += 0.2) {
                this.samplingPoints.push({ x, y });
            }
        }
        this.currentData = [];
        this.brightness = 1.0;
        this.currentStream = null;
    }

    setBrightness(value) {
        this.brightness = value;
        this.video.style.filter = `brightness(${value})`;
    }

    async getVideoDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.filter(device => device.kind === 'videoinput');
        } catch (err) {
            console.error("Error enumerating devices:", err);
            return [];
        }
    }

    async init(deviceId = null) {
        try {
            // 既存のストリームがあれば停止
            this.stop();

            const constraints = {
                video: { 
                    width: 640, 
                    height: 480,
                    deviceId: deviceId ? { exact: deviceId } : undefined
                },
                audio: false
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = stream;
            this.currentStream = stream;
            
            return new Promise((resolve) => {
                this.video.onloadedmetadata = () => {
                    this.canvas.width = this.video.videoWidth;
                    this.canvas.height = this.video.videoHeight;
                    resolve(true);
                };
            });
        } catch (err) {
            console.error("Camera access error:", err);
            return false;
        }
    }

    stop() {
        if (this.currentStream) {
            this.currentStream.getTracks().forEach(track => track.stop());
            this.currentStream = null;
        }
    }

    process() {
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        this.ctx.clearRect(0, 0, width, height);
        
        const newData = [];

        if (!this.offscreenCanvas) {
            this.offscreenCanvas = document.createElement('canvas');
            this.offscreenCanvas.width = width;
            this.offscreenCanvas.height = height;
            this.offscreenCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });
        }
        
        if (this.offscreenCanvas.width !== width || this.offscreenCanvas.height !== height) {
            this.offscreenCanvas.width = width;
            this.offscreenCanvas.height = height;
        }

        this.offscreenCtx.filter = `brightness(${this.brightness})`;
        this.offscreenCtx.drawImage(this.video, 0, 0, width, height);

        this.samplingPoints.forEach(point => {
            const px = Math.floor(point.x * width);
            const py = Math.floor(point.y * height);

            const pixel = this.offscreenCtx.getImageData(px, py, 1, 1).data;
            const hsv = rgbToHsv(pixel[0], pixel[1], pixel[2]);
            
            newData.push({
                ...hsv,
                rgb: `rgb(${pixel[0]},${pixel[1]},${pixel[2]})`,
                x: px,
                y: py
            });

            this.ctx.beginPath();
            this.ctx.arc(px, py, 10, 0, Math.PI * 2);
            this.ctx.strokeStyle = 'white';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            this.ctx.fillStyle = `rgba(${pixel[0]},${pixel[1]},${pixel[2]}, 0.5)`;
            this.ctx.fill();
        });

        this.currentData = newData;
        return newData;
    }
}
