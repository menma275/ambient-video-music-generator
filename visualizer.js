class WebGLVisualizer {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl');
        if (!this.gl) {
            console.error('WebGL not supported');
            return;
        }

        this.program = this.createProgram();
        this.buffer = this.gl.createBuffer();
        this.audioTexture = this.gl.createTexture();
        
        this.initMesh();
        this.initTexture();
    }

    createShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error(this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    createProgram() {
        const vsSource = `
            attribute vec2 a_position;
            varying vec2 v_uv;
            void main() {
                v_uv = a_position * 0.5 + 0.5;
                gl_Position = vec4(a_position, 0.0, 1.0);
            }
        `;
        const fsSource = `
            precision mediump float;
            uniform sampler2D u_audioData;
            uniform float u_time;
            varying vec2 v_uv;
            
            void main() {
                // オーディオデータのサンプリング
                float audioSample = texture2D(u_audioData, vec2(v_uv.x, 0.5)).r;
                
                // 波形の中心からの距離
                float dist = abs(v_uv.y - audioSample);
                
                // やんわりとしたラインの描画
                float glow = exp(-dist * 15.0) * 0.5;
                float line = smoothstep(0.015, 0.0, dist);
                
                vec3 color = vec3(0.8, 0.9, 1.0);
                float alpha = (line + glow) * 0.6;
                
                gl_FragColor = vec4(color, alpha);
            }
        `;

        const vs = this.createShader(this.gl.VERTEX_SHADER, vsSource);
        const fs = this.createShader(this.gl.FRAGMENT_SHADER, fsSource);
        
        const program = this.gl.createProgram();
        this.gl.attachShader(program, vs);
        this.gl.attachShader(program, fs);
        this.gl.linkProgram(program);
        
        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            console.error(this.gl.getProgramInfoLog(program));
            return null;
        }
        return program;
    }

    initMesh() {
        const vertices = new Float32Array([
            -1, -1,  1, -1, -1,  1,
            -1,  1,  1, -1,  1,  1
        ]);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);
    }

    initTexture() {
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.audioTexture);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    }

    render(audioData) {
        if (!this.gl) return;

        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        this.gl.clearColor(0, 0, 0, 0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);

        this.gl.useProgram(this.program);

        // オーディオデータをテクスチャにアップロード
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.audioTexture);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.LUMINANCE, audioData.length, 1, 0, this.gl.LUMINANCE, this.gl.UNSIGNED_BYTE, audioData);

        const positionLoc = this.gl.getAttribLocation(this.program, 'a_position');
        this.gl.enableVertexAttribArray(positionLoc);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
        this.gl.vertexAttribPointer(positionLoc, 2, this.gl.FLOAT, false, 0, 0);

        const audioLoc = this.gl.getUniformLocation(this.program, 'u_audioData');
        this.gl.uniform1i(audioLoc, 0);

        this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
    }
}
