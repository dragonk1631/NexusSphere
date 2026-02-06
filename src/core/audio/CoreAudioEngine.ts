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
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
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

            this.synth.connect(this.ctx.destination);
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
            this.synth.controllerChange(i, 120, 0); // All Sound Off
            this.synth.controllerChange(i, 123, 0); // All Notes Off
        }
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
     * 시퀀서 레벨에서 채널을 완전 차단하거나 해제합니다.
     * MIDI 볼륨(CC 7) 이벤트에 영향을 받지 않는 가장 강력한 차단 방식입니다.
     */
    public setChannelMute(channel: number, mute: boolean): void {
        if (!this.sequencer) return;
        // SpessaSynth Sequencer API check: muteChannel handles playback isolation
        if (typeof this.sequencer.muteChannel === 'function') {
            this.sequencer.muteChannel(channel, mute);
        } else {
            // Fallback: CC 7 Volume 0 if muteChannel is unavailable
            this.setChannelVolume(channel, mute ? 0 : 100);
        }
    }

    /**
     * 특정 트랙 인덱스의 재생을 차단하거나 해제합니다.
     * 동일 채널을 공유하는 트랙들 사이에서 개별 트랙을 격리할 때 사용합니다.
     */
    public setTrackMute(trackIndex: number, mute: boolean): void {
        if (!this.sequencer) return;

        const tracks = this.sequencer.tracks || (this.sequencer.song && this.sequencer.song.tracks);
        if (tracks && tracks[trackIndex]) {
            const track = tracks[trackIndex];

            // 1. SpessaSynth 공식 및 잠재적 속성 전수 적용
            track.userMute = mute;
            track.disabled = mute;
            track.enabled = !mute;
            track.muted = mute;

            // 2. 만약 함수형 API가 제공된다면 호출
            if (typeof track.setMute === 'function') track.setMute(mute);

            if (mute) {
                console.log(`[CoreAudioEngine] FORCE MUTED Track ${trackIndex}: ${track.name}`);
            }
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
