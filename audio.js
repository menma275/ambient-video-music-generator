class AudioEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.reverbNode = null;
        this.delayNode = null;
        
        // Scales
        this.scales = {
            major: [261.63, 293.66, 329.63, 392.00, 440.00], // C Major Pentatonic
            minor: [261.63, 311.13, 349.23, 392.00, 466.16], // C Minor Pentatonic
            chromatic: [261.63, 277.18, 293.66, 311.13, 329.63, 349.23, 369.99, 392.00, 415.30, 440.00, 466.16, 493.88]
        };
        
        this.baseScale = this.scales.major;
        this.octaves = [0.5, 1, 2];
        
        // Mood Presets
        this.moods = {
            ambient: {
                osc: 'triangle',
                attack: [1.5, 2.5],
                release: [3.0, 5.0],
                filterMod: 4000
            },
            pulse: {
                osc: 'square',
                attack: [0.05, 0.15],
                release: [0.4, 0.8],
                filterMod: 2000
            },
            shimmer: {
                osc: 'sine',
                attack: [0.1, 0.3],
                release: [2.0, 4.0],
                filterMod: 8000
            },
            deep: {
                osc: 'sawtooth',
                attack: [2.0, 4.0],
                release: [4.0, 8.0],
                filterMod: 1000
            }
        };
        
        // 設定値の初期化
        this.settings = {
            mood: 'ambient',
            oscType: 'triangle',
            highOctave: true,
            baseFilterFreq: 2000,
            reverbMix: 0.5,
            delayMix: 0.4,
            delayTime: 0.5,
            rhythmDensity: 1.0
        };
    }

    async init() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        
        // マスターゲイン
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.5;

        // リバーブ (Convolver)
        this.reverbNode = this.ctx.createConvolver();
        this.reverbNode.buffer = this.createReverbBuffer(3.0, 2.0); // 3秒の残響
        this.reverbGain = this.ctx.createGain();
        this.reverbGain.gain.value = this.settings.reverbMix;

        // ディレイ
        this.delayNode = this.ctx.createDelay(2.0);
        this.delayNode.delayTime.value = this.settings.delayTime;
        this.delayFeedback = this.ctx.createGain();
        this.delayFeedback.gain.value = 0.4;
        this.delayMixGain = this.ctx.createGain();
        this.delayMixGain.gain.value = this.settings.delayMix;
        
        // ディレイのフィードバックループ
        this.delayNode.connect(this.delayFeedback);
        this.delayFeedback.connect(this.delayNode);

        // フィルター
        this.mainFilter = this.ctx.createBiquadFilter();
        this.mainFilter.type = 'lowpass';
        this.mainFilter.frequency.value = this.settings.baseFilterFreq;

        // 接続
        this.dryGain = this.ctx.createGain();
        this.dryGain.gain.value = 1.0;

        this.reverbGain.connect(this.reverbNode);
        this.reverbNode.connect(this.mainFilter);
        
        this.delayMixGain.connect(this.delayNode);
        this.delayNode.connect(this.mainFilter);
        
        this.dryGain.connect(this.mainFilter);
        this.mainFilter.connect(this.masterGain);
        
        // アナライザー (内部的に保持)
        this.analyser = this.ctx.createAnalyser();
        this.masterGain.connect(this.analyser);
        
        this.masterGain.connect(this.ctx.destination);
    }

    setReverbMix(value) {
        this.settings.reverbMix = value;
        if (this.reverbGain) this.reverbGain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.1);
    }

    setDelayMix(value) {
        this.settings.delayMix = value;
        if (this.delayMixGain) this.delayMixGain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.1);
    }

    setDelayTime(value) {
        this.settings.delayTime = value;
        if (this.delayNode) this.delayNode.delayTime.setTargetAtTime(value, this.ctx.currentTime, 0.1);
    }

    setOscType(type) {
        this.settings.oscType = type;
    }

    setHighOctave(enabled) {
        this.settings.highOctave = enabled;
        this.octaves = enabled ? [0.5, 1, 2] : [0.5, 1];
    }

    setBaseFilterFreq(value) {
        this.settings.baseFilterFreq = value;
        if (this.mainFilter) this.mainFilter.frequency.setTargetAtTime(value, this.ctx.currentTime, 0.1);
    }

    setMasterVolume(value) {
        if (this.masterGain) this.masterGain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.1);
    }

    setScale(type) {
        if (this.scales[type]) {
            this.baseScale = this.scales[type];
        }
    }

    setRhythmDensity(value) {
        this.settings.rhythmDensity = value;
    }

    setMood(type) {
        if (this.moods[type]) {
            this.settings.mood = type;
            // 必要に応じて即時反映
            this.settings.oscType = this.moods[type].osc;
        }
    }

    createReverbBuffer(duration, decay) {
        const sampleRate = this.ctx.sampleRate;
        const length = sampleRate * duration;
        const buffer = this.ctx.createBuffer(2, length, sampleRate);
        
        for (let channel = 0; channel < 2; channel++) {
            const data = buffer.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
            }
        }
        return buffer;
    }

    playNote(hsv) {
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const moodParams = this.moods[this.settings.mood];

        const scaleIndex = Math.floor((hsv.h / 360) * this.baseScale.length);
        const octaveIndex = Math.floor(hsv.v * this.octaves.length);
        const baseFreq = this.baseScale[scaleIndex];
        const freq = baseFreq * this.octaves[octaveIndex];

        const volume = 0.1 + (hsv.s * 0.2);
        const cutoff = 400 + (hsv.s * moodParams.filterMod);

        this.triggerSynth(freq, volume, cutoff);
    }

    triggerSynth(freq, volume, cutoff) {
        const now = this.ctx.currentTime;
        const moodParams = this.moods[this.settings.mood];
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = moodParams.osc;
        osc.frequency.setValueAtTime(freq, now);
        
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(cutoff, now);
        filter.Q.setValueAtTime(1, now);

        const attack = moodParams.attack[0] + Math.random() * (moodParams.attack[1] - moodParams.attack[0]);
        const release = moodParams.release[0] + Math.random() * (moodParams.release[1] - moodParams.release[0]);
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(volume, now + attack);
        gain.gain.exponentialRampToValueAtTime(0.001, now + attack + release);

        osc.connect(filter);
        filter.connect(gain);
        
        gain.connect(this.dryGain);
        gain.connect(this.reverbGain);
        gain.connect(this.delayMixGain);

        osc.start(now);
        osc.stop(now + attack + release + 0.1);
    }

    stop() {
        if (this.ctx) {
            this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5);
            setTimeout(() => {
                this.ctx.suspend();
            }, 1000);
        }
    }
    
    resume() {
        if (this.ctx) {
            this.ctx.resume();
            this.masterGain.gain.setTargetAtTime(0.5, this.ctx.currentTime, 0.5);
        }
    }
}
