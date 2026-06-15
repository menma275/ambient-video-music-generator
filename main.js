document.addEventListener('DOMContentLoaded', async () => {
    const videoElement = document.getElementById('webcam');
    const canvasElement = document.getElementById('overlay');
    const toggleButton = document.getElementById('toggleButton');
    const cameraSelect = document.getElementById('cameraSource');
    const ambientBgCanvas = document.getElementById('ambient-bg');
    const ambientBgCtx = ambientBgCanvas.getContext('2d');
    const iconContainer = toggleButton.querySelector('.icon-container');

    const videoProcessor = new VideoProcessor(videoElement, canvasElement);
    const audioEngine = new AudioEngine();

    let isPlaying = false;

    // アイコンの更新
    function updateButtonIcon() {
        if (isPlaying) {
            iconContainer.innerHTML = `
                <svg viewBox="0 0 100 100">
                    <rect x="20" y="20" width="60" height="60" fill="currentColor" />
                </svg>
            `;
        } else {
            iconContainer.innerHTML = `
                <svg viewBox="0 0 100 100">
                    <polygon points="20,10 20,90 89.3,50" fill="currentColor" />
                </svg>
            `;
        }
    }

    updateButtonIcon();

    // キャンバスサイズを調整
    function resizeCanvas() {
        ambientBgCanvas.width = window.innerWidth;
        ambientBgCanvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // カメラリストの更新
    async function updateCameraList() {
        const devices = await videoProcessor.getVideoDevices();
        cameraSelect.innerHTML = '';
        devices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `Camera ${cameraSelect.length + 1}`;
            cameraSelect.appendChild(option);
        });
    }

    // 初期化
    const videoInitSuccess = await videoProcessor.init();
    if (videoInitSuccess) {
        // 初回成功後にカメラリストを取得（権限が必要なため）
        await updateCameraList();
    } else {
        toggleButton.disabled = true;
    }

    toggleButton.addEventListener('click', async () => {
        if (!isPlaying) {
            await audioEngine.init();
            isPlaying = true;
            updateButtonIcon();
            startLoop();
        } else {
            isPlaying = false;
            updateButtonIcon();
            audioEngine.stop();
        }
    });

    // UIコントロールのイベント設定
    cameraSelect.addEventListener('change', async (e) => {
        const wasPlaying = isPlaying;
        if (wasPlaying) {
            // 再生中なら一旦止めるか、そのまま継続するか。
            // ストリームが切り替わるので、initを再度呼ぶ必要がある。
            await videoProcessor.init(e.target.value);
        } else {
            await videoProcessor.init(e.target.value);
        }
    });

    document.getElementById('reverbMix').addEventListener('input', (e) => {
        audioEngine.setReverbMix(parseFloat(e.target.value));
    });

    document.getElementById('delayMix').addEventListener('input', (e) => {
        audioEngine.setDelayMix(parseFloat(e.target.value));
    });

    document.getElementById('delayTime').addEventListener('input', (e) => {
        audioEngine.setDelayTime(parseFloat(e.target.value));
    });

    document.getElementById('oscType').addEventListener('change', (e) => {
        audioEngine.setOscType(e.target.value);
    });

    document.getElementById('filterFreq').addEventListener('input', (e) => {
        audioEngine.setBaseFilterFreq(parseFloat(e.target.value));
    });

    document.getElementById('highOctave').addEventListener('change', (e) => {
        audioEngine.setHighOctave(e.target.checked);
    });

    document.getElementById('masterVolume').addEventListener('input', (e) => {
        audioEngine.setMasterVolume(parseFloat(e.target.value));
    });

    document.getElementById('videoBrightness').addEventListener('input', (e) => {
        videoProcessor.setBrightness(parseFloat(e.target.value));
    });

    document.getElementById('moodType').addEventListener('change', (e) => {
        audioEngine.setMood(e.target.value);
    });

    document.getElementById('scaleType').addEventListener('change', (e) => {
        audioEngine.setScale(e.target.value);
    });

    document.getElementById('rhythmDensity').addEventListener('input', (e) => {
        audioEngine.setRhythmDensity(parseFloat(e.target.value));
    });

    function startLoop() {
        function updateVideo() {
            if (!isPlaying) return;
            videoProcessor.process();
            drawAmbientBg();
            requestAnimationFrame(updateVideo);
        }
        requestAnimationFrame(updateVideo);

        function drawAmbientBg() {
            const data = videoProcessor.currentData;
            if (!data || data.length === 0) return;

            const width = ambientBgCanvas.width;
            const height = ambientBgCanvas.height;

            ambientBgCtx.fillStyle = 'rgba(0, 0, 0, 0.1)';
            ambientBgCtx.fillRect(0, 0, width, height);

            ambientBgCtx.globalAlpha = 0.15;
            ambientBgCtx.globalCompositeOperation = 'source-over';

            data.forEach((point, i) => {
                const x = (point.x / videoProcessor.canvas.width) * width;
                const y = (point.y / videoProcessor.canvas.height) * height;
                
                const time = Date.now() * 0.0005;
                const offsetX = Math.sin(time + i) * 150;
                const offsetY = Math.cos(time * 0.7 + i) * 150;

                const radius = width * 1.2;
                const grad = ambientBgCtx.createRadialGradient(
                    x + offsetX, y + offsetY, 0,
                    x + offsetX, y + offsetY, radius
                );
                
                const color = point.rgb;
                grad.addColorStop(0, color);
                grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

                ambientBgCtx.fillStyle = grad;
                ambientBgCtx.fillRect(0, 0, width, height);
            });
            
            ambientBgCtx.globalAlpha = 1.0;
            ambientBgCtx.globalCompositeOperation = 'source-over';
        }

        const samplingPoints = videoProcessor.samplingPoints;
        samplingPoints.forEach((point, index) => {
            const baseInterval = 4000 + (index * 400);
            const triggerNote = () => {
                if (!isPlaying) return;
                const data = videoProcessor.currentData[index];
                if (data) {
                    audioEngine.playNote(data);
                }
                const density = audioEngine.settings.rhythmDensity;
                const interval = (baseInterval / density) + (Math.random() * 1000);
                const nextInterval = interval + (Math.random() * 500 - 250);
                setTimeout(triggerNote, nextInterval);
            };
            setTimeout(triggerNote, index * 500);
        });
    }
});
