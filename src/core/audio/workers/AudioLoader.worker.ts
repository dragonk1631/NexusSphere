/**
 * AudioLoader Worker
 * 메인 스레드의 부하를 방지하기 위해 대용량 에셋의 Fetch 및 ArrayBuffer 처리를 백그라운드에서 수행합니다.
 */

self.onmessage = async (e: MessageEvent) => {
    const { url, requestId } = e.data;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();

        // Transferable objects를 사용하여 복사 없이 메인 스레드로 데이터 전송
        (self as any).postMessage({
            requestId,
            url,
            buffer: arrayBuffer,
            success: true
        }, [arrayBuffer]);

    } catch (error: any) {
        self.postMessage({
            requestId,
            url,
            success: false,
            error: error.message
        });
    }
};
