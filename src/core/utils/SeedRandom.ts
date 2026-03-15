/**
 * SeedRandom: A simple Mulberry32 pseudo-random number generator.
 * Used to ensure deterministic chart generation for the same MIDI file.
 */
export class SeedRandom {
    private state: number;

    constructor(seed: number) {
        this.state = seed || 1;
    }

    /**
     * Returns a random float between 0 and 1
     */
    public next(): number {
        let t = this.state += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }

    /**
     * Returns a random integer between min (inclusive) and max (exclusive)
     */
    public nextInt(min: number, max: number): number {
        return Math.floor(this.next() * (max - min) + min);
    }

    /**
     * Returns true with a given probability
     */
    public chance(probability: number): boolean {
        return this.next() < probability;
    }

    /**
     * Helper to pick a random element from an array deterministically
     */
    public pick<T>(array: T[]): T {
        return array[this.nextInt(0, array.length)];
    }
}
