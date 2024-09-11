import { useRef, useState } from "react";

export function usePlayer() {
	const [isPlaying, setIsPlaying] = useState(false);
	const audioContext = useRef<AudioContext | null>(null);
	const sourceNode = useRef<AudioBufferSourceNode | null>(null);
	const audioElement = useRef<HTMLAudioElement | null>(null);

	async function play(stream: ReadableStream, callback: () => void) {
		stop();
		audioContext.current = new AudioContext();

		if (!audioElement.current) {
			audioElement.current = new Audio();
		}

		const mediaSource = new MediaSource();
		audioElement.current.src = URL.createObjectURL(mediaSource);

		mediaSource.addEventListener('sourceopen', async () => {
			const sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg');
			const reader = stream.getReader();

			async function appendChunks() {
				const { done, value } = await reader.read();
				if (done) {
					mediaSource.endOfStream();
					return;
				}
				sourceBuffer.appendBuffer(value);
				sourceBuffer.addEventListener('updateend', appendChunks, { once: true });
			}

			appendChunks();
		});

		audioElement.current.play();
		setIsPlaying(true);

		audioElement.current.onended = () => {
			stop();
			callback();
		};
	}

	function stop() {
		if (audioElement.current) {
			audioElement.current.pause();
			audioElement.current.currentTime = 0;
		}
		if (sourceNode.current) {
			sourceNode.current.stop();
			sourceNode.current.disconnect();
		}
		if (audioContext.current) {
			audioContext.current.close();
		}
		audioContext.current = null;
		sourceNode.current = null;
		setIsPlaying(false);
	}

	return {
		isPlaying,
		play,
		stop,
	};
}
