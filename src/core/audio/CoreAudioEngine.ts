/**
 * Core Audio Engine - SpessaSynth 기반 고품질 MIDI 재생기
 */

// @ts-ignore: SpessaSynth does not have official types yet
const SPESSA_LIB_URL = 'https://esm.sh/spessasynth_lib@4.0.20';
const PROCESSOR_URL = 'https://esm.sh/spessasynth_lib@4.0.20/dist/spessasynth_processor.min.js';

export class CoreAudioEngine {
    private static instance: CoreAudioEngine;
    private ctx: AudioContext;
    private synth: any = null;
    private sequencer: any = null;
    private isReady: boolean = false;
    private isSoundFontLoaded: boolean = false;

    private constructor() {
        // Optimization: Use 'playback' latency hint for mobile to increase buffer safety
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)({
            latencyHint: isMobile ? 'playback' : 'interactive'
        });
        console.log(`[CoreAudioEngine] Context initialized with ${isMobile ? 'playback' : 'interactive'} latency hint.`);
    }

    public static getInstance(): CoreAudioEngine {
        if (!CoreAudioEngine.instance) {
            CoreAudioEngine.instance = new CoreAudioEngine();
        }
        return CoreAudioEngine.instance;
    }

    public async init(soundFontUrl: string): Promise<void> {
        if (this.isReady) return;

        try {
            // @ts-ignore
            const { WorkletSynthesizer, Sequencer } = await import(SPESSA_LIB_URL);
            await this.ctx.audioWorklet.addModule(PROCESSOR_URL);

            this.synth = new WorkletSynthesizer(this.ctx, {
                reverbEnabled: true,
                chorusEnabled: true,
                interpolationType: 'linear',
                sampleRate: this.ctx.sampleRate
            });

            // Phase 3: EQ Filter Chain (Low, Mid, High)
            this.setupEQChain();

            await this.synth.isReady;

            try {
                const sfRes = await fetch(soundFontUrl);
                if (!sfRes.ok) throw new Error(`HTTP ${sfRes.status}`);

                const sfData = await sfRes.arrayBuffer();

                // RIFF 헤더 검증 (Vite 404.html 반환 방지)
                const header = new TextDecoder().decode(new Uint8Array(sfData.slice(0, 4)));
                if (header.toLowerCase() !== 'riff') {
                    throw new Error("Invalid SoundFont header (Expected RIFF)");
                }

                await this.synth.soundBankManager.addSoundBank(sfData);
                this.sequencer = new Sequencer(this.synth);
                this.isReady = true;
                this.isSoundFontLoaded = true;
                console.log("[CoreAudioEngine] Ready with SoundFont");
            } catch (sfError) {
                console.warn(`[CoreAudioEngine] SoundFont loading failed: ${sfError}. Running in silent mode.`);
                this.sequencer = new Sequencer(this.synth);
                this.isReady = true;
                this.isSoundFontLoaded = false;
            }
        } catch (e) {
            console.error("[CoreAudioEngine] Critical Init failed:", e);
            if (!window.isSecureContext) {
                const errorMsg = "[CoreAudioEngine] This is a non-secure context (HTTP). AudioWorklets REQUIRE HTTPS or localhost to function on mobile.";
                console.error(errorMsg);
                throw new Error(errorMsg);
            }
            throw e;
        }
    }

    public async loadMidi(buffer: ArrayBuffer): Promise<void> {
        if (!this.sequencer) throw new Error("Sequencer not initialized");
        await this.sequencer.loadNewSongList([{ binary: buffer }]);

        // Debugging: 시퀀서가 인식하는 트랙 정보 및 객체 속성 전수 조사
        const tracks = this.sequencer.tracks || (this.sequencer.song && this.sequencer.song.tracks);
        if (tracks) {
            console.log(`[CoreAudioEngine] MIDI Loaded. Sequencer Tracks: ${tracks.length}`);
            tracks.forEach((t: any, i: number) => {
                const keys = Object.keys(t);
                console.log(`[Sequencer-Track-${i}] name: ${t.name}, ch: ${t.channel}, keys: ${keys.join(', ')}`);
                console.log(`[Sequencer-Track-${i}] values - userMute: ${t.userMute}, disabled: ${t.disabled}`);
            });
        }
    }

    public play(): void {
        if (!this.isSoundFontLoaded) return;
        this.sequencer?.play();
    }

    public pause(): void {
        this.sequencer?.pause();
    }

    public stop(): void {
        if (this.sequencer) {
            this.sequencer.pause();
            this.sequencer.currentTime = 0;
            this.stopAllNotes(); // 기존 코드 재활용
        }
    }

    /**
     * 모든 채널의 소리를 즉시 차단합니다. (MIDI Panic)
     */
    public stopAllNotes(): void {
        if (!this.synth || !this.isReady) return;
        for (let i = 0; i < 16; i++) {
            this.stopChannelNotes(i);
        }
    }

    /**
     * 특정 채널의 소리를 즉시 차단합니다.
     * @param channel 0-15
     */
    public stopChannelNotes(channel: number): void {
        if (!this.synth || !this.isReady) return;
        this.synth.controllerChange(channel, 120, 0); // All Sound Off
        this.synth.controllerChange(channel, 123, 0); // All Notes Off
    }

    public seek(time: number): void {
        if (this.sequencer) {
            this.sequencer.currentTime = time;
        }
    }

    /**
     * 재생 속도(BPM 배속)를 설정합니다.
     * @param rate 1.0이 기본 속도
     */
    public setPlaybackRate(rate: number): void {
        if (this.sequencer) {
            this.sequencer.playbackRate = rate;
        }
    }

    /**
     * 실시간 음표 재생 (키음 용도)
     */
    public triggerNoteOn(channel: number, pitch: number, velocity: number = 100): void {
        if (!this.synth || !this.isReady || !this.isSoundFontLoaded) return;
        this.synth.noteOn(channel, pitch, Math.max(30, velocity));
    }

    public triggerNoteOff(channel: number, pitch: number): void {
        if (!this.synth || !this.isReady) return;
        this.synth.noteOff(channel, pitch);
    }

    /* -------------------------------------------
       Channel & Track Control
       ------------------------------------------- */

    /**
     * 특정 MIDI 채널의 볼륨(CC 7)을 제어합니다.
     * @param channel 0-15
     * @param volume 0-127
     */
    public setChannelVolume(channel: number, volume: number): void {
        if (!this.synth || !this.isReady) return;
        // CC 7 (Volume) 설정
        this.synth.controllerChange(channel, 7, volume);

        // 소리가 완전히 꺼져야 하는 경우(Volume 0) 즉시 차단
        if (volume === 0) {
            this.synth.controllerChange(channel, 120, 0); // All Sound Off
            this.synth.controllerChange(channel, 123, 0); // All Notes Off
        }
    }

    /**
     * 경량화된 볼륨 강제 설정 (매 프레임 호출용)
     * MIDI Panic(CC 120/123)을 호출하지 않고 오직 트랙 볼륨(CC 7)만 덮어씌웁니다.
     */
    public overrideChannelVolume(channel: number, volume: number): void {
        if (!this.synth || !this.isReady) return;
        this.synth.controllerChange(channel, 7, volume);
    }

    /**
     * 시퀀서 레벨에서 채널을 완전 차단하거나 해제합니다.
     * MIDI 볼륨(CC 7) 이벤트에 영향을 받지 않는 가장 강력한 차단 방식입니다.
     */
    public setChannelMute(channel: number, mute: boolean): void {
        if (!this.sequencer) return;

        // 1. Try Synth-level mute (strongest, blocks audio generation)
        if (this.synth && typeof this.synth.setChannelMute === 'function') {
            this.synth.setChannelMute(channel, mute);
        }

        // 2. Try Sequencer-level mute (blocks event sending)
        if (typeof this.sequencer.muteChannel === 'function') {
            this.sequencer.muteChannel(channel, mute);
        } else {
            // 3. Fallback: CC 7 Volume 0 if muteChannel is unavailable
            this.setChannelVolume(channel, mute ? 0 : 100);
        }
    }

    /**
     * 특정 트랙 인덱스의 재생을 차단하거나 해제합니다.
     * 동일 채널을 공유하는 트랙들 사이에서 개별 트랙을 격리할 때 사용합니다.
     */
    public setTrackMute(trackIndex: number, mute: boolean): void {
        if (!this.sequencer) return;

        const tracks = this.getSequencerTracks();
        if (tracks && tracks[trackIndex]) {
            const track = tracks[trackIndex];

            // 1. 시퀀서 레벨 트랙 차단 (신규 이벤트 발생 방지)
            track.userMute = mute;
            track.disabled = mute;
            track.enabled = !mute;

            // 2. 신속한 정적 확보를 위한 미디 패닉
            if (mute) {
                this.stopChannelNotes(track.channel);
            }

            // 3. 채널 공유 상태 체크: 만약 해당 채널을 쓰는 모든 트랙이 뮤트 상태라면 채널 자체를 뮤트
            this.updateChannelMuteState(track.channel);

            console.log(`[CoreAudioEngine] ${mute ? 'MUTED' : 'UNMUTED'} Track ${trackIndex}: Ch ${track.channel}`);
        }
    }

    /**
     * 특정 채널을 사용하는 모든 트랙의 상태를 확인하여 채널 뮤트 여부를 결정합니다.
     */
    private updateChannelMuteState(channel: number): void {
        if (!this.sequencer || !this.synth) return;
        const tracks = this.getSequencerTracks();

        // 해당 채널을 사용하는 모든 활성 트랙 검색
        const channelTracks = tracks.filter((t: any) => t.channel === channel);
        const allMuted = channelTracks.every((t: any) => t.userMute || t.disabled);

        // 신디사이저 레벨에서 해당 채널 차단 (가장 강력함)
        if (this.synth && typeof this.synth.setChannelMute === 'function') {
            this.synth.setChannelMute(channel, allMuted);
        } else {
            this.setChannelMute(channel, allMuted); // Re-use robust method
        }
    }


    /**
     * 특정 트랙의 MIDI 채널을 동적으로 재할당합니다. (채널 샌드박싱용)
     */
    public reassignTrackChannel(trackIndex: number, newChannel: number): void {
        if (!this.sequencer) return;
        const tracks = this.sequencer.tracks || (this.sequencer.song && this.sequencer.song.tracks);
        if (tracks && tracks[trackIndex]) {
            const track = tracks[trackIndex];
            const oldChannel = track.channel;
            track.channel = newChannel;
            console.log(`[CoreAudioEngine] Reassigned Track ${trackIndex} (${track.name}): Ch ${oldChannel} -> Ch ${newChannel}`);
        }
    }

    /**
     * 시퀀서의 트랙 리스트를 반환합니다. (정밀 매핑용)
     */
    public getSequencerTracks(): any[] {
        return this.sequencer?.tracks || (this.sequencer?.song && this.sequencer?.song.tracks) || [];
    }

    /**
     * 시퀀서에 로드된 MIDI 파일의 트랙 수를 반환합니다.
     */
    public get midiTrackCount(): number {
        const tracks = this.sequencer?.tracks || this.sequencer?.song?.tracks;
        return tracks?.length || 0;
    }

    /**
     * 모든 채널의 볼륨을 설정합니다.
     */
    public setMasterVolume(volume: number): void {
        if (!this.synth || !this.isReady) return;
        for (let i = 0; i < 16; i++) {
            this.setChannelVolume(i, volume);
        }
    }

    /**
     * 특정 채널을 솔로로 설정합니다. (다른 채널 음소거)
     */
    public soloChannel(channel: number): void {
        if (!this.synth || !this.isReady) return;

        for (let i = 0; i < 16; i++) {
            if (i === channel) {
                this.setChannelVolume(i, 100);
            } else {
                this.setChannelVolume(i, 0);
            }
        }
    }

    /**
     * 솔로를 해제하고 모든 채널의 볼륨을 복구합니다. (단순화: 모두 100으로 복구)
     * TODO: 이전 볼륨 상태 저장/복구 로직 필요
     */
    public unsoloChannel(): void {
        if (!this.synth || !this.isReady) return;
        for (let i = 0; i < 16; i++) {
            this.setChannelVolume(i, 100);
        }
    }

    private lowFilter: BiquadFilterNode | null = null;
    private midFilter: BiquadFilterNode | null = null;
    private highFilter: BiquadFilterNode | null = null;

    private setupEQChain(): void {
        if (!this.synth) return;

        this.lowFilter = this.ctx.createBiquadFilter();
        this.lowFilter.type = 'lowshelf';
        this.lowFilter.frequency.value = 200;

        this.midFilter = this.ctx.createBiquadFilter();
        this.midFilter.type = 'peaking';
        this.midFilter.frequency.value = 1000;
        this.midFilter.Q.value = 1.0;

        this.highFilter = this.ctx.createBiquadFilter();
        this.highFilter.type = 'highshelf';
        this.highFilter.frequency.value = 5000;

        // Chain: Synth -> Low -> Mid -> High -> Out
        this.synth.connect(this.lowFilter);
        this.lowFilter.connect(this.midFilter);
        this.midFilter.connect(this.highFilter);
        this.highFilter.connect(this.ctx.destination);
    }

    /**
     * EQ 게인 조절 (dB)
     * @param type 'low' | 'mid' | 'high'
     * @param gain -12 ~ 12 dB
     */
    public setEQ(type: 'low' | 'mid' | 'high', gain: number): void {
        const filter = type === 'low' ? this.lowFilter : type === 'mid' ? this.midFilter : this.highFilter;
        if (filter) {
            filter.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.1);
        }
    }

    /**
     * 리버브 깊이 조절 (0.0 ~ 1.0)
     */
    public setReverbDepth(depth: number): void {
        if (this.synth) this.synth.reverbGain = depth;
    }

    /**
     * 코러스 깊이 조절 (0.0 ~ 1.0)
     */
    public setChorusDepth(depth: number): void {
        if (this.synth) this.synth.chorusGain = depth;
    }

    public getAudioContext(): AudioContext {
        return this.ctx;
    }


    public async resume(): Promise<void> {
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
    }

    public get currentTime(): number {
        return this.sequencer?.currentTime || 0;
    }

    public get duration(): number {
        return this.sequencer?.duration || 0;
    }
}
