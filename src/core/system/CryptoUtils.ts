/**
 * CryptoUtils - 보안 전송을 위한 암호화 유틸리티
 */
export class CryptoUtils {
    /**
     * 데이터를 HMAC-SHA256으로 서명합니다.
     * @param message 서명할 메시지
     * @param secret 비밀키
     */
    public static async signMessage(message: string, secret: string): Promise<string> {
        const encoder = new TextEncoder();
        const keyData = encoder.encode(secret);
        const messageData = encoder.encode(message);

        const key = await crypto.subtle.importKey(
            'raw',
            keyData,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );

        const signature = await crypto.subtle.sign('HMAC', key, messageData);
        
        // binary를 hex string으로 변환
        return Array.from(new Uint8Array(signature))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    /**
     * 고유한 논스(Nonce)를 생성합니다. (리플레이 공격 방지)
     */
    public static generateNonce(): string {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
}
