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
            if (this.isSoundFontLoaded) {
                this.synth?.stopAllNotes?.();
            }
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
