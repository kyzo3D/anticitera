"use client";

import clsx from "clsx";
import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { EnterIcon, LoadingIcon } from "@/lib/icons";
import { usePlayer } from "@/lib/usePlayer";
import { track } from "@vercel/analytics";
import { useMicVAD, utils } from "@ricky0123/vad-react";

type Message = {
	role: "user" | "assistant";
	content: string;
	latency?: number;
};

export default function Home() {
	const [input, setInput] = useState("");
	const [isAIResponding, setIsAIResponding] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const player = usePlayer();
	const submitTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	const vad = useMicVAD({
		startOnLoad: true,
		onSpeechStart: () => {
			player.stop();
			setIsAIResponding(false);
			if (submitTimeoutRef.current) {
				clearTimeout(submitTimeoutRef.current);
			}
		},
		onSpeechEnd: (audio) => {
			const wav = utils.encodeWAV(audio);
			const blob = new Blob([wav], { type: "audio/wav" });
			
			submitTimeoutRef.current = setTimeout(() => {
				submit(blob);
				setIsAIResponding(true);
			}, 1000); // 1 second delay

			const isFirefox = navigator.userAgent.includes("Firefox");
			if (isFirefox) vad.pause();
		},
		workletURL: "/vad.worklet.bundle.min.js",
		modelURL: "/silero_vad.onnx",
		positiveSpeechThreshold: 0.6,
		negativeSpeechThreshold: 0.6,
		minSpeechFrames: 4,
		preSpeechPadFrames: 1,
		redemptionFrames: 5,
		ortConfig(ort) {
			const isSafari = /^((?!chrome|android).)*safari/i.test(
				navigator.userAgent
			);

			ort.env.wasm = {
				wasmPaths: {
					"ort-wasm-simd-threaded.wasm":
					"/ort-wasm-simd-threaded.wasm",
					"ort-wasm-simd.wasm": "/ort-wasm-simd.wasm",
					"ort-wasm.wasm": "/ort-wasm.wasm",
					"ort-wasm-threaded.wasm": "/ort-wasm-threaded.wasm",
				},
				numThreads: isSafari ? 1 : 4,
			};
		},
	});

	useEffect(() => {
		function keyDown(e: KeyboardEvent) {
			if (e.key === "Enter") return inputRef.current?.focus();
			if (e.key === "Escape") return setInput("");
		}

		window.addEventListener("keydown", keyDown);
		return () => window.removeEventListener("keydown", keyDown);
	});

	const [messages, submit, isPending] = useActionState<
		Array<Message>,
		string | Blob
	>(async (prevMessages, data) => {
		const formData = new FormData();

		if (typeof data === "string") {
			formData.append("input", data);
			track("Text input");
		} else {
			formData.append("input", data, "audio.wav");
			track("Speech input");
		}

		for (const message of prevMessages) {
			formData.append("message", JSON.stringify(message));
		}

		const submittedAt = Date.now();

		const response = await fetch("/api", {
			method: "POST",
			body: formData,
		});

		const transcript = decodeURIComponent(
			response.headers.get("X-Transcript") || ""
		);
		const text = decodeURIComponent(
			response.headers.get("X-Response") || ""
		);

		if (!response.ok || !transcript || !text || !response.body) {
			if (response.status === 429) {
				toast.error("Too many requests. Please try again later.");
			} else {
				toast.error((await response.text()) || "An error occurred.");
			}

			return prevMessages;
		}

		const latency = Date.now() - submittedAt;
		setIsAIResponding(true);
		player.play(response.body, () => {
			const isFirefox = navigator.userAgent.includes("Firefox");
			if (isFirefox) vad.start();
			setIsAIResponding(false);
		});
		setInput(transcript);

		return [
			...prevMessages,
			{
				role: "user",
				content: transcript,
			},
			{
				role: "assistant",
				content: text,
				latency,
			},
		];
	}, []);

	function handleFormSubmit(e: React.FormEvent) {
		e.preventDefault();
		submit(input);
	}

	return (
		<div className="flex flex-col h-full w-full justify-between items-center">
			<div className="w-full max-w-3xl flex-grow flex flex-col items-center justify-start">
				<div className="relative aspect-square w-96 max-w-full mb-8">
					<div
						className={clsx(
							"absolute inset-0 rounded-full bg-gradient-to-br from-green-400 to-cyan-400 transition-all duration-2000 ease-in-out",
							{
								"opacity-0 scale-95 blur-xl animate-fade-in-blur": vad.loading,
								"opacity-0 scale-95": vad.errored,
								"opacity-50 scale-100 animate-pulse-slow blur-md": !vad.loading && !vad.errored && !vad.userSpeaking && !isAIResponding,
								"opacity-80 scale-105 animate-core-pulse blur-sm": vad.userSpeaking,
								"opacity-70 scale-103 animate-core-wave blur-md": isAIResponding,
							}
						)}
					/>

					<div
						className={clsx(
							"absolute inset-4 rounded-full border-4 border-cyan-300 transition-all duration-2000 ease-in-out blur-sm",
							{
								"opacity-0 scale-95": vad.loading || vad.errored,
								"opacity-30 scale-100 animate-spin-slow": !vad.loading && !vad.errored && !vad.userSpeaking && !isAIResponding,
								"opacity-60 scale-103 animate-spin-reverse": vad.userSpeaking,
								"opacity-50 scale-102 animate-ping": isAIResponding,
							}
						)}
					/>

					<div
						className={clsx(
							"absolute inset-8 rounded-full border-2 border-green-300 transition-all duration-2000 ease-in-out blur-sm",
							{
								"opacity-0 scale-95": vad.loading || vad.errored,
								"opacity-20 scale-100 animate-spin-reverse-slow": !vad.loading && !vad.errored && !vad.userSpeaking && !isAIResponding,
								"opacity-50 scale-103 animate-spin": vad.userSpeaking,
								"opacity-40 scale-102 animate-spin-slow": isAIResponding,
							}
						)}
					/>

					<div
						className={clsx(
							"absolute -inset-4 rounded-full border border-cyan-200 transition-all duration-2000 ease-in-out blur-sm",
							{
								"opacity-0 scale-95": vad.loading || vad.errored,
								"opacity-10 scale-100 animate-pulse": !vad.loading && !vad.errored && !vad.userSpeaking && !isAIResponding,
								"opacity-30 scale-105 animate-ping-slow": vad.userSpeaking,
								"opacity-25 scale-103 animate-pulse-fast": isAIResponding,
							}
						)}
					/>

					<div
						className={clsx(
							"absolute inset-0 rounded-full bg-gradient-to-r from-green-300 via-cyan-400 to-green-300 transition-all duration-2000 ease-in-out blur-3xl",
							{
								"opacity-0": vad.loading || vad.errored,
								"opacity-20": !vad.loading && !vad.errored && !vad.userSpeaking && !isAIResponding,
								"opacity-50 animate-pulse": vad.userSpeaking,
								"opacity-40 animate-wave": isAIResponding,
							}
						)}
					/>

					<div className="absolute inset-0 rounded-full overflow-hidden blur-xl">
						<div className="w-full h-full bg-gradient-to-br from-transparent via-cyan-200 to-transparent opacity-20 animate-shimmer" />
					</div>

					<div
						className={clsx(
							"absolute -inset-8 rounded-full transition-all duration-2000 ease-in-out blur-2xl",
							{
								"opacity-0": vad.loading || vad.errored,
								"opacity-30 animate-pulse-slow": !vad.loading && !vad.errored && !vad.userSpeaking && !isAIResponding,
								"opacity-60 animate-glow": vad.userSpeaking,
								"opacity-50 animate-glow-soft": isAIResponding,
							}
						)}
						style={{
							background: isAIResponding
								? "radial-gradient(circle, rgba(52, 211, 153, 0.4) 0%, rgba(34, 211, 238, 0.2) 25%, rgba(52, 211, 153, 0.1) 50%, transparent 70%)"
								: "radial-gradient(circle, rgba(52, 211, 153, 0.3) 0%, rgba(34, 211, 238, 0.2) 25%, rgba(52, 211, 153, 0.1) 50%, transparent 70%)",
						}}
					/>

					<div className="absolute inset-0 flex items-center justify-center">
						<div
							className={clsx(
								"w-2/5 h-2/5 bg-contain bg-center bg-no-repeat transition-all duration-2000 ease-in-out",
								{
									"opacity-0 scale-95 blur-[20px] animate-fade-in-blur": vad.loading,
									"opacity-0 scale-95 blur-[11px]": vad.errored,
									"opacity-30 scale-100 animate-pulse-slow blur-[3px]": !vad.loading && !vad.errored && !vad.userSpeaking && !isAIResponding,
									"opacity-60 scale-105 animate-logo-pulse blur-[5px]": vad.userSpeaking,
									"opacity-50 scale-103 blur-[1px]": isAIResponding,
								}
							)}
							style={{
								backgroundImage: "url('/logo.png')",
								maskImage: "radial-gradient(circle, white 10%, transparent 80%)",
								WebkitMaskImage: "radial-gradient(circle, white 10%, transparent 80%)",
							}}
						/>
					</div>
				</div>

				<div className="text-neutral-400 dark:text-neutral-600 pt-11 text-center max-w-xl text-balance min-h-5 space-y-2 mb-2">
					{messages.length > 0 && (
						<p>
							{messages.at(-1)?.content}
						</p>
					)}

					{messages.length === 0 && (
						<>
							{vad.loading ? (
								<p>Iniciando...</p>
							) : vad.errored ? (
								<p>No he podido entenderte.</p>
							) : (
								<p className="text-xl font-medium radial-text">
									Just say something to talk with Aura...
								</p>
							)}
						</>
					)}
				</div>
			</div>

			<div className="w-full max-w-3xl mt-auto">
				<form
					className="rounded-full bg-neutral-200/80 dark:bg-neutral-800/80 flex items-center w-full border border-transparent hover:border-neutral-300 focus-within:border-neutral-400 hover:focus-within:border-neutral-400 dark:hover:border-neutral-700 dark:focus-within:border-neutral-600 dark:hover:focus-within:border-neutral-600"
					onSubmit={handleFormSubmit}
				>
					<input
						type="text"
						className="bg-transparent focus:outline-none p-4 w-full placeholder:text-neutral-600 dark:placeholder:text-neutral-400"
						required
						placeholder="Want to be quiet, no problem, talk me here!"
						value={input}
						onChange={(e) => setInput(e.target.value)}
						ref={inputRef}
					/>

					<button
						type="submit"
						className="p-4 text-neutral-700 hover:text-black dark:text-neutral-300 dark:hover:text-white"
						disabled={isPending}
						aria-label="Submit"
					>
						{isPending ? <LoadingIcon /> : <EnterIcon />}
					</button>
				</form>
			</div>
		</div>
	);
}
