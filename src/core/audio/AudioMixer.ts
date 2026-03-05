import { AudioEngineLogger } from './AudioEngineLogger';

/**
 * AudioMixer: Manages the WebAudio graph and filter chains.
 * Ensures safe connection/disconnection of processing nodes.
 */
export class AudioMixer {
    private ctx: AudioContext;
    private lowFilter: BiquadFilterNode;
    private midFilter: BiquadFilterNode;
    private highFilter: BiquadFilterNode;
    private masterGain: GainNode;

    constructor(ctx: AudioContext) {
        this.ctx = ctx;

        this.lowFilter = ctx.createBiquadFilter();
        this.lowFilter.type = 'lowshelf';
        this.lowFilter.frequency.value = 200;

        this.midFilter = ctx.createBiquadFilter();
        this.midFilter.type = 'peaking';
        this.midFilter.frequency.value = 1000;
        this.midFilter.Q.value = 1.0;

        this.highFilter = ctx.createBiquadFilter();
        this.highFilter.type = 'highshelf';
        this.highFilter.frequency.value = 5000;

        this.masterGain = ctx.createGain();

        // Connect Chain: In -> Low -> Mid -> High -> Master -> Out
        this.lowFilter.connect(this.midFilter);
        this.midFilter.connect(this.highFilter);
        this.highFilter.connect(this.masterGain);
        this.masterGain.connect(ctx.destination);
    }

    /**
     * Safely connects a source node to the start of the mixer chain.
     */
    public connectSource(source: AudioNode) {
        try {
            source.connect(this.lowFilter);
            AudioEngineLogger.debug('Source connected to mixer chain');
        } catch (e) {
            AudioEngineLogger.error('Failed to connect source:', e);
        }
    }

    /**
     * Sets EQ gain for a specific band.
     */
    public setEQ(type: 'low' | 'mid' | 'high', gain: number) {
        const filter = type === 'low' ? this.lowFilter : type === 'mid' ? this.midFilter : this.highFilter;
        filter.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.1);
        AudioEngineLogger.debug(`EQ ${type} set to ${gain}dB`);
    }

    public setMasterVolume(volume: number) {
        const gain = volume / 100;
        this.masterGain.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.05);
    }

    public getInputNode(): AudioNode {
        return this.lowFilter;
    }
}
